import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getCityTier } from "@/app/api/whatsapp/city-tool";

function generateApplicationId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const suffix = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `EXP-${suffix}`;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { clientName, city, visitDuration, participantCount = 1 } = await req.json();
    if (!clientName || !city || !visitDuration) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const cityTier = getCityTier(city);
    const applicationId = generateApplicationId();

    // Fetch user phone from profile
    const { data: profile } = await supabase
      .from("users")
      .select("phone")
      .eq("id", user.id)
      .single();

    const { error } = await supabase.from("applications").insert({
      user_id: user.id,
      user_phone: profile?.phone ?? "",
      application_id: applicationId,
      client_name: clientName,
      visit_duration: visitDuration,
      city,
      city_tier: cityTier,
      participant_count: participantCount,
      participant_details: [],
      status: "draft",
      source: "web",
    });

    if (error) {
      console.error("[API] Error creating application:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ applicationId, cityTier });
  } catch (err) {
    console.error("[API] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
