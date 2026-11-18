"use client";

import React, { useState, useEffect } from "react";
import { rtdb, auth } from "../../lib/firebase";
import { ref, onValue, get, update } from "firebase/database";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";

interface Job {
  id: string;
  title: string;
  department: string;
  requiredSkills: string[];
}

interface Application {
  id: string;
  jobId: string;
  applicantName: string;
  applicantEmail?: string;
  extractedSkills?: string[];
  matchScore?: number;
  status?: string;
  submittedAt?: number;
  resumeUrl?: string;
  managerNotes?: string;
  managerRecommendation?: string;
  interviewDetails?: {
    scheduledDate?: string;
    meetingLink?: string;
    instructions?: string;
    dispatchedAt?: number;
  };
}

type TabType = "Candidate Queue" | "Scheduled Interviews" | "Department Needs";

const Icons = {
  Queue: () => (
    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <line x1="8" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="16" y2="14" />
      <line x1="8" y1="18" x2="12" y2="18" />
    </svg>
  ),
  Calendar: () => (
    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Briefcase: () => (
    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
};

export default function HiringManagerDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<{ role: string; department: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<TabType>("Candidate Queue");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApplicant, setSelectedApplicant] = useState<Application | null>(null);
  const [managerNoteInput, setManagerNoteInput] = useState("");
  const [managerDecision, setManagerDecision] = useState<string>("Recommend Hire");
  const [evalMode, setEvalMode] = useState<"screen" | "interview">("screen");

  // Role Gate
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      const snap = await get(ref(rtdb, `users/${user.uid}`));
      const data = snap.val();

      if (!data) {
        await signOut(auth);
        router.push("/login");
        return;
      }

      if (data.role !== "hiring_manager" && data.role !== "admin") {
        if (data.role === "recruiter") {
          router.push("/hris");
        } else {
          router.push("/applicant");
        }
        return;
      }

      setCurrentUser(user);
      setUserProfile(data);
      setAuthLoading(false);
    });
    return () => unsubscribeAuth();
  }, [router]);

  // Sync data scoped to Manager's Department
  useEffect(() => {
    if (!currentUser || !userProfile) return;

    const jobsRef = ref(rtdb, "jobs");
    const unsubscribeJobs = onValue(jobsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedJobs: Job[] = Object.keys(data)
          .map((key) => ({ id: key, ...data[key] }))
          .filter((j) => {
            if (userProfile.role === "admin") return true;
            if (!userProfile.department || userProfile.department.trim() === "") return true;
            return j.department?.toLowerCase().trim() === userProfile.department.toLowerCase().trim();
          });
        setJobs(loadedJobs);
      } else {
        setJobs([]);
      }
    });

    const appsRef = ref(rtdb, "applications");
    const unsubscribeApps = onValue(appsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedApps: Application[] = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setApplications(loadedApps);

        setSelectedApplicant((prev) => {
          if (!prev) return null;
          return loadedApps.find((a) => a.id === prev.id) || null;
        });
      } else {
        setApplications([]);
      }
    });

    return () => {
      unsubscribeJobs();
      unsubscribeApps();
    };
  }, [currentUser, userProfile]);

  const handleOpenEvaluationModal = (app: Application, mode: "screen" | "interview") => {
    setSelectedApplicant(app);
    setEvalMode(mode);
    setManagerNoteInput(app.managerNotes || "");
    setManagerDecision(app.managerRecommendation || "Recommend Hire");
  };

  const handleSaveNotes = async (appId: string) => {
    await update(ref(rtdb, `applications/${appId}`), {
      managerNotes: managerNoteInput.trim(),
      managerRecommendation: managerDecision,
    });
    alert(
      evalMode === "interview"
        ? "Interview technical rubric saved!"
        : "Candidate screening assessment saved!"
    );
    setSelectedApplicant(null);
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-medium">
        Verifying managerial access...
      </div>
    );
  }

  // Filter applicants matching manager's department jobs
  const relevantJobIds = jobs.map((j) => j.id);
  const departmentApplicants = applications
    .filter((a) => relevantJobIds.includes(a.jobId))
    .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

  const scheduledApplicants = departmentApplicants.filter(
    (a) => a.status === "Interview Scheduled"
  );

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0a1128] text-slate-300 flex flex-col justify-between shrink-0 shadow-xl">
        <div>
          <div className="px-6 py-6 border-b border-slate-800">
            <h1 className="text-xl font-bold tracking-wider text-white">Manager</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Department Workspace</p>
          </div>

          <nav className="mt-4 px-3 space-y-1">
            {[
              { label: "Candidate Queue", icon: Icons.Queue },
              { label: "Scheduled Interviews", icon: Icons.Calendar },
              { label: "Department Needs", icon: Icons.Briefcase },
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
            <span className="inline-block bg-emerald-600 text-white font-mono px-1.5 py-0.5 rounded text-[10px] mb-1 uppercase">
              {userProfile?.role || "Manager"}
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

      {/* MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{activeTab}</h2>
            <p className="text-xs text-slate-500">
              Department:{" "}
              <span className="font-semibold text-indigo-600">
                {userProfile?.department || "All Departments"}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Show portal switcher buttons if logged in as Admin */}
            {userProfile?.role === "admin" && (
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
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-600 text-white shadow-sm"
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

            <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-medium border border-slate-200">
              {departmentApplicants.length} Candidates Under Review
            </span>
          </div>
        </header>

        <div className="p-8 space-y-6">
          {/* TAB 1: CANDIDATE QUEUE */}
          {activeTab === "Candidate Queue" && (
            <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-slate-900">
                  Applicant Shortlist ({departmentApplicants.length})
                </h3>
                <span className="text-xs text-slate-400">Ranked by AI Match Score</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4">Applicant</th>
                      <th className="py-3 px-4">Role Requisition</th>
                      <th className="py-3 px-4">AI Match</th>
                      <th className="py-3 px-4">Stage</th>
                      <th className="py-3 px-4">Interviewer Assessment</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {departmentApplicants.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No active applicants submitted for {userProfile?.department || "your department"} yet.
                        </td>
                      </tr>
                    ) : (
                      departmentApplicants.map((app) => {
                        const job = jobs.find((j) => j.id === app.jobId);
                        return (
                          <tr key={app.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-4 font-semibold text-slate-800">
                              <div>{app.applicantName}</div>
                              <div className="text-[10px] text-slate-400">{app.applicantEmail}</div>
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {job?.title || "Requisition"}
                            </td>
                            <td className="py-3 px-4 font-bold">
                              <span
                                className={`px-2 py-0.5 rounded ${
                                  (app.matchScore || 0) >= 70
                                    ? "bg-emerald-100 text-emerald-800"
                                    : (app.matchScore || 0) >= 40
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {app.matchScore ?? 0}%
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
                                {app.status || "Submitted"}
                              </span>
                            </td>
                            <td className="py-3 px-4 max-w-xs">
                              {app.managerRecommendation ? (
                                <div className="space-y-0.5">
                                  <span
                                    className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                                      app.managerRecommendation === "Strong Hire"
                                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                        : app.managerRecommendation === "Recommend Hire"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : app.managerRecommendation === "Needs Further Review"
                                        ? "bg-amber-100 text-amber-800 border-amber-200"
                                        : "bg-rose-100 text-rose-800 border-rose-200"
                                    }`}
                                  >
                                    {app.managerRecommendation}
                                  </span>
                                  {app.managerNotes && (
                                    <p className="text-[11px] text-slate-600 truncate" title={app.managerNotes}>
                                      &quot;{app.managerNotes}&quot;
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="italic text-slate-400">No assessment recorded</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => handleOpenEvaluationModal(app, "screen")}
                                className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-3 py-1.5 rounded-lg transition"
                              >
                                Review & Notes
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TAB 2: SCHEDULED INTERVIEWS */}
          {activeTab === "Scheduled Interviews" && (
            <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-2">Confirmed Interview Pipeline</h3>
              <p className="text-xs text-slate-500 mb-4">
                Applicants in the {userProfile?.department || "company"} who have been scheduled for an interview.
              </p>

              <div className="divide-y divide-slate-100">
                {scheduledApplicants.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    No interviews scheduled for your department yet.
                  </p>
                ) : (
                  scheduledApplicants.map((cand) => {
                    const job = jobs.find((j) => j.id === cand.jobId);
                    return (
                      <div key={cand.id} className="py-4 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-sm text-slate-800">{cand.applicantName}</p>
                          <p className="text-xs text-slate-500">
                            {job?.title} • {cand.applicantEmail}
                          </p>

                          {/* Meeting Link badge directly visible in list */}
                          {cand.interviewDetails?.meetingLink && (
                            <a
                              href={cand.interviewDetails.meetingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block mt-1 text-[11px] font-semibold text-emerald-700 hover:underline"
                            >
                              🔗 Video Meet Link: {cand.interviewDetails.meetingLink}
                            </a>
                          )}

                          {cand.managerRecommendation && (
                            <div className="mt-1 flex items-center gap-2">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase border ${
                                  cand.managerRecommendation === "Strong Hire"
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                    : cand.managerRecommendation === "Recommend Hire"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : cand.managerRecommendation === "Needs Further Review"
                                    ? "bg-amber-100 text-amber-800 border-amber-200"
                                    : "bg-rose-100 text-rose-800 border-rose-200"
                                }`}
                              >
                                {cand.managerRecommendation}
                              </span>
                              {cand.managerNotes && (
                                <span className="text-xs text-slate-600 italic">
                                  &quot;{cand.managerNotes}&quot;
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                            {cand.matchScore || 0}% Match
                          </span>
                          <button
                            onClick={() => handleOpenEvaluationModal(cand, "interview")}
                            className="text-xs px-3.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold rounded-lg hover:bg-emerald-100 transition"
                          >
                            Update Assessment
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}

          {/* TAB 3: DEPARTMENT NEEDS */}
          {activeTab === "Department Needs" && (
            <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-2">Department Requisitions</h3>
              <p className="text-xs text-slate-500 mb-6">
                Active job requisitions tied to {userProfile?.department || "all departments"}.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {jobs.map((job) => (
                  <div key={job.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-sm text-indigo-950">{job.title}</h4>
                      <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-medium">
                        {job.department}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">Target Competencies:</p>
                    <div className="flex flex-wrap gap-1">
                      {job.requiredSkills?.map((s, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] bg-white border border-slate-200 font-mono px-2 py-0.5 rounded text-slate-700"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* DYNAMIC CONTEXTUAL EVALUATION MODAL */}
      {selectedApplicant && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 relative space-y-4">
            <button
              onClick={() => setSelectedApplicant(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-lg"
            >
              ✕
            </button>

            {/* Context Header */}
            <div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                  evalMode === "interview"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-indigo-50 text-indigo-700 border-indigo-200"
                }`}
              >
                {evalMode === "interview"
                  ? "🎙️ Post-Interview Technical Rubric"
                  : "📄 Candidate Profile Screening"}
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-1">
                {selectedApplicant.applicantName}
              </h3>
              <p className="text-xs text-slate-500">
                AI ATS Match: <b className="text-indigo-600">{selectedApplicant.matchScore}%</b>
              </p>
            </div>

            {/* Meeting link & date highlight in post-interview rubric */}
            {evalMode === "interview" && selectedApplicant.interviewDetails && (
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs space-y-1">
                <p className="font-semibold text-emerald-900">
                  📅 Scheduled:{" "}
                  {selectedApplicant.interviewDetails.scheduledDate
                    ? new Date(selectedApplicant.interviewDetails.scheduledDate).toLocaleString()
                    : "Date TBD"}
                </p>
                {selectedApplicant.interviewDetails.meetingLink && (
                  <a
                    href={selectedApplicant.interviewDetails.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 underline font-semibold block"
                  >
                    Open Meeting Link ↗
                  </a>
                )}
              </div>
            )}

            <div className="space-y-3.5">
              {selectedApplicant.resumeUrl && (
                <a
                  href={selectedApplicant.resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition"
                >
                  📄 Open Candidate Resume PDF
                </a>
              )}

              {/* Extracted Skills */}
              {selectedApplicant.extractedSkills && (
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Extracted Competencies
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {selectedApplicant.extractedSkills.map((sk, idx) => (
                      <span
                        key={idx}
                        className="bg-slate-100 text-slate-700 text-[10px] font-mono px-1.5 py-0.5 rounded"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendation Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  {evalMode === "interview"
                    ? "Final Technical Verdict"
                    : "Screening Recommendation"}
                </label>
                <select
                  value={managerDecision}
                  onChange={(e) => setManagerDecision(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-semibold bg-white focus:outline-indigo-500"
                >
                  <option value="Strong Hire">🌟 Strong Hire (Highly Recommended)</option>
                  <option value="Recommend Hire">✅ Recommend Hire (Passed Technical Bar)</option>
                  <option value="Needs Further Review">⚖️ Needs Further Review / On Hold</option>
                  <option value="Do Not Hire">❌ Do Not Hire / Reject</option>
                </select>
              </div>

              {/* Evaluation Notes */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  {evalMode === "interview"
                    ? "Interview Feedback & Technical Observations"
                    : "Screening & Portfolio Notes"}
                </label>
                <textarea
                  rows={3}
                  value={managerNoteInput}
                  onChange={(e) => setManagerNoteInput(e.target.value)}
                  placeholder={
                    evalMode === "interview"
                      ? "Detail candidate's problem-solving, code cleanliness, and system design answers..."
                      : "Add initial thoughts on resume qualifications or questions for the interview..."
                  }
                  className="w-full p-2.5 border rounded-lg text-xs focus:outline-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setSelectedApplicant(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveNotes(selectedApplicant.id)}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                >
                  {evalMode === "interview" ? "Submit Technical Score" : "Save Screening Notes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}