"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { auth, rtdb } from "../lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { ref, get } from "firebase/database";
import { useRouter, usePathname } from "next/navigation";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const snap = await get(ref(rtdb, `users/${user.uid}`));
        const data = snap.val();
        setUserRole(data?.role || "applicant");
      } else {
        setUserRole(null);
      }
    });

    return () => unsubscribe();
  }, [pathname]);

  const handleLogout = async () => {
    await signOut(auth);
    setUserRole(null);
    router.push("/login");
  };

  // Hide the global Navbar on the login screen and all portal dashboard routes
  const isDashboardRoute =
    pathname === "/login" ||
    pathname.startsWith("/hris") ||
    pathname.startsWith("/manager") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/applicant");

  if (isDashboardRoute) {
    return null;
  }

  return (
    <nav className="w-full bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center text-sm shadow-sm sticky top-0 z-40">
      <div className="flex items-center gap-6">
        <Link
          href="/"
          className="font-black text-indigo-900 text-lg tracking-tight hover:opacity-90 transition"
        >
          HireSense
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {currentUser ? (
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 uppercase font-semibold">
              {userRole || "User"}
            </span>
            <span className="text-xs text-slate-500 hidden sm:inline">
              {currentUser.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-xs border border-slate-300 hover:bg-slate-100 px-2.5 py-1 rounded text-slate-700 transition"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
          >
            Sign In / Register
          </Link>
        )}
      </div>
    </nav>
  );
}