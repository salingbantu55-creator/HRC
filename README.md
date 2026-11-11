# HR Knowledge Center Yayasan

> **Pusat Pengetahuan, Regulasi, dan Tata Kelola Sumber Daya Manusia Yayasan Pendidikan.**

Aplikasi web enterprise yang mengintegrasikan seluruh regulasi ketenagakerjaan, peraturan yayasan, kebijakan SDM, SOP, dokumen kepegawaian, formulir/template, referensi resmi, knowledge base, AI Assistant (Gemini), workflow persetujuan, monitoring regulasi, dan laporan — dalam satu sistem dengan RBAC 9 role, Row Level Security (RLS), audit trail, dan dark/light mode.

---

## 1. Ringkasan Fitur (13 Modul)

| # | Modul | Fungsi Utama |
|---|-------|--------------|
| 1 | Dashboard | Statistik kartu, grafik pertumbuhan (Chart.js), dokumen terpopuler, aktivitas, quick access |
| 2 | Regulatory Center | Regulasi nasional/sektoral + status verifikasi, relasi antar-regulasi, riwayat pemeriksaan |
| 3 | Legal & Governance Center | Akta, SK keorganisasian, AD/ART, matriks kewenangan — dikelompokkan per kerahasiaan |
| 4 | HR Policy Center | Kebijakan dengan nomor, versi, pengesah, riwayat revisi, integrasi workflow |
| 5 | SOP Center | SOP lengkap (tujuan, prosedur, flowchart, SLA, output, formulir terkait) |
| 6 | HR Document Library | Unggah PDF/DOC/XLS/PPT/gambar, pratinjau PDF, versioning, tag, favorit, statistik |
| 7 | Template & Form Center | SK/surat, formulir, instrumen HR (JD, KPI/IKI, TNA, Talent Mapping) siap unduh |
| 8 | HR Reference Links | Direktori JDIH/AHU/Kemnaker/Kemendikdasmen/BPJS/DJP/BPS + verifikasi link |
| 9 | HR Knowledge Base | Artikel pengetahuan HRD per kategori + knowledge sharing internal |
| 10 | Madani HR Assistant | Gemini API via Edge Function + RAG dokumen internal, anti-halusinasi |
| 11 | Document Workflow | Draft → Diajukan → Review → Revisi → Disetujui → Dipublikasikan → Diarsipkan |
| 12 | Regulatory Monitoring | Jadwal pemeriksaan, penandaan perlu tinjau, penghubung regulasi pengganti |
| 13 | HR Report Center | 10 laporan + ekspor Excel, CSV, PDF |

**Keamanan:** Supabase Auth (email+password, reset), RBAC 9 role, RLS pada semua tabel, Storage policies berbasis klasifikasi dokumen, audit trail, klasifikasi Publik/Internal/Terbatas/Rahasia, proteksi khusus kategori *Data Personal Pegawai* (sesuai UU No. 27 Tahun 2022).

**Catatan penting:** aplikasi **tidak menyatakan** otomatis bahwa suatu peraturan masih berlaku. Setiap regulasi memiliki `status` dan `tanggal pemeriksaan terakhir` yang harus diisi hasil pemeriksaan manual melalui JDIH resmi.

---

## 2. Struktur Proyek

```
hr-knowledge-center/
├── index.html                 # Entry point (SPA)
├── assets/
│   ├── css/
│   │   ├── style.css          # Tema navy-putih-emas + dark mode
│   │   └── responsive.css     # Tablet, mobile, print
│   ├── js/
│   │   ├── config.js          # Konstanta, RBAC matrix, kategori
│   │   ├── seed-data.js       # Data contoh untuk Mode Demo
│   │   ├── ui.js              # Komponen bersama (tabel, modal, ekspor)
│   │   ├── supabase.js        # Lapisan data Supabase + adapter demo
│   │   ├── auth.js            # Login, reset sandi, guard permission
│   │   ├── app.js             # Shell, router, search global, notifikasi
│   │   ├── dashboard.js  regulations.js  legal.js  policies.js
│   │   ├── sop.js        documents.js    templates.js  links.js
│   │   ├── knowledge.js  assistant.js    workflow.js   monitoring.js
│   │   └── reports.js    settings.js
│   └── images/                # (opsional) logo statis
├── supabase/
│   ├── schema.sql             # 25 tabel, trigger, index, fungsi keamanan
│   ├── policies.sql           # RLS + Storage buckets + Storage policies
│   ├── seed.sql               # Data awal: roles, permission, link, konten
│   └── functions/
│       └── hr-assistant/
│           └── index.ts       # Edge Function Gemini (kunci di server)
└── README.md
```

> **Catatan tambahan:** file `seed-data.js` dan `ui.js` ditambahkan dari struktur minimum pada prompt untuk menopang Mode Demo dan komponen bersama — tidak mengubah arsitektur ES Modules yang diminta.

---

## 3. Prasyarat

