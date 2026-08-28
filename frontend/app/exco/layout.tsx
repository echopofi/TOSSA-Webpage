import Navbar from "@/components/layout/Navbar";

export default function ExcoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar variant="public" />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}