// Vapi tool-call webhook for DigiLabs ITAD phone booking agent.
// Vapi calls this during a live call when the assistant invokes the
// "book_pickup" or "escalate" tool. Writes into the SAME Supabase tables the
// website's own booking forms use (dl101_dropoff / dl101_devices /
// dl201_commercial), so a phone booking becomes an identical ticket to a
// website submission - no separate system to reconcile. Uses the anon key,
// matching src/lib/actions/forms.ts in the Next.js app (these tables accept
// public inserts via RLS; there is no privileged write here).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://sqxdlaeoeawhimvwkoln.supabase.co";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const VAPI_WEBHOOK_SECRET = Deno.env.get("VAPI_WEBHOOK_SECRET");

// Escalation delivery: SMS via Twilio + email via the shared send-email function.
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER"); // the new AI line
const ESCALATION_SMS_TO = (Deno.env.get("ESCALATION_SMS_TO") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const ESCALATION_EMAIL_TO = (Deno.env.get("ESCALATION_EMAIL_TO") ?? "admin@digi-labs.org").split(",").map((s) => s.trim()).filter(Boolean);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vapi-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function ticketNumber(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

// Vapi's tool-call payload shape: { message: { toolCalls: [{ id, function: { name, arguments } }] } }
// Response shape it expects back: { results: [{ toolCallId, result: "<string the model reads back>" }] }
interface VapiToolCall {
  id: string;
  function: { name: string; arguments: Record<string, unknown> | string };
}

function parseArgs(raw: Record<string, unknown> | string): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw ?? {};
}

async function sendEscalationSms(text: string) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER || ESCALATION_SMS_TO.length === 0) {
    console.warn("SMS escalation skipped: Twilio not fully configured");
    return;
  }
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  for (const to of ESCALATION_SMS_TO) {
    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER, Body: text }),
        },
      );
      if (!res.ok) console.warn("SMS escalation failed:", res.status, await res.text());
    } catch (err) {
      console.warn("SMS escalation request failed:", err);
    }
  }
}

async function sendEscalationEmail(subject: string, summary: string) {
  for (const to of ESCALATION_EMAIL_TO) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({
          type: "phone_escalation",
          to,
          data: { subject, summary },
        }),
      });
      if (!res.ok) console.warn("Escalation email not sent:", to, res.status, await res.text());
    } catch (err) {
      console.warn("Escalation email request failed:", to, err);
    }
  }
}

function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

