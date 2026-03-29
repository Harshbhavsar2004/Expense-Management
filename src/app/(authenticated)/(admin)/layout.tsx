import AdminAIBot from "@/components/AdminAIBot";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AdminAIBot />
    </>
  );
}
