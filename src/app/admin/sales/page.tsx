"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sb, fmtDate, money, toCsv, downloadText, errMsg } from "@/lib/itad/db";
import { Msg, StatusPill } from "@/components/admin/AdminShell";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function SalesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  async function load() {
    const { data } = await sb().from("itad_sales").select("*, itad_assets(asset_tag, device_type, make, model, serial_number, job_id, itad_jobs(job_number, business_name, contact_name))").order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function markPaid(s: any) {
    const method = prompt("Paid how? (Zelle, check #, ACH…)"); if (!method) return;
    const { error } = await sb().from("itad_sales").update({ payout_status: "paid", payout_date: new Date().toISOString().slice(0, 10), payout_method: method }).eq("id", s.id);
    setMsg(error ? { ok: false, t: errMsg(error) } : { ok: true, t: "Payout marked paid." }); load();
  }

  const shown = rows.filter((r) => filter === "all" || (filter === "owed" ? r.payout_status === "owed" : r.status === filter));
  const sum = (k: string) => shown.filter((r) => r.status === "sold").reduce((t, r) => t + Number(r[k] ?? 0), 0);

  return (
    <div className="stack">
      <div className="adm-row-head"><h1 className="adm-h1">Sales &amp; payouts</h1>
        <button className="btn btn-outline" onClick={() => downloadText("itad-sales.csv", toCsv(shown.map(({ itad_assets, ...r }) => ({ ...r, asset_tag: itad_assets?.asset_tag, serial: itad_assets?.serial_number, job: itad_assets?.itad_jobs?.job_number, client: itad_assets?.itad_jobs?.business_name || itad_assets?.itad_jobs?.contact_name }))))}>Export CSV</button></div>
      <Msg m={msg} />
      <div className="adm-stats">
        <div className="panel"><div className="num">{money(sum("sale_price"))}</div><div className="lbl">Gross sold</div></div>
        <div className="panel"><div className="num">{money(sum("net_amount"))}</div><div className="lbl">Net after costs</div></div>
        <div className="panel"><div className="num">{money(shown.filter((r) => r.payout_status === "owed").reduce((t, r) => t + Number(r.payout_amount ?? 0), 0))}</div><div className="lbl">Payouts owed</div></div>
      </div>
      <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 200 }}><option value="all">All</option><option value="listed">Listed</option><option value="sold">Sold</option><option value="owed">Payout owed</option></select>
      <table className="adm-table">
        <thead><tr><th>Device</th><th>Client / job</th><th>Channel</th><th>Order</th><th>Sold</th><th>Net</th><th>Client share</th><th>Status</th><th /></tr></thead>
        <tbody>{shown.map((s) => (
          <tr key={s.id}>
            <td><Link href={`/admin/assets/${s.asset_id}`}>{s.itad_assets?.asset_tag}</Link> {s.itad_assets?.make} {s.itad_assets?.model}</td>
            <td>{s.itad_assets?.itad_jobs?.business_name || s.itad_assets?.itad_jobs?.contact_name}<div className="form-note">{s.itad_assets?.itad_jobs?.job_number}</div></td>
            <td>{s.channel}<div className="form-note">{s.listing_id}</div></td>
            <td>{s.order_number || "—"}<div className="form-note">{fmtDate(s.sale_date)}</div></td>
            <td>{money(s.sale_price)}</td><td>{money(s.net_amount)}</td>
            <td>{s.payout_pct ? `${s.payout_pct}% → ${money(s.payout_amount)}` : "—"}<div className="form-note">{s.payout_status}{s.payout_method ? ` · ${s.payout_method}` : ""}</div></td>
            <td><StatusPill s={s.status} /></td>
            <td>{s.payout_status === "owed" && <button className="btn btn-outline" onClick={() => markPaid(s)}>Mark paid</button>}</td>
          </tr>
        ))}{!shown.length && <tr><td colSpan={9} className="form-note">No sales yet. Record listings from a device&apos;s page.</td></tr>}</tbody>
      </table>
    </div>
  );
}
