/* ============================================================
   regulations.js — Modul 2: Regulatory Center
   Pusat regulasi nasional & sektoral dengan status verifikasi,
   relasi antar-regulasi, dan catatan pemeriksaan (review).
   ============================================================ */

import { REG_CATEGORIES, REG_STATUS, REG_RELATION_TYPES } from './config.js';
import { db, can, profile } from './supabase.js';
import {
  esc, toast, modal, formModal, confirmDialog, DataTable, badge, refreshIcons,
  fmtDate, fmtDateTime, rowIcon, validateFile, emptyState, downloadUrl, uid,
} from './ui.js';

export async function render(content, params = {}) {
  content.innerHTML = `
  <div class="page-head">
    <div>
      <h2>Regulatory Center</h2>
      <div class="ph-desc">Pusat regulasi nasional dan sektoral yang relevan bagi yayasan pendidikan. Status setiap regulasi harus diverifikasi melalui sumber resmi sebelum dikutip.</div>
    </div>
    <div class="ph-actions">
      ${can('regulations.manage') ? `<button class="btn btn-gold" id="add-reg"><i data-lucide="plus"></i> Tambah Regulasi</button>` : ''}
    </div>
  </div>
  <div class="notice gold"><i data-lucide="shield-alert"></i>
    <span>Perhatian: aplikasi <b>tidak menyatakan</b> suatu peraturan otomatis masih berlaku. Kolom status &amp; tanggal pemeriksaan terakhir wajib diisi berdasarkan pengecekan melalui JDIH resmi.</span>
  </div>
  <div id="reg-table"></div>`;
  refreshIcons(content);

  const table = new DataTable(content.querySelector('#reg-table'), {
    columns: [
      { key: 'number', label: 'Nomor & Judul', render: (r) => `<span class="cell-main">${esc(r.number)}</span><span class="cell-sub">${esc(String(r.title).slice(0, 70))}</span>` },
      { key: 'year', label: 'Tahun' },
      { key: 'category', label: 'Kategori', render: (r) => esc((REG_CATEGORIES.find((c) => c.value === r.category) || {}).label || r.category) },
      { key: 'status', label: 'Status', render: (r) => badge(r.status) },
      { key: 'verification_status', label: 'Verifikasi', render: (r) => badge(r.verification_status === 'terverifikasi' ? 'disetujui' : 'perlu_verifikasi', r.verification_status === 'terverifikasi' ? 'Terverifikasi' : 'Perlu Verifikasi') },
      { key: 'last_checked_at', label: 'Terakhir Diperiksa', render: (r) => esc(r.last_checked_at ? fmtDate(r.last_checked_at) : 'Belum pernah') },
      { key: 'actions', label: 'Aksi', render: (r) => `<div class="row-actions">
        ${rowIcon('view', 'eye', 'Lihat regulasi')}
        ${r.official_url ? `<button class="icon-act" data-action="open" title="Buka sumber resmi"><i data-lucide="external-link"></i></button>` : ''}
        ${r.file_path ? rowIcon('download', 'download', 'Unduh PDF') : ''}
        ${can('regulations.manage') ? `${rowIcon('edit', 'pencil', 'Edit', 'gold')}${rowIcon('review', 'badge-check', 'Catat pemeriksaan', 'gold')}${rowIcon('archive', 'archive', 'Arsipkan', 'danger')}` : ''}
      </div>` },
    ],
    searchKeys: ['number', 'title', 'provisions', 'summary'],
    searchPlaceholder: 'Cari nomor/judul regulasi…',
    filters: [
      { key: 'category', label: 'Semua Kategori', options: REG_CATEGORIES.map((c) => ({ value: c.value, label: c.label })) },
      { key: 'status', label: 'Semua Status', options: REG_STATUS },
    ],
    pageSize: 8,
    emptyIcon: 'scale', emptyTitle: 'Belum ada regulasi',
    actionsHtml: '',
    rowActionsMap: {
      view: (r) => showDetail(r, () => render(content, params)),
      open: (r) => window.open(r.official_url, '_blank', 'noopener'),
      download: async (r) => {
        try {
          const url = await db.fileUrl(r.file_path);
          if (!url) { toast('Berkas PDF belum tersedia.', 'warning'); return; }
          await db.logAccess('regulation', r.id, 'download');
          await db.update('regulations', r.id, {});
          downloadUrl(url, r.file_name || `${r.number}.pdf`);
        } catch (e) { toast(e.message, 'error'); }
      },
      edit: (r) => showForm(r, () => render(content, params)),
      review: (r) => showReviewForm(r, () => render(content, params)),
      archive: async (r) => {
        if (!(await confirmDialog(`Arsipkan regulasi ${r.number}? Regulasi yang diarsipkan tidak lagi ditampilkan sebagai acuan aktif.`, { danger: true }))) return;
        try { await db.update('regulations', r.id, { status: 'diarsipkan' }); await db.logAudit('edit', 'regulation', r.id, { title: r.number, note: 'diarsipkan' }); toast('Regulasi diarsipkan.', 'success'); render(content, params); }
        catch (e) { toast(e.message, 'error'); }
      },
    },
    onRowClick: (r) => showDetail(r, () => render(content, params)),
    exportable: false,
  });
  table.setRows(await db.list('regulations'));

  const addBtn = content.querySelector('#add-reg');
  if (addBtn) addBtn.addEventListener('click', () => showForm(null, () => render(content, params)));

  if (params.action === 'add' && can('regulations.manage')) showForm(null, () => render(content, params));
  if (params.highlight) {
    const row = (table._rows || []).find((r) => r.id === params.highlight);
    if (row) showDetail(row, () => render(content, params));
  }
}

