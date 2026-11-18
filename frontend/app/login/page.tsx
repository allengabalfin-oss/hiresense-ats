"use client";

import React, { useState } from "react";
import { auth, rtdb } from "../../lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { ref, get, set } from "firebase/database";
import { useRouter } from "next/navigation";

const ORG_INVITE_CODE = "HIRESENSE_STAFF";

export default function LoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("applicant");
  const [department, setDepartment] = useState("Engineering");
  const [inviteCode, setInviteCode] = useState("");
  const [showStaffOptions, setShowStaffOptions] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const routeByRole = (userRole: string) => {
    switch (userRole) {
      case "admin":
        router.push("/admin");
        break;
      case "recruiter":
        router.push("/hris");
        break;
      case "hiring_manager":
        router.push("/manager");
        break;
      case "applicant":
      default:
        router.push("/applicant");
        break;
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (isRegistering) {
        const finalRole = showStaffOptions ? role : "applicant";
        if (finalRole !== "applicant" && inviteCode !== ORG_INVITE_CODE) {
          setError("Invalid Organization Authorization Code. Elevated registration denied.");
          return;
        }

        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await set(ref(rtdb, `users/${cred.user.uid}`), {
          email: email.trim().toLowerCase(),
          role: finalRole,
          department: finalRole === "hiring_manager" ? department.trim() : "",
          createdAt: Date.now(),
        });
        routeByRole(finalRole);
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        const snapshot = await get(ref(rtdb, `users/${cred.user.uid}`));
        const userData = snapshot.val();
        routeByRole(userData?.role || "applicant");
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-800 font-sans">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-2xl font-black text-indigo-950 mb-1">
          HireSense Unified Access
        </h1>
        <p className="text-xs text-slate-500 mb-6">
          {isRegistering
            ? "Create an applicant account or register internal staff credentials."
            : "Sign in with your role-assigned credentials."}
        </p>

        {error && (
          <div className="mb-4 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-indigo-500"
              placeholder="user@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-indigo-500"
              placeholder="••••••••"
              required
            />
          </div>

          {isRegistering && (
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-600 font-medium">
                  Internal Staff Registration?
                </span>
                <button
                  type="button"
                  onClick={() => setShowStaffOptions(!showStaffOptions)}
                  className="text-xs text-indigo-600 font-semibold hover:underline"
                >
                  {showStaffOptions ? "Default Applicant" : "Enter Staff Code"}
                </button>
              </div>

              {showStaffOptions ? (
                <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Organization Authorization Passcode
                    </label>
                    <input
                      type="password"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="e.g. HIRESENSE_STAFF"
                      className="w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-indigo-500 bg-white"
                      required={showStaffOptions}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Staff Role Selection
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white font-medium focus:outline-indigo-500"
                    >
                      <option value="recruiter">HR / Talent Recruiter</option>
                      <option value="hiring_manager">Hiring Manager / Team Lead</option>
                      <option value="admin">System Administrator</option>
                    </select>
                  </div>

                  {role === "hiring_manager" && (
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                        Assigned Department
                      </label>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-indigo-500 bg-white"
                        placeholder="e.g. Engineering"
                        required
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">
                  Standard registration creates a verified candidate account.
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition"
          >
            {isRegistering ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500">
          {isRegistering ? "Already have an account?" : "Need an account?"}{" "}
          <button
            onClick={() => {
              setIsRegistering(!isRegistering);
              setShowStaffOptions(false);
              setError("");
            }}
            className="text-indigo-600 font-semibold hover:underline"
          >
            {isRegistering ? "Sign In" : "Register"}
          </button>
        </div>
      </div>
    </div>
  );
}