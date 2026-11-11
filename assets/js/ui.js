/* ============================================================
   ui.js — Komponen UI bersama: modal, form, tabel data, toast,
   ekspor laporan (CSV/XLS/PDF), util format.
   ============================================================ */

import { STATUS_BADGE, MAX_FILE_SIZE, ALLOWED_EXT, APP } from './config.js';

console.info(`[HRKC ${APP.version}] ui.js — tombol simpan terkunci saat proses (anti simpan ganda)`);

/* ---------- Util dasar ---------- */
export const esc = (s) => String(s ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9));

export const fmtNum = (n) => new Intl.NumberFormat('id-ID').format(Number(n) || 0);

export function fmtDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt)) return '-';
  return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function fmtDateTime(d) {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt)) return '-';
  return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
    dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export function fmtAgo(d) {
  if (!d) return '-';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const day = Math.floor(h / 24);
  if (day < 30) return `${day} hari lalu`;
  return fmtDate(d);
}

export function fmtSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function initials(name) {
  return String(name || '?').replace(/,.*$/, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
}

/* ---------- Ikon Lucide ---------- */
export function refreshIcons(root) {
  if (window.lucide && window.lucide.createIcons) {
    try { window.lucide.createIcons({ nameAttr: 'data-lucide' }, root || undefined); } catch { /* noop */ }
  }
}

/* ---------- Toast ---------- */
export function toast(message, type = 'info', title = null) {
  const root = document.getElementById('toast-root');
  const icons = { success: 'check-circle-2', error: 'alert-circle', warning: 'alert-triangle', info: 'info' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i data-lucide="${icons[type] || 'info'}"></i><div>${title ? `<b>${esc(title)}</b>` : ''}<small>${esc(message)}</small></div>`;
  root.appendChild(el);
  refreshIcons(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 4200);
}

/* ---------- Modal dasar ---------- */
export function modal({ title, icon = 'file-text', body = '', footer = '', size = '', onOpen = null, onClose = null }) {
  const root = document.getElementById('modal-root');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div class="m-ic"><i data-lucide="${icon}"></i></div>
        <h3>${esc(title)}</h3>
        <button class="modal-close" aria-label="Tutup"><i data-lucide="x"></i></button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  root.appendChild(overlay);
  refreshIcons(overlay);

  const close = () => { overlay.remove(); if (onClose) onClose(); };
  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function escKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escKey); }
  });
  if (onOpen) onOpen(overlay.querySelector('.modal'), close);
  return { close, el: overlay.querySelector('.modal') };
}

export function confirmDialog(message, { title = 'Konfirmasi', okLabel = 'Ya, Lanjutkan', danger = false } = {}) {
  return new Promise((resolve) => {
    const m = modal({
      title, icon: danger ? 'alert-triangle' : 'help-circle', size: '',
      body: `<p style="font-size:.9rem;line-height:1.6;color:var(--text)">${esc(message)}</p>`,
      footer: `<button class="btn btn-outline" data-act="no">Batal</button>
               <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="yes">${esc(okLabel)}</button>`,
      onClose: () => resolve(false),
    });
    m.el.querySelector('[data-act="no"]').addEventListener('click', () => { m.close(); resolve(false); });
    m.el.querySelector('[data-act="yes"]').addEventListener('click', () => { m.close(); resolve(true); });
  });
}

/* ---------- Form builder ---------- */
export function formModal({ title, icon = 'edit-3', fields, submitLabel = 'Simpan', size = '', onSubmit, introHtml = '' }) {
  return new Promise((resolve) => {
    const body = `${introHtml}<form class="form-grid" id="hrk-form" novalidate>${fields.map((f) => fieldHtml(f)).join('')}</form>`;
    const m = modal({
      title, icon, body, size,
      footer: `<button class="btn btn-outline" data-act="cancel">Batal</button>
               <button class="btn btn-gold" data-act="submit"><i data-lucide="save"></i>${esc(submitLabel)}</button>`,
      onClose: () => resolve(null),
    });
    const form = m.el.querySelector('#hrk-form');
    m.el.querySelector('[data-act="cancel"]').addEventListener('click', () => m.close());
    const submitBtn = m.el.querySelector('[data-act="submit"]');
    const restoreBtn = () => {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i data-lucide="save"></i>${esc(submitLabel)}`;
      refreshIcons(submitBtn);
    };
    let submitting = false;
    const doSubmit = async () => {
      if (submitting) return; // proses masih berjalan — abaikan klik/Enter tambahan (cegah baris ganda)
      const values = {}; let valid = true;
      fields.forEach((f) => {
        const wrap = form.querySelector(`[data-field="${f.key}"]`);
        const input = wrap.querySelector('input,select,textarea');
        let v = input.type === 'file' ? input.files[0] : (input.type === 'checkbox' ? input.checked : input.value.trim());
        const empty = (typeof v === 'string' && !v) || v == null || (typeof v === 'string' && f.type === 'select' && v === '');
        if (f.required && empty) { wrap.classList.add('invalid'); valid = false; } else { wrap.classList.remove('invalid'); values[f.key] = v; }
      });
      if (!valid) { toast('Periksa kembali kolom wajib yang belum diisi.', 'error', 'Validasi'); return; }
      // Kunci tombol selama proses berjalan (unggah berkas bisa beberapa detik)
      submitting = true;
      submitBtn.disabled = true;
      submitBtn.classList.add('loading'); submitBtn.innerHTML = '<span class="spinner"></span> Memproses…';
      try {
        const result = await onSubmit(values);
        if (result !== false) { m.close(); resolve(values); }
        else { submitting = false; restoreBtn(); }
      } catch (err) {
        console.error(err);
        toast(err.message || 'Gagal menyimpan data.', 'error', 'Kesalahan');
        submitting = false; restoreBtn();
      }
    };
    submitBtn.addEventListener('click', doSubmit);
    // Enter pada input tidak boleh me-reload halaman — jalankan alur simpan yang sama
    form.addEventListener('submit', (e) => { e.preventDefault(); doSubmit(); });
    refreshIcons(m.el);
    const first = form.querySelector('input,select,textarea');
    if (first) setTimeout(() => first.focus(), 60);
  });
}