/* ---------- Detail regulasi ---------- */
async function showDetail(r, onChange) {
  const [relations, reviews] = await Promise.all([
    db.list('regulation_relations', { filters: { regulation_id: r.id } }).catch(() => []),
    db.list('regulation_reviews', { filters: { regulation_id: r.id }, order: { col: 'created_at', ascending: false } }).catch(() => []),
  ]);
  const otherRegs = (await db.list('regulations').catch(() => [])).filter((x) => x.id !== r.id);
  const relLabel = (t) => (REG_RELATION_TYPES.find((x) => x.value === t) || {}).label || t;
  const relReg = (id) => otherRegs.find((x) => x.id === id);
  const canManage = can('regulations.manage');

  const m = modal({
    title: r.number + ' — ' + r.title.slice(0, 60), icon: 'scale', size: 'lg',
    body: `
      <div class="flex flex-wrap" style="gap:6px;margin-bottom:14px">
        ${badge(r.status)} ${badge(r.verification_status === 'terverifikasi' ? 'disetujui' : 'perlu_verifikasi', r.verification_status === 'terverifikasi' ? 'Terverifikasi' : 'Perlu Verifikasi')}
        <span class="chip-tag">${esc((REG_CATEGORIES.find((c) => c.value === r.category) || {}).label || '-')}</span>
      </div>
      <div class="detail-grid">
        <div class="detail-item"><div class="dt-label">Nomor Regulasi</div><div class="dt-val">${esc(r.number)}</div></div>
        <div class="detail-item"><div class="dt-label">Tahun</div><div class="dt-val">${esc(r.year)}</div></div>
        <div class="detail-item"><div class="dt-label">Instansi Penerbit</div><div class="dt-val">${esc(r.issuer || '-')}</div></div>
        <div class="detail-item"><div class="dt-label">Tanggal Pengundangan</div><div class="dt-val">${esc(fmtDate(r.promulgation_date))}</div></div>
        <div class="detail-item"><div class="dt-label">Tanggal Pemeriksaan Terakhir</div><div class="dt-val">${esc(r.last_checked_at ? fmtDate(r.last_checked_at) : 'Belum pernah diperiksa')}</div></div>
        <div class="detail-item"><div class="dt-label">Status Berlaku</div><div class="dt-val">${badge(r.status)}</div></div>
        <div class="detail-item full"><div class="dt-label">Ringkasan</div><div class="dt-val prose">${esc(r.summary || '-')}</div></div>
        <div class="detail-item full"><div class="dt-label">Pokok Pengaturan</div><div class="dt-val prose">${esc(r.provisions || '-')}</div></div>
        <div class="detail-item full"><div class="dt-label">Catatan Verifikasi</div><div class="dt-val prose">${esc(r.verification_note || '-')}</div></div>
        <div class="detail-item full"><div class="dt-label">Catatan Implementasi HRD</div><div class="dt-val prose">${esc(r.hrd_notes || '-')}</div></div>
        <div class="detail-item"><div class="dt-label">Sumber Resmi</div><div class="dt-val">
          ${r.official_url ? `<a class="link-ext" href="${esc(r.official_url)}" target="_blank" rel="noopener"><i data-lucide="external-link"></i> Buka sumber resmi</a>` : '<span class="text-muted">Tidak dicantumkan</span>'}</div></div>
        <div class="detail-item"><div class="dt-label">Berkas PDF</div><div class="dt-val">${r.file_path ? 'Terunggah' : '<span class="text-muted">Belum ada berkas</span>'}</div></div>
      </div>

      <h4 class="mt-3" style="font-size:.9rem">Relasi Regulasi</h4>
      <div class="mini-list mt-1" style="border:1px solid var(--border);border-radius:10px">
        ${relations.length ? relations.map((rel) => {
          const other = relReg(rel.related_id);
          return `<div class="mini-item" style="cursor:default">
            <span class="mi-ic"><i data-lucide="link-2"></i></span>
            <span class="grow"><b>${esc(rel.label ? '' : '')}${esc(other ? other.number : 'Regulasi terhapus')}</b><small>${esc(other ? other.title.slice(0, 70) : '-')}</small></span>
            <span class="mi-right">${badge('internal', relLabel(rel.relation_type))}${canManage ? rowIcon('delrel', 'trash-2', 'Hapus relasi', 'danger') : ''}</span>
          </div>`;
        }).join('') : `<div class="empty-state" style="padding:18px"><i data-lucide="unlink"></i><b>Belum ada relasi</b><p>Tandai regulasi yang mengubah/mencabut regulasi ini.</p></div>`}
      </div>

      <h4 class="mt-3" style="font-size:.9rem">Riwayat Pemeriksaan (${reviews.length})</h4>
      <div class="mini-list mt-1" style="border:1px solid var(--border);border-radius:10px">
        ${reviews.length ? reviews.map((rv) => `
          <div class="mini-item" style="cursor:default">
            <span class="mi-ic"><i data-lucide="badge-check"></i></span>
            <span class="grow"><b>${esc(rv.reviewer_name)} — ${esc(rv.result.replace('_', ' '))}</b><small>${esc(rv.notes || '-')}</small></span>
            <span class="mi-right"><small>${esc(fmtDate(rv.created_at))}</small></span>
          </div>`).join('') : `<div class="empty-state" style="padding:18px"><i data-lucide="badge-check"></i><b>Belum pernah diperiksa</b><p>Catat hasil pemeriksaan melalui JDIH resmi.</p></div>`}
      </div>`,
    footer: `
      ${r.official_url ? `<a class="btn btn-outline" href="${esc(r.official_url)}" target="_blank" rel="noopener"><i data-lucide="external-link"></i> Buka Sumber</a>` : ''}
      ${r.file_path ? `<button class="btn btn-outline" data-act="pdf"><i data-lucide="download"></i> Unduh PDF</button>` : ''}
      ${canManage ? `<button class="btn btn-outline" data-act="review"><i data-lucide="badge-check"></i> Catat Pemeriksaan</button>
      <button class="btn btn-outline" data-act="relate"><i data-lucide="link-2"></i> Tambah Relasi</button>
      <button class="btn btn-gold" data-act="edit"><i data-lucide="pencil"></i> Edit</button>` : ''}`,
    onOpen: (el, close) => {
      refreshIcons(el);
      const pdfBtn = el.querySelector('[data-act="pdf"]');
      if (pdfBtn) pdfBtn.addEventListener('click', async () => {
        const url = await db.fileUrl(r.file_path);
        if (!url) { toast('Berkas belum tersedia.', 'warning'); return; }
        await db.logAccess('regulation', r.id, 'download');
        downloadUrl(url, r.file_name || `${r.number}.pdf`);
      });
      const editBtn = el.querySelector('[data-act="edit"]');
      if (editBtn) editBtn.addEventListener('click', () => { close(); showForm(r, onChange); });
      const revBtn = el.querySelector('[data-act="review"]');
      if (revBtn) revBtn.addEventListener('click', () => { close(); showReviewForm(r, onChange); });
      const relBtn = el.querySelector('[data-act="relate"]');
      if (relBtn) relBtn.addEventListener('click', async () => {
        const picked = await formModal({
          title: 'Tambah Relasi Regulasi', icon: 'link-2',
          fields: [
            { key: 'related_id', label: 'Regulasi terkait', type: 'select', required: true, full: true, options: [{ value: '', label: '— Pilih regulasi —' }, ...otherRegs.map((x) => ({ value: x.id, label: `${x.number} — ${x.title.slice(0, 50)}` }))] },
            { key: 'relation_type', label: 'Jenis relasi', type: 'select', required: true, options: REG_RELATION_TYPES },
          ],
          submitLabel: 'Simpan Relasi',
          onSubmit: async (v) => { await db.insert('regulation_relations', { regulation_id: r.id, related_id: v.related_id, relation_type: v.relation_type }); toast('Relasi tersimpan.', 'success'); close(); onChange(); },
        });
        if (picked) { m.close(); }
      });
      el.querySelectorAll('[data-action="delrel"]').forEach((b) => b.addEventListener('click', async (e) => {
        e.stopPropagation();
        const rel = relations[Number(b.closest('.mini-item').dataset.relIndex || 0)];
        if (await confirmDialog('Hapus relasi ini?', { danger: true })) { await db.remove('regulation_relations', rel.id); toast('Relasi dihapus.', 'success'); m.close(); onChange(); }
      }));
      // tandai index relasi
      el.querySelectorAll('.mini-item').forEach((item, i) => { item.dataset.relIndex = i; });
    },
  });
  refreshIcons(m.el);
  await db.logAccess('regulation', r.id, 'view').catch(() => {});
}

