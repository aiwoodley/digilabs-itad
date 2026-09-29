"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sb, fmtDate } from "@/lib/itad/db";
import { StatusPill } from "@/components/admin/AdminShell";

type Job = { id: string; job_number: string; status: string; client_type: string; business_name: string | null; contact_name: string; created_at: string; preferred_date: string | null; regulatory_flags: string[]; source: string };

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [pendingMedia, setPendingMedia] = useState(0);
  const [partners, setPartners] = useState<{ name: string; r2_cert_expiry: string | null }[]>([]);
  const [owed, setOwed] = useState(0);

  useEffect(() => {
    (async () => {
      const [j, a, m, p, s] = await Promise.all([
        sb().from("itad_jobs").select("id,job_number,status,client_type,business_name,contact_name,created_at,preferred_date,regulatory_flags,source").not("status", "in", "(closed,cancelled)").order("created_at", { ascending: false }),
        sb().from("itad_assets").select("status"),
        sb().from("itad_storage_media").select("id", { count: "exact", head: true }).eq("status", "pending"),
        sb().from("itad_partners").select("name,r2_cert_expiry").eq("active", true),
        sb().from("itad_sales").select("payout_amount").eq("payout_status", "owed"),
      ]);
      setJobs((j.data as Job[]) ?? []);
      const c: Record<string, number> = {};
      (a.data ?? []).forEach((r: { status: string }) => (c[r.status] = (c[r.status] ?? 0) + 1));
      setCounts(c);
      setPendingMedia(m.count ?? 0);
      setPartners(p.data ?? []);
      setOwed((s.data ?? []).reduce((t: number, r: { payout_amount: number | null }) => t + Number(r.payout_amount ?? 0), 0));
    })();
  }, []);

  const soon = (d: string | null) => !d || new Date(d).getTime() - Date.now() < 30 * 864e5;
  const inHouse = Object.entries(counts).filter(([k]) => !["sold", "donated", "to_partner", "destroyed", "returned", "void"].includes(k)).reduce((t, [, n]) => t + n, 0);

  return (
    <div className="stack">
      <h1 className="adm-h1">Dashboard</h1>
      <div className="adm-stats">
        <div className="panel"><div className="num">{jobs.filter((j) => j.status === "new").length}</div><div className="lbl">New requests</div></div>
        <div className="panel"><div className="num">{jobs.length}</div><div className="lbl">Open jobs</div></div>
        <div className="panel"><div className="num">{inHouse}</div><div className="lbl">Devices in custody</div></div>
        <div className="panel"><div className="num">{pendingMedia}</div><div className="lbl">Drives awaiting wipe</div></div>
        <div className="panel"><div className="num">{owed.toLocaleString("en-US", { style: "currency", currency: "USD" })}</div><div className="lbl">Client payouts owed</div></div>
      </div>

      {partners.filter((p) => soon(p.r2_cert_expiry)).map((p) => (
        <p key={p.name} className="adm-warn">⚠ {p.name}: R2v3 certificate {p.r2_cert_expiry ? `expires ${fmtDate(p.r2_cert_expiry)}` : "not on file"}. Transfers are blocked until it&apos;s current. <Link href="/admin/partners">Update partner</Link></p>
      ))}

      <div className="panel">
        <div className="adm-row-head"><h2 className="mt0">Open jobs</h2><Link href="/admin/jobs?new=1" className="btn btn-primary">+ New job</Link></div>
        <table className="adm-table">
          <thead><tr><th>Job</th><th>Client</th><th>Status</th><th>Flags</th><th>Requested</th><th>Created</th></tr></thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td><Link href={`/admin/jobs/${j.id}`}>{j.job_number}</Link></td>
                <td>{j.business_name || j.contact_name}<div className="form-note">{j.client_type} · {j.source}</div></td>
                <td><StatusPill s={j.status} /></td>
                <td>{j.regulatory_flags?.join(", ") || "—"}</td>
                <td>{fmtDate(j.preferred_date)}</td>
                <td>{fmtDate(j.created_at)}</td>
              </tr>
            ))}
            {!jobs.length && <tr><td colSpan={6} className="form-note">No open jobs.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
