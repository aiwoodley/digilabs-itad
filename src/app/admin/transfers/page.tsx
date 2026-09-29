"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sb, fmtDate, addDocument, signedUrl, errMsg, toCsv, downloadText } from "@/lib/itad/db";
import { useAdmin, Msg, StatusPill } from "@/components/admin/AdminShell";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function TransfersPage() {
  const admin = useAdmin();
  const [partners, setPartners] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [eligible, setEligible] = useState<any[]>([]);
  const [loose, setLoose] = useState<any[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [selMedia, setSelMedia] = useState<string[]>([]);
  const [f, setF] = useState({ partner_id: "", transfer_date: new Date().toISOString().slice(0, 10), total_weight_lbs: "", pallet_count: "", bol_number: "", vehicle: "", notes: "", misc: "" });
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  async function load() {
    const [p, t, a, m] = await Promise.all([
      sb().from("itad_partners").select("*").eq("active", true).order("name"),
      sb().from("itad_transfers").select("*, itad_partners(name), itad_transfer_items(id), itad_documents(id, doc_type, file_name, storage_path)").order("created_at", { ascending: false }),
      sb().from("itad_assets").select("id, asset_tag, device_type, make, model, serial_number, status, disposition, itad_jobs(job_number)").in("status", ["received", "sanitized", "awaiting_sanitization"]).order("created_at"),
      sb().from("itad_storage_media").select("id, media_tag, media_serial, media_type, status, asset_id, itad_jobs(job_number)").in("status", ["pending", "failed", "sanitized"]).order("created_at"),
    ]);
    setPartners(p.data ?? []); setTransfers(t.data ?? []); setEligible(a.data ?? []); setLoose(m.data ?? []);
    if (!f.partner_id && p.data?.[0]) setF((x) => ({ ...x, partner_id: p.data![0].id }));
    setSel([]); setSelMedia([]);
  }
  useEffect(() => { load(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const must = (r: { data?: any; error: any }) => { if (r.error) throw new Error(r.error.message); return r.data; };

  async function create(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    try {
      if (!sel.length && !selMedia.length && !f.misc) throw new Error("Select devices/drives or describe bulk material.");
      const t = must(await sb().from("itad_transfers").insert({
        partner_id: f.partner_id, status: "draft", transfer_date: f.transfer_date || null, total_weight_lbs: f.total_weight_lbs || null,
        pallet_count: f.pallet_count || null, bol_number: f.bol_number || null, vehicle: f.vehicle || null, notes: f.notes || null,
        item_count: sel.length + selMedia.length,
      }).select().single());
      const items = [...sel.map((id) => ({ transfer_id: t.id, asset_id: id })), ...selMedia.map((id) => ({ transfer_id: t.id, media_id: id }))];
      if (f.misc) items.push({ transfer_id: t.id, description: f.misc } as any);
      must(await sb().from("itad_transfer_items").insert(items));
      setMsg({ ok: true, t: `Manifest ${t.transfer_number} created as draft. Mark it shipped when it leaves.` });
      load();
    } catch (err) { setMsg({ ok: false, t: errMsg(err) }); }
  }

  async function ship(t: any) {
    setMsg(null);
    try {
      must(await sb().from("itad_transfers").update({ status: "shipped" }).eq("id", t.id));
      const items = must(await sb().from("itad_transfer_items").select("asset_id, media_id").eq("transfer_id", t.id));
      const aIds = items.map((i: any) => i.asset_id).filter(Boolean);
      const mIds = items.map((i: any) => i.media_id).filter(Boolean);
      if (aIds.length) must(await sb().from("itad_assets").update({ status: "to_partner", disposition: "recycle", location: t.itad_partners?.name }).in("id", aIds));
      if (mIds.length) must(await sb().from("itad_storage_media").update({ status: "to_partner" }).in("id", mIds));
      must(await sb().from("itad_custody_events").insert({ transfer_id: t.id, event_type: "transferred_to_partner", actor: admin.name, counterparty: t.itad_partners?.name, notes: `${t.transfer_number}: ${items.length} line(s) shipped${t.total_weight_lbs ? `, ${t.total_weight_lbs} lbs` : ""}.` }));
      setMsg({ ok: true, t: `${t.transfer_number} marked shipped.` }); load();
    } catch (err) { setMsg({ ok: false, t: errMsg(err) }); }
  }

  async function receive(t: any) {
    const name = prompt("Received by (name at partner)?"); if (!name) return;
    const cert = prompt("Partner's certificate of recycling/destruction number (leave blank if not issued yet)?") ?? "";
    try {
      must(await sb().from("itad_transfers").update({ status: cert ? "certified" : "received_by_partner", received_by_name: name, partner_cert_number: cert || null, partner_cert_date: cert ? new Date().toISOString().slice(0, 10) : null }).eq("id", t.id));
      must(await sb().from("itad_custody_events").insert({ transfer_id: t.id, event_type: "note", actor: admin.name, counterparty: name, notes: `${t.transfer_number} received by ${name} at ${t.itad_partners?.name}${cert ? `; partner cert ${cert}` : ""}.` }));
      load();
    } catch (err) { setMsg({ ok: false, t: errMsg(err) }); }
  }

  async function upload(t: any, file: File, docType: string) {
    try { await addDocument({ file, fileName: file.name, docType, transferId: t.id, uploadedBy: admin.name }); setMsg({ ok: true, t: "Uploaded." }); load(); }
    catch (err) { setMsg({ ok: false, t: errMsg(err) }); }
  }

  const partner = partners.find((p) => p.id === f.partner_id);
  const expired = partner && (!partner.r2_cert_expiry || new Date(partner.r2_cert_expiry) < new Date());

  return (
    <div className="stack">
      <div className="adm-row-head"><h1 className="adm-h1">Transfers to recycler</h1>
        <button className="btn btn-outline" onClick={() => downloadText("itad-transfers.csv", toCsv(transfers.map(({ itad_partners, itad_transfer_items, itad_documents, ...r }) => ({ ...r, partner: itad_partners?.name, lines: itad_transfer_items?.length }))))}>Export CSV</button></div>
      <Msg m={msg} />
      <table className="adm-table">
        <thead><tr><th>Manifest</th><th>Partner</th><th>Date</th><th>Lines</th><th>Weight</th><th>Status</th><th>Partner cert</th><th>Docs</th><th /></tr></thead>
        <tbody>{transfers.map((t) => (
          <tr key={t.id}>
            <td>{t.transfer_number}</td><td>{t.itad_partners?.name}</td><td>{fmtDate(t.transfer_date)}</td><td>{t.itad_transfer_items?.length ?? 0}</td>
            <td>{t.total_weight_lbs ? `${t.total_weight_lbs} lbs` : "—"}</td><td><StatusPill s={t.status} /></td><td>{t.partner_cert_number || "—"}</td>
            <td>{(t.itad_documents ?? []).map((d: any) => <div key={d.id}><button className="link-btn" onClick={async () => window.open(await signedUrl(d.storage_path), "_blank")}>{d.doc_type.replace(/_/g, " ")}</button></div>)}
              <label className="link-btn">+ cert<input type="file" hidden onChange={(e) => { const x = e.target.files?.[0]; if (x) upload(t, x, "recycling_cert"); }} /></label>{" "}
              <label className="link-btn">+ weight ticket<input type="file" hidden onChange={(e) => { const x = e.target.files?.[0]; if (x) upload(t, x, "weight_ticket"); }} /></label>{" "}
              <label className="link-btn">+ BOL<input type="file" hidden onChange={(e) => { const x = e.target.files?.[0]; if (x) upload(t, x, "bol"); }} /></label></td>
            <td>{t.status === "draft" && <button className="btn btn-outline" onClick={() => ship(t)}>Mark shipped</button>}
              {t.status === "shipped" && <button className="btn btn-outline" onClick={() => receive(t)}>Partner received</button>}
              {t.status === "received_by_partner" && <button className="btn btn-outline" onClick={() => receive(t)}>Add partner cert #</button>}</td>
          </tr>
        ))}{!transfers.length && <tr><td colSpan={9} className="form-note">No transfers yet.</td></tr>}</tbody>
      </table>

      <form className="panel stack" onSubmit={create}>
        <h2 className="mt0">New manifest</h2>
        {expired && <p className="adm-warn">{partner.name} has no current R2v3 certificate on file. You can draft this, but it can&apos;t be marked shipped until you <Link href="/admin/partners">update the partner</Link>.</p>}
        <div className="adm-grid4">
          <div className="field"><label>Partner</label><select value={f.partner_id} onChange={(e) => setF({ ...f, partner_id: e.target.value })}>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div className="field"><label>Date</label><input type="date" value={f.transfer_date} onChange={(e) => setF({ ...f, transfer_date: e.target.value })} /></div>
          <div className="field"><label>Total weight (lbs)</label><input type="number" value={f.total_weight_lbs} onChange={(e) => setF({ ...f, total_weight_lbs: e.target.value })} /></div>
          <div className="field"><label>Pallets / boxes</label><input type="number" value={f.pallet_count} onChange={(e) => setF({ ...f, pallet_count: e.target.value })} /></div>
          <div className="field"><label>BOL #</label><input type="text" value={f.bol_number} onChange={(e) => setF({ ...f, bol_number: e.target.value })} /></div>
          <div className="field"><label>Vehicle</label><input type="text" value={f.vehicle} onChange={(e) => setF({ ...f, vehicle: e.target.value })} /></div>
          <div className="field"><label>Bulk material (no serials)</label><input type="text" placeholder="e.g. 40 lbs cables, 3 CRTs" value={f.misc} onChange={(e) => setF({ ...f, misc: e.target.value })} /></div>
          <div className="field"><label>Notes</label><input type="text" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <h3>Devices ({sel.length} selected)</h3>
        <table className="adm-table"><tbody>{eligible.map((a) => (
          <tr key={a.id}><td><input type="checkbox" checked={sel.includes(a.id)} onChange={(e) => setSel(e.target.checked ? [...sel, a.id] : sel.filter((x) => x !== a.id))} /></td>
            <td>{a.asset_tag}</td><td>{a.device_type} {a.make} {a.model}</td><td className="mono">{a.serial_number}</td><td>{a.status}</td><td>{a.itad_jobs?.job_number}</td></tr>
        ))}{!eligible.length && <tr><td className="form-note">No devices waiting.</td></tr>}</tbody></table>
        <h3>Drives for partner shredding ({selMedia.length} selected)</h3>
        <table className="adm-table"><tbody>{loose.map((m) => (
          <tr key={m.id}><td><input type="checkbox" checked={selMedia.includes(m.id)} onChange={(e) => setSelMedia(e.target.checked ? [...selMedia, m.id] : selMedia.filter((x) => x !== m.id))} /></td>
            <td>{m.media_tag}</td><td>{m.media_type}</td><td className="mono">{m.media_serial}</td><td>{m.status}</td><td>{m.itad_jobs?.job_number}</td></tr>
        ))}{!loose.length && <tr><td className="form-note">No drives waiting.</td></tr>}</tbody></table>
        <p className="form-note mb0">Drives sent to the partner for shredding still need a Destroy record in the Wipe queue once their certificate comes back, so the client certificate can list them.</p>
        <button className="btn btn-primary">Create draft manifest</button>
      </form>
    </div>
  );
}
