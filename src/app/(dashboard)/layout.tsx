"use client";

import Sidebar from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar"; // if they still have it, we keep it if they want? Wait, the new SidebarDemo includes its own Header and Content Area!
import { LoadingScreen } from "@/components/LoadingScreen";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function checkProfile() {
      try {
        const res = await fetch("/api/user/profile");
        const profile = await res.json();
        
        if (res.ok && !profile.phone && pathname !== "/settings") {
          // If phone is missing and they aren't on settings, send them there
          router.push("/settings?force=true");
        }
      } catch (err) {
        console.error("Error checking profile:", err);
      } finally {
        setCheckingProfile(false);
        setIsLoading(false);
      }
    }

    checkProfile();
  }, [pathname, router]);

  if (checkingProfile && isLoading) {
    return <LoadingScreen onComplete={() => {}} />;
  }

  return (
    <>
      <Sidebar>
          {children}
      </Sidebar>
    </>
  );
}
