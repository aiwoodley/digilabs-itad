# DigiLabs ITAD — Intake + Device Ledger ("the bible") spec

Status: approved direction 2026-09-29 (Paul). Build pending new Supabase project.

## Decisions (from Paul)
- **Separate Supabase project for ITAD** (not the shared TechTank DB). Admin lives at `digilabs-itad.netlify.app/admin`.
- **Admins:** Paul + Peter only, both full access. No volunteer roles, no client portal (v1).
- **Public form:** customers give type / qty / condition / data flags. **We log serials at pickup** — chain of custody starts with our count.
- **Paperwork:** auto-generated serialized Certificate of Destruction PDFs, upload STS certs / weight tickets, **e-signatures on a phone at pickup**.
- **Lifecycle:** full — intake → custody → sanitization → disposition → eBay sale → client payout.

## 1. Public intake form (replaces the current drop-off + business forms)
Step 1 — who: Individual | Business. Contact, address, pickup vs drop-off, preferred dates/deadline.

Business adds: legal name, industry (drives regulatory flags: healthcare→HIPAA/BAA, finance→GLBA, school→FERPA, government), site logistics (dock/ground floor/stairs/elevator, pallet count), PO number, on-site contact.

Step 2 — device lines (repeatable): type, qty, brand/model (optional), approx age, powers on (Y/N/unknown), condition, **storage still inside**, **locks** (Apple ID/Activation Lock, Google FRP, Intune/Autopilot/ABM/MDM — released or not), damaged/swollen battery flag, CRT flag, optional photos.

Step 3 — data & service: sensitive data types (none/personal/health/financial/student/customer), destruction preference (wipe-and-reuse OK / shred only / on-site shredding requested), needs serialized certificate, auditor needs downstream partner certs, interest in resale revenue share.

Step 4 — attestations (required): I own this equipment / it isn't leased (or: leased — name the lessor); I'm authorized to release it; I authorize DigiLabs to sanitize or destroy data and to refurbish/resell/recycle; I've backed up what I need; privacy notice acknowledged.

Why these fields: they're what sets price and risk — resale value (type/age/powers on/locks), liability (storage + data class), logistics cost (qty, location, access), and hazmat handling (batteries, CRTs).

## 2. Data model (new ITAD project)
- `clients` (individual|business, industry, regulatory flags) + `contacts`
- `jobs` — one pickup/drop-off. Source: web | phone (Vapi) | admin. Status: new → quoted → scheduled → picked_up → received → processing → closed | cancelled. Holds quote, agreement/BAA links, trip fee.
- `job_lines` — what the customer declared (kept for reconciliation against what we actually received).
- `assets` — one per physical device we take custody of. Our asset tag (`DLA-000123`), make/model/serial, specs (CPU/RAM/storage), grade, lock status + release proof, photos, current status + location.
- `storage_media` — each drive (in an asset or loose): drive serial, HDD/SSD/NVMe/eMMC, capacity.
- `custody_events` — **append-only** trail per asset: collected, in transit, received, moved, sanitized, destroyed, transferred to partner, sold. Who, when, where, signature/photo refs.
- `sanitization_records` — per drive: NIST 800-88 method (Clear/Purge/Destroy), tool + version, verification result, technician, timestamp, log file.
- `downstream_partners` — STS: R2v3 cert #, NAID #, expiry dates, certificate files. **Expired cert blocks new transfers.**
- `transfers` (DL-401) — manifest to partner: assets/drives/weight, BOL, received-by signature, partner's certificate of recycling/destruction + weight tickets.
- `certificates` (DL-501) — our Certificate of Destruction: number, job, serial list, methods, partner cert reference, signer, PDF, SHA-256 of the PDF.
- `documents` — agreements (DL-201), destruction work orders (DL-301), BAAs, asset-release letters, uploads.
- `signatures` — signer name/role, image, timestamp, IP/user agent, hash of the document signed.
- `sales` — eBay item #, order #, sale price, fees, shipping, net, client payout %, payout amount/status/date.
- `audit_log` — trigger-written on every insert/update. No hard deletes on custody/sanitization/certificate records (void with reason instead).

Existing DL-101…DL-501 form numbering is kept as document types.

## 3. Compliance built in
- Chain of custody per serial, starting at pickup, append-only, signed at handoffs.
- NIST 800-88 record per drive; certificate can't be issued until every drive in the job has a sanitization or destruction record.
- Downstream (R2v3) partner documentation attached to each transfer; honest "certified partner" language on certificates.
- BAA required flag on healthcare jobs — job can't move to scheduled without a signed BAA uploaded.
- Leased / MDM-locked / third-party-config devices: require release proof before wipe (the Cisco 9200CX rule).
- Lithium battery / CRT flags for separate handling and transport.
- Privacy: collect only what's needed; FIPA (Fla. Stat. 501.171) applies to the customer PII we hold. RLS: admins only, public form writes via a server-side function. Private storage buckets for photos/docs (photos can show data or asset tags).
- **We never image or store drive contents** — the database holds device metadata only, which keeps the ledger itself out of PHI scope.
- Retention: keep custody/sanitization/certificate records at least 3 years (R2v3 norm); longer if a client contract requires it.
- Payouts to individuals may raise 1099 questions — confirm with accountant.

## 4. Admin screens
Dashboard (open jobs, assets by status, certs due, partner cert expiry) · Jobs (intake queue → quote → schedule) · Pickup mode (phone: scan/enter serials, photos, e-sign) · Assets (search by serial/tag, full history) · Sanitization queue · Transfers to STS · Certificates · Sales & payouts · Partners · Audit log. CSV export everywhere.
