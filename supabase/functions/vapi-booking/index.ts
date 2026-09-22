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
const ESCALATION_EMAIL_TO = Deno.env.get("ESCALATION_EMAIL_TO") ?? "admin@digi-labs.org";

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
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({
        type: "phone_escalation",
        to: ESCALATION_EMAIL_TO,
        data: { subject, summary },
      }),
    });
    if (!res.ok) console.warn("Escalation email not sent:", res.status, await res.text());
  } catch (err) {
    console.warn("Escalation email request failed:", err);
  }
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
      contact_email: args.contact_email ?? args.email ?? null,
      preferred_contact_method: args.preferred_contact_method ?? "phone",
      collection_address: args.collection_address ?? args.street_address ?? null,
      address_city: args.address_city ?? args.city ?? null,
      address_state: "FL",
      address_zip: args.address_zip ?? args.zip ?? null,
      service_frequency_text: args.service_frequency_text ?? null,
      preferred_time_window: args.preferred_time_window ?? null,
      est_desktops: args.est_desktops ?? null,
      est_laptops: args.est_laptops ?? null,
      est_monitors_lcd: args.est_monitors_lcd ?? null,
      est_other_notes: args.device_description ?? args.est_other_notes ?? null,
    });
    if (error) {
      console.error(error);
      return { ok: false, message: "I couldn't complete the booking just now - I'll have someone follow up directly to get this scheduled." };
    }
    return { ok: true, ticket: contract, message: `Booked. Reference number ${contract}. Our team will follow up to confirm timing.` };
  }

  // residential / drop-off (default)
  const ticket = ticketNumber("DL");
  const { data, error } = await supabase
    .from("dl101_dropoff")
    .insert({
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
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error(error);
    return { ok: false, message: "I couldn't complete the booking just now - I'll have someone follow up directly to get this scheduled." };
  }

  if (args.device_description) {
    await supabase.from("dl101_devices").insert({
      dropoff_id: data.id,
      line_number: 1,
      device_type: String(args.device_description),
    });
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (VAPI_WEBHOOK_SECRET) {
    const provided = req.headers.get("x-vapi-secret");
    if (provided !== VAPI_WEBHOOK_SECRET) return json({ error: "unauthorized" }, 401);
  }

  let body: { message?: { toolCalls?: VapiToolCall[] } };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
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
