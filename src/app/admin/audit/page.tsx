"use client";

import { Fragment, useEffect, useState } from "react";
import { sb, fmtDateTime, toCsv, downloadText } from "@/lib/itad/db";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function AuditPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [admins, setAdmins] = useState<Record<string, string>>({});
  const [table, setTable] = useState("all");
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    sb().from("itad_admins").select("user_id, display_name").then(({ data }) => setAdmins(Object.fromEntries((data ?? []).map((a) => [a.user_id, a.display_name]))));
  }, []);
  useEffect(() => {
    let qb = sb().from("itad_audit_log").select("*").order("id", { ascending: false }).limit(500);
    if (table !== "all") qb = qb.eq("table_name", table);
    qb.then(({ data }) => setRows(data ?? []));
  }, [table]);

  const changed = (r: any) => {
    if (r.action !== "UPDATE" || !r.old_row || !r.new_row) return "";
    return Object.keys(r.new_row).filter((k) => k !== "updated_at" && JSON.stringify(r.old_row[k]) !== JSON.stringify(r.new_row[k])).join(", ");
  };
  const label = (r: any) => { const x = r.new_row ?? r.old_row ?? {}; return x.job_number || x.asset_tag || x.media_tag || x.transfer_number || x.certificate_number || x.name || x.event_type || ""; };

  return (
    <div className="stack">
      <div className="adm-row-head"><h1 className="adm-h1">Audit log</h1>
        <button className="btn btn-outline" onClick={() => downloadText("itad-audit.csv", toCsv(rows))}>Export CSV</button></div>
      <p className="form-note mt0">Every insert and change to ITAD records, written by the database itself. It can&apos;t be edited or deleted.</p>
      <select value={table} onChange={(e) => setTable(e.target.value)} style={{ maxWidth: 240 }}>
        {["all", "itad_jobs", "itad_assets", "itad_storage_media", "itad_sanitization", "itad_custody_events", "itad_transfers", "itad_certificates", "itad_documents", "itad_signatures", "itad_sales", "itad_partners"].map((t) => <option key={t}>{t}</option>)}
      </select>
      <table className="adm-table">
        <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Changed</th></tr></thead>
        <tbody>{rows.map((r) => (
          <Fragment key={r.id}>
            <tr onClick={() => setOpen(open === r.id ? null : r.id)} style={{ cursor: "pointer" }}>
              <td className="mono">{fmtDateTime(r.at)}</td><td>{r.actor ? admins[r.actor] ?? "user" : "website / system"}</td>
              <td>{r.action}</td><td>{r.table_name.replace("itad_", "")} {label(r)}</td><td>{changed(r)}</td>
            </tr>
            {open === r.id && <tr><td colSpan={5}><pre className="adm-pre">{JSON.stringify({ before: r.old_row, after: r.new_row }, null, 2)}</pre></td></tr>}
          </Fragment>
        ))}</tbody>
      </table>
    </div>
  );
}
