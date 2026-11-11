/* ============================================================
   knowledge.js — Modul 9: HR Knowledge Base
   Perpustakaan pengetahuan HRD: artikel, kategori, tag,
   dan fitur knowledge sharing internal.
   ============================================================ */

import { KNOWLEDGE_CATEGORIES } from './config.js';
import { db, can, profile } from './supabase.js';
import {
  esc, toast, modal, formModal, confirmDialog, badge, refreshIcons,
  fmtDate, emptyState, rowIcon,
} from './ui.js';

export async function render(content, params = {}) {
  const rows = await db.list('knowledge_articles', { order: { col: 'published_at', ascending: false } });
  const allTags = await db.list('tags').catch(() => []);
  const cat = params.cat || '';
  const tagName = (id) => (allTags.find((t) => t.id === id) || {}).name || '';
  const items = cat ? rows.filter((r) => r.category === cat) : rows;

  content.innerHTML = `
  <div class="page-head">
    <div>
      <h2>HR Knowledge Base</h2>
      <div class="ph-desc">Perpustakaan pengetahuan HRD: manajemen SDM, human capital, industrial relations, hingga manajemen SDM boarding school.</div>
    </div>
    <div class="ph-actions">
      ${can('knowledge.manage') ? `<button class="btn btn-gold" id="add-kb"><i data-lucide="plus"></i> Tulis Artikel</button>` : ''}
    </div>
  </div>
  <div class="chips mb-2" id="kb-chips">
    <button class="chip ${!cat ? 'active' : ''}" data-cat="">Semua (${rows.length})</button>
    ${KNOWLEDGE_CATEGORIES.map((c) => {
      const n = rows.filter((r) => r.category === c.value).length;
      return `<button class="chip ${cat === c.value ? 'active' : ''}" data-cat="${c.value}" ${n ? '' : 'style="opacity:.5"'}>${esc(c.label)} (${n})</button>`;
    }).join('')}
  </div>
  <div class="tile-grid" id="kb-grid"></div>`;
  refreshIcons(content);

  const grid = content.querySelector('#kb-grid');
  if (!items.length) {
    grid.innerHTML = `<div class="card card-pad" style="grid-column:1/-1">${emptyState('lightbulb', 'Belum ada artikel pada kategori ini', 'Bagikan pengetahuan melalui artikel internal agar dapat dibaca tim HRD dan unit pendidikan.')}</div>`;
  } else {
    grid.innerHTML = items.map((a) => {
      const catObj = KNOWLEDGE_CATEGORIES.find((c) => c.value === a.category);
      return `<div class="tile" data-id="${esc(a.id)}" role="button" tabindex="0">
        <div class="flex justify-between">
          <div class="t-ic"><i data-lucide="lightbulb"></i></div>
          ${badge(a.status === 'dipublikasikan' ? 'dipublikasikan' : 'draft')}
        </div>
        <b>${esc(a.title)}</b>
        <small>${esc(String(a.summary).slice(0, 120))}…</small>
        <div class="chips">${(a.tags || []).map((t) => `<span class="chip-tag">${esc(tagName(t) || t)}</span>`).join('')}</div>
        <div class="t-foot">
          <span class="chip-tag">${esc(catObj?.label || a.category)}</span>
          <small>${esc(a.author)} · ${esc(fmtDate(a.published_at))}</small>
        </div>
        ${can('knowledge.manage') ? `<div class="row-actions">${rowIcon('edit', 'pencil', 'Edit artikel', 'gold')}${rowIcon('del', 'trash-2', 'Hapus', 'danger')}</div>` : ''}
      </div>`;
    }).join('');
  }
  refreshIcons(grid);

  grid.querySelectorAll('.tile').forEach((tile) => {
    const a = items.find((x) => x.id === tile.dataset.id);
    tile.addEventListener('click', () => showArticle(a, () => render(content, params)));
    const ed = tile.querySelector('[data-action="edit"]');
    if (ed) ed.addEventListener('click', (e) => { e.stopPropagation(); showForm(a, () => render(content, params)); });
    const del = tile.querySelector('[data-action="del"]');
    if (del) del.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!(await confirmDialog(`Hapus artikel "${a.title}"?`, { danger: true }))) return;
      await db.remove('knowledge_articles', a.id);
      await db.logAudit('delete', 'knowledge', a.id, { title: a.title });
      toast('Artikel dihapus.', 'success');
      render(content, params);
    });
  });

  content.querySelectorAll('#kb-chips .chip').forEach((c) => c.addEventListener('click', () => render(content, { ...params, cat: c.dataset.cat })));
  const addBtn = content.querySelector('#add-kb');
  if (addBtn) addBtn.addEventListener('click', () => showForm(null, () => render(content, params)));
  if (params.action === 'add' && can('knowledge.manage')) showForm(null, () => render(content, params));
  if (params.highlight) {
    const a = rows.find((x) => x.id === params.highlight);
    if (a) showArticle(a, () => render(content, { ...params, highlight: null }));
  }
}

