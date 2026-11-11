-- ============================================================================
-- HR KNOWLEDGE CENTER YAYASAN — policies.sql
-- Jalankan SETELAH schema.sql. Membuat: RLS seluruh tabel, kebijakan akses
-- berbasis role/klasifikasi/kepemilikan, Storage buckets, dan Storage policies.
-- TAMBAHAN WAJIB: jalankan juga bagian PROMOSI ADMIN PERTAMA di bawah setelah
-- Anda membuat akun admin di Authentication.
-- ============================================================================

-- ============================================================================
-- 1. AKTIFKAN RLS PADA SEMUA TABEL
-- ============================================================================
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
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ============================================================================
-- 2. PROFILES
-- ============================================================================
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_super_admin())
  with check (
    public.is_super_admin()
    or id = auth.uid()
       and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- Pengguna tidak dapat menghapus profil maupun membuat baris sendiri
-- (profil dibuat otomatis oleh trigger handle_new_user).

-- ============================================================================
-- 3. MASTER (roles, permissions, role_permissions, categories, tags, settings)
-- ============================================================================
drop policy if exists master_read_roles on public.roles;
create policy master_read_roles on public.roles for select to anon, authenticated using (true);
drop policy if exists master_read_perms on public.permissions;
create policy master_read_perms on public.permissions for select to anon, authenticated using (true);
drop policy if exists master_read_role_perms on public.role_permissions;
create policy master_read_role_perms on public.role_permissions for select to anon, authenticated using (true);
drop policy if exists master_read_categories on public.categories;
create policy master_read_categories on public.categories for select to anon, authenticated using (true);
drop policy if exists master_read_tags on public.tags;
create policy master_read_tags on public.tags for select to anon, authenticated using (true);
drop policy if exists master_read_settings on public.system_settings;
create policy master_read_settings on public.system_settings for select to authenticated using (true);

drop policy if exists master_write_categories on public.categories;
create policy master_write_categories on public.categories for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists master_write_tags on public.tags;
create policy master_write_tags on public.tags for all to authenticated
  using (public.is_super_admin() or public.has_permission(public.get_my_role(), 'knowledge.manage'))
  with check (public.is_super_admin() or public.has_permission(public.get_my_role(), 'knowledge.manage'));
drop policy if exists master_write_settings on public.system_settings;
create policy master_write_settings on public.system_settings for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ============================================================================
-- 4. DOKUMEN (klasifikasi + kepemilikan + RLS ketat)
-- ============================================================================
drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select to anon, authenticated
  using (public.can_read_document(classification, category, owner_id));

drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents
  for insert to authenticated
  with check (public.has_permission(public.get_my_role(), 'documents.create'));

drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents
  for update to authenticated
  using (owner_id = auth.uid() or public.has_permission(public.get_my_role(), 'documents.edit'))
  with check (owner_id = auth.uid() or public.has_permission(public.get_my_role(), 'documents.edit'));

drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents
  for delete to authenticated
  using (owner_id = auth.uid() or public.has_permission(public.get_my_role(), 'documents.delete'));

-- ============================================================================
-- 5. REGULASI (Modul 2 & 12)
-- ============================================================================
drop policy if exists regulations_select on public.regulations;
create policy regulations_select on public.regulations for select to anon, authenticated using (true);
drop policy if exists regulations_write on public.regulations;
create policy regulations_write on public.regulations for all to authenticated
  using (public.has_permission(public.get_my_role(), 'regulations.manage'))
  with check (public.has_permission(public.get_my_role(), 'regulations.manage'));

drop policy if exists reg_rel_select on public.regulation_relations;
create policy reg_rel_select on public.regulation_relations for select to anon, authenticated using (true);
drop policy if exists reg_rel_write on public.regulation_relations;
create policy reg_rel_write on public.regulation_relations for all to authenticated
  using (public.has_permission(public.get_my_role(), 'regulations.manage'))
  with check (public.has_permission(public.get_my_role(), 'regulations.manage'));

drop policy if exists reg_rev_select on public.regulation_reviews;
create policy reg_rev_select on public.regulation_reviews for select to authenticated using (true);
drop policy if exists reg_rev_insert on public.regulation_reviews;
create policy reg_rev_insert on public.regulation_reviews for insert to authenticated
  with check (auth.uid() is not null);

-- ============================================================================
-- 6. KEBIJAKAN, SOP, TEMPLATE
-- ============================================================================
drop policy if exists policies_tbl_select on public.policies;
create policy policies_tbl_select on public.policies for select to anon, authenticated using (true);
drop policy if exists policies_tbl_write on public.policies;
create policy policies_tbl_write on public.policies for all to authenticated
  using (public.has_permission(public.get_my_role(), 'policies.manage'))
  with check (public.has_permission(public.get_my_role(), 'policies.manage'));

drop policy if exists sop_select on public.sop_documents;
create policy sop_select on public.sop_documents for select to anon, authenticated using (true);
drop policy if exists sop_write on public.sop_documents;
create policy sop_write on public.sop_documents for all to authenticated
  using (public.has_permission(public.get_my_role(), 'sop.manage'))
  with check (public.has_permission(public.get_my_role(), 'sop.manage'));

drop policy if exists templates_select on public.templates;
create policy templates_select on public.templates for select to anon, authenticated using (true);
drop policy if exists templates_write on public.templates;
create policy templates_write on public.templates for all to authenticated
  using (public.has_permission(public.get_my_role(), 'templates.manage'))
  with check (public.has_permission(public.get_my_role(), 'templates.manage'));

-- ============================================================================
-- 7. REFERENSI & KNOWLEDGE BASE
-- ============================================================================
drop policy if exists links_select on public.external_links;
create policy links_select on public.external_links for select to anon, authenticated using (true);
drop policy if exists links_write on public.external_links;
create policy links_write on public.external_links for all to authenticated
  using (public.has_permission(public.get_my_role(), 'links.manage'))
  with check (public.has_permission(public.get_my_role(), 'links.manage'));

drop policy if exists kb_select on public.knowledge_articles;
create policy kb_select on public.knowledge_articles for select to anon, authenticated
  using (status = 'dipublikasikan' or created_by = auth.uid() or public.has_permission(public.get_my_role(), 'knowledge.manage'));
drop policy if exists kb_write on public.knowledge_articles;
create policy kb_write on public.knowledge_articles for all to authenticated
  using (public.has_permission(public.get_my_role(), 'knowledge.manage') or created_by = auth.uid())
  with check (public.has_permission(public.get_my_role(), 'knowledge.manage') or created_by = auth.uid());

drop policy if exists doc_tags_select on public.document_tags;
create policy doc_tags_select on public.document_tags for select to authenticated using (true);
drop policy if exists doc_tags_write on public.document_tags;
create policy doc_tags_write on public.document_tags for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- ============================================================================
-- 8. VERSI, LOG AKSES, FAVORIT
-- ============================================================================
drop policy if exists doc_versions_select on public.document_versions;
create policy doc_versions_select on public.document_versions for select to authenticated using (true);
drop policy if exists doc_versions_write on public.document_versions;
create policy doc_versions_write on public.document_versions for all to authenticated
  using (public.has_permission(public.get_my_role(), 'documents.edit') or public.has_permission(public.get_my_role(), 'policies.manage') or public.has_permission(public.get_my_role(), 'sop.manage'))
  with check (public.has_permission(public.get_my_role(), 'documents.edit') or public.has_permission(public.get_my_role(), 'policies.manage') or public.has_permission(public.get_my_role(), 'sop.manage'));

drop policy if exists access_logs_insert on public.document_access_logs;
create policy access_logs_insert on public.document_access_logs for insert to authenticated
  with check (auth.uid() is not null);
drop policy if exists access_logs_select on public.document_access_logs;
create policy access_logs_select on public.document_access_logs for select to authenticated using (true);

drop policy if exists favorites_own on public.favorites;
create policy favorites_own on public.favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================================
-- 9. WORKFLOW, NOTIFIKASI, AI, AUDIT
-- ============================================================================
drop policy if exists workflow_select on public.workflow_approvals;
create policy workflow_select on public.workflow_approvals for select to authenticated using (true);
drop policy if exists workflow_insert on public.workflow_approvals;
create policy workflow_insert on public.workflow_approvals for insert to authenticated
  with check (requested_by = auth.uid() or public.has_permission(public.get_my_role(), 'workflow.manage'));
drop policy if exists workflow_update on public.workflow_approvals;
create policy workflow_update on public.workflow_approvals for update to authenticated
  using (
    requested_by = auth.uid() or reviewer_id = auth.uid() or approver_id = auth.uid()
    or public.has_permission(public.get_my_role(), 'workflow.manage')
  )
  with check (
    requested_by = auth.uid() or reviewer_id = auth.uid() or approver_id = auth.uid()
    or public.has_permission(public.get_my_role(), 'workflow.manage')
  );

drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notif_insert on public.notifications;
create policy notif_insert on public.notifications for insert to authenticated
  with check (auth.uid() is not null);
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists ai_conv_own on public.ai_conversations;
create policy ai_conv_own on public.ai_conversations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists ai_msg_select on public.ai_messages;
create policy ai_msg_select on public.ai_messages for select to authenticated
  using (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()));
