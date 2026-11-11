-- ============================================================================
-- HR KNOWLEDGE CENTER YAYASAN — seed.sql
-- Jalankan SETELAH schema.sql dan policies.sql.
-- Data awal: role, permission, matriks RBAC, kategori, link referensi resmi,
-- regulasi contoh (status verifikasi jujur), kebijakan, SOP, template,
-- artikel pengetahuan, dan pengaturan sistem.
-- ============================================================================
set client_encoding = 'utf8';

-- ============================================================================
-- 1. ROLES
-- ============================================================================
insert into public.roles (key, name, description, level) values
  ('super_admin', 'Super Administrator', 'Akses penuh: pengguna, role, konfigurasi, dan seluruh dokumen', 1),
  ('pembina', 'Pembina / Pengurus Yayasan', 'Melihat kebijakan strategis, regulasi, laporan, dan dashboard tata kelola', 2),
  ('direktur_pendidikan', 'Direktur Pendidikan', 'Akses kebijakan pendidikan dan dokumen guru & tenaga kependidikan', 2),
  ('direktur_pelayanan', 'Direktur Pelayanan & Pengembangan Lembaga', 'Akses kebijakan pelayanan, pengembangan lembaga, dan laporan HRD', 2),
  ('manajer_hrd', 'Manajer HRD', 'Mengelola seluruh dokumen, regulasi, SOP, verifikasi, kategori, dan referensi', 3),
  ('kepala_bidang_hrd', 'Kepala Bidang HRD', 'Mengunggah & memperbarui dokumen sesuai bidang, mengelola pengetahuan', 4),
  ('kepala_sekolah', 'Kepala Sekolah / Manajer Unit', 'Mengakses pedoman, SOP, template, dan dokumen sesuai kewenangan', 4),
  ('pegawai', 'Pegawai', 'Melihat dokumen publik internal, mengunduh formulir, kebijakan pegawai', 5),
  ('guest', 'Guest / Visitor', 'Hanya referensi dan dokumen yang ditetapkan publik', 9)
on conflict (key) do nothing;

-- ============================================================================
-- 2. PERMISSIONS
-- ============================================================================
insert into public.permissions (key, module, description) values
  ('dashboard.view','dashboard','Melihat dashboard'),
  ('regulations.view','regulations','Melihat regulasi'),
  ('regulations.manage','regulations','Mengelola regulasi (tambah/edit/hapus/arsip/pemeriksaan)'),
  ('legal.view','legal','Melihat legal & governance center'),
  ('legal.manage','legal','Mengelola dokumen legalitas'),
  ('policies.view','policies','Melihat kebijakan'),
  ('policies.manage','policies','Mengelola kebijakan'),
  ('documents.view','documents','Melihat dokumen (sesuai klasifikasi)'),
  ('documents.create','documents','Mengunggah dokumen'),
  ('documents.edit','documents','Mengubah dokumen'),
  ('documents.delete','documents','Menghapus dokumen'),
  ('documents.verify','documents','Memverifikasi dokumen'),
  ('sop.view','sop','Melihat SOP'),
  ('sop.manage','sop','Mengelola SOP'),
  ('templates.view','templates','Melihat & mengunduh template'),
  ('templates.manage','templates','Mengelola template'),
  ('links.view','links','Melihat link referensi'),
  ('links.manage','links','Mengelola link referensi'),
  ('knowledge.view','knowledge','Melihat knowledge base'),
  ('knowledge.manage','knowledge','Mengelola knowledge base'),
  ('assistant.use','assistant','Menggunakan AI HR Assistant'),
  ('workflow.view','workflow','Melihat workflow'),
  ('workflow.manage','workflow','Menjalankan persetujuan workflow'),
  ('monitoring.view','monitoring','Melihat monitoring regulasi'),
  ('monitoring.manage','monitoring','Mengelola monitoring regulasi'),
  ('reports.view','reports','Melihat dan mengekspor laporan'),
  ('settings.view','settings','Melihat pengaturan'),
  ('settings.manage','settings','Mengubah pengaturan sistem'),
  ('users.manage','users','Mengelola pengguna & role'),
  ('favorites.use','favorites','Menggunakan favorit')
on conflict (key) do nothing;

