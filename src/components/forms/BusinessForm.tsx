"use client";

import { useState } from "react";
import { submitBusiness } from "@/lib/actions/forms";

const initial = {
  legal_business_name: "",
  contact_name: "",
  contact_title: "",
  contact_phone: "",
  contact_email: "",
  preferred_contact_method: "phone",
  collection_address: "",
  address_city: "",
  address_zip: "",
  service_frequency_text: "",
  preferred_time_window: "",
  est_desktops: "",
  est_laptops: "",
  est_monitors_lcd: "",
  est_other_notes: "",
};

export function BusinessForm() {
  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);
    const result = await submitBusiness(form);
    setSubmitting(false);
    if (result.ok) {
      setForm(initial);
      setStatus({
        msg: "Thanks — your upcycle partnership request is in. We'll reach out to schedule a walkthrough.",
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
      <div className="field">
        <label>
          Legal business name <span className="req">*</span>
        </label>
        <input
          type="text"
          required
          value={form.legal_business_name}
          onChange={(e) => setForm({ ...form, legal_business_name: e.target.value })}
        />
      </div>
      <div className="row2">
        <div className="field">
          <label>
            Contact name <span className="req">*</span>
          </label>
          <input
            type="text"
            required
            value={form.contact_name}
            onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Title</label>
          <input
            type="text"
            value={form.contact_title}
            onChange={(e) => setForm({ ...form, contact_title: e.target.value })}
          />
        </div>
      </div>
      <div className="row2">
        <div className="field">
          <label>Contact phone</label>
          <input
            type="tel"
            value={form.contact_phone}
            onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
          />
        </div>
        <div className="field">
          <label>
            Contact email <span className="req">*</span>
          </label>
          <input
            type="email"
            required
            value={form.contact_email}
            onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
          />
        </div>
      </div>
      <div className="field">
        <label>Preferred contact method</label>
        <select
          value={form.preferred_contact_method}
          onChange={(e) => setForm({ ...form, preferred_contact_method: e.target.value })}
        >
          <option value="phone">Phone</option>
          <option value="email">Email</option>
        </select>
      </div>
      <div className="field">
        <label>Collection address</label>
        <input
          type="text"
          value={form.collection_address}
          onChange={(e) => setForm({ ...form, collection_address: e.target.value })}
        />
      </div>
      <div className="row2">
        <div className="field">
          <label>City</label>
          <input
            type="text"
            value={form.address_city}
            onChange={(e) => setForm({ ...form, address_city: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Zip</label>
          <input
            type="text"
            value={form.address_zip}
            onChange={(e) => setForm({ ...form, address_zip: e.target.value })}
          />
        </div>
      </div>
      <div className="row2">
        <div className="field">
          <label>
            How often do you need pickups? <span className="req">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. monthly, quarterly, one-time"
            required
            value={form.service_frequency_text}
            onChange={(e) => setForm({ ...form, service_frequency_text: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Preferred time window</label>
          <input
            type="text"
            placeholder="e.g. weekday mornings"
            value={form.preferred_time_window}
            onChange={(e) => setForm({ ...form, preferred_time_window: e.target.value })}
          />
        </div>
      </div>
      <div className="row2">
        <div className="field">
          <label>Approx. desktops</label>
          <input
            type="text"
            value={form.est_desktops}
            onChange={(e) => setForm({ ...form, est_desktops: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Approx. laptops</label>
          <input
            type="text"
            value={form.est_laptops}
            onChange={(e) => setForm({ ...form, est_laptops: e.target.value })}
          />
        </div>
      </div>
      <div className="field">
        <label>Anything else we should know?</label>
        <textarea
          value={form.est_other_notes}
          onChange={(e) => setForm({ ...form, est_other_notes: e.target.value })}
        />
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        {submitting ? "Submitting…" : "Request Partnership"}
      </button>
      {status && <div className={`form-status ${status.ok ? "ok" : "err"}`}>{status.msg}</div>}
    </form>
  );
}