async function handleBookPickup(args: Record<string, unknown>, supabase: ReturnType<typeof createClient>) {
  const kind = String(args.kind ?? "residential").toLowerCase();

  if (kind === "commercial" || kind === "business") {
    const contract = ticketNumber("BIZ");
    const { error } = await supabase.from("dl201_commercial").insert({
      contract_number: contract,
      legal_business_name: args.legal_business_name ?? args.business_name ?? "Unknown",
      contact_name: args.contact_name ?? args.full_name ?? "Unknown",
      contact_title: args.contact_title ?? null,
      contact_phone: args.contact_phone ?? args.phone ?? null,
      contact_email: args.contact_email ?? args.email ?? "no-email-provided@digi-labs.org",
      preferred_contact_method: args.preferred_contact_method ?? "phone",
      collection_address: args.collection_address ?? args.street_address ?? null,
      address_city: args.address_city ?? args.city ?? null,
      address_state: "FL",
      address_zip: args.address_zip ?? args.zip ?? null,
      service_frequency_text: args.service_frequency_text ?? "one-time (details pending team follow-up)",
      preferred_time_window: args.preferred_time_window ?? null,
      est_desktops: toIntOrNull(args.est_desktops),
      est_laptops: toIntOrNull(args.est_laptops),
      est_monitors_lcd: toIntOrNull(args.est_monitors_lcd),
      est_other_notes: args.device_description ?? args.est_other_notes ?? null,
    });
    if (error) {
      console.error(error);
      return { ok: false, message: "I couldn't complete the booking just now - I'll have someone follow up directly to get this scheduled." };
    }
    return { ok: true, ticket: contract, message: `Booked. Reference number ${contract}. Our team will follow up to confirm timing.` };
  }

  // Generate the id ourselves - the anon role can INSERT into dl101_dropoff
  // (RLS policy anon_insert_dl101) but has no SELECT policy, so .select() on
  // the insert (which requires an implicit read-back) fails RLS even though
  // the insert itself would succeed. Supplying our own id avoids ever needing
  // Postgres to hand a row back to the anon role.
  const ticket = ticketNumber("DL");
  const dropoffId = crypto.randomUUID();
  const { error } = await supabase
    .from("dl101_dropoff")
    .insert({
      id: dropoffId,
      ticket_number: ticket,
      drop_off_date: args.drop_off_date ?? new Date().toISOString().slice(0, 10),
      full_name: args.full_name ?? args.name ?? "Unknown",
      street_address: args.street_address ?? args.address ?? "Unknown",
      city: args.city ?? "Unknown",
      state: "FL",
      zip: args.zip ?? null,
      email: args.email ?? null,
      phone: args.phone ?? null,
      data_backed_up: Boolean(args.data_backed_up ?? false),
      authorize_destruction: Boolean(args.authorize_destruction ?? false),
      confirm_ownership: Boolean(args.confirm_ownership ?? false),
    });

  if (error) {
    console.error(error);
    return { ok: false, message: "I couldn't complete the booking just now - I'll have someone follow up directly to get this scheduled." };
  }

  if (args.device_description) {
    const { error: deviceError } = await supabase.from("dl101_devices").insert({
      dropoff_id: dropoffId,
      line_number: 1,
      device_type: String(args.device_description),
    });
    if (deviceError) console.error("device insert failed (booking still succeeded):", deviceError);
  }

  return { ok: true, ticket, message: `Booked. Reference number ${ticket}. Our team will follow up to confirm the pickup window.` };
}

async function handleEscalate(args: Record<string, unknown>) {
  const name = String(args.name ?? args.full_name ?? "Unknown caller");
  const phone = String(args.phone ?? args.contact_phone ?? "no callback number given");
  const reason = String(args.reason ?? args.summary ?? "No summary provided");
  const summary = `Escalated call - ${name} (${phone}): ${reason}`;

  await Promise.all([
    sendEscalationSms(summary.slice(0, 300)),
    sendEscalationEmail("DigiLabs ITAD - phone escalation, needs callback", summary),
  ]);

  return { ok: true, message: "I've passed this along and someone from our team will get back to you by the next business day." };
}

