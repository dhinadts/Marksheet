"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  const [id, setId] = useState("");
  const router = useRouter();
  function open(event: FormEvent) {
    event.preventDefault();
    if (id.trim()) router.push(`/review/${encodeURIComponent(id.trim())}`);
  }
  return <main className="min-h-screen bg-slate-100 p-8 text-slate-900"><section className="mx-auto mt-20 max-w-xl rounded-2xl bg-white p-8 shadow-sm"><p className="text-sm font-semibold uppercase tracking-widest text-blue-700">AI-MARKS</p><h1 className="mt-2 text-3xl font-bold">Mark verification</h1><p className="mt-3 text-slate-600">Open an assigned mark sheet. The authentication flow must store a valid access token in this browser session.</p><form onSubmit={open} className="mt-8 flex gap-3"><label className="sr-only" htmlFor="mark-sheet-id">Mark sheet ID</label><input id="mark-sheet-id" required value={id} onChange={(event) => setId(event.target.value)} placeholder="Mark sheet UUID" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3" /><button className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white">Open</button></form><Link href="/reports" className="mt-5 inline-block font-semibold text-blue-700">Open reports dashboard →</Link></section></main>;
}