-- ============================================================================
-- 3. MATRIKS ROLE ↔ PERMISSION (mirror config.js)
-- ============================================================================
insert into public.role_permissions (role_key, permission_key)
select r.key, p.key
from (values
  ('pembina','dashboard.view'),('pembina','regulations.view'),('pembina','legal.view'),('pembina','policies.view'),('pembina','documents.view'),('pembina','sop.view'),('pembina','templates.view'),('pembina','links.view'),('pembina','knowledge.view'),('pembina','assistant.use'),('pembina','workflow.view'),('pembina','monitoring.view'),('pembina','reports.view'),('pembina','settings.view'),('pembina','favorites.use'),
  ('direktur_pendidikan','dashboard.view'),('direktur_pendidikan','regulations.view'),('direktur_pendidikan','legal.view'),('direktur_pendidikan','policies.view'),('direktur_pendidikan','documents.view'),('direktur_pendidikan','sop.view'),('direktur_pendidikan','templates.view'),('direktur_pendidikan','links.view'),('direktur_pendidikan','knowledge.view'),('direktur_pendidikan','assistant.use'),('direktur_pendidikan','workflow.view'),('direktur_pendidikan','monitoring.view'),('direktur_pendidikan','reports.view'),('direktur_pendidikan','settings.view'),('direktur_pendidikan','favorites.use'),
  ('direktur_pelayanan','dashboard.view'),('direktur_pelayanan','regulations.view'),('direktur_pelayanan','legal.view'),('direktur_pelayanan','policies.view'),('direktur_pelayanan','documents.view'),('direktur_pelayanan','sop.view'),('direktur_pelayanan','templates.view'),('direktur_pelayanan','links.view'),('direktur_pelayanan','knowledge.view'),('direktur_pelayanan','assistant.use'),('direktur_pelayanan','workflow.view'),('direktur_pelayanan','monitoring.view'),('direktur_pelayanan','reports.view'),('direktur_pelayanan','settings.view'),('direktur_pelayanan','favorites.use'),
  ('manajer_hrd','dashboard.view'),('manajer_hrd','regulations.view'),('manajer_hrd','regulations.manage'),('manajer_hrd','legal.view'),('manajer_hrd','legal.manage'),('manajer_hrd','policies.view'),('manajer_hrd','policies.manage'),('manajer_hrd','documents.view'),('manajer_hrd','documents.create'),('manajer_hrd','documents.edit'),('manajer_hrd','documents.delete'),('manajer_hrd','documents.verify'),('manajer_hrd','sop.view'),('manajer_hrd','sop.manage'),('manajer_hrd','templates.view'),('manajer_hrd','templates.manage'),('manajer_hrd','links.view'),('manajer_hrd','links.manage'),('manajer_hrd','knowledge.view'),('manajer_hrd','knowledge.manage'),('manajer_hrd','assistant.use'),('manajer_hrd','workflow.view'),('manajer_hrd','workflow.manage'),('manajer_hrd','monitoring.view'),('manajer_hrd','monitoring.manage'),('manajer_hrd','reports.view'),('manajer_hrd','settings.view'),('manajer_hrd','favorites.use'),
  ('kepala_bidang_hrd','dashboard.view'),('kepala_bidang_hrd','regulations.view'),('kepala_bidang_hrd','legal.view'),('kepala_bidang_hrd','policies.view'),('kepala_bidang_hrd','documents.view'),('kepala_bidang_hrd','documents.create'),('kepala_bidang_hrd','documents.edit'),('kepala_bidang_hrd','sop.view'),('kepala_bidang_hrd','sop.manage'),('kepala_bidang_hrd','templates.view'),('kepala_bidang_hrd','links.view'),('kepala_bidang_hrd','knowledge.view'),('kepala_bidang_hrd','knowledge.manage'),('kepala_bidang_hrd','assistant.use'),('kepala_bidang_hrd','workflow.view'),('kepala_bidang_hrd','monitoring.view'),('kepala_bidang_hrd','reports.view'),('kepala_bidang_hrd','settings.view'),('kepala_bidang_hrd','favorites.use'),
  ('kepala_sekolah','dashboard.view'),('kepala_sekolah','regulations.view'),('kepala_sekolah','legal.view'),('kepala_sekolah','policies.view'),('kepala_sekolah','documents.view'),('kepala_sekolah','sop.view'),('kepala_sekolah','templates.view'),('kepala_sekolah','links.view'),('kepala_sekolah','knowledge.view'),('kepala_sekolah','assistant.use'),('kepala_sekolah','workflow.view'),('kepala_sekolah','monitoring.view'),('kepala_sekolah','reports.view'),('kepala_sekolah','settings.view'),('kepala_sekolah','favorites.use'),
  ('pegawai','dashboard.view'),('pegawai','policies.view'),('pegawai','documents.view'),('pegawai','templates.view'),('pegawai','links.view'),('pegawai','knowledge.view'),('pegawai','assistant.use'),('pegawai','settings.view'),('pegawai','favorites.use'),
  ('guest','documents.view'),('guest','templates.view'),('guest','links.view'),('guest','knowledge.view')
) as m(role_key, permission_key)
join public.roles r on r.key = m.role_key
join public.permissions p on p.key = m.permission_key
on conflict (role_key, permission_key) do nothing;

-- ============================================================================
-- 4. KATEGORI
-- ============================================================================
insert into public.categories (slug, name, type) values
  ('legalitas-yayasan','Legalitas Yayasan','document'),
  ('kebijakan-sdm','Kebijakan SDM','document'),
  ('perencanaan-sdm','Perencanaan SDM','document'),
  ('rekrutmen','Rekrutmen','document'),
  ('pengangkatan','Pengangkatan','document'),
  ('data-personal-pegawai','Data Personal Pegawai','document'),
  ('kehadiran-perizinan','Kehadiran dan Perizinan','document'),
  ('kinerja','Kinerja','document'),
  ('pengembangan-sdm','Pengembangan SDM','document'),
  ('penggajian','Penggajian','document'),
  ('disiplin','Disiplin','document'),
  ('mutasi-promosi','Mutasi dan Promosi','document'),
  ('kesehatan-perlindungan','Kesehatan dan Perlindungan','document'),
  ('pemberhentian','Pemberhentian','document'),
  ('laporan-hrd','Laporan HRD','document'),
  ('tata-naskah','Tata Naskah Dinas','document'),
  ('reg-yayasan','Regulasi Yayasan','regulation'),
  ('reg-ketenagakerjaan','Regulasi Ketenagakerjaan','regulation'),
  ('reg-pendidikan','Regulasi Pendidikan','regulation'),
  ('reg-perlindungan-sosial','Regulasi Perlindungan Sosial','regulation'),
  ('reg-perpajakan','Regulasi Perpajakan','regulation'),
  ('reg-pelindungan-data','Regulasi Pelindungan Data','regulation'),
  ('sop-perencanaan-kebutuhan','Perencanaan Kebutuhan Pegawai','sop'),
  ('sop-rekrutmen-seleksi','Rekrutmen dan Seleksi','sop'),
  ('sop-pengangkatan-pegawai','Pengangkatan Pegawai','sop'),
  ('sop-administrasi-kepegawaian','Administrasi Kepegawaian','sop'),
  ('sop-presensi','Presensi','sop'),
  ('sop-perizinan-cuti','Perizinan dan Cuti','sop'),
  ('sop-penggajian','Penggajian','sop'),
  ('sop-bpjs','BPJS','sop'),
  ('sop-pph21','PPh 21','sop'),
  ('sop-mutasi-promosi','Mutasi dan Promosi','sop'),
  ('sop-penilaian-kinerja','Penilaian Kinerja','sop'),
  ('sop-pengembangan-sdm','Pengembangan SDM','sop'),
  ('sop-disiplin-pembinaan','Disiplin dan Pembinaan','sop'),
  ('sop-k3','Kesehatan dan Keselamatan Kerja','sop'),
  ('sop-pengunduran-diri','Pengunduran Diri','sop'),
  ('sop-pemberhentian','Pemberhentian','sop'),
  ('sop-pengarsipan','Pengarsipan Dokumen','sop')
on conflict (slug) do nothing;

