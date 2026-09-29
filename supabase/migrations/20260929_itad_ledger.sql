-- DigiLabs ITAD intake + device ledger ("the bible").
-- Lives in the shared DigiLabs Supabase project (sqxdlaeoeawhimvwkoln), fully
-- namespaced with itad_ and gated by its OWN admin allowlist (itad_admins), so
-- TechTank admins/school admins never see ITAD client data.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- admins
create table if not exists public.itad_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  added_at timestamptz not null default now()
);
alter table public.itad_admins enable row level security;

create or replace function public.itad_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.itad_admins where user_id = auth.uid());
$$;
revoke all on function public.itad_is_admin() from public;
grant execute on function public.itad_is_admin() to anon, authenticated;

drop policy if exists itad_admins_read on public.itad_admins;
create policy itad_admins_read on public.itad_admins for select to authenticated using (public.itad_is_admin());

insert into public.itad_admins (user_id, display_name)
select id, case when email = 'paul.w.woodley@gmail.com' then 'Paul Woodley' else 'Peter Woodley' end
from auth.users where email in ('paul.w.woodley@gmail.com', 'peterwoodley96@gmail.com')
on conflict do nothing;

-- ---------------------------------------------------------------- numbering
create sequence if not exists public.itad_job_seq;
create sequence if not exists public.itad_asset_seq;
create sequence if not exists public.itad_media_seq;
create sequence if not exists public.itad_transfer_seq;
create sequence if not exists public.itad_cert_seq;

-- ---------------------------------------------------------------- partners
create table if not exists public.itad_partners (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  services text,
  r2_cert_number text,
  r2_cert_expiry date,
  naid_cert_number text,
  naid_cert_expiry date,
  other_certs text,
  contact_name text, contact_phone text, contact_email text,
  address text,
  active boolean not null default true,
  notes text
);

-- ---------------------------------------------------------------- jobs
create table if not exists public.itad_jobs (
  id uuid primary key default gen_random_uuid(),
  job_number text unique not null default ('ITAD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.itad_job_seq')::text, 4, '0')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'web' check (source in ('web','phone','admin','legacy')),
  legacy_ref text unique,
  status text not null default 'new' check (status in ('new','quoted','scheduled','picked_up','received','processing','closed','cancelled')),
  client_type text not null check (client_type in ('individual','business')),
  business_name text,
  industry text,
  contact_name text not null,
  contact_title text,
  email text,
  phone text,
  preferred_contact text,
  address text, city text, state text default 'FL', zip text,
  service_type text not null default 'pickup' check (service_type in ('pickup','dropoff')),
  preferred_date date,
  deadline date,
  site_access text,
  pallet_estimate text,
  po_number text,
  onsite_contact text,
  data_types text[] not null default '{}',
  destruction_preference text check (destruction_preference in ('wipe_ok','shred_only','onsite_shred','unsure')),
  wants_serialized_cert boolean not null default true,
  needs_partner_certs boolean not null default false,
  resale_share_interest boolean not null default false,
  equipment_leased boolean not null default false,
  lessor_name text,
  attest_owner boolean not null default false,
  attest_authorized boolean not null default false,
  attest_destruction boolean not null default false,
  attest_backup boolean not null default false,
  attest_privacy boolean not null default false,
  attested_at timestamptz,
  attested_user_agent text,
  regulatory_flags text[] not null default '{}',
  baa_required boolean not null default false,
  customer_notes text,
  -- internal
  quote_amount numeric(10,2),
  trip_fee numeric(10,2),
  per_drive_fee numeric(10,2),
  payout_pct numeric(5,2),
  scheduled_for timestamptz,
  assigned_to text,
  internal_notes text
);

create table if not exists public.itad_job_lines (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.itad_jobs(id) on delete cascade,
  line_number int not null,
  device_type text not null,
  quantity int not null default 1 check (quantity between 1 and 100000),
  brand_model text,
  approx_age text,
  powers_on text check (powers_on in ('yes','no','unknown')),
  condition text,
  storage_inside text check (storage_inside in ('yes','no','removed','unknown')),
  lock_status text check (lock_status in ('none','released','locked','unknown')),
  battery_issue boolean not null default false,
  crt boolean not null default false,
  notes text
);

