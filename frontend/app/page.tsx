"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col justify-center items-center p-6 text-slate-800">
      <div className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
          HireSense
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl w-full">
        {/* Applicant Card */}
        <Link
          href="/applicant"
          className="group block bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-400 transition"
        >
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-xl mb-4 group-hover:bg-indigo-600 group-hover:text-white transition">
            📄
          </div>
          <h2 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition">
            Applicant Portal
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Submit candidate resumes in PDF format and receive real-time automated NLP skill parsing feedback.
          </p>
          <span className="inline-block mt-4 text-xs font-semibold text-indigo-600 group-hover:underline">
            Go to Applicant Portal →
          </span>
        </Link>

        {/* HRIS Recruiter Card */}
        <Link
          href="/hris"
          className="group block bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-400 transition"
        >
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-xl mb-4 group-hover:bg-indigo-600 group-hover:text-white transition">
            💼
          </div>
          <h2 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition">
            HRIS Recruiter Portal
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Publish job requisitions, view real-time ranked shortlists, and manage candidate hiring stages.
          </p>
          <span className="inline-block mt-4 text-xs font-semibold text-indigo-600 group-hover:underline">
            Go to HR Dashboard →
          </span>
        </Link>
      </div>

      <footer className="mt-12 text-xs text-slate-400">
        Next.js • FastAPI Microservice • Firebase RTDB & Auth
      </footer>
    </div>
  );
}