-- ============================================================================
-- 5. LINK REFERENSI RESMI (Modul 8)
-- ============================================================================
insert into public.external_links (name, url, category, link_type, description, agency, verified_at, is_active, notes) values
  ('JDIH Badan Pemeriksa Keuangan','https://peraturan.bpk.go.id/','regulasi-nasional','resmi','Pencarian seluruh peraturan Indonesia beserta naskah konsolidasi dan status berlaku.','Badan Pemeriksa Keuangan RI', current_date - 30, true,'Gunakan untuk memeriksa status peraturan sebelum dikutip di dokumen internal.'),
  ('JDIH Kementerian Ketenagakerjaan','https://jdih.kemnaker.go.id/','regulasi-nasional','resmi','Regulasi ketenagakerjaan, PMA, dan bahan bacaan ketenagakerjaan.','Kementerian Ketenagakerjaan RI', current_date - 30, true,'Acuan perizinan hubungan industrial.'),
  ('JDIH Kementerian Hukum','https://jdih.kemenkum.go.id/','regulasi-nasional','resmi','Basis data hukum nasional: UU, PP, peraturan menteri.','Kementerian Hukum RI', current_date - 30, true,'Referensi legalitas badan hukum yayasan.'),
  ('JDIH Kemendikdasmen','https://jdih.kemdikdasmen.go.id/','regulasi-nasional','resmi','Regulasi pendidikan dasar dan menengah.','Kemendikdasmen RI', current_date - 30, true,'Cek regulasi guru dan tenaga kependidikan terbaru.'),
  ('JDIH Kementerian Keuangan','https://jdih.kemenkeu.go.id/','regulasi-nasional','resmi','Peraturan perpajakan: PMK, PP, dan UU bidang keuangan.','Kementerian Keuangan RI', current_date - 30, true,'Acuan PPh 21 dan kewajiban pajak yayasan.'),
  ('SISMINBAKUM AHU','https://ahu.go.id/','yayasan-legalitas','resmi','Layanan pendaftaran badan hukum yayasan dan perubahan AD/ART.','Kementerian Hukum RI', current_date - 45, true,'Digunakan saat pengesahan akta perubahan dan pengurus baru.'),
  ('Portal AHU Online','https://portal.ahu.go.id/','yayasan-legalitas','resmi','Portal pendaftaran badan hukum online.','Kementerian Hukum RI', current_date - 45, true,'Pengajuan legalitas secara elektronik.'),
  ('Kementerian Ketenagakerjaan','https://kemnaker.go.id/','ketenagakerjaan','resmi','Informasi kebijakan ketenagakerjaan dan pelatihan kerja.','Kementerian Ketenagakerjaan RI', current_date - 40, true,'Sumber berita kebijakan ketenagakerjaan.'),
  ('Satu Data Ketenagakerjaan','https://satudata.kemnaker.go.id/','ketenagakerjaan','resmi','Data statistik ketenagakerjaan dan upah minimum.','Kementerian Ketenagakerjaan RI', current_date - 40, true,'Referensi benchmark upah.'),
  ('Kemendikdasmen','https://kemendikdasmen.go.id/','pendidikan','resmi','Kebijakan pendidikan nasional.','Kemendikdasmen RI', current_date - 38, true,'Kebijakan umum pendidikan.'),
  ('Dapodik','https://dapo.kemendikdasmen.go.id/','pendidikan','resmi','Basis Data Pendidikan untuk pengelolaan data satuan dan pendidik.','Kemendikdasmen RI', current_date - 38, true,'Sinkronisasi data guru tiap semester.'),
  ('Info GTK','https://info.gtk.kemendikdasmen.go.id/','pendidikan','resmi','Layanan Guru dan Tenaga Kependidikan: NUPTK, sertifikasi.','Kemendikdasmen RI', current_date - 38, true,'Pengecekan NUPTK dan program guru.'),
  ('BPJS Ketenagakerjaan','https://www.bpjsketenagakerjaan.go.id/','jaminan-sosial','resmi','Jaminan kecelakaan kerja, hari tua, kematian, dan pensiun.','BPJS Ketenagakerjaan', current_date - 35, true,'Registrasi pekerja dan simulasi iuran.'),
  ('BPJS Kesehatan','https://www.bpjs-kesehatan.go.id/','jaminan-sosial','resmi','Jaminan kesehatan nasional untuk pegawai dan keluarga.','BPJS Kesehatan', current_date - 35, true,'Pendaftaran pegawai baru dan perubahan data.'),
  ('Direktorat Jenderal Pajak','https://www.pajak.go.id/','perpajakan','resmi','Regulasi dan layanan perpajakan nasional.','Kementerian Keuangan RI', current_date - 32, true,'Pelaporan SPT dan bukti potong PPh 21.'),
  ('DJP Online','https://djponline.pajak.go.id/','perpajakan','resmi','Portal layanan elektronik DJP.','Kementerian Keuangan RI', current_date - 32, true,'Unggah bukti potong dan SPT bulanan.'),
  ('Badan Pusat Statistik','https://www.bps.go.id/','statistik-penelitian','resmi','Data statistik nasional: indeks upah, inflasi.','BPS RI', current_date - 50, true,'Referensi data ekonomi untuk analisis kesejahteraan.'),
  ('Google Scholar','https://scholar.google.com/','statistik-penelitian','ilmiah','Mesin pencari karya ilmiah bidang HR dan pendidikan.','Google', current_date - 50, true,'Rujukan artikel knowledge base dari jurnal terakreditasi.'),
  ('Garuda Kemdikbud','https://garuda.kemdikbud.go.id/','statistik-penelitian','ilmiah','Gerbang data publikasi jurnal nasional Indonesia.','Kemdikbud RI', current_date - 50, true,'Pencarian literatur nasional.')
on conflict (url) do nothing;

