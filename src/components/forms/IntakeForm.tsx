"use client";

import { useState } from "react";
import { submitIntake, type IntakeLine } from "@/lib/actions/intake";

const DEVICE_TYPES = [
  "Laptop", "Desktop", "All-in-one", "Server", "Monitor (LCD/LED)", "Monitor (CRT)", "Phone", "Tablet",
  "Network gear (switch/router/firewall/AP)", "Printer/copier", "Loose hard drives/SSDs", "UPS / battery backup",
  "TV", "Cables & accessories", "Other",
];
const DATA_TYPES: [string, string][] = [
  ["personal", "Personal files / photos"],
  ["customer", "Customer records"],
  ["employee", "Employee / HR records"],
  ["financial", "Financial / payment data"],
  ["health", "Patient / health information"],
  ["student", "Student records"],
  ["government", "Government / controlled data"],
  ["none", "Nothing sensitive"],
  ["unsure", "Not sure"],
];

const blankLine = (): IntakeLine => ({
  device_type: "Laptop", quantity: 1, brand_model: "", approx_age: "", powers_on: "unknown", condition: "",
  storage_inside: "unknown", lock_status: "unknown", battery_issue: false, crt: false, notes: "",
});

export function IntakeForm({ defaultType = "individual" }: { defaultType?: "individual" | "business" }) {
  const [clientType, setClientType] = useState<"individual" | "business">(defaultType);
  const [f, setF] = useState({
    business_name: "", industry: "", contact_name: "", contact_title: "", email: "", phone: "", preferred_contact: "phone",
    address: "", city: "", zip: "", service_type: "pickup", preferred_date: "", deadline: "", site_access: "",
    pallet_estimate: "", po_number: "", onsite_contact: "", destruction_preference: "unsure",
    wants_serialized_cert: true, needs_partner_certs: false, resale_share_interest: false,
    equipment_leased: false, lessor_name: "", customer_notes: "",
  });
  const [dataTypes, setDataTypes] = useState<string[]>([]);
  const [lines, setLines] = useState<IntakeLine[]>([blankLine()]);
  const [att, setAtt] = useState({ owner: false, authorized: false, destruction: false, backup: false, privacy: false });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  const setLine = (i: number, k: keyof IntakeLine, v: string | number | boolean) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const toggleData = (k: string) =>
    setDataTypes((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d.filter((x) => x !== "none" || k === "none"), k]));
  const isBiz = clientType === "business";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const res = await submitIntake({
      ...f,
      client_type: clientType,
      data_types: dataTypes,
      lines,
      attest_owner: att.owner, attest_authorized: att.authorized, attest_destruction: att.destruction,
      attest_backup: att.backup, attest_privacy: att.privacy,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    });
    setBusy(false);
    if (res.ok) {
      setStatus({ ok: true, msg: `Request received. Your reference number is ${res.jobNumber}. We'll reach out within one business day to confirm details and timing.` });
      setLines([blankLine()]);
      setAtt({ owner: false, authorized: false, destruction: false, backup: false, privacy: false });
    } else {
      setStatus({ ok: false, msg: res.error });
    }
  }

  return (
    <form className="stack intake" onSubmit={onSubmit}>
      <div className="seg" role="radiogroup" aria-label="Who is this for?">
        <button type="button" className={!isBiz ? "on" : ""} onClick={() => setClientType("individual")} aria-pressed={!isBiz}>Individual / household</button>
        <button type="button" className={isBiz ? "on" : ""} onClick={() => setClientType("business")} aria-pressed={isBiz}>Business / organization</button>
      </div>

      <fieldset>
        <legend>1 · Contact</legend>
        <div className="stack">
          {isBiz && (
            <div className="row2">
              <div className="field"><label>Business name <span className="req">*</span></label>
                <input type="text" required value={f.business_name} onChange={(e) => set("business_name", e.target.value)} /></div>
              <div className="field"><label>Industry</label>
                <select value={f.industry} onChange={(e) => set("industry", e.target.value)}>
                  <option value="">Select…</option>
                  <option value="healthcare">Healthcare / medical / dental</option>
                  <option value="finance">Finance / insurance / accounting</option>
                  <option value="legal">Legal</option>
                  <option value="education">School / education</option>
                  <option value="government">Government</option>
                  <option value="nonprofit">Nonprofit</option>
                  <option value="technology">Technology / MSP</option>
                  <option value="retail">Retail / hospitality</option>
                  <option value="real_estate">Real estate / property management</option>
                  <option value="other">Other</option>
                </select></div>
            </div>
          )}
          <div className="row2">
            <div className="field"><label>Your name <span className="req">*</span></label>
              <input type="text" required value={f.contact_name} onChange={(e) => set("contact_name", e.target.value)} /></div>
            {isBiz ? (
              <div className="field"><label>Title</label>
                <input type="text" value={f.contact_title} onChange={(e) => set("contact_title", e.target.value)} /></div>
            ) : (
              <div className="field"><label>Best way to reach you</label>
                <select value={f.preferred_contact} onChange={(e) => set("preferred_contact", e.target.value)}>
                  <option value="phone">Call</option><option value="text">Text</option><option value="email">Email</option>
                </select></div>
            )}
          </div>
          <div className="row2">
            <div className="field"><label>Phone <span className="req">*</span></label>
              <input type="tel" required value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
            <div className="field"><label>Email {isBiz && <span className="req">*</span>}</label>
              <input type="email" required={isBiz} value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>2 · Pickup</legend>
        <div className="stack">
          <div className="field"><label>Pickup or drop-off?</label>
            <select value={f.service_type} onChange={(e) => set("service_type", e.target.value)}>
              <option value="pickup">Pick it up from me</option><option value="dropoff">I&apos;ll drop it off</option>
            </select></div>
          <div className="field"><label>Street address {f.service_type === "pickup" && <span className="req">*</span>}</label>
            <input type="text" required={f.service_type === "pickup"} value={f.address} onChange={(e) => set("address", e.target.value)} /></div>
          <div className="row2">
            <div className="field"><label>City <span className="req">*</span></label>
              <input type="text" required value={f.city} onChange={(e) => set("city", e.target.value)} /></div>
            <div className="field"><label>Zip</label>
              <input type="text" inputMode="numeric" value={f.zip} onChange={(e) => set("zip", e.target.value)} /></div>
          </div>
          <div className="row2">
            <div className="field"><label>Preferred date</label>
              <input type="date" value={f.preferred_date} onChange={(e) => set("preferred_date", e.target.value)} /></div>
            <div className="field"><label>Must be gone by</label>
              <input type="date" value={f.deadline} onChange={(e) => set("deadline", e.target.value)} /></div>
          </div>
          {isBiz && (
            <>
              <div className="field"><label>Site access</label>
                <input type="text" placeholder="e.g. loading dock, ground floor, 3rd floor with elevator, gated lot" value={f.site_access} onChange={(e) => set("site_access", e.target.value)} /></div>
              <div className="row2">
                <div className="field"><label>Rough volume</label>
                  <input type="text" placeholder="e.g. a closet, half a room, 2 pallets" value={f.pallet_estimate} onChange={(e) => set("pallet_estimate", e.target.value)} /></div>
                <div className="field"><label>PO number (if required)</label>
                  <input type="text" value={f.po_number} onChange={(e) => set("po_number", e.target.value)} /></div>
              </div>
              <div className="field"><label>On-site contact for pickup day</label>
                <input type="text" placeholder="Name and phone, if different from you" value={f.onsite_contact} onChange={(e) => set("onsite_contact", e.target.value)} /></div>
            </>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend>3 · Devices</legend>
        <p className="form-note mt0">Rough counts are fine. We log every serial number ourselves at pickup.</p>
        <div className="stack">
          {lines.map((l, i) => (
            <div className="line-card" key={i}>
              <div className="row2">
                <div className="field"><label>Type</label>
                  <select value={l.device_type} onChange={(e) => setLine(i, "device_type", e.target.value)}>
                    {DEVICE_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select></div>
                <div className="field"><label>How many?</label>
                  <input type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, "quantity", Number(e.target.value) || 1)} /></div>
              </div>
              <div className="row2">
                <div className="field"><label>Brand / model (optional)</label>
                  <input type="text" placeholder="e.g. Dell Latitude 5420" value={l.brand_model} onChange={(e) => setLine(i, "brand_model", e.target.value)} /></div>
                <div className="field"><label>Approx. age</label>
                  <select value={l.approx_age} onChange={(e) => setLine(i, "approx_age", e.target.value)}>
                    <option value="">Not sure</option><option value="0-3">Under 3 years</option><option value="3-5">3–5 years</option>
                    <option value="5-8">5–8 years</option><option value="8+">8+ years</option>
                  </select></div>
              </div>
              <div className="row2">
                <div className="field"><label>Does it power on?</label>
                  <select value={l.powers_on} onChange={(e) => setLine(i, "powers_on", e.target.value)}>
                    <option value="unknown">Not sure</option><option value="yes">Yes</option><option value="no">No</option>
                  </select></div>
                <div className="field"><label>Condition</label>
                  <select value={l.condition} onChange={(e) => setLine(i, "condition", e.target.value)}>
                    <option value="">Not sure</option><option value="working">Working, good shape</option>
                    <option value="cosmetic">Works, cosmetic wear</option><option value="damaged">Damaged / broken</option>
                    <option value="parts">Parts only</option>
                  </select></div>
              </div>
              <div className="row2">
                <div className="field"><label>Hard drives / storage still inside?</label>
                  <select value={l.storage_inside} onChange={(e) => setLine(i, "storage_inside", e.target.value)}>
                    <option value="unknown">Not sure</option><option value="yes">Yes</option>
                    <option value="removed">Removed (sending separately)</option><option value="no">No storage</option>
                  </select></div>
                <div className="field"><label>Account / device locks?</label>
                  <select value={l.lock_status} onChange={(e) => setLine(i, "lock_status", e.target.value)}>
                    <option value="unknown">Not sure</option><option value="none">None</option>
                    <option value="released">Were locked, now released</option>
                    <option value="locked">Still locked (Apple ID, Google, Intune/Autopilot, MDM)</option>
                  </select></div>
              </div>
              <label className="checkline"><input type="checkbox" checked={l.battery_issue} onChange={(e) => setLine(i, "battery_issue", e.target.checked)} />
                Some have swollen, leaking or damaged batteries</label>
              {lines.length > 1 && (
                <button type="button" className="link-btn" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>Remove this line</button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-outline" onClick={() => setLines((ls) => [...ls, blankLine()])}>+ Add another device type</button>
        </div>
      </fieldset>

      <fieldset>
        <legend>4 · Data &amp; service</legend>
        <div className="stack">
          <div className="field"><label>What kind of data could be on these devices?</label>
            <div className="pledge-grid">
              {DATA_TYPES.map(([k, label]) => (
                <label className="checkline" key={k}><input type="checkbox" checked={dataTypes.includes(k)} onChange={() => toggleData(k)} />{label}</label>
              ))}
            </div></div>
          <div className="field"><label>How should drives be handled?</label>
            <select value={f.destruction_preference} onChange={(e) => set("destruction_preference", e.target.value)}>
              <option value="unsure">Recommend something for me</option>
              <option value="wipe_ok">Certified wipe is fine (lets working devices be reused)</option>
              <option value="shred_only">Physically shred every drive</option>
              {isBiz && <option value="onsite_shred">I need on-site destruction / witnessed</option>}
            </select></div>
          {isBiz && (
            <>
              <label className="checkline"><input type="checkbox" checked={f.needs_partner_certs} onChange={(e) => set("needs_partner_certs", e.target.checked)} />
                Our auditor / compliance team will need downstream recycler certificates</label>
              <label className="checkline"><input type="checkbox" checked={f.equipment_leased} onChange={(e) => set("equipment_leased", e.target.checked)} />
                Some of this equipment is leased</label>
              {f.equipment_leased && (
                <div className="field"><label>Leasing company</label>
                  <input type="text" value={f.lessor_name} onChange={(e) => set("lessor_name", e.target.value)} /></div>
              )}
            </>
          )}
          <label className="checkline"><input type="checkbox" checked={f.resale_share_interest} onChange={(e) => set("resale_share_interest", e.target.checked)} />
            I&apos;m interested in a share of resale value on working devices</label>
          <div className="field"><label>Anything else we should know?</label>
            <textarea value={f.customer_notes} onChange={(e) => set("customer_notes", e.target.value)} /></div>
        </div>
      </fieldset>

      <fieldset>
        <legend>5 · Confirm</legend>
        <div className="stack">
          <label className="checkline"><input type="checkbox" required checked={att.owner} onChange={(e) => setAtt({ ...att, owner: e.target.checked })} />
            {isBiz ? "The organization owns this equipment, or I've noted any leased items above." : "I own this equipment."}</label>
          <label className="checkline"><input type="checkbox" required checked={att.authorized} onChange={(e) => setAtt({ ...att, authorized: e.target.checked })} />
            I&apos;m authorized to release it to DigiLabs ITAD.</label>
          <label className="checkline"><input type="checkbox" required checked={att.destruction} onChange={(e) => setAtt({ ...att, destruction: e.target.checked })} />
            I authorize DigiLabs to sanitize or destroy all data on these devices, and to refurbish, resell, donate or recycle them.</label>
          <label className="checkline"><input type="checkbox" required checked={att.backup} onChange={(e) => setAtt({ ...att, backup: e.target.checked })} />
            I&apos;ve backed up anything I want to keep. Data can&apos;t be recovered after pickup.</label>
          <label className="checkline"><input type="checkbox" required checked={att.privacy} onChange={(e) => setAtt({ ...att, privacy: e.target.checked })} />
            I understand DigiLabs uses my contact details only to handle this request and keep compliance records, and never sells them.</label>
          <p className="form-note mb0">
            Final shredding and recycling are handled by our R2v3-certified downstream partner. This is a request, not a contract.
            We&apos;ll confirm pricing and timing before anything is scheduled.
          </p>
        </div>
      </fieldset>

      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? "Sending…" : "Submit request"}</button>
      {status && <p className={`form-status ${status.ok ? "ok" : "err"}`} role="status">{status.msg}</p>}
    </form>
  );
}
