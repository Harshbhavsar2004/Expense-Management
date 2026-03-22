import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Try to get existing profile
    let { data: profile, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    // Fallback: If profile doesn't exist, create it (acts as a backup for the DB trigger)
    if (error && error.code === 'PGRST116') {
      const { data: newProfile, error: createError } = await supabase
        .from("users")
        .insert({
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0],
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
        })
        .select()
        .single();

      if (createError) {
        return NextResponse.json({ error: "Failed to create profile fallback: " + createError.message }, { status: 500 });
      }
      profile = newProfile;
    } else if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(profile);
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { full_name, phone, avatar_url, organization, team } = body;

    // Check if phone is already taken by another user
    if (phone) {
        const { data: existingUser } = await supabase
            .from("users")
            .select("id")
            .eq("phone", phone)
            .neq("id", user.id)
            .single();
        
        if (existingUser) {
            return NextResponse.json({ error: "Phone number is already in use by another account." }, { status: 400 });
        }
    }

    const updatePayload: Record<string, unknown> = { full_name, phone, avatar_url };
    if (organization !== undefined) updatePayload.organization = organization;
    if (team !== undefined) updatePayload.team = team;

    const { data: updatedProfile, error } = await supabase
      .from("users")
      .update(updatePayload)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(updatedProfile);
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
