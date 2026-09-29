"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { sb, fmtDate, toCsv, downloadText, errMsg } from "@/lib/itad/db";
import { StatusPill, Msg } from "@/components/admin/AdminShell";

type Job = Record<string, unknown> & { id: string; job_number: string; status: string; client_type: string; business_name: string | null; contact_name: string; created_at: string; city: string | null; source: string; regulatory_flags: string[] };
const STATUSES = ["all", "new", "quoted", "scheduled", "picked_up", "received", "processing", "closed", "cancelled"];

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [nf, setNf] = useState({ client_type: "business", business_name: "", contact_name: "", phone: "", email: "", address: "", city: "", zip: "", industry: "", service_type: "pickup", internal_notes: "" });
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  async function load() {
    const { data } = await sb().from("itad_jobs").select("*").order("created_at", { ascending: false });
    setJobs((data as Job[]) ?? []);
  }
  useEffect(() => {
    load();
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("new")) setShowNew(true);
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const flags: string[] = [];
    if (nf.industry === "healthcare") flags.push("HIPAA");
    if (nf.industry === "finance") flags.push("GLBA");
    if (nf.industry === "education") flags.push("FERPA");
    if (nf.industry === "government") flags.push("GOVT");
    const { data, error } = await sb().from("itad_jobs").insert({
      ...nf, source: "admin", business_name: nf.client_type === "business" ? nf.business_name : null,
      industry: nf.industry || null, regulatory_flags: flags, baa_required: flags.includes("HIPAA"),
    }).select("id").single();
    if (error) return setMsg({ ok: false, t: errMsg(error) });
    router.push(`/admin/jobs/${data.id}`);
  }

  const shown = jobs.filter((j) => (filter === "all" || j.status === filter) &&
    (!q || JSON.stringify([j.job_number, j.business_name, j.contact_name, j.city, j.email, j.phone]).toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="stack">
      <div className="adm-row-head">
        <h1 className="adm-h1">Jobs</h1>
        <div className="adm-actions">
          <button className="btn btn-outline" onClick={() => downloadText(`itad-jobs-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(shown))}>Export CSV</button>
          <button className="btn btn-primary" onClick={() => setShowNew((s) => !s)}>+ New job</button>
        </div>
      </div>

      {showNew && (
        <form className="panel stack" onSubmit={create}>
          <h2 className="mt0">New job (phone / walk-in / referral)</h2>
          <div className="row2">
            <div className="field"><label>Client type</label>
              <select value={nf.client_type} onChange={(e) => setNf({ ...nf, client_type: e.target.value })}><option value="business">Business</option><option value="individual">Individual</option></select></div>
            <div className="field"><label>Industry</label>
              <select value={nf.industry} onChange={(e) => setNf({ ...nf, industry: e.target.value })}>
                <option value="">—</option><option value="healthcare">Healthcare</option><option value="finance">Finance</option><option value="legal">Legal</option>
                <option value="education">Education</option><option value="government">Government</option><option value="other">Other</option></select></div>
          </div>
          {nf.client_type === "business" && <div className="field"><label>Business name</label><input type="text" required value={nf.business_name} onChange={(e) => setNf({ ...nf, business_name: e.target.value })} /></div>}
          <div className="row2">
            <div className="field"><label>Contact name</label><input type="text" required value={nf.contact_name} onChange={(e) => setNf({ ...nf, contact_name: e.target.value })} /></div>
            <div className="field"><label>Phone</label><input type="tel" value={nf.phone} onChange={(e) => setNf({ ...nf, phone: e.target.value })} /></div>
          </div>
          <div className="row2">
            <div className="field"><label>Email</label><input type="email" value={nf.email} onChange={(e) => setNf({ ...nf, email: e.target.value })} /></div>
            <div className="field"><label>Service</label><select value={nf.service_type} onChange={(e) => setNf({ ...nf, service_type: e.target.value })}><option value="pickup">Pickup</option><option value="dropoff">Drop-off</option></select></div>
          </div>
          <div className="field"><label>Address</label><input type="text" value={nf.address} onChange={(e) => setNf({ ...nf, address: e.target.value })} /></div>
          <div className="row2">
            <div className="field"><label>City</label><input type="text" value={nf.city} onChange={(e) => setNf({ ...nf, city: e.target.value })} /></div>
            <div className="field"><label>Zip</label><input type="text" value={nf.zip} onChange={(e) => setNf({ ...nf, zip: e.target.value })} /></div>
          </div>
          <div className="field"><label>Internal notes</label><textarea value={nf.internal_notes} onChange={(e) => setNf({ ...nf, internal_notes: e.target.value })} /></div>
          <button className="btn btn-primary">Create job</button>
          <Msg m={msg} />
        </form>
      )}

      <div className="adm-actions">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 200 }}>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <input type="text" placeholder="Search name, job #, city, phone…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 360 }} />
      </div>

      <table className="adm-table">
        <thead><tr><th>Job</th><th>Client</th><th>City</th><th>Status</th><th>Flags</th><th>Source</th><th>Created</th></tr></thead>
        <tbody>
          {shown.map((j) => (
            <tr key={j.id}>
              <td><Link href={`/admin/jobs/${j.id}`}>{j.job_number}</Link></td>
              <td>{j.business_name || j.contact_name}<div className="form-note">{j.client_type}</div></td>
              <td>{j.city || "—"}</td>
              <td><StatusPill s={j.status} /></td>
              <td>{j.regulatory_flags?.join(", ") || "—"}</td>
              <td>{j.source}</td>
              <td>{fmtDate(j.created_at)}</td>
            </tr>
          ))}
          {!shown.length && <tr><td colSpan={7} className="form-note">No jobs match.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