-- ============================================================================
-- 6. REGULASI CONTOH (status verifikasi dijaga jujur — WAJIB diperiksa ulang)
-- ============================================================================
insert into public.regulations (number, year, title, category, issuer, status, verification_status, verification_note, summary, provisions, promulgation_date, last_checked_at, official_url, hrd_notes) values
  ('UU No. 13 Tahun 2003', 2003, 'Ketenagakerjaan', 'ketenagakerjaan', 'Pemerintah RI', 'berlaku', 'terverifikasi',
   'Banyak diubah, terakhir melalui UU No. 6 Tahun 2023 (Penetapan Perppu Cipta Kerja). Selalu rujuk naskah konsolidasi terbaru.',
   'Dasar hukum utama hubungan kerja di Indonesia: PKWT/PKWTT, upah, waktu kerja, cuti, perlindungan, dan PHK.',
   'Hubungan industrial; pelatihan kerja; penempatan; perlindungan tenaga kerja; perikatan kerja; upah; kesejahteraan; pengawasan; pemberhentian; penyelesaian perselisihan.',
   '2003-03-25', current_date - 60, 'https://peraturan.bpk.go.id/Details/45324/uu-no-13-tahun-2003', 'Acuan utama seluruh pedoman hubungan kerja yayasan.'),
  ('UU No. 6 Tahun 2023', 2023, 'Penetapan Perppu No. 2 Tahun 2022 tentang Cipta Kerja menjadi Undang-Undang', 'ketenagakerjaan', 'Pemerintah RI / DPR RI', 'berlaku', 'terverifikasi',
   'Berlaku sejak 31 Maret 2023.',
   'Menetapkan Perppu Cipta Kerja menjadi undang-undang; perubahan besar pada ketenagakerjaan.',
   'Perubahan UU Ketenagakerjaan; perubahan pengupahan; kemudahan berusaha; pelindungan pekerja.',
   '2023-03-31', current_date - 60, 'https://peraturan.bpk.go.id/Details/249638/uu-no-6-tahun-2023', 'Perbarui skenario kontrak dan struktur upah berdasarkan regulasi ini.'),
  ('PP No. 35 Tahun 2021', 2021, 'PKWT, Alih Daya, Waktu Kerja dan Waktu Istirahat, dan PHK', 'ketenagakerjaan', 'Pemerintah RI', 'berlaku', 'terverifikasi',
   'Pemeriksaan terakhir melalui JDIH Kemnaker.',
   'Aturan pelaksanaan PKWT (maks. 5 tahun), alih daya, waktu kerja/istirahat, dan jenis-jenis PHK beserta haknya.',
   'Jabatan alih daya; PKWT berdasarkan jangka waktu; waktu kerja 40 jam/minggu; istirahat; PHK; uang pemutusan hubungan kerja.',
   '2021-02-02', current_date - 80, 'https://peraturan.bpk.go.id/Details/161924/pp-no-35-tahun-2021', 'Dasar penyusunan pedoman kontrak kerja dan prosedur PHK.'),
  ('PP No. 36 Tahun 2021', 2021, 'Pengupahan', 'ketenagakerjaan', 'Pemerintah RI', 'perlu_verifikasi', 'perlu_verifikasi',
   'Telah diubah melalui PP No. 51 Tahun 2023 tentang perubahan pengupahan. Periksa ulang sebelum digunakan.',
   'Aturan pengupahan: upa minimum, struktur & skala upa, upa saat PHK, denda potongan upa.',
   'Prinsip pengupahan; upa minimum; struktur dan skala upa; upa lembur; bentuk upa; cara pembayaran; denda dan potongan upa.',
   '2021-02-02', current_date - 290, 'https://peraturan.bpk.go.id/Details/161926/pp-no-36-tahun-2021', 'Gunakan bersama PP 51/2023. Tinjauan struktur & skala upa setiap tahun.'),
  ('UU No. 16 Tahun 2001', 2001, 'Yayasan', 'yayasan', 'Pemerintah RI', 'diubah', 'terverifikasi',
   'Diubah melalui UU No. 28 Tahun 2004.',
   'Dasar hukum badan hukum yayasan: pendirian, organ, harta kekayaan, dan pembubaran.',
   'Pendirian; akta notaris; persetujuan menteri; organ yayasan; rapat organ; harta kekayaan; laporan tahunan; sanksi.',
   '2001-12-28', current_date - 190, 'https://peraturan.bpk.go.id/Details/45372/uu-no-16-tahun-2001', 'Acuan legalitas yayasan dan kewenangan organ dalam pengangkatan pegawai.'),
  ('UU No. 28 Tahun 2004', 2004, 'Perubahan atas UU No. 16 Tahun 2001 tentang Yayasan', 'yayasan', 'Pemerintah RI / DPR RI', 'berlaku', 'terverifikasi',
   'Pemeriksaan terakhir 2026.',
   'Perubahan UU Yayasan terkait keanggotaan organ, saling mengawasi, sanksi, dan lembaga yang didirikan.',
   'Kepanitiaan pembina/pengawas; saling mengawasi antar organ; laporan tahunan; sanksi administratif.',
   '2004-10-08', current_date - 190, 'https://peraturan.bpk.go.id/Details/43176/uu-no-28-tahun-2004', 'Referensi kewenangan yayasan terhadap lembaga/unit pendidikan.'),
  ('UU No. 14 Tahun 2005', 2005, 'Guru dan Dosen', 'pendidikan', 'Pemerintah RI / DPR RI', 'perlu_verifikasi', 'perlu_verifikasi',
   'Ada perubahan terkait Cipta Kerja (UU 6/2023) pada aspek beban kerja dan pengembangan diri. Wajib tinjau naskah konsolidasi.',
   'Kedudukan, fungsi, hak, kewajiban, kualifikasi, sertifikasi, dan beban kerja guru serta dosen.',
   'Fungsi dan peran guru; hak dan kewajiban; kualifikasi akademik; sertifikasi pendidik; beban kerja guru (24 jam tatap muka); karier; pengembangan diri.',
   '2005-12-30', current_date - 295, 'https://peraturan.bpk.go.id/Details/45445/uu-no-14-tahun-2005', 'Dasar kebijakan khusus guru. Tinjau ulang status perubahan.'),
  ('PP No. 74 Tahun 2008', 2008, 'Guru', 'pendidikan', 'Pemerintah RI', 'perlu_verifikasi', 'perlu_verifikasi',
   'Regulasi pelaksanaan UU Guru dan Dosen; periksa perubahan terbaru melalui JDIH Kemendikdasmen.',
   'Ketentuan pelaksanaan untuk guru: pembinaan, sertifikasi, tunjangan, dan penyediaan guru.',
   'Pembinaan dan pengembangan guru; sertifikasi; tunjangan sertifikasi; penyediaan guru; jam kerja guru.',
   '2008-09-10', current_date - 370, 'https://peraturan.bpk.go.id/Details/37890/pp-no-74-tahun-2008', 'Rujukan kebijakan beban kerja guru di unit pendidikan.'),
  ('UU No. 24 Tahun 2011', 2011, 'Badan Penyelenggara Jaminan Sosial', 'perlindungan_sosial', 'Pemerintah RI / DPR RI', 'berlaku', 'terverifikasi',
   'Dasar pendirian BPJS Kesehatan dan BPJS Ketenagakerjaan.',
   'Membentuk BPJS sebagai penyelenggara jaminan sosial nasional.',
   'Jaminan kesehatan; jaminan kecelakaan kerja; jaminan kematian; jaminan hari tua; jaminan pensiun; keikutsertaan pemberi kerja.',
   '2011-11-24', current_date - 120, 'https://peraturan.bpk.go.id/Details/45245/uu-no-24-tahun-2011', 'Wajib daftar seluruh pegawai ke BPJS Kesehatan & Ketenagakerjaan.'),
  ('UU No. 27 Tahun 2022', 2022, 'Pelindungan Data Pribadi', 'pelindungan_data', 'Pemerintah RI / DPR RI', 'berlaku', 'terverifikasi',
   'Berlaku penuh sejak berakhirnya masa transisi 2 tahun.',
   'Pelindungan data pribadi, termasuk data pegawai yang diproses yayasan.',
   'Dasar pemrosesan data pribadi; hak subjek data; kewajiban pengendali dan prosesor data; pelanggaran dan sanksi.',
   '2022-10-17', current_date - 135, 'https://peraturan.bpk.go.id/Details/223120/uu-no-27-tahun-2022', 'Klasifikasi Data Personal Pegawai terbatas; akses hanya HRD berwenang.'),
  ('PMK No. 168 Tahun 2023', 2023, 'Perhitungan Besaran dan Pelunasan PPh Pasal 21 (TER)', 'perpajakan', 'Kementerian Keuangan RI', 'berlaku', 'terverifikasi',
   'Terakhir diperiksa melalui JDIH Kemenkeu.',
   'Tarif efektif rata-rata (TER) untuk perhitungan PPh 21 karyawan dan pelunasan pajak.',
   'Kategori TER bulanan; penghitungan neto bulanan; pelunasan melalui bukti potong; kewajiban pemberi kerja.',
   '2023-12-26', current_date - 150, 'https://peraturan.bpk.go.id/Details/277009/pmk-no-168-tahun-2023', 'Perbarui tabel TER pada SOP penggajian tiap awal tahun.'),
  ('UU No. 7 Tahun 2021', 2021, 'Harmonisasi Peraturan Perpajakan (HPP)', 'perpajakan', 'Pemerintah RI / DPR RI', 'perlu_verifikasi', 'perlu_verifikasi',
   'Sering berubah (terkait PPh, PPN, KUP). Periksa perubahan terbaru melalui JDIH Kemenkeu.',
   'Harmonisasi peraturan perpajakan: PPh, PPN, KUP, tarif korporat.',
   'Tarif PPh pasal 17; PPh final; PPN; Ketentuan Umum dan Tata Cara Perpajakan; keringanan pajak.',
   '2021-10-29', current_date - 340, 'https://peraturan.bpk.go.id/Details/182514/uu-no-7-tahun-2021', 'Cek juga UU KUP (UU 28/2007 jo. perubahannya).'),
  ('PP No. 19 Tahun 2017', 2017, 'Perubahan atas PP No. 19 Tahun 2005 tentang Manajemen Kepegawaian Guru', 'pendidikan', 'Pemerintah RI', 'perlu_verifikasi', 'perlu_verifikasi',
   'Status dan rujukan terbaru perlu diperiksa melalui JDIH Kemendikdasmen.',
   'Manajemen kepegawaian guru: pembinaan, pemenuhan kebutuhan, penugasan, pelatihan, pemberhentian.',
   'Pembinaan guru; pemenuhan kebutuhan; penempatan dan penugasan; pelatihan; pemberhentian.',
   '2017-06-27', current_date - 420, 'https://peraturan.bpk.go.id/Details/45898/pp-no-19-tahun-2017', 'Rujukan penataan administrasi guru pada unit pendidikan.')
