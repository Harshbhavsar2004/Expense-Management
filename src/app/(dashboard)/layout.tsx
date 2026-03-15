"use client";

import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeTab = pathname === "/" ? "dashboard" : pathname.replace("/", "");

  return (
    <main className="flex h-screen bg-primary overflow-hidden">
      <Sidebar active={activeTab} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar 
          orgName="Fristine Infotech" 
          title={activeTab === "dashboard" ? "Overview" : "Claims Management"} 
        />
        
        <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          {children}
        </div>
      </div>
    </main>
  );
}
