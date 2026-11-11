/* ============================================================
   legal.js — Modul 3: Legal and Governance Center
   Legalitas yayasan, SK keorganisasian, dan pedoman tata kelola.
   Dokumen dikelompokkan berdasar tingkat kewenangan & kerahasiaan.
   ============================================================ */

import { LEGAL_GROUPS, CLASSIFICATIONS } from './config.js';
import { db, can, profile } from './supabase.js';
import { esc, toast, modal, formModal, confirmDialog, badge, refreshIcons, fmtDate, fmtSize, rowIcon, validateFile, emptyState, downloadUrl } from './ui.js';

const LEGAL_CATS = ['legalitas-yayasan', 'kebijakan-sdm'];
const DOC_KINDS = [
  { label: 'Akta Pendirian', value: 'Akta Pendirian' }, { label: 'Akta Perubahan', value: 'Akta Perubahan' },
  { label: 'SK Pengesahan Badan Hukum', value: 'SK Pengesahan Badan Hukum' }, { label: 'AD/ART', value: 'AD/ART' },
  { label: 'SK Pembina', value: 'SK Pembina' }, { label: 'SK Pengurus', value: 'SK Pengurus' },
  { label: 'SK Pengawas', value: 'SK Pengawas' }, { label: 'SK Direktur', value: 'SK Direktur' },
  { label: 'Struktur Organisasi Yayasan', value: 'Struktur Organisasi Yayasan' },
  { label: 'Pedoman Tata Kelola', value: 'Pedoman Tata Kelola' }, { label: 'Kebijakan Organisasi', value: 'Kebijakan Organisasi' },
  { label: 'Matriks Kewenangan', value: 'Matriks Kewenangan' }, { label: 'Delegasi Kewenangan', value: 'Delegasi Kewenangan' },
  { label: 'Tata Hubungan Yayasan & Unit Pendidikan', value: 'Tata Hubungan Yayasan & Unit Pendidikan' },
];

/* ---------- Helper pencocokan grup (diekspor untuk pengujian) ---------- */
/* Judul dicocokkan kata-demi-kata (case-insensitive) agar varian judul seperti
   "SK Dewan Pembina dan Pengurus Yayasan…" tetap masuk grup SK Keorganisasian. */
export function matchLegalGroup(title, category, groupCount = LEGAL_GROUPS.length) {
  const t = String(title || '').toLowerCase();
  for (let gi = 0; gi < groupCount; gi++) {
    const items = LEGAL_GROUPS[gi].items || [];
    if (items.some((k) => String(k).toLowerCase().split(/\s+/).every((w) => t.includes(w)))) return gi;
  }
  // Tidak cocok dengan jenis manapun: dokumen kebijakan-sdm → grup terakhir
  // (Tata Kelola), selain itu → grup pertama (Akta & Legalitas).
  return category === 'kebijakan-sdm' ? groupCount - 1 : 0;
}

/* ---------- Dedup tampilan ---------- */
/* Baris hasil simpan ganda lama (judul + nomor + tanggal berlaku sama) hanya
   ditampilkan sekali. Yang dipertahankan diprioritaskan: yang sudah punya
   berkas, lalu yang terbaru. Data asli tetap ada di database — bersihkan
   permanen via supabase/cleanup_duplicates.sql. */
export function dedupeDocs(rows) {
  const best = new Map();
  for (const d of rows) {
    const sig = [d.category, d.title, d.doc_number || '', d.valid_from || ''].join('|');
    const cur = best.get(sig);
    if (!cur) { best.set(sig, d); continue; }
    const dHas = !!(d.file_path || d.file_name), cHas = !!(cur.file_path || cur.file_name);
    const dT = String(d.created_at || ''), cT = String(cur.created_at || '');
    if ((dHas && !cHas) || (dHas === cHas && dT > cT)) best.set(sig, d);
  }
  return [...best.values()];
}

