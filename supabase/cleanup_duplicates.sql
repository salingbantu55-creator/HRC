-- ============================================================
-- cleanup_duplicates.sql — Bersihkan baris dokumen yang tersimpan ganda
-- ============================================================
-- Latar belakang:
--   Sebelum perbaikan (kunci tombol Simpan), menekan "Tambah Dokumen"/
--   "Unggah Dokumen" lebih dari sekali saat proses berjalan, atau mengulang
--   simpan setelah gagal, dapat membuat BEBERAPA baris dengan data identik
--   pada tabel documents (judul + nomor + tanggal berlaku sama).
--
-- Kebijakan pembersihan:
--   - Disisakan SATU baris per kombinasi:
--       category + title + doc_number + valid_from
--   - Baris yang DIPERTAHANKAN diprioritaskan:
--       1) yang sudah memiliki berkas (file_path / file_name terisi),
--       2) lalu yang dibuat paling baru (created_at terbesar).
--   - Baris penanda turunan (tags, versi, log akses) yang menunjuk ke
--     dokumen yang sudah dihapus ikut dibersihkan.
--
-- Cara pakai: Supabase Dashboard → SQL Editor → jalankan per blok di bawah.
-- Idempoten: aman dijalankan berulang (setelah bersih, tidak menghapus apa pun).
-- ============================================================

-- ------------------------------------------------------------
-- LANGKAH 1 (opsional): LIHAT dulu daftar duplikat yang akan dihapus.
-- Jalankan blok ini sendiri bila ingin memeriksa sebelum menghapus.
-- ------------------------------------------------------------
-- with ranked as (
--   select id, category, title, doc_number, valid_from, created_at, file_path, file_name,
--          row_number() over (
--            partition by category, title, coalesce(doc_number, ''), coalesce(valid_from::text, '')
--            order by (file_path is not null or file_name is not null) desc,
--                     created_at desc, id desc
--          ) as rn
--   from public.documents
-- )
-- select id, category, title, doc_number, valid_from, created_at, file_path, rn
-- from ranked
-- where rn > 1
-- order by category, title, created_at desc;

-- ------------------------------------------------------------
-- LANGKAH 2: HAPUS duplikat (menyisakan satu baris per kombinasi).
-- ------------------------------------------------------------
with ranked as (
  select id,
         row_number() over (
           partition by category, title, coalesce(doc_number, ''), coalesce(valid_from::text, '')
           order by (file_path is not null or file_name is not null) desc,
                    created_at desc, id desc
         ) as rn
  from public.documents
)
delete from public.documents d
using ranked r
where d.id = r.id
  and r.rn > 1;

-- ------------------------------------------------------------
-- LANGKAH 3: Bersihkan baris penanda turunan yang menunjuk ke dokumen
-- yang sudah tidak ada (parent_type = 'document').
-- ------------------------------------------------------------
delete from public.document_tags
where parent_type = 'document'
  and parent_id not in (select id from public.documents);

delete from public.document_versions
where parent_type = 'document'
  and parent_id not in (select id from public.documents);

delete from public.document_access_logs
where parent_type = 'document'
  and parent_id not in (select id from public.documents);

-- ------------------------------------------------------------
-- LANGKAH 4 (opsional): VERIFIKASI — seharusnya tidak ada lagi kombinasi ganda.
-- Hasil: baris dengan jumlah > 1 berarti masih ada duplikat.
-- ------------------------------------------------------------
-- select category, title, doc_number, coalesce(valid_from::text, '') as valid_from, count(*) as jumlah
-- from public.documents
-- group by 1, 2, 3, 4
-- having count(*) > 1
-- order by jumlah desc;
