/* ============================================================
   policies.js — Modul 4: HR Policy Center
   Kebijakan kepegawaian dengan nomor, versi, pengesah,
   riwayat revisi, dan integrasi workflow persetujuan.
   ============================================================ */

import { POLICY_CATEGORIES, POLICY_STATUS, WORKFLOW_STAGES, WORKFLOW_STAGE_LABEL } from './config.js';
import { db, can, profile } from './supabase.js';
import {
  esc, toast, modal, formModal, DataTable, badge, refreshIcons, fmtDate,
  rowIcon, validateFile, pipeline, fmtAgo,
} from './ui.js';
import { createWorkflow, actionsFor, runAction } from './workflow.js';

export async function render(content, params = {}) {
  const rows = await db.list('policies', { order: { col: 'created_at', ascending: false } });

  content.innerHTML = `
  <div class="page-head">
    <div>
      <h2>HR Policy Center</h2>
      <div class="ph-desc">Seluruh kebijakan kepegawaian: pedoman SDM, peraturan kepegawaian, hubungan kerja, disiplin, kinerja, hingga kode etik.</div>
    </div>
    <div class="ph-actions">
      ${can('policies.manage') ? `<button class="btn btn-gold" id="add-pol"><i data-lucide="plus"></i> Tambah Kebijakan</button>` : ''}
    </div>
  </div>
  <div id="pol-table"></div>`;
  refreshIcons(content);

  const table = new DataTable(content.querySelector('#pol-table'), {
    columns: [
      { key: 'number', label: 'Nomor & Judul', render: (r) => `<span class="cell-main">${esc(r.number)}</span><span class="cell-sub">${esc(r.title)}</span>` },
      { key: 'category', label: 'Kategori', render: (r) => esc((POLICY_CATEGORIES.find((c) => c.value === r.category) || {}).label || r.category) },
      { key: 'version', label: 'Versi', render: (r) => `v${esc(r.version || '1.0')}` },
      { key: 'effective_date', label: 'Tanggal Berlaku', render: (r) => esc(fmtDate(r.effective_date)) },
      { key: 'approver', label: 'Pengesah' },
      { key: 'status', label: 'Status', render: (r) => badge(r.status) },
      { key: 'actions', label: 'Aksi', render: (r) => `<div class="row-actions">
        ${rowIcon('view', 'eye', 'Lihat kebijakan')}
        ${r.file_path ? rowIcon('download', 'download', 'Unduh') : ''}
        ${can('policies.manage') ? `${rowIcon('edit', 'pencil', 'Edit', 'gold')}${rowIcon('version', 'history', 'Tambah versi', 'gold')}${r.status === 'draft' || r.status === 'revisi' ? rowIcon('submit', 'send', 'Ajukan review', 'gold') : ''}${rowIcon('del', 'trash-2', 'Hapus', 'danger')}` : ''}
      </div>` },
    ],
    searchKeys: ['number', 'title', 'summary'],
    searchPlaceholder: 'Cari kebijakan…',
    filters: [
      { key: 'category', label: 'Semua Kategori', options: POLICY_CATEGORIES },
      { key: 'status', label: 'Semua Status', options: POLICY_STATUS },
    ],
    pageSize: 8,
    emptyIcon: 'book-marked', emptyTitle: 'Belum ada kebijakan',
    rowActionsMap: {
      view: (r) => showDetail(r, () => render(content, params)),
      download: async (r) => {
        const url = await db.fileUrl(r.file_path);
        if (!url) { toast('Berkas belum tersedia.', 'warning'); return; }
        await db.logAccess('policy', r.id, 'download');
        const a = document.createElement('a'); a.href = url; a.download = r.file_name || r.title; a.click();
      },
      edit: (r) => showForm(r, () => render(content, params)),
      version: (r) => addVersion(r, () => render(content, params)),
      submit: async (r) => { await createWorkflow({ parentType: 'policy', parentId: r.id, title: `${r.number} — ${r.title}` }); render(content, params); },
      del: async (r) => {
        const { confirmDialog } = await import('./ui.js');
        if (!(await confirmDialog(`Hapus kebijakan ${r.number}? Riwayat versi juga akan hilang.`, { danger: true }))) return;
        try { await db.remove('policies', r.id); await db.logAudit('delete', 'policy', r.id, { title: r.number }); toast('Kebijakan dihapus.', 'success'); render(content, params); }
        catch (e) { toast(e.message, 'error'); }
      },
    },
    onRowClick: (r) => showDetail(r, () => render(content, params)),
  });
  table.setRows(rows);

  const addBtn = content.querySelector('#add-pol');
  if (addBtn) addBtn.addEventListener('click', () => showForm(null, () => render(content, params)));
  if (params.action === 'add' && can('policies.manage')) showForm(null, () => render(content, params));
  if (params.highlight) {
    const row = (table._rows || []).find((r) => r.id === params.highlight);
    if (row) showDetail(row, () => render(content, params));
  }
}

