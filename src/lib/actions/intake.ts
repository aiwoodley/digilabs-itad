"use server";

import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/notify";

export interface IntakeLine {
  device_type: string;
  quantity: number;
  brand_model: string;
  approx_age: string;
  powers_on: string;
  condition: string;
  storage_inside: string;
  lock_status: string;
  battery_issue: boolean;
  crt: boolean;
  notes: string;
}

export interface IntakeInput {
  client_type: "individual" | "business";
  business_name?: string;
  industry?: string;
  contact_name: string;
  contact_title?: string;
  email?: string;
  phone?: string;
  preferred_contact?: string;
  address?: string;
  city?: string;
  zip?: string;
  service_type?: string;
  preferred_date?: string;
  deadline?: string;
  site_access?: string;
  pallet_estimate?: string;
  po_number?: string;
  onsite_contact?: string;
  data_types: string[];
  destruction_preference?: string;
  wants_serialized_cert?: boolean;
  needs_partner_certs?: boolean;
  resale_share_interest?: boolean;
  equipment_leased?: boolean;
  lessor_name?: string;
  customer_notes?: string;
  lines: IntakeLine[];
  attest_owner: boolean;
  attest_authorized: boolean;
  attest_destruction: boolean;
  attest_backup: boolean;
  attest_privacy: boolean;
  user_agent?: string;
}

// All validation, field truncation, regulatory flagging (HIPAA/GLBA/FERPA/FIPA)
// and the ITAD-admin-only storage happen inside the security-definer
// itad_submit_intake() RPC. The anon key can call that function and nothing
// else in the itad_ tables.
export async function submitIntake(input: IntakeInput): Promise<{ ok: true; jobNumber: string } | { ok: false; error: string }> {
  const lines = (input.lines ?? []).map((l) => ({ ...l, crt: l.crt || /CRT/i.test(l.device_type) }));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("itad_submit_intake", { p: { ...input, lines } });
  if (error || !data) {
    console.error("itad_submit_intake failed", error);
    const msg = error?.message && !/permission|function|schema/i.test(error.message)
      ? error.message
      : "Something went wrong. Please call 754-274-6614 and we'll take it over the phone.";
    return { ok: false, error: msg };
  }
  const jobNumber = data as string;
  const summary = lines
    .filter((l) => l.device_type)
    .map((l) => `${l.quantity} × ${l.device_type}${l.brand_model ? ` (${l.brand_model})` : ""}`)
    .join(", ");
  sendEmail("dropoff_confirmation", input.email, { name: input.contact_name, ticket: jobNumber, summary });
  return { ok: true, jobNumber };
}
