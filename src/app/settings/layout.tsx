"use client";

import { useEffect, useState } from "react";
import EmployeeSidebar from "@/components/employee/Sidebar";
import AdminSidebar from "@/components/admin/Sidebar";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<"admin" | "employee" | null>(null);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((d) => setRole(d?.role === "admin" ? "admin" : "employee"))
      .catch(() => setRole("employee"));
  }, []);

  if (role === null) return null;

  if (role === "admin") {
    return <AdminSidebar>{children}</AdminSidebar>;
  }

  return <EmployeeSidebar>{children}</EmployeeSidebar>;
}
