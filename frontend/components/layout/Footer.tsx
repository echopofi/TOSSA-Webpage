import Link from "next/link";
import { GraduationCap } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[var(--text-heading)] text-white mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <div className="flex items-center gap-2 font-[family-name:var(--font-heading)] font-semibold text-lg mb-3">
            <span className="w-7 h-7 rounded-md bg-[var(--primary)] flex items-center justify-center">
              <GraduationCap size={16} />
            </span>
            AlumniConnect
          </div>
          <p className="text-sm text-white/60 leading-relaxed">
            Keeping the alumni family connected, one set at a time.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white/80 mb-3">Navigate</h4>
          <ul className="space-y-2 text-sm text-white/55">
            <li><Link href="/" className="hover:text-white transition-colors">Home</Link></li>
            <li><Link href="/sets" className="hover:text-white transition-colors">Our Sets</Link></li>
            <li><Link href="/register" className="hover:text-white transition-colors">Register</Link></li>
            <li><Link href="/login" className="hover:text-white transition-colors">Sign In</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white/80 mb-3">Members</h4>
          <ul className="space-y-2 text-sm text-white/55">
            <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
            <li><Link href="/payments" className="hover:text-white transition-colors">Pay Dues</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-4 text-center text-xs text-white/35">
        © {new Date().getFullYear()} AlumniConnect. All rights reserved.
      </div>
    </footer>
  );
}