/* ---------- Detail + versi + pipeline ---------- */
async function showDetail(r, onChange) {
  const versions = await db.list('document_versions', { filters: { parent_type: 'policy', parent_id: r.id }, order: { col: 'created_at', ascending: false } }).catch(() => []);
  const wfs = await db.list('workflow_approvals', { filters: { parent_type: 'policy', parent_id: r.id } }).catch(() => []);
  const wf = wfs[0] || null;

  const m = modal({
    title: `${r.number} — ${r.title.slice(0, 52)}`, icon: 'book-marked', size: 'lg',
    body: `
      <div class="flex flex-wrap" style="gap:6px;margin-bottom:10px">
        ${badge(r.status)} <span class="chip-tag">Versi ${esc(r.version || '1.0')}</span>
        <span class="chip-tag">${esc((POLICY_CATEGORIES.find((c) => c.value === r.category) || {}).label || '-')}</span>
      </div>
      ${wf && !['diarsipkan'].includes(wf.stage) ? `<div class="notice gold"><i data-lucide="workflow"></i><span>Dalam alur persetujuan — tahap <b>${esc(WORKFLOW_STAGE_LABEL[wf.stage])}</b>.</span></div>${pipeline(WORKFLOW_STAGES, wf.stage, WORKFLOW_STAGE_LABEL)}` : ''}
      <div class="detail-grid">
        <div class="detail-item"><div class="dt-label">Nomor Dokumen</div><div class="dt-val">${esc(r.number)}</div></div>
        <div class="detail-item"><div class="dt-label">Pejabat Pengesah</div><div class="dt-val">${esc(r.approver || '-')}</div></div>
        <div class="detail-item"><div class="dt-label">Tanggal Berlaku</div><div class="dt-val">${esc(fmtDate(r.effective_date))}</div></div>
        <div class="detail-item"><div class="dt-label">Berkas</div><div class="dt-val">${r.file_name ? esc(r.file_name) : '<span class="text-muted">Belum ada</span>'}</div></div>
        <div class="detail-item full"><div class="dt-label">Ringkasan</div><div class="dt-val prose">${esc(r.summary || '-')}</div></div>
        <div class="detail-item full"><div class="dt-label">Isi Kebijakan</div><div class="dt-val prose">${esc(r.content || '-')}</div></div>
      </div>
      <h4 class="mt-3" style="font-size:.9rem">Riwayat Revisi (${versions.length})</h4>
      <div class="mini-list mt-1" style="border:1px solid var(--border);border-radius:10px">
        ${versions.length ? versions.map((v) => `
          <div class="mini-item" style="cursor:default">
            <span class="mi-ic"><i data-lucide="history"></i></span>
            <span class="grow"><b>Versi ${esc(v.version)}</b><small>${esc(v.notes || '-')}</small></span>
            <span class="mi-right"><small>${esc(fmtAgo(v.created_at))}</small></span>
          </div>`).join('') : `<div class="empty-state" style="padding:18px"><i data-lucide="history"></i><b>Belum ada riwayat revisi</b><p>Tambahkan versi baru ketika kebijakan direvisi.</p></div>`}
      </div>`,
    footer: `
      ${r.file_path ? `<button class="btn btn-outline" data-act="dl"><i data-lucide="download"></i> Unduh</button>` : ''}
      ${can('policies.manage') && !wf ? `<button class="btn btn-gold" data-act="submit"><i data-lucide="send"></i> Ajukan Review</button>` : ''}
      ${wf && wf.stage !== 'diarsipkan' ? actionsFor(wf).map((a) => `<button class="btn ${a.gold ? 'btn-gold' : a.danger ? 'btn-danger' : 'btn-outline'}" data-wf="${a.id}"><i data-lucide="${a.icon}"></i> ${esc(a.label)}</button>`).join('') : ''}`,
    onOpen: (el, close) => {
      refreshIcons(el);
      const dl = el.querySelector('[data-act="dl"]');
      if (dl) dl.addEventListener('click', async () => {
        const url = await db.fileUrl(r.file_path);
        if (!url) { toast('Berkas tidak ditemukan.', 'warning'); return; }
        await db.logAccess('policy', r.id, 'download');
        const a = document.createElement('a'); a.href = url; a.download = r.file_name || r.title; a.click();
      });
      const sb = el.querySelector('[data-act="submit"]');
      if (sb) sb.addEventListener('click', async () => { close(); await createWorkflow({ parentType: 'policy', parentId: r.id, title: `${r.number} — ${r.title}` }); onChange(); });
      el.querySelectorAll('[data-wf]').forEach((b) => b.addEventListener('click', async () => { close(); await runAction(wf, b.dataset.wf, onChange); }));
    },
  });
  refreshIcons(m.el);
  db.logAccess('policy', r.id, 'view').catch(() => {});
}