export async function render(content, params = {}) {
  const legalRows = await db.list('documents', { filters: { category: 'legalitas-yayasan' } }).catch(() => []);
  const govRows = await db.list('documents', { filters: { category: 'kebijakan-sdm' } }).catch(() => []);
  const docs = dedupeDocs([
    ...legalRows.filter((d) => d.category === 'legalitas-yayasan'),
    ...govRows.filter((d) => d.category === 'kebijakan-sdm'),
  ]);
  // Setiap dokumen hanya masuk SATU grup sesuai jenisnya (LEGAL_GROUPS.items)
  // — sebelumnya seluruh dokumen legalitas ditampilkan di grup 0 DAN grup 1
  // sehingga semuanya tampak ganda.
  const byGroup = LEGAL_GROUPS.map(() => []);
  docs.forEach((d) => byGroup[matchLegalGroup(d.title, d.category)].push(d));
  byGroup.forEach((arr) => arr.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))));

  content.innerHTML = `
  <div class="page-head">
    <div>
      <h2>Legal &amp; Governance Center</h2>
      <div class="ph-desc">Dokumen legalitas badan hukum, SK keorganisasian, dan tata kelola yayasan. Diakses sesuai tingkat kerahasiaan dan kewenangan.</div>
    </div>
    <div class="ph-actions">
      ${can('documents.create') ? `<button class="btn btn-gold" id="add-legal"><i data-lucide="plus"></i> Tambah Dokumen Legal</button>` : ''}
    </div>
  </div>
  <div class="notice info"><i data-lucide="lock"></i>
    <span>Dokumen berklasifikasi <b>Rahasia</b> hanya dapat diakses Pembina, Manajer HRD, dan Super Administrator — diatur pula pada Row Level Security database.</span>
  </div>
  <div id="legal-groups"></div>`;
  refreshIcons(content);

  const wrap = content.querySelector('#legal-groups');
  const groupsHtml = LEGAL_GROUPS.map((g, gi) => {
    const items = byGroup[gi];
    return `<div class="card mt-2">
      <div class="card-head"><h3><i data-lucide="${gi === 0 ? 'landmark' : gi === 1 ? 'file-badge' : 'building-2'}"></i> ${esc(g.label)}</h3>
        <span class="chip-tag">${items.length} dokumen</span></div>
      <div class="mini-list">${items.length ? items.map((d) => `
        <div class="mini-item" data-id="${esc(d.id)}" role="button" tabindex="0">
          <span class="mi-ic"><i data-lucide="file-text"></i></span>
          <span class="grow"><b>${esc(d.title)}</b><small>${esc(d.doc_number)} · ${esc(fmtDate(d.valid_from))}${d.file_name ? ' · ' + esc(d.file_name) : ''}</small></span>
          <span class="mi-right">${badge(d.classification)}${can('documents.edit') ? rowIcon('edit', 'pencil', 'Edit', 'gold') : ''}</span>
        </div>`).join('') : emptyState('file-text', 'Belum ada dokumen pada grup ini', 'Tambahkan dokumen legal sesuai jenisnya.')}</div>
    </div>`;
  }).join('');
  wrap.innerHTML = groupsHtml;
  refreshIcons(wrap);

  wrap.querySelectorAll('.mini-item').forEach((el) => {
    const d = docs.find((x) => x.id === el.dataset.id);
    el.addEventListener('click', () => showLegalDetail(d, () => render(content, params)));
    el.querySelectorAll('[data-action="edit"]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      showLegalForm(d, () => render(content, params));
    }));
  });

  const addBtn = content.querySelector('#add-legal');
  if (addBtn) addBtn.addEventListener('click', () => showLegalForm(null, () => render(content, params)));
  if (params.action === 'add' && can('documents.create')) showLegalForm(null, () => render(content, params));
}