-- ---------------------------------------------------------------- documents & signatures
create table if not exists public.itad_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id uuid references public.itad_jobs(id),
  asset_id uuid,
  transfer_id uuid,
  partner_id uuid references public.itad_partners(id),
  doc_type text not null check (doc_type in ('service_agreement','baa','work_order','asset_release','lease_release','partner_cert','recycling_cert','weight_ticket','bol','photo','wipe_log','certificate','quote','invoice','other')),
  title text,
  storage_path text not null,
  file_name text,
  mime_type text,
  sha256 text,
  uploaded_by text,
  voided boolean not null default false,
  void_reason text
);

create table if not exists public.itad_signatures (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id uuid references public.itad_jobs(id),
  transfer_id uuid,
  certificate_id uuid,
  signer_name text not null,
  signer_role text not null check (signer_role in ('client','digilabs','partner','driver','witness')),
  purpose text not null,
  statement text not null,
  image_path text not null,
  signed_at timestamptz not null default now(),
  user_agent text,
  statement_sha256 text,
  collected_by text
);

-- ---------------------------------------------------------------- assets & media
create table if not exists public.itad_assets (
  id uuid primary key default gen_random_uuid(),
  asset_tag text unique not null default ('DLA-' || lpad(nextval('public.itad_asset_seq')::text, 6, '0')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  job_id uuid not null references public.itad_jobs(id),
  job_line_id uuid references public.itad_job_lines(id),
  device_type text not null,
  make text, model text,
  serial_number text,
  client_asset_tag text,
  cpu text, ram_gb numeric, storage_summary text,
  has_storage boolean not null default true,
  grade text check (grade in ('A','B','C','D','parts','scrap')),
  powers_on boolean,
  lock_status text not null default 'none' check (lock_status in ('none','locked','released')),
  lock_type text,
  lock_release_doc_id uuid references public.itad_documents(id),
  third_party_config boolean not null default false,
  condition_notes text,
  status text not null default 'received' check (status in ('collected','received','awaiting_sanitization','sanitized','refurbishing','ready_for_sale','listed','sold','donated','to_partner','destroyed','returned','void')),
  disposition text check (disposition in ('resale','donation','recycle','destroy','return_to_client')),
  location text,
  void_reason text,
  created_by text
);
create index if not exists itad_assets_serial_idx on public.itad_assets (serial_number);
create index if not exists itad_assets_job_idx on public.itad_assets (job_id);

create table if not exists public.itad_storage_media (
  id uuid primary key default gen_random_uuid(),
  media_tag text unique not null default ('DLM-' || lpad(nextval('public.itad_media_seq')::text, 6, '0')),
  created_at timestamptz not null default now(),
  job_id uuid not null references public.itad_jobs(id),
  asset_id uuid references public.itad_assets(id),
  media_serial text,
  media_type text check (media_type in ('hdd','ssd','nvme','emmc','flash','tape','other')),
  capacity_gb numeric,
  status text not null default 'pending' check (status in ('pending','sanitized','destroyed','failed','to_partner','void')),
  void_reason text
);

create table if not exists public.itad_sanitization (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  media_id uuid not null references public.itad_storage_media(id),
  nist_method text not null check (nist_method in ('clear','purge','destroy')),
  technique text not null,
  tool text,
  tool_version text,
  result text not null check (result in ('pass','fail')),
  verification text,
  technician text not null,
  performed_at timestamptz not null default now(),
  log_doc_id uuid references public.itad_documents(id),
  notes text
);

create table if not exists public.itad_custody_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  job_id uuid references public.itad_jobs(id),
  asset_id uuid references public.itad_assets(id),
  media_id uuid references public.itad_storage_media(id),
  transfer_id uuid,
  event_type text not null check (event_type in ('collected','in_transit','received','moved','sanitized','destroyed','refurbished','listed','sold','donated','transferred_to_partner','returned','voided','note')),
  occurred_at timestamptz not null default now(),
  location text,
  actor text,
  counterparty text,
  signature_id uuid references public.itad_signatures(id),
  notes text,
  check (job_id is not null or asset_id is not null or media_id is not null or transfer_id is not null)
);

