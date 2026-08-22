"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "@/lib/api";

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [id, setId] = useState("");
  const [error, setError] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const router = useRouter();
  async function signIn(event: FormEvent) {
    event.preventDefault();
    try { setError(""); await login(username.trim(), password); setAuthenticated(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Sign in failed"); }
  }
  function open(event: FormEvent) {
    event.preventDefault();
    if (id.trim()) router.push(`/review/${encodeURIComponent(id.trim())}`);
  }
  return <main className="min-h-screen bg-slate-100 p-8 text-slate-900"><section className="mx-auto mt-20 max-w-xl rounded-2xl bg-white p-8 shadow-sm"><p className="text-sm font-semibold uppercase tracking-widest text-blue-700">AI-MARKS</p><h1 className="mt-2 text-3xl font-bold">Mark verification</h1>{!authenticated ? <form onSubmit={signIn} className="mt-8 space-y-4"><input required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" className="w-full rounded-lg border border-slate-300 px-4 py-3" /><input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="w-full rounded-lg border border-slate-300 px-4 py-3" /><button className="w-full rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white">Sign in</button>{error && <p className="text-red-700">{error}</p>}</form> : <><p className="mt-3 text-slate-600">You are signed in. Open an assigned mark sheet.</p><form onSubmit={open} className="mt-8 flex gap-3"><input id="mark-sheet-id" required value={id} onChange={(event) => setId(event.target.value)} placeholder="Mark sheet UUID" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3" /><button className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white">Open</button></form><Link href="/reports" className="mt-5 inline-block font-semibold text-blue-700">Open reports dashboard</Link></>}</section></main>;
}