/* ---------- Form tambah/edit ---------- */
async function showForm(r, onChange) {
  await formModal({
    title: r ? 'Edit Regulasi' : 'Tambah Regulasi', icon: 'scale', size: 'lg',
    introHtml: r && r.verification_status !== 'terverifikasi' ? `<div class="notice warn"><i data-lucide="alert-triangle"></i><span>Regulasi ini <b>belum terverifikasi</b>. Setelah menyimpan, catat pemeriksaan melalui sumber resmi.</span></div>` : '',
    fields: [
      { key: 'number', label: 'Nomor Regulasi', required: true, value: r?.number, placeholder: 'UU No. 13 Tahun 2003' },
      { key: 'year', label: 'Tahun', type: 'number', required: true, value: r?.year, min: 1950, max: 2100 },
      { key: 'title', label: 'Judul Regulasi', required: true, full: true, value: r?.title },
      { key: 'category', label: 'Kategori', type: 'select', required: true, options: REG_CATEGORIES, value: r?.category },
      { key: 'status', label: 'Status Berlaku', type: 'select', required: true, options: REG_STATUS, value: r?.status || 'perlu_verifikasi', help: 'Hanya isi "Berlaku" bila sudah diverifikasi melalui sumber resmi.' },
      { key: 'issuer', label: 'Instansi Penerbit', value: r?.issuer, placeholder: 'Pemerintah RI / Kementerian …' },
      { key: 'promulgation_date', label: 'Tanggal Pengundangan', type: 'date', value: r?.promulgation_date },
      { key: 'summary', label: 'Ringkasan', type: 'textarea', required: true, full: true, rows: 3, value: r?.summary },
      { key: 'provisions', label: 'Pokok Pengaturan', type: 'textarea', full: true, rows: 3, value: r?.provisions },
      { key: 'verification_status', label: 'Status Verifikasi', type: 'select', options: [{ value: 'perlu_verifikasi', label: 'Perlu Verifikasi' }, { value: 'terverifikasi', label: 'Terverifikasi' }], value: r?.verification_status || 'perlu_verifikasi' },
      { key: 'verification_note', label: 'Catatan Verifikasi', type: 'textarea', full: true, rows: 2, value: r?.verification_note },
      { key: 'official_url', label: 'Link Dokumen Resmi', full: true, value: r?.official_url, placeholder: 'https://peraturan.bpk.go.id/…' },
      { key: 'hrd_notes', label: 'Catatan Implementasi HRD', type: 'textarea', full: true, rows: 2, value: r?.hrd_notes },
      { key: 'file', label: 'Berkas PDF (opsional)', type: 'file', accept: '.pdf', full: true, help: 'Maksimal 10 MB.' },
    ],
    submitLabel: r ? 'Simpan Perubahan' : 'Tambah Regulasi',
    onSubmit: async (v) => {
      const file = v.file;
      if (file && !validateFile(file).ok) { toast(validateFile(file).msg, 'error'); return false; }
      const payload = {
        number: v.number, year: Number(v.year), title: v.title, category: v.category, status: v.status,
        issuer: v.issuer, promulgation_date: v.promulgation_date || null, summary: v.summary,
        provisions: v.provisions, verification_status: v.verification_status, verification_note: v.verification_note,
        official_url: v.official_url || null, hrd_notes: v.hrd_notes, created_by: profile()?.id,
      };
      let row;
      if (r) {
        row = await db.update('regulations', r.id, payload);
        await db.logAudit('edit', 'regulation', r.id, { title: v.number });
        if (file) {
          const path = `regulations/${r.id}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
          await db.upload(path, file);
          await db.update('regulations', r.id, { file_path: path, file_name: file.name });
        }
      } else {
        row = await db.insert('regulations', payload);
        if (file) {
          const path = `regulations/${row.id}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
          await db.upload(path, file);
          await db.update('regulations', row.id, { file_path: path, file_name: file.name });
        }
        await db.logAudit('create', 'regulation', row.id, { title: v.number });
      }
      toast(r ? 'Regulasi diperbarui.' : 'Regulasi ditambahkan.', 'success');
      onChange();
      return true;
    },
  });
}

