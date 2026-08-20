"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";

type Summary = {
  cards: Record<string, number>;
  confidence: { count: number; average: number | null };
  breakdowns: Record<string, { id: string; name: string; total: number; completed: number }[]>;
};
type ClassRow = { markSheetId: string; registerNumber: string; studentName: string; subject: string; subjectCode: string; total: string | null; maximum: string | null; percentage: string | null; status: string };
type ClassReport = { data: ClassRow[]; meta: { page: number; pageSize: number; total: number; pageCount: number } };
const labels: Record<string, string> = { totalStudents: "Students", totalMarkSheets: "Mark sheets", processed: "Processed", pending: "Pending", verified: "Verified", reviewRequired: "Review required", totalMismatch: "Total mismatch", processingErrors: "Errors" };

function ReportsWorkspace() {
  const searchParams = useSearchParams();
  const [summary, setSummary] = useState<Summary>();
  const [report, setReport] = useState<ClassReport>();
  const [error, setError] = useState("");
  const query = searchParams.toString();
  const load = useCallback(async () => {
    try {
      setError("");
      const suffix = query ? `?${query}` : "";
      const [nextSummary, nextReport] = await Promise.all([
        apiRequest<Summary>(`/reports/summary${suffix}`),
        apiRequest<ClassReport>(`/reports/classes${suffix}`),
      ]);
      setSummary(nextSummary);
      setReport(nextReport);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load reports");
    }
  }, [query]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const key of ["search", "classId", "subjectOfferingId"]) {
      const value = String(form.get(key) ?? "").trim();
      if (value) params.set(key, value);
    }
    window.location.search = params.toString();
  }
  return <main className="min-h-screen bg-slate-100 p-4 text-slate-900 lg:p-8"><div className="mx-auto max-w-7xl">
    <header><p className="text-sm font-semibold uppercase tracking-widest text-blue-700">AI-MARKS</p><h1 className="text-3xl font-bold">Reports</h1><p className="text-slate-600">Tenant-scoped results from verified marks and immutable calculations.</p></header>
    <form onSubmit={filter} className="my-6 grid gap-3 rounded-xl bg-white p-4 shadow-sm md:grid-cols-4"><input name="search" defaultValue={searchParams.get("search") ?? ""} placeholder="Student or register number" className="rounded-lg border p-3" /><input name="classId" defaultValue={searchParams.get("classId") ?? ""} placeholder="Class UUID" className="rounded-lg border p-3" /><input name="subjectOfferingId" defaultValue={searchParams.get("subjectOfferingId") ?? ""} placeholder="Subject offering UUID" className="rounded-lg border p-3" /><button className="rounded-lg bg-blue-700 p-3 font-semibold text-white">Apply filters</button></form>
    {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    {summary && <><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(summary.cards).map(([key, value]) => <article key={key} className="rounded-xl bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">{labels[key] ?? key}</p><p className="text-3xl font-bold">{value}</p></article>)}</section><section className="mt-5 rounded-xl bg-white p-5 shadow-sm"><h2 className="font-bold">Department processing</h2><div className="mt-3 space-y-2">{(summary.breakdowns.department ?? []).map((item) => <div key={item.id}><div className="flex justify-between text-sm"><span>{item.name}</span><span>{item.completed}/{item.total}</span></div><div className="h-2 rounded bg-slate-100"><div className="h-2 rounded bg-emerald-600" style={{ width: `${item.total ? item.completed / item.total * 100 : 0}%` }} /></div></div>)}</div><p className="mt-4 text-sm text-slate-500">Average AI confidence: {summary.confidence.average === null ? "No data" : `${(summary.confidence.average * 100).toFixed(1)}%`}</p></section></>}
    {report && <section className="mt-5 overflow-x-auto rounded-xl bg-white shadow-sm"><table className="w-full text-left text-sm"><thead className="border-b bg-slate-50"><tr>{["Register No", "Student", "Subject", "Total", "Percentage", "Status"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{report.data.map((row) => <tr key={row.markSheetId} className="border-b"><td className="p-3">{row.registerNumber}</td><td className="p-3">{row.studentName}</td><td className="p-3">{row.subjectCode} · {row.subject}</td><td className="p-3">{row.total ?? "—"}/{row.maximum ?? "—"}</td><td className="p-3">{row.percentage ? `${Number(row.percentage).toFixed(2)}%` : "—"}</td><td className="p-3">{row.status}</td></tr>)}</tbody></table><p className="p-3 text-sm text-slate-500">Page {report.meta.page} of {report.meta.pageCount || 1} · {report.meta.total} records</p></section>}
  </div></main>;
}

export default function ReportsPage() {
  return <Suspense fallback={<main className="p-8">Loading reports…</main>}><ReportsWorkspace /></Suspense>;
}