-- ---------------------------------------------------------------- transfers (DL-401)
create table if not exists public.itad_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_number text unique not null default ('DLT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.itad_transfer_seq')::text, 4, '0')),
  created_at timestamptz not null default now(),
  partner_id uuid not null references public.itad_partners(id),
  status text not null default 'draft' check (status in ('draft','shipped','received_by_partner','certified','void')),
  transfer_date date,
  total_weight_lbs numeric,
  item_count int,
  pallet_count int,
  bol_number text,
  vehicle text,
  received_by_name text,
  partner_cert_number text,
  partner_cert_date date,
  notes text,
  void_reason text
);

create table if not exists public.itad_transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.itad_transfers(id) on delete cascade,
  asset_id uuid references public.itad_assets(id),
  media_id uuid references public.itad_storage_media(id),
  description text,
  weight_lbs numeric,
  check (asset_id is not null or media_id is not null or description is not null)
);

-- ---------------------------------------------------------------- certificates (DL-501)
create table if not exists public.itad_certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_number text unique not null default ('DLC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.itad_cert_seq')::text, 4, '0')),
  created_at timestamptz not null default now(),
  job_id uuid not null references public.itad_jobs(id),
  issued_at timestamptz not null default now(),
  issued_by text not null,
  status text not null default 'issued' check (status in ('issued','void')),
  void_reason text,
  snapshot jsonb not null,
  snapshot_sha256 text not null,
  signature_id uuid references public.itad_signatures(id)
);

-- ---------------------------------------------------------------- sales & payouts
create table if not exists public.itad_sales (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  asset_id uuid not null references public.itad_assets(id),
  channel text not null default 'ebay' check (channel in ('ebay','direct','other')),
  listing_id text,
  order_number text,
  sale_date date,
  sale_price numeric(10,2),
  platform_fees numeric(10,2) default 0,
  shipping_cost numeric(10,2) default 0,
  refurb_cost numeric(10,2) default 0,
  net_amount numeric(10,2) generated always as (coalesce(sale_price,0) - coalesce(platform_fees,0) - coalesce(shipping_cost,0) - coalesce(refurb_cost,0)) stored,
  payout_pct numeric(5,2),
  payout_amount numeric(10,2),
  payout_status text not null default 'n/a' check (payout_status in ('n/a','owed','paid')),
  payout_date date,
  payout_method text,
  status text not null default 'listed' check (status in ('listed','sold','returned','cancelled')),
  notes text
);

-- ---------------------------------------------------------------- audit log
create table if not exists public.itad_audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  table_name text not null,
  row_id text,
  action text not null,
  actor uuid default auth.uid(),
  old_row jsonb,
  new_row jsonb
);

