"use client";

import EmployeeSidebar from "@/components/employee/Sidebar";
import { LoadingScreen } from "@/components/LoadingScreen";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function checkProfile() {
      try {
        const res = await fetch("/api/user/profile");
        const profile = await res.json();
        if (res.ok && (!profile.phone || !profile.organization || !profile.team) && pathname !== "/onboarding") {
          router.push("/onboarding");
        }
      } catch (err) {
        console.error("Error checking profile:", err);
      } finally {
        setIsLoading(false);
      }
    }
    checkProfile();
  }, [pathname, router]);

  if (isLoading) {
    return <LoadingScreen onComplete={() => {}} />;
  }

  return (
    <EmployeeSidebar>
      {children}
    </EmployeeSidebar>
  );
}
