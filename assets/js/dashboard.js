/* ============================================================
   dashboard.js — Modul 1: Dashboard HR Knowledge Center
   Statistik, grafik pertumbuhan, akses cepat, aktivitas.
   ============================================================ */

import { DOC_CATEGORIES, REG_CATEGORIES } from './config.js';
import { db, can, getMode } from './supabase.js';
import { statCardHtml, esc, refreshIcons, fmtNum, fmtDate, fmtAgo, emptyState, badge } from './ui.js';
import { registerChart, destroyCharts, navigate } from './app.js';

const COLORS = {
  navy: '#0F2447', navy2: '#2A5CA0', gold: '#C9A227', gold2: '#E7C55A',
  grid: 'rgba(120,138,165,.18)', muted: '#5C6B85',
};
function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export async function render(content, params = {}) {
  const [regulations, documents, policies, sops, templates, links, logs, categories, workflows, knowledge] = await Promise.all([
    db.list('regulations'), db.list('documents'), db.list('policies'), db.list('sop_documents'),
    db.list('templates'), db.list('external_links'), db.list('audit_logs', { limit: 300 }),
    db.list('categories'), db.list('workflow_approvals'), db.list('knowledge_articles'),
  ]);

  const now = Date.now();
  const YEAR = 365 * 24 * 3600 * 1000;
  const pendingVerify = [
    ...documents.filter((d) => ['draft', 'diajukan', 'review'].includes(d.status)),
    ...regulations.filter((r) => r.verification_status === 'perlu_verifikasi'),
  ];
  const needUpdate = [
    ...documents.filter((d) => d.valid_until && new Date(d.valid_until).getTime() < now),
    ...regulations.filter((r) => !r.last_checked_at || now - new Date(r.last_checked_at).getTime() > YEAR),
  ];
  const topDocs = [...documents].sort((a, b) => (b.download_count || 0) - (a.download_count || 0)).slice(0, 6);
  const recentRegs = [...regulations].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
  const recentLogs = [...logs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 7);
  const myWorkflows = workflows.filter((w) => ['review', 'diajukan', 'revisi'].includes(w.stage));

  const stats = [
    { value: regulations.length, label: 'Total Regulasi', icon: 'scale', color: 'var(--navy-600)', route: 'regulations' },
    { value: documents.length, label: 'Dokumen Kepegawaian', icon: 'folder-open', color: 'var(--navy-800)', route: 'documents' },
    { value: sops.length, label: 'Total SOP', icon: 'git-branch', color: 'var(--gold-600)', route: 'sop' },
    { value: policies.length, label: 'Pedoman & Kebijakan', icon: 'book-marked', color: 'var(--info)', route: 'policies' },
    { value: templates.length, label: 'Template & Formulir', icon: 'layout-template', color: 'var(--violet)', route: 'templates' },
    { value: links.length, label: 'Referensi Eksternal', icon: 'globe', color: 'var(--success)', route: 'links' },
    { value: categories.filter((c) => c.type === 'document').length, label: 'Kategori Dokumen', icon: 'tags', color: 'var(--warning)', route: 'documents' },
    { value: pendingVerify.length, label: 'Menunggu Verifikasi', icon: 'badge-check', color: 'var(--danger)', route: 'monitoring' },
    { value: needUpdate.length, label: 'Perlu Diperbarui', icon: 'refresh-cw', color: 'var(--warning)', route: 'monitoring' },
  ];

  content.innerHTML = `
  <div class="page-head">
    <div>
      <h2>Dashboard HR Knowledge Center</h2>
      <div class="ph-desc">Ringkasan tata kelola pengetahuan SDM yayasan: regulasi, dokumen, SOP, hingga workflow persetujuan.</div>
    </div>
    <div class="ph-actions">
      ${can('documents.create') ? `<button class="btn btn-gold" data-quick="documents"><i data-lucide="plus"></i> Tambah Dokumen</button>` : ''}
      ${can('regulations.manage') ? `<button class="btn btn-outline" data-quick="regulations"><i data-lucide="plus"></i> Tambah Regulasi</button>` : ''}
      ${can('sop.manage') ? `<button class="btn btn-outline" data-quick="sop"><i data-lucide="plus"></i> Tambah SOP</button>` : ''}
      <button class="btn btn-outline" data-quick="assistant"><i data-lucide="sparkles"></i> AI HR Assistant</button>
    </div>
  </div>

  <div class="stat-grid">${stats.map((s) => statCardHtml(s)).join('')}</div>

  <div class="grid-2">
    <div class="card">
      <div class="card-head"><h3><i data-lucide="trending-up"></i> Pertumbuhan Dokumen (12 Bulan)</h3></div>
      <div class="card-pad"><div class="chart-box"><canvas id="chart-growth"></canvas></div></div>
    </div>
    <div class="card">
      <div class="card-head"><h3><i data-lucide="download"></i> Dokumen Paling Sering Diunduh</h3></div>
      <div class="card-pad"><div class="chart-box"><canvas id="chart-downloads"></canvas></div></div>
    </div>
  </div>

  <div class="grid-2-1 mt-2">
    <div class="card">
      <div class="card-head"><h3><i data-lucide="pie-chart"></i> Komposisi Dokumen per Kategori</h3></div>
      <div class="card-pad"><div class="chart-box"><canvas id="chart-categories"></canvas></div></div>
    </div>
    <div class="card">
      <div class="card-head"><h3><i data-lucide="scale"></i> Regulasi Terbaru</h3>
        <button class="link" data-nav="regulations">Lihat semua</button></div>
      <div class="mini-list">${recentRegs.length ? recentRegs.map((r) => `
        <div class="mini-item" data-nav="regulations" data-hl="${esc(r.id)}" role="button" tabindex="0">
          <span class="mi-ic"><i data-lucide="scale"></i></span>
          <span class="grow"><b>${esc(r.number)}</b><small>${esc(r.title.slice(0, 60))}</small></span>
          <span class="mi-right">${badge(r.verification_status === 'terverifikasi' ? 'berlaku' : 'perlu_verifikasi')}<small>${esc(r.year)}</small></span>
        </div>`).join('') : emptyState('scale', 'Belum ada regulasi')}</div>
    </div>
  </div>

  <div class="grid-2 mt-2">
    <div class="card">
      <div class="card-head"><h3><i data-lucide="badge-check"></i> Menunggu Verifikasi (${pendingVerify.length})</h3>
        <button class="link" data-nav="monitoring">Monitoring</button></div>
      <div class="mini-list">${pendingVerify.length ? pendingVerify.slice(0, 5).map((d) => `
        <div class="mini-item" data-nav="${'doc_number' in d ? 'documents' : 'regulations'}" data-hl="${esc(d.id)}" role="button" tabindex="0">
          <span class="mi-ic" style="background:var(--warning-bg);color:var(--warning)"><i data-lucide="${'doc_number' in d ? 'file-text' : 'scale'}"></i></span>
          <span class="grow"><b>${esc(d.title || d.name)}</b><small>${esc(d.doc_number || d.number || '')}</small></span>
          <span class="mi-right">${badge('perlu_verifikasi', 'Perlu Verifikasi')}</span>
        </div>`).join('') : emptyState('badge-check', 'Semua terverifikasi', 'Tidak ada dokumen yang menunggu verifikasi.')}</div>
    </div>
    <div class="card">
      <div class="card-head"><h3><i data-lucide="history"></i> Aktivitas Pengguna Terbaru</h3>
        <button class="link" data-nav="reports">Laporan</button></div>
      <div class="mini-list">${recentLogs.length ? recentLogs.map((l) => `
        <div class="mini-item" style="cursor:default">
          <span class="mi-ic"><i data-lucide="${logIcon(l.action)}"></i></span>
          <span class="grow"><b>${esc(l.user_name || 'Sistem')}</b><small>${esc(logLabel(l.action, l.entity_type, l.details))}</small></span>
          <span class="mi-right"><small>${esc(fmtAgo(l.created_at))}</small></span>
        </div>`).join('') : emptyState('history', 'Belum ada aktivitas')}</div>
    </div>
  </div>

  <div class="grid-2 mt-2">
    <div class="card">
      <div class="card-head"><h3><i data-lucide="workflow"></i> Workflow Menunggu Tindakan (${myWorkflows.length})</h3>
        <button class="link" data-nav="workflow">Workflow</button></div>
      <div class="mini-list">${myWorkflows.length ? myWorkflows.map((w) => `
        <div class="mini-item" data-nav="workflow" role="button" tabindex="0">
          <span class="mi-ic"><i data-lucide="git-pull-request-arrow"></i></span>
          <span class="grow"><b>${esc(w.title)}</b><small>${esc(w.requester_name)} · ${esc(w.stage)}</small></span>
          <span class="mi-right">${badge(w.stage === 'revisi' ? 'revisi' : 'menunggu')}</span>
        </div>`).join('') : emptyState('workflow', 'Tidak ada workflow aktif', 'Tidak ada dokumen yang sedang dalam proses persetujuan.')}</div>
    </div>
    <div class="card">
      <div class="card-head"><h3><i data-lucide="refresh-cw"></i> Perlu Diperbarui (${needUpdate.length})</h3></div>
      <div class="mini-list">${needUpdate.length ? needUpdate.slice(0, 5).map((d) => `
        <div class="mini-item" data-nav="${'doc_number' in d ? 'documents' : 'regulations'}" data-hl="${esc(d.id)}" role="button" tabindex="0">
          <span class="mi-ic" style="background:var(--danger-bg);color:var(--danger)"><i data-lucide="alert-triangle"></i></span>
          <span class="grow"><b>${esc(d.title || d.name || d.number)}</b><small>${d.valid_until ? 'Kedaluwarsa: ' + esc(fmtDate(d.valid_until)) : 'Pemeriksaan > 1 tahun'}</small></span>
          <span class="mi-right">${badge('revisi', 'Perlu Tinjau')}</span>
        </div>`).join('') : emptyState('check-circle-2', 'Semua mutakhir', 'Tidak ada dokumen yang kedaluwarsa atau perlu tinjauan.')}</div>
    </div>
  </div>

  <div class="card mt-2">
    <div class="card-head"><h3><i data-lucide="zap"></i> Akses Cepat</h3></div>
    <div class="card-pad"><div class="quick-grid">
      <button class="quick-btn" data-quick="documents"><i data-lucide="file-plus-2"></i>Tambah Dokumen</button>
      <button class="quick-btn" data-quick="regulations"><i data-lucide="scale"></i>Tambah Regulasi</button>
      <button class="quick-btn" data-quick="sop"><i data-lucide="git-branch"></i>Tambah SOP</button>
      <button class="quick-btn" data-quick="templates"><i data-lucide="layout-template"></i>Tambah Template</button>
      <button class="quick-btn" data-quick="search"><i data-lucide="search"></i>Cari Dokumen</button>
      <button class="quick-btn gold" data-quick="assistant"><i data-lucide="sparkles"></i>AI HR Assistant</button>
    </div></div>
  </div>`;

  refreshIcons(content);

  // Interaksi
  content.querySelectorAll('[data-nav]').forEach((el) => el.addEventListener('click', () => navigate(el.dataset.nav, { highlight: el.dataset.hl || undefined })));
  content.querySelectorAll('.stat-card[data-route]').forEach((el) => el.addEventListener('click', () => navigate(el.dataset.route)));
  content.querySelectorAll('[data-quick]').forEach((btn) => btn.addEventListener('click', () => handleQuick(btn.dataset.quick)));

  renderCharts(documents);
}

