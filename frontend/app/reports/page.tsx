"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

type Year = { id: string; name: string; ordinal: number; students: number; classes: number };
type Department = { id: string; code: string; name: string; years: Year[] };
type Row = { markSheetId: string; registerNumber: string; studentName: string; subject: string; subjectCode: string; questionPaperCode: string; marks: Record<string, string | null>; total: string | null; maximum: string | null; percentage: string | null; status: string };
type Report = { columns: string[]; data: Row[]; meta: { total: number } };

function ReportsWorkspace() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [department, setDepartment] = useState<Department>();
  const [year, setYear] = useState<Year>();
  const [report, setReport] = useState<Report>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<Department[]>("/reports/navigation").then((items) => {
      setDepartments(items);
      setLoading(false);
    }).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Unable to load departments");
      setLoading(false);
    });
  }, []);

  const loadMarks = useCallback(async (selectedDepartment: Department, selectedYear: Year) => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ departmentId: selectedDepartment.id, studyYearId: selectedYear.id, pageSize: "100" });
      setReport(await apiRequest<Report>(`/reports/classes?${query}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load student marks");
    } finally {
      setLoading(false);
    }
  }, []);

  function chooseDepartment(item: Department) {
    setDepartment(item);
    setReport(undefined);
    const firstYear = item.years[0];
    setYear(firstYear);
    if (firstYear) void loadMarks(item, firstYear);
  }

  function chooseYear(item: Year) {
    if (!department) return;
    setYear(item);
    void loadMarks(department, item);
  }

  return <main className="min-h-screen bg-slate-100 p-4 text-slate-900 lg:p-8">
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-7"><p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-700">AI-MARKS</p><h1 className="mt-1 text-3xl font-bold">Department-wise marks</h1><p className="mt-2 text-slate-600">Select a department, then choose I–IV year to view the student list, question-paper set code, individual marks, and totals.</p></header>
      {error && <p className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {departments.map((item) => <button key={item.id} onClick={() => chooseDepartment(item)} className={`rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${department?.id === item.id ? "border-blue-600 bg-blue-700 text-white" : "border-slate-200 bg-white"}`}><div className="flex items-start justify-between gap-3"><span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${department?.id === item.id ? "bg-white/20" : "bg-blue-50 text-blue-700"}`}>{item.code}</span><span className="text-sm opacity-70">{item.years.reduce((sum, current) => sum + current.students, 0)} students</span></div><h2 className="mt-5 text-xl font-bold">{item.name}</h2><p className="mt-1 text-sm opacity-75">{item.years.length} study years available</p></button>)}
      </section>
      {!loading && departments.length === 0 && <div className="mt-6 rounded-xl bg-white p-8 text-center text-slate-500">No department/class data is configured for this tenant.</div>}
      {department && <section className="mt-7 rounded-2xl bg-white p-3 shadow-sm"><div className="flex flex-wrap gap-2" role="tablist" aria-label="Study year">{department.years.map((item) => <button role="tab" aria-selected={year?.id === item.id} key={item.id} onClick={() => chooseYear(item)} className={`min-w-32 rounded-xl px-5 py-3 text-left ${year?.id === item.id ? "bg-slate-900 text-white" : "bg-slate-100 hover:bg-slate-200"}`}><span className="block font-bold">{item.name}</span><span className="text-xs opacity-70">{item.students} students · {item.classes} classes</span></button>)}</div></section>}
      {loading && <div className="mt-6 rounded-xl bg-white p-8 text-center text-slate-500">Loading…</div>}
      {!loading && report && <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-xl font-bold">Student List with Marks</h2><p className="text-sm text-slate-500">{department?.name} · {year?.name} · {report.meta.total} mark sheets</p></div><div className="overflow-x-auto"><table className="min-w-full whitespace-nowrap text-left text-sm"><thead className="sticky top-0 bg-slate-900 text-white"><tr><th className="p-3">Register No.</th><th className="p-3">Student</th><th className="p-3">Subject</th><th className="p-3">QP Set Code</th>{report.columns.map((column) => <th key={column} className="p-3 text-center">{column}</th>)}<th className="p-3 text-center">Total</th><th className="p-3 text-center">%</th><th className="p-3">Status</th></tr></thead><tbody>{report.data.map((row) => <tr key={row.markSheetId} className="border-b border-slate-100 hover:bg-blue-50/50"><td className="p-3 font-mono">{row.registerNumber}</td><td className="p-3 font-medium">{row.studentName}</td><td className="p-3"><span className="font-medium">{row.subjectCode}</span><span className="block text-xs text-slate-500">{row.subject}</span></td><td className="p-3 font-semibold text-blue-700">{row.questionPaperCode}</td>{report.columns.map((column) => <td key={column} className="p-3 text-center">{row.marks[column] ?? "—"}</td>)}<td className="p-3 text-center font-bold">{row.total ?? "—"}/{row.maximum ?? "—"}</td><td className="p-3 text-center">{row.percentage ? `${Number(row.percentage).toFixed(2)}%` : "—"}</td><td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{row.status}</span></td></tr>)}</tbody></table>{report.data.length === 0 && <p className="p-10 text-center text-slate-500">No mark sheets are available for this department and year.</p>}</div></section>}
    </div>
  </main>;
}

export default function ReportsPage() {
  return <Suspense fallback={<main className="p-8">Loading reports…</main>}><ReportsWorkspace /></Suspense>;
}
