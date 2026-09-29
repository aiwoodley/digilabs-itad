"use client";

import { createClient } from "@/lib/supabase/client";

let _sb: ReturnType<typeof createClient> | null = null;
export function sb() {
  if (!_sb) _sb = createClient();
  return _sb;
}

export async function sha256Hex(data: ArrayBuffer | string): Promise<string> {
  const buf = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function uploadFile(path: string, file: Blob, contentType?: string) {
  const { error } = await sb().storage.from("itad-files").upload(path, file, { contentType: contentType || file.type, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function signedUrl(path: string) {
  const { data, error } = await sb().storage.from("itad-files").createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function addDocument(opts: {
  file: File | Blob; fileName: string; docType: string; title?: string; jobId?: string; assetId?: string;
  transferId?: string; partnerId?: string; uploadedBy: string;
}) {
  const buf = await opts.file.arrayBuffer();
  const hash = await sha256Hex(buf);
  const safe = opts.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const folder = opts.jobId ? `jobs/${opts.jobId}` : opts.transferId ? `transfers/${opts.transferId}` : opts.partnerId ? `partners/${opts.partnerId}` : "misc";
  const path = `${folder}/${Date.now()}-${safe}`;
  await uploadFile(path, opts.file, (opts.file as File).type || "application/octet-stream");
  const { data, error } = await sb().from("itad_documents").insert({
    job_id: opts.jobId ?? null, asset_id: opts.assetId ?? null, transfer_id: opts.transferId ?? null,
    partner_id: opts.partnerId ?? null, doc_type: opts.docType, title: opts.title || opts.fileName,
    storage_path: path, file_name: opts.fileName, mime_type: (opts.file as File).type || null, sha256: hash,
    uploaded_by: opts.uploadedBy,
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export function fmtDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
export function fmtDateTime(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
export function money(n?: number | string | null) {
  if (n === null || n === undefined || n === "") return "—";
  return Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Array.from(rows.reduce((s, r) => { Object.keys(r).forEach((k) => s.add(k)); return s; }, new Set<string>()));
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
export function downloadText(name: string, text: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function errMsg(e: unknown) {
  return e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
}
