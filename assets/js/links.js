/* ============================================================
   links.js — Modul 8: HR Reference Links
   Direktori link resmi: JDIH, AHU, Kemnaker, Kemendikdasmen,
   BPJS, DJP, dan sumber statistik/penelitian.
   ============================================================ */

import { LINK_CATEGORIES, LINK_TYPES } from './config.js';
import { db, can, profile } from './supabase.js';
import { esc, toast, formModal, confirmDialog, badge, refreshIcons, fmtDate, rowIcon, emptyState } from './ui.js';

export async function render(content, params = {}) {
  const rows = await db.list('external_links', { order: { col: 'category', ascending: true } });
  const cat = params.cat || '';

  content.innerHTML = `
  <div class="page-head">
    <div>
      <h2>HR Reference Links</h2>
      <div class="ph-desc">Direktori sumber resmi, referensi ilmiah, dan informasi umum. Link perlu diverifikasi berkala; <b>link eksternal bukan dokumen hukum yang mengikat</b> — rujuk selalu publikasi resminya.</div>
    </div>
    <div class="ph-actions">
      ${can('links.manage') ? `<button class="btn btn-gold" id="add-link"><i data-lucide="plus"></i> Tambah Link</button>
      <button class="btn btn-outline" id="verify-all"><i data-lucide="badge-check"></i> Verifikasi Terlihat</button>` : ''}
    </div>
  </div>
  <div class="chips mb-2" id="link-chips">
    <button class="chip ${!cat ? 'active' : ''}" data-cat="">Semua (${rows.length})</button>
    ${LINK_CATEGORIES.map((c) => {
      const n = rows.filter((r) => r.category === c.value).length;
      return `<button class="chip ${cat === c.value ? 'active' : ''}" data-cat="${c.value}">${esc(c.label)} (${n})</button>`;
    }).join('')}
  </div>
  <div id="link-groups"></div>`;
  refreshIcons(content);

  const wrap = content.querySelector('#link-groups');
  const visible = cat ? rows.filter((r) => r.category === cat) : rows;
  const groups = cat ? [{ value: cat, label: (LINK_CATEGORIES.find((c) => c.value === cat) || {}).label }] : LINK_CATEGORIES;

  wrap.innerHTML = groups.map((g) => {
    const items = visible.filter((r) => r.category === g.value);
    return `<div class="card mt-2">
      <div class="card-head"><h3><i data-lucide="globe"></i> ${esc(g.label)}</h3><span class="chip-tag">${items.length} link</span></div>
      <div class="mini-list">${items.length ? items.map((r) => `
        <div class="mini-item" data-id="${esc(r.id)}">
          <span class="mi-ic"><i data-lucide="external-link"></i></span>
          <span class="grow"><b>${esc(r.name)} ${badge(r.link_type)}</b><small>${esc(r.description || '')}</small>
            <small style="display:block;margin-top:3px">📍 ${esc(r.agency || '-')} · Verifikasi: ${esc(r.verified_at ? fmtDate(r.verified_at) : 'Belum')} ${r.notes ? '· ' + esc(r.notes) : ''}</small></span>
          <span class="mi-right">
            ${badge(r.is_active ? 'aktif' : 'nonaktif')}
            <div class="row-actions mt-1">
              <button class="icon-act gold" data-action="open" title="Buka Website"><i data-lucide="external-link"></i></button>
              ${can('links.manage') ? `${rowIcon('verify', 'badge-check', 'Tandai terverifikasi', 'gold')}${rowIcon('edit', 'pencil', 'Edit', 'gold')}${rowIcon('del', 'trash-2', 'Hapus', 'danger')}` : ''}
            </div>
          </span>
        </div>`).join('') : emptyState('globe', 'Belum ada link pada kategori ini', 'Tambahkan link referensi resmi yang dibutuhkan HRD.')}</div>
    </div>`;
  }).join('');
  refreshIcons(wrap);

  wrap.querySelectorAll('.mini-item').forEach((el) => {
    const r = rows.find((x) => x.id === el.dataset.id);
    el.querySelector('[data-action="open"]').addEventListener('click', () => window.open(r.url, '_blank', 'noopener'));
    const v = el.querySelector('[data-action="verify"]');
    if (v) v.addEventListener('click', async () => {
      await db.update('external_links', r.id, { verified_at: new Date().toISOString().slice(0, 10) });
      await db.logAudit('verify_link', 'external_link', r.id, { url: r.url });
      toast('Link ditandai terverifikasi hari ini.', 'success');
      render(content, params);
    });
    const ed = el.querySelector('[data-action="edit"]');
    if (ed) ed.addEventListener('click', () => showForm(r, () => render(content, params)));
    const del = el.querySelector('[data-action="del"]');
    if (del) del.addEventListener('click', async () => {
      if (!(await confirmDialog(`Hapus link "${r.name}"?`, { danger: true }))) return;
      await db.remove('external_links', r.id);
      await db.logAudit('delete', 'external_link', r.id, { url: r.url });
      toast('Link dihapus.', 'success');
      render(content, params);
    });
  });

  content.querySelectorAll('#link-chips .chip').forEach((c) => c.addEventListener('click', () => render(content, { ...params, cat: c.dataset.cat })));
  const addBtn = content.querySelector('#add-link');
  if (addBtn) addBtn.addEventListener('click', () => showForm(null, () => render(content, params)));
  const verifyAll = content.querySelector('#verify-all');
  if (verifyAll) verifyAll.addEventListener('click', async () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const r of visible) await db.update('external_links', r.id, { verified_at: today });
    await db.logAudit('verify_link', 'external_link', null, { count: visible.length });
    toast(`${visible.length} link ditandai terverifikasi (${fmtDate(today)}).`, 'success');
    render(content, params);
  });
  if (params.action === 'add' && can('links.manage')) showForm(null, () => render(content, params));
}

