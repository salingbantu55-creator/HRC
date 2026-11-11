/* ============================================================
   config.js — Konfigurasi aplikasi, RBAC, dan katalog kategori
   HR Knowledge Center Yayasan
   ============================================================ */

export const APP = {
  name: 'HR Knowledge Center Yayasan',
  short: 'HR Knowledge Center',
  tagline: 'Pusat Pengetahuan, Regulasi, dan Tata Kelola Sumber Daya Manusia Yayasan Pendidikan.',
  version: '1.1.0',
  assistantName: 'Madani HR Assistant',
};

/* Kunci penyimpanan lokal (hanya untuk preferensi UI & mode demo) */
export const LS_KEYS = {
  supabase: 'hrk_supabase_config',
  theme: 'hrk_theme',
  demoDb: 'hrk_demo_db_v1',
  demoFiles: 'hrk_demo_files_v1',
  demoSession: 'hrk_demo_session_v1',
  searchHistory: 'hrk_search_history',
  favoritesUi: 'hrk_favorites_ui',
};

export const CLASSIFICATIONS = [
  { value: 'publik', label: 'Publik', hint: 'Dapat diakses semua pengguna termasuk tamu', badge: 'b-success' },
  { value: 'internal', label: 'Internal', hint: 'Seluruh pegawai internal yayasan', badge: 'b-info' },
  { value: 'terbatas', label: 'Terbatas', hint: 'Manajemen, HRD, dan pimpinan unit', badge: 'b-warning' },
  { value: 'rahasia', label: 'Rahasia', hint: 'Pembina, Manajer HRD, dan Super Admin', badge: 'b-danger' },
];

export const CLASSIFICATION_READ = {
  terbatas: ['super_admin', 'pembina', 'direktur_pendidikan', 'direktur_pelayanan', 'manajer_hrd', 'kepala_bidang_hrd', 'kepala_sekolah'],
  rahasia: ['super_admin', 'pembina', 'manajer_hrd'],
  personalOnly: ['super_admin', 'manajer_hrd', 'kepala_bidang_hrd'], // tambahan untuk kategori Data Personal Pegawai
};

/* ---------- Role ---------- */
export const ROLES = {
  super_admin: { name: 'Super Administrator', desc: 'Akses penuh: pengguna, role, konfigurasi, dan seluruh dokumen', level: 1 },
  pembina: { name: 'Pembina / Pengurus Yayasan', desc: 'Melihat kebijakan strategis, regulasi, laporan, dan dashboard tata kelola', level: 2 },
  direktur_pendidikan: { name: 'Direktur Pendidikan', desc: 'Akses kebijakan pendidikan dan dokumen guru & tenaga kependidikan', level: 2 },
  direktur_pelayanan: { name: 'Direktur Pelayanan & Pengembangan Lembaga', desc: 'Akses kebijakan pelayanan, pengembangan lembaga, dan laporan HRD', level: 2 },
  manajer_hrd: { name: 'Manajer HRD', desc: 'Mengelola seluruh dokumen, regulasi, SOP, verifikasi, kategori, dan referensi', level: 3 },
  kepala_bidang_hrd: { name: 'Kepala Bidang HRD', desc: 'Mengunggah & memperbarui dokumen sesuai bidang, mengelola pengetahuan', level: 4 },
  kepala_sekolah: { name: 'Kepala Sekolah / Manajer Unit', desc: 'Mengakses pedoman, SOP, template, dan dokumen sesuai kewenangan', level: 4 },
  pegawai: { name: 'Pegawai', desc: 'Melihat dokumen publik internal, mengunduh formulir, kebijakan pegawai', level: 5 },
  guest: { name: 'Guest / Visitor', desc: 'Hanya referensi dan dokumen yang ditetapkan publik', level: 9 },
};

