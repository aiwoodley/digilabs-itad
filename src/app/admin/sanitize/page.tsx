"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sb, fmtDate, addDocument, errMsg } from "@/lib/itad/db";
import { useAdmin, Msg } from "@/components/admin/AdminShell";

/* eslint-disable @typescript-eslint/no-explicit-any */
const TECHNIQUES: Record<string, string[]> = {
  clear: ["Single-pass overwrite", "ATA/NVMe format (user data)", "Factory reset (mobile, encrypted)"],
  purge: ["Cryptographic erase", "ATA Secure Erase (Enhanced)", "NVMe Sanitize (block/crypto)", "Degauss"],
  destroy: ["Shred", "Crush / punch", "Disintegrate", "Sent to partner for shredding"],
};

export default function SanitizeQueue() {
  const admin = useAdmin();
  const [rows, setRows] = useState<any[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [f, setF] = useState({ nist_method: "purge", technique: TECHNIQUES.purge[0], tool: "", tool_version: "", result: "pass", verification: "Verified by tool report", notes: "" });
  const [logFile, setLogFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await sb().from("itad_storage_media").select("*, itad_assets(asset_tag, device_type, make, model, serial_number, lock_status), itad_jobs(job_number, business_name, contact_name)")
      .in("status", ["pending", "failed"]).order("created_at");
    setRows(data ?? []); setSel([]);
  }
  useEffect(() => { load(); }, []);

  async function record(e: React.FormEvent) {
    e.preventDefault();
    if (!sel.length) return setMsg({ ok: false, t: "Select at least one drive." });
    setBusy(true); setMsg(null);
    let ok = 0; const errs: string[] = [];
    let logId: string | null = null;
    try {
      if (logFile) {
        const first = rows.find((r) => r.id === sel[0]);
        logId = (await addDocument({ file: logFile, fileName: logFile.name, docType: "wipe_log", jobId: first.job_id, uploadedBy: admin.name })).id;
      }
    } catch (err) { errs.push("Log upload: " + errMsg(err)); }
    for (const id of sel) {
      const { error } = await sb().from("itad_sanitization").insert({ media_id: id, ...f, tool: f.tool || null, tool_version: f.tool_version || null, notes: f.notes || null, technician: admin.name, log_doc_id: logId });
      if (error) errs.push(`${rows.find((r) => r.id === id)?.media_tag}: ${error.message}`); else ok++;
    }
    setMsg({ ok: errs.length === 0, t: `${ok} drive(s) recorded.${errs.length ? " Problems: " + errs.join(" · ") : ""}` });
    setLogFile(null); setBusy(false); load();
  }

  return (
    <div className="stack">
      <h1 className="adm-h1">Wipe queue</h1>
      <p className="form-note mt0">Every drive needs a passing NIST 800-88 record before its job can get a certificate. Records are permanent. If a wipe fails, record the failure, then record the destruction.</p>
      <table className="adm-table">
        <thead><tr><th><input type="checkbox" checked={sel.length === rows.length && rows.length > 0} onChange={(e) => setSel(e.target.checked ? rows.map((r) => r.id) : [])} /></th><th>Drive</th><th>Serial</th><th>In device</th><th>Job</th><th>Status</th><th>Logged</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id}>
            <td><input type="checkbox" checked={sel.includes(r.id)} onChange={(e) => setSel(e.target.checked ? [...sel, r.id] : sel.filter((x) => x !== r.id))} /></td>
            <td>{r.media_tag} · {r.media_type?.toUpperCase()} {r.capacity_gb ? `${r.capacity_gb}GB` : ""}</td>
            <td className="mono">{r.media_serial || "—"}</td>
            <td>{r.itad_assets ? <Link href={`/admin/assets/${r.asset_id}`}>{r.itad_assets.asset_tag} {r.itad_assets.make} {r.itad_assets.model}</Link> : "loose"}{r.itad_assets?.lock_status === "locked" ? " ⚠ locked" : ""}</td>
            <td><Link href={`/admin/jobs/${r.job_id}`}>{r.itad_jobs?.job_number}</Link></td>
            <td>{r.status}</td>
            <td>{fmtDate(r.created_at)}</td>
          </tr>
        ))}{!rows.length && <tr><td colSpan={7} className="form-note">Nothing waiting.</td></tr>}</tbody>
      </table>

      <form className="panel stack" onSubmit={record}>
        <h2 className="mt0">Record result for {sel.length} selected drive(s)</h2>
        <div className="adm-grid4">
          <div className="field"><label>NIST 800-88 method</label>
            <select value={f.nist_method} onChange={(e) => setF({ ...f, nist_method: e.target.value, technique: TECHNIQUES[e.target.value][0] })}><option value="clear">Clear</option><option value="purge">Purge</option><option value="destroy">Destroy</option></select></div>
          <div className="field"><label>Technique</label>
            <select value={f.technique} onChange={(e) => setF({ ...f, technique: e.target.value })}>{TECHNIQUES[f.nist_method].map((t) => <option key={t}>{t}</option>)}</select></div>
          <div className="field"><label>Tool</label><input type="text" placeholder="e.g. Blancco, ShredOS/nwipe, Parted Magic" value={f.tool} onChange={(e) => setF({ ...f, tool: e.target.value })} /></div>
          <div className="field"><label>Tool version</label><input type="text" value={f.tool_version} onChange={(e) => setF({ ...f, tool_version: e.target.value })} /></div>
        </div>
        <div className="adm-grid4">
          <div className="field"><label>Result</label><select value={f.result} onChange={(e) => setF({ ...f, result: e.target.value })}><option value="pass">Pass</option><option value="fail">Fail</option></select></div>
          <div className="field"><label>Verification</label><input type="text" value={f.verification} onChange={(e) => setF({ ...f, verification: e.target.value })} /></div>
          <div className="field"><label>Notes</label><input type="text" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <label className="btn btn-outline">{logFile ? logFile.name : "Attach tool report"}<input type="file" hidden onChange={(e) => setLogFile(e.target.files?.[0] ?? null)} /></label>
        </div>
        <button className="btn btn-primary" disabled={busy}>Record</button>
        <Msg m={msg} />
      </form>
    </div>
  );
}