drop policy if exists ai_msg_insert on public.ai_messages;
create policy ai_msg_insert on public.ai_messages for insert to authenticated
  with check (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()));

drop policy if exists audit_insert on public.audit_logs;
create policy audit_insert on public.audit_logs for insert to authenticated
  with check (auth.uid() is not null);
drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select to authenticated using (true);

-- ============================================================================
-- 10. STORAGE BUCKETS (privat, akses via kebijakan di bawah)
-- ============================================================================
-- CATATAN: kolom allowed_mime_types di storage.buckets bertipe text[] (array
-- PostgreSQL), sehingga wajib memakai array[...]::text[] — BUKAN ::jsonb.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 10485760,
    array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/zip'
    ]::text[]),
  ('regulations', 'regulations', false, 10485760, array['application/pdf']::text[]),
  ('templates', 'templates', false, 10485760,
    array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]::text[]),
  ('avatars', 'avatars', false, 2097152, array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do nothing;

-- Kebijakan Storage untuk bucket dokumen: keamanan mengikuti RLS tabel documents.
-- Struktur path: documents/{document_id}/{nama-file} → cocokkan documents.file_path.
drop policy if exists storage_documents_read on storage.objects;
create policy storage_documents_read on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'documents'
    and (
      -- 1) Berkas yang sudah tercatat pada baris dokumen: keamanan mengikuti
      --    klasifikasi/kepemilikan lewat can_read_document.
      exists (
        select 1 from public.documents d
        where d.file_path = 'documents/' || name
          and public.can_read_document(d.classification, d.category, d.owner_id)
      )
      -- 2) Berkas baru/yang sedang diunggah (file_path belum tercatat):
      --    pemilik dokumen atau penyelia (documents.edit). WAJIB ADA karena
      --    Storage API mengunggah dengan upsert → INSERT ... RETURNING *,
      --    dan RETURNING * menuntut baris baru TERLIHAT oleh SELECT policy —
      --    tanpa cabang ini unggahan selalu ditolak dengan
      --    "new row violates row-level security policy".
      or exists (
        select 1 from public.documents d
        where d.id::text = split_part(name, '/', 1)
          and (
            d.owner_id = auth.uid()
            or public.has_permission(public.get_my_role(), 'documents.edit')
          )
      )
    )
  );