/* ---------- Permissions ---------- */
export const PERMISSIONS = [
  'dashboard.view',
  'regulations.view', 'regulations.manage',
  'legal.view', 'legal.manage',
  'policies.view', 'policies.manage',
  'documents.view', 'documents.create', 'documents.edit', 'documents.delete', 'documents.verify',
  'sop.view', 'sop.manage',
  'templates.view', 'templates.manage',
  'links.view', 'links.manage',
  'knowledge.view', 'knowledge.manage',
  'assistant.use',
  'workflow.view', 'workflow.manage',
  'monitoring.view', 'monitoring.manage',
  'reports.view',
  'settings.view', 'settings.manage',
  'users.manage',
  'favorites.use',
];

export const ROLE_PERMS = {
  super_admin: PERMISSIONS, // akses penuh
  pembina: [
    'dashboard.view', 'regulations.view', 'legal.view', 'policies.view', 'documents.view',
    'sop.view', 'templates.view', 'links.view', 'knowledge.view', 'assistant.use',
    'workflow.view', 'monitoring.view', 'reports.view', 'settings.view', 'favorites.use',
  ],
  direktur_pendidikan: [
    'dashboard.view', 'regulations.view', 'legal.view', 'policies.view', 'documents.view',
    'sop.view', 'templates.view', 'links.view', 'knowledge.view', 'assistant.use',
    'workflow.view', 'monitoring.view', 'reports.view', 'settings.view', 'favorites.use',
  ],
  direktur_pelayanan: [
    'dashboard.view', 'regulations.view', 'legal.view', 'policies.view', 'documents.view',
    'sop.view', 'templates.view', 'links.view', 'knowledge.view', 'assistant.use',
    'workflow.view', 'monitoring.view', 'reports.view', 'settings.view', 'favorites.use',
  ],
  manajer_hrd: [
    'dashboard.view', 'regulations.view', 'regulations.manage', 'legal.view', 'legal.manage',
    'policies.view', 'policies.manage', 'documents.view', 'documents.create', 'documents.edit',
    'documents.delete', 'documents.verify', 'sop.view', 'sop.manage', 'templates.view', 'templates.manage',
    'links.view', 'links.manage', 'knowledge.view', 'knowledge.manage', 'assistant.use',
    'workflow.view', 'workflow.manage', 'monitoring.view', 'monitoring.manage', 'reports.view',
    'settings.view', 'favorites.use',
  ],
  kepala_bidang_hrd: [
    'dashboard.view', 'regulations.view', 'legal.view', 'policies.view', 'documents.view',
    'documents.create', 'documents.edit', 'sop.view', 'sop.manage', 'templates.view', 'links.view',
    'knowledge.view', 'knowledge.manage', 'assistant.use', 'workflow.view', 'monitoring.view',
    'reports.view', 'settings.view', 'favorites.use',
  ],
  kepala_sekolah: [
    'dashboard.view', 'regulations.view', 'legal.view', 'policies.view', 'documents.view',
    'sop.view', 'templates.view', 'links.view', 'knowledge.view', 'assistant.use',
    'workflow.view', 'monitoring.view', 'reports.view', 'settings.view', 'favorites.use',
  ],
  pegawai: [
    'dashboard.view', 'policies.view', 'documents.view', 'templates.view', 'links.view',
    'knowledge.view', 'assistant.use', 'settings.view', 'favorites.use',
  ],
  guest: [
    'documents.view', 'templates.view', 'links.view', 'knowledge.view',
  ],
};

export function permsOf(role) {
  return ROLE_PERMS[role] || ROLE_PERMS.guest;
}

/* ---------- Kategori Regulasi (Modul 2) ---------- */
export const REG_CATEGORIES = [
  { value: 'yayasan', label: 'Regulasi Yayasan' },
  { value: 'ketenagakerjaan', label: 'Regulasi Ketenagakerjaan' },
  { value: 'pendidikan', label: 'Regulasi Pendidikan' },
  { value: 'perlindungan_sosial', label: 'Regulasi Perlindungan Sosial' },
  { value: 'perpajakan', label: 'Regulasi Perpajakan' },
  { value: 'pelindungan_data', label: 'Regulasi Pelindungan Data' },
];