function handleQuick(target) {
  if (target === 'search') {
    const inp = document.getElementById('gs-input');
    if (inp) inp.focus();
    return;
  }
  navigate(target, { action: 'add' });
}

function logIcon(action) {
  const map = { upload: 'upload', create: 'plus-circle', edit: 'pencil', delete: 'trash-2', download: 'download', view: 'eye', login: 'log-in', logout: 'log-out', publish: 'send', verify: 'badge-check', submit_review: 'send', request_revision: 'message-square-warning', verify_link: 'link', update_role: 'users' };
  return map[action] || 'activity';
}
function logLabel(action, entity, details = {}) {
  const ent = { document: 'dokumen', regulation: 'regulasi', policy: 'kebijakan', workflow: 'workflow', profile: 'profil', knowledge: 'artikel', external_link: 'referensi', sop: 'SOP', template: 'template' }[entity] || entity;
  const actMap = { upload: 'mengunggah', create: 'menambahkan', edit: 'mengubah', delete: 'menghapus', download: 'mengunduh', view: 'melihat', login: 'masuk', logout: 'keluar', publish: 'mempublikasikan', verify: 'memverifikasi', submit_review: 'mengajukan review', request_revision: 'meminta revisi', verify_link: 'memverifikasi', update_role: 'memperbarui role' };
  const title = details.title ? `: ${String(details.title).slice(0, 40)}` : '';
  return `${actMap[action] || action} ${ent}${title}`;
}

