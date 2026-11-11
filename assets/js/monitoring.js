/* ============================================================
   monitoring.js — Modul 12: Regulatory Monitoring
   Pemantauan status regulasi: jadwal pemeriksaan, penandaan
   perlu tinjau, dan penghubungan regulasi pengganti.
   ============================================================ */

import { REG_CATEGORIES, REG_STATUS, REG_RELATION_TYPES } from './config.js';
import { db, can, profile } from './supabase.js';
import { esc, toast, modal, formModal, DataTable, badge, refreshIcons, fmtDate, statCardHtml, rowIcon, emptyState } from './ui.js';
import { navigate } from './app.js';

const YEAR_MS = 365 * 24 * 3600 * 1000;

export async function render(content, params = {}) {
  const regs = await db.list('regulations', { order: { col: 'last_checked_at', ascending: true } });
  const now = Date.now();
  const stale = regs.filter((r) => !r.last_checked_at || now - new Date(r.last_checked_at).getTime() > YEAR_MS);
  const flagged = regs.filter((r) => r.verification_status === 'perlu_verifikasi' || r.status === 'perlu_verifikasi');
  const reviewed = regs.filter((r) => r.last_checked_at && now - new Date(r.last_checked_at).getTime() <= YEAR_MS);

  content.innerHTML = `
  <div class="page-head">
    <div>
      <h2>Regulatory Monitoring</h2>
      <div class="ph-desc">Aplikasi <b>tidak mengetahui otomatis</b> seluruh regulasi baru tanpa mekanisme pemeriksaan — gunakan daftar ini untuk memantau dan mencatat hasil pemeriksaan melalui sumber resmi.</div>
    </div>
    <div class="ph-actions">
      ${can('monitoring.manage') ? `<button class="btn btn-gold" id="goto-reg"><i data-lucide="scale"></i> Kelola Regulasi</button>` : ''}
    </div>
  </div>
  <div class="stat-grid">
    ${statCardHtml({ value: regs.length, label: 'Regulasi Dipantau', icon: 'scale', color: 'var(--navy-600)' })}
    ${statCardHtml({ value: reviewed.length, label: 'Sudah Diperiksa < 1 Tahun', icon: 'check-circle-2', color: 'var(--success)' })}
    ${statCardHtml({ value: stale.length, label: 'Pemeriksaan > 1 Tahun', icon: 'clock', color: 'var(--warning)' })}
    ${statCardHtml({ value: flagged.length, label: 'Ditandai Perlu Verifikasi', icon: 'alert-triangle', color: 'var(--danger)' })}
  </div>
  <div class="grid-2 mb-2">
    <div class="card">
      <div class="card-head"><h3><i data-lucide="clock"></i> Jadwal Pemeriksaan Terdekat</h3></div>
      <div class="mini-list">${stale.length ? stale.slice(0, 5).map((r) => `
        <div class="mini-item" data-reg="${esc(r.id)}" role="button" tabindex="0">
          <span class="mi-ic" style="background:var(--warning-bg);color:var(--warning)"><i data-lucide="clock"></i></span>
          <span class="grow"><b>${esc(r.number)}</b><small>${esc(r.title.slice(0, 60))}</small></span>
          <span class="mi-right"><small>${r.last_checked_at ? 'Diperiksa ' + esc(fmtDate(r.last_checked_at)) : 'Belum pernah'}</small></span>
        </div>`).join('') : emptyState('check-circle-2', 'Semua terpantau', 'Seluruh regulasi telah diperiksa dalam 12 bulan terakhir.')}</div>
    </div>
    <div class="card">
      <div class="card-head"><h3><i data-lucide="alert-triangle"></i> Ditandai Perlu Verifikasi</h3></div>
      <div class="mini-list">${flagged.length ? flagged.slice(0, 5).map((r) => `
        <div class="mini-item" data-reg="${esc(r.id)}" role="button" tabindex="0">
          <span class="mi-ic" style="background:var(--danger-bg);color:var(--danger)"><i data-lucide="alert-triangle"></i></span>
          <span class="grow"><b>${esc(r.number)}</b><small>${esc((r.verification_note || r.title || '').slice(0, 60))}</small></span>
          <span class="mi-right">${badge('perlu_verifikasi', 'Perlu Verifikasi')}</span>
        </div>`).join('') : emptyState('badge-check', 'Tidak ada penanda', 'Semua regulasi telah terverifikasi.')}</div>
    </div>
  </div>
  <div id="mon-table"></div>`;
  refreshIcons(content);

  const table = new DataTable(content.querySelector('#mon-table'), {
    columns: [
      { key: 'number', label: 'Regulasi', render: (r) => `<span class="cell-main">${esc(r.number)}</span><span class="cell-sub">${esc(r.title.slice(0, 66))}</span>` },
      { key: 'category', label: 'Kategori', render: (r) => esc((REG_CATEGORIES.find((c) => c.value === r.category) || {}).label || r.category) },
      { key: 'status', label: 'Status', render: (r) => badge(r.status) },
      { key: 'last_checked_at', label: 'Terakhir Diperiksa', render: (r) => { if (!r.last_checked_at) return '<span class="text-danger" style="font-size:.8rem">Belum pernah</span>'; const ok = now - new Date(r.last_checked_at).getTime() <= YEAR_MS; return `<span style="font-size:.82rem;color:${ok ? 'var(--success)' : 'var(--warning)'}">${esc(fmtDate(r.last_checked_at))}</span>`; } },
      { key: 'verification_status', label: 'Verifikasi', render: (r) => badge(r.verification_status === 'terverifikasi' ? 'disetujui' : 'perlu_verifikasi', r.verification_status === 'terverifikasi' ? 'Terverifikasi' : 'Perlu Verifikasi') },
      { key: 'actions', label: 'Aksi', render: (r) => `<div class="row-actions">
        ${rowIcon('view', 'eye', 'Lihat regulasi')}
        ${r.official_url ? rowIcon('open', 'external-link', 'Buka sumber resmi') : ''}
        ${can('monitoring.manage') ? rowIcon('review', 'badge-check', 'Catat pemeriksaan', 'gold') : ''}
        ${can('monitoring.manage') ? rowIcon('flag', 'flag', 'Tandai perlu ditinjau', 'danger') : ''}
        ${can('monitoring.manage') ? rowIcon('replace', 'git-compare', 'Hubungkan regulasi pengganti', 'gold') : ''}
      </div>` },
    ],
    searchKeys: ['number', 'title'],
    searchPlaceholder: 'Cari regulasi…',
    filters: [
      { key: 'category', label: 'Semua Kategori', options: REG_CATEGORIES },
      { key: 'status', label: 'Semua Status', options: REG_STATUS },
    ],
    pageSize: 8,
    emptyIcon: 'radar', emptyTitle: 'Belum ada regulasi dipantau',
    rowActionsMap: {
      view: (r) => navigate('regulations', { highlight: r.id }),
      open: (r) => window.open(r.official_url, '_blank', 'noopener'),
      review: (r) => showCheckForm(r, () => render(content, params)),
      flag: (r) => showFlagForm(r, () => render(content, params)),
      replace: (r) => showReplaceForm(r, () => render(content, params)),
    },
    onRowClick: (r) => showRegDetail(r, () => render(content, params)),
  });
  table.setRows(regs);

  content.querySelectorAll('[data-reg]').forEach((el) => el.addEventListener('click', () => {
    const r = regs.find((x) => x.id === el.dataset.reg);
    if (r) showRegDetail(r, () => render(content, params));
  }));
  const gr = content.querySelector('#goto-reg');
  if (gr) gr.addEventListener('click', () => navigate('regulations'));
}

