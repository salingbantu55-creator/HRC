-- ============================================================================
-- HR KNOWLEDGE CENTER YAYASAN — schema.sql
-- Jalankan pada SQL Editor Supabase SEBELUM policies.sql dan seed.sql.
-- Membuat: tabel, relasi, indeks, trigger updated_at, fungsi pendukung,
-- dan trigger profil otomatis untuk pengguna baru.
-- ============================================================================

-- Ekstensi UUID
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TABEL MASTER: ROLES, PERMISSIONS, PROFILES
-- ============================================================================
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  description text default '',
  level int default 9,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  module text not null,
  description text default '',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_key text not null references public.roles(key) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  created_at timestamptz default now() not null,
  unique (role_key, permission_key)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null default 'Pengguna Baru',
  role text not null default 'pegawai' references public.roles(key) on update cascade,
  unit text default '',
  avatar_url text,
  is_active boolean default true not null,
  last_login_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint profiles_role_check check (role in (
    'super_admin','pembina','direktur_pendidikan','direktur_pelayanan',
    'manajer_hrd','kepala_bidang_hrd','kepala_sekolah','pegawai','guest'))
);

-- ============================================================================
-- 2. KATEGORI & TAG
-- ============================================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  type text not null default 'document',
  description text default '',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint categories_type_check check (type in ('document','regulation','sop','policy','template','knowledge','link'))
);
create index if not exists idx_categories_type on public.categories(type);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Tabel penanda (polimorfik): parent_type + parent_id
create table if not exists public.document_tags (
  id uuid primary key default gen_random_uuid(),
  parent_type text not null default 'document',
  parent_id uuid not null,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz default now() not null,
  unique (parent_type, parent_id, tag_id)
);
create index if not exists idx_document_tags_parent on public.document_tags(parent_type, parent_id);

-- ============================================================================
-- 3. REGULASI (Modul 2 & 12)
-- ============================================================================
create table if not exists public.regulations (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  year int not null,
  title text not null,
  category text not null default 'yayasan',
  issuer text,
  summary text,
  provisions text,
  status text not null default 'perlu_verifikasi',
  verification_status text not null default 'perlu_verifikasi',
  verification_note text,
  promulgation_date date,
  last_checked_at date,
  official_url text,
  file_path text,
  file_name text,
  hrd_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint regulations_category_check check (category in (
    'yayasan','ketenagakerjaan','pendidikan','perlindungan_sosial','perpajakan','pelindungan_data')),
  constraint regulations_status_check check (status in (
    'berlaku','perlu_verifikasi','diubah','dicabut','diarsipkan')),
  constraint regulations_verification_check check (verification_status in ('terverifikasi','perlu_verifikasi')),
  unique (number, year)
);
create index if not exists idx_regulations_category on public.regulations(category);
create index if not exists idx_regulations_status on public.regulations(status);
create index if not exists idx_regulations_year on public.regulations(year);
create index if not exists idx_regulations_search on public.regulations
  using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(number,'') || ' ' || coalesce(summary,'')));

create table if not exists public.regulation_relations (
  id uuid primary key default gen_random_uuid(),
  regulation_id uuid not null references public.regulations(id) on delete cascade,
  related_id uuid not null references public.regulations(id) on delete cascade,
  relation_type text not null default 'terkait',
  created_at timestamptz default now() not null,
  constraint regulation_relations_type_check check (relation_type in ('mengubah','mencabut','diganti_oleh','terkait')),
  unique (regulation_id, related_id, relation_type)
);

create table if not exists public.regulation_reviews (
  id uuid primary key default gen_random_uuid(),
  regulation_id uuid not null references public.regulations(id) on delete cascade,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewer_name text,
  result text not null default 'masih_berlaku',
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint regulation_reviews_result_check check (result in ('masih_berlaku','ada_perubahan','perlu_tinjauan'))
);
create index if not exists idx_regulation_reviews_reg on public.regulation_reviews(regulation_id);