create or replace function public.itad_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.itad_audit_log (table_name, row_id, action, old_row, new_row)
  values (tg_table_name,
          coalesce((case when tg_op = 'DELETE' then old.id else new.id end)::text, null),
          tg_op,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create or replace function public.itad_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create or replace function public.itad_block_change() returns trigger language plpgsql as $$
begin
  raise exception '% records are permanent and cannot be % — add a correcting record instead', tg_table_name, lower(tg_op);
end $$;

-- ---------------------------------------------------------------- compliance guards
create or replace function public.itad_guard_job() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('scheduled','picked_up','received','processing','closed')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    if new.baa_required and not exists (
      select 1 from public.itad_documents d where d.job_id = new.id and d.doc_type = 'baa' and not d.voided) then
      raise exception 'Job % handles health data: upload the signed BAA before scheduling.', new.job_number;
    end if;
    if new.equipment_leased and not exists (
      select 1 from public.itad_documents d where d.job_id = new.id and d.doc_type = 'lease_release' and not d.voided) then
      raise exception 'Job % includes leased equipment: upload the lessor''s written release before scheduling.', new.job_number;
    end if;
  end if;
  return new;
end $$;

create or replace function public.itad_guard_sanitization() returns trigger
language plpgsql security definer set search_path = public as $$
declare a record;
begin
  select ast.* into a from public.itad_storage_media m join public.itad_assets ast on ast.id = m.asset_id where m.id = new.media_id;
  if found and a.lock_status = 'locked' then
    raise exception 'Asset % is still locked (MDM/activation). Record the release before wiping.', a.asset_tag;
  end if;
  if found and a.third_party_config and a.lock_release_doc_id is null then
    raise exception 'Asset % carries third-party configuration. Attach the asset-release letter before wiping.', a.asset_tag;
  end if;
  update public.itad_storage_media set status = case
    when new.result = 'fail' then 'failed'
    when new.nist_method = 'destroy' then 'destroyed' else 'sanitized' end
  where id = new.media_id;
  return new;
end $$;

create or replace function public.itad_guard_transfer() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record; d date;
begin
  if new.status in ('shipped','received_by_partner','certified') and (tg_op = 'INSERT' or old.status = 'draft') then
    select * into p from public.itad_partners where id = new.partner_id;
    d := coalesce(new.transfer_date, current_date);
    if p.r2_cert_expiry is null or p.r2_cert_expiry < d then
      raise exception 'Partner % has no current R2v3 certificate on file (expiry %). Update the partner record before shipping.', p.name, coalesce(p.r2_cert_expiry::text, 'missing');
    end if;
  end if;
  return new;
end $$;

create or replace function public.itad_guard_certificate() returns trigger
language plpgsql security definer set search_path = public as $$
declare n_assets int; n_unsanitized int; n_storage_no_media int;
begin
  select count(*) into n_assets from public.itad_assets where job_id = new.job_id and status <> 'void';
  if n_assets = 0 then
    raise exception 'No assets logged on this job yet; log devices before issuing a certificate.';
  end if;
  select count(*) into n_unsanitized from public.itad_storage_media m
   where m.job_id = new.job_id and m.status not in ('void','to_partner')
     and not exists (select 1 from public.itad_sanitization s where s.media_id = m.id and s.result = 'pass');
  if n_unsanitized > 0 then
    raise exception '% drive(s) on this job have no passing sanitization or destruction record.', n_unsanitized;
  end if;
  select count(*) into n_storage_no_media from public.itad_assets a
   where a.job_id = new.job_id and a.status <> 'void' and a.has_storage
     and not exists (select 1 from public.itad_storage_media m where m.asset_id = a.id and m.status <> 'void');
  if n_storage_no_media > 0 then
    raise exception '% asset(s) are marked as having storage but no drive is logged for them.', n_storage_no_media;
  end if;
  return new;
end $$;

create or replace function public.itad_guard_cert_update() returns trigger language plpgsql as $$
begin
  if old.status = 'issued' and new.status = 'void' and new.void_reason is not null
     and new.snapshot = old.snapshot and new.snapshot_sha256 = old.snapshot_sha256 then
    return new;
  end if;
  raise exception 'Issued certificates are permanent. Void with a reason and issue a new one.';
end $$;

-- ---------------------------------------------------------------- triggers
do $$
declare t text;
begin
  foreach t in array array['itad_jobs','itad_job_lines','itad_partners','itad_documents','itad_signatures','itad_assets','itad_storage_media','itad_sanitization','itad_custody_events','itad_transfers','itad_transfer_items','itad_certificates','itad_sales']
  loop
    execute format('drop trigger if exists %I_audit on public.%I', t, t);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.itad_audit()', t, t);
  end loop;
  foreach t in array array['itad_custody_events','itad_sanitization','itad_signatures']
  loop
    execute format('drop trigger if exists %I_permanent on public.%I', t, t);
    execute format('create trigger %I_permanent before update or delete on public.%I for each row execute function public.itad_block_change()', t, t);
  end loop;
end $$;

drop trigger if exists itad_jobs_touch on public.itad_jobs;
create trigger itad_jobs_touch before update on public.itad_jobs for each row execute function public.itad_touch();
drop trigger if exists itad_assets_touch on public.itad_assets;
create trigger itad_assets_touch before update on public.itad_assets for each row execute function public.itad_touch();
drop trigger if exists itad_jobs_guard on public.itad_jobs;
create trigger itad_jobs_guard before insert or update on public.itad_jobs for each row execute function public.itad_guard_job();
drop trigger if exists itad_sanitization_guard on public.itad_sanitization;
create trigger itad_sanitization_guard before insert on public.itad_sanitization for each row execute function public.itad_guard_sanitization();
drop trigger if exists itad_transfers_guard on public.itad_transfers;
create trigger itad_transfers_guard before insert or update on public.itad_transfers for each row execute function public.itad_guard_transfer();
drop trigger if exists itad_certificates_guard on public.itad_certificates;
create trigger itad_certificates_guard before insert on public.itad_certificates for each row execute function public.itad_guard_certificate();
drop trigger if exists itad_certificates_permanent on public.itad_certificates;
create trigger itad_certificates_permanent before update on public.itad_certificates for each row execute function public.itad_guard_cert_update();
drop trigger if exists itad_certificates_nodelete on public.itad_certificates;
create trigger itad_certificates_nodelete before delete on public.itad_certificates for each row execute function public.itad_block_change();
drop trigger if exists itad_audit_permanent on public.itad_audit_log;
create trigger itad_audit_permanent before update or delete on public.itad_audit_log for each row execute function public.itad_block_change();

-- ---------------------------------------------------------------- RLS: ITAD admins only
do $$
declare t text;
begin
  foreach t in array array['itad_jobs','itad_job_lines','itad_partners','itad_documents','itad_signatures','itad_assets','itad_storage_media','itad_sanitization','itad_custody_events','itad_transfers','itad_transfer_items','itad_certificates','itad_sales','itad_audit_log']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists %I_admin_select on public.%I', t, t);
    execute format('drop policy if exists %I_admin_insert on public.%I', t, t);
    execute format('drop policy if exists %I_admin_update on public.%I', t, t);
    execute format('create policy %I_admin_select on public.%I for select to authenticated using (public.itad_is_admin())', t, t);
    if t <> 'itad_audit_log' then
      execute format('create policy %I_admin_insert on public.%I for insert to authenticated with check (public.itad_is_admin())', t, t);
      execute format('create policy %I_admin_update on public.%I for update to authenticated using (public.itad_is_admin()) with check (public.itad_is_admin())', t, t);
    end if;
  end loop;
end $$;
-- Deliberately NO delete policies anywhere: records are voided, never deleted.
grant usage, select on all sequences in schema public to authenticated;

-- ---------------------------------------------------------------- storage (private)
insert into storage.buckets (id, name, public, file_size_limit)
values ('itad-files', 'itad-files', false, 26214400)
on conflict (id) do update set public = false;

drop policy if exists itad_files_admin_read on storage.objects;
drop policy if exists itad_files_admin_write on storage.objects;
drop policy if exists itad_files_admin_update on storage.objects;
create policy itad_files_admin_read on storage.objects for select to authenticated using (bucket_id = 'itad-files' and public.itad_is_admin());
create policy itad_files_admin_write on storage.objects for insert to authenticated with check (bucket_id = 'itad-files' and public.itad_is_admin());
create policy itad_files_admin_update on storage.objects for update to authenticated using (bucket_id = 'itad-files' and public.itad_is_admin());

-- ---------------------------------------------------------------- public intake RPC
create or replace function public.itad_submit_intake(p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  j public.itad_jobs;
  line jsonb;
  i int := 0;
  v_types text[];
  v_flags text[] := '{}';
  v_industry text := left(nullif(trim(p->>'industry'), ''), 60);
  v_client text := p->>'client_type';
begin
  if v_client not in ('individual','business') then raise exception 'Choose individual or business.'; end if;
  if coalesce(trim(p->>'contact_name'), '') = '' then raise exception 'Your name is required.'; end if;
  if coalesce(trim(p->>'phone'), '') = '' and coalesce(trim(p->>'email'), '') = '' then raise exception 'A phone number or email is required.'; end if;
  if v_client = 'business' and coalesce(trim(p->>'business_name'), '') = '' then raise exception 'Business name is required.'; end if;
  if not (coalesce((p->>'attest_owner')::boolean, false) and coalesce((p->>'attest_authorized')::boolean, false)
          and coalesce((p->>'attest_destruction')::boolean, false) and coalesce((p->>'attest_backup')::boolean, false)
          and coalesce((p->>'attest_privacy')::boolean, false)) then
    raise exception 'Please confirm all of the statements at the bottom of the form.';
  end if;
  if jsonb_typeof(p->'lines') <> 'array' or jsonb_array_length(p->'lines') = 0 then raise exception 'Add at least one device.'; end if;
  if jsonb_array_length(p->'lines') > 60 then raise exception 'Too many device lines; call us for large inventories.'; end if;

  select coalesce(array_agg(left(x, 30)), '{}') into v_types
  from jsonb_array_elements_text(coalesce(p->'data_types', '[]'::jsonb)) x
  where x in ('none','personal','health','financial','student','customer','employee','government','unsure');

  if 'health' = any(v_types) or v_industry = 'healthcare' then v_flags := array_append(v_flags, 'HIPAA'); end if;
  if 'financial' = any(v_types) or v_industry = 'finance' then v_flags := array_append(v_flags, 'GLBA'); end if;
  if 'student' = any(v_types) or v_industry = 'education' then v_flags := array_append(v_flags, 'FERPA'); end if;
  if v_industry = 'government' or 'government' = any(v_types) then v_flags := array_append(v_flags, 'GOVT'); end if;
  if 'personal' = any(v_types) or 'customer' = any(v_types) or 'employee' = any(v_types) then v_flags := array_append(v_flags, 'FIPA'); end if;

  insert into public.itad_jobs (
    source, client_type, business_name, industry, contact_name, contact_title, email, phone, preferred_contact,
    address, city, state, zip, service_type, preferred_date, deadline, site_access, pallet_estimate, po_number,
    onsite_contact, data_types, destruction_preference, wants_serialized_cert, needs_partner_certs,
    resale_share_interest, equipment_leased, lessor_name, attest_owner, attest_authorized, attest_destruction,
    attest_backup, attest_privacy, attested_at, attested_user_agent, regulatory_flags, baa_required, customer_notes)
  values (
    'web', v_client, left(p->>'business_name', 160), v_industry, left(trim(p->>'contact_name'), 120), left(p->>'contact_title', 80),
    left(lower(trim(p->>'email')), 160), left(p->>'phone', 40), left(p->>'preferred_contact', 20),
    left(p->>'address', 200), left(p->>'city', 80), coalesce(left(nullif(p->>'state',''), 2), 'FL'), left(p->>'zip', 10),
    case when p->>'service_type' = 'dropoff' then 'dropoff' else 'pickup' end,
    nullif(p->>'preferred_date', '')::date, nullif(p->>'deadline', '')::date,
    left(p->>'site_access', 300), left(p->>'pallet_estimate', 60), left(p->>'po_number', 60), left(p->>'onsite_contact', 160),
    v_types,
    case when p->>'destruction_preference' in ('wipe_ok','shred_only','onsite_shred','unsure') then p->>'destruction_preference' else 'unsure' end,
    coalesce((p->>'wants_serialized_cert')::boolean, true), coalesce((p->>'needs_partner_certs')::boolean, false),
    coalesce((p->>'resale_share_interest')::boolean, false), coalesce((p->>'equipment_leased')::boolean, false),
    left(p->>'lessor_name', 160), true, true, true, true, true, now(), left(p->>'user_agent', 300),
    v_flags, 'HIPAA' = any(v_flags), left(p->>'customer_notes', 2000))
  returning * into j;

  for line in select * from jsonb_array_elements(p->'lines') loop
    i := i + 1;
    if coalesce(trim(line->>'device_type'), '') = '' then continue; end if;
    insert into public.itad_job_lines (job_id, line_number, device_type, quantity, brand_model, approx_age, powers_on,
      condition, storage_inside, lock_status, battery_issue, crt, notes)
    values (j.id, i, left(line->>'device_type', 60),
      greatest(1, least(coalesce(nullif(line->>'quantity','')::int, 1), 100000)),
      left(line->>'brand_model', 120), left(line->>'approx_age', 30),
      case when line->>'powers_on' in ('yes','no','unknown') then line->>'powers_on' else 'unknown' end,
      left(line->>'condition', 40),
      case when line->>'storage_inside' in ('yes','no','removed','unknown') then line->>'storage_inside' else 'unknown' end,
      case when line->>'lock_status' in ('none','released','locked','unknown') then line->>'lock_status' else 'unknown' end,
      coalesce((line->>'battery_issue')::boolean, false), coalesce((line->>'crt')::boolean, false),
      left(line->>'notes', 500));
  end loop;

  insert into public.itad_custody_events (job_id, event_type, actor, notes)
  values (j.id, 'note', 'website', 'Intake submitted online; attestations accepted.');

  return j.job_number;
end $$;
revoke all on function public.itad_submit_intake(jsonb) from public;
grant execute on function public.itad_submit_intake(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------- mirror phone line (Vapi) + legacy forms into the ledger
create or replace function public.itad_mirror_dl101() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.itad_jobs (source, legacy_ref, client_type, contact_name, email, phone, address, city, state, zip,
    service_type, preferred_date, attest_owner, attest_destruction, attest_backup, created_at)
  values (case when new.volunteer_name = 'AI phone line' or new.ticket_number like 'PH-%' then 'phone' else 'legacy' end,
    'dl101:' || new.id, 'individual', coalesce(new.full_name, 'Unknown'), new.email, new.phone, new.street_address,
    new.city, coalesce(new.state, 'FL'), new.zip, 'pickup', new.drop_off_date,
    coalesce(new.confirm_ownership, false), coalesce(new.authorize_destruction, false), coalesce(new.data_backed_up, false),
    coalesce(new.created_at, now()))
  on conflict (legacy_ref) do nothing;
  return new;
end $$;

create or replace function public.itad_mirror_dl101_device() returns trigger
language plpgsql security definer set search_path = public as $$
declare jid uuid;
begin
  select id into jid from public.itad_jobs where legacy_ref = 'dl101:' || new.dropoff_id;
  if jid is not null and new.device_type is not null then
    insert into public.itad_job_lines (job_id, line_number, device_type, brand_model, notes)
    values (jid, coalesce(new.line_number, 1), left(new.device_type, 60), new.brand_model,
            case when new.serial_number is not null then 'Serial given: ' || new.serial_number end);
  end if;
  return new;
end $$;

create or replace function public.itad_mirror_dl201() returns trigger
language plpgsql security definer set search_path = public as $$
declare jid uuid; n int := 0;
begin
  insert into public.itad_jobs (source, legacy_ref, client_type, business_name, contact_name, contact_title, email, phone,
    preferred_contact, address, city, state, zip, service_type, site_access, customer_notes, created_at)
  values ('legacy', 'dl201:' || new.id, 'business', new.legal_business_name, coalesce(new.contact_name, 'Unknown'),
    new.contact_title, new.contact_email, new.contact_phone, new.preferred_contact_method,
    coalesce(new.collection_address, new.address_street), new.address_city, coalesce(new.address_state, 'FL'), new.address_zip,
    'pickup', new.special_access_notes,
    concat_ws(' | ', nullif(new.service_frequency_text, ''), nullif(new.preferred_time_window, ''), nullif(new.est_other_notes, '')),
    coalesce(new.created_at, now()))
  on conflict (legacy_ref) do nothing
  returning id into jid;
  if jid is not null then
    if coalesce(new.est_desktops::text, '') ~ '^[0-9]+$' and new.est_desktops::int > 0 then n := n + 1;
      insert into public.itad_job_lines (job_id, line_number, device_type, quantity) values (jid, n, 'Desktop', new.est_desktops::int); end if;
    if coalesce(new.est_laptops::text, '') ~ '^[0-9]+$' and new.est_laptops::int > 0 then n := n + 1;
      insert into public.itad_job_lines (job_id, line_number, device_type, quantity) values (jid, n, 'Laptop', new.est_laptops::int); end if;
    if coalesce(new.est_monitors_lcd::text, '') ~ '^[0-9]+$' and new.est_monitors_lcd::int > 0 then n := n + 1;
      insert into public.itad_job_lines (job_id, line_number, device_type, quantity) values (jid, n, 'Monitor (LCD)', new.est_monitors_lcd::int); end if;
  end if;
  return new;
end $$;

drop trigger if exists itad_mirror on public.dl101_dropoff;
create trigger itad_mirror after insert on public.dl101_dropoff for each row execute function public.itad_mirror_dl101();
drop trigger if exists itad_mirror on public.dl101_devices;
create trigger itad_mirror after insert on public.dl101_devices for each row execute function public.itad_mirror_dl101_device();
drop trigger if exists itad_mirror on public.dl201_commercial;
create trigger itad_mirror after insert on public.dl201_commercial for each row execute function public.itad_mirror_dl201();

-- backfill existing legacy rows once
insert into public.itad_jobs (source, legacy_ref, client_type, contact_name, email, phone, address, city, state, zip, service_type, preferred_date, created_at)
select 'legacy', 'dl101:' || d.id, 'individual', coalesce(d.full_name, 'Unknown'), d.email, d.phone, d.street_address, d.city, coalesce(d.state,'FL'), d.zip, 'pickup', d.drop_off_date, d.created_at
from public.dl101_dropoff d on conflict (legacy_ref) do nothing;
insert into public.itad_jobs (source, legacy_ref, client_type, business_name, contact_name, contact_title, email, phone, address, city, state, zip, service_type, created_at)
select 'legacy', 'dl201:' || c.id, 'business', c.legal_business_name, coalesce(c.contact_name, 'Unknown'), c.contact_title, c.contact_email, c.contact_phone, coalesce(c.collection_address, c.address_street), c.address_city, coalesce(c.address_state,'FL'), c.address_zip, 'pickup', c.created_at
from public.dl201_commercial c on conflict (legacy_ref) do nothing;


-- ---------------------------------------------------------------- automatic custody trail
create or replace function public.itad_actor() returns text language sql stable security definer set search_path = public as $$
  select coalesce((select display_name from public.itad_admins where user_id = auth.uid()), 'system');
$$;

create or replace function public.itad_asset_custody() returns trigger
language plpgsql security definer set search_path = public as $$
declare ev text;
begin
  if tg_op = 'INSERT' then
    insert into public.itad_custody_events (job_id, asset_id, event_type, actor, location, notes)
    values (new.job_id, new.id, case when new.status = 'collected' then 'collected' else 'received' end, public.itad_actor(), new.location,
            'Logged ' || new.device_type || coalesce(' S/N ' || new.serial_number, ''));
  elsif new.status is distinct from old.status then
    ev := case new.status
      when 'received' then 'received' when 'sanitized' then 'sanitized' when 'refurbishing' then 'refurbished'
      when 'listed' then 'listed' when 'sold' then 'sold' when 'donated' then 'donated'
      when 'to_partner' then 'transferred_to_partner' when 'destroyed' then 'destroyed'
      when 'returned' then 'returned' when 'void' then 'voided' else 'moved' end;
    insert into public.itad_custody_events (job_id, asset_id, event_type, actor, location, notes)
    values (new.job_id, new.id, ev, public.itad_actor(), new.location,
            'Status ' || old.status || ' → ' || new.status || coalesce(' — ' || new.void_reason, ''));
  elsif new.location is distinct from old.location then
    insert into public.itad_custody_events (job_id, asset_id, event_type, actor, location, notes)
    values (new.job_id, new.id, 'moved', public.itad_actor(), new.location, 'Location changed');
  end if;
  return new;
end $$;
drop trigger if exists itad_assets_custody on public.itad_assets;
create trigger itad_assets_custody after insert or update on public.itad_assets for each row execute function public.itad_asset_custody();

create or replace function public.itad_sanitization_custody() returns trigger
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  select * into m from public.itad_storage_media where id = new.media_id;
  insert into public.itad_custody_events (job_id, asset_id, media_id, event_type, actor, notes)
  values (m.job_id, m.asset_id, m.id, case when new.nist_method = 'destroy' then 'destroyed' else 'sanitized' end, new.technician,
          'NIST 800-88 ' || new.nist_method || ' via ' || new.technique || coalesce(' (' || new.tool || ')', '') || ' — ' || new.result);
  return new;
end $$;
drop trigger if exists itad_sanitization_custody on public.itad_sanitization;
create trigger itad_sanitization_custody after insert on public.itad_sanitization for each row execute function public.itad_sanitization_custody();


-- ---------------------------------------------------------------- deferred foreign keys (for embedded selects)
do $$ begin
  if not exists (select 1 from pg_constraint where conname='itad_documents_asset_fk') then
    alter table public.itad_documents add constraint itad_documents_asset_fk foreign key (asset_id) references public.itad_assets(id); end if;
  if not exists (select 1 from pg_constraint where conname='itad_documents_transfer_fk') then
    alter table public.itad_documents add constraint itad_documents_transfer_fk foreign key (transfer_id) references public.itad_transfers(id); end if;
  if not exists (select 1 from pg_constraint where conname='itad_custody_transfer_fk') then
    alter table public.itad_custody_events add constraint itad_custody_transfer_fk foreign key (transfer_id) references public.itad_transfers(id); end if;
  if not exists (select 1 from pg_constraint where conname='itad_signatures_transfer_fk') then
    alter table public.itad_signatures add constraint itad_signatures_transfer_fk foreign key (transfer_id) references public.itad_transfers(id); end if;
  if not exists (select 1 from pg_constraint where conname='itad_signatures_cert_fk') then
    alter table public.itad_signatures add constraint itad_signatures_cert_fk foreign key (certificate_id) references public.itad_certificates(id); end if;
end $$;
notify pgrst, 'reload schema';
