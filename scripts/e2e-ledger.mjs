// End-to-end check of the ITAD ledger against the live DB, as a temporary ITAD admin.
// Usage: SUPABASE_URL=.. ANON=.. SERVICE=.. node scripts/e2e-ledger.mjs
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";

const { SUPABASE_URL: url, ANON: anon, SERVICE: service } = process.env;
const admin = createClient(url, service, { auth: { persistSession: false } });
const email = `itad-e2e-${Date.now()}@test.digi-labs.org`;
const password = crypto.randomUUID() + "Aa1!";
const out = [];
const ok = (m) => out.push("ok  " + m);
const bad = (m) => out.push("FAIL " + m);
const must = (r, m) => { if (r.error) throw new Error(`${m}: ${r.error.message}`); return r.data; };
let uid, jobId;

try {
  // public form path (anon)
  const pub = createClient(url, anon, { auth: { persistSession: false } });
  const jn = must(await pub.rpc("itad_submit_intake", { p: {
    client_type: "business", business_name: "E2E Test Co", industry: "legal", contact_name: "E2E", phone: "555", email: "e2e@example.com",
    city: "Tampa", data_types: ["customer"], attest_owner: true, attest_authorized: true, attest_destruction: true, attest_backup: true, attest_privacy: true,
    lines: [{ device_type: "Laptop", quantity: 2, storage_inside: "yes", lock_status: "none" }] } }), "anon intake");
  ok("anon intake -> " + jn);
  const leak = await pub.from("itad_jobs").select("id");
  leak.error || !leak.data?.length ? ok("anon cannot read jobs") : bad("anon read jobs!");

  // temp admin
  uid = must(await admin.auth.admin.createUser({ email, password, email_confirm: true }), "create user").user.id;
  must(await admin.from("itad_admins").insert({ user_id: uid, display_name: "E2E Tester" }), "add admin");
  const sb = createClient(url, anon, { auth: { persistSession: false } });
  must(await sb.auth.signInWithPassword({ email, password }), "login");

  const job = must(await sb.from("itad_jobs").select("*").eq("job_number", jn).single(), "read job");
  jobId = job.id;
  job.regulatory_flags.includes("FIPA") ? ok("flags " + job.regulatory_flags) : bad("flags " + job.regulatory_flags);

  const a = must(await sb.from("itad_assets").insert({ job_id: jobId, device_type: "Laptop", make: "Dell", model: "5420", serial_number: "E2ESN1", status: "collected", location: "Van", created_by: "E2E Tester" }).select().single(), "asset");
  const m = must(await sb.from("itad_storage_media").insert({ job_id: jobId, asset_id: a.id, media_type: "ssd", media_serial: "E2EDRV1" }).select().single(), "media");
  ok(`logged ${a.asset_tag} / ${m.media_tag}`);

  // storage upload + signature
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  must(await sb.storage.from("itad-files").upload(`jobs/${jobId}/signatures/e2e.png`, png, { contentType: "image/png" }), "upload");
  must(await sb.from("itad_signatures").insert({ job_id: jobId, signer_name: "E2E", signer_role: "client", purpose: "custody_release", statement: "test", image_path: `jobs/${jobId}/signatures/e2e.png`, collected_by: "E2E Tester" }), "signature");
  ok("private upload + signature");
  const pubFile = await pub.storage.from("itad-files").download(`jobs/${jobId}/signatures/e2e.png`);
  pubFile.error ? ok("anon cannot download files") : bad("anon downloaded file!");

  must(await sb.from("itad_assets").update({ status: "received", location: "DigiLabs facility" }).eq("id", a.id), "receive");
  const early = await sb.from("itad_certificates").insert({ job_id: jobId, issued_by: "E2E", snapshot: {}, snapshot_sha256: "x" });
  early.error ? ok("cert blocked before wipe") : bad("cert issued before wipe");
  must(await sb.from("itad_sanitization").insert({ media_id: m.id, nist_method: "purge", technique: "Cryptographic erase", tool: "nwipe", result: "pass", technician: "E2E Tester" }), "wipe");

  // the embedded selects the admin pages use
  for (const [name, q] of [
    ["job media+sanitization", sb.from("itad_storage_media").select("*, itad_sanitization(*)").eq("job_id", jobId)],
    ["assets+jobs", sb.from("itad_assets").select("*, itad_jobs(job_number, business_name, contact_name, payout_pct)").eq("id", a.id)],
    ["wipe queue", sb.from("itad_storage_media").select("*, itad_assets(asset_tag, lock_status), itad_jobs(job_number)").in("status", ["pending", "failed"])],
    ["transfers", sb.from("itad_transfers").select("*, itad_partners(name), itad_transfer_items(id), itad_documents(id, doc_type)")],
    ["partners+docs", sb.from("itad_partners").select("*, itad_documents(id)")],
    ["sales", sb.from("itad_sales").select("*, itad_assets(asset_tag, job_id, itad_jobs(job_number))")],
    ["transfer items", sb.from("itad_transfer_items").select("itad_transfers(transfer_number, itad_partners(name, r2_cert_number))").in("asset_id", [a.id])],
    ["custody", sb.from("itad_custody_events").select("*").eq("job_id", jobId)],
    ["audit", sb.from("itad_audit_log").select("*").limit(5)],
  ]) { const r = await q; r.error ? bad(`${name}: ${r.error.message}`) : ok(`${name} (${r.data.length})`); }

  const cert = must(await sb.from("itad_certificates").insert({ job_id: jobId, issued_by: "E2E Tester", snapshot: { t: 1 }, snapshot_sha256: "abc" }).select().single(), "cert");
  ok("certificate " + cert.certificate_number);
  const tamper = await sb.from("itad_certificates").update({ snapshot: { t: 2 } }).eq("id", cert.id);
  tamper.error ? ok("cert tamper blocked") : bad("cert edited!");

  // sale + payout math column
  const s = must(await sb.from("itad_sales").insert({ asset_id: a.id, sale_price: 300, platform_fees: 40, shipping_cost: 20, payout_pct: 50, payout_amount: 120, payout_status: "owed", status: "sold" }).select().single(), "sale");
  Number(s.net_amount) === 240 ? ok("sale net 240") : bad("net " + s.net_amount);

  const ev = must(await sb.from("itad_custody_events").select("event_type").eq("asset_id", a.id), "events");
  ok("custody trail: " + ev.map((e) => e.event_type).join(" > "));

  const pdf = await PDFDocument.create(); pdf.addPage(); (await pdf.save()).length > 0 ? ok("pdf-lib ok") : bad("pdf");
} catch (e) {
  bad(e.message);
} finally {
  console.log(out.join("\n"));
  console.log(JSON.stringify({ uid, jobId }));
}