-- ============================================================================
-- 4. DOKUMEN, VERSI, LOG AKSES (Modul 3, 6, 11)
-- ============================================================================
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  doc_number text,
  category text not null default 'kebijakan-sdm',
  year int,
  classification text not null default 'internal',
  description text,
  status text not null default 'draft',
  version text default '1.0',
  file_path text,
  file_name text,
  file_type text,
  file_size bigint,
  owner_id uuid references public.profiles(id) on delete set null,
  download_count int default 0 not null,
  view_count int default 0 not null,
  valid_from date,
  valid_until date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint documents_classification_check check (classification in ('publik','internal','terbatas','rahasia')),
  constraint documents_status_check check (status in ('draft','diajukan','review','revisi','disetujui','dipublikasikan','diarsipkan'))
);
create index if not exists idx_documents_category on public.documents(category);
create index if not exists idx_documents_status on public.documents(status);
create index if not exists idx_documents_year on public.documents(year);
create index if not exists idx_documents_owner on public.documents(owner_id);
create index if not exists idx_documents_search on public.documents
  using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(doc_number,'') || ' ' || coalesce(description,'')));

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  parent_type text not null default 'document',
  parent_id uuid not null,
  version text default '1.0',
  notes text,
  file_path text,
  file_name text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint document_versions_parent_check check (parent_type in ('document','policy','sop','template','regulation'))
);
create index if not exists idx_document_versions_parent on public.document_versions(parent_type, parent_id);

create table if not exists public.document_access_logs (
  id uuid primary key default gen_random_uuid(),
  parent_type text not null default 'document',
  parent_id uuid not null,
  user_id uuid references public.profiles(id) on delete set null,
  user_name text,
  action text not null default 'view',
  created_at timestamptz default now() not null,
  constraint document_access_logs_action_check check (action in ('view','download','preview'))
);
create index if not exists idx_document_access_logs_parent on public.document_access_logs(parent_type, parent_id);
create index if not exists idx_document_access_logs_time on public.document_access_logs(created_at);

-- ============================================================================
-- 5. KEBIJAKAN, SOP, TEMPLATE (Modul 4, 5, 7)
-- ============================================================================
create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  title text not null,
  category text not null default 'manajemen-sdm',
  version text default '1.0',
  effective_date date,
  approver text,
  summary text,
  content text,
  status text not null default 'draft',
  file_path text,
  file_name text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint policies_status_check check (status in ('draft','diajukan','review','revisi','disetujui','dipublikasikan','diarsipkan')),
  unique (number)
);
create index if not exists idx_policies_status on public.policies(status);
create index if not exists idx_policies_search on public.policies
  using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(number,'') || ' ' || coalesce(summary,'')));

create table if not exists public.sop_documents (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  name text not null,
  category text not null default 'administrasi-kepegawaian',
  purpose text,
  scope text,
  definitions text,
  legal_basis text,
  parties text,
  supporting_docs text,
  procedure text,
  flowchart_steps text,
  sla text,
  output text,
  related_forms text,
  responsible text,
  effective_date date,
  version text default '1.0',
  status text not null default 'draft',
  file_path text,
  file_name text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint sop_status_check check (status in ('draft','diajukan','review','revisi','disetujui','dipublikasikan','diarsipkan')),
  unique (number)
);
create index if not exists idx_sop_category on public.sop_documents(category);
create index if not exists idx_sop_status on public.sop_documents(status);
create index if not exists idx_sop_search on public.sop_documents
  using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(number,'') || ' ' || coalesce(procedure,'')));

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  group_name text not null default 'surat',
  description text,
  version text default '1.0',
  file_path text,
  file_name text,
  file_type text,
  download_count int default 0 not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint templates_group_check check (group_name in ('surat','formulir','instrumen'))
);
create index if not exists idx_templates_group on public.templates(group_name);

-- ============================================================================
-- 6. REFERENSI & KNOWLEDGE BASE (Modul 8, 9)
-- ============================================================================
create table if not exists public.external_links (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  category text not null default 'regulasi-nasional',
  link_type text not null default 'resmi',
  description text,
  agency text,
  verified_at date,
  is_active boolean default true not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint external_links_category_check check (category in (
    'regulasi-nasional','yayasan-legalitas','ketenagakerjaan','pendidikan','jaminan-sosial','perpajakan','statistik-penelitian')),
  constraint external_links_type_check check (link_type in ('resmi','ilmiah','umum')),
  unique (url)
);
create index if not exists idx_links_category on public.external_links(category);

create table if not exists public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  category text not null default 'manajemen-sdm',
  summary text,
  content text,
  "references" text,
  status text not null default 'draft',
  published_at date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint knowledge_status_check check (status in ('draft','dipublikasikan'))
);
create index if not exists idx_knowledge_category on public.knowledge_articles(category);
create index if not exists idx_knowledge_search on public.knowledge_articles
  using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(content,'')));

