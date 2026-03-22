import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkRoles() {
  const { data, error } = await supabase.from("users").select("role");
  if (error) console.error(error);
  else {
    const roles = Array.from(new Set(data.map(u => u.role)));
    console.log("Unique roles in users table:", roles);
  }
}

checkRoles();
