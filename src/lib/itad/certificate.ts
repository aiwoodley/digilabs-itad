"use client";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface CertSnapshot {
  certificate_number: string;
  issued_at: string;
  issued_by: string;
  job: {
    job_number: string; client_type: string; business_name: string | null; contact_name: string;
    address: string | null; city: string | null; state: string | null; zip: string | null; po_number: string | null;
  };
  assets: {
    asset_tag: string; device_type: string; make: string | null; model: string | null; serial_number: string | null;
    client_asset_tag: string | null; disposition: string | null; status: string;
  }[];
  media: {
    media_tag: string; asset_tag: string | null; media_serial: string | null; media_type: string | null;
    nist_method: string; technique: string; tool: string | null; result: string; performed_at: string; technician: string;
  }[];
  transfers: { transfer_number: string; partner: string; r2_cert_number: string | null; partner_cert_number: string | null; transfer_date: string | null }[];
}

const NAVY = rgb(10 / 255, 42 / 255, 92 / 255);
const GREY = rgb(0.35, 0.38, 0.42);

export async function buildCertificatePdf(s: CertSnapshot, hash: string, signaturePng?: ArrayBuffer | null): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificate of Destruction ${s.certificate_number}`);
  pdf.setAuthor("DigiLabs ITAD");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 612, H = 792, M = 48;
  let page = pdf.addPage([W, H]);
  let y = H - M;

  const text = (p: PDFPage, t: string, x: number, yy: number, size = 9, f: PDFFont = font, color = rgb(0.1, 0.1, 0.1)) =>
    p.drawText(t.replace(/[^\x20-\x7E]/g, "-"), { x, y: yy, size, font: f, color });
  const newPage = () => { page = pdf.addPage([W, H]); y = H - M; };
  const need = (h: number) => { if (y - h < M + 30) newPage(); };
  const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

  page.drawRectangle({ x: 0, y: H - 70, width: W, height: 70, color: NAVY });
  text(page, "DIGILABS ITAD", M, H - 40, 18, bold, rgb(1, 1, 1));
  text(page, "Certificate of Data Destruction & Disposition", M, H - 58, 11, font, rgb(0.85, 0.9, 1));
  y = H - 100;

  const kv = (k: string, v: string, x: number) => { text(page, k, x, y, 8, bold, GREY); text(page, v, x, y - 12, 10); };
  kv("CERTIFICATE NO.", s.certificate_number, M);
  kv("JOB NO.", s.job.job_number, M + 180);
  kv("ISSUED", new Date(s.issued_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), M + 330);
  y -= 34;
  kv("CLIENT", clip(s.job.business_name || s.job.contact_name, 45), M);
  kv("SITE", clip([s.job.address, s.job.city, s.job.state, s.job.zip].filter(Boolean).join(", ") || "—", 50), M + 260);
  y -= 34;
  if (s.job.po_number) { kv("PO NUMBER", s.job.po_number, M); y -= 34; }

  const para = (t: string, size = 9) => {
    const words = t.split(" ");
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(test, size) > W - 2 * M) { need(14); text(page, line, M, y, size); y -= 13; line = w; } else line = test;
    }
    if (line) { need(14); text(page, line, M, y, size); y -= 13; }
  };
  para(`DigiLabs ITAD certifies that the ${s.assets.length} device(s) and ${s.media.length} storage media listed below were received under documented chain of custody, and that every data-bearing storage device was sanitized or destroyed in accordance with NIST Special Publication 800-88 Rev. 1 (Clear, Purge or Destroy) with the results recorded below. Items not reused were transferred to the R2v3-certified downstream processor(s) listed. DigiLabs ITAD does not itself hold R2v3 or NAID AAA certification.`);
  y -= 8;

  const table = (title: string, cols: [string, number][], rows: string[][]) => {
    need(40);
    text(page, title, M, y, 10, bold, NAVY); y -= 16;
    const header = () => {
      let x = M;
      page.drawRectangle({ x: M - 4, y: y - 3, width: W - 2 * M + 8, height: 14, color: rgb(0.93, 0.95, 0.97) });
      for (const [h, w] of cols) { text(page, h, x, y, 7.5, bold, GREY); x += w; }
      y -= 14;
    };
    header();
    for (const r of rows) {
      if (y - 12 < M + 30) { newPage(); header(); }
      let x = M;
      r.forEach((c, i) => { const w = cols[i][1]; text(page, clip(c || "—", Math.floor(w / 4.3)), x, y, 8); x += w; });
      y -= 12;
    }
    y -= 10;
  };

  table("DEVICES", [["TAG", 70], ["TYPE", 90], ["MAKE / MODEL", 140], ["SERIAL", 110], ["CLIENT TAG", 60], ["DISPOSITION", 60]],
    s.assets.map((a) => [a.asset_tag, a.device_type, [a.make, a.model].filter(Boolean).join(" "), a.serial_number || "", a.client_asset_tag || "", a.disposition || a.status]));
  if (s.media.length)
    table("STORAGE MEDIA — NIST 800-88 RECORD", [["MEDIA", 62], ["IN ASSET", 62], ["SERIAL", 90], ["TYPE", 36], ["METHOD", 50], ["TECHNIQUE / TOOL", 116], ["RESULT", 36], ["DATE", 64]],
      s.media.map((m) => [m.media_tag, m.asset_tag || "loose", m.media_serial || "", (m.media_type || "").toUpperCase(), m.nist_method.toUpperCase(), [m.technique, m.tool].filter(Boolean).join(" / "), m.result.toUpperCase(), new Date(m.performed_at).toLocaleDateString("en-US")]));
  if (s.transfers.length)
    table("DOWNSTREAM TRANSFERS", [["TRANSFER", 90], ["PROCESSOR", 170], ["R2v3 CERT #", 100], ["THEIR CERT #", 100], ["DATE", 56]],
      s.transfers.map((t) => [t.transfer_number, t.partner, t.r2_cert_number || "", t.partner_cert_number || "pending", t.transfer_date || ""]));

  need(110);
  y -= 10;
  if (signaturePng) {
    const img = await pdf.embedPng(signaturePng);
    const scale = Math.min(160 / img.width, 50 / img.height);
    page.drawImage(img, { x: M, y: y - 50, width: img.width * scale, height: img.height * scale });
  }
  y -= 56;
  page.drawLine({ start: { x: M, y }, end: { x: M + 220, y }, thickness: 0.8, color: GREY });
  text(page, `${s.issued_by}, Authorized Representative, DigiLabs ITAD`, M, y - 12, 8.5);
  text(page, "DigiLabs ITAD · a DBA of Roccus Technologies LLC · Miramar, FL · 754-274-6614 · admin@digi-labs.org", M, y - 30, 7.5, font, GREY);

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    text(p, `${s.certificate_number} · page ${i + 1} of ${pages.length} · record SHA-256 ${hash.slice(0, 32)}…`, M, 24, 7, font, GREY);
  });
  return pdf.save();
}