function showForm(r, onChange) {
  formModal({
    title: r ? 'Edit Link Referensi' : 'Tambah Link Referensi', icon: 'globe',
    fields: [
      { key: 'name', label: 'Nama Situs', required: true, value: r?.name, placeholder: 'JDIH Badan Pemeriksa Keuangan' },
      { key: 'url', label: 'URL', type: 'url', required: true, full: true, value: r?.url, placeholder: 'https://peraturan.bpk.go.id/' },
      { key: 'category', label: 'Kategori', type: 'select', required: true, options: LINK_CATEGORIES, value: r?.category },
      { key: 'link_type', label: 'Jenis Sumber', type: 'select', required: true, options: LINK_TYPES, value: r?.link_type || 'resmi', help: 'Bedakan sumber resmi, referensi ilmiah, dan informasi umum.' },
      { key: 'agency', label: 'Instansi Pemilik', value: r?.agency, placeholder: 'Kementerian / lembaga' },
      { key: 'is_active', label: 'Status Aktif', type: 'checkbox', value: r ? r.is_active : true },
      { key: 'description', label: 'Deskripsi', type: 'textarea', full: true, rows: 2, value: r?.description },
      { key: 'notes', label: 'Catatan Kegunaan bagi HRD', type: 'textarea', full: true, rows: 2, value: r?.notes },
    ],
    submitLabel: r ? 'Simpan' : 'Tambah Link',
    onSubmit: async (v) => {
      const payload = {
        name: v.name, url: v.url, category: v.category, link_type: v.link_type,
        agency: v.agency, is_active: !!v.is_active, description: v.description, notes: v.notes,
        verified_at: r?.verified_at || null, created_by: profile()?.id,
      };
      if (r) {
        await db.update('external_links', r.id, payload);
        await db.logAudit('edit', 'external_link', r.id, { url: v.url });
      } else {
        const row = await db.insert('external_links', payload);
        await db.logAudit('create', 'external_link', row.id, { url: v.url });
      }
      toast(r ? 'Link diperbarui.' : 'Link ditambahkan.', 'success');
      onChange();
      return true;
    },
  });
}
