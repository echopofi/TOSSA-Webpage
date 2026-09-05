"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { clearCurrentUser } from "@/lib/session";

export default function SignOutButton() {
  const router = useRouter();

  function handleSignOut() {
    clearCurrentUser();
    router.push("/login");
  }

  return (
    <button
      onClick={handleSignOut}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors"
    >
      <LogOut size={16} />
      Sign Out
    </button>
  );
}