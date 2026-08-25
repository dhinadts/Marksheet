"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

type RecordItem = Record<string, string> & { id: string };
type Page = { items: RecordItem[] };
type Lists = Record<string, RecordItem[]>;

const resources = ["academic-years", "departments", "department-academic-years", "programs", "sections", "students", "professors", "subject-offerings", "professor-subject-assignments"];

export default function AdminPage() {
  const [lists, setLists] = useState<Lists>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const pages = await Promise.all(resources.map((resource) => apiRequest<Page>(`/catalog/${resource}?page=1&pageSize=100`)));
      setLists(Object.fromEntries(resources.map((resource, index) => [resource, pages[index].items])));
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to load administration data"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent<HTMLFormElement>, resource: string) {
    event.preventDefault(); setBusy(true); setMessage("");
    const data = Object.fromEntries([...new FormData(event.currentTarget)].filter(([, value]) => value !== ""));
    try {
      await apiRequest(`/catalog/${resource}`, { method: "POST", body: JSON.stringify(data) });
      event.currentTarget.reset(); setMessage("Saved successfully"); await load();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to save"); }
    finally { setBusy(false); }
  }

  const option = (item: RecordItem) => item.name || item.displayName || item.fullName || item.code || item.username || item.registerNumber || item.id;
  const select = (name: string, resource: string, label: string) => <label className="grid gap-1 text-sm"><span>{label}</span><select required name={name} className="rounded-lg border border-slate-300 px-3 py-2"><option value="">Select {label.toLowerCase()}</option>{(lists[resource] || []).map((item) => <option key={item.id} value={item.id}>{option(item)}</option>)}</select></label>;
  const input = (name: string, label: string, type = "text") => <label className="grid gap-1 text-sm"><span>{label}</span><input required name={name} type={type} className="rounded-lg border border-slate-300 px-3 py-2" /></label>;
  const card = (title: string, resource: string, children: React.ReactNode) => <form onSubmit={(event) => void create(event, resource)} className="rounded-xl bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-bold">{title}</h2><div className="grid gap-3">{children}<button disabled={busy} className="mt-2 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Save</button></div></form>;

  return <main className="min-h-screen bg-slate-100 p-4 text-slate-900 lg:p-8"><header className="mx-auto mb-6 flex max-w-7xl items-center justify-between"><div><p className="text-sm font-semibold uppercase tracking-widest text-blue-700">ADMIN</p><h1 className="text-3xl font-bold">Academic administration</h1><p className="text-slate-600">Yearly departments, student roll numbers and professor subject access</p></div><Link href="/" className="font-semibold text-blue-700">Home</Link></header>{message && <p className="mx-auto mb-5 max-w-7xl rounded-lg bg-white p-3 shadow-sm">{message}</p>}<section className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2 xl:grid-cols-3">
    {card("Academic year", "academic-years", <>{input("code", "Year code (example: 2026-27)")}{input("startsOn", "Start date", "date")}{input("endsOn", "End date", "date")}</>)}
    {card("Department for academic year", "department-academic-years", <>{select("departmentId", "departments", "Department")}{select("academicYearId", "academic-years", "Academic year")}</>)}
    {card("Student roll number", "students", <>{select("departmentId", "departments", "Department")}{select("programId", "programs", "Program")}{select("sectionId", "sections", "Section")}{input("registerNumber", "Roll / register number")}{input("fullName", "Student full name")}</>)}
    {card("Professor subject administration", "professor-subject-assignments", <>{select("professorId", "professors", "Professor")}{select("subjectOfferingId", "subject-offerings", "Subject offering")}</>)}
  </section><section className="mx-auto mt-6 max-w-7xl rounded-xl bg-white p-5 shadow-sm"><h2 className="font-bold">Stored mark-sheet record</h2><p className="mt-2 text-slate-600">Every capture remains linked to the student roll number and subject offering. The original handwritten image is retained alongside extracted numeric marks, reviewer corrections, calculated total and audit history.</p></section></main>;
}