on conflict (number, year) do nothing;

insert into public.regulation_relations (regulation_id, related_id, relation_type)
select a.id, b.id, 'mengubah' from public.regulations a, public.regulations b
where (a.number, a.year) = ('UU No. 13 Tahun 2003', 2003) and (b.number, b.year) = ('UU No. 6 Tahun 2023', 2023)
on conflict do nothing;

insert into public.regulation_relations (regulation_id, related_id, relation_type)
select a.id, b.id, 'mengubah' from public.regulations a, public.regulations b
where (a.number, a.year) = ('UU No. 16 Tahun 2001', 2001) and (b.number, b.year) = ('UU No. 28 Tahun 2004', 2004)
on conflict do nothing;

-- ============================================================================
-- 7. KEBIJAKAN CONTOH
-- ============================================================================
insert into public.policies (number, title, category, version, effective_date, approver, summary, content, status) values
  ('HR-POL-001','Pedoman Manajemen SDM Yayasan','manajemen-sdm','2.1','2025-07-01','Ketua Dewan Pembina',
   'Pedoman induk pengelolaan SDM yayasan: perencanaan, rekrutmen, pengembangan, penggajian, dan pengakhiran kerja.',
   'Pedoman ini menjadi rujukan utama seluruh unit pendidikan dalam mengelola pegawai: struktur kepegawaian (PKWTT, PKWT, honor), alur rekrutmen, hak dan kewajiban, pengembangan kompetensi, penilaian kinerja, kesejahteraan, hingga pengakhiran hubungan kerja sesuai regulasi yang berlaku.','dipublikasikan'),
  ('HR-POL-002','Peraturan Kepegawaian Yayasan','status-pegawai','3.0','2025-01-01','Direktur Utama',
   'Peraturan kepegawaian internal: status pegawai, waktu kerja, cuti, disiplin, dan penyelesaian masalah.',
   'Mengikat seluruh pegawai PKWTT dan PKWT. Mencakup jam kerja (40 jam/minggu), cuti tahunan (12 hari), cuti melahirkan, izin keperluan pribadi, tata tertib, sanksi disiplin bertahap, serta mekanisme pengaduan internal.','dipublikasikan'),
  ('HR-POL-003','Pedoman Rekrutmen dan Seleksi Pegawai','rekrutmen','1.4','2025-03-15','Manajer HRD',
   'Proses rekrutmen guru dan tenaga kependidikan: analisis kebutuhan, seleksi, kontrak, dan orientasi.',
   'Mengatur alur pengisian kebutuhan pegawai: permintaan unit, publikasi lowongan, seleksi administrasi, tes, wawancara, demo kelas (guru), tawaran kerja, hingga penandatanganan kontrak dan verifikasi ijazah.','dipublikasikan'),
  ('HR-POL-004','Pedoman Cuti dan Izin Pegawai','manajemen-sdm','1.2','2024-08-01','Manajer HRD',
   'Jenis cuti/izin, kuota, prosedur pengajuan, dan persetujuan.',
   'Cuti tahunan 12 hari, cuti melahirkan 3 bulan sesuai ketentuan, cuti penting, izin tidak dibayar, dan alur pengajuan melalui sistem presensi. Pengajuan minimal 3 hari kerja sebelumnya kecuali keadaan darurat.','dipublikasikan'),
  ('HR-POL-005','Pedoman Penilaian Kinerja Pegawai','kinerja','2.0','2025-11-01','Direktur Pendidikan',
   'Siklus penilaian kinerja guru dan tendik: penetapan KPI, monitoring, dan evaluasi tahunan.',
   'Kinerja dinilai melalui KPI/IKI yang disepakati awal tahun. Untuk guru mencakup kualitas pembelajaran, pengembangan diri, dan kontribusi kelembagaan. Hasil penilaian menjadi dasar promosi, pelatihan, dan remunerasi kinerja.','review'),
  ('HR-POL-006','Kode Etik dan Pakta Integritas Pegawai','disiplin','1.1','2024-01-01','Ketua Dewan Pembina',
   'Nilai, etika, dan integritas yang wajib dipegang seluruh pegawai yayasan pendidikan.',
   'Setiap pegawai menandatangani pakta integritas: menolak gratifikasi, menjaga kerahasiaan data siswa dan pegawai, berpedoman antikorupsi, dan menjaga citra yayasan. Pelanggaran etika diperiksa oleh komite etik internal.','dipublikasikan')
on conflict (number) do nothing;

