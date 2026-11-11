/* ============================================================
   documents.js — Modul 6: HR Document Library
   Perpustakaan dokumen: unggah multi-format, pratinjau PDF,
   pencarian & filter, versi, tag, favorit, statistik unduhan.
   ============================================================ */

import { DOC_CATEGORIES, CLASSIFICATIONS, WORKFLOW_STAGES, WORKFLOW_STAGE_LABEL, POLICY_STATUS } from './config.js';
import { db, can, profile } from './supabase.js';
import {
  esc, toast, modal, formModal, confirmDialog, DataTable, badge, refreshIcons,
  fmtDate, fmtSize, fmtAgo, rowIcon, validateFile, pipeline, emptyState, downloadUrl, previewPdfModal, fmtNum,
} from './ui.js';
import { createWorkflow, actionsFor, runAction } from './workflow.js';

export async function render(content, params = {}) {
  const rows = await db.list('documents', { order: { col: 'created_at', ascending: false } });
  const allTags = await db.list('tags').catch(() => []);

  const cat = params.cat || '';
  const rowsFiltered = cat ? rows.filter((r) => r.category === cat) : rows;

  content.innerHTML = `
  <div class="page-head">
    <div>
      <h2>HR Document Library</h2>
      <div class="ph-desc">Perpustakaan dokumen kepegawaian dengan klasifikasi kerahasiaan, versioning, tag, dan statistik akses.</div>
    </div>
    <div class="ph-actions">
      ${can('documents.create') ? `<button class="btn btn-gold" id="add-doc"><i data-lucide="upload"></i> Unggah Dokumen</button>` : ''}
    </div>
  </div>
  ${cat === 'data-personal-pegawai' ? `<div class="notice warn"><i data-lucide="shield-alert"></i><span>Kategori <b>Data Personal Pegawai</b>: akses dibatasi hanya untuk pemilik dokumen dan HRD berwenang (dijaga juga oleh RLS di sisi database, sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi).</span></div>` : ''}
  <div class="chips mb-2" id="doc-chips">
    <button class="chip ${!cat ? 'active' : ''}" data-cat="">Semua (${rows.length})</button>
    ${DOC_CATEGORIES.map((c) => {
      const n = rows.filter((r) => r.category === c.value).length;
      return `<button class="chip ${cat === c.value ? 'active' : ''}" data-cat="${c.value}" ${n ? '' : 'style="opacity:.5"'}><i data-lucide="${c.icon}" style="width:12px;height:12px;vertical-align:-2px"></i> ${esc(c.label)} (${n})</button>`;
    }).join('')}
  </div>
  <div id="doc-table"></div>`;
  refreshIcons(content);

  const table = new DataTable(content.querySelector('#doc-table'), {
    columns: [
      { key: 'title', label: 'Dokumen', render: (r) => `<span class="cell-main">${esc(r.title)}</span><span class="cell-sub">${esc(r.doc_number || '')} ${r.file_name ? '· ' + esc(r.file_name) : ''}</span>` },
      { key: 'category', label: 'Kategori', render: (r) => esc((DOC_CATEGORIES.find((c) => c.value === r.category) || {}).label || r.category) },
      { key: 'year', label: 'Tahun' },
      { key: 'classification', label: 'Klasifikasi', render: (r) => badge(r.classification) },
      { key: 'status', label: 'Status', render: (r) => badge(r.status) },
      { key: 'version', label: 'Versi', render: (r) => `v${esc(r.version || '1.0')}` },
      { key: 'download_count', label: 'Unduhan', render: (r) => fmtNum(r.download_count || 0) },
      { key: 'actions', label: 'Aksi', render: (r) => `<div class="row-actions">
        ${rowIcon('view', 'eye', 'Detail dokumen')}
        ${r.file_path && (r.file_type || '').toLowerCase() === 'pdf' ? rowIcon('preview', 'file-eye', 'Pratinjau PDF') : ''}
        ${r.file_path ? rowIcon('download', 'download', 'Unduh') : ''}
        ${isFav(r.id) ? rowIcon('unfav', 'star', 'Hapus favorit', 'gold') : rowIcon('fav', 'star', 'Tambah favorit')}
        ${can('documents.edit') ? rowIcon('edit', 'pencil', 'Edit', 'gold') : ''}
        ${can('documents.delete') ? rowIcon('del', 'trash-2', 'Hapus', 'danger') : ''}
      </div>` },
    ],
    searchKeys: ['title', 'doc_number', 'description'],
    searchPlaceholder: 'Cari dokumen…',
    filters: [
      { key: 'classification', label: 'Semua Klasifikasi', options: CLASSIFICATIONS },
      { key: 'status', label: 'Semua Status', options: POLICY_STATUS },
      { key: 'year', label: 'Semua Tahun', options: [...new Set(rows.map((r) => r.year).filter(Boolean))].sort((a, b) => b - a).map((y) => ({ value: String(y), label: String(y) })) },
    ],
    pageSize: 8,
    emptyIcon: 'folder-open', emptyTitle: 'Belum ada dokumen pada kategori ini',
    rowActionsMap: {
      view: (r) => showDetail(r, () => render(content, params)),
      preview: async (r) => {
        const url = await db.fileUrl(r.file_path);
        if (!url) { toast('Berkas tidak dapat dibuka.', 'warning'); return; }
        previewPdfModal(url, r.title);
      },
      download: (r) => downloadDoc(r),
      fav: async (r) => { await toggleFav(r); render(content, params); },
      unfav: async (r) => { await toggleFav(r); render(content, params); },
      edit: (r) => showUploadForm(r, () => render(content, params)),
      del: async (r) => {
        if (!(await confirmDialog(`Hapus dokumen "${r.title}"?`, { danger: true }))) return;
        try {
          if (r.file_path) await db.removeFile(r.file_path);
          await db.remove('documents', r.id);
          await db.logAudit('delete', 'document', r.id, { title: r.title });
          toast('Dokumen dihapus.', 'success');
          render(content, params);
        } catch (e) { toast(e.message, 'error'); }
      },
    },
    onRowClick: (r) => showDetail(r, () => render(content, params)),
  });
  table.setRows(rowsFiltered);

  content.querySelectorAll('#doc-chips .chip').forEach((c) => c.addEventListener('click', () => render(content, { ...params, cat: c.dataset.cat })));

  const addBtn = content.querySelector('#add-doc');
  if (addBtn) addBtn.addEventListener('click', () => showUploadForm(null, () => render(content, params)));
  if (params.action === 'add' && can('documents.create')) showUploadForm(null, () => render(content, params));
  if (params.highlight) {
    const row = rows.find((r) => r.id === params.highlight);
    if (row) showDetail(row, () => render(content, { ...params, highlight: null }));
  }
}