function showRegDetail(r, onChange) {
  const m = modal({
    title: r.number, icon: 'radar',
    body: `
      <div class="detail-grid">
        <div class="detail-item"><div class="dt-label">Judul</div><div class="dt-val">${esc(r.title.slice(0, 90))}</div></div>
        <div class="detail-item"><div class="dt-label">Status</div><div class="dt-val">${badge(r.status)}</div></div>
        <div class="detail-item"><div class="dt-label">Terakhir Diperiksa</div><div class="dt-val">${esc(r.last_checked_at ? fmtDate(r.last_checked_at) : 'Belum pernah')}</div></div>
        <div class="detail-item"><div class="dt-label">Verifikasi</div><div class="dt-val">${badge(r.verification_status === 'terverifikasi' ? 'disetujui' : 'perlu_verifikasi')}</div></div>
        <div class="detail-item full"><div class="dt-label">Catatan Verifikasi</div><div class="dt-val prose">${esc(r.verification_note || '-')}</div></div>
      </div>`,
    footer: `<a class="btn btn-outline" href="${esc(r.official_url || '#')}" target="_blank" rel="noopener"><i data-lucide="external-link"></i> Sumber Resmi</a>`,
  });
  refreshIcons(m.el);
}

async function showCheckForm(r, onChange) {
  await formModal({
    title: `Catat Pemeriksaan — ${r.number}`, icon: 'badge-check',
    introHtml: `<div class="notice info"><i data-lucide="info"></i><span>Hasil pemeriksaan harus bersumber dari JDIH resmi. Manajer HRD akan menerima notifikasi bila hasilnya perlu tinjauan.</span></div>`,
    fields: [
      { key: 'result', label: 'Hasil Pemeriksaan', type: 'select', required: true, options: [{ value: 'masih_berlaku', label: 'Masih Berlaku' }, { value: 'ada_perubahan', label: 'Ada Perubahan' }, { value: 'perlu_tinjauan', label: 'Perlu Tinjauan' }], full: true },
      { key: 'last_checked_at', label: 'Tanggal Pemeriksaan', type: 'date', required: true, value: new Date().toISOString().slice(0, 10) },
      { key: 'notes', label: 'Catatan', type: 'textarea', required: true, full: true, rows: 3 },
    ],
    submitLabel: 'Simpan',
    onSubmit: async (v) => {
      await db.insert('regulation_reviews', { regulation_id: r.id, reviewer_name: profile()?.full_name || '-', result: v.result, notes: v.notes, reviewed_by: profile()?.id });
      await db.update('regulations', r.id, {
        last_checked_at: v.last_checked_at,
        verification_status: v.result === 'masih_berlaku' ? 'terverifikasi' : 'perlu_verifikasi',
        verification_note: v.notes,
      });
      await db.logAudit('verify', 'regulation', r.id, { title: r.number });
      if (v.result !== 'masih_berlaku') {
        const hrds = await db.list('profiles', { filters: { role: 'manajer_hrd' } }).catch(() => []);
        for (const h of hrds) await db.notify(h.id, 'Regulasi perlu ditinjau', `${r.number} ditandai "${v.result.replace('_', ' ')}" oleh ${profile()?.full_name}.`, 'warning', '#/monitoring');
      }
      toast('Pemeriksaan tercatat.', 'success');
      onChange();
      return true;
    },
  });
}