-- ============================================================================
-- 8. SOP CONTOH (4 utama; tambahkan lainnya melalui UI)
-- ============================================================================
insert into public.sop_documents (number, name, category, purpose, scope, definitions, legal_basis, parties, supporting_docs, procedure, flowchart_steps, sla, output, related_forms, responsible, effective_date, version, status) values
  ('SOP-HRD-001','SOP Rekrutmen dan Seleksi','rekrutmen-seleksi',
   'Memperoleh kandidat guru/tendik berkualitas dengan proses adil dan terdokumentasi.',
   'Seluruh permintaan pengisian posisi di unit pendidikan dan sekretariat.',
   'PKWT: Perjanjian Kerja Waktu Tertentu. HRD: Human Resources Department.',
   'UU No. 13 Tahun 2003; PP No. 35 Tahun 2021; Pedoman Rekrutmen HR-POL-003.',
   'HRD, Kepala Unit, Direktur Pendidikan, Kandidat.',
   'Formulir Permintaan Pegawai, Formulir Lamaran, Formulir Wawancara.',
   '1. Unit mengajukan permintaan pegawai.\n2. HRD menganalisis kebutuhan.\n3. Publikasi lowongan.\n4. Seleksi administrasi.\n5. Tes/wawancara/demo kelas.\n6. Rekomendasi kandidat.\n7. Penawaran kerja.\n8. Kontrak dan orientasi.',
   'Permintaan Pegawai|Analisis Kebutuhan|Publikasi Lowongan|Seleksi Administrasi|Tes & Wawancara|Penawaran Kerja|Kontrak & Orientasi',
   'Seleksi selesai maksimal 21 hari kerja sejak permintaan disetujui.',
   'Pegawai baru dengan kontrak terdaftar dan berkas lengkap.',
   'Formulir Permintaan Pegawai; Formulir Lamaran; Formulir Wawancara',
   'Kepala Bidang HRD','2025-03-15','2.0','dipublikasikan'),
  ('SOP-HRD-002','SOP Pengangkatan Pegawai Baru','pengangkatan-pegawai',
   'Memastikan pengangkatan pegawai sah secara dokumen dan siap bekerja.',
   'Seluruh pegawai baru PKWTT/PKWT.',
   'SK: Surat Keputusan.',
   'UU No. 13 Tahun 2003; Pedoman Manajemen SDM HR-POL-001.',
   'HRD, Direktur Utama, Kepala Unit, Pegawai baru.',
   'SK Pengangkatan, Surat Pernyataan, Pakta Integritas.',
   '1. Penyusunan berkas pengangkatan.\n2. Terbit SK Pengangkatan.\n3. Penandatanganan kontrak & pakta integritas.\n4. Registrasi BPJS, email, akun aplikasi.\n5. Orientasi 2 hari.\n6. Serah terima ke unit kerja.',
   'Penyusunan Berkas|Terbit SK Pengangkatan|Penandatanganan Kontrak|Registrasi BPJS & Akun|Orientasi|Serah Terima Unit Kerja',
   'Maksimal 5 hari kerja sejak persetujuan.',
   'Pegawai terdaftar di sistem dan aktif bekerja.',
   'SK Pengangkatan; Pakta Integritas',
   'Kepala Bidang HRD','2025-01-20','1.3','dipublikasikan'),
  ('SOP-HRD-003','SOP Presensi Pegawai','presensi',
   'Mencatat kehadiran secara akurat sebagai dasar penggajian dan disiplin.',
   'Seluruh pegawai tetap dan kontrak.',
   'Presensi: pencatatan kehadiran.',
   'Peraturan Kepegawaian HR-POL-002.',
   'Seluruh pegawai, HRD, Kepala Unit.',
   'Rekap presensi bulanan, Formulir Izin.',
   '1. Presensi masuk sebelum 07.15.\n2. Presensi keluar setelah 16.00.\n3. Keterlambatan tercatat otomatis.\n4. Rekap setiap tanggal 2.\n5. Rekap dikirim ke penggajian dan kepala unit.',
   'Presensi Masuk|Aktivitas Hari Kerja|Presensi Keluar|Rekap Bulanan HRD|Laporan ke Penggajian',
   'Rekap terbit tanggal 2, revisi maksimal tanggal 5.',
   'Rekap kehadiran bulanan terverifikasi.',
   'Formulir Izin',
   'Kepala Bidang HRD','2025-02-01','1.5','dipublikasikan'),
  ('SOP-HRD-004','SOP Pengajuan Cuti dan Izin','perizinan-cuti',
   'Mengatur alur pengajuan cuti/izin agar layanan tetap berjalan.',
   'Seluruh pegawai.',
   'Cuti tahunan: hak cuti 12 hari kerja per tahun.',
   'UU No. 13 Tahun 2003; Pedoman Cuti dan Izin HR-POL-004.',
   'Pegawai, Atasan langsung, HRD, Kepala Unit.',
   'Formulir Cuti, Formulir Izin.',
   '1. Pengajuan minimal 3 hari sebelumnya.\n2. Rekomendasi atasan.\n3. Verifikasi saldo cuti (HRD).\n4. Persetujuan pimpinan.\n5. Pencatatan sistem.\n6. Penyerahan tugas untuk cuti >= 3 hari.',
   'Pengajuan Pegawai|Rekomendasi Atasan|Verifikasi Saldo Cuti|Persetujuan Pimpinan|Pencatatan Sistem|Penyerahan Tugas',
   'Keputusan maksimal 2 hari kerja.',
   'Record cuti tercatat dan penggantian tugas jelas.',
   'Formulir Cuti; Formulir Izin',
   'Kepala Bidang HRD','2024-08-01','1.2','dipublikasikan'),
  ('SOP-HRD-005','SOP Penggajian Pegawai','penggajian',
   'Menjamin penggajian tepat jumlah, tepat waktu, dan sesuai potongan wajib.',
   'Seluruh pegawai PKWTT, PKWT, dan honorarium.',
   'TER: Tarif Efektif Rata-rata (PPh 21).',
   'PP No. 36 Tahun 2021 jo. PP No. 51 Tahun 2023; PMK No. 168 Tahun 2023.',
   'HRD, Keuangan, Direktur Utama, Pegawai.',
   'Rekap presensi, daftar potongan BPJS, tabel TER.',
   '1. Tanggal 2: rekap presensi.\n2. Tanggal 5: penghitungan gaji.\n3. Tanggal 8: verifikasi silang.\n4. Tanggal 10: pengesahan slip gaji.\n5. Tanggal 25: transfer gaji dan bukti potong PPh 21.',
   'Rekap Presensi|Penghitungan Gaji|Verifikasi Silang|Pengesahan Direktur|Transfer Gaji|Slip & Bukti Potong',
   'Gaji dibayarkan selambat-lambatnya tanggal 25.',
   'Slip gaji, bukti potong PPh 21, laporan bulanan.',
   'Formulir Evaluasi Pegawai',
   'Manajer HRD','2025-01-01','2.2','dipublikasikan'),
  ('SOP-HRD-006','SOP Pendaftaran dan Pengelolaan BPJS','bpjs',
   'Memastikan seluruh pegawai aktif terdaftar BPJS Kesehatan dan Ketenagakerjaan.',
   'Seluruh pegawai wajib BPJS.',
   'JKK: Jaminan Kecelakaan Kerja. JHT: Jaminan Hari Tua. JKM: Jaminan Kematian.',
   'UU No. 24 Tahun 2011.',
   'HRD, BPJS, Pegawai.',
   'Formulir pendaftaran BPJS, data kepegawaian.',
   '1. Data pegawai baru dalam 14 hari.\n2. Pendaftaran ke BPJS.\n3. Aktivasi kartu digital.\n4. Potongan iuran pada penggajian.\n5. Pelaporan perubahan status bulanan.',
   'Pengumpulan Data|Pendaftaran BPJS|Aktivasi Kartu|Iuran pada Penggajian|Pelaporan Perubahan Status',
   'Pendaftaran pegawai baru maksimal 14 hari.',
   'Pegawai terdaftar aktif; laporan iuran bulanan.',
   'Formulir Permintaan Pegawai',
   'Kepala Bidang HRD','2025-02-10','1.1','dipublikasikan'),
  ('SOP-HRD-007','SOP Pengunduran Diri Pegawai','pengunduran-diri',
   'Mengatur proses pengunduran diri yang tertib dan profesional.',
   'Seluruh pegawai.',
   'Exit interview: wawancara keluar.',
   'UU No. 13 Tahun 2003; PP No. 35 Tahun 2021.',
   'Pegawai, Atasan, HRD, Keuangan.',
   'Surat pengunduran diri, Formulir Exit Interview, Berita Acara.',
   '1. Pengajuan minimal 30 hari sebelumnya.\n2. Diskusi dengan atasan dan HRD.\n3. Serah terima tugas.\n4. Exit interview.\n5. Penyelesaian hak.\n6. SK Pemberhentian dan arsip.',
   'Surat Pengunduran Diri|Konfirmasi & Diskusi|Serah Terima Tugas|Exit Interview|Penyelesaian Hak|SK Pemberhentian & Arsip',
   'Selesai dalam masa pemberitahuan 30 hari.',
   'SK pemberhentian, berita acara, laporan exit interview.',
   'Formulir Exit Interview; SK Pemberhentian',
   'Manajer HRD','2025-04-01','1.2','review'),
  ('SOP-HRD-008','SOP Penilaian Kinerja Pegawai','penilaian-kinerja',
   'Mengukur kinerja objektif sebagai dasar pengembangan, promosi, dan remunerasi.',
   'Seluruh pegawai tetap dan kontrak.',
   'KPI: Key Performance Indicator. IKI: Individu Key Indicator.',
   'Pedoman Penilaian Kinerja HR-POL-005.',
   'Pegawai, Atasan, HRD, Direktur.',
   'Formulir Penilaian Kinerja, KPI/IKI individu.',
   '1. Awal tahun: penetapan KPI/IKI.\n2. Tengah tahun: monitoring.\n3. Akhir tahun: penilaian.\n4. Diskusi hasil.\n5. Konsolidasi HRD.\n6. Program pengembangan.',
   'Penetapan KPI/IKI|Monitoring Tengah Tahun|Penilaian Akhir Tahun|Diskusi Hasil|Konsolidasi HRD|Program Pengembangan',
   'Selesai maksimal 31 Desember.',
   'Hasil penilaian terdokumentasi dan rencana pengembangan.',
   'Formulir Penilaian Kinerja; Formulir Evaluasi Pegawai',
   'Manajer HRD','2025-10-01','2.0','dipublikasikan')