drop policy if exists storage_documents_write on storage.objects;
create policy storage_documents_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.has_permission(public.get_my_role(), 'documents.create')
  );

drop policy if exists storage_documents_update on storage.objects;
create policy storage_documents_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.documents d
      where d.file_path = 'documents/' || name
        and (d.owner_id = auth.uid() or public.has_permission(public.get_my_role(), 'documents.edit'))
    )
  );

drop policy if exists storage_documents_delete on storage.objects;
create policy storage_documents_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.documents d
      where d.file_path = 'documents/' || name
        and (d.owner_id = auth.uid() or public.has_permission(public.get_my_role(), 'documents.delete'))
    )
  );

-- Bucket regulations: baca publik (metadata), unggah kelola regulations.manage
drop policy if exists storage_regulations_read on storage.objects;
create policy storage_regulations_read on storage.objects
  for select to authenticated
  using (bucket_id = 'regulations');

drop policy if exists storage_regulations_write on storage.objects;
create policy storage_regulations_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'regulations' and public.has_permission(public.get_my_role(), 'regulations.manage'));

drop policy if exists storage_regulations_delete on storage.objects;
create policy storage_regulations_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'regulations' and public.has_permission(public.get_my_role(), 'regulations.manage'));

-- Bucket templates: baca untuk semua pengguna terautentikasi, kelola templates.manage
drop policy if exists storage_templates_read on storage.objects;
create policy storage_templates_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'templates');

drop policy if exists storage_templates_write on storage.objects;
create policy storage_templates_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'templates' and public.has_permission(public.get_my_role(), 'templates.manage'));

drop policy if exists storage_templates_delete on storage.objects;
create policy storage_templates_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'templates' and public.has_permission(public.get_my_role(), 'templates.manage'));

-- Bucket avatars: hanya pemilik folder (auth.uid()/…)
drop policy if exists storage_avatars_own on storage.objects;
create policy storage_avatars_own on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- 11. PROMOSI ADMIN PERTAMA (WAJIB DIJALANKAN SETELAH MEMBUAT AKUN ADMIN)
-- ----------------------------------------------------------------------------
-- Buat dulu pengguna di Dashboard Supabase: Authentication → Add user.
-- Ganti email di bawah sesuai akun admin Anda, lalu jalankan:
--
-- UPDATE public.profiles SET role = 'super_admin' WHERE email = 'admin@yayasan.sch.id';
--
-- Alternatif dengan metadata pendaftaran: user dapat mendaftar lewat UI
-- (jika diaktifkan) dengan opsi data { "full_name": "Nama", "role": "pegawai" },
-- kemudian dipromosikan oleh admin berjalan melalui halaman Pengaturan.
-- ============================================================================
