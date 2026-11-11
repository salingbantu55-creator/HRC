/* ============================================================
   templates.js — Modul 7: Template and Form Center
   Surat & keputusan, formulir, dan instrumen HR siap pakai.
   ============================================================ */

import { TEMPLATE_GROUPS } from './config.js';
import { db, can, profile } from './supabase.js';
import {
  esc, toast, formModal, confirmDialog, badge, refreshIcons, emptyState,
  fmtNum, rowIcon, validateFile, downloadUrl, fmtDate,
} from './ui.js';

export async function render(content, params = {}) {
  const rows = await db.list('templates', { order: { col: 'download_count', ascending: false } });
  const group = params.group || TEMPLATE_GROUPS[0].value;
  const g = TEMPLATE_GROUPS.find((x) => x.value === group);
  const items = rows.filter((r) => r.group === group);

  content.innerHTML = `
  <div class="page-head">
    <div>
      <h2>Template &amp; Form Center</h2>
      <div class="ph-desc">${esc(g.desc)} Setiap template dilengkapi nomor kode dan informasi versi.</div>
    </div>
    <div class="ph-actions">
      ${can('templates.manage') ? `<button class="btn btn-gold" id="add-tpl"><i data-lucide="plus"></i> Tambah Template</button>` : ''}
    </div>
  </div>
  <div class="tabs" id="tpl-tabs">
    ${TEMPLATE_GROUPS.map((t) => `<button class="tab ${group === t.value ? 'active' : ''}" data-g="${t.value}"><i data-lucide="${t.icon}" style="width:14px;height:14px;vertical-align:-2px"></i> ${esc(t.label)}</button>`).join('')}
  </div>
  <div class="notice info mb-2"><i data-lucide="info"></i>
    <span>${esc(g.label)}: ${esc(g.items.length)} jenis yang disarankan — ${esc(g.items.slice(0, 6).join(', '))}${g.items.length > 6 ? ', …' : ''}.</span>
  </div>
  <div class="tile-grid" id="tpl-grid"></div>`;
  refreshIcons(content);

  const grid = content.querySelector('#tpl-grid');
  if (!items.length) {
    grid.innerHTML = `<div class="card card-pad" style="grid-column:1/-1">${emptyState('layout-template', 'Belum ada template pada kelompok ini', 'Tambahkan template agar dapat diunduh seluruh pengguna berwenang.')}</div>`;
  } else {
    grid.innerHTML = items.map((t) => `
      <div class="tile" data-id="${esc(t.id)}">
        <div class="flex justify-between">
          <div class="t-ic"><i data-lucide="${group === 'surat' ? 'stamp' : group === 'formulir' ? 'clipboard-list' : 'sliders-horizontal'}"></i></div>
          <div class="row-actions">
            ${t.file_path ? rowIcon('download', 'download', 'Unduh template', 'gold') : ''}
            ${can('templates.manage') ? `${rowIcon('edit', 'pencil', 'Edit', 'gold')}${rowIcon('del', 'trash-2', 'Hapus', 'danger')}` : ''}
          </div>
        </div>
        <b>${esc(t.name)}</b>
        <small>${esc(t.description || '')}</small>
        <div class="t-foot">
          <span class="chip-tag">${esc(t.code)} · v${esc(t.version || '1.0')}</span>
          <span class="chip-tag"><i data-lucide="download" style="width:11px;height:11px;vertical-align:-1px"></i> ${fmtNum(t.download_count || 0)}</span>
        </div>
      </div>`).join('');
  }
  refreshIcons(grid);

  grid.querySelectorAll('.tile').forEach((tile) => {
    const t = items.find((x) => x.id === tile.dataset.id);
    tile.querySelector('[data-action="download"]').addEventListener('click', () => downloadTpl(t));
    const ed = tile.querySelector('[data-action="edit"]');
    if (ed) ed.addEventListener('click', () => showForm(t, () => render(content, params)));
    const del = tile.querySelector('[data-action="del"]');
    if (del) del.addEventListener('click', async () => {
      if (!(await confirmDialog(`Hapus template "${t.name}"?`, { danger: true }))) return;
      try {
        if (t.file_path) await db.removeFile(t.file_path);
        await db.remove('templates', t.id);
        await db.logAudit('delete', 'template', t.id, { title: t.name });
        toast('Template dihapus.', 'success');
        render(content, params);
      } catch (e) { toast(e.message, 'error'); }
    });
  });

  content.querySelectorAll('#tpl-tabs .tab').forEach((b) => b.addEventListener('click', () => render(content, { group: b.dataset.g })));
  const addBtn = content.querySelector('#add-tpl');
  if (addBtn) addBtn.addEventListener('click', () => showForm(null, () => render(content, params)));
  if (params.action === 'add' && can('templates.manage')) showForm(null, () => render(content, params));
}