async function showFlagForm(r, onChange) {
  await formModal({
    title: `Tandai Perlu Ditinjau — ${r.number}`, icon: 'flag',
    fields: [{ key: 'note', label: 'Alasan penandaan', type: 'textarea', required: true, full: true, rows: 3 }],
    submitLabel: 'Tandai',
    onSubmit: async (v) => {
      await db.update('regulations', r.id, { verification_status: 'perlu_verifikasi', verification_note: v.note });
      await db.logAudit('edit', 'regulation', r.id, { title: r.number, note: 'ditandai perlu tinjauan' });
      const hrds = await db.list('profiles', { filters: { role: 'manajer_hrd' } }).catch(() => []);
      for (const h of hrds) await db.notify(h.id, 'Regulasi perlu ditinjau', `${r.number} ditandai perlu ditinjau: ${v.note.slice(0, 80)}`, 'warning', '#/monitoring');
      toast('Regulasi ditandai perlu ditinjau.', 'success');
      onChange();
      return true;
    },
  });
}

async function showReplaceForm(r, onChange) {
  const others = (await db.list('regulations')).filter((x) => x.id !== r.id);
  await formModal({
    title: `Hubungkan Regulasi Pengganti — ${r.number}`, icon: 'git-compare',
    introHtml: `<div class="notice info"><i data-lucide="info"></i><span>Hubungkan regulasi lama dengan regulasi pengganti/ubahnya agar riwayat perubahan terjaga.</span></div>`,
    fields: [
      { key: 'related_id', label: 'Regulasi pengganti / terkait', type: 'select', required: true, full: true, options: [{ value: '', label: '— Pilih —' }, ...others.map((o) => ({ value: o.id, label: `${o.number} — ${o.title.slice(0, 44)}` }))] },
      { key: 'relation_type', label: 'Jenis Relasi', type: 'select', required: true, options: REG_RELATION_TYPES },
    ],
    submitLabel: 'Hubungkan',
    onSubmit: async (v) => {
      await db.insert('regulation_relations', { regulation_id: r.id, related_id: v.related_id, relation_type: v.relation_type });
      toast('Relasi regulasi tersimpan.', 'success');
      onChange();
      return true;
    },
  });
}