/* ---------- Catat pemeriksaan ---------- */
async function showReviewForm(r, onChange) {
  await formModal({
    title: `Catat Pemeriksaan — ${r.number}`, icon: 'badge-check',
    introHtml: `<div class="notice info"><i data-lucide="info"></i><span>Pemeriksaan harus dilakukan melalui sumber resmi (JDIH/BPK). Hasil pemeriksaan akan memperbarui tanggal pemeriksaan terakhir dan status verifikasi.</span></div>`,
    fields: [
      { key: 'result', label: 'Hasil Pemeriksaan', type: 'select', required: true, options: [{ value: 'masih_berlaku', label: 'Masih Berlaku' }, { value: 'ada_perubahan', label: 'Ada Perubahan' }, { value: 'perlu_tinjauan', label: 'Perlu Tinjauan' }], full: true },
      { key: 'last_checked_at', label: 'Tanggal Pemeriksaan', type: 'date', required: true, value: new Date().toISOString().slice(0, 10) },
      { key: 'verification_status', label: 'Status Verifikasi Baru', type: 'select', options: [{ value: 'terverifikasi', label: 'Terverifikasi' }, { value: 'perlu_verifikasi', label: 'Perlu Verifikasi' }], value: 'terverifikasi' },
      { key: 'status', label: 'Status Berlaku Baru', type: 'select', options: REG_STATUS, value: r.status },
      { key: 'notes', label: 'Catatan Pemeriksaan', type: 'textarea', required: true, full: true, rows: 3, placeholder: 'Contoh: diperiksa melalui peraturan.bpk.go.id pada tanggal …; ditemukan perubahan melalui …' },
    ],
    submitLabel: 'Simpan Pemeriksaan',
    onSubmit: async (v) => {
      await db.insert('regulation_reviews', {
        regulation_id: r.id, reviewer_name: profile()?.full_name || '-',
        result: v.result, notes: v.notes, reviewed_by: profile()?.id,
      });
      await db.update('regulations', r.id, {
        last_checked_at: v.last_checked_at,
        verification_status: v.verification_status,
        verification_note: v.notes,
        status: v.status,
      });
      await db.logAudit('verify', 'regulation', r.id, { title: r.number });
      // Notifikasi untuk manajer HRD bila perlu tinjauan
      if (v.result === 'perlu_tinjauan' || v.verification_status === 'perlu_verifikasi') {
        const hrds = (await db.list('profiles', { filters: { role: 'manajer_hrd' } }).catch(() => []));
        for (const h of hrds) await db.notify(h.id, 'Regulasi perlu ditinjau', `${r.number} ditandai perlu tinjauan oleh ${profile()?.full_name}.`, 'warning', '#/monitoring');
      }
      toast('Pemeriksaan regulasi tercatat.', 'success');
      onChange();
      return true;
    },
  });
}