on conflict (number) do nothing;

-- ============================================================================
-- 9. TEMPLATE CONTOH (kelompok surat/formulir/instrumen)
-- ============================================================================
insert into public.templates (code, name, group_name, description, version) values
  ('TPL-SK-001','SK Pengangkatan Pegawai','surat','Format SK pengangkatan pegawai baru dengan kop, dasar, dan tanda tangan.','1.2'),
  ('TPL-SK-002','SK Mutasi','surat','SK penugasan/mutasi pegawai antar unit pendidikan.','1.1'),
  ('TPL-SK-003','SK Promosi','surat','SK kenaikan jabatan/promosi berdasarkan hasil penilaian kinerja.','1.0'),
  ('TPL-SK-004','SK Penugasan dan SK Pelaksana Tugas (Pjs)','surat','SK penugasan jabatan serta penetapan pelaksana tugas.','1.0'),
  ('TPL-SK-005','SK Pemberhentian','surat','SK pemberhentian dengan hormat/menghormat.','1.1'),
  ('TPL-SR-001','Surat Teguran dan Surat Peringatan','surat','Surat teguran dan peringatan tahap 1-3 sesuai pedoman disiplin.','1.0'),
  ('TPL-SR-002','Surat Keterangan Kerja','surat','Surat keterangan bekerja untuk keperluan administrasi pegawai.','1.3'),
  ('TPL-SR-003','Surat Tugas','surat','Surat penugasan pegawai untuk kegiatan dinas luar/diklat.','1.1'),
  ('TPL-SR-004','Surat Izin dan Surat Undangan','surat','Format surat izin keperluan pribadi dan undangan rapat resmi.','1.0'),
  ('TPL-BA-001','Berita Acara','surat','Berita acara rapat, serah terima jabatan, dan kegiatan kepegawaian.','1.0'),
  ('TPL-FM-001','Formulir Lamaran Pegawai','formulir','Formulir lamaran lengkap dengan data diri, pendidikan, dan pernyataan.','2.0'),
  ('TPL-FM-002','Formulir Wawancara','formulir','Lembar penilaian wawancara kandidat dengan rubrik kompetensi.','1.2'),
  ('TPL-FM-003','Formulir Cuti dan Izin','formulir','Formulir pengajuan cuti tahunan, cuti penting, dan izin.','1.4'),
  ('TPL-FM-004','Formulir Exit Interview','formulir','Panduan wawancara keluar pegawai.','1.0'),
  ('TPL-IN-001','Job Description dan Job Specification','instrumen','Format uraian tugas dan spesifikasi jabatan guru/tendik.','1.1'),
  ('TPL-IN-002','KPI dan IKI Template','instrumen','Template penetapan KPI/IKI individu dengan bobot dan skala.','2.0'),
  ('TPL-IN-003','Training Need Analysis (TNA)','instrumen','Instrumen identifikasi kebutuhan pelatihan per unit.','1.0'),
  ('TPL-IN-004','Talent Mapping','instrumen','Matriks pemetaan bakat-kinerja pegawai untuk perencanaan suksesi.','1.0')