function showLegalDetail(d, onChange) {
  const cls = CLASSIFICATIONS.find((c) => c.value === d.classification);
  const m = modal({
    title: d.title, icon: 'landmark', size: '',
    body: `
      <div class="flex flex-wrap" style="gap:6px;margin-bottom:14px">${badge(d.classification)} ${badge(d.status)}</div>
      <div class="detail-grid">
        <div class="detail-item"><div class="dt-label">Nomor Dokumen</div><div class="dt-val">${esc(d.doc_number || '-')}</div></div>
        <div class="detail-item"><div class="dt-label">Klasifikasi</div><div class="dt-val">${esc(cls?.label || '-')} — ${esc(cls?.hint || '')}</div></div>
        <div class="detail-item"><div class="dt-label">Berlaku Sejak</div><div class="dt-val">${esc(fmtDate(d.valid_from))}</div></div>
        <div class="detail-item"><div class="dt-label">Berlaku Sampai</div><div class="dt-val">${esc(d.valid_until ? fmtDate(d.valid_until) : 'Tanpa batas')}</div></div>
        <div class="detail-item full"><div class="dt-label">Deskripsi</div><div class="dt-val prose">${esc(d.description || '-')}</div></div>
        <div class="detail-item"><div class="dt-label">Versi</div><div class="dt-val">${esc(d.version || '1.0')}</div></div>
        <div class="detail-item"><div class="dt-label">Unduhan / Dilihat</div><div class="dt-val">${d.download_count || 0} / ${d.view_count || 0}</div></div>
      </div>`,
    footer: `${d.file_path ? `<button class="btn btn-outline" data-act="dl"><i data-lucide="download"></i> Unduh</button>` : '<span class="text-muted" style="font-size:.8rem">Berkas belum terunggah</span>'}
      ${can('documents.edit') ? `<button class="btn btn-gold" data-act="edit"><i data-lucide="pencil"></i> Edit</button>` : ''}`,
    onOpen: (el, close) => {
      refreshIcons(el);
      const dl = el.querySelector('[data-act="dl"]');
      if (dl) dl.addEventListener('click', async () => {
        const url = await db.fileUrl(d.file_path);
        if (!url) { toast('Berkas tidak ditemukan.', 'warning'); return; }
        await db.logAccess('document', d.id, 'download');
        downloadUrl(url, d.file_name || d.title);
      });
      const ed = el.querySelector('[data-act="edit"]');
      if (ed) ed.addEventListener('click', () => { close(); showLegalForm(d, onChange); });
    },
  });
  refreshIcons(m.el);
  db.logAccess('document', d.id, 'view').catch(() => {});
}

function showLegalForm(d, onChange) {
  formModal({
    title: d ? 'Edit Dokumen Legal' : 'Tambah Dokumen Legal', icon: 'landmark', size: '',
    fields: [
      { key: 'title', label: 'Jenis / Judul Dokumen', type: 'select', required: true, full: true, options: DOC_KINDS.map((k) => ({ value: k.label, label: k.label })), value: d?.title },
      { key: 'doc_number', label: 'Nomor Dokumen', required: true, value: d?.doc_number, placeholder: 'SK/AHU/2024/002' },
      { key: 'classification', label: 'Klasifikasi Kerahasiaan', type: 'select', required: true, options: CLASSIFICATIONS, value: d?.classification || 'rahasia' },
      { key: 'valid_from', label: 'Berlaku Sejak', type: 'date', value: d?.valid_from },
      { key: 'valid_until', label: 'Berlaku Sampai (opsional)', type: 'date', value: d?.valid_until },
      { key: 'description', label: 'Deskripsi', type: 'textarea', full: true, rows: 3, value: d?.description },
      { key: 'file', label: 'Unggah Berkas', type: 'file', full: true, accept: '.pdf,.doc,.docx,.jpg,.png', help: 'PDF/DOC/DOCX/Gambar — maks 10 MB.' },
    ],
    submitLabel: d ? 'Simpan' : 'Tambah Dokumen',
    onSubmit: async (v) => {
      const file = v.file;
      if (file && !validateFile(file).ok) { toast(validateFile(file).msg, 'error'); return false; }
      const payload = {
        title: v.title, doc_number: v.doc_number, category: 'legalitas-yayasan',
        classification: v.classification, description: v.description,
        valid_from: v.valid_from || null, valid_until: v.valid_until || null,
        year: v.valid_from ? Number(v.valid_from.slice(0, 4)) : new Date().getFullYear(),
        status: 'dipublikasikan', owner_id: profile()?.id, created_by: profile()?.id,
      };
      let row;
      if (d) {
        row = await db.update('documents', d.id, payload);
        await db.logAudit('edit', 'document', d.id, { title: v.title });
        if (file) {
          const path = `documents/${d.id}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
          await db.upload(path, file);
          await db.update('documents', d.id, { file_path: path, file_name: file.name, file_type: file.name.split('.').pop(), file_size: file.size });
        }
      } else {
        row = await db.insert('documents', payload);
        if (file) {
          const path = `documents/${row.id}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
          await db.upload(path, file);
          await db.update('documents', row.id, { file_path: path, file_name: file.name, file_type: file.name.split('.').pop(), file_size: file.size });
        }
        await db.logAudit('create', 'document', row.id, { title: v.title });
      }
      toast(d ? 'Dokumen legal diperbarui.' : 'Dokumen legal ditambahkan.', 'success');
      onChange();
      return true;
    },
  });
}
