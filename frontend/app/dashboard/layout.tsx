import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Mobile top bar */}
      <div className="md:hidden">
        <Navbar variant="auth" userName="Ada O." />
      </div>

      <div className="flex flex-1">
        <Sidebar isAdmin={false} />
        <main className="flex-1 min-w-0 px-4 sm:px-6 py-6 md:py-8 max-w-5xl">
          {children}
        </main>
      </div>
    </div>
  );
}