function fieldHtml(f) {
  const req = f.required ? ' <span class="req">*</span>' : '';
  const val = f.value ?? '';
  const full = f.full ? 'full' : '';
  let input = '';
  if (f.type === 'textarea') {
    input = `<textarea name="${f.key}" rows="${f.rows || 4}" placeholder="${esc(f.placeholder || '')}">${esc(val)}</textarea>`;
  } else if (f.type === 'select') {
    const opts = (f.options || []).map((o) => {
      const v = typeof o === 'object' ? o.value : o; const l = typeof o === 'object' ? o.label : o;
      return `<option value="${esc(v)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
    }).join('');
    input = `<select name="${f.key}">${opts}</select>`;
  } else if (f.type === 'file') {
    input = `<input type="file" name="${f.key}" ${f.accept ? `accept="${f.accept}"` : ''} />`;
  } else if (f.type === 'checkbox') {
    return `<div class="field ${full}" data-field="${f.key}">
      <label class="field-check" style="font-weight:600"><input type="checkbox" name="${f.key}" ${val ? 'checked' : ''}/> ${esc(f.label)}${req}</label>
      ${f.help ? `<div class="help">${esc(f.help)}</div>` : ''}</div>`;
  } else {
    const type = f.type || 'text';
    input = `<input type="${type}" name="${f.key}" value="${esc(val)}" placeholder="${esc(f.placeholder || '')}" ${f.min ? `min="${f.min}"` : ''} ${type === 'number' && f.step ? `step="${f.step}"` : ''} />`;
  }
  return `<div class="field ${full}" data-field="${f.key}">
    <label>${esc(f.label)}${req}</label>
    ${input}
    ${f.help ? `<div class="help">${esc(f.help)}</div>` : ''}
    <div class="err">Kolom ini wajib diisi.</div>
  </div>`;
}

/* ---------- Badge status ---------- */
export function badge(status, labelOverride = null, cls = null) {
  const s = String(status || '').toLowerCase();
  const c = cls || STATUS_BADGE[s] || 'b-navy';
  const label = labelOverride || String(status || '-').replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
  return `<span class="badge ${c}">${esc(label)}</span>`;
}

/* ---------- Empty state ---------- */
export function emptyState(icon = 'folder-open', title = 'Belum ada data', desc = 'Data akan muncul di sini setelah ditambahkan.') {
  return `<div class="empty-state"><i data-lucide="${icon}"></i><b>${esc(title)}</b><p>${esc(desc)}</p></div>`;
}

export function statCardHtml({ value, label, icon, color = 'var(--navy-600)', clickRoute = null }) {
  return `
  <div class="stat-card" style="--sc:${color}" ${clickRoute ? `data-route="${clickRoute}" role="button" tabindex="0"` : ''}>
    <div class="stat-ic"><i data-lucide="${icon}"></i></div>
    <div><div class="stat-val" data-count>${fmtNum(value)}</div><div class="stat-label">${esc(label)}</div></div>
  </div>`;
}

/* ---------- Pipeline workflow ---------- */
export function pipeline(stages, current, labels) {
  const curIdx = stages.indexOf(current);
  const doneSet = current === 'revisi' ? stages.slice(0, stages.indexOf('diajukan') + 1) : stages.slice(0, curIdx + 1);
  return `<div class="pipeline">${stages.map((s, i) => {
    const done = doneSet.includes(s) && s !== current;
    const isCur = s === current;
    return `<div class="pipe-step ${done ? 'done' : ''} ${isCur ? 'current' : ''}">
      <span class="pipe-dot">${done ? '<i data-lucide="check" style="width:12px;height:12px"></i>' : i + 1}</span>
      <small>${esc(labels[s] || s)}</small></div>`;
  }).join('')}</div>`;
}

/* ---------- Validasi & unggah berkas ---------- */
export function validateFile(file) {
  if (!file) return { ok: true };
  const ext = file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) return { ok: false, msg: `Tipe berkas .${ext} tidak diizinkan. Gunakan: ${ALLOWED_EXT.join(', ')}` };
  if (file.size > MAX_FILE_SIZE) return { ok: false, msg: `Ukuran berkas melebihi batas ${fmtSize(MAX_FILE_SIZE)}.` };
  return { ok: true };
}

/* ---------- Unduh & pratinjau ---------- */
export function downloadUrl(url, filename) {
  const a = document.createElement('a');
  a.href = url; a.download = filename || ''; a.target = '_blank'; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
}

export function previewPdfModal(url, title) {
  modal({
    title: `Pratinjau: ${title}`, icon: 'file-eye', size: 'lg',
    body: `<iframe class="pdf-frame" src="${esc(url)}" title="${esc(title)}"></iframe>`,
    footer: `<button class="btn btn-outline" onclick="window.open('${esc(url)}','_blank','noopener')"><i data-lucide="external-link"></i>Buka di tab baru</button>`,
  });
}

/* ---------- Ekspor laporan ---------- */
function tableToRows(columns, rows) {
  const head = columns.map((c) => c.label);
  const data = rows.map((r) => columns.map((c) => (c.exportValue ? String(c.exportValue(r)) : String(r[c.key] ?? ''))));
  return [head, ...data];
}

export function exportCSV(columns, rows, filename = 'laporan') {
  const rowsAll = tableToRows(columns, rows);
  const csv = rowsAll.map((r) => r.map((v) => `"${v.replaceAll('"', '""')}"`).join(';')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, `${filename}.csv`);
  toast('Laporan CSV berhasil diunduh.', 'success');
}

export function exportXLS(columns, rows, filename = 'laporan', sheetName = 'Laporan') {
  if (!window.XLSX) { toast('Pustaka Excel belum termuat (butuh internet).', 'error'); return; }
  const ws = window.XLSX.utils.aoa_to_sheet(tableToRows(columns, rows));
  ws['!cols'] = columns.map((c) => ({ wch: Math.max(14, Math.min(48, c.label.length + 8)) }));
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 30));
  window.XLSX.writeFile(wb, `${filename}.xlsx`);
  toast('Laporan Excel berhasil diunduh.', 'success');
}

export function exportPDF(columns, rows, filename = 'laporan', { title, subtitle = APP.name } = {}) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) { toast('Pustaka PDF belum termuat (butuh internet).', 'error'); return; }
  const doc = new jsPDF({ orientation: rows.length && columns.length > 6 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  doc.setFillColor(10, 25, 48); doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, 'F');
  doc.setTextColor(201, 162, 39); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text(title || 'Laporan', 12, 10);
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text(subtitle, 12, 16);
  doc.setTextColor(30, 30, 30);
  doc.autoTable({
    head: [columns.map((c) => c.label)],
    body: rows.map((r) => columns.map((c) => (c.exportValue ? c.exportValue(r) : String(r[c.key] ?? '-')))),
    startY: 27, styles: { fontSize: 7.5, cellPadding: 1.6, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 36, 71], textColor: 255, fontSize: 7.5 },
    alternateRowStyles: { fillColor: [243, 246, 250] },
    margin: { left: 12, right: 12 },
  });
  doc.save(`${filename}.pdf`);
  toast('Laporan PDF berhasil diunduh.', 'success');
}

