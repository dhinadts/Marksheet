"use client";
import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";

type Value = { id: string; value: string; source: string; reason?: string };
type Item = { id: string; selectedMarkValueId?: string; extractedMark: { extractedValue?: string; confidence?: string; markingSchemeItem: { maximumMark: string; question: { number: string }; questionPart?: { label: string } }; values: Value[] } };
type Review = { student: { registerNumber: string; fullName: string }; subjectOffering: { subject: { code: string; name: string } }; images: { url: string }[]; verificationSessions: { id: string; status: string; lockVersion: number; items: Item[] }[] };

function Workspace() {
  const { id } = useParams<{ id: string }>();
  const [review, setReview] = useState<Review>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setError(""); setReview(await apiRequest<Review>(`/mark-sheets/${id}/review`)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load mark sheet"); } }, [id]);
  useEffect(() => {
    let active = true;
    apiRequest<Review>(`/mark-sheets/${id}/review`).then(
      (result) => { if (active) setReview(result); },
      (cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load mark sheet"); },
    );
    return () => { active = false; };
  }, [id]);
  const session = review?.verificationSessions[0];
  async function save(event: FormEvent<HTMLFormElement>, item: Item) {
    event.preventDefault(); if (!session) return; const data = new FormData(event.currentTarget); setBusy(true);
    try { await apiRequest(`/verification-sessions/${session.id}/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ value: Number(data.get("value")), reason: data.get("reason"), expectedLockVersion: session.lockVersion }) }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save mark"); } finally { setBusy(false); }
  }
  async function mutate(action: "submit" | "approve") {
    if (!session) return; setBusy(true);
    try { await apiRequest(`/verification-sessions/${session.id}/${action}`, { method: "POST", body: JSON.stringify({ expectedLockVersion: session.lockVersion }) }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : `Unable to ${action}`); } finally { setBusy(false); }
  }
  if (error && !review) return <main className="p-8 text-red-700">{error}</main>;
  if (!review) return <main className="p-8">Loading review…</main>;
  return <main className="min-h-screen bg-slate-100 p-4 text-slate-900 lg:p-8"><header className="mx-auto mb-5 flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-5 shadow-sm"><div><p className="text-sm text-slate-500">{review.subjectOffering.subject.code}</p><h1 className="text-xl font-bold">{review.student.registerNumber} · {review.student.fullName}</h1><p className="text-sm">{review.subjectOffering.subject.name}</p></div><div className="flex gap-2"><button disabled={busy || session?.status !== "OPEN"} onClick={() => void mutate("submit")} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-40">Submit review</button><button disabled={busy || session?.status !== "SUBMITTED"} onClick={() => void mutate("approve")} className="rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-40">Approve</button></div></header>{error && <p className="mx-auto mb-4 max-w-7xl rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}<div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-2"><section className="overflow-hidden rounded-xl bg-slate-900 p-3"><iframe title="Mark-sheet image" src={review.images[0]?.url} className="h-[75vh] w-full bg-white" /></section><section className="space-y-3">{session?.items.map((item) => { const scheme = item.extractedMark.markingSchemeItem; const selected = item.extractedMark.values.find((value) => value.id === item.selectedMarkValueId); return <form key={item.id} onSubmit={(event) => void save(event, item)} className="rounded-xl bg-white p-4 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="font-bold">Q{scheme.question.number}{scheme.questionPart ? `(${scheme.questionPart.label})` : ""}</h2><p className="text-sm text-slate-500">AI: {item.extractedMark.extractedValue ?? "not detected"} · confidence {item.extractedMark.confidence ?? "n/a"}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm">Max {scheme.maximumMark}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-[7rem_1fr_auto]"><input name="value" type="number" step="0.01" min="0" max={scheme.maximumMark} required defaultValue={selected?.value ?? item.extractedMark.extractedValue ?? ""} className="rounded-lg border border-slate-300 px-3 py-2" /><input name="reason" required minLength={3} defaultValue={selected?.reason ?? "Verified against image"} className="rounded-lg border border-slate-300 px-3 py-2" /><button disabled={busy || session.status !== "OPEN"} className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-40">Save</button></div>{item.extractedMark.values.length > 0 && <details className="mt-3 text-sm text-slate-600"><summary>History ({item.extractedMark.values.length})</summary>{item.extractedMark.values.map((value) => <p key={value.id}>{value.source}: {value.value} · {value.reason}</p>)}</details>}</form>; })}</section></div></main>;
}
export default function ReviewPage() { return <Suspense fallback={<main className="p-8">Loading review…</main>}><Workspace /></Suspense>; }
