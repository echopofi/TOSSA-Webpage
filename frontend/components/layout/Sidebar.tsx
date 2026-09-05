"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  User,
  Megaphone,
  Vote,
  Shield,
  Settings,
} from "lucide-react";
import clsx from "clsx";

const navItems = [
  { href: "/dashboard",    icon: LayoutDashboard, label: "Dashboard"   },
  { href: "/sets",         icon: Users,           label: "My Set"      },
  { href: "/payments",     icon: CreditCard,      label: "Dues & Payments" },
  { href: "/elections",    icon: Vote,            label: "Elections"   },
  { href: "/exco",         icon: Shield,          label: "Our Exco"    },
  { href: "/profile",      icon: User,            label: "My Profile"  },
  { href: "/admin",        icon: Megaphone,       label: "Admin Panel", admin: true },
  { href: "/admin/settings", icon: Settings,      label: "Admin Settings", admin: true },
];

interface SidebarProps {
  isAdmin?: boolean;
}

export default function Sidebar({ isAdmin }: SidebarProps) {
  const pathname = usePathname();
  const isAdminUser = isAdmin === true || getCurrentUser()?.role === "admin";

  return (
    <aside className="w-60 shrink-0 hidden md:flex flex-col bg-[var(--surface-card)] border-r border-[var(--border-subtle)] min-h-screen">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-[var(--border-subtle)]">
        <Link
          href="/"
          className="flex items-center gap-2 font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]"
        >
          <Image
            src="/assets/logo.jpeg"
            alt="TSSOSA logo"
            width={32}
            height={32}
            className="rounded-lg object-cover"
          />
          TSSOSA
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {navItems
          .filter((item) => !item.admin || isAdminUser)
          .map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-[var(--primary-light)] text-[var(--primary)] font-semibold"
                    : "text-[var(--text-body)] hover:bg-[var(--bg-base)] hover:text-[var(--primary)]"
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
      </nav>
    </aside>
  );
}
