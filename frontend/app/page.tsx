"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  apiRequest,
  login,
  type CurrentUser,
  type DepartmentStudents,
} from "@/lib/api";

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [markSheetId, setMarkSheetId] = useState("");
  const [error, setError] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [roster, setRoster] = useState<DepartmentStudents | null>(null);
  const [dashboardError, setDashboardError] = useState("");
  const router = useRouter();

  async function signIn(event: FormEvent) {
    event.preventDefault();
    try {
      setError("");
      await login(username.trim(), password);
      setAuthenticated(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in failed");
    }
  }

  function openMarkSheet(event: FormEvent) {
    event.preventDefault();
    if (markSheetId.trim()) router.push(`/review/${encodeURIComponent(markSheetId.trim())}`);
  }

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    async function loadDashboard() {
      try {
        setDashboardError("");
        const user = await apiRequest<CurrentUser>("/auth/me");
        if (cancelled) return;
        setMe(user);
        if (user.professorProfile) {
          const students = await apiRequest<DepartmentStudents>("/auth/me/students");
          if (!cancelled) setRoster(students);
        }
      } catch (cause) {
        if (!cancelled)
          setDashboardError(cause instanceof Error ? cause.message : "Failed to load dashboard");
      }
    }
    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  return (
    <main className="min-h-screen bg-slate-100 p-8 text-slate-900">
      <section className="mx-auto mt-20 max-w-3xl rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">AI-MARKS</p>
        <h1 className="mt-2 text-3xl font-bold">
          {authenticated ? "My department" : "Sign in"}
        </h1>
        {!authenticated ? (
          <form onSubmit={signIn} className="mt-8 space-y-4">
            <input
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
              className="w-full rounded-lg border border-slate-300 px-4 py-3"
            />
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className="w-full rounded-lg border border-slate-300 px-4 py-3"
            />
            <button className="w-full rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white">
              Sign in
            </button>
            {error && <p className="text-red-700">{error}</p>}
          </form>
        ) : (
          <div className="mt-6">
            {dashboardError && <p className="text-red-700">{dashboardError}</p>}
            {me && !me.professorProfile && !dashboardError && (
              <p className="text-slate-600">
                This account has no professor profile, so no department roster is available.
              </p>
            )}
            {me?.professorProfile && (
              <p className="text-slate-600">
                {me.professorProfile.firstName} {me.professorProfile.lastName} &middot;{" "}
                {me.professorProfile.department.name} ({me.professorProfile.department.code})
              </p>
            )}
            {roster && (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-4">Register number</th>
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Date of birth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.students.map((student) => (
                      <tr key={student.id} className="border-b border-slate-100">
                        <td className="py-2 pr-4">{student.registerNumber}</td>
                        <td className="py-2 pr-4">{student.fullName}</td>
                        <td className="py-2 pr-4">
                          {student.dateOfBirth
                            ? new Date(student.dateOfBirth).toLocaleDateString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-sm text-slate-500">
                  {roster.students.length} student{roster.students.length === 1 ? "" : "s"}
                </p>
              </div>
            )}
            <nav className="mt-6 flex flex-wrap gap-4">
              <Link href="/admin" className="font-semibold text-blue-700">
                Academic administration
              </Link>
              <Link href="/reports" className="font-semibold text-blue-700">
                Reports dashboard
              </Link>
            </nav>
            <form onSubmit={openMarkSheet} className="mt-6 flex gap-3 border-t border-slate-100 pt-6">
              <input
                required
                value={markSheetId}
                onChange={(event) => setMarkSheetId(event.target.value)}
                placeholder="Mark sheet UUID"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm"
              />
              <button className="rounded-lg border border-blue-700 px-5 py-3 text-sm font-semibold text-blue-700">
                Open mark sheet
              </button>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}