export const REG_STATUS = [
  { value: 'berlaku', label: 'Berlaku', badge: 'b-success' },
  { value: 'perlu_verifikasi', label: 'Perlu Verifikasi', badge: 'b-warning' },
  { value: 'diubah', label: 'Telah Diubah', badge: 'b-info' },
  { value: 'dicabut', label: 'Dicabut', badge: 'b-danger' },
  { value: 'diarsipkan', label: 'Diarsipkan', badge: 'b-navy' },
];

export const REG_RELATION_TYPES = [
  { value: 'mengubah', label: 'Mengubah' },
  { value: 'mencabut', label: 'Mencabut' },
  { value: 'diganti_oleh', label: 'Diganti Oleh' },
  { value: 'terkait', label: 'Terkait' },
];

/* ---------- Kategori Dokumen Perpustakaan (Modul 6) ---------- */
export const DOC_CATEGORIES = [
  { value: 'legalitas-yayasan', label: 'Legalitas Yayasan', icon: 'landmark', classification: 'rahasia' },
  { value: 'kebijakan-sdm', label: 'Kebijakan SDM', icon: 'book-marked', classification: 'internal' },
  { value: 'perencanaan-sdm', label: 'Perencanaan SDM', icon: 'network', classification: 'internal' },
  { value: 'rekrutmen', label: 'Rekrutmen', icon: 'user-search', classification: 'internal' },
  { value: 'pengangkatan', label: 'Pengangkatan', icon: 'user-check', classification: 'internal' },
  { value: 'data-personal-pegawai', label: 'Data Personal Pegawai', icon: 'id-card', classification: 'terbatas' },
  { value: 'kehadiran-perizinan', label: 'Kehadiran dan Perizinan', icon: 'calendar-check', classification: 'internal' },
  { value: 'kinerja', label: 'Kinerja', icon: 'gauge', classification: 'internal' },
  { value: 'pengembangan-sdm', label: 'Pengembangan SDM', icon: 'graduation-cap', classification: 'internal' },
  { value: 'penggajian', label: 'Penggajian', icon: 'wallet', classification: 'terbatas' },
  { value: 'disiplin', label: 'Disiplin', icon: 'gavel', classification: 'terbatas' },
  { value: 'mutasi-promosi', label: 'Mutasi dan Promosi', icon: 'arrow-right-left', classification: 'internal' },
  { value: 'kesehatan-perlindungan', label: 'Kesehatan dan Perlindungan', icon: 'heart-pulse', classification: 'internal' },
  { value: 'pemberhentian', label: 'Pemberhentian', icon: 'user-x', classification: 'terbatas' },
  { value: 'laporan-hrd', label: 'Laporan HRD', icon: 'file-bar-chart', classification: 'terbatas' },
  { value: 'tata-naskah', label: 'Tata Naskah Dinas', icon: 'file-text', classification: 'internal' },
];

export function docCategoryOf(value) {
  return DOC_CATEGORIES.find((c) => c.value === value) || { value, label: value, icon: 'folder' };
}

/* ---------- Kategori Legal & Governance (Modul 3) ---------- */
export const LEGAL_GROUPS = [
  { value: 'akta-legalitas', label: 'Akta & Legalitas Badan Hukum', items: ['Akta Pendirian', 'Akta Perubahan', 'SK Pengesahan Badan Hukum', 'AD/ART'] },
  { value: 'sk-keorganisasian', label: 'SK Keorganisasian', items: ['SK Pembina', 'SK Pengurus', 'SK Pengawas', 'SK Direktur', 'Struktur Organisasi Yayasan'] },
  { value: 'tata-kelola', label: 'Pedoman Tata Kelola & Kebijakan Organisasi', items: ['Pedoman Tata Kelola', 'Kebijakan Organisasi', 'Matriks Kewenangan', 'Delegasi Kewenangan', 'Tata Hubungan Yayasan & Unit Pendidikan'] },
];