async function downloadTpl(t) {
  const url = await db.fileUrl(t.file_path);
  if (!url) { toast('Berkas template belum terunggah. Admin dapat menambahkannya melalui tombol Edit.', 'warning'); return; }
  await db.update('templates', t.id, { download_count: (t.download_count || 0) + 1 });
  await db.logAccess('template', t.id, 'download');
  downloadUrl(url, t.file_name || `${t.code}-${t.name}`);
  toast(`Template "${t.name}" diunduh.`, 'success');
}

function showForm(t, onChange) {
  formModal({
    title: t ? 'Edit Template' : 'Tambah Template', icon: 'layout-template',
    fields: [
      { key: 'name', label: 'Nama Template', required: true, value: t?.name, placeholder: 'SK Pengangkatan Pegawai' },
      { key: 'code', label: 'Kode Template', required: true, value: t?.code, placeholder: 'TPL-SK-001' },
      { key: 'group', label: 'Kelompok', type: 'select', required: true, options: TEMPLATE_GROUPS.map((g) => ({ value: g.value, label: g.label })), value: t?.group },
      { key: 'version', label: 'Versi', value: t?.version || '1.0' },
      { key: 'description', label: 'Deskripsi', type: 'textarea', full: true, rows: 3, value: t?.description },
      { key: 'file', label: t ? 'Ganti Berkas (opsional)' : 'Berkas Template', type: 'file', full: true, accept: '.pdf,.doc,.docx,.xls,.xlsx', help: 'Format siap pakai (DOCX/XLSX) disarankan agar mudah diisi pengguna.' },
    ],
    submitLabel: t ? 'Simpan' : 'Tambah Template',
    onSubmit: async (v) => {
      const file = v.file;
      if (!t && !file) { toast('Unggah berkas template (DOCX/PDF/XLSX).', 'warning'); return false; }
      if (file && !validateFile(file).ok) { toast(validateFile(file).msg, 'error'); return false; }
      const payload = {
        name: v.name, code: v.code, group: v.group, version: v.version || '1.0',
        description: v.description, created_by: profile()?.id,
      };
      let row;
      if (t) {
        row = await db.update('templates', t.id, payload);
        if (file) {
          const path = `templates/${t.id}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
          await db.upload(path, file);
          await db.update('templates', t.id, { file_path: path, file_name: file.name, file_type: file.name.split('.').pop() });
        }
        await db.logAudit('edit', 'template', t.id, { title: v.name });
      } else {
        row = await db.insert('templates', { ...payload, download_count: 0 });
        const path = `templates/${row.id}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
        await db.upload(path, file);
        await db.update('templates', row.id, { file_path: path, file_name: file.name, file_type: file.name.split('.').pop() });
        await db.logAudit('create', 'template', row.id, { title: v.name });
      }
      toast(t ? 'Template diperbarui.' : 'Template ditambahkan.', 'success');
      onChange();
      return true;
    },
  });
}
