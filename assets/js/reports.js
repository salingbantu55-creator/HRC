/* ============================================================
   reports.js — Modul 13: HR Report Center
   10 jenis laporan dengan ekspor CSV, Excel, dan PDF.
   ============================================================ */

import { DOC_CATEGORIES, REG_CATEGORIES, SOP_CATEGORIES, POLICY_CATEGORIES } from './config.js';
import { db, getMode } from './supabase.js';
import { esc, toast, refreshIcons, fmtNum, fmtDate, emptyState, exportCSV, exportXLS, exportPDF, badge } from './ui.js';
import { registerChart, destroyCharts } from './app.js';

const REPORTS = [
  { id: 'kelengkapan', label: 'Kelengkapan Dokumen', icon: 'folder-check', desc: 'Rekap dokumen per kategori beserta status dan klasifikasi.' },
  { id: 'regulasi', label: 'Laporan Regulasi', icon: 'scale', desc: 'Status berlaku dan verifikasi seluruh regulasi.' },
  { id: 'sop', label: 'Laporan SOP', icon: 'git-branch', desc: 'SOP per kategori proses kerja HRD.' },
  { id: 'kebijakan', label: 'Laporan Kebijakan', icon: 'book-marked', desc: 'Kebijakan, versi, pengesah, dan status.' },
  { id: 'kedaluwarsa', label: 'Dokumen Kedaluwarsa', icon: 'calendar-x', desc: 'Dokumen yang melewati masa berlaku.' },
  { id: 'revisi', label: 'Revisi Dokumen', icon: 'history', desc: 'Riwayat versi dan revisi dokumen/kebijakan.' },
  { id: 'aktivitas', label: 'Aktivitas Pengguna', icon: 'activity', desc: 'Jejak audit seluruh aksi pengguna.' },
  { id: 'unduhan', label: 'Laporan Unduhan', icon: 'download', desc: 'Statistik unduhan per dokumen.' },
  { id: 'penggunaan', label: 'Penggunaan Knowledge Center', icon: 'bar-chart-3', desc: 'Akses per jenis konten (dokumen, SOP, artikel, regulasi).' },
  { id: 'verifikasi', label: 'Status Verifikasi', icon: 'badge-check', desc: 'Regulasi & dokumen menurut status verifikasi.' },
];