on conflict (code) do nothing;

-- ============================================================================
-- 10. ARTIKEL KNOWLEDGE BASE CONTOH
-- ============================================================================
insert into public.knowledge_articles (title, author, category, summary, content, "references", status, published_at) values
  ('Memahami Perbedaan PKWT dan PKWTT di Lembaga Pendidikan','Rina Kartika, S.Psi., M.M.','industrial-relations',
   'Ringkasan praktis perbedaan perjanjian kerja waktu tertentu dan tidak tertentu serta implikasinya bagi yayasan pendidikan.',
   'PKWT adalah perjanjian berdasarkan jangka waktu atau pencapaian pekerjaan tertentu. Pada lembaga pendidikan umumnya untuk guru honorer per tahun ajaran dan dapat diperpanjang dengan batas durasi sesuai PP No. 35 Tahun 2021.\n\nPKWTT mengikat tanpa batas waktu, memberi kepastian masa kerja, hak cuti tahunan, jaminan sosial, dan proteksi PHK lebih kuat.\n\nPraktik yang direkomendasikan: klasifikasi posisi, gunakan template kontrak terverifikasi, catat tanggal akhir kontrak di sistem, dan evaluasi kinerja sebelum perpanjangan.',
   'UU No. 13 Tahun 2003; PP No. 35 Tahun 2021; Pedoman Manajemen SDM Yayasan v2.1.','dipublikasikan', current_date - 90),
  ('Manajemen Kinerja Guru: dari KPI sampai Remunerasi','Dr. Siti Nurhaliza, M.Pd.','performance-mgmt',
   'Membangun siklus manajemen kinerja guru yang objektif: penetapan indikator, monitoring, dan kaitan dengan pengembangan.',
   'Manajemen kinerja guru dimulai dari penetapan indikator di awal tahun: KPI untuk capaian strategis unit dan IKI untuk tugas spesifik guru.\n\nMonitoring tengah tahun membantu deteksi dini kesulitan. Penilaian akhir tahun dibahas dalam sesi umpan balik dua arah.\n\nHasil penilaian digunakan untuk program pelatihan, pemetaan talenta, penugasan tambahan, dan remunerasi kinerja.',
   'Pedoman Penilaian Kinerja HR-POL-005; Template KPI/IKI TPL-IN-002.','dipublikasikan', current_date - 60),
  ('HR Analytics untuk Yayasan Pendidikan: Mulai dari Data yang Ada','Yusuf Maulana, S.A.','hr-analytics',
   'Cara sederhana memanfaatkan data kepegawaian yang sudah dimiliki HRD untuk pengambilan keputusan.',
   'HR analytics tidak harus rumit. Mulailah dari empat metrik dasar: rasio pegawai tetap vs kontrak; tingkat perputaran per unit; rata-rata hari cuti terpakai; dan biaya pelatihan per pegawai.\n\nData sumbernya sudah ada: rekap presensi, dokumen kontrak, laporan penggajian, dan sertifikat pelatihan.',
   'Laporan HRD Triwulan; Dokumentasi modul HR Knowledge Center.','dipublikasikan', current_date - 110),
  ('Tata Kelola SDM Boarding School: Tantangan dan Solusi','H. Muhammad Ridwan, S.H.','boarding-school',
   'Karakteristik pengelolaan pegawai di lingkungan asrama pendidikan dan kerangka kebijakan yang disarankan.',
   'Boarding school memiliki karakter pegawai unik: jam kerja panjang, tugas pendampingan asrama (musyrif/musyrifah), dan batasan interaksi.\n\nKerangka kebijakan: uraian tugas khusus musyrif, pola shift pendampingan, tunjangan pendampingan terpisah, kode etik asrama, dan mekanisme pelaporan aman.\n\nSemua tetap berlandaskan UU Ketenagakerjaan: waktu kerja, istirahat, dan hak cuti wajib dipenuhi.',
   'UU No. 13 Tahun 2003; PP No. 35 Tahun 2021.','dipublikasikan', current_date - 150),
  ('Onboarding Pegawai Baru: 30 Hari Pertama yang Menentukan','Dewi Lestari, S.E.','manajemen-sdm',
   'Checklist orientasi pegawai baru agar produktivitas dan rasa memiliki cepat terbangun.',
   'Hari 1-2: orientasi organisasi, kartu BPJS, akun aplikasi.\nMinggu 1: pembekalan kebijakan utama dan KPI.\nMinggu 2-3: pendampingan mentor (buddy).\nMinggu 4: evaluasi awal dan target 90 hari.\n\nDokumentasikan setiap tahap menggunakan Formulir Evaluasi Pegawai.',
   'SOP Pengangkatan Pegawai SOP-HRD-002.','dipublikasikan', current_date - 30),
  ('Kepatuhan BPJS bagi Yayasan Pendidikan Swasta','Rina Kartika, S.Psi., M.M.','comp-benefits',
   'Kewajiban jaminan sosial pegawai yayasan: cakupan program, iuran, dan risiko ketidakpatuhan.',
   'Yayasan wajib mendaftarkan pegawai ke BPJS Kesehatan dan BPJS Ketenagakerjaan (JKK, JKM, JHT; pensiun untuk PKWTT).\n\nIuran dibagi antara yayasan dan pegawai sesuai ketentuan dan harus dipotong serta disetor tepat waktu.\n\nPraktik terbaik: integrasikan pendaftaran BPJS dalam SOP pengangkatan, rekonsiliasi iuran bulanan, dan arsipkan kartu digital pada folder terbatas.',
   'UU No. 24 Tahun 2011; SOP BPJS SOP-HRD-006.','dipublikasikan', current_date - 170)
on conflict do nothing;

-- ============================================================================
-- 11. TAGS
-- ============================================================================
insert into public.tags (slug, name) values
  ('pkwt','PKWT'),('pkwtt','PKWTT'),('kinerja','Kinerja'),('bpjs','BPJS'),
  ('pph21','PPh 21'),('cuti','Cuti'),('guru','Guru')
on conflict (slug) do nothing;

-- ============================================================================
-- 12. PENGATURAN SISTEM
-- ============================================================================
insert into public.system_settings (key, value) values
  ('org_name', '{"text": "Yayasan Pendidikan (Nama Yayasan Anda)"}'::jsonb),
  ('review_reminder_days', '{"days": 365}'::jsonb),
  ('assistant_context_limit', '{"chars": 12000}'::jsonb)
on conflict (key) do nothing;

-- ============================================================================
-- SELESAI — lanjutkan dengan:
-- 1) Membuat akun admin di Authentication → Add user
-- 2) UPDATE public.profiles SET role='super_admin' WHERE email='email-admin-anda';
-- ============================================================================
