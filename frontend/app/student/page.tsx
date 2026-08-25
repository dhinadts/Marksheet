"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { API_URL } from "@/lib/api";

type Mark = { question: string; part: string | null; mark: string | null; maximum: string };
type SubjectResult = {
  markSheetId: string;
  subject: { code: string; name: string };
  questionPaper: string;
  marks: Mark[];
  grandTotal: string | null;
  maximum: string | null;
  percentage: string | null;
  status: string;
};
type StudentResult = {
  student: { registerNumber: string; fullName: string };
  subjects: SubjectResult[];
};

export default function StudentPage() {
  const [registerNumber, setRegisterNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [result, setResult] = useState<StudentResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch(`${API_URL}/student-portal/marks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registerNumber: registerNumber.trim(), dateOfBirth }),
      });
      const body = (await response.json().catch(() => null)) as StudentResult | { message?: string } | null;
      if (!response.ok) throw new Error(body && "message" in body ? body.message : "Unable to load marks");
      setResult(body as StudentResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load marks");
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-slate-100 p-4 text-slate-900 lg:p-8">
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex items-center justify-between"><div><p className="text-sm font-bold uppercase tracking-widest text-blue-700">AI-MARKS</p><h1 className="text-3xl font-bold">Student marks portal</h1></div><Link href="/" className="font-semibold text-blue-700">Professor sign in</Link></header>
      <form onSubmit={load} className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="grid gap-1 text-sm"><span>Roll / register number</span><input required value={registerNumber} onChange={(event) => setRegisterNumber(event.target.value)} className="rounded-lg border border-slate-300 px-4 py-3" /></label>
        <label className="grid gap-1 text-sm"><span>Date of birth</span><input required type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} className="rounded-lg border border-slate-300 px-4 py-3" /></label>
        <button disabled={busy} className="rounded-lg bg-blue-700 px-6 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Loading…" : "View marks"}</button>
      </form>
      {error && <p className="mt-4 rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
      {result && <section className="mt-6 space-y-5"><div><h2 className="text-2xl font-bold">{result.student.fullName}</h2><p className="font-mono text-slate-600">{result.student.registerNumber}</p></div>
        {result.subjects.map((subject) => <article key={subject.markSheetId} className="overflow-hidden rounded-2xl bg-white shadow-sm"><header className="flex flex-wrap justify-between gap-3 border-b p-5"><div><h3 className="text-lg font-bold">{subject.subject.code} · {subject.subject.name}</h3><p className="text-sm text-slate-500">Question paper {subject.questionPaper}</p></div><div className="text-right"><p className="text-xl font-bold">{subject.grandTotal ?? "—"}/{subject.maximum ?? "—"}</p><p className="text-sm text-slate-500">{subject.percentage ? `${Number(subject.percentage).toFixed(2)}%` : subject.status}</p></div></header><div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead className="bg-slate-900 text-white"><tr><th className="p-3">Question</th><th className="p-3">Part</th><th className="p-3 text-center">Obtained</th><th className="p-3 text-center">Maximum</th></tr></thead><tbody>{subject.marks.map((mark, index) => <tr key={`${mark.question}-${mark.part}-${index}`} className="border-b"><td className="p-3">{mark.question}</td><td className="p-3">{mark.part ?? "—"}</td><td className="p-3 text-center font-bold">{mark.mark ?? "—"}</td><td className="p-3 text-center">{mark.maximum}</td></tr>)}</tbody></table></div></article>)}
        {result.subjects.length === 0 && <p className="rounded-xl bg-white p-8 text-center text-slate-500">No approved mark sheets are available yet.</p>}
      </section>}
    </div>
  </main>;
}
