"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sb, fmtDate, toCsv, downloadText } from "@/lib/itad/db";
import { StatusPill } from "@/components/admin/AdminShell";

/* eslint-disable @typescript-eslint/no-explicit-any */
const STATUSES = ["all", "collected", "received", "awaiting_sanitization", "sanitized", "refurbishing", "ready_for_sale", "listed", "sold", "donated", "to_partner", "destroyed", "returned", "void"];

export default function AssetsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  useEffect(() => {
    sb().from("itad_assets").select("*, itad_jobs(job_number, business_name, contact_name)").order("created_at", { ascending: false }).limit(2000)
      .then(({ data }) => setRows(data ?? []));
  }, []);
  const shown = rows.filter((a) => (status === "all" || a.status === status) &&
    (!q || [a.asset_tag, a.serial_number, a.client_asset_tag, a.make, a.model, a.itad_jobs?.job_number, a.itad_jobs?.business_name].join(" ").toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="stack">
      <div className="adm-row-head"><h1 className="adm-h1">Devices</h1>
        <button className="btn btn-outline" onClick={() => downloadText("itad-devices.csv", toCsv(shown.map(({ itad_jobs, ...r }) => ({ ...r, job_number: itad_jobs?.job_number }))))}>Export CSV</button></div>
      <div className="adm-actions">
        <input type="text" placeholder="Search serial, tag, model, job…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 360 }} autoFocus />
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 220 }}>{STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select>
      </div>
      <table className="adm-table">
        <thead><tr><th>Tag</th><th>Device</th><th>Serial</th><th>Grade</th><th>Status</th><th>Job</th><th>Logged</th></tr></thead>
        <tbody>{shown.map((a) => (
          <tr key={a.id}>
            <td><Link href={`/admin/assets/${a.id}`}>{a.asset_tag}</Link></td>
            <td>{a.device_type} {[a.make, a.model].filter(Boolean).join(" ")}</td>
            <td className="mono">{a.serial_number || "—"}</td>
            <td>{a.grade || "—"}</td>
            <td><StatusPill s={a.status} /></td>
            <td><Link href={`/admin/jobs/${a.job_id}`}>{a.itad_jobs?.job_number}</Link><div className="form-note">{a.itad_jobs?.business_name || a.itad_jobs?.contact_name}</div></td>
            <td>{fmtDate(a.created_at)}</td>
          </tr>
        ))}{!shown.length && <tr><td colSpan={7} className="form-note">No devices.</td></tr>}</tbody>
      </table>
    </div>
  );
}