function showArticle(a, onChange) {
  db.logAccess('knowledge', a.id, 'view').catch(() => {});
  const catObj = KNOWLEDGE_CATEGORIES.find((c) => c.value === a.category);
  const m = modal({
    title: a.title.slice(0, 70), icon: 'lightbulb', size: 'lg',
    body: `
      <div class="flex flex-wrap" style="gap:6px;margin-bottom:12px">
        ${badge(a.status === 'dipublikasikan' ? 'dipublikasikan' : 'draft')}
        <span class="chip-tag">${esc(catObj?.label || a.category)}</span>
        <span class="chip-tag">Penulis: ${esc(a.author)}</span>
        <span class="chip-tag">${esc(fmtDate(a.published_at))}</span>
      </div>
      <p style="color:var(--muted);font-size:.88rem;line-height:1.7;border-left:3px solid var(--gold-500);padding-left:12px;margin-bottom:14px">${esc(a.summary)}</p>
      <div class="prose" style="font-size:.9rem;line-height:1.8;white-space:pre-wrap">${esc(a.content)}</div>
      <div class="detail-item full mt-3"><div class="dt-label">Referensi</div><div class="dt-val prose">${esc(a.references || '-')}</div></div>`,
    footer: `${can('knowledge.manage') ? `<button class="btn btn-gold" data-act="edit"><i data-lucide="pencil"></i> Edit Artikel</button>` : ''}`,
    onOpen: (el, close) => {
      refreshIcons(el);
      const ed = el.querySelector('[data-act="edit"]');
      if (ed) ed.addEventListener('click', () => { close(); showForm(a, onChange); });
    },
  });
  refreshIcons(m.el);
}

async function showForm(a, onChange) {
  await formModal({
    title: a ? 'Edit Artikel' : 'Tulis Artikel Pengetahuan', icon: 'lightbulb', size: 'lg',
    fields: [
      { key: 'title', label: 'Judul Artikel', required: true, full: true, value: a?.title },
      { key: 'category', label: 'Kategori', type: 'select', required: true, options: KNOWLEDGE_CATEGORIES, value: a?.category },
      { key: 'author', label: 'Penulis', required: true, value: a?.author || profile()?.full_name },
      { key: 'status', label: 'Status', type: 'select', options: [{ value: 'draft', label: 'Draft' }, { value: 'dipublikasikan', label: 'Dipublikasikan' }], value: a?.status || 'draft' },
      { key: 'published_at', label: 'Tanggal Publikasi', type: 'date', value: a?.published_at || new Date().toISOString().slice(0, 10) },
      { key: 'tags', label: 'Tag (pisahkan koma)', full: true, value: '', placeholder: 'PKWT, kinerja, guru' },
      { key: 'summary', label: 'Ringkasan', type: 'textarea', required: true, full: true, rows: 3, value: a?.summary },
      { key: 'content', label: 'Isi Artikel', type: 'textarea', required: true, full: true, rows: 10, value: a?.content },
      { key: 'references', label: 'Referensi', type: 'textarea', full: true, rows: 2, value: a?.references, placeholder: 'Regulasi, pedoman internal, atau sumber ilmiah' },
    ],
    submitLabel: a ? 'Simpan Artikel' : 'Publikasikan Artikel',
    onSubmit: async (v) => {
      const payload = {
        title: v.title, category: v.category, author: v.author, status: v.status,
        published_at: v.published_at || new Date().toISOString().slice(0, 10),
        summary: v.summary, content: v.content, references: v.references,
        created_by: profile()?.id,
      };
      let row;
      if (a) {
        row = await db.update('knowledge_articles', a.id, payload);
        await db.logAudit('edit', 'knowledge', a.id, { title: v.title });
      } else {
        row = await db.insert('knowledge_articles', payload);
        await db.logAudit('publish', 'knowledge', row.id, { title: v.title });
      }
      if (v.tags) {
        for (const name of String(v.tags).split(',').map((s) => s.trim()).filter(Boolean)) {
          const slug = name.toLowerCase().replace(/\s+/g, '-');
          let t = (await db.list('tags', { filters: { slug } }))[0];
          if (!t) t = await db.insert('tags', { slug, name });
          await db.insert('document_tags', { parent_type: 'knowledge', parent_id: row.id, tag_id: t.id });
        }
      }
      toast(a ? 'Artikel diperbarui.' : 'Artikel dipublikasikan.', 'success');
      onChange();
      return true;
    },
  });
}