/* ---------- Form tambah/edit ---------- */
async function showForm(r, onChange) {
  await formModal({
    title: r ? 'Edit Kebijakan' : 'Tambah Kebijakan', icon: 'book-marked', size: 'lg',
    fields: [
      { key: 'number', label: 'Nomor Dokumen', required: true, value: r?.number, placeholder: 'HR-POL-001' },
      { key: 'title', label: 'Judul Kebijakan', required: true, value: r?.title, placeholder: 'Pedoman Manajemen SDM Yayasan' },
      { key: 'category', label: 'Kategori', type: 'select', required: true, options: POLICY_CATEGORIES, value: r?.category },
      { key: 'version', label: 'Versi', value: r?.version || '1.0', placeholder: '1.0' },
      { key: 'effective_date', label: 'Tanggal Berlaku', type: 'date', value: r?.effective_date },
      { key: 'approver', label: 'Pejabat Pengesah', value: r?.approver, placeholder: 'Ketua Dewan Pembina' },
      { key: 'status', label: 'Status', type: 'select', options: POLICY_STATUS, value: r?.status || 'draft' },
      { key: 'summary', label: 'Ringkasan', type: 'textarea', required: true, full: true, rows: 2, value: r?.summary },
      { key: 'content', label: 'Isi Kebijakan', type: 'textarea', full: true, rows: 5, value: r?.content },
      { key: 'file', label: 'Unggah Berkas', type: 'file', full: true, accept: '.pdf,.doc,.docx' },
    ],
    submitLabel: r ? 'Simpan Perubahan' : 'Tambah Kebijakan',
    onSubmit: async (v) => {
      const file = v.file;
      if (file && !validateFile(file).ok) { toast(validateFile(file).msg, 'error'); return false; }
      const payload = {
        number: v.number, title: v.title, category: v.category, version: v.version || '1.0',
        effective_date: v.effective_date || null, approver: v.approver, status: v.status,
        summary: v.summary, content: v.content, created_by: profile()?.id,
      };
      let row;
      if (r) {
        row = await db.update('policies', r.id, payload);
        await db.logAudit('edit', 'policy', r.id, { title: v.number });
        if (file) {
          const path = `documents/${r.id}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
          await db.upload(path, file);
          await db.update('policies', r.id, { file_path: path, file_name: file.name });
        }
      } else {
        row = await db.insert('policies', payload);
        if (file) {
          const path = `documents/${row.id}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
          await db.upload(path, file);
          await db.update('policies', row.id, { file_path: path, file_name: file.name });
        }
        await db.logAudit('create', 'policy', row.id, { title: v.number });
      }
      toast(r ? 'Kebijakan diperbarui.' : 'Kebijakan ditambahkan.', 'success');
      onChange();
      return true;
    },
  });
}

/* ---------- Tambah versi baru ---------- */
async function addVersion(r, onChange) {
  await formModal({
    title: `Tambah Versi — ${r.number}`, icon: 'history',
    introHtml: `<div class="notice info"><i data-lucide="info"></i><span>Versi baru dicatat pada riwayat revisi dan menggantikan versi aktif kebijakan.</span></div>`,
    fields: [
      { key: 'version', label: 'Nomor Versi Baru', required: true, value: bumpVersion(r.version), full: true },
      { key: 'notes', label: 'Catatan Revisi', type: 'textarea', required: true, full: true, rows: 3 },
      { key: 'file', label: 'Berkas Versi Baru (opsional)', type: 'file', full: true, accept: '.pdf,.doc,.docx' },
    ],
    submitLabel: 'Simpan Versi',
    onSubmit: async (v) => {
      const file = v.file;
      if (file && !validateFile(file).ok) { toast(validateFile(file).msg, 'error'); return false; }
      let filePath = r.file_path, fileName = r.file_name;
      if (file) {
        const path = `documents/${r.id}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
        await db.upload(path, file);
        filePath = path; fileName = file.name;
      }
      await db.insert('document_versions', {
        parent_type: 'policy', parent_id: r.id, version: r.version || '1.0',
        notes: v.notes, file_name: fileName, created_by: profile()?.id,
      });
      await db.update('policies', r.id, { version: v.version, file_path: filePath, file_name: fileName });
      await db.logAudit('edit', 'policy', r.id, { title: `${r.number} versi ${v.version}` });
      toast(`Kebijakan kini versi ${v.version}.`, 'success');
      onChange();
      return true;
    },
  });
}

function bumpVersion(v) {
  const parts = String(v || '1.0').split('.');
  const minor = Number(parts[1] || 0) + 1;
  return `${parts[0] || 1}.${minor}`;
}