export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  downloadUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------- DataTable: tabel dengan pencarian, filter, paginasi ---------- */
export class DataTable {
  /**
   * opts: {
   *   columns: [{key,label,render?,sortable?}], rows?, fetchData?(filters)->Promise<rows>,
   *   filters: [{key,label,options:[{value,label}], match?}], searchKeys:[], searchPlaceholder,
   *   pageSize, actionsHtml?, rowActions?(row)->html, onRowClick?(row),
   *   emptyIcon?, emptyTitle?, exportName?, exportable?, dense?
   * }
   */
  constructor(container, opts) {
    this.el = typeof container === 'string' ? document.querySelector(container) : container;
    this.opts = opts;
    this.state = { search: '', page: 1, filters: {} };
    (opts.filters || []).forEach((f) => { this.state.filters[f.key] = ''; });
    this.render();
  }

  setRows(rows) { this._rows = rows; this._applyAndPaint(); }

  async render() {
    const o = this.opts;
    const filtersHtml = (o.filters || []).map((f) => `
      <select data-filter="${f.key}" aria-label="${esc(f.label)}">
        <option value="">${esc(f.label)}</option>
        ${(f.options || []).map((op) => `<option value="${esc(op.value)}">${esc(op.label)}</option>`).join('')}
      </select>`).join('');
    this.el.innerHTML = `
      <div class="table-card">
        <div class="dt-toolbar">
          <div class="dt-search"><i data-lucide="search"></i><input type="search" placeholder="${esc(o.searchPlaceholder || 'Cari…')}" aria-label="Cari"/></div>
          <div class="dt-filters">${filtersHtml}</div>
          <div class="dt-actions">${o.actionsHtml || ''}</div>
        </div>
        <div class="table-wrap">
          <table class="data-table"><thead></thead><tbody></tbody></table>
        </div>
        <div class="dt-foot"><span class="info"></span><div class="dt-pager"></div></div>
      </div>`;
    this.tableEl = this.el.querySelector('table');
    this.theadEl = this.tableEl.querySelector('thead');
    this.tbodyEl = this.tableEl.querySelector('tbody');
    this.theadEl.innerHTML = `<tr>${o.columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr>`;
    this.el.querySelector('.dt-search input').addEventListener('input', debounce((e) => {
      this.state.search = e.target.value.toLowerCase().trim(); this.state.page = 1; this._applyAndPaint();
    }, 220));
    this.el.querySelectorAll('[data-filter]').forEach((sel) => {
      sel.addEventListener('change', () => { this.state.filters[sel.dataset.filter] = sel.value; this.state.page = 1; this._applyAndPaint(); });
    });
    this.footInfo = this.el.querySelector('.dt-foot .info');
    this.pagerEl = this.el.querySelector('.dt-pager');

    if (o.fetchData) {
      this.tbodyEl.innerHTML = `<tr><td colspan="${o.columns.length}"><div class="skeleton" style="height:120px;margin:10px"></div></td></tr>`;
      const rows = await o.fetchData(this.state);
      this._rows = rows || [];
    }
    this._applyAndPaint();
    refreshIcons(this.el);
  }

