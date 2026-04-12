"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AdminSidebar from "@/components/admin/Sidebar";
import EmployeeSidebar from "@/components/employee/Sidebar";
import { LoadingScreen } from "@/components/LoadingScreen";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [role, setRole] = useState<"admin" | "employee" | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [animationDone, setAnimationDone] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function checkProfile() {
      try {
        const res = await fetch("/api/user/profile");
        const profile = await res.json();
        if (res.ok) {
          setRole(profile.role === "admin" ? "admin" : "employee");
          if (
            (!profile.phone || !profile.organization || !profile.team) &&
            pathname !== "/onboarding"
          ) {
            router.push("/onboarding");
          }
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setDataLoaded(true);
      }
    }
    checkProfile();
  }, [pathname, router]);

  const isReady = dataLoaded && animationDone;

  if (!isReady) {
    return <LoadingScreen onComplete={() => setAnimationDone(true)} />;
  }

  // No sidebar for onboarding
  if (pathname === "/onboarding") {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  // No sidebar/topbar for standalone dashboard view
  if (pathname.startsWith("/admin/dashboard/")) {
    return <>{children}</>;
  }

  if (role === "admin") {
    return <AdminSidebar>{children}</AdminSidebar>;
  }

  return <EmployeeSidebar>{children}</EmployeeSidebar>;
}