function renderCharts(documents) {
  if (!window.Chart) return;
  const textCol = cssVar('--muted', COLORS.muted);
  const gridCol = cssVar('--border', COLORS.grid);
  const navy = cssVar('--navy-600', COLORS.navy2);

  // Pertumbuhan dokumen 12 bulan
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }), n: 0 });
  }
  documents.forEach((d) => {
    const k = String(d.created_at || '').slice(0, 7);
    const m = months.find((x) => x.key === k);
    if (m) m.n++;
  });
  registerChart(new window.Chart(document.getElementById('chart-growth'), {
    type: 'line',
    data: { labels: months.map((m) => m.label), datasets: [{ label: 'Dokumen baru', data: months.map((m) => m.n), borderColor: navy, backgroundColor: 'rgba(42,92,160,.14)', fill: true, tension: .35, pointRadius: 3, borderWidth: 2 }] },
    options: chartOpts(textCol, gridCol, { legend: false }),
  }));

  // Top unduhan
  const top = [...documents].sort((a, b) => (b.download_count || 0) - (a.download_count || 0)).slice(0, 7);
  registerChart(new window.Chart(document.getElementById('chart-downloads'), {
    type: 'bar',
    data: { labels: top.map((d) => (d.title || '').slice(0, 26)), datasets: [{ label: 'Unduhan', data: top.map((d) => d.download_count || 0), backgroundColor: monthsColors(), borderRadius: 6, maxBarThickness: 26 }] },
    options: { ...chartOpts(textCol, gridCol, { legend: false }), indexAxis: 'y', scales: { x: { grid: { color: gridCol }, ticks: { color: textCol, precision: 0 } }, y: { grid: { display: false }, ticks: { color: textCol, font: { size: 10 } } } } },
  }));

  // Komposisi kategori
  const byCat = {};
  documents.forEach((d) => { const c = DOC_CATEGORIES.find((x) => x.value === d.category); byCat[c ? c.label : d.category] = (byCat[c ? c.label : d.category] || 0) + 1; });
  registerChart(new window.Chart(document.getElementById('chart-categories'), {
    type: 'doughnut',
    data: { labels: Object.keys(byCat), datasets: [{ data: Object.values(byCat), backgroundColor: monthsColors(14), borderWidth: 2, borderColor: cssVar('--surface', '#fff') }] },
    options: chartOpts(textCol, gridCol, { legend: true, pos: 'right' }),
  }));
}

function monthsColors(n = 12) {
  const base = ['#1E4A80', '#2A5CA0', '#C9A227', '#D9B44A', '#16345E', '#15803D', '#6D28D9', '#B45309', '#0F2447', '#E7C55A', '#1D4ED8', '#DC2626'];
  return base.slice(0, n);
}
function chartOpts(textCol, gridCol, { legend = true, pos = 'bottom' } = {}) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: legend ? { position: pos, labels: { color: textCol, boxWidth: 12, font: { size: 11 } } } : { display: false },
      tooltip: { backgroundColor: 'rgba(10,25,48,.92)', titleColor: '#fff', bodyColor: '#DCE6F5', padding: 10 },
    },
    scales: legend === false ? {
      x: { grid: { color: gridCol }, ticks: { color: textCol, font: { size: 10 } } },
      y: { beginAtZero: true, grid: { color: gridCol }, ticks: { color: textCol, precision: 0 } },
    } : undefined,
  };
}
