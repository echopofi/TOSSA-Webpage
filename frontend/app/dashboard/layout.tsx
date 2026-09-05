import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import SignOutButton from "@/components/layout/SignOutButton";
import AuthGuard from "@/components/auth/AuthGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen flex flex-col">
        {/* Mobile top bar */}
        <div className="md:hidden">
          <Navbar variant="auth" />
        </div>

        <div className="flex flex-1">
          <Sidebar />
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Sign out — top right corner of the screen */}
            <div className="px-4 sm:px-6 pt-3 md:pt-4 flex justify-end">
              <SignOutButton />
            </div>
            <main className="flex-1 min-w-0 px-4 sm:px-6 pb-6 md:pb-8 max-w-5xl">
              {children}
            </main>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}