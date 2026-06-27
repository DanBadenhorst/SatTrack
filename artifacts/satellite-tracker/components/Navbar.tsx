"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Satellite, LayoutDashboard, Radio, Users, Bell, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import type { User } from "@supabase/supabase-js";

interface NavbarProps {
  user: User | null;
}

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { href: "/groups", label: "Groups", icon: <Users className="w-4 h-4" /> },
  { href: "/satellites", label: "Satellites", icon: <Satellite className="w-4 h-4" /> },
  { href: "/passes", label: "Passes", icon: <Radio className="w-4 h-4" /> },
];

export default function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="border-b border-slate-800 bg-[rgb(8,8,24)]/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2 font-bold text-white">
            <div className="w-7 h-7 rounded-lg bg-space-600 flex items-center justify-center">
              <Satellite className="w-4 h-4" />
            </div>
            <span className="hidden sm:block">SatTrack</span>
          </Link>

          {/* Desktop nav */}
          {user && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    pathname.startsWith(link.href)
                      ? "bg-space-900 text-space-300 border border-space-700"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  {link.icon}
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden sm:block text-xs text-slate-500 truncate max-w-[160px]">
                  {user.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:block">Sign out</span>
                </button>
                {/* Mobile menu toggle */}
                <button
                  className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  onClick={() => setMenuOpen(!menuOpen)}
                >
                  {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </>
            ) : (
              <Link
                href="/auth/login"
                className="px-4 py-1.5 rounded-lg bg-space-600 hover:bg-space-700 text-white text-sm font-medium transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {user && menuOpen && (
          <div className="md:hidden py-2 border-t border-slate-800">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith(link.href)
                    ? "bg-space-900 text-space-300"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
