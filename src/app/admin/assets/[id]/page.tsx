"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { sb, fmtDateTime, money, addDocument, signedUrl, errMsg } from "@/lib/itad/db";
import { useAdmin, Msg, StatusPill } from "@/components/admin/AdminShell";

/* eslint-disable @typescript-eslint/no-explicit-any */
const STATUSES = ["collected", "received", "awaiting_sanitization", "sanitized", "refurbishing", "ready_for_sale", "listed", "sold", "donated", "to_partner", "destroyed", "returned", "void"];

export default function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const admin = useAdmin();
  const [a, setA] = useState<any>(null);
  const [edit, setEdit] = useState<any>({});
  const [media, setMedia] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [nm, setNm] = useState({ media_serial: "", media_type: "ssd", capacity_gb: "" });
  const [sale, setSale] = useState<any>({ channel: "ebay", listing_id: "", order_number: "", sale_date: "", sale_price: "", platform_fees: "", shipping_cost: "", refurb_cost: "", status: "listed", notes: "" });

  const load = useCallback(async () => {
    const [x, m, e, d, s] = await Promise.all([
      sb().from("itad_assets").select("*, itad_jobs(job_number, business_name, contact_name, payout_pct)").eq("id", id).single(),
      sb().from("itad_storage_media").select("*, itad_sanitization(*)").eq("asset_id", id),
      sb().from("itad_custody_events").select("*").eq("asset_id", id).order("occurred_at", { ascending: false }),
      sb().from("itad_documents").select("*").eq("asset_id", id),
      sb().from("itad_sales").select("*").eq("asset_id", id).order("created_at"),
    ]);
    setA(x.data); setEdit(x.data ?? {}); setMedia(m.data ?? []); setEvents(e.data ?? []); setDocs(d.data ?? []); setSales(s.data ?? []);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try { await fn(); setMsg({ ok: true, t: ok }); await load(); } catch (e) { setMsg({ ok: false, t: errMsg(e) }); }
  };
  const must = (r: { error: any }) => { if (r.error) throw new Error(r.error.message); return r; };
  if (!a) return <p>Loading…</p>;

  const save = () => act(async () => {
    if (edit.status === "void" && !edit.void_reason) throw new Error("Give a reason for voiding.");
    const f = ["device_type", "make", "model", "serial_number", "client_asset_tag", "cpu", "ram_gb", "storage_summary", "grade", "lock_status", "lock_type", "third_party_config", "condition_notes", "status", "disposition", "location", "void_reason", "has_storage"];
    const p: any = {}; f.forEach((k) => (p[k] = edit[k] === "" ? null : edit[k]));
    must(await sb().from("itad_assets").update(p).eq("id", id));
  }, "Device saved.");

  const addMedia = () => act(async () => {
    must(await sb().from("itad_storage_media").insert({ job_id: a.job_id, asset_id: id, media_serial: nm.media_serial || null, media_type: nm.media_type, capacity_gb: nm.capacity_gb || null }));
    setNm({ media_serial: "", media_type: "ssd", capacity_gb: "" });
  }, "Drive added.");

  const uploadRelease = (f: File) => act(async () => {
    const d = await addDocument({ file: f, fileName: f.name, docType: "asset_release", jobId: a.job_id, assetId: id, uploadedBy: admin.name });
    must(await sb().from("itad_assets").update({ lock_release_doc_id: d.id, lock_status: a.lock_status === "locked" ? "released" : a.lock_status }).eq("id", id));
  }, "Release letter attached.");

  const addSale = () => act(async () => {
    const pct = a.itad_jobs?.payout_pct ?? null;
    const net = Number(sale.sale_price || 0) - Number(sale.platform_fees || 0) - Number(sale.shipping_cost || 0) - Number(sale.refurb_cost || 0);
    const payout = pct && sale.status === "sold" ? Math.round(net * pct) / 100 : null;
    must(await sb().from("itad_sales").insert({
      asset_id: id, channel: sale.channel, listing_id: sale.listing_id || null, order_number: sale.order_number || null, sale_date: sale.sale_date || null,
      sale_price: sale.sale_price || null, platform_fees: sale.platform_fees || 0, shipping_cost: sale.shipping_cost || 0, refurb_cost: sale.refurb_cost || 0,
      payout_pct: pct, payout_amount: payout, payout_status: payout ? "owed" : "n/a", status: sale.status, notes: sale.notes || null,
    }));
    must(await sb().from("itad_assets").update({ status: sale.status === "sold" ? "sold" : "listed", disposition: "resale" }).eq("id", id));
  }, "Sale recorded.");

  const markSold = (s: any) => act(async () => {
    const price = prompt("Final sale price ($)?", s.sale_price ?? "");
    if (price === null) return;
    const order = prompt("eBay order number?", s.order_number ?? "") ?? s.order_number;
    const fees = prompt("Platform fees ($)?", s.platform_fees ?? "0") ?? "0";
    const ship = prompt("Shipping cost ($)?", s.shipping_cost ?? "0") ?? "0";
    const net = Number(price) - Number(fees) - Number(ship) - Number(s.refurb_cost || 0);
    const payout = s.payout_pct ? Math.round(net * s.payout_pct) / 100 : null;
    must(await sb().from("itad_sales").update({ status: "sold", sale_price: price, order_number: order, platform_fees: fees, shipping_cost: ship, sale_date: new Date().toISOString().slice(0, 10), payout_amount: payout, payout_status: payout ? "owed" : "n/a" }).eq("id", s.id));
    must(await sb().from("itad_assets").update({ status: "sold" }).eq("id", id));
  }, "Marked sold.");

  const E = (k: string, label: string, type = "text") => (
    <div className="field"><label>{label}</label><input type={type} value={edit[k] ?? ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></div>
  );

  return (
    <div className="stack">
      <p className="form-note mb0"><Link href={`/admin/jobs/${a.job_id}`}>← {a.itad_jobs?.job_number} · {a.itad_jobs?.business_name || a.itad_jobs?.contact_name}</Link></p>
      <div className="adm-row-head"><h1 className="adm-h1">{a.asset_tag} · {a.device_type} {[a.make, a.model].filter(Boolean).join(" ")}</h1><StatusPill s={a.status} /></div>
      <Msg m={msg} />
      {a.lock_status === "locked" && <p className="adm-warn">Device is locked. It can&apos;t be wiped until the lock is released (mark released or attach release proof).</p>}
      {a.third_party_config && !a.lock_release_doc_id && <p className="adm-warn">Carries another organization&apos;s configuration. Attach their asset-release letter before wiping.</p>}

      <div className="grid grid-2">
        <div className="panel stack">
          <h2 className="mt0">Details</h2>
          <div className="row2">{E("make", "Make")}{E("model", "Model")}</div>
          <div className="row2">{E("serial_number", "Serial #")}{E("client_asset_tag", "Client asset tag")}</div>
          <div className="row2">{E("cpu", "CPU")}{E("ram_gb", "RAM (GB)", "number")}</div>
          <div className="row2">{E("storage_summary", "Storage summary")}{E("location", "Location")}</div>
          <div className="row2">
            <div className="field"><label>Grade</label><select value={edit.grade ?? ""} onChange={(e) => setEdit({ ...edit, grade: e.target.value })}><option value="">—</option>{["A", "B", "C", "D", "parts", "scrap"].map((g) => <option key={g}>{g}</option>)}</select></div>
            <div className="field"><label>Locks</label><select value={edit.lock_status} onChange={(e) => setEdit({ ...edit, lock_status: e.target.value })}><option value="none">None</option><option value="locked">Locked</option><option value="released">Released</option></select></div>
          </div>
          <div className="row2">
            <div className="field"><label>Status</label><select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="field"><label>Disposition</label><select value={edit.disposition ?? ""} onChange={(e) => setEdit({ ...edit, disposition: e.target.value })}><option value="">—</option>{["resale", "donation", "recycle", "destroy", "return_to_client"].map((s) => <option key={s}>{s}</option>)}</select></div>
          </div>
          {edit.status === "void" && E("void_reason", "Void reason (required)")}
          <label className="checkline"><input type="checkbox" checked={!!edit.has_storage} onChange={(e) => setEdit({ ...edit, has_storage: e.target.checked })} />Has storage</label>
          <label className="checkline"><input type="checkbox" checked={!!edit.third_party_config} onChange={(e) => setEdit({ ...edit, third_party_config: e.target.checked })} />Carries another organization&apos;s config</label>
          <div className="field"><label>Condition notes</label><textarea value={edit.condition_notes ?? ""} onChange={(e) => setEdit({ ...edit, condition_notes: e.target.value })} /></div>
          <button className="btn btn-primary" onClick={save}>Save device</button>
          <label className="btn btn-outline">Attach asset/lock release letter<input type="file" hidden accept="image/*,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadRelease(f); e.target.value = ""; }} /></label>
          {docs.map((d) => <p key={d.id} className="form-note mb0">{d.doc_type}: <button className="link-btn" onClick={async () => window.open(await signedUrl(d.storage_path), "_blank")}>{d.file_name}</button></p>)}
        </div>

        <div className="stack">
          <div className="panel stack">
            <h2 className="mt0">Drives</h2>
            {media.map((m) => (
              <div key={m.id} className="line-card">
                <strong>{m.media_tag}</strong> · {m.media_type?.toUpperCase()} {m.capacity_gb ? `${m.capacity_gb}GB` : ""} · S/N <span className="mono">{m.media_serial || "—"}</span> · <StatusPill s={m.status} />
                {(m.itad_sanitization ?? []).map((s: any) => <div key={s.id} className="form-note">NIST {s.nist_method} · {s.technique}{s.tool ? ` (${s.tool} ${s.tool_version ?? ""})` : ""} · {s.result.toUpperCase()} · {s.technician} · {fmtDateTime(s.performed_at)}</div>)}
              </div>
            ))}
            <div className="adm-grid4">
              <div className="field"><label>Drive serial</label><input type="text" value={nm.media_serial} onChange={(e) => setNm({ ...nm, media_serial: e.target.value })} /></div>
              <div className="field"><label>Type</label><select value={nm.media_type} onChange={(e) => setNm({ ...nm, media_type: e.target.value })}>{["ssd", "nvme", "hdd", "emmc", "flash", "tape", "other"].map((t) => <option key={t}>{t}</option>)}</select></div>
              <div className="field"><label>GB</label><input type="number" value={nm.capacity_gb} onChange={(e) => setNm({ ...nm, capacity_gb: e.target.value })} /></div>
              <button className="btn btn-outline" onClick={addMedia}>Add drive</button>
            </div>
            <p className="form-note mb0">Record wipes in the <Link href="/admin/sanitize">Wipe queue</Link>.</p>
          </div>

          <div className="panel stack">
            <h2 className="mt0">Resale</h2>
            {sales.map((s) => (
              <div key={s.id} className="line-card">
                {s.channel} · listing {s.listing_id || "—"} · order {s.order_number || "—"} · <StatusPill s={s.status} /><br />
                Sold {money(s.sale_price)} − fees {money(s.platform_fees)} − ship {money(s.shipping_cost)} − refurb {money(s.refurb_cost)} = <strong>{money(s.net_amount)}</strong><br />
                Client share {s.payout_pct ?? "—"}% → {money(s.payout_amount)} ({s.payout_status})
                {s.status === "listed" && <div><button className="btn btn-outline" onClick={() => markSold(s)}>Mark sold</button></div>}
              </div>
            ))}
            <div className="adm-grid4">
              <div className="field"><label>Channel</label><select value={sale.channel} onChange={(e) => setSale({ ...sale, channel: e.target.value })}><option>ebay</option><option>direct</option><option>other</option></select></div>
              <div className="field"><label>Listing / item #</label><input type="text" value={sale.listing_id} onChange={(e) => setSale({ ...sale, listing_id: e.target.value })} /></div>
              <div className="field"><label>Refurb cost ($)</label><input type="number" step="0.01" value={sale.refurb_cost} onChange={(e) => setSale({ ...sale, refurb_cost: e.target.value })} /></div>
              <div className="field"><label>Status</label><select value={sale.status} onChange={(e) => setSale({ ...sale, status: e.target.value })}><option value="listed">Listed</option><option value="sold">Already sold</option></select></div>
            </div>
            {sale.status === "sold" && <div className="adm-grid4">
              <div className="field"><label>Order #</label><input type="text" value={sale.order_number} onChange={(e) => setSale({ ...sale, order_number: e.target.value })} /></div>
              <div className="field"><label>Sale price</label><input type="number" step="0.01" value={sale.sale_price} onChange={(e) => setSale({ ...sale, sale_price: e.target.value })} /></div>
              <div className="field"><label>Fees</label><input type="number" step="0.01" value={sale.platform_fees} onChange={(e) => setSale({ ...sale, platform_fees: e.target.value })} /></div>
              <div className="field"><label>Shipping</label><input type="number" step="0.01" value={sale.shipping_cost} onChange={(e) => setSale({ ...sale, shipping_cost: e.target.value })} /></div>
            </div>}
            <button className="btn btn-outline" onClick={addSale}>Record listing / sale</button>
            <p className="form-note mb0">Client share comes from the job ({a.itad_jobs?.payout_pct ?? "not set"}%).</p>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2 className="mt0">History</h2>
        <ul className="adm-timeline">{events.map((e) => <li key={e.id}><span className="mono">{fmtDateTime(e.occurred_at)}</span> <strong>{e.event_type.replace(/_/g, " ")}</strong> · {e.actor}{e.location ? ` @ ${e.location}` : ""}<div className="form-note">{e.notes}</div></li>)}</ul>
      </div>
    </div>
  );
}
