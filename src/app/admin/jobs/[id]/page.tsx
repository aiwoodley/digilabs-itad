"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { sb, fmtDate, fmtDateTime, money, addDocument, signedUrl, sha256Hex, uploadFile, errMsg, toCsv, downloadText } from "@/lib/itad/db";
import { buildCertificatePdf, type CertSnapshot } from "@/lib/itad/certificate";
import { useAdmin, Msg, StatusPill } from "@/components/admin/AdminShell";
import { SignaturePad } from "@/components/admin/SignaturePad";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
const JOB_STATUSES = ["new", "quoted", "scheduled", "picked_up", "received", "processing", "closed", "cancelled"];
const DOC_TYPES = ["service_agreement", "baa", "work_order", "asset_release", "lease_release", "quote", "invoice", "photo", "wipe_log", "other"];
const DEVICE_TYPES = ["Laptop", "Desktop", "All-in-one", "Server", "Monitor", "Phone", "Tablet", "Switch", "Router/Firewall", "Access point", "Printer", "Loose drive", "UPS", "Other"];

const CUSTODY_STATEMENT = (job: Row, n: number, who: string) =>
  `I confirm that ${n} device(s) listed on job ${job.job_number} were released by ${job.business_name || job.contact_name} and received into DigiLabs ITAD custody on ${new Date().toLocaleString("en-US")} (collected by ${who}). The client authorizes DigiLabs ITAD to sanitize or destroy all data and to refurbish, resell, donate or recycle the equipment.`;

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const admin = useAdmin();
  const [job, setJob] = useState<Row | null>(null);
  const [lines, setLines] = useState<Row[]>([]);
  const [assets, setAssets] = useState<Row[]>([]);
  const [media, setMedia] = useState<Row[]>([]);
  const [docs, setDocs] = useState<Row[]>([]);
  const [sigs, setSigs] = useState<Row[]>([]);
  const [events, setEvents] = useState<Row[]>([]);
  const [certs, setCerts] = useState<Row[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [edit, setEdit] = useState<Row>({});
  const [sigFor, setSigFor] = useState<null | "client" | "digilabs">(null);
  const [signerName, setSignerName] = useState("");
  const [busy, setBusy] = useState(false);

  const blankAsset = { device_type: "Laptop", make: "", model: "", serial_number: "", client_asset_tag: "", has_storage: true, lock_status: "none", third_party_config: false, grade: "", condition_notes: "", location: "Van", status: "collected", drive_serial: "", drive_type: "ssd", drive_gb: "" };
  const [na, setNa] = useState<Row>(blankAsset);

  const load = useCallback(async () => {
    const [j, l, a, m, d, s, e, c] = await Promise.all([
      sb().from("itad_jobs").select("*").eq("id", id).single(),
      sb().from("itad_job_lines").select("*").eq("job_id", id).order("line_number"),
      sb().from("itad_assets").select("*").eq("job_id", id).order("created_at"),
      sb().from("itad_storage_media").select("*, itad_sanitization(*)").eq("job_id", id).order("created_at"),
      sb().from("itad_documents").select("*").eq("job_id", id).order("created_at", { ascending: false }),
      sb().from("itad_signatures").select("*").eq("job_id", id).order("signed_at"),
      sb().from("itad_custody_events").select("*").eq("job_id", id).order("occurred_at", { ascending: false }),
      sb().from("itad_certificates").select("*").eq("job_id", id).order("issued_at", { ascending: false }),
    ]);
    setJob(j.data); setEdit(j.data ?? {});
    setLines(l.data ?? []); setAssets(a.data ?? []); setMedia(m.data ?? []); setDocs(d.data ?? []);
    setSigs(s.data ?? []); setEvents(e.data ?? []); setCerts(c.data ?? []);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, t: ok }); await load(); } catch (e) { setMsg({ ok: false, t: errMsg(e) }); }
    setBusy(false);
  };
  const must = <T,>(r: { data: T; error: any }) => { if (r.error) throw new Error(r.error.message); return r.data; };

  if (!job) return <p>Loading…</p>;

  const saveJob = () => act(async () => {
    const fields = ["status", "quote_amount", "trip_fee", "per_drive_fee", "payout_pct", "scheduled_for", "assigned_to", "internal_notes", "baa_required", "equipment_leased", "lessor_name", "po_number"];
    const patch: Row = {};
    fields.forEach((f) => { patch[f] = edit[f] === "" ? null : edit[f]; });
    must(await sb().from("itad_jobs").update(patch).eq("id", id));
  }, "Job saved.");

  const addAsset = (e: React.FormEvent) => {
    e.preventDefault();
    act(async () => {
      const a = must(await sb().from("itad_assets").insert({
        job_id: id, device_type: na.device_type, make: na.make || null, model: na.model || null,
        serial_number: na.serial_number.trim() || null, client_asset_tag: na.client_asset_tag || null, has_storage: na.has_storage,
        lock_status: na.lock_status, third_party_config: na.third_party_config, grade: na.grade || null,
        condition_notes: na.condition_notes || null, location: na.location || null, status: na.status, created_by: admin.name,
      }).select().single()) as Row;
      if (na.has_storage && (na.drive_serial || na.drive_type)) {
        must(await sb().from("itad_storage_media").insert({ job_id: id, asset_id: a.id, media_serial: na.drive_serial || null, media_type: na.drive_type, capacity_gb: na.drive_gb || null }));
      }
      setNa({ ...blankAsset, device_type: na.device_type, make: na.make, location: na.location, status: na.status });
    }, "Device logged.");
  };

  const uploadDoc = (file: File, docType: string) =>
    act(async () => { await addDocument({ file, fileName: file.name, docType, jobId: id, uploadedBy: admin.name }); }, "Document uploaded.");
  const openDoc = async (path: string) => { try { window.open(await signedUrl(path), "_blank"); } catch (e) { setMsg({ ok: false, t: errMsg(e) }); } };

  const saveSignature = (png: Blob) => act(async () => {
    const role = sigFor!;
    const statement = role === "client"
      ? CUSTODY_STATEMENT(job, assets.filter((a) => a.status !== "void").length, admin.name)
      : `DigiLabs ITAD representative ${signerName} accepts custody of the devices listed on job ${job.job_number}.`;
    const path = `jobs/${id}/signatures/${Date.now()}-${role}.png`;
    await uploadFile(path, png, "image/png");
    const sig = must(await sb().from("itad_signatures").insert({
      job_id: id, signer_name: signerName, signer_role: role, purpose: "custody_release", statement,
      statement_sha256: await sha256Hex(statement + "|" + assets.map((a) => a.asset_tag + ":" + (a.serial_number ?? "")).join(",")),
      image_path: path, user_agent: navigator.userAgent, collected_by: admin.name,
    }).select().single()) as Row;
    must(await sb().from("itad_custody_events").insert({ job_id: id, event_type: "collected", actor: admin.name, counterparty: signerName, signature_id: sig.id, notes: `${role === "client" ? "Client" : "DigiLabs"} signed custody release for ${assets.length} device(s).` }));
    setSigFor(null); setSignerName("");
  }, "Signature saved.");

  const markAll = (from: string, to: string, location: string) => act(async () => {
    const ids = assets.filter((a) => a.status === from).map((a) => a.id);
    if (!ids.length) throw new Error(`No devices in "${from}" status.`);
    must(await sb().from("itad_assets").update({ status: to, location }).in("id", ids));
    if (to === "received" && ["new", "quoted", "scheduled", "picked_up"].includes(job.status)) must(await sb().from("itad_jobs").update({ status: "received" }).eq("id", id));
  }, `Updated ${from} → ${to}.`);

  const issueCert = () => act(async () => {
    const live = assets.filter((a) => a.status !== "void");
    const byId = Object.fromEntries(assets.map((a) => [a.id, a]));
    const tr = must(await sb().from("itad_transfer_items").select("itad_transfers(transfer_number, transfer_date, partner_cert_number, status, itad_partners(name, r2_cert_number))").in("asset_id", live.map((a) => a.id).concat(["00000000-0000-0000-0000-000000000000"]))) as Row[];
    const trMap: Record<string, Row> = {};
    tr.forEach((t) => { const x = t.itad_transfers; if (x && x.status !== "void") trMap[x.transfer_number] = x; });
    const snapshot: Omit<CertSnapshot, "certificate_number" | "issued_at"> = {
      issued_by: admin.name,
      job: { job_number: job.job_number, client_type: job.client_type, business_name: job.business_name, contact_name: job.contact_name, address: job.address, city: job.city, state: job.state, zip: job.zip, po_number: job.po_number },
      assets: live.map((a) => ({ asset_tag: a.asset_tag, device_type: a.device_type, make: a.make, model: a.model, serial_number: a.serial_number, client_asset_tag: a.client_asset_tag, disposition: a.disposition, status: a.status })),
      media: media.filter((m) => m.status !== "void").map((m) => {
        const s = (m.itad_sanitization ?? []).filter((x: Row) => x.result === "pass").sort((a: Row, b: Row) => b.performed_at.localeCompare(a.performed_at))[0] ?? {};
        return { media_tag: m.media_tag, asset_tag: byId[m.asset_id]?.asset_tag ?? null, media_serial: m.media_serial, media_type: m.media_type, nist_method: s.nist_method ?? "pending", technique: s.technique ?? "", tool: s.tool ?? null, result: s.result ?? "pending", performed_at: s.performed_at ?? new Date().toISOString(), technician: s.technician ?? "" };
      }),
      transfers: Object.values(trMap).map((t) => ({ transfer_number: t.transfer_number, partner: t.itad_partners?.name ?? "", r2_cert_number: t.itad_partners?.r2_cert_number ?? null, partner_cert_number: t.partner_cert_number, transfer_date: t.transfer_date })),
    };
    const hash = await sha256Hex(JSON.stringify(snapshot));
    const cert = must(await sb().from("itad_certificates").insert({ job_id: id, issued_by: admin.name, snapshot, snapshot_sha256: hash }).select().single()) as Row;
    const full: CertSnapshot = { ...snapshot, certificate_number: cert.certificate_number, issued_at: cert.issued_at };
    const dlSig = [...sigs].reverse().find((s) => s.signer_role === "digilabs");
    let sigPng: ArrayBuffer | null = null;
    if (dlSig) { try { sigPng = await (await fetch(await signedUrl(dlSig.image_path))).arrayBuffer(); } catch { sigPng = null; } }
    const bytes = await buildCertificatePdf(full, hash, sigPng);
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    await addDocument({ file: blob, fileName: `${cert.certificate_number}.pdf`, docType: "certificate", title: `Certificate of Destruction ${cert.certificate_number}`, jobId: id, uploadedBy: admin.name });
    must(await sb().from("itad_custody_events").insert({ job_id: id, event_type: "note", actor: admin.name, notes: `Certificate ${cert.certificate_number} issued (${live.length} devices, ${snapshot.media.length} drives).` }));
    const url = URL.createObjectURL(blob); window.open(url, "_blank");
  }, "Certificate issued and saved to documents.");

  const flags: string[] = job.regulatory_flags ?? [];
  const hasBaa = docs.some((d) => d.doc_type === "baa" && !d.voided);
  const declared = lines.reduce((t, l) => t + (l.quantity ?? 0), 0);
  const unsanitized = media.filter((m) => m.status === "pending" || m.status === "failed").length;
  const clientSigned = sigs.some((s) => s.signer_role === "client");

  return (
    <div className="stack">
      <p className="form-note mb0"><Link href="/admin/jobs">← Jobs</Link></p>
      <div className="adm-row-head">
        <h1 className="adm-h1">{job.job_number} · {job.business_name || job.contact_name}</h1>
        <StatusPill s={job.status} />
      </div>
      <Msg m={msg} />
      {flags.length > 0 && <p className="adm-warn">Regulatory flags: <strong>{flags.join(", ")}</strong>{job.baa_required && !hasBaa ? " — BAA required before scheduling. Upload it under Documents." : ""}</p>}
      {job.equipment_leased && !docs.some((d) => d.doc_type === "lease_release") && <p className="adm-warn">Leased equipment ({job.lessor_name || "lessor not named"}): upload the lessor&apos;s written release before scheduling.</p>}

      <div className="grid grid-2">
        <div className="panel">
          <h2 className="mt0">Client</h2>
          <dl className="adm-dl">
            <dt>Type</dt><dd>{job.client_type}{job.industry ? ` · ${job.industry}` : ""}</dd>
            <dt>Contact</dt><dd>{job.contact_name}{job.contact_title ? `, ${job.contact_title}` : ""}</dd>
            <dt>Phone</dt><dd>{job.phone ? <a href={`tel:${job.phone}`}>{job.phone}</a> : "—"}</dd>
            <dt>Email</dt><dd>{job.email ? <a href={`mailto:${job.email}`}>{job.email}</a> : "—"}</dd>
            <dt>Address</dt><dd>{[job.address, job.city, job.state, job.zip].filter(Boolean).join(", ") || "—"}</dd>
            <dt>Service</dt><dd>{job.service_type} · wants {fmtDate(job.preferred_date)} · deadline {fmtDate(job.deadline)}</dd>
            <dt>Site</dt><dd>{[job.site_access, job.pallet_estimate, job.onsite_contact].filter(Boolean).join(" · ") || "—"}</dd>
            <dt>Data</dt><dd>{(job.data_types ?? []).join(", ") || "—"} · drives: {job.destruction_preference ?? "—"}</dd>
            <dt>Wants</dt><dd>{[job.needs_partner_certs && "partner certs", job.resale_share_interest && "resale share", job.wants_serialized_cert && "serialized cert"].filter(Boolean).join(", ") || "—"}</dd>
            <dt>Attested</dt><dd>{job.attested_at ? fmtDateTime(job.attested_at) : job.source === "admin" ? "entered by admin" : "—"}</dd>
            <dt>Notes</dt><dd>{job.customer_notes || "—"}</dd>
            <dt>Source</dt><dd>{job.source}{job.legacy_ref ? ` (${job.legacy_ref})` : ""}</dd>
          </dl>
          <h3>Declared by client ({declared} items)</h3>
          <table className="adm-table">
            <thead><tr><th>Type</th><th>Qty</th><th>Model</th><th>Power</th><th>Storage</th><th>Locks</th></tr></thead>
            <tbody>{lines.map((l) => (
              <tr key={l.id}><td>{l.device_type}{l.battery_issue ? " ⚠ battery" : ""}{l.crt ? " · CRT" : ""}</td><td>{l.quantity}</td><td>{l.brand_model || "—"}{l.approx_age ? ` · ${l.approx_age}y` : ""}</td><td>{l.powers_on ?? "—"}</td><td>{l.storage_inside ?? "—"}</td><td>{l.lock_status ?? "—"}</td></tr>
            ))}{!lines.length && <tr><td colSpan={6} className="form-note">Nothing declared.</td></tr>}</tbody>
          </table>
        </div>

        <div className="panel stack">
          <h2 className="mt0">Status, quote &amp; internal</h2>
          <div className="row2">
            <div className="field"><label>Status</label>
              <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{JOB_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="field"><label>Scheduled for</label>
              <input type="datetime-local" value={edit.scheduled_for ? String(edit.scheduled_for).slice(0, 16) : ""} onChange={(e) => setEdit({ ...edit, scheduled_for: e.target.value })} /></div>
          </div>
          <div className="row2">
            <div className="field"><label>Quote total ($)</label><input type="number" step="0.01" value={edit.quote_amount ?? ""} onChange={(e) => setEdit({ ...edit, quote_amount: e.target.value })} /></div>
            <div className="field"><label>Trip fee ($)</label><input type="number" step="0.01" value={edit.trip_fee ?? ""} onChange={(e) => setEdit({ ...edit, trip_fee: e.target.value })} /></div>
          </div>
          <div className="row2">
            <div className="field"><label>Per-drive fee ($)</label><input type="number" step="0.01" value={edit.per_drive_fee ?? ""} onChange={(e) => setEdit({ ...edit, per_drive_fee: e.target.value })} /></div>
            <div className="field"><label>Client resale share (%)</label><input type="number" step="1" value={edit.payout_pct ?? ""} onChange={(e) => setEdit({ ...edit, payout_pct: e.target.value })} /></div>
          </div>
          <div className="row2">
            <div className="field"><label>PO number</label><input type="text" value={edit.po_number ?? ""} onChange={(e) => setEdit({ ...edit, po_number: e.target.value })} /></div>
            <div className="field"><label>Assigned to</label><input type="text" value={edit.assigned_to ?? ""} onChange={(e) => setEdit({ ...edit, assigned_to: e.target.value })} /></div>
          </div>
          <label className="checkline"><input type="checkbox" checked={!!edit.baa_required} onChange={(e) => setEdit({ ...edit, baa_required: e.target.checked })} />BAA required (health data)</label>
          <label className="checkline"><input type="checkbox" checked={!!edit.equipment_leased} onChange={(e) => setEdit({ ...edit, equipment_leased: e.target.checked })} />Includes leased equipment</label>
          {edit.equipment_leased && <div className="field"><label>Lessor</label><input type="text" value={edit.lessor_name ?? ""} onChange={(e) => setEdit({ ...edit, lessor_name: e.target.value })} /></div>}
          <div className="field"><label>Internal notes</label><textarea value={edit.internal_notes ?? ""} onChange={(e) => setEdit({ ...edit, internal_notes: e.target.value })} /></div>
          <button className="btn btn-primary" disabled={busy} onClick={saveJob}>Save job</button>
          <p className="form-note mb0">Quote: {money(job.quote_amount)} · Trip {money(job.trip_fee)} · {money(job.per_drive_fee)}/drive · client share {job.payout_pct ?? "—"}%</p>
        </div>
      </div>

      <div className="panel stack">
        <div className="adm-row-head"><h2 className="mt0">Pickup — log devices</h2><span className="form-note">{assets.filter((a) => a.status !== "void").length} logged of {declared} declared</span></div>
        <form className="stack" onSubmit={addAsset}>
          <div className="adm-grid4">
            <div className="field"><label>Type</label><select value={na.device_type} onChange={(e) => setNa({ ...na, device_type: e.target.value })}>{DEVICE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="field"><label>Make</label><input type="text" value={na.make} onChange={(e) => setNa({ ...na, make: e.target.value })} /></div>
            <div className="field"><label>Model</label><input type="text" value={na.model} onChange={(e) => setNa({ ...na, model: e.target.value })} /></div>
            <div className="field"><label>Serial # <span className="req">*</span></label><input type="text" required autoCapitalize="characters" value={na.serial_number} onChange={(e) => setNa({ ...na, serial_number: e.target.value })} /></div>
            <div className="field"><label>Client asset tag</label><input type="text" value={na.client_asset_tag} onChange={(e) => setNa({ ...na, client_asset_tag: e.target.value })} /></div>
            <div className="field"><label>Locks</label><select value={na.lock_status} onChange={(e) => setNa({ ...na, lock_status: e.target.value })}><option value="none">None</option><option value="locked">Locked (MDM/Apple/Google)</option><option value="released">Released</option></select></div>
            <div className="field"><label>Status now</label><select value={na.status} onChange={(e) => setNa({ ...na, status: e.target.value })}><option value="collected">Collected (on site/in van)</option><option value="received">Received at facility</option></select></div>
            <div className="field"><label>Location</label><input type="text" value={na.location} onChange={(e) => setNa({ ...na, location: e.target.value })} /></div>
          </div>
          <div className="adm-grid4">
            <label className="checkline"><input type="checkbox" checked={na.has_storage} onChange={(e) => setNa({ ...na, has_storage: e.target.checked })} />Has storage</label>
            {na.has_storage && <>
              <div className="field"><label>Drive serial</label><input type="text" value={na.drive_serial} onChange={(e) => setNa({ ...na, drive_serial: e.target.value })} /></div>
              <div className="field"><label>Drive type</label><select value={na.drive_type} onChange={(e) => setNa({ ...na, drive_type: e.target.value })}>{["ssd", "nvme", "hdd", "emmc", "flash", "other"].map((t) => <option key={t}>{t}</option>)}</select></div>
              <div className="field"><label>GB</label><input type="number" value={na.drive_gb} onChange={(e) => setNa({ ...na, drive_gb: e.target.value })} /></div>
            </>}
          </div>
          <label className="checkline"><input type="checkbox" checked={na.third_party_config} onChange={(e) => setNa({ ...na, third_party_config: e.target.checked })} />Carries another organization&apos;s config (needs asset-release letter before wipe)</label>
          <div className="field"><label>Condition notes</label><input type="text" value={na.condition_notes} onChange={(e) => setNa({ ...na, condition_notes: e.target.value })} /></div>
          <button className="btn btn-primary" disabled={busy}>Log device</button>
        </form>

        <div className="adm-actions">
          <button className="btn btn-outline" onClick={() => { setSigFor("client"); setSignerName(job.onsite_contact || job.contact_name); }}>Client signs release</button>
          <button className="btn btn-outline" onClick={() => { setSigFor("digilabs"); setSignerName(admin.name); }}>DigiLabs signs</button>
          <button className="btn btn-outline" disabled={busy} onClick={() => markAll("collected", "received", "DigiLabs facility")}>Mark all collected → received</button>
        </div>
        {!clientSigned && assets.length > 0 && <p className="form-note mb0">No client signature yet for this pickup.</p>}
        {sigFor && (
          <div className="panel">
            <div className="field"><label>Signer name</label><input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} /></div>
            <p className="form-note">{sigFor === "client" ? CUSTODY_STATEMENT(job, assets.filter((a) => a.status !== "void").length, admin.name) : `DigiLabs ITAD representative accepts custody of the devices listed on job ${job.job_number}.`}</p>
            <SignaturePad label={`${sigFor === "client" ? "Client" : "DigiLabs"} signature`} onCancel={() => setSigFor(null)} onDone={(b) => signerName.trim() ? saveSignature(b) : setMsg({ ok: false, t: "Enter the signer's name." })} />
          </div>
        )}
      </div>

      <div className="panel">
        <div className="adm-row-head"><h2 className="mt0">Devices ({assets.length})</h2>
          <button className="btn btn-outline" onClick={() => downloadText(`${job.job_number}-devices.csv`, toCsv(assets))}>Export CSV</button></div>
        <table className="adm-table">
          <thead><tr><th>Tag</th><th>Device</th><th>Serial</th><th>Drives</th><th>Locks</th><th>Status</th><th>Location</th></tr></thead>
          <tbody>{assets.map((a) => {
            const ms = media.filter((m) => m.asset_id === a.id);
            return (
              <tr key={a.id}>
                <td><Link href={`/admin/assets/${a.id}`}>{a.asset_tag}</Link></td>
                <td>{a.device_type} {[a.make, a.model].filter(Boolean).join(" ")}</td>
                <td className="mono">{a.serial_number || "—"}</td>
                <td>{a.has_storage ? (ms.length ? ms.map((m) => `${m.media_tag} ${m.status}`).join(", ") : "⚠ none logged") : "n/a"}</td>
                <td>{a.lock_status}{a.third_party_config ? " · 3rd-party cfg" : ""}</td>
                <td><StatusPill s={a.status} /></td>
                <td>{a.location || "—"}</td>
              </tr>
            );
          })}{!assets.length && <tr><td colSpan={7} className="form-note">No devices logged yet.</td></tr>}</tbody>
        </table>
      </div>

      <div className="grid grid-2">
        <div className="panel stack">
          <h2 className="mt0">Documents</h2>
          <DocUpload onUpload={uploadDoc} types={DOC_TYPES} />
          <table className="adm-table">
            <thead><tr><th>Type</th><th>File</th><th>Added</th></tr></thead>
            <tbody>{docs.map((d) => (
              <tr key={d.id}><td>{d.doc_type.replace(/_/g, " ")}</td><td><button className="link-btn" onClick={() => openDoc(d.storage_path)}>{d.title || d.file_name}</button><div className="form-note mono">sha256 {String(d.sha256 ?? "").slice(0, 12)}…</div></td><td>{fmtDate(d.created_at)}<div className="form-note">{d.uploaded_by}</div></td></tr>
            ))}{!docs.length && <tr><td colSpan={3} className="form-note">None yet. Upload the signed service agreement{job.baa_required ? " and BAA" : ""}.</td></tr>}</tbody>
          </table>
          <h3>Signatures</h3>
          <ul className="adm-list">{sigs.map((s) => <li key={s.id}>{s.signer_role}: {s.signer_name} · {fmtDateTime(s.signed_at)} · <button className="link-btn" onClick={() => openDoc(s.image_path)}>view</button></li>)}{!sigs.length && <li className="form-note">None yet.</li>}</ul>
        </div>

        <div className="panel stack">
          <h2 className="mt0">Certificate of Destruction</h2>
          <p className="form-note mt0">Issues only when every device is logged and every drive has a passing wipe or destruction record. {unsanitized > 0 ? `${unsanitized} drive(s) still pending — see the Wipe queue.` : ""}</p>
          <button className="btn btn-primary" disabled={busy} onClick={issueCert}>Issue certificate (PDF)</button>
          <ul className="adm-list">{certs.map((c) => <li key={c.id}>{c.certificate_number} · {c.status} · {fmtDateTime(c.issued_at)} · {c.issued_by}</li>)}{!certs.length && <li className="form-note">None issued.</li>}</ul>
        </div>
      </div>

      <div className="panel">
        <h2 className="mt0">Chain of custody</h2>
        <ul className="adm-timeline">{events.map((e) => (
          <li key={e.id}><span className="mono">{fmtDateTime(e.occurred_at)}</span> <strong>{e.event_type.replace(/_/g, " ")}</strong> · {e.actor || "—"}{e.counterparty ? ` ↔ ${e.counterparty}` : ""}{e.location ? ` @ ${e.location}` : ""}<div className="form-note">{e.notes}</div></li>
        ))}</ul>
      </div>
    </div>
  );
}

function DocUpload({ onUpload, types }: { onUpload: (f: File, t: string) => void; types: string[] }) {
  const [t, setT] = useState(types[0]);
  return (
    <div className="adm-actions">
      <select value={t} onChange={(e) => setT(e.target.value)} style={{ maxWidth: 200 }}>{types.map((x) => <option key={x} value={x}>{x.replace(/_/g, " ")}</option>)}</select>
      <label className="btn btn-outline">Upload file<input type="file" hidden accept="image/*,application/pdf,.doc,.docx,.csv,.xlsx,.txt,.log" capture={undefined} onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f, t); e.target.value = ""; }} /></label>
    </div>
  );
}
