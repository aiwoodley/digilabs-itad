"use client";

import { useState } from "react";
import { submitDropoff } from "@/lib/actions/forms";

const initial = {
  full_name: "",
  phone: "",
  email: "",
  street_address: "",
  city: "",
  zip: "",
  drop_off_date: "",
  device_description: "",
  data_backed_up: false,
  confirm_ownership: false,
  authorize_destruction: false,
};

export function DropoffForm() {
  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);
    const result = await submitDropoff(form);
    setSubmitting(false);
    if (result.ok) {
      setForm(initial);
      setStatus({
        msg: "Request received — we'll follow up to confirm your pickup or drop-off window.",
        ok: true,
      });
    } else {
      setStatus({
        msg: "Something went wrong submitting this. Please call 754-274-6614 and we'll take it over the phone.",
        ok: false,
      });
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <div className="row2">
        <div className="field">
          <label>
            Full name <span className="req">*</span>
          </label>
          <input
            type="text"
            required
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </div>
        <div className="field">
          <label>
            Phone <span className="req">*</span>
          </label>
          <input
            type="tel"
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
      </div>
      <div className="field">
        <label>Email</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <div className="field">
        <label>
          Street address <span className="req">*</span>
        </label>
        <input
          type="text"
          required
          value={form.street_address}
          onChange={(e) => setForm({ ...form, street_address: e.target.value })}
        />
      </div>
      <div className="row2">
        <div className="field">
          <label>
            City <span className="req">*</span>
          </label>
          <input
            type="text"
            required
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Zip</label>
          <input
            type="text"
            value={form.zip}
            onChange={(e) => setForm({ ...form, zip: e.target.value })}
          />
        </div>
      </div>
      <div className="field">
        <label>Preferred date</label>
        <input
          type="date"
          value={form.drop_off_date}
          onChange={(e) => setForm({ ...form, drop_off_date: e.target.value })}
        />
      </div>
      <div className="field">
        <label>What are you dropping off / donating?</label>
        <textarea
          placeholder="e.g. 3 laptops, 1 desktop tower, old monitors"
          value={form.device_description}
          onChange={(e) => setForm({ ...form, device_description: e.target.value })}
        />
      </div>
      <label className="checkline">
        <input
          type="checkbox"
          checked={form.data_backed_up}
          onChange={(e) => setForm({ ...form, data_backed_up: e.target.checked })}
        />
        I&apos;ve backed up any data I want to keep
      </label>
      <label className="checkline">
        <input
          type="checkbox"
          checked={form.confirm_ownership}
          onChange={(e) => setForm({ ...form, confirm_ownership: e.target.checked })}
        />
        I confirm I own this equipment
      </label>
      <label className="checkline">
        <input
          type="checkbox"
          checked={form.authorize_destruction}
          onChange={(e) => setForm({ ...form, authorize_destruction: e.target.checked })}
        />
        I authorize DigiLabs to securely destroy any data on these devices
      </label>
      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit Request"}
      </button>
      {status && <div className={`form-status ${status.ok ? "ok" : "err"}`}>{status.msg}</div>}
    </form>
  );
}
