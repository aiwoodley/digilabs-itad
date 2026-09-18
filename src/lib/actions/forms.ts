"use server";

import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/notify";

type ActionResult = { ok: true } | { ok: false; error: string };

function ticketNumber(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

// These three actions write to the SAME Supabase project the Education site
// uses (sqxdlaeoeawhimvwkoln) and the SAME tables (dl101_dropoff,
// dl201_commercial, student_pledges) — this is real, working submission, not
// a stub. Confirmed by reading DigiLabs-Education's
// web/src/lib/actions/forms.ts and matching its exact table/column names.

export interface DropoffInput {
  full_name: string;
  phone: string;
  email?: string;
  street_address: string;
  city: string;
  zip?: string;
  drop_off_date?: string;
  device_description?: string;
  data_backed_up: boolean;
  confirm_ownership: boolean;
  authorize_destruction: boolean;
}

export async function submitDropoff(input: DropoffInput): Promise<ActionResult> {
  const supabase = await createClient();
  const ticket = ticketNumber("DL");

  const { data, error } = await supabase
    .from("dl101_dropoff")
    .insert({
      ticket_number: ticket,
      drop_off_date: input.drop_off_date || new Date().toISOString().slice(0, 10),
      full_name: input.full_name,
      street_address: input.street_address,
      city: input.city,
      state: "FL",
      zip: input.zip,
      email: input.email,
      phone: input.phone,
      data_backed_up: input.data_backed_up,
      authorize_destruction: input.authorize_destruction,
      confirm_ownership: input.confirm_ownership,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error(error);
    return { ok: false, error: "Could not submit request" };
  }

  if (input.device_description) {
    await supabase.from("dl101_devices").insert({
      dropoff_id: data.id,
      line_number: 1,
      device_type: input.device_description,
    });
  }

  sendEmail("dropoff_confirmation", input.email, {
    name: input.full_name,
    ticket,
    summary: input.device_description || "Pickup / drop-off request",
  });

  return { ok: true };
}

export interface BusinessInput {
  legal_business_name: string;
  contact_name: string;
  contact_title?: string;
  contact_phone?: string;
  contact_email?: string;
  preferred_contact_method?: string;
  collection_address?: string;
  address_city?: string;
  address_zip?: string;
  service_frequency_text?: string;
  preferred_time_window?: string;
  est_desktops?: string;
  est_laptops?: string;
  est_monitors_lcd?: string;
  est_other_notes?: string;
}

export async function submitBusiness(input: BusinessInput): Promise<ActionResult> {
  const supabase = await createClient();
  const contract = ticketNumber("BIZ");

  const { error } = await supabase.from("dl201_commercial").insert({
    contract_number: contract,
    legal_business_name: input.legal_business_name,
    contact_name: input.contact_name,
    contact_title: input.contact_title,
    contact_phone: input.contact_phone,
    contact_email: input.contact_email,
    preferred_contact_method: input.preferred_contact_method,
    collection_address: input.collection_address,
    address_city: input.address_city,
    address_state: "FL",
    address_zip: input.address_zip,
    service_frequency_text: input.service_frequency_text,
    preferred_time_window: input.preferred_time_window,
    est_desktops: input.est_desktops || null,
    est_laptops: input.est_laptops || null,
    est_monitors_lcd: input.est_monitors_lcd || null,
    est_other_notes: input.est_other_notes,
  });

  if (error) {
    console.error(error);
    return { ok: false, error: "Could not submit request" };
  }

  sendEmail("business_confirmation", input.contact_email, {
    name: input.contact_name,
    business: input.legal_business_name,
  });

  return { ok: true };
}

export interface PledgeInput {
  first_name: string;
  last_name?: string;
  email?: string;
  school_name?: string;
  city?: string;
  grade_level?: string;
  pledge_type?: string;
  pledge_recycle: boolean;
  pledge_educate: boolean;
  pledge_reduce: boolean;
  pledge_advocate: boolean;
  pledge_message?: string;
  display_name?: string;
  show_on_wall: boolean;
}

export async function submitPledge(input: PledgeInput): Promise<ActionResult> {
  const supabase = await createClient();

  const lastInitial = (input.last_name || "").trim().charAt(0);
  const displayName =
    input.display_name || `${input.first_name} ${lastInitial ? lastInitial + "." : ""}`.trim();

  const { error } = await supabase.from("student_pledges").insert({
    first_name: input.first_name,
    last_name: input.last_name,
    email: input.email || null,
    school_name: input.school_name || "",
    city: input.city,
    state: "FL",
    grade_level: input.grade_level,
    pledge_type: input.pledge_type || "individual",
    pledge_recycle: input.pledge_recycle,
    pledge_educate: input.pledge_educate,
    pledge_reduce: input.pledge_reduce,
    pledge_advocate: input.pledge_advocate,
    pledge_message: input.pledge_message || null,
    display_name: displayName || "A DigiLabs Supporter",
    show_on_wall: input.show_on_wall,
    verified: false,
  });

  if (error) {
    console.error(error);
    return { ok: false, error: "Could not submit pledge" };
  }

  sendEmail("pledge_confirmation", input.email, { name: input.first_name });

  return { ok: true };
}
