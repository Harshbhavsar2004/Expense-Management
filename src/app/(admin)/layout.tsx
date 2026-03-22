import AdminSidebar from "@/components/admin/Sidebar";
import AdminAIBot from "@/components/AdminAIBot";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminSidebar>
      {children}
      <AdminAIBot />
    </AdminSidebar>
  );
}
