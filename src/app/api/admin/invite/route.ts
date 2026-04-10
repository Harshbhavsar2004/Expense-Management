import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Auth check — caller must be admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { email, full_name } = body as { email: string; full_name?: string };

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });

    // Admin client (service role) needed for inviteUserByEmail
    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
      data: full_name ? { full_name } : undefined,
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/callback?next=/onboarding`,
    });

    if (error) {
      // Supabase returns 422 if the user already exists
      if (error.message?.toLowerCase().includes("already been registered") ||
          error.message?.toLowerCase().includes("already exists")) {
        return NextResponse.json(
          { error: "This email is already registered in the system." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.user?.id });
  } catch (err) {
    console.error("[API] admin/invite error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