- Akun **Supabase** (gratis): https://supabase.com
- **Gemini API Key** (opsional, untuk AI penuh): https://aistudio.google.com/apikey
- Node.js + Supabase CLI (untuk deploy Edge Function): `npm i -g supabase`
- Browser modern (Chrome/Edge/Firefox).

---

## 4. Panduan Membuat Project Supabase

1. Buka https://supabase.com → **Sign in** → **New project**.
2. Isi nama (mis. `hr-knowledge-center`), pilih region terdekat (Singapore), buat **Database Password** (simpan aman).
3. Tunggu hingga project ter-provision.
4. Ambil kredensial: **Project Settings → API**:
   - `Project URL` → contoh `https://abcdefgh.supabase.co`
   - `anon / publishable key` → kunci panjang berawalan `eyJ…`
   - ⚠️ **Jangan gunakan Service Role Key di frontend.** Kunci tersebut hanya dipakai otomatis oleh Edge Function melalui environment server.

---

## 5. Panduan Menghubungkan Database

1. Buka **SQL Editor** di dashboard Supabase.
2. Jalankan **berurutan** (masing-masing satu eksekusi):
   1. `supabase/schema.sql` — tabel, trigger, index, fungsi keamanan.
   2. `supabase/policies.sql` — RLS + Storage buckets + policies.
   3. `supabase/seed.sql` — data awal (role, permission, link resmi, konten contoh).
3. Hasil yang benar: tidak ada error; pada **Table Editor** muncul tabel `profiles, regulations, documents, policies, sop_documents, templates, external_links, knowledge_articles, workflow_approvals, notifications, audit_logs,` dst.
4. **Autentikasi** → Providers → pastikan **Email** aktif. (Opsional: matikan *Confirm email* untuk lingkungan internal agar login langsung aktif.)

## 6. Menjalankan Aplikasi

Aplikasi memakai **ES Modules**, sehingga harus disajikan lewat HTTP (bukan dobel-klik file):

**Cara A — lokal:**
```bash
cd hr-knowledge-center
python -m http.server 8080
# buka http://localhost:8080
```

**Cara B — VS Code Live Server** (klik kanan `index.html` → *Open with Live Server*).

**Mode pertama kali:** aplikasi berjalan pada **Mode Demo** (data contoh di peramban, 9 akun siap pakai — kata sandi semua: `demo1234`). Untuk data nyata:

1. Login ke aplikasi → **Pengaturan** (atau tombol ⚙ di layar login) → **Konfigurasi Supabase**.
2. Masukkan **Project URL** dan **Anon Key** → **Test Koneksi** (cek Auth/Database/Storage) → **Simpan**.
3. Halaman dimuat ulang dan kini terhubung ke Supabase Anda (banner "Mode Demo" hilang).

---

## 7. Panduan Membuat Akun Admin

1. Dashboard Supabase → **Authentication → Users → Add user** → isi email + kata sandi → **Create user**.
2. SQL Editor → jalankan (ganti email):
   ```sql
   UPDATE public.profiles
   SET role = 'super_admin', is_active = true
   WHERE email = 'admin@yayasan.sch.id';
   ```
3. Login ke aplikasi dengan akun tersebut. Menu **Pengaturan → Manajemen Pengguna & Role** kini tersedia untuk mengatur role pengguna lain.
4. Role lain cukup dibuat lewat Add user (profil otomatis dengan role `pegawai`), lalu diubah dari halaman Pengaturan.

## 8. Panduan Memasang API Key Gemini (di Server)

Kunci Gemini **tidak pernah** ditempatkan di file frontend:

```bash
# 1. Login Supabase CLI dan tautkan project
supabase login
supabase link --project-ref <project-ref>     # abcdefgh dari URL project

# 2. Simpan kunci sebagai secret server
supabase secrets set GEMINI_API_KEY=your_gemini_api_key

# 3. Deploy Edge Function dari folder proyek
supabase functions deploy hr-assistant
```

Uji cepat (opsional):
```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/hr-assistant" \
  -H "Authorization: Bearer <access-token-pengguna>" \
  -H "Content-Type: application/json" \
  -d '{"message": "Apa perbedaan PKWT dan PKWTT?"}'
```

Tanpa langkah ini, modul AI tetap berjalan dalam **Mode Demo** (retrieval dokumen lokal) dan menampilkan catatan bahwa AI penuh menunggu Edge Function.

---

## 9. Panduan Deployment ke GitHub dan Vercel

**GitHub:**
```bash
cd hr-knowledge-center
git init && git add -A && git commit -m "HR Knowledge Center Yayasan v1.0"
git branch -M main
git remote add origin https://github.com/<username>/hr-knowledge-center.git
git push -u origin main
```

**Vercel (static):**
1. https://vercel.com → **Add New → Project** → pilih repo di atas.
2. Framework Preset: **Other** (statis). Build Command: kosong. Output Directory: `./` (root).
3. **Deploy**. Situs tersedia di `https://<nama>.vercel.app`.
4. (Opsional) Tambahkan domain yayasan di *Settings → Domains*.