/* ---------- Kategori Kebijakan (Modul 4) ---------- */
export const POLICY_CATEGORIES = [
  { value: 'manajemen-sdm', label: 'Manajemen SDM' },
  { value: 'hubungan-kerja', label: 'Hubungan Kerja' },
  { value: 'rekrutmen', label: 'Rekrutmen & Pengangkatan' },
  { value: 'status-pegawai', label: 'Status & Administrasi Pegawai' },
  { value: 'karier', label: 'Mutasi, Promosi & Pengembangan' },
  { value: 'penggajian', label: 'Penggajian & Kesejahteraan' },
  { value: 'disiplin', label: 'Disiplin & Etika' },
  { value: 'kinerja', label: 'Kinerja' },
  { value: 'phk', label: 'Pengakhiran Hubungan Kerja' },
];

export const POLICY_STATUS = [
  { value: 'draft', label: 'Draft', badge: 'b-navy' },
  { value: 'diajukan', label: 'Diajukan', badge: 'b-info' },
  { value: 'review', label: 'Review', badge: 'b-violet' },
  { value: 'revisi', label: 'Revisi', badge: 'b-warning' },
  { value: 'disetujui', label: 'Disetujui', badge: 'b-success' },
  { value: 'dipublikasikan', label: 'Dipublikasikan', badge: 'b-gold' },
  { value: 'diarsipkan', label: 'Diarsipkan', badge: 'b-navy' },
];

/* ---------- Kategori SOP (Modul 5) ---------- */
export const SOP_CATEGORIES = [
  { value: 'perencanaan-kebutuhan', label: 'Perencanaan Kebutuhan Pegawai' },
  { value: 'rekrutmen-seleksi', label: 'Rekrutmen dan Seleksi' },
  { value: 'pengangkatan-pegawai', label: 'Pengangkatan Pegawai' },
  { value: 'administrasi-kepegawaian', label: 'Administrasi Kepegawaian' },
  { value: 'presensi', label: 'Presensi' },
  { value: 'perizinan-cuti', label: 'Perizinan dan Cuti' },
  { value: 'penggajian', label: 'Penggajian' },
  { value: 'bpjs', label: 'BPJS' },
  { value: 'pph21', label: 'PPh 21' },
  { value: 'mutasi-promosi', label: 'Mutasi dan Promosi' },
  { value: 'penilaian-kinerja', label: 'Penilaian Kinerja' },
  { value: 'pengembangan-sdm', label: 'Pengembangan SDM' },
  { value: 'disiplin-pembinaan', label: 'Disiplin dan Pembinaan' },
  { value: 'k3', label: 'Kesehatan dan Keselamatan Kerja' },
  { value: 'pengunduran-diri', label: 'Pengunduran Diri' },
  { value: 'pemberhentian', label: 'Pemberhentian' },
  { value: 'pengarsipan', label: 'Pengarsipan Dokumen' },
];

/* ---------- Template & Form Center (Modul 7) ---------- */
export const TEMPLATE_GROUPS = [
  {
    value: 'surat', label: 'Surat & Keputusan', icon: 'stamp',
    desc: 'SK pengangkatan hingga berita acara kegiatan kepegawaian.',
    items: ['SK Pengangkatan', 'SK Mutasi', 'SK Promosi', 'SK Penugasan', 'SK Pelaksana Tugas (Pjs)', 'SK Pemberhentian', 'Surat Teguran', 'Surat Peringatan', 'Surat Keterangan Kerja', 'Surat Tugas', 'Surat Izin', 'Surat Undangan', 'Berita Acara'],
  },
  {
    value: 'formulir', label: 'Formulir', icon: 'clipboard-list',
    desc: 'Formulir siap pakai untuk proses administrasi kepegawaian.',
    items: ['Formulir Lamaran', 'Formulir Wawancara', 'Formulir Permintaan Pegawai', 'Formulir Cuti', 'Formulir Izin', 'Formulir Pengajuan Studi Lanjut', 'Formulir Penilaian Kinerja', 'Formulir Evaluasi Pegawai', 'Formulir Pembinaan', 'Formulir Exit Interview'],
  },
  {
    value: 'instrumen', label: 'Instrumen HR', icon: 'sliders-horizontal',
    desc: 'Instrumen analisis, pengukuran, dan pengembangan SDM.',
    items: ['Analisis Jabatan', 'Analisis Beban Kerja', 'Job Description', 'Job Specification', 'KPI (Key Performance Indicator)', 'IKI (Individu Key Indicator)', 'Individual Development Plan', 'Training Need Analysis', 'Talent Mapping'],
  },
];

