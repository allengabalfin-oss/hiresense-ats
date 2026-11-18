"use client";

import React, { useState, useEffect } from "react";
import { rtdb, auth } from "../../lib/firebase";
import { ref, onValue, get, update, remove, set } from "firebase/database";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";

interface AppUser {
  uid: string;
  email: string;
  role: string;
  department?: string;
  createdAt?: number;
}

const ROLES = ["applicant", "recruiter", "hiring_manager", "admin"];

type TabType = "Users" | "Metrics & Stats" | "Maintenance";

const Icons = {
  Users: () => (
    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Chart: () => (
    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  Shield: () => (
    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
};

export default function AdminDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<TabType>("Users");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [stats, setStats] = useState({
    jobsCount: 0,
    appsCount: 0,
    usersCount: 0,
  });

  // Role Gate: Superuser check with self-healing admin record
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      const isSuperAdmin = user.email?.toLowerCase() === "admin1@hiresense.com";
      const userRef = ref(rtdb, `users/${user.uid}`);
      const snap = await get(userRef);
      const data = snap.val();

      if (isSuperAdmin && (!data || data.role !== "admin")) {
        await set(userRef, {
          email: user.email,
          role: "admin",
          createdAt: data?.createdAt || Date.now(),
        });
      } else if (!isSuperAdmin && (!data || data.role !== "admin")) {
        router.push("/login");
        return;
      }

      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribeAuth();
  }, [router]);

  // Load registered users and system metrics
  useEffect(() => {
    if (!currentUser) return;

    const usersRef = ref(rtdb, "users");
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedUsers: AppUser[] = Object.keys(data).map((key) => ({
          uid: key,
          ...data[key],
        }));
        setUsers(loadedUsers);
        setStats((prev) => ({ ...prev, usersCount: loadedUsers.length }));
      } else {
        setUsers([]);
        setStats((prev) => ({ ...prev, usersCount: 0 }));
      }
    });

    const jobsRef = ref(rtdb, "jobs");
    const unsubscribeJobs = onValue(jobsRef, (snapshot) => {
      const data = snapshot.val();
      setStats((prev) => ({
        ...prev,
        jobsCount: data ? Object.keys(data).length : 0,
      }));
    });

    const appsRef = ref(rtdb, "applications");
    const unsubscribeApps = onValue(appsRef, (snapshot) => {
      const data = snapshot.val();
      setStats((prev) => ({
        ...prev,
        appsCount: data ? Object.keys(data).length : 0,
      }));
    });

    return () => {
      unsubscribeUsers();
      unsubscribeJobs();
      unsubscribeApps();
    };
  }, [currentUser]);

  const handleRoleChange = async (uid: string, newRole: string) => {
    await update(ref(rtdb, `users/${uid}`), { role: newRole });
  };

  const handleDepartmentChange = async (uid: string, newDept: string) => {
    await update(ref(rtdb, `users/${uid}`), { department: newDept });
  };

  const handleSystemReset = async () => {
    if (
      confirm(
        "DANGER: This will delete ALL job requisitions and candidate applications for a clean system reset. Continue?"
      )
    ) {
      await remove(ref(rtdb, "jobs"));
      await remove(ref(rtdb, "applications"));
      alert("System data successfully cleared.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-medium">
        Verifying administrator authorization...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0a1128] text-slate-300 flex flex-col justify-between shrink-0 shadow-xl">
        <div>
          <div className="px-6 py-6 border-b border-slate-800">
            <h1 className="text-xl font-bold tracking-wider text-white">HRIS Admin</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Control Center</p>
          </div>

          <nav className="mt-4 px-3 space-y-1">
            {[
              { label: "Users", icon: Icons.Users },
              { label: "Metrics & Stats", icon: Icons.Chart },
              { label: "Maintenance", icon: Icons.Shield },
            ].map((tab) => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.label;
              return (
                <button
                  key={tab.label}
                  onClick={() => setActiveTab(tab.label as TabType)}
                  className={`w-full flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? "bg-indigo-600/30 text-white border-l-4 border-indigo-500 pl-3"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <IconComp />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs">
            <span className="inline-block bg-purple-600 text-white font-mono px-1.5 py-0.5 rounded text-[10px] mb-1">
              SYSADMIN
            </span>
            <p className="text-slate-400 truncate max-w-[120px]">{currentUser?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-rose-400 hover:text-rose-300 font-medium px-2 py-1 rounded hover:bg-rose-950/40"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{activeTab}</h2>
            <p className="text-xs text-slate-500">System Operations & Role-Based Access Control</p>
          </div>

          {/* QUICK-SWITCH PORTAL BAR */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Switch View:
            </span>
            <button
              onClick={() => router.push("/admin")}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-600 text-white shadow-sm"
            >
              Admin
            </button>
            <button
              onClick={() => router.push("/hris")}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition"
            >
              Recruiter (HRIS)
            </button>
            <button
              onClick={() => router.push("/manager")}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition"
            >
              Manager
            </button>
            <button
              onClick={() => router.push("/applicant")}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition"
            >
              Applicant
            </button>
            <span className="ml-2 text-xs bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full font-medium border border-purple-200">
              Superuser Active
            </span>
          </div>
        </header>

        <div className="p-8 space-y-6">
          {/* TAB 1: USERS */}
          {activeTab === "Users" && (
            <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Account Directory & Access Control ({users.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Manage user privileges and department scopes across the platform.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4">User Account</th>
                      <th className="py-3 px-4">Assigned Role</th>
                      <th className="py-3 px-4">Department Scope</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {users.map((u) => (
                      <tr key={u.uid} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          <div>{u.email}</div>
                          <div className="text-[10px] text-slate-400 font-mono">UID: {u.uid}</div>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-white focus:outline-indigo-500"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          {u.role === "hiring_manager" ? (
                            <input
                              type="text"
                              defaultValue={u.department || ""}
                              onBlur={(e) => handleDepartmentChange(u.uid, e.target.value)}
                              placeholder="e.g. Engineering"
                              className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 focus:outline-indigo-500 bg-slate-50"
                            />
                          ) : (
                            <span className="text-slate-400">Global / Not Applicable</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TAB 2: METRICS & STATS */}
          {activeTab === "Metrics & Stats" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-xs font-semibold text-slate-400 uppercase">
                    Total Requisitions
                  </span>
                  <p className="text-3xl font-black text-slate-900 mt-2">{stats.jobsCount}</p>
                  <p className="text-xs text-slate-500 mt-1">Active job openings in database</p>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-xs font-semibold text-slate-400 uppercase">
                    Applications Evaluated
                  </span>
                  <p className="text-3xl font-black text-indigo-600 mt-2">{stats.appsCount}</p>
                  <p className="text-xs text-slate-500 mt-1">Processed through AI engine</p>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-xs font-semibold text-slate-400 uppercase">
                    Registered Accounts
                  </span>
                  <p className="text-3xl font-black text-emerald-600 mt-2">{stats.usersCount}</p>
                  <p className="text-xs text-slate-500 mt-1">Users in Firebase Authentication</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-base text-slate-900 mb-2">Microservice Health</h3>
                <p className="text-xs text-slate-500 mb-4">Core services powering HireSense.</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-xs">
                    <span className="font-semibold text-slate-700">Next.js Web Engine</span>
                    <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
                      Port 3000 • Online
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-xs">
                    <span className="font-semibold text-slate-700">FastAPI Parsing & TF-IDF Engine</span>
                    <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
                      Port 8000 • Online
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-xs">
                    <span className="font-semibold text-slate-700">Firebase Realtime Database</span>
                    <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
                      Connected
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MAINTENANCE */}
          {activeTab === "Maintenance" && (
            <div className="space-y-6">
              <section className="bg-white p-6 rounded-xl border border-rose-200 shadow-sm">
                <h3 className="text-base font-bold text-rose-900 mb-1">Data Reset Operations</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Permanently purge all job requisitions and candidate applications for testing cycles.
                </p>
                <button
                  onClick={handleSystemReset}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition"
                >
                  Reset All System Records
                </button>
              </section>

              <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-2">Audit & Safety Guidelines</h3>
                <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
                  <li>Changes to user roles take effect immediately upon their next route access.</li>
                  <li>
                    Assigning the <span className="font-mono text-slate-700">hiring_manager</span> role
                    requires defining a department scope to restrict their candidate view.
                  </li>
                  <li>
                    The reset action only clears <span className="font-mono text-slate-700">jobs</span> and{" "}
                    <span className="font-mono text-slate-700">applications</span>; registered user
                    credentials are preserved.
                  </li>
                </ul>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}