/* ---------- Favorit (tersimpan lokal per pengguna) ---------- */
function favKey() { return 'hrk_fav_' + (profile()?.id || 'x'); }
function getFavs() { try { return JSON.parse(localStorage.getItem(favKey()) || '[]'); } catch { return []; } }
function isFav(id) { return getFavs().includes(id); }
async function toggleFav(r) {
  const favs = getFavs();
  const idx = favs.indexOf(r.id);
  if (idx >= 0) { favs.splice(idx, 1); toast('Dihapus dari favorit.', 'info'); }
  else { favs.push(r.id); toast('Ditambahkan ke favorit.', 'success'); }
  localStorage.setItem(favKey(), JSON.stringify(favs));
}

/* ---------- Unduh ---------- */
async function downloadDoc(r) {
  try {
    const url = await db.fileUrl(r.file_path);
    if (!url) { toast('Berkas belum terunggah.', 'warning'); return; }
    await db.update('documents', r.id, { download_count: (r.download_count || 0) + 1 });
    await db.logAccess('document', r.id, 'download');
    downloadUrl(url, r.file_name || r.title);
    toast('Dokumen diunduh.', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

/* ---------- Detail dokumen ---------- */
async function showDetail(r, onChange) {
  const [versions, tags, logs, wfs] = await Promise.all([
    db.list('document_versions', { filters: { parent_type: 'document', parent_id: r.id }, order: { col: 'created_at', ascending: false } }).catch(() => []),
    db.list('document_tags', { filters: { parent_type: 'document', parent_id: r.id } }).catch(() => []),
    db.list('document_access_logs', { filters: { parent_type: 'document', parent_id: r.id }, order: { col: 'created_at', ascending: false }, limit: 8 }).catch(() => []),
    db.list('workflow_approvals', { filters: { parent_type: 'document', parent_id: r.id } }).catch(() => []),
  ]);
  const allTags = await db.list('tags').catch(() => []);
  const tagName = (id) => (allTags.find((t) => t.id === id) || {}).name || '?';
  const wf = wfs[0] || null;

  const m = modal({
    title: r.title.slice(0, 60), icon: 'file-text', size: 'lg',
    body: `
      <div class="flex flex-wrap" style="gap:6px;margin-bottom:10px">
        ${badge(r.classification)} ${badge(r.status)}
        <span class="chip-tag">Versi ${esc(r.version || '1.0')}</span>
        ${r.file_name ? `<span class="chip-tag">${esc(r.file_type?.toUpperCase())} · ${fmtSize(r.file_size)}</span>` : ''}
      </div>
      ${wf && !['diarsipkan'].includes(wf.stage) ? pipeline(WORKFLOW_STAGES, wf.stage, WORKFLOW_STAGE_LABEL) : ''}
      <div class="detail-grid">
        <div class="detail-item"><div class="dt-label">Nomor Dokumen</div><div class="dt-val">${esc(r.doc_number || '-')}</div></div>
        <div class="detail-item"><div class="dt-label">Kategori</div><div class="dt-val">${esc((DOC_CATEGORIES.find((c) => c.value === r.category) || {}).label || r.category)}</div></div>
        <div class="detail-item"><div class="dt-label">Berlaku</div><div class="dt-val">${esc(fmtDate(r.valid_from))} ${r.valid_until ? ' s/d ' + esc(fmtDate(r.valid_until)) : ''}</div></div>
        <div class="detail-item"><div class="dt-label">Statistik</div><div class="dt-val">${fmtNum(r.view_count || 0)} dilihat · ${fmtNum(r.download_count || 0)} diunduh</div></div>
        <div class="detail-item full"><div class="dt-label">Deskripsi</div><div class="dt-val prose">${esc(r.description || '-')}</div></div>
        <div class="detail-item full"><div class="dt-label">Tag</div><div class="chips mt-1">
          ${tags.length ? tags.map((t) => `<span class="chip-tag">${esc(tagName(t.tag_id))}</span>`).join('') : '<span class="text-muted" style="font-size:.82rem">Belum ada tag</span>'}
        </div></div>
      </div>
      <h4 class="mt-3" style="font-size:.9rem">Riwayat Versi (${versions.length})</h4>
      <div class="mini-list mt-1" style="border:1px solid var(--border);border-radius:10px;max-height:170px;overflow:auto">
        ${versions.length ? versions.map((v) => `
          <div class="mini-item" style="cursor:default">
            <span class="mi-ic"><i data-lucide="history"></i></span>
            <span class="grow"><b>Versi ${esc(v.version)}</b><small>${esc(v.notes || '-')} ${v.file_name ? '· ' + esc(v.file_name) : ''}</small></span>
            <span class="mi-right"><small>${esc(fmtAgo(v.created_at))}</small></span>
          </div>`).join('') : `<div class="empty-state" style="padding:16px"><i data-lucide="history"></i><b>Belum ada riwayat versi</b></div>`}
      </div>
      <h4 class="mt-3" style="font-size:.9rem">Aktivitas Akses Terakhir</h4>
      <div class="mini-list mt-1" style="border:1px solid var(--border);border-radius:10px;max-height:170px;overflow:auto">
        ${logs.length ? logs.map((l) => `
          <div class="mini-item" style="cursor:default">
            <span class="mi-ic"><i data-lucide="${l.action === 'download' ? 'download' : 'eye'}"></i></span>
            <span class="grow"><b>${esc(l.user_name || '-')}</b><small>${l.action === 'download' ? 'Mengunduh dokumen' : 'Melihat dokumen'}</small></span>
            <span class="mi-right"><small>${esc(fmtAgo(l.created_at))}</small></span>
          </div>`).join('') : `<div class="empty-state" style="padding:16px"><i data-lucide="activity"></i><b>Belum ada aktivitas</b></div>`}
      </div>`,
    footer: `
      ${r.file_path && (r.file_type || '').toLowerCase() === 'pdf' ? `<button class="btn btn-outline" data-act="preview"><i data-lucide="file-eye"></i> Pratinjau</button>` : ''}
      ${r.file_path ? `<button class="btn btn-outline" data-act="dl"><i data-lucide="download"></i> Unduh</button>` : ''}
      ${can('documents.edit') && (r.status === 'draft' || r.status === 'revisi') && !wf ? `<button class="btn btn-gold" data-act="submit"><i data-lucide="send"></i> Ajukan Review</button>` : ''}
      ${wf && wf.stage !== 'diarsipkan' && (actionsFor(wf).length) ? actionsFor(wf).map((a) => `<button class="btn ${a.gold ? 'btn-gold' : a.danger ? 'btn-danger' : 'btn-outline'}" data-wf="${a.id}"><i data-lucide="${a.icon}"></i> ${esc(a.label)}</button>`).join('') : ''}`,
    onOpen: async (el, close) => {
      refreshIcons(el);
      db.update('documents', r.id, { view_count: (r.view_count || 0) + 1 }).catch(() => {});
      db.logAccess('document', r.id, 'view').catch(() => {});
      const pv = el.querySelector('[data-act="preview"]');
      if (pv) pv.addEventListener('click', async () => {
        const url = await db.fileUrl(r.file_path);
        if (url) previewPdfModal(url, r.title); else toast('Berkas tidak dapat dibuka.', 'warning');
      });
      const dl = el.querySelector('[data-act="dl"]');
      if (dl) dl.addEventListener('click', () => downloadDoc(r));
      const sb = el.querySelector('[data-act="submit"]');
      if (sb) sb.addEventListener('click', async () => { close(); await createWorkflow({ parentType: 'document', parentId: r.id, title: r.title }); onChange(); });
      el.querySelectorAll('[data-wf]').forEach((b) => b.addEventListener('click', async () => { close(); await runAction(wf, b.dataset.wf, onChange); }));
    },
  });
  refreshIcons(m.el);
}

/* ---------- Form unggah/edit ---------- */
async function showUploadForm(r, onChange) {
  await formModal({
    title: r ? 'Edit Dokumen' : 'Unggah Dokumen Baru', icon: 'upload', size: 'lg',
    fields: [
      { key: 'title', label: 'Judul Dokumen', required: true, value: r?.title, full: true, placeholder: 'Contoh: SK Dewan Pembina Masa Bakti 2024-2029' },
      { key: 'doc_number', label: 'Nomor Dokumen', value: r?.doc_number, placeholder: 'SK/ORG/2024/004' },
      { key: 'category', label: 'Kategori', type: 'select', required: true, options: DOC_CATEGORIES.map((c) => ({ value: c.value, label: c.label })), value: r?.category },
      { key: 'classification', label: 'Klasifikasi', type: 'select', required: true, options: CLASSIFICATIONS, value: r?.classification || 'internal' },
      { key: 'year', label: 'Tahun', type: 'number', value: r?.year || new Date().getFullYear(), min: 1990, max: 2100 },
      { key: 'valid_from', label: 'Berlaku Sejak', type: 'date', value: r?.valid_from },
      { key: 'valid_until', label: 'Berlaku Sampai (opsional)', type: 'date', value: r?.valid_until },
      { key: 'version', label: 'Versi', value: r?.version || '1.0' },
      { key: 'status', label: 'Status', type: 'select', options: POLICY_STATUS, value: r?.status || 'draft', help: 'Gunakan workflow untuk proses review & publikasi.' },
      { key: 'description', label: 'Deskripsi', type: 'textarea', full: true, rows: 3, value: r?.description },
      { key: 'tags', label: 'Tag (pisahkan koma)', full: true, value: '', placeholder: 'guru, kontrak, PKWT', help: 'Tag akan dibuat bila belum ada.' },
      { key: 'file', label: r ? 'Ganti Berkas (opsional)' : 'Berkas', type: 'file', full: true, accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.zip', help: 'PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, gambar — maks 10 MB.' },
    ],
    submitLabel: r ? 'Simpan Perubahan' : 'Unggah Dokumen',
    onSubmit: async (v) => {
      const file = v.file;
      if (!r && !file) { toast('Pilih berkas untuk diunggah (PDF/DOC/XLS/PPT/gambar).', 'warning'); return false; }
      if (file && !validateFile(file).ok) { toast(validateFile(file).msg, 'error'); return false; }

      // Tag
      const tagIds = [];
      if (v.tags) {
        for (const name of String(v.tags).split(',').map((s) => s.trim()).filter(Boolean)) {
          const slug = name.toLowerCase().replace(/\s+/g, '-');
          let t = (await db.list('tags', { filters: { slug } }))[0];
          if (!t) t = await db.insert('tags', { slug, name });
          tagIds.push(t.id);
        }
      }

      let row;
      if (r) {
        row = await db.update('documents', r.id, {
          title: v.title, doc_number: v.doc_number, category: v.category,
          classification: v.classification, year: Number(v.year) || new Date().getFullYear(),
          valid_from: v.valid_from || null, valid_until: v.valid_until || null,
          version: v.version, status: v.status, description: v.description,
        });
        if (file) {
          const path = `documents/${r.id}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
          await db.upload(path, file);
          await db.update('documents', r.id, { file_path: path, file_name: file.name, file_type: file.name.split('.').pop().toLowerCase(), file_size: file.size });
        }
        await db.logAudit('edit', 'document', r.id, { title: v.title });
        if (file && r.version !== v.version) {
          await db.insert('document_versions', { parent_type: 'document', parent_id: r.id, version: r.version || '1.0', notes: 'Diganti oleh versi ' + v.version, file_name: r.file_name, created_by: profile()?.id });
        }
      } else {
        row = await db.insert('documents', {
          title: v.title, doc_number: v.doc_number, category: v.category,
          classification: v.classification, year: Number(v.year) || new Date().getFullYear(),
          valid_from: v.valid_from || null, valid_until: v.valid_until || null,
          version: v.version || '1.0', status: v.status || 'draft', description: v.description,
          owner_id: profile()?.id, created_by: profile()?.id,
          download_count: 0, view_count: 0,
        });
        const path = `documents/${row.id}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
        await db.upload(path, file);
        await db.update('documents', row.id, { file_path: path, file_name: file.name, file_type: file.name.split('.').pop().toLowerCase(), file_size: file.size });
        await db.logAudit('upload', 'document', row.id, { title: v.title });
      }
      if (tagIds.length) {
        await db.insertMany('document_tags', tagIds.map((tid) => ({ parent_type: 'document', parent_id: row.id, tag_id: tid })));
      }
      toast(r ? 'Dokumen diperbarui.' : 'Dokumen berhasil diunggah.', 'success');
      onChange();
      return true;
    },
  });
}
