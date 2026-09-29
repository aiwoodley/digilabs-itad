"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { sb, errMsg } from "@/lib/itad/db";

type Admin = { userId: string; email: string; name: string };
const Ctx = createContext<Admin | null>(null);
export const useAdmin = () => useContext(Ctx)!;

const NAV = [
  ["/admin", "Dashboard"], ["/admin/jobs", "Jobs"], ["/admin/assets", "Devices"], ["/admin/sanitize", "Wipe queue"],
  ["/admin/transfers", "Transfers"], ["/admin/sales", "Sales & payouts"], ["/admin/partners", "Partners"], ["/admin/audit", "Audit log"],
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "out" | "denied" | "in">("loading");
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const path = usePathname();

  async function check() {
    const { data } = await sb().auth.getUser();
    if (!data.user) return setState("out");
    const { data: row } = await sb().from("itad_admins").select("display_name").eq("user_id", data.user.id).maybeSingle();
    if (!row) return setState("denied");
    setAdmin({ userId: data.user.id, email: data.user.email ?? "", name: row.display_name });
    setState("in");
  }
  useEffect(() => { check(); }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password: pw });
    if (error) return setErr(errMsg(error));
    setPw("");
    check();
  }
  async function logout() { await sb().auth.signOut(); setAdmin(null); setState("out"); }

  if (state === "loading") return <div className="wrap adm"><p>Loading…</p></div>;
  if (state === "out" || state === "denied")
    return (
      <div className="wrap adm" style={{ maxWidth: 420 }}>
        <h1>ITAD admin</h1>
        {state === "denied" && <p className="form-status err">This account isn&apos;t on the ITAD admin list. <button className="link-btn" onClick={logout}>Sign out</button></p>}
        <form className="stack" onSubmit={login}>
          <p className="form-note mt0">Use your DigiLabs (TechTank) login.</p>
          <div className="field"><label>Email</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></div>
          <div className="field"><label>Password</label><input type="password" required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></div>
          <button className="btn btn-primary btn-block">Sign in</button>
          {err && <p className="form-status err">{err}</p>}
        </form>
      </div>
    );

  return (
    <Ctx.Provider value={admin}>
      <div className="adm">
        <div className="adm-bar">
          <div className="wrap adm-bar-in">
            <nav className="adm-nav">
              {NAV.map(([href, label]) => (
                <Link key={href} href={href} className={(href === "/admin" ? path === href : path.startsWith(href)) ? "on" : ""}>{label}</Link>
              ))}
            </nav>
            <span className="form-note">{admin?.name} · <button className="link-btn" onClick={logout}>Sign out</button></span>
          </div>
        </div>
        <div className="wrap">{children}</div>
      </div>
    </Ctx.Provider>
  );
}

export function Msg({ m }: { m: { ok: boolean; t: string } | null }) {
  if (!m) return null;
  return <p className={`form-status ${m.ok ? "ok" : "err"}`} role="status">{m.t}</p>;
}

export function StatusPill({ s }: { s: string }) {
  return <span className={`pill pill-${s.replace(/[^a-z_]/g, "")}`}>{s.replace(/_/g, " ")}</span>;
}