  _filtered() {
    const o = this.opts; let rows = [...(this._rows || [])];
    const s = this.state.search;
    if (s) rows = rows.filter((r) => (o.searchKeys || o.columns.map((c) => c.key)).some((k) => String(r[k] ?? '').toLowerCase().includes(s)));
    for (const [k, v] of Object.entries(this.state.filters)) {
      if (!v) continue;
      const f = (o.filters || []).find((ff) => ff.key === k);
      rows = f && f.match ? rows.filter((r) => f.match(r, v)) : rows.filter((r) => String(r[k] ?? '') === v);
    }
    return rows;
  }

  _applyAndPaint() {
    const o = this.opts;
    const rows = this._filtered();
    const size = o.pageSize || 8;
    const pages = Math.max(1, Math.ceil(rows.length / size));
    if (this.state.page > pages) this.state.page = pages;
    const start = (this.state.page - 1) * size;
    const pageRows = rows.slice(start, start + size);

    if (!pageRows.length) {
      this.tbodyEl.innerHTML = `<tr><td colspan="${o.columns.length}">${emptyState(o.emptyIcon || 'folder-open', o.emptyTitle || 'Belum ada data', 'Tidak ada data yang cocok dengan pencarian atau filter.')}</td></tr>`;
    } else {
      this.tbodyEl.innerHTML = pageRows.map((r) => `
        <tr data-id="${esc(r.id)}" class="${o.onRowClick ? 'row-click' : ''}">
          ${o.columns.map((c) => `<td>${c.render ? c.render(r) : esc(r[c.key] ?? '-')}</td>`).join('')}
        </tr>`).join('');
    }

    const total = rows.length;
    this.footInfo.textContent = total ? `Menampilkan ${start + 1}–${Math.min(start + size, total)} dari ${total} data` : 'Tidak ada data';

    let pager = `<button ${this.state.page <= 1 ? 'disabled' : ''} data-pg="prev"><i data-lucide="chevron-left" style="width:13px;height:13px"></i></button>`;
    for (let p = 1; p <= pages && pages <= 9; p++) pager += `<button class="${p === this.state.page ? 'active' : ''}" data-pg="${p}">${p}</button>`;
    if (pages > 9) {
      pager = `<button ${this.state.page <= 1 ? 'disabled' : ''} data-pg="prev">‹</button>`;
      for (let p = Math.max(1, this.state.page - 2); p <= Math.min(pages, this.state.page + 2); p++) {
        pager += `<button class="${p === this.state.page ? 'active' : ''}" data-pg="${p}">${p}</button>`;
      }
      pager += `<button ${this.state.page >= pages ? 'disabled' : ''} data-pg="next">›</button>`;
    } else {
      pager += `<button ${this.state.page >= pages ? 'disabled' : ''} data-pg="next"><i data-lucide="chevron-right" style="width:13px;height:13px"></i></button>`;
    }
    this.pagerEl.innerHTML = pager;
    this.pagerEl.querySelectorAll('[data-pg]').forEach((b) => b.addEventListener('click', () => {
      const pg = b.dataset.pg;
      if (pg === 'prev') this.state.page = Math.max(1, this.state.page - 1);
      else if (pg === 'next') this.state.page = Math.min(pages, this.state.page + 1);
      else this.state.page = Number(pg);
      this._applyAndPaint(); refreshIcons(this.el);
    }));

    this.tbodyEl.querySelectorAll('.row-click').forEach((tr) => tr.addEventListener('click', () => {
      const row = rows.find((r) => String(r.id) === tr.dataset.id);
      if (row && o.onRowClick) o.onRowClick(row);
    }));
    this.tbodyEl.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = rows.find((r) => String(r.id) === btn.closest('tr').dataset.id);
        const fn = o.rowActionsMap && o.rowActionsMap[btn.dataset.action];
        if (row && fn) fn(row);
      });
    });
    refreshIcons(this.el);
    this.currentRows = rows;
  }
}

export function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ---------- Bentuk ulang aksi baris ---------- */
export function rowIcon(action, icon, title, cls = '') {
  return `<button class="icon-act ${cls}" data-action="${action}" title="${esc(title)}" aria-label="${esc(title)}"><i data-lucide="${icon}"></i></button>`;
}