export async function render(content, params = {}) {
  const sel = params.report || 'kelengkapan';
  const rep = REPORTS.find((r) => r.id === sel);

  content.innerHTML = `
  <div class="page-head">
    <div>
      <h2>HR Report Center</h2>
      <div class="ph-desc">Laporan tata kelola pengetahuan SDM. Hasil dapat diekspor ke Excel, CSV, dan PDF.</div>
    </div>
  </div>
  <div class="tile-grid mb-2" id="rep-cards">
    ${REPORTS.map((r) => `<button class="tile ${sel === r.id ? 'active' : ''}" style="${sel === r.id ? 'border-color:var(--gold-500)' : ''}" data-report="${r.id}">
      <div class="flex"><div class="t-ic"><i data-lucide="${r.icon}"></i></div><b>${esc(r.label)}</b></div>
      <small>${esc(r.desc)}</small>
    </button>`).join('')}
  </div>
  <div class="card" id="rep-body"><div class="card-pad"><div class="skeleton" style="height:200px"></div></div></div>`;
  refreshIcons(content);

  content.querySelectorAll('[data-report]').forEach((b) => b.addEventListener('click', () => render(content, { report: b.dataset.report })));

  const body = content.querySelector('#rep-body');
  const data = await buildReport(sel);
  if (!data.rows.length) {
    body.innerHTML = `<div class="card-pad">${emptyState('bar-chart-3', 'Tidak ada data', 'Laporan akan berisi data setelah konten diisi.')}</div>`;
    return;
  }
  body.innerHTML = `
    <div class="card-head">
      <h3><i data-lucide="${rep.icon}"></i> ${esc(rep.label)}</h3>
      <div class="dt-actions">
        <button class="btn btn-outline btn-sm" id="exp-xls"><i data-lucide="file-spreadsheet"></i> Excel</button>
        <button class="btn btn-outline btn-sm" id="exp-csv"><i data-lucide="file-text"></i> CSV</button>
        <button class="btn btn-outline btn-sm" id="exp-pdf"><i data-lucide="file-down"></i> PDF</button>
      </div>
    </div>
    <div class="card-pad">${data.summaryHtml || ''}</div>
    ${data.chartHtml || ''}
    <div class="table-wrap"><table class="data-table">
      <thead><tr>${data.columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
      <tbody>${data.rows.slice(0, 100).map((r) => `<tr>${data.columns.map((c) => `<td>${c.render ? c.render(r) : esc(r[c.key] ?? '-')}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <div class="dt-foot"><span class="info">Menampilkan ${Math.min(100, data.rows.length)} dari ${data.rows.length} baris</span></div>`;
  refreshIcons(body);

  const fileBase = `HRKC-${rep.label.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}`;
  document.getElementById('exp-xls').addEventListener('click', () => exportXLS(data.columns, data.rows, fileBase, rep.label));
  document.getElementById('exp-csv').addEventListener('click', () => exportCSV(data.columns, data.rows, fileBase));
  document.getElementById('exp-pdf').addEventListener('click', () => exportPDF(data.columns, data.rows, fileBase, { title: rep.label }));
}

/* ---------- Perancang laporan ---------- */
async function buildReport(id) {
  const dt = (v) => fmtDate(v);
  switch (id) {
    case 'kelengkapan': {
      const docs = await db.list('documents');
      const rows = DOC_CATEGORIES.map((c) => {
        const items = docs.filter((d) => d.category === c.value);
        return {
          kategori: c.label,
          total: items.length,
          dengan_berkas: items.filter((d) => d.file_path).length,
          publik: items.filter((d) => d.classification === 'publik').length,
          internal: items.filter((d) => d.classification === 'internal').length,
          terbatas: items.filter((d) => d.classification === 'terbatas').length,
          rahasia: items.filter((d) => d.classification === 'rahasia').length,
        };
      });
      const totalDocs = docs.length;
      return {
        columns: [
          { key: 'kategori', label: 'Kategori' }, { key: 'total', label: 'Total' },
          { key: 'dengan_berkas', label: 'Dgn Berkas' }, { key: 'publik', label: 'Publik' },
          { key: 'internal', label: 'Internal' }, { key: 'terbatas', label: 'Terbatas' }, { key: 'rahasia', label: 'Rahasia' },
        ],
        rows,
        summaryHtml: `<div class="flex flex-wrap" style="gap:8px">
          <span class="chip-tag">Total dokumen: <b>${fmtNum(totalDocs)}</b></span>
          <span class="chip-tag">Kategori: <b>${DOC_CATEGORIES.length}</b></span>
          <span class="chip-tag">Dengan berkas: <b>${docs.filter((d) => d.file_path).length}</b></span>
        </div>`,
      };
    }
    case 'regulasi': {
      const regs = await db.list('regulations');
      return {
        columns: [
          { key: 'number', label: 'Nomor' }, { key: 'title', label: 'Judul', exportValue: (r) => r.title },
          { key: 'category', label: 'Kategori', exportValue: (r) => (REG_CATEGORIES.find((c) => c.value === r.category) || {}).label || r.category, render: (r) => esc((REG_CATEGORIES.find((c) => c.value === r.category) || {}).label || '-') },
          { key: 'status', label: 'Status', render: (r) => badge(r.status) },
          { key: 'verification_status', label: 'Verifikasi', render: (r) => badge(r.verification_status === 'terverifikasi' ? 'disetujui' : 'perlu_verifikasi') },
          { key: 'last_checked_at', label: 'Terakhir Diperiksa', exportValue: (r) => r.last_checked_at || 'Belum', render: (r) => dt(r.last_checked_at) },
        ],
        rows: regs,
        summaryHtml: `<div class="flex flex-wrap" style="gap:8px">
          <span class="chip-tag">Total: <b>${regs.length}</b></span>
          <span class="chip-tag">Berlaku: <b>${regs.filter((r) => r.status === 'berlaku').length}</b></span>
          <span class="chip-tag">Perlu verifikasi: <b>${regs.filter((r) => r.verification_status !== 'terverifikasi').length}</b></span>
        </div>`,
      };
    }
    case 'sop': {
      const sops = await db.list('sop_documents');
      return {
        columns: [
          { key: 'number', label: 'Nomor SOP' }, { key: 'name', label: 'Nama SOP', exportValue: (r) => r.name },
          { key: 'category', label: 'Kategori', exportValue: (r) => (SOP_CATEGORIES.find((c) => c.value === r.category) || {}).label || r.category, render: (r) => esc((SOP_CATEGORIES.find((c) => c.value === r.category) || {}).label || '-') },
          { key: 'responsible', label: 'PJ' }, { key: 'version', label: 'Versi', exportValue: (r) => 'v' + (r.version || '1.0') },
          { key: 'effective_date', label: 'Berlaku', exportValue: (r) => r.effective_date || '-', render: (r) => dt(r.effective_date) },
          { key: 'status', label: 'Status', render: (r) => badge(r.status) },
        ],
        rows: sops,
        summaryHtml: `<span class="chip-tag">Total SOP: <b>${sops.length}</b></span> <span class="chip-tag">Dipublikasikan: <b>${sops.filter((s) => s.status === 'dipublikasikan').length}</b></span>`,
      };
    }
    case 'kebijakan': {
      const pols = await db.list('policies');
      return {
        columns: [
          { key: 'number', label: 'Nomor' }, { key: 'title', label: 'Judul', exportValue: (r) => r.title },
          { key: 'category', label: 'Kategori', exportValue: (r) => (POLICY_CATEGORIES.find((c) => c.value === r.category) || {}).label || r.category, render: (r) => esc((POLICY_CATEGORIES.find((c) => c.value === r.category) || {}).label || '-') },
          { key: 'version', label: 'Versi', exportValue: (r) => 'v' + (r.version || '1.0') },
          { key: 'approver', label: 'Pengesah' },
          { key: 'effective_date', label: 'Berlaku', exportValue: (r) => r.effective_date || '-', render: (r) => dt(r.effective_date) },
          { key: 'status', label: 'Status', render: (r) => badge(r.status) },
        ],
        rows: pols,
        summaryHtml: `<span class="chip-tag">Total kebijakan: <b>${pols.length}</b></span> <span class="chip-tag">Dipublikasikan: <b>${pols.filter((p) => p.status === 'dipublikasikan').length}</b></span>`,
      };
    }
    case 'kedaluwarsa': {
      const docs = await db.list('documents');
      const regs = await db.list('regulations');
      const now = Date.now();
      const rows = [
        ...docs.filter((d) => d.valid_until && new Date(d.valid_until).getTime() < now).map((d) => ({
          jenis: 'Dokumen', judul: d.title, nomor: d.doc_number || '-', akhir: d.valid_until, status: d.status,
        })),
        ...regs.filter((r) => !r.last_checked_at || now - new Date(r.last_checked_at).getTime() > 365 * 24 * 3600 * 1000).map((r) => ({
          jenis: 'Regulasi (pemeriksaan > 1 thn)', judul: `${r.number} — ${r.title}`, nomor: r.number, akhir: r.last_checked_at || '-', status: r.status,
        })),
      ];
      return {
        columns: [
          { key: 'jenis', label: 'Jenis' }, { key: 'judul', label: 'Judul', exportValue: (r) => r.judul },
          { key: 'nomor', label: 'Nomor' }, { key: 'akhir', label: 'Berakhir/Diperiksa', exportValue: (r) => r.akhir, render: (r) => r.akhir === '-' ? '-' : dt(r.akhir) },
          { key: 'status', label: 'Status', render: (r) => badge(r.status) },
        ],
        rows,
        summaryHtml: `<div class="notice warn" style="margin-bottom:0"><i data-lucide="alert-triangle"></i><span><b>${rows.length}</b> item memerlukan perbaruan/pemeriksaan segera.</span></div>`,
      };
    }
    case 'revisi': {
      const versions = await db.list('document_versions', { order: { col: 'created_at', ascending: false } });
      return {
        columns: [
          { key: 'parent_type', label: 'Jenis Induk', exportValue: (r) => ({ policy: 'Kebijakan', document: 'Dokumen', sop: 'SOP' }[r.parent_type] || r.parent_type) },
          { key: 'version', label: 'Versi', exportValue: (r) => 'v' + (r.version || '1.0') },
          { key: 'notes', label: 'Catatan Revisi' },
          { key: 'file_name', label: 'Berkas', exportValue: (r) => r.file_name || '-' },
          { key: 'created_at', label: 'Tanggal', exportValue: (r) => r.created_at?.slice(0, 10), render: (r) => dt(r.created_at) },
        ],
        rows: versions,
        summaryHtml: `<span class="chip-tag">Total revisi tercatat: <b>${versions.length}</b></span>`,
      };
    }
    case 'aktivitas': {
      const logs = await db.list('audit_logs', { order: { col: 'created_at', ascending: false }, limit: 200 });
      return {
        columns: [
          { key: 'created_at', label: 'Waktu', exportValue: (r) => r.created_at?.slice(0, 16).replace('T', ' '), render: (r) => esc((r.created_at || '').slice(0, 16).replace('T', ' ')) },
          { key: 'user_name', label: 'Pengguna' },
          { key: 'action', label: 'Aksi' },
          { key: 'entity_type', label: 'Objek' },
          { key: 'details', label: 'Detail', exportValue: (r) => (r.details?.title || ''), render: (r) => esc(r.details?.title || r.details?.url || '-') },
        ],
        rows: logs,
        summaryHtml: `<span class="chip-tag">Menampilkan 200 aktivitas terakhir</span>`,
      };
    }
    case 'unduhan': {
      const docs = await db.list('documents', { order: { col: 'download_count', ascending: false } });
      const tpls = await db.list('templates', { order: { col: 'download_count', ascending: false } });
      return {
        columns: [
          { key: 'jenis', label: 'Jenis' }, { key: 'judul', label: 'Judul', exportValue: (r) => r.judul },
          { key: 'unduhan', label: 'Unduhan' }, { key: 'dilihat', label: 'Dilihat' },
        ],
        rows: [
          ...docs.map((d) => ({ jenis: 'Dokumen', judul: d.title, unduhan: d.download_count || 0, dilihat: d.view_count || 0 })),
          ...tpls.map((t) => ({ jenis: 'Template', judul: t.name, unduhan: t.download_count || 0, dilihat: '-' })),
        ].sort((a, b) => b.unduhan - a.unduhan),
        summaryHtml: `<span class="chip-tag">Total unduhan dokumen: <b>${fmtNum(docs.reduce((a, d) => a + (d.download_count || 0), 0))}</b></span>`,
      };
    }
    case 'penggunaan': {
      const logs = await db.list('document_access_logs', { limit: 1000 });
      const byType = {};
      logs.forEach((l) => { byType[l.parent_type] = (byType[l.parent_type] || 0) + 1; });
      const rows = Object.entries(byType).map(([t, n]) => ({ konten: ({ document: 'Dokumen', regulation: 'Regulasi', policy: 'Kebijakan', sop: 'SOP', template: 'Template', knowledge: 'Artikel' }[t] || t), jumlah: n }));
      return {
        columns: [{ key: 'konten', label: 'Jenis Konten' }, { key: 'jumlah', label: 'Jumlah Akses' }],
        rows,
        summaryHtml: `<span class="chip-tag">Total akses tercatat: <b>${fmtNum(logs.length)}</b></span> <span class="text-muted" style="font-size:.78rem">(pencatatan dimulai sejak aplikasi digunakan)</span>`,
      };
    }
    case 'verifikasi': {
      const regs = await db.list('regulations');
      const docs = await db.list('documents');
      const rows = [
        ...regs.map((r) => ({ jenis: 'Regulasi', judul: r.number, status_v: r.verification_status || 'perlu_verifikasi', status: r.status })),
        ...docs.map((d) => ({ jenis: 'Dokumen', judul: d.title, status_v: ['dipublikasikan', 'disetujui'].includes(d.status) ? 'terverifikasi' : 'perlu_verifikasi', status: d.status })),
      ];
      return {
        columns: [
          { key: 'jenis', label: 'Jenis' }, { key: 'judul', label: 'Judul', exportValue: (r) => r.judul },
          { key: 'status_v', label: 'Verifikasi', render: (r) => badge(r.status_v === 'terverifikasi' ? 'disetujui' : 'perlu_verifikasi'), exportValue: (r) => r.status_v },
          { key: 'status', label: 'Status', render: (r) => badge(r.status) },
        ],
        rows,
        summaryHtml: `<div class="flex flex-wrap" style="gap:8px">
          <span class="chip-tag">Terverifikasi: <b>${rows.filter((r) => r.status_v === 'terverifikasi').length}</b></span>
          <span class="chip-tag">Perlu verifikasi: <b>${rows.filter((r) => r.status_v !== 'terverifikasi').length}</b></span>
        </div>`,
      };
    }
    default: return { columns: [], rows: [] };
  }
}