/* ---------- Kategori Link Referensi (Modul 8) ---------- */
export const LINK_CATEGORIES = [
  { value: 'regulasi-nasional', label: 'Regulasi Nasional (JDIH)' },
  { value: 'yayasan-legalitas', label: 'Yayasan & Legalitas' },
  { value: 'ketenagakerjaan', label: 'Ketenagakerjaan' },
  { value: 'pendidikan', label: 'Pendidikan' },
  { value: 'jaminan-sosial', label: 'Jaminan Sosial' },
  { value: 'perpajakan', label: 'Perpajakan' },
  { value: 'statistik-penelitian', label: 'Statistik & Penelitian' },
];

export const LINK_TYPES = [
  { value: 'resmi', label: 'Sumber Resmi Pemerintah' },
  { value: 'ilmiah', label: 'Referensi Ilmiah' },
  { value: 'umum', label: 'Informasi Umum' },
];

/* ---------- Kategori Knowledge Base (Modul 9) ---------- */
export const KNOWLEDGE_CATEGORIES = [
  { value: 'manajemen-sdm', label: 'Manajemen SDM' },
  { value: 'human-capital', label: 'Human Capital Management' },
  { value: 'strategic-hr', label: 'Strategic HR Management' },
  { value: 'org-development', label: 'Organizational Development' },
  { value: 'industrial-relations', label: 'Industrial Relations' },
  { value: 'performance-mgmt', label: 'Performance Management' },
  { value: 'talent-mgmt', label: 'Talent Management' },
  { value: 'ld', label: 'Learning and Development' },
  { value: 'comp-benefits', label: 'Compensation and Benefits' },
  { value: 'hr-analytics', label: 'HR Analytics' },
  { value: 'school-hr', label: 'School HR Management' },
  { value: 'guru-tenaga-kependidikan', label: 'Manajemen Guru & Tenaga Kependidikan' },
  { value: 'boarding-school', label: 'Manajemen SDM Boarding School' },
];

/* ---------- Workflow (Modul 11) ---------- */
export const WORKFLOW_STAGES = ['draft', 'diajukan', 'review', 'revisi', 'disetujui', 'dipublikasikan', 'diarsipkan'];

export const WORKFLOW_STAGE_LABEL = {
  draft: 'Draft', diajukan: 'Diajukan', review: 'Review', revisi: 'Revisi',
  disetujui: 'Disetujui', dipublikasikan: 'Dipublikasikan', diarsipkan: 'Diarsipkan',
};

/* ---------- Upload ---------- */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'webp', 'zip'];

export const STORAGE_BUCKETS = { documents: 'documents', regulations: 'regulations', templates: 'templates', avatars: 'avatars' };

/* ---------- Sugesti pencarian ---------- */
export const SEARCH_SUGGESTIONS = [
  'PKWT dan PKWTT', 'cuti melahirkan', 'PPh 21 guru', 'SOP rekrutmen',
  'formulir exit interview', 'BPJS Ketenagakerjaan', 'UU Guru dan Dosen', 'job description',
];

export const STATUS_BADGE = {
  draft: 'b-navy', diajukan: 'b-info', review: 'b-violet', revisi: 'b-warning',
  disetujui: 'b-success', dipublikasikan: 'b-gold', diarsipkan: 'b-navy',
  berlaku: 'b-success', perlu_verifikasi: 'b-warning', diubah: 'b-info', dicabut: 'b-danger',
  aktif: 'b-success', nonaktif: 'b-danger', publik: 'b-success', internal: 'b-info',
  terbatas: 'b-warning', rahasia: 'b-danger', menunggu: 'b-warning', disetujui_w: 'b-success',
  ditolak: 'b-danger', masih_berlaku: 'b-success', ada_perubahan: 'b-info', perlu_tinjauan: 'b-warning',
};