// ---------------------------------------------------------------------------
// End-of-call report: Vapi posts this after every call ends. Email a summary,
// the outcome (booked / escalated / neither), the recording link, and the full
// transcript to CALL_REPORT_EMAIL_TO. Sent straight through Resend (the same
// RESEND_API_KEY and from-address as send-email) so it never depends on a
// template deploy.
// ---------------------------------------------------------------------------
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const CALL_REPORT_EMAIL_TO = (Deno.env.get("CALL_REPORT_EMAIL_TO") ?? "admin@digi-labs.org")
  .split(",").map((s) => s.trim()).filter(Boolean);

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// deno-lint-ignore no-explicit-any
async function sendCallReport(msg: any) {
  if (!RESEND_API_KEY) {
    console.warn("call report skipped: RESEND_API_KEY not set");
    return;
  }
  const call = msg.call ?? {};
  const caller = call.customer?.number ?? msg.customer?.number ?? "unknown number";
  const started = msg.startedAt ?? call.startedAt;
  const ended = msg.endedAt ?? call.endedAt;
  const durationSec = msg.durationSeconds ??
    (started && ended ? Math.round((Date.parse(ended) - Date.parse(started)) / 1000) : null);
  const summary = msg.analysis?.summary ?? msg.summary ?? "(no summary generated)";
  const transcript: string = msg.artifact?.transcript ?? msg.transcript ?? "";
  const recording = msg.artifact?.recordingUrl ?? msg.recordingUrl ?? msg.stereoRecordingUrl ?? null;

  // Work out the outcome from the tool calls made during the call.
  // deno-lint-ignore no-explicit-any
  const messages: any[] = msg.artifact?.messages ?? msg.messages ?? [];
  const toolNames = new Set<string>();
  let ticket: string | null = null;
  for (const m of messages) {
    for (const tc of m.toolCalls ?? []) if (tc?.function?.name) toolNames.add(tc.function.name);
    const text = typeof m.result === "string" ? m.result : typeof m.message === "string" ? m.message : "";
    const hit = text.match(/\b(DL|BIZ)-[A-Z0-9]+\b/);
    if (hit) ticket = hit[0];
  }
  const outcome = toolNames.has("book_pickup")
    ? `Booked${ticket ? ` (ticket ${ticket})` : ""}`
    : toolNames.has("escalate") ? "Escalated, needs a callback by the next business day" : "No booking (question or hang-up)";

  const when = started
    ? new Date(started).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" })
    : "unknown time";
  const subject = `Call report: ${outcome.split(" (")[0]} (${caller}, ${when})`;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111">
    <img src="https://www.digi-labs.org/assets/digilabs-icon.png" width="40" height="40" alt="DigiLabs" style="display:block;margin-bottom:8px">
    <h2 style="margin:0 0 12px">DigiLabs ITAD: phone call report</h2>
    <table style="border-collapse:collapse;font-size:14px;margin-bottom:16px">
      <tr><td style="padding:4px 12px 4px 0;color:#555">Caller</td><td><a href="tel:${esc(caller)}">${esc(caller)}</a></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555">When</td><td>${esc(when)} ET</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555">Duration</td><td>${durationSec != null ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s` : "n/a"}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555">Outcome</td><td><strong>${esc(outcome)}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#555">Ended</td><td>${esc(msg.endedReason ?? "")}</td></tr>
      ${recording ? `<tr><td style="padding:4px 12px 4px 0;color:#555">Recording</td><td><a href="${esc(recording)}">Listen</a></td></tr>` : ""}
    </table>
    <h3 style="margin:0 0 6px">Summary</h3>
    <p style="font-size:14px;line-height:1.5;margin:0 0 16px">${esc(summary)}</p>
    <h3 style="margin:0 0 6px">Transcript</h3>
    <pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.5;background:#f5f7fa;padding:12px;border-radius:6px">${esc(transcript || "(empty)")}</pre>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "DigiLabs <admin@digi-labs.org>", to: CALL_REPORT_EMAIL_TO, subject, html }),
    });
    if (!res.ok) console.warn("call report email failed:", res.status, await res.text());
  } catch (err) {
    console.warn("call report email request failed:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (VAPI_WEBHOOK_SECRET) {
    const provided = req.headers.get("x-vapi-secret");
    if (provided !== VAPI_WEBHOOK_SECRET) return json({ error: "unauthorized" }, 401);
  }

  // deno-lint-ignore no-explicit-any
  let body: { message?: { type?: string; toolCalls?: VapiToolCall[]; [k: string]: any } };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  if (body.message?.type === "end-of-call-report") {
    await sendCallReport(body.message);
    return json({ ok: true });
  }

  const toolCalls = body.message?.toolCalls ?? [];
  if (toolCalls.length === 0) return json({ results: [] });

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const results = [];

  for (const call of toolCalls) {
    const args = parseArgs(call.function.arguments);
    let outcome: { ok: boolean; message: string; ticket?: string };

    if (call.function.name === "book_pickup") {
      outcome = await handleBookPickup(args, supabase);
    } else if (call.function.name === "escalate") {
      outcome = await handleEscalate(args);
    } else {
      outcome = { ok: false, message: `Unknown tool: ${call.function.name}` };
    }

    results.push({ toolCallId: call.id, result: outcome.message });
  }

  return json({ results });
});
