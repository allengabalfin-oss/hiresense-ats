"use client";

import React, { useState, useEffect } from "react";
import { rtdb, auth } from "../../lib/firebase";
import { ref, onValue, set, remove, push, get, update } from "firebase/database";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";

const Icons = {
  Dashboard: () => (
    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  Users: () => (
    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  CheckUsers: () => (
    <svg className="w-4 h-4 mr-3 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  ),
  CrossUsers: () => (
    <svg className="w-4 h-4 mr-3 text-rose-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="17" y1="8" x2="23" y2="14" />
      <line x1="23" y1="8" x2="17" y2="14" />
    </svg>
  ),
  Briefcase: () => (
    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  Clipboard: () => (
    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <line x1="8" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="16" y2="14" />
      <line x1="8" y1="18" x2="12" y2="18" />
    </svg>
  ),
  Chart: () => (
    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
};

type NavItem =
  | "Dashboard"
  | "Employees"
  | "Approved Applications"
  | "Rejected Applications"
  | "Jobs"
  | "Logs"
  | "Graphs";

export default function HRISPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<NavItem>("Dashboard");

  // RTDB data states
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedJobFilter, setSelectedJobFilter] = useState<string>("all");
  const [reviewCandidate, setReviewCandidate] = useState<any | null>(null);

  // Interview Dispatch States
  const [interviewCandidate, setInterviewCandidate] = useState<any | null>(null);
  const [interviewDate, setInterviewDate] = useState("");
  const [meetingLink, setMeetingLink] = useState("https://meet.google.com/abc-defg-hij");
  const [interviewNotes, setInterviewNotes] = useState("");
  const [dispatchLoading, setDispatchLoading] = useState(false);

  // Job Requisition Form State
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [salary, setSalary] = useState("");
  const [competencies, setCompetencies] = useState("");

  // Role Gate: Recruiter & Admin ONLY
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      const snap = await get(ref(rtdb, `users/${user.uid}`));
      const data = snap.val();

      if (!data || (data.role !== "recruiter" && data.role !== "admin")) {
        if (data?.role === "hiring_manager") {
          router.push("/manager");
        } else {
          router.push("/applicant");
        }
        return;
      }

      setCurrentUser(user);
      setUserRole(data.role);
      setAuthLoading(false);
    });

    return () => unsubscribeAuth();
  }, [router]);

  // Sync Jobs
  useEffect(() => {
    if (authLoading) return;
    const jobsRef = ref(rtdb, "jobs");
    return onValue(jobsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setJobs(Object.keys(data).map((key) => ({ id: key, ...data[key] })));
      } else {
        setJobs([]);
      }
    });
  }, [authLoading]);

  // Sync Applications
  useEffect(() => {
    if (authLoading) return;
    const appsRef = ref(rtdb, "applications");
    return onValue(appsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setApplications(Object.keys(data).map((key) => ({ id: key, ...data[key] })));
      } else {
        setApplications([]);
      }
    });
  }, [authLoading]);

  const handlePublishJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle.trim() || !competencies.trim()) return;

    const parsedSkills = competencies
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    await push(ref(rtdb, "jobs"), {
      title: jobTitle.trim(),
      department: department.trim() || "General",
      location: location.trim() || "Remote",
      salary: salary.trim() || "Negotiable",
      requiredSkills: parsedSkills,
      createdAt: Date.now(),
    });

    setJobTitle("");
    setDepartment("");
    setLocation("");
    setSalary("");
    setCompetencies("");
    alert("Requisition successfully posted!");
  };

  const updateStage = async (appId: string, newStage: string, email: string) => {
    await update(ref(rtdb, `applications/${appId}`), { status: newStage });
    try {
      await fetch("http://127.0.0.1:8000/notify-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, status: newStage }),
      });
    } catch (e) {
      console.log("Notification service bypassed");
    }
  };

  const handleDispatchInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interviewCandidate) return;

    setDispatchLoading(true);

    try {
      await update(ref(rtdb, `applications/${interviewCandidate.id}`), {
        status: "Interview Scheduled",
        interviewDetails: {
          scheduledDate: interviewDate,
          meetingLink: meetingLink.trim(),
          instructions:
            interviewNotes.trim() ||
            "Please be ready 5 minutes before scheduled time with your video and mic enabled.",
          dispatchedAt: Date.now(),
        },
      });

      try {
        await fetch("http://127.0.0.1:8000/notify-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: interviewCandidate.applicantEmail,
            status: "Interview Scheduled",
            date: interviewDate,
            link: meetingLink,
          }),
        });
      } catch (err) {
        console.log("Notification endpoint not reachable; details recorded in database.");
      }

      alert(`Official interview invitation recorded and dispatched to ${interviewCandidate.applicantEmail}!`);
      setInterviewCandidate(null);
    } catch (err: any) {
      alert("Error dispatching interview: " + err.message);
    } finally {
      setDispatchLoading(false);
    }
  };

  const handleCancelInterview = async () => {
    if (!interviewCandidate) return;

    if (
      !confirm(
        `Cancel interview schedule for ${interviewCandidate.applicantName}? This will roll the status back to 'Evaluated' and remove the meeting link.`
      )
    ) {
      return;
    }

    setDispatchLoading(true);
    try {
      await remove(ref(rtdb, `applications/${interviewCandidate.id}/interviewDetails`));
      await update(ref(rtdb, `applications/${interviewCandidate.id}`), {
        status: "Evaluated",
      });

      try {
        await fetch("http://127.0.0.1:8000/notify-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: interviewCandidate.applicantEmail,
            status: "Interview Cancelled",
          }),
        });
      } catch (err) {
        console.log("Notification service bypassed");
      }

      alert(`Interview cancelled for ${interviewCandidate.applicantName}.`);
      setInterviewCandidate(null);
    } catch (err: any) {
      alert("Error cancelling interview: " + err.message);
    } finally {
      setDispatchLoading(false);
    }
  };

  const deleteApp = async (appId: string) => {
    if (confirm("Delete this candidate record?")) {
      await remove(ref(rtdb, `applications/${appId}`));
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-medium">
        Verifying recruiter authorization...
      </div>
    );
  }

  const filteredApps = applications.filter((app) =>
    selectedJobFilter === "all" ? true : app.jobId === selectedJobFilter
  );

  const sortedCandidates = [...filteredApps].sort(
    (a, b) => (b.matchScore || 0) - (a.matchScore || 0)
  );

  const approvedApps = applications.filter(
    (a) => a.status === "Interview Scheduled" || a.status === "Hired"
  );
  const rejectedApps = applications.filter((a) => a.status === "Rejected");

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0a1128] text-slate-300 flex flex-col justify-between shrink-0 shadow-xl">
        <div>
          <div className="px-6 py-6 border-b border-slate-800">
            <h1 className="text-xl font-bold tracking-wider text-white">HRIS</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">HireSense Recruitment System</p>
          </div>

          <nav className="mt-4 px-3 space-y-1">
            {[
              { label: "Dashboard", icon: Icons.Dashboard },
              { label: "Employees", icon: Icons.Users },
              { label: "Approved Applications", icon: Icons.CheckUsers },
              { label: "Rejected Applications", icon: Icons.CrossUsers },
              { label: "Jobs", icon: Icons.Briefcase },
              { label: "Logs", icon: Icons.Clipboard },
              { label: "Graphs", icon: Icons.Chart },
            ].map((tab) => {
              const IconComponent = tab.icon;
              const isActive = activeTab === tab.label;
              return (
                <button
                  key={tab.label}
                  onClick={() => setActiveTab(tab.label as NavItem)}
                  className={`w-full flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? "bg-indigo-600/30 text-white border-l-4 border-indigo-500 pl-3"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <IconComponent />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs">
            <span className="inline-block bg-indigo-500 text-white font-mono px-1.5 py-0.5 rounded text-[10px] mb-1 uppercase">
              {userRole}
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

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{activeTab}</h2>
            <p className="text-xs text-slate-500">Talent Acquisition & Assessment Control</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Show Quick-Switch Bar if Admin */}
            {userRole === "admin" && (
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
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-600 text-white shadow-sm"
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
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition"
                >
                  Applicant
                </button>
              </div>
            )}

            <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-semibold border border-emerald-200">
              ● AI Evaluator Live (Port 8000)
            </span>
          </div>
        </header>

        <div className="p-8 space-y-6">
          {/* TAB: DASHBOARD */}
          {activeTab === "Dashboard" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-base text-indigo-950 mb-1">Create Requisition</h3>
                <p className="text-xs text-slate-500 mb-4">Post open requisition with target skills.</p>
                <form onSubmit={handlePublishJob} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Job Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Backend Python Engineer"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border rounded-lg focus:outline-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Engineering"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border rounded-lg focus:outline-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                        Location
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Remote"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border rounded-lg focus:outline-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                        Salary
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. ₱70k-90k"
                        value={salary}
                        onChange={(e) => setSalary(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border rounded-lg focus:outline-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                      Required Competencies (Comma-separated)
                    </label>
                    <input
                      type="text"
                      placeholder="python, fastapi, sql, docker, git"
                      value={competencies}
                      onChange={(e) => setCompetencies(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border rounded-lg focus:outline-indigo-500"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full mt-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition"
                  >
                    Publish Requisition
                  </button>
                </form>
              </div>

              <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                    <div>
                      <h3 className="font-bold text-base text-slate-900">Ranked Candidate Shortlist</h3>
                      <p className="text-xs text-slate-500">Sorted by hybrid AI recall and TF-IDF similarity.</p>
                    </div>
                    <select
                      value={selectedJobFilter}
                      onChange={(e) => setSelectedJobFilter(e.target.value)}
                      className="text-xs border rounded-lg px-3 py-1.5 bg-slate-50 font-medium focus:outline-indigo-500"
                    >
                      <option value="all">All Open Positions</option>
                      {jobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 font-semibold border-b">
                          <th className="pb-2">APPLICANT</th>
                          <th className="pb-2">SKILLS EXTRACTED</th>
                          <th className="pb-2">MATCH</th>
                          <th className="pb-2">STAGE</th>
                          <th className="pb-2">MANAGER ASSESSMENT</th>
                          <th className="pb-2 text-right">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sortedCandidates.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400">
                              No candidate submissions recorded for this requisition.
                            </td>
                          </tr>
                        ) : (
                          sortedCandidates.map((cand) => (
                            <tr key={cand.id} className="hover:bg-slate-50/50">
                              <td className="py-3">
                                <div className="font-bold text-slate-900">{cand.applicantName}</div>
                                <div className="text-[11px] text-slate-400">{cand.applicantEmail}</div>
                              </td>
                              <td className="py-3">
                                <div className="flex flex-wrap gap-1 max-w-[160px]">
                                  {cand.extractedSkills && cand.extractedSkills.length > 0 ? (
                                    cand.extractedSkills.slice(0, 3).map((sk: string, i: number) => (
                                      <span
                                        key={i}
                                        className="bg-indigo-50 text-indigo-700 text-[10px] font-mono px-1.5 py-0.5 rounded"
                                      >
                                        {sk}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-slate-400 italic">No skills</span>
                                  )}
                                  {cand.extractedSkills && cand.extractedSkills.length > 3 && (
                                    <span className="text-[10px] text-slate-400">
                                      +{cand.extractedSkills.length - 3}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 font-bold">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs ${
                                    (cand.matchScore || 0) >= 70
                                      ? "bg-emerald-100 text-emerald-800"
                                      : (cand.matchScore || 0) >= 40
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-rose-100 text-rose-800"
                                  }`}
                                >
                                  {cand.matchScore || 0}%
                                </span>
                              </td>
                              <td className="py-3">
                                <select
                                  value={cand.status || "Submitted"}
                                  onChange={(e) => {
                                    const nextStage = e.target.value;
                                    updateStage(cand.id, nextStage, cand.applicantEmail);
                                    if (nextStage === "Interview Scheduled") {
                                      const tomorrow = new Date();
                                      tomorrow.setDate(tomorrow.getDate() + 1);
                                      tomorrow.setHours(10, 0, 0, 0);
                                      setInterviewCandidate(cand);
                                      setInterviewDate(tomorrow.toISOString().slice(0, 16));
                                    }
                                  }}
                                  className="text-xs border rounded px-2 py-1 bg-white font-medium focus:outline-indigo-500"
                                >
                                  <option value="Submitted">Submitted</option>
                                  <option value="Evaluated">Evaluated</option>
                                  <option value="Interview Scheduled">Interview Scheduled</option>
                                  <option value="Hired">Hired</option>
                                  <option value="Rejected">Rejected</option>
                                </select>
                              </td>

                              {/* STRUCTURED MANAGER VERDICT & FEEDBACK */}
                              <td className="py-3 max-w-[180px]">
                                {cand.managerRecommendation || cand.managerNotes ? (
                                  <div className="space-y-0.5">
                                    {cand.managerRecommendation === "Strong Hire" && (
                                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        🌟 Strong Hire
                                      </span>
                                    )}
                                    {cand.managerRecommendation === "Recommend Hire" && (
                                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        ✅ Recommend Hire
                                      </span>
                                    )}
                                    {cand.managerRecommendation === "Needs Further Review" && (
                                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-amber-100 text-amber-800 border border-amber-200">
                                        ⚖️ Review Needed
                                      </span>
                                    )}
                                    {cand.managerRecommendation === "Do Not Hire" && (
                                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-rose-100 text-rose-800 border border-rose-200">
                                        ❌ Do Not Hire
                                      </span>
                                    )}

                                    {/* Fallback if only legacy managerNotes exists */}
                                    {!cand.managerRecommendation && (
                                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-slate-100 text-slate-700 border">
                                        Notes Logged
                                      </span>
                                    )}

                                    {cand.managerNotes && (
                                      <p className="text-[11px] text-slate-600 truncate" title={cand.managerNotes}>
                                        &quot;{cand.managerNotes}&quot;
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-slate-400 italic">Pending Interview</span>
                                )}
                              </td>

                              <td className="py-3 text-right space-x-2 whitespace-nowrap">
                                {cand.status === "Interview Scheduled" && (
                                  <button
                                    onClick={() => {
                                      setInterviewCandidate(cand);
                                      if (cand.interviewDetails?.scheduledDate) {
                                        setInterviewDate(cand.interviewDetails.scheduledDate);
                                      } else {
                                        const tomorrow = new Date();
                                        tomorrow.setDate(tomorrow.getDate() + 1);
                                        tomorrow.setHours(10, 0, 0, 0);
                                        setInterviewDate(tomorrow.toISOString().slice(0, 16));
                                      }
                                      if (cand.interviewDetails?.meetingLink) {
                                        setMeetingLink(cand.interviewDetails.meetingLink);
                                      }
                                      if (cand.interviewDetails?.instructions) {
                                        setInterviewNotes(cand.interviewDetails.instructions);
                                      } else {
                                        setInterviewNotes("");
                                      }
                                    }}
                                    className="text-emerald-600 font-bold hover:underline"
                                  >
                                    Invite
                                  </button>
                                )}
                                <button
                                  onClick={() => setReviewCandidate(cand)}
                                  className="text-indigo-600 font-semibold hover:underline"
                                >
                                  Review
                                </button>
                                <button
                                  onClick={() => deleteApp(cand.id)}
                                  className="text-rose-500 font-semibold hover:underline"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: EMPLOYEES */}
          {activeTab === "Employees" && (
            <div className="bg-white p-6 rounded-xl border border-slate-200">
              <h3 className="font-bold text-base mb-2">Hired Employees Directory</h3>
              <p className="text-xs text-slate-500 mb-4">Candidates converted into active employee status.</p>
              <div className="divide-y divide-slate-100">
                {applications.filter((a) => a.status === "Hired").length === 0 ? (
                  <p className="text-xs text-slate-400 py-4">No candidates have been marked as Hired yet.</p>
                ) : (
                  applications
                    .filter((a) => a.status === "Hired")
                    .map((emp) => (
                      <div key={emp.id} className="py-3 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm text-slate-800">{emp.applicantName}</p>
                          <p className="text-xs text-slate-400">{emp.applicantEmail}</p>
                        </div>
                        <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-1 rounded">
                          Active Employee
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {/* TAB: APPROVED APPLICATIONS */}
          {activeTab === "Approved Applications" && (
            <div className="bg-white p-6 rounded-xl border border-slate-200">
              <h3 className="font-bold text-base mb-2">Approved / Shortlisted Candidates</h3>
              <p className="text-xs text-slate-500 mb-4">
                Applications currently in Interview Scheduled or Hired stages.
              </p>
              <div className="divide-y divide-slate-100">
                {approvedApps.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4">No candidates approved yet.</p>
                ) : (
                  approvedApps.map((a) => (
                    <div key={a.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm text-slate-800">{a.applicantName}</p>
                        <p className="text-xs text-slate-400">{a.applicantEmail}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                          {a.matchScore}% Match
                        </span>
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-medium">
                          {a.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: REJECTED APPLICATIONS */}
          {activeTab === "Rejected Applications" && (
            <div className="bg-white p-6 rounded-xl border border-slate-200">
              <h3 className="font-bold text-base mb-2">Rejected Applications</h3>
              <p className="text-xs text-slate-500 mb-4">Candidates not moving forward in the pipeline.</p>
              <div className="divide-y divide-slate-100">
                {rejectedApps.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4">No candidates marked as Rejected.</p>
                ) : (
                  rejectedApps.map((a) => (
                    <div key={a.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm text-slate-800">{a.applicantName}</p>
                        <p className="text-xs text-slate-400">{a.applicantEmail}</p>
                      </div>
                      <span className="text-xs bg-rose-50 text-rose-700 px-2.5 py-1 rounded font-semibold border border-rose-200">
                        Rejected
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: JOBS */}
          {activeTab === "Jobs" && (
            <div className="bg-white p-6 rounded-xl border border-slate-200">
              <h3 className="font-bold text-base mb-2">Active Requisitions</h3>
              <p className="text-xs text-slate-500 mb-4">All open positions configured in HireSense.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {jobs.map((job) => (
                  <div key={job.id} className="p-4 border rounded-xl bg-slate-50 space-y-2">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-sm text-indigo-950">{job.title}</h4>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                        {job.department}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {job.location} • {job.salary}
                    </p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {job.requiredSkills?.map((sk: string, i: number) => (
                        <span key={i} className="text-[10px] bg-white border font-mono px-1.5 py-0.5 rounded">
                          {sk}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: LOGS */}
          {activeTab === "Logs" && (
            <div className="bg-white p-6 rounded-xl border border-slate-200">
              <h3 className="font-bold text-base mb-2">System Audit Logs</h3>
              <p className="text-xs text-slate-500 mb-4">Audit history of evaluations and stage changes.</p>
              <div className="font-mono text-xs bg-slate-900 text-slate-200 p-4 rounded-xl space-y-2">
                <p className="text-emerald-400">[SYSTEM READY] FastAPI microservice listening on 127.0.0.1:8000</p>
                {applications.map((a, i) => (
                  <p key={i}>
                    [EVALUATION] Candidate &quot;{a.applicantName}&quot; parsed. Score: {a.matchScore}% | Stage: {a.status}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* TAB: GRAPHS */}
          {activeTab === "Graphs" && (
            <div className="bg-white p-6 rounded-xl border border-slate-200">
              <h3 className="font-bold text-base mb-2">Recruitment Pipeline Analytics</h3>
              <p className="text-xs text-slate-500 mb-6">Distribution of applicants across stages.</p>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                  <p className="text-2xl font-black text-indigo-900">{applications.length}</p>
                  <p className="text-xs font-semibold text-indigo-600 mt-1">Total Submissions</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-2xl font-black text-emerald-900">{approvedApps.length}</p>
                  <p className="text-xs font-semibold text-emerald-600 mt-1">Interviews / Approved</p>
                </div>
                <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
                  <p className="text-2xl font-black text-rose-900">{rejectedApps.length}</p>
                  <p className="text-xs font-semibold text-rose-600 mt-1">Rejected</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-2xl font-black text-amber-900">
                    {applications.length > 0
                      ? Math.round(
                          applications.reduce((acc, c) => acc + (c.matchScore || 0), 0) /
                            applications.length
                        )
                      : 0}
                    %
                  </p>
                  <p className="text-xs font-semibold text-amber-600 mt-1">Average Match Score</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* REVIEW CANDIDATE MODAL */}
      {reviewCandidate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-lg text-slate-900">{reviewCandidate.applicantName}</h4>
                <p className="text-xs text-slate-400">{reviewCandidate.applicantEmail}</p>
              </div>
              <span className="text-sm font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
                {reviewCandidate.matchScore}% Match
              </span>
            </div>

            {/* Structured Manager Verdict in Modal */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold text-indigo-900 uppercase">
                  Hiring Manager Assessment
                </span>
                {reviewCandidate.managerRecommendation && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                      reviewCandidate.managerRecommendation === "Strong Hire"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : reviewCandidate.managerRecommendation === "Recommend Hire"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : reviewCandidate.managerRecommendation === "Needs Further Review"
                        ? "bg-amber-100 text-amber-800 border-amber-200"
                        : "bg-rose-100 text-rose-800 border-rose-200"
                    }`}
                  >
                    {reviewCandidate.managerRecommendation}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-700 italic">
                {reviewCandidate.managerNotes ? (
                  `"${reviewCandidate.managerNotes}"`
                ) : (
                  <span className="text-slate-400">No specific interview notes submitted yet.</span>
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Skills Extracted from PDF</p>
              <div className="flex flex-wrap gap-1.5">
                {reviewCandidate.extractedSkills?.map((s: string, idx: number) => (
                  <span
                    key={idx}
                    className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono px-2 py-0.5 rounded"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setReviewCandidate(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-xs font-bold rounded-lg text-slate-700 transition"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISPATCH INTERVIEW INVITATION MODAL */}
      {interviewCandidate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-bold text-lg text-slate-900">Schedule Technical Interview</h4>
                <p className="text-xs text-slate-500">
                  Recipient: <b>{interviewCandidate.applicantName}</b> ({interviewCandidate.applicantEmail})
                </p>
              </div>
              <button
                onClick={() => setInterviewCandidate(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDispatchInterview} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Interview Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs focus:outline-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Meeting Link (Google Meet / Teams / Zoom)
                </label>
                <input
                  type="url"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  className="w-full px-3 py-2 border rounded-lg text-xs focus:outline-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Preparation Instructions & Notes
                </label>
                <textarea
                  rows={3}
                  value={interviewNotes}
                  onChange={(e) => setInterviewNotes(e.target.value)}
                  placeholder="e.g. Please prepare to present code samples or live demo for the technical interviewer."
                  className="w-full px-3 py-2 border rounded-lg text-xs focus:outline-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <a
                    href={`mailto:${interviewCandidate.applicantEmail}?subject=HireSense Interview Invitation - Next Steps&body=Dear ${encodeURIComponent(
                      interviewCandidate.applicantName
                    )},%0D%0A%0D%0AGreat news! We have reviewed your application and would like to invite you for an interview.%0D%0A%0D%0ADate & Time: ${encodeURIComponent(
                      interviewDate
                    )}%0D%0AMeeting Link: ${encodeURIComponent(meetingLink)}%0D%0A%0D%0APlease let us know if you need to reschedule.%0D%0A%0D%0ABest regards,%0D%0AHireSense Talent Acquisition Team`}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline"
                  >
                    Open Email Client ↗
                  </a>

                  {interviewCandidate.interviewDetails && (
                    <button
                      type="button"
                      onClick={handleCancelInterview}
                      disabled={dispatchLoading}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold underline"
                    >
                      Cancel Schedule
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setInterviewCandidate(null)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-semibold rounded-lg text-slate-700 transition"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={dispatchLoading}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                  >
                    {dispatchLoading ? "Saving..." : "Confirm & Send"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}