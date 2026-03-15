"use client";

import { useEffect, useState } from "react";
import { WhatsAppChat } from "@/components/WhatsAppChat";
import { createClient } from "@/utils/supabase/client";

export default function ChatPage() {
  const [phone, setPhone] = useState<string>("");
  const [userName, setUserName] = useState<string>("User");
  const supabase = createClient();

  useEffect(() => {
    async function getUserData() {
      try {
        const res = await fetch("/api/user/profile");
        const data = await res.json();
        if (res.ok) {
          const userPhone = data.phone || "";
          setPhone(userPhone.replace(/\D/g, ""));
          setUserName(data.full_name || "User");
        }
      } catch (err) {
        console.error("Error fetching profile in chat page:", err);
      }
    }
    getUserData();
  }, []);

  return (
    <div className="flex h-full overflow-hidden antialiased bg-(--bg-secondary)">
      <main className="flex-1 flex flex-col min-w-0">
        <WhatsAppChat userName={userName} phone={phone} />
      </main>
    </div>
  );
}