> Supabase URL/Anon key tidak perlu masuk Vercel Environment Variables karena dikonfigurasi lewat UI aplikasi (tersimpan di peramban tiap pengguna; hanya kunci publik anon).

---

## 10. Roles & Hak Akses (Ringkas)

| Role | Kemampuan Inti |
|------|----------------|
| Super Administrator | Semua + manajemen pengguna & role + konfigurasi |
| Pembina/Pengurus | Lihat kebijakan strategis, regulasi, laporan, dashboard tata kelola |
| Direktur Pendidikan | Lihat kebijakan pendidikan & dokumen guru/tendik |
| Direktur Pelayanan | Lihat kebijakan pelayanan & laporan HRD |
| Manajer HRD | Kelola seluruh konten, verifikasi dokumen, referensi, workflow |
| Kepala Bidang HRD | Unggah/edit dokumen bidangnya, kelola pengetahuan |
| Kepala Sekolah | Akses pedoman/SOP/template sesuai kewenangan |
| Pegawai | Dokumen publik internal, unduh formulir, kebijakan pegawai |
| Guest | Hanya referensi & dokumen berklasifikasi Publik |

Matriks lengkap terlihat di **Pengaturan → Matriks Hak Akses** dan diimplementasikan di dua tempat: `config.js` (frontend, untuk tampilan) dan `policies.sql` + fungsi `has_permission()` (database, **penentu keamanan sesungguhnya**).

---

## 11. Checklist Pengujian (laporan hasil ada di bagian 14)

1. ✅ Login & logout (demo + Supabase)
2. ✅ Reset password (email Supabase)
3. ✅ Hak akses 9 role (menu & aksi menyesuaikan; RLS menjaga di sisi DB)
4. ✅ Upload dokumen (PDF/DOC/XLS/PPT/gambar, maks 10 MB)
5. ✅ Download dokumen (menambah statistik & log akses)
6. ✅ Preview PDF (modal iframe)
7. ✅ Tambah/edit regulasi + catat pemeriksaan + relasi
8. ✅ Tambah SOP lengkap + flowchart otomatis
9. ✅ Pencarian global (Ctrl+K, riwayat, hasil per jenis)
10. ✅ Workflow approval (ajukan → review → revisi → disetujui → publikasi → arsip)
11. ✅ AI Assistant (demo retrieval; penuh setelah Edge Function + GEMINI_API_KEY)
12. ✅ Export laporan CSV/Excel/PDF
13. ✅ RLS & Storage security (klasifikasi + kategori personal)
14. ✅ Tampilan mobile (sidebar off-canvas) & dark mode
15. ✅ Refresh halaman → sesi & data bertahan (hash routing + Supabase session)

## 12. Troubleshooting

| Gejala | Penyebab | Solusi |
|--------|----------|--------|
| Halaman putih saat dibuka via file:// | ES Modules butuh HTTP | Jalankan `python -m http.server` atau deploy |
| "Akses ditolak oleh kebijakan keamanan (RLS)" | Role tidak memiliki permission | Periksa role di Pengaturan; pastikan `seed.sql` dijalankan |
| Test Koneksi: "skema belum dijalankan" | SQL belum dieksekusi | Jalankan schema → policies → seed |
| Storage "bucket belum dibuat" | policies.sql belum dijalankan | Jalankan `policies.sql` |
| AI: "GEMINI_API_KEY belum diset" | Secret Edge Function kosong | Ikuti bagian 8 |
| Email reset tidak terkirim | SMTP Supabase terbatas pada free tier | Aktifkan SMTP kustom di Auth → SMTP |

## 13. Keamanan — Ringkasan Implementasi

- **Service Role Key** hanya hidup di Edge Function (server). Frontend memakai anon key + RLS.
- RLS `force` aktif di seluruh tabel; Storage policies mencocokkan `documents.file_path` sehingga unduh berkas mengikuti klasifikasi dokumen.
- Kategori **Data Personal Pegawai** hanya untuk pemilik + HRD berwenang (UU PDP No. 27/2022).
- Audit trail tercatat pada `audit_logs`; akses dokumen pada `document_access_logs`.
- Validasi unggahan: tipe file diizinkan + batas 10 MB (diperiksa di UI *dan* di Storage bucket).

## 14. Status Pengujian Proyek Ini (Keterusteran)

Saat penyerahan, pengujian yang **sudah dilakukan**: seluruh alur frontend pada **Mode Demo** (login 9 role, semua modul, CRUD, workflow, laporan, ekspor, search, dark mode, mobile) melalui browser headless. Pengujian yang **memerlukan project Supabase Anda** (login asli, RLS, Storage, Edge Function + Gemini, email reset) mengikuti checklist bagian 11 setelah menyelesaikan bagian 5–8.

## 15. Lisensi & Kredit

Untuk penggunaan internal yayasan. Regulasi yang tercantum pada data contoh adalah konten awal dengan **status verifikasi yang disengaja jujur** — selalu periksa melalui JDIH resmi sebelum digunakan sebagai dasar keputusan.
