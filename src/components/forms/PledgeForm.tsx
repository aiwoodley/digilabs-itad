"use client";

import { useState } from "react";
import { submitPledge } from "@/lib/actions/forms";

const initial = {
  first_name: "",
  last_name: "",
  email: "",
  pledge_type: "individual",
  school_name: "",
  city: "",
  grade_level: "",
  pledge_recycle: true,
  pledge_educate: true,
  pledge_reduce: true,
  pledge_advocate: true,
  pledge_message: "",
  show_on_wall: true,
};

export function PledgeForm({ onSigned }: { onSigned?: () => void }) {
  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);
    const result = await submitPledge(form);
    setSubmitting(false);
    if (result.ok) {
      setForm(initial);
      setStatus({
        msg: "Pledge received! New pledges are reviewed before appearing on the wall below.",
        ok: true,
      });
      onSigned?.();
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
            First name <span className="req">*</span>
          </label>
          <input
            type="text"
            required
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
          />
        </div>
        <div className="field">
          <label>
            Last name <span className="req">*</span>
          </label>
          <input
            type="text"
            required
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
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
      <div className="row2">
        <div className="field">
          <label>I&apos;m signing as</label>
          <select
            value={form.pledge_type}
            onChange={(e) => setForm({ ...form, pledge_type: e.target.value })}
          >
            <option value="individual">Individual</option>
            <option value="student">Student</option>
            <option value="educator">Educator</option>
            <option value="organization">Organization / Business</option>
          </select>
        </div>
        <div className="field">
          <label>School or organization (optional)</label>
          <input
            type="text"
            value={form.school_name}
            onChange={(e) => setForm({ ...form, school_name: e.target.value })}
          />
        </div>
      </div>
      <div className="row2">
        <div className="field">
          <label>City</label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Grade level (if a student)</label>
          <input
            type="text"
            placeholder="e.g. 9th grade"
            value={form.grade_level}
            onChange={(e) => setForm({ ...form, grade_level: e.target.value })}
          />
        </div>
      </div>

      <fieldset>
        <legend>My pledge</legend>
        <div className="pledge-grid">
          <label className="checkline">
            <input
              type="checkbox"
              checked={form.pledge_recycle}
              onChange={(e) => setForm({ ...form, pledge_recycle: e.target.checked })}
            />
            Recycle my e-waste responsibly, not in the trash
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={form.pledge_educate}
              onChange={(e) => setForm({ ...form, pledge_educate: e.target.checked })}
            />
            Educate others about e-waste and data security
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={form.pledge_reduce}
              onChange={(e) => setForm({ ...form, pledge_reduce: e.target.checked })}
            />
            Reduce unnecessary device turnover
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={form.pledge_advocate}
              onChange={(e) => setForm({ ...form, pledge_advocate: e.target.checked })}
            />
            Advocate for responsible recycling in my community
          </label>
        </div>
      </fieldset>

      <div className="field">
        <label>Add a short message (optional, shown on the wall)</label>
        <textarea
          placeholder="Why this matters to you"
          value={form.pledge_message}
          onChange={(e) => setForm({ ...form, pledge_message: e.target.value })}
        />
      </div>

      <label className="checkline">
        <input
          type="checkbox"
          checked={form.show_on_wall}
          onChange={(e) => setForm({ ...form, show_on_wall: e.target.checked })}
        />
        Show my name on the public pledge wall
      </label>

      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        {submitting ? "Submitting…" : "Sign the Pledge"}
      </button>
      {status && <div className={`form-status ${status.ok ? "ok" : "err"}`}>{status.msg}</div>}
      <p className="form-note mb0">
        New pledges are reviewed before appearing on the wall below — usually within a day or two.
      </p>
    </form>
  );
}