-- ============================================================================
-- 7. WORKFLOW, NOTIFIKASI, FAVORIT, AI (Modul 10, 11)
-- ============================================================================
create table if not exists public.workflow_approvals (
  id uuid primary key default gen_random_uuid(),
  parent_type text not null default 'document',
  parent_id uuid not null,
  title text,
  requested_by uuid references public.profiles(id) on delete set null,
  requester_name text,
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_name text,
  approver_id uuid references public.profiles(id) on delete set null,
  approver_name text,
  stage text not null default 'draft',
  status text not null default 'menunggu',
  revision_notes text,
  submitted_at timestamptz,
  decided_at timestamptz,
  history jsonb default '[]'::jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint workflow_stage_check check (stage in ('draft','diajukan','review','revisi','disetujui','dipublikasikan','diarsipkan')),
  constraint workflow_status_check check (status in ('menunggu','disetujui','revisi','ditolak','diarsipkan')),
  constraint workflow_parent_check check (parent_type in ('document','policy','sop','regulation'))
);
create index if not exists idx_workflow_parent on public.workflow_approvals(parent_type, parent_id);
create index if not exists idx_workflow_stage on public.workflow_approvals(stage);
create index if not exists idx_workflow_reviewer on public.workflow_approvals(reviewer_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text,
  type text not null default 'info',
  link text,
  is_read boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint notifications_type_check check (type in ('info','warning','success','workflow'))
);
create index if not exists idx_notifications_user on public.notifications(user_id, is_read);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_type text not null default 'document',
  parent_id uuid not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, parent_type, parent_id)
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text default 'Percakapan',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create index if not exists idx_ai_conversations_user on public.ai_conversations(user_id);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null,
  content text not null,
  sources jsonb default '[]'::jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint ai_messages_role_check check (role in ('user','assistant'))
);
create index if not exists idx_ai_messages_conv on public.ai_messages(conversation_id);

-- ============================================================================
-- 8. AUDIT & PENGATURAN
-- ============================================================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  user_name text,
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create index if not exists idx_audit_logs_user on public.audit_logs(user_id);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_time on public.audit_logs(created_at);

create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================================================
-- 9. TRIGGER: UPDATED_AT & PROFIL BARU
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'roles','permissions','role_permissions','profiles','categories','tags','document_tags',
    'regulations','regulation_relations','regulation_reviews','documents','document_versions',
    'document_access_logs','policies','sop_documents','templates','external_links',
    'knowledge_articles','workflow_approvals','notifications','favorites',
    'ai_conversations','ai_messages','audit_logs','system_settings'
  ] loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format('create trigger trg_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- Profil otomatis untuk pengguna baru (role default: pegawai)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'pegawai')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 10. FUNGSI KEAMANAN PENDUKUNG (dipakai policies.sql)
-- ============================================================================
create or replace function public.get_my_role()
returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'guest');
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.get_my_role() = 'super_admin';
$$;

-- Mirror dari matriks RBAC frontend (config.js)
create or replace function public.has_permission(p_role text, p_perm text)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_role = 'super_admin'
      or exists (select 1 from public.role_permissions rp where rp.role_key = p_role and rp.permission_key = p_perm);
$$;

-- Kebijakan baca dokumen menurut klasifikasi + kategori personal
create or replace function public.can_read_document(p_classification text, p_category text, p_owner uuid)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  my_role text;
begin
  my_role := public.get_my_role();
  -- pemilik selalu boleh
  if p_owner is not null and p_owner = auth.uid() then
    return true;
  end if;
  -- kategori data personal: hanya pemilik atau HRD berwenang
  if p_category = 'data-personal-pegawai' then
    return my_role in ('super_admin','manajer_hrd','kepala_bidang_hrd');
  end if;
  if p_classification = 'publik' then
    return true; -- termasuk anon/guest
  end if;
  if auth.uid() is null then
    return false; -- guest hanya untuk konten publik
  end if;
  if p_classification = 'internal' then
    return true;
  end if;
  if p_classification = 'terbatas' then
    return my_role in ('super_admin','pembina','direktur_pendidikan','direktur_pelayanan','manajer_hrd','kepala_bidang_hrd','kepala_sekolah');
  end if;
  if p_classification = 'rahasia' then
    return my_role in ('super_admin','pembina','manajer_hrd');
  end if;
  return false;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select on public.roles, public.permissions, public.role_permissions, public.categories, public.tags to anon, authenticated;
