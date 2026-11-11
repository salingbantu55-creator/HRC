/* ============================================================
   sop.js — Modul 5: SOP Center
   SOP per proses kerja HRD: tujuan, ruang lingkup, dasar hukum,
   uraian prosedur, flowchart, SLA, output, dan formulir terkait.
   ============================================================ */

import { SOP_CATEGORIES, WORKFLOW_STAGES, WORKFLOW_STAGE_LABEL } from './config.js';
import { db, can, profile } from './supabase.js';
import {
  esc, toast, modal, formModal, confirmDialog, DataTable, badge, refreshIcons,
  fmtDate, rowIcon, validateFile, pipeline, emptyState,
} from './ui.js';
import { createWorkflow, actionsFor, runAction } from './workflow.js';

export async function render(content, params = {}) {
  const rows = await db.list('sop_documents', { order: { col: 'number', ascending: true } });

  content.innerHTML = `
  <div class="page-head">
    <div>
      <h2>SOP Center</h2>
      <div class="ph-desc">Prosedur baku proses kerja HRD yayasan: dari perencanaan kebutuhan pegawai hingga pengarsipan dokumen.</div>
    </div>
    <div class="ph-actions">
      ${can('sop.manage') ? `<button class="btn btn-gold" id="add-sop"><i data-lucide="plus"></i> Tambah SOP</button>` : ''}
    </div>
  </div>
  <div class="chips mb-2" id="sop-chips">
    <button class="chip ${!activeCat(params) ? 'active' : ''}" data-cat="">Semua (${rows.length})</button>
    ${SOP_CATEGORIES.map((c) => {
      const n = rows.filter((r) => r.category === c.value).length;
      return `<button class="chip ${activeCat(params) === c.value ? 'active' : ''}" data-cat="${c.value}" ${n ? '' : 'style="opacity:.55"'}>${esc(c.label)} (${n})</button>`;
    }).join('')}
  </div>
  <div id="sop-table"></div>`;
  refreshIcons(content);

  const filtered = activeCat(params) ? rows.filter((r) => r.category === activeCat(params)) : rows;

  const table = new DataTable(content.querySelector('#sop-table'), {
    columns: [
      { key: 'number', label: 'Nomor & SOP', render: (r) => `<span class="cell-main">${esc(r.number)}</span><span class="cell-sub">${esc(r.name)}</span>` },
      { key: 'category', label: 'Kategori', render: (r) => esc((SOP_CATEGORIES.find((c) => c.value === r.category) || {}).label || r.category) },
      { key: 'responsible', label: 'Penanggung Jawab' },
      { key: 'sla', label: 'SLA', render: (r) => `<span style="font-size:.78rem">${esc(String(r.sla).slice(0, 48))}</span>` },
      { key: 'effective_date', label: 'Berlaku', render: (r) => esc(fmtDate(r.effective_date)) },
      { key: 'version', label: 'Versi', render: (r) => `v${esc(r.version || '1.0')}` },
      { key: 'status', label: 'Status', render: (r) => badge(r.status) },
      { key: 'actions', label: 'Aksi', render: (r) => `<div class="row-actions">
        ${rowIcon('view', 'eye', 'Lihat SOP')}
        ${r.file_path ? rowIcon('download', 'download', 'Unduh') : ''}
        ${can('sop.manage') ? `${rowIcon('edit', 'pencil', 'Edit', 'gold')}${r.status === 'draft' || r.status === 'revisi' ? rowIcon('submit', 'send', 'Ajukan review', 'gold') : ''}${rowIcon('del', 'trash-2', 'Hapus', 'danger')}` : ''}
      </div>` },
    ],
    searchKeys: ['number', 'name', 'purpose', 'procedure'],
    searchPlaceholder: 'Cari SOP…',
    filters: [{ key: 'status', label: 'Semua Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'review', label: 'Review' }, { value: 'dipublikasikan', label: 'Dipublikasikan' }, { value: 'revisi', label: 'Revisi' }, { value: 'diarsipkan', label: 'Diarsipkan' }] }],
    pageSize: 8,
    emptyIcon: 'git-branch', emptyTitle: 'Belum ada SOP pada kategori ini',
    rowActionsMap: {
      view: (r) => showDetail(r, () => render(content, params)),
      download: async (r) => {
        const url = await db.fileUrl(r.file_path);
        if (!url) { toast('Berkas belum tersedia.', 'warning'); return; }
        await db.logAccess('sop', r.id, 'download');
        const a = document.createElement('a'); a.href = url; a.download = r.file_name || r.name; a.click();
      },
      edit: (r) => showForm(r, () => render(content, params)),
      submit: async (r) => { await createWorkflow({ parentType: 'sop', parentId: r.id, title: `${r.number} — ${r.name}` }); render(content, params); },
      del: async (r) => {
        if (!(await confirmDialog(`Hapus SOP ${r.number}?`, { danger: true }))) return;
        try { await db.remove('sop_documents', r.id); await db.logAudit('delete', 'sop', r.id, { title: r.number }); toast('SOP dihapus.', 'success'); render(content, params); }
        catch (e) { toast(e.message, 'error'); }
      },
    },
    onRowClick: (r) => showDetail(r, () => render(content, params)),
  });
  table.setRows(filtered);

  content.querySelectorAll('#sop-chips .chip').forEach((c) => c.addEventListener('click', () => {
    const v = c.dataset.cat;
    navigateToCat(v);
  }));

  function navigateToCat(v) {
    render(content, { ...params, cat: v });
  }

  const addBtn = content.querySelector('#add-sop');
  if (addBtn) addBtn.addEventListener('click', () => showForm(null, () => render(content, params)));
  if (params.action === 'add' && can('sop.manage')) showForm(null, () => render(content, params));
  if (params.highlight) {
    const row = rows.find((r) => r.id === params.highlight);
    if (row) showDetail(row, () => render(content, { ...params, highlight: null }));
  }
}

function activeCat(params) { return params?.cat || ''; }

/* ---------- Detail SOP lengkap + flowchart ---------- */
async function showDetail(r, onChange) {
  const wfs = await db.list('workflow_approvals', { filters: { parent_type: 'sop', parent_id: r.id } }).catch(() => []);
  const wf = wfs[0] || null;
  const steps = String(r.flowchart_steps || '').split('|').map((s) => s.trim()).filter(Boolean);

  const m = modal({
    title: `${r.number} — ${r.name.slice(0, 48)}`, icon: 'git-branch', size: 'xl',
    body: `
      <div class="flex flex-wrap" style="gap:6px;margin-bottom:10px">
        ${badge(r.status)} <span class="chip-tag">Versi ${esc(r.version || '1.0')}</span>
        <span class="chip-tag">${esc((SOP_CATEGORIES.find((c) => c.value === r.category) || {}).label || '-')}</span>
        <span class="chip-tag">Berlaku ${esc(fmtDate(r.effective_date))}</span>
      </div>
      ${wf && !['diarsipkan'].includes(wf.stage) ? pipeline(WORKFLOW_STAGES, wf.stage, WORKFLOW_STAGE_LABEL) : ''}
      <div class="detail-grid">
        <div class="detail-item"><div class="dt-label">Tujuan</div><div class="dt-val prose">${esc(r.purpose || '-')}</div></div>
        <div class="detail-item"><div class="dt-label">Ruang Lingkup</div><div class="dt-val prose">${esc(r.scope || '-')}</div></div>
        <div class="detail-item"><div class="dt-label">Definisi</div><div class="dt-val prose">${esc(r.definitions || '-')}</div></div>
        <div class="detail-item"><div class="dt-label">Dasar Hukum</div><div class="dt-val prose">${esc(r.legal_basis || '-')}</div></div>
        <div class="detail-item"><div class="dt-label">Pihak Terkait</div><div class="dt-val">${esc(r.parties || '-')}</div></div>
        <div class="detail-item"><div class="dt-label">Dokumen Pendukung</div><div class="dt-val">${esc(r.supporting_docs || '-')}</div></div>
        <div class="detail-item full"><div class="dt-label">Uraian Prosedur</div><div class="dt-val prose">${esc(r.procedure || '-')}</div></div>
        <div class="detail-item full"><div class="dt-label">Flowchart Proses</div>
          <div class="flow mt-1">
            ${steps.length ? steps.map((s, i) => `<div class="flow-step ${i === 0 ? 'start' : i === steps.length - 1 ? 'end' : ''}">${esc(s)}</div>${i < steps.length - 1 ? '<div class="flow-arrow"><i data-lucide="arrow-down"></i></div>' : ''}`).join('') : '<span class="text-muted" style="font-size:.82rem">Belum ada flowchart</span>'}
          </div></div>
        <div class="detail-item"><div class="dt-label">SLA</div><div class="dt-val">${esc(r.sla || '-')}</div></div>
        <div class="detail-item"><div class="dt-label">Output</div><div class="dt-val">${esc(r.output || '-')}</div></div>
        <div class="detail-item"><div class="dt-label">Formulir Terkait</div><div class="dt-val">${esc(r.related_forms || '-')}</div></div>
        <div class="detail-item"><div class="dt-label">Penanggung Jawab</div><div class="dt-val">${esc(r.responsible || '-')}</div></div>
      </div>`,
    footer: `
      ${r.file_path ? `<button class="btn btn-outline" data-act="dl"><i data-lucide="download"></i> Unduh SOP</button>` : ''}
      ${can('sop.manage') && !wf ? `<button class="btn btn-gold" data-act="submit"><i data-lucide="send"></i> Ajukan Review</button>` : ''}
      ${wf && wf.stage !== 'diarsipkan' ? actionsFor(wf).map((a) => `<button class="btn ${a.gold ? 'btn-gold' : a.danger ? 'btn-danger' : 'btn-outline'}" data-wf="${a.id}"><i data-lucide="${a.icon}"></i> ${esc(a.label)}</button>`).join('') : ''}`,
    onOpen: (el, close) => {
      refreshIcons(el);
      const dl = el.querySelector('[data-act="dl"]');
      if (dl) dl.addEventListener('click', async () => {
        const url = await db.fileUrl(r.file_path);
        if (!url) { toast('Berkas tidak ditemukan.', 'warning'); return; }
        await db.logAccess('sop', r.id, 'download');
        const a = document.createElement('a'); a.href = url; a.download = r.file_name || r.name; a.click();
      });
      const sb = el.querySelector('[data-act="submit"]');
      if (sb) sb.addEventListener('click', async () => { close(); await createWorkflow({ parentType: 'sop', parentId: r.id, title: `${r.number} — ${r.name}` }); onChange(); });
      el.querySelectorAll('[data-wf]').forEach((b) => b.addEventListener('click', async () => { close(); await runAction(wf, b.dataset.wf, onChange); }));
    },
  });
  refreshIcons(m.el);
}

/* ---------- Form SOP ---------- */
async function showForm(r, onChange) {
  const flowHelp = 'Pisahkan setiap langkah dengan tanda |. Contoh: Permintaan Pegawai|Analisis Kebutuhan|Seleksi|Kontrak';
  await formModal({
    title: r ? 'Edit SOP' : 'Tambah SOP', icon: 'git-branch', size: 'xl',
    fields: [
      { key: 'number', label: 'Nomor SOP', required: true, value: r?.number, placeholder: 'SOP-HRD-001' },
      { key: 'name', label: 'Nama SOP', required: true, value: r?.name, placeholder: 'SOP Rekrutmen dan Seleksi' },
      { key: 'category', label: 'Kategori Proses', type: 'select', required: true, options: SOP_CATEGORIES, value: r?.category },
      { key: 'version', label: 'Versi', value: r?.version || '1.0' },
      { key: 'purpose', label: 'Tujuan', type: 'textarea', required: true, full: true, rows: 2, value: r?.purpose },
      { key: 'scope', label: 'Ruang Lingkup', type: 'textarea', full: true, rows: 2, value: r?.scope },
      { key: 'definitions', label: 'Definisi', type: 'textarea', full: true, rows: 2, value: r?.definitions },
      { key: 'legal_basis', label: 'Dasar Hukum', type: 'textarea', full: true, rows: 2, value: r?.legal_basis },
      { key: 'parties', label: 'Pihak Terkait', full: true, value: r?.parties },
      { key: 'supporting_docs', label: 'Dokumen Pendukung', full: true, value: r?.supporting_docs },
      { key: 'procedure', label: 'Uraian Prosedur', type: 'textarea', required: true, full: true, rows: 6, value: r?.procedure, placeholder: '1. Langkah pertama…\n2. Langkah kedua…' },
      { key: 'flowchart_steps', label: 'Flowchart (langkah dipisah |)', type: 'textarea', full: true, rows: 2, value: r?.flowchart_steps, help: flowHelp },
      { key: 'sla', label: 'SLA (Layanan Standar)', full: true, value: r?.sla },
      { key: 'output', label: 'Output', full: true, value: r?.output },
      { key: 'related_forms', label: 'Formulir Terkait', full: true, value: r?.related_forms },
      { key: 'responsible', label: 'Penanggung Jawab', value: r?.responsible },
      { key: 'effective_date', label: 'Tanggal Berlaku', type: 'date', value: r?.effective_date },
      { key: 'status', label: 'Status', type: 'select', options: [{ value: 'draft', label: 'Draft' }, { value: 'review', label: 'Review' }, { value: 'dipublikasikan', label: 'Dipublikasikan' }, { value: 'diarsipkan', label: 'Diarsipkan' }], value: r?.status || 'draft' },
      { key: 'file', label: 'Berkas SOP (opsional)', type: 'file', full: true, accept: '.pdf,.doc,.docx,.ppt,.pptx' },
    ],
    submitLabel: r ? 'Simpan Perubahan' : 'Tambah SOP',
    onSubmit: async (v) => {
      const file = v.file;
      if (file && !validateFile(file).ok) { toast(validateFile(file).msg, 'error'); return false; }
      const payload = {
        number: v.number, name: v.name, category: v.category, version: v.version || '1.0',
        purpose: v.purpose, scope: v.scope, definitions: v.definitions, legal_basis: v.legal_basis,
        parties: v.parties, supporting_docs: v.supporting_docs, procedure: v.procedure,
        flowchart_steps: v.flowchart_steps, sla: v.sla, output: v.output, related_forms: v.related_forms,
        responsible: v.responsible, effective_date: v.effective_date || null, status: v.status,
        created_by: profile()?.id,
      };
      let row;
      if (r) {
        row = await db.update('sop_documents', r.id, payload);
        await db.logAudit('edit', 'sop', r.id, { title: v.number });
        if (file) {
          const path = `documents/${r.id}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
          await db.upload(path, file);
          await db.update('sop_documents', r.id, { file_path: path, file_name: file.name });
        }
      } else {
        row = await db.insert('sop_documents', payload);
        if (file) {
          const path = `documents/${row.id}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
          await db.upload(path, file);
          await db.update('sop_documents', row.id, { file_path: path, file_name: file.name });
        }
        await db.logAudit('create', 'sop', row.id, { title: v.number });
      }
      toast(r ? 'SOP diperbarui.' : 'SOP ditambahkan.', 'success');
      onChange();
      return true;
    },
  });
}
