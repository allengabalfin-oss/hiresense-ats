"use client";

import React, { useState, useEffect } from "react";
import { rtdb, auth } from "../../lib/firebase";
import { ref, push, onValue, get } from "firebase/database";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";

interface Job {
  id: string;
  title: string;
  department: string;
  location?: string;
  salary?: string;
  requiredSkills: string[];
}

interface Application {
  id: string;
  jobId: string;
  applicantName: string;
  applicantEmail: string;
  matchScore?: number;
  extractedSkills?: string[];
  status?: string;
  submittedAt?: number;
  interviewDetails?: {
    scheduledDate?: string;
    meetingLink?: string;
    instructions?: string;
    dispatchedAt?: number;
  };
}

type TabType = "Apply" | "My Status" | "Open Roles";

const Icons = {
  Apply: () => (
    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Status: () => (
    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  Roles: () => (
    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
};

export default function ApplicantPortal() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("Apply");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<{
    matchScore: number;
    extractedSkills: string[];
  } | null>(null);

  // Track authenticated user session, role, & enforce role redirect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);

        if (user.email) {
          setApplicantEmail(user.email);
        }

        const snap = await get(ref(rtdb, `users/${user.uid}`));
        const data = snap.val();

        // Keep admin1@hiresense.com permanently recognized as admin even if DB node is missing/modified
        const isSuperAdmin = user.email?.toLowerCase() === "admin1@hiresense.com";
        const role = isSuperAdmin ? "admin" : data?.role || "applicant";
        setCurrentUserRole(role);

        if (data?.fullName) {
          setApplicantName((prev) => prev || data.fullName);
        } else if (user.displayName) {
          setApplicantName((prev) => prev || user.displayName || "");
        }

        if (role === "hiring_manager") {
          router.push("/manager");
        } else if (role === "recruiter") {
          router.push("/hris");
        }
      } else {
        setCurrentUser(null);
        setCurrentUserRole(null);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Sync open job listings
  useEffect(() => {
    const jobsRef = ref(rtdb, "jobs");
    const unsubscribe = onValue(jobsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list: Job[] = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setJobs(list);
        if (list.length > 0 && !selectedJobId) {
          setSelectedJobId(list[0].id);
        }
      } else {
        setJobs([]);
      }
    });
    return () => unsubscribe();
  }, [selectedJobId]);

  // Sync all applications for "My Status" tracking
  useEffect(() => {
    const appsRef = ref(rtdb, "applications");
    const unsubscribe = onValue(appsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list: Application[] = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setApplications(list);
      } else {
        setApplications([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage("");
    const file = e.target.files?.[0];

    if (!file) {
      setResumeFile(null);
      return;
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMessage("Invalid file format. Please upload a PDF resume.");
      e.target.value = "";
      setResumeFile(null);
      return;
    }

    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setErrorMessage(`Resume exceeds the ${MAX_SIZE_MB}MB size limit.`);
      e.target.value = "";
      setResumeFile(null);
      return;
    }

    setResumeFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setResult(null);

    const trimmedName = applicantName.trim();
    const trimmedEmail = (currentUser?.email || applicantEmail).trim().toLowerCase();

    if (!selectedJobId || !trimmedName || !trimmedEmail || !resumeFile) {
      setErrorMessage("Please complete all fields and attach a valid PDF resume.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const appsSnapshot = await get(ref(rtdb, "applications"));
      const appsData = appsSnapshot.val();

      if (appsData) {
        const hasAppliedToThisJob = Object.values(appsData).some(
          (app: any) =>
            app.jobId === selectedJobId &&
            app.applicantEmail?.toLowerCase() === trimmedEmail
        );

        if (hasAppliedToThisJob) {
          throw new Error("You have already submitted an active application for this specific position.");
        }
      }

      const newAppRef = await push(ref(rtdb, "applications"), {
        jobId: selectedJobId,
        applicantName: trimmedName,
        applicantEmail: trimmedEmail,
        status: "Submitted",
        submittedAt: Date.now(),
      });

      const appId = newAppRef.key;

      const formData = new FormData();
      formData.append("application_id", appId!);
      formData.append("job_id", selectedJobId);
      formData.append("resume", resumeFile);

      const res = await fetch("https://hiresense-ats.onrender.com/evaluate", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Resume parsing service failed. Ensure the backend server is running on port 8000.");
      }

      const evalData = await res.json();
      setResult({
        matchScore: evalData.matchScore,
        extractedSkills: evalData.extractedSkills,
      });

      setResumeFile(null);
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred while submitting your application.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const effectiveEmail = (currentUser?.email || applicantEmail || "").trim().toLowerCase();
  const myApplications = applications.filter(
    (app) => effectiveEmail && app.applicantEmail?.toLowerCase() === effectiveEmail
  );

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0a1128] text-slate-300 flex flex-col justify-between shrink-0 shadow-xl">
        <div>
          <div className="px-6 py-6 border-b border-slate-800">
            <h1 className="text-xl font-bold tracking-wider text-white">HireSense</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Applicant Portal</p>
          </div>

          <nav className="mt-4 px-3 space-y-1">
            {[
              { label: "Apply", icon: Icons.Apply },
              { label: "My Status", icon: Icons.Status },
              { label: "Open Roles", icon: Icons.Roles },
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
            <span
              className={`inline-block text-white font-mono px-1.5 py-0.5 rounded text-[10px] mb-1 uppercase ${
                currentUserRole === "admin" ? "bg-emerald-600" : "bg-sky-600"
              }`}
            >
              {currentUserRole || "APPLICANT"}
            </span>
            <p className="text-slate-400 truncate max-w-[120px]">
              {currentUser?.email || "candidate@hiresense.com"}
            </p>
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
            <p className="text-xs text-slate-500">
              Submit applications and monitor your real-time candidacy pipeline.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {currentUserRole === "admin" && (
              <div className="flex items-center gap-1.5 border-r border-slate-200 pr-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                  Switch:
                </span>
                <button
                  onClick={() => router.push("/admin")}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition"
                >
                  Admin
                </button>
                <button
                  onClick={() => router.push("/hris")}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition"
                >
                  Recruiter
                </button>
                <button
                  onClick={() => router.push("/manager")}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition"
                >
                  Manager
                </button>
                <button
                  onClick={() => router.push("/applicant")}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-600 text-white shadow-sm"
                >
                  Applicant
                </button>
              </div>
            )}

            <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-medium border border-indigo-200">
              {jobs.length} Active Positions Open
            </span>
          </div>
        </header>

        <div className="p-8">
          {/* TAB 1: APPLY */}
          {activeTab === "Apply" && (
            <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-2xl font-black text-indigo-950 mb-1">
                Candidate Application
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Submit your profile and PDF resume to receive real-time skill matching evaluation.
              </p>

              {errorMessage && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Allen Gabalfin"
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-indigo-500"
                    required
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold uppercase text-slate-500">
                      Email Address
                    </label>
                    {currentUser && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        🔒 Verified to account session
                      </span>
                    )}
                  </div>
                  <input
                    type="email"
                    value={currentUser?.email || applicantEmail}
                    readOnly={!!currentUser}
                    onChange={(e) => setApplicantEmail(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      currentUser
                        ? "bg-slate-100 text-slate-500 cursor-not-allowed select-none"
                        : "focus:outline-indigo-500"
                    }`}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Select Position Applied For
                  </label>
                  <select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-slate-50 font-medium focus:outline-indigo-500"
                    disabled={jobs.length === 0}
                  >
                    {jobs.length === 0 ? (
                      <option value="">No open requisitions available</option>
                    ) : (
                      jobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.title} ({job.department || "General"})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Upload Resume (PDF Only, Max 5MB)
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || jobs.length === 0}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition disabled:opacity-50"
                >
                  {loading ? "Parsing & Scoring Resume..." : "Submit Application"}
                </button>
              </form>

              {result && (
                <div className="mt-6 p-4 border border-emerald-200 bg-emerald-50/50 rounded-xl">
                  <h4 className="font-bold text-sm text-emerald-950 mb-1">
                    Application Submitted & Evaluated!
                  </h4>
                  <p className="text-xs text-slate-600 mb-2">
                    ATS Match Score: <b className="text-emerald-700 text-base">{result.matchScore}%</b>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {result.extractedSkills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="bg-emerald-100 text-emerald-800 text-[11px] font-mono px-2 py-0.5 rounded"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MY STATUS */}
          {activeTab === "My Status" && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-base text-slate-900">Your Submitted Applications</h3>
                  <p className="text-xs text-slate-500">Live tracking of your application progress.</p>
                </div>
                <span className="text-xs text-slate-400">Account: {effectiveEmail || "Guest"}</span>
              </div>

              {myApplications.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <p className="mb-2 text-base">📭</p>
                  No applications found for your email address. Submit an application in the Apply tab to view status.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {myApplications.map((app) => {
                    const job = jobs.find((j) => j.id === app.jobId);
                    return (
                      <div key={app.id} className="py-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-bold text-sm text-slate-800">{job?.title || "Requisition"}</p>
                            <p className="text-xs text-slate-400">
                              {job?.department || "General"} • Submitted{" "}
                              {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : "Recently"}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-xs font-bold px-2.5 py-1 rounded ${
                                (app.matchScore || 0) >= 70
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-indigo-50 text-indigo-700"
                              }`}
                            >
                              {app.matchScore || 0}% Match
                            </span>
                            <span
                              className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                                app.status === "Hired"
                                  ? "bg-emerald-600 text-white border-emerald-600"
                                  : app.status === "Rejected"
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : app.status === "Interview Scheduled"
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}
                            >
                              {app.status || "Submitted"}
                            </span>
                          </div>
                        </div>

                        {/* STAGE BANNER: HIRED */}
                        {app.status === "Hired" && (
                          <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border-2 border-emerald-400 rounded-xl space-y-1.5 text-xs animate-in fade-in duration-300">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-emerald-950 text-sm flex items-center gap-1.5">
                                🎉 Application Successful — Position Offered & Confirmed!
                              </span>
                              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                                Status: Hired
                              </span>
                            </div>
                            <p className="text-slate-700 font-medium">
                              Congratulations! Following your technical evaluation and manager assessment, you have been selected for the role of{" "}
                              <b className="text-emerald-900">{job?.title || "Team Member"}</b> in the{" "}
                              <b>{job?.department || "Engineering"}</b> department.
                            </p>
                            <p className="text-slate-500 text-[11px]">
                              Our Human Resources team will contact you directly at{" "}
                              <span className="font-mono text-emerald-700 font-semibold">{app.applicantEmail}</span> regarding onboarding details, start dates, and formal employment paperwork. Welcome to the team!
                            </p>
                          </div>
                        )}

                        {/* STAGE BANNER: CONFIRMED INTERVIEW */}
                        {app.status === "Interview Scheduled" && app.interviewDetails && (
                          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                                📅 Confirmed Interview Schedule
                              </span>
                              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                                {app.interviewDetails.scheduledDate
                                  ? new Date(app.interviewDetails.scheduledDate).toLocaleString()
                                  : "Time TBD"}
                              </span>
                            </div>

                            {app.interviewDetails.instructions && (
                              <p className="text-slate-600">
                                <b className="text-slate-700">Instructions:</b> {app.interviewDetails.instructions}
                              </p>
                            )}

                            {app.interviewDetails.meetingLink && (
                              <div className="pt-1">
                                <a
                                  href={app.interviewDetails.meetingLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition"
                                >
                                  Join Video Meeting ↗
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        {/* STAGE BANNER: REJECTED */}
                        {app.status === "Rejected" && (
                          <div className="p-3 bg-rose-50/60 border border-rose-200 rounded-xl space-y-1 text-xs">
                            <span className="font-semibold text-rose-900 block">
                              Application Update
                            </span>
                            <p className="text-slate-600 text-[11px]">
                              Thank you for taking the time to meet with our hiring team. While we were impressed with your qualifications, we have chosen to move forward with another candidate whose background more closely aligns with our current team requirements. We wish you the best in your career search.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: OPEN ROLES */}
          {activeTab === "Open Roles" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Open Career Opportunities</h3>
                <p className="text-xs text-slate-500">Explore technical roles currently hiring on HireSense.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {jobs.map((job) => (
                  <div key={job.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-indigo-950">{job.title}</h4>
                        <p className="text-xs text-slate-400">
                          {job.department} • {job.location || "Remote"}
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {job.salary || "Competitive"}
                      </span>
                    </div>

                    <div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase mb-1">Target Skills</p>
                      <div className="flex flex-wrap gap-1">
                        {job.requiredSkills?.map((skill, idx) => (
                          <span
                            key={idx}
                            className="bg-slate-100 text-slate-700 text-[10px] font-mono px-2 py-0.5 rounded"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedJobId(job.id);
                        setActiveTab("Apply");
                      }}
                      className="w-full mt-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition"
                    >
                      Apply for this Position →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}