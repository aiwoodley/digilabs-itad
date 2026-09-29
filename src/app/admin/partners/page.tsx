"use client";

import { useEffect, useState } from "react";
import { sb, fmtDate, addDocument, signedUrl, errMsg } from "@/lib/itad/db";
import { useAdmin, Msg } from "@/components/admin/AdminShell";

/* eslint-disable @typescript-eslint/no-explicit-any */
const blank = { name: "", services: "", r2_cert_number: "", r2_cert_expiry: "", naid_cert_number: "", naid_cert_expiry: "", other_certs: "", contact_name: "", contact_phone: "", contact_email: "", address: "", notes: "", active: true };

export default function PartnersPage() {
  const admin = useAdmin();
  const [rows, setRows] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  async function load() {
    const { data } = await sb().from("itad_partners").select("*, itad_documents(id, doc_type, file_name, storage_path, created_at)").order("name");
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const { itad_documents, id, created_at, ...p } = edit;  // eslint-disable-line @typescript-eslint/no-unused-vars
    Object.keys(p).forEach((k) => { if (p[k] === "") p[k] = null; });
    const { error } = id ? await sb().from("itad_partners").update(p).eq("id", id) : await sb().from("itad_partners").insert(p);
    if (error) return setMsg({ ok: false, t: errMsg(error) });
    setMsg({ ok: true, t: "Partner saved." }); setEdit(null); load();
  }
  async function upload(p: any, f: File) {
    try { await addDocument({ file: f, fileName: f.name, docType: "partner_cert", partnerId: p.id, uploadedBy: admin.name }); setMsg({ ok: true, t: "Certificate uploaded." }); load(); }
    catch (err) { setMsg({ ok: false, t: errMsg(err) }); }
  }
  const expiring = (d: string | null) => !d ? "missing" : new Date(d) < new Date() ? "expired" : new Date(d).getTime() - Date.now() < 60 * 864e5 ? "soon" : "ok";

  const F = (k: string, label: string, type = "text") => (
    <div className="field"><label>{label}</label><input type={type} value={edit[k] ?? ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></div>
  );

  return (
    <div className="stack">
      <div className="adm-row-head"><h1 className="adm-h1">Downstream partners</h1><button className="btn btn-primary" onClick={() => setEdit({ ...blank })}>+ Add partner</button></div>
      <Msg m={msg} />
      <p className="form-note mt0">Shipments are blocked to any partner without a current R2v3 certificate on file. Verify the number on the SERI public directory and upload their certificate PDF.</p>
      {rows.map((p) => (
        <div className="panel" key={p.id}>
          <div className="adm-row-head"><h2 className="mt0">{p.name}{!p.active && " (inactive)"}</h2><button className="btn btn-outline" onClick={() => setEdit({ ...p })}>Edit</button></div>
          <dl className="adm-dl">
            <dt>Services</dt><dd>{p.services || "—"}</dd>
            <dt>R2v3</dt><dd>{p.r2_cert_number || "—"} · expires {fmtDate(p.r2_cert_expiry)} <span className={`pill pill-${expiring(p.r2_cert_expiry)}`}>{expiring(p.r2_cert_expiry)}</span></dd>
            <dt>NAID AAA</dt><dd>{p.naid_cert_number || "—"} · expires {fmtDate(p.naid_cert_expiry)}</dd>
            <dt>Other</dt><dd>{p.other_certs || "—"}</dd>
            <dt>Contact</dt><dd>{[p.contact_name, p.contact_phone, p.contact_email].filter(Boolean).join(" · ") || "—"}</dd>
            <dt>Address</dt><dd>{p.address || "—"}</dd>
            <dt>Notes</dt><dd>{p.notes || "—"}</dd>
            <dt>Cert files</dt><dd>{(p.itad_documents ?? []).map((d: any) => <div key={d.id}><button className="link-btn" onClick={async () => window.open(await signedUrl(d.storage_path), "_blank")}>{d.file_name}</button> · {fmtDate(d.created_at)}</div>)}
              <label className="link-btn">+ upload certificate<input type="file" hidden accept="application/pdf,image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(p, f); }} /></label></dd>
          </dl>
        </div>
      ))}
      {edit && (
        <form className="panel stack" onSubmit={save}>
          <h2 className="mt0">{edit.id ? `Edit ${edit.name}` : "New partner"}</h2>
          <div className="row2">{F("name", "Name")}{F("services", "Services")}</div>
          <div className="row2">{F("r2_cert_number", "R2v3 cert #")}{F("r2_cert_expiry", "R2v3 expiry", "date")}</div>
          <div className="row2">{F("naid_cert_number", "NAID AAA cert #")}{F("naid_cert_expiry", "NAID expiry", "date")}</div>
          {F("other_certs", "Other certifications")}
          <div className="row2">{F("contact_name", "Contact")}{F("contact_phone", "Phone")}</div>
          <div className="row2">{F("contact_email", "Email")}{F("address", "Address")}</div>
          <div className="field"><label>Notes</label><textarea value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></div>
          <label className="checkline"><input type="checkbox" checked={!!edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />Active</label>
          <div className="adm-actions"><button className="btn btn-primary">Save</button><button type="button" className="btn btn-outline" onClick={() => setEdit(null)}>Cancel</button></div>
        </form>
      )}
    </div>
  );
}
