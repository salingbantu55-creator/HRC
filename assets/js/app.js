/* ============================================================
   app.js — Entry point: bootstrap, shell aplikasi (sidebar,
   header, breadcrumb, pencarian global, notifikasi, tema),
   dan router SPA.
   ============================================================ */

import { APP, LS_KEYS, ROLES, permsOf } from './config.js';
import { authApi, initBackend, getMode, db, profile, setProfile, can } from './supabase.js';
import { esc, toast, refreshIcons, fmtAgo, initials, badge } from './ui.js';
import { renderAuthScreen, setLoginCallback } from './auth.js';

import * as dashboard from './dashboard.js';
import * as regulations from './regulations.js';
import * as legal from './legal.js';
import * as policies from './policies.js';
import * as sop from './sop.js';
import * as documents from './documents.js';
import * as templates from './templates.js';
import * as links from './links.js';
import * as knowledge from './knowledge.js';
import * as assistant from './assistant.js';
import * as workflow from './workflow.js';
import * as monitoring from './monitoring.js';
import * as reports from './reports.js';
import * as settings from './settings.js';

export { roleShort };

const ROUTES = [
  { id: 'dashboard', title: 'Dashboard HR Knowledge Center', short: 'Dashboard', icon: 'layout-dashboard', group: 'Utama', perm: 'dashboard.view', render: dashboard.render },
  { id: 'regulations', title: 'Regulatory Center', short: 'Regulatory Center', icon: 'scale', group: 'Pusat Pengetahuan', perm: 'regulations.view', render: regulations.render },
  { id: 'legal', title: 'Legal & Governance Center', short: 'Legal & Governance', icon: 'landmark', group: 'Pusat Pengetahuan', perm: 'legal.view', render: legal.render },
  { id: 'policies', title: 'HR Policy Center', short: 'Policy Center', icon: 'book-marked', group: 'Pusat Pengetahuan', perm: 'policies.view', render: policies.render },
  { id: 'sop', title: 'SOP Center', short: 'SOP Center', icon: 'git-branch', group: 'Pusat Pengetahuan', perm: 'sop.view', render: sop.render },
  { id: 'documents', title: 'HR Document Library', short: 'Document Library', icon: 'folder-open', group: 'Pusat Pengetahuan', perm: 'documents.view', render: documents.render },
  { id: 'templates', title: 'Template & Form Center', short: 'Template Center', icon: 'layout-template', group: 'Pusat Pengetahuan', perm: 'templates.view', render: templates.render },
  { id: 'links', title: 'HR Reference Links', short: 'Reference Links', icon: 'globe', group: 'Pusat Pengetahuan', perm: 'links.view', render: links.render },
  { id: 'knowledge', title: 'HR Knowledge Base', short: 'Knowledge Base', icon: 'lightbulb', group: 'Pusat Pengetahuan', perm: 'knowledge.view', render: knowledge.render },
  { id: 'assistant', title: `${APP.assistantName}`, short: 'HR Assistant', icon: 'sparkles', group: 'Kecerdasan Buatan', perm: 'assistant.use', render: assistant.render },
  { id: 'workflow', title: 'Document Workflow & Approval', short: 'Workflow Dokumen', icon: 'workflow', group: 'Tata Kelola', perm: 'workflow.view', render: workflow.render },
  { id: 'monitoring', title: 'Regulatory Monitoring', short: 'Monitoring Regulasi', icon: 'radar', group: 'Tata Kelola', perm: 'monitoring.view', render: monitoring.render },
  { id: 'reports', title: 'HR Report Center', short: 'Report Center', icon: 'bar-chart-3', group: 'Tata Kelola', perm: 'reports.view', render: reports.render },
  { id: 'settings', title: 'Pengaturan Sistem', short: 'Pengaturan', icon: 'settings', group: 'Sistem', perm: 'settings.view', render: settings.render },
  { id: 'search', title: 'Hasil Pencarian', short: 'Pencarian', icon: 'search', group: null, perm: null, render: renderSearchPage, hidden: true },
];

let currentRoute = null;
let currentParams = null;
let chartsRegistry = [];

export function registerChart(c) { chartsRegistry.push(c); }
export function destroyCharts() { chartsRegistry.forEach((c) => { try { c.destroy(); } catch { /* noop */ } }); chartsRegistry = []; }

/* ================= Bootstrap ================= */
async function boot() {
  applyTheme(localStorage.getItem(LS_KEYS.theme) || detectTheme());
  document.getElementById('splash').classList.add('splash');
  await initBackend();
  const session = await authApi.getSession();
  if (session && session.profile) {
    setProfile(session.profile);
    hideSplash();
    buildShell();
    const hash = decodeURIComponent(location.hash.replace(/^#\//, '').split('?')[0]) || 'dashboard';
    navigate(hash);
  } else {
    setProfile(null);
    setLoginCallback(async () => {
      const s = await authApi.getSession();
      if (!s || !s.profile) { toast('Sesi tidak valid.', 'error'); return; }
      setProfile(s.profile);
      hideSplash();
      buildShell();
      navigate('dashboard');
    });
    hideSplash();
    await renderAuthScreen();
  }
}

function hideSplash() { const s = document.getElementById('splash'); if (s) s.hidden = true; }

function detectTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme(t) {
  document.documentElement.classList.toggle('dark', t === 'dark');
  localStorage.setItem(LS_KEYS.theme, t);
  const btn = document.getElementById('theme-btn');
  if (btn) btn.innerHTML = `<i data-lucide="${t === 'dark' ? 'sun' : 'moon'}"></i>`;
  refreshIcons(btn);
}

/* ================= Shell ================= */
function buildShell() {
  const prof = profile();
  const appRoot = document.getElementById('app-root');
  appRoot.hidden = false;
  document.getElementById('auth-root').hidden = true;

  const groups = [...new Set(ROUTES.filter((r) => !r.hidden && (!r.perm || can(r.perm))).map((r) => r.group))];
  const sidebarNav = groups.map((g) => {
    const items = ROUTES.filter((r) => !r.hidden && r.group === g && (!r.perm || can(r.perm)));
    return `<div class="nav-group"><div class="nav-group-label">${esc(g)}</div>
      ${items.map((r) => `<button class="nav-item" data-route="${r.id}" title="${esc(r.title)}"><i data-lucide="${r.icon}"></i><span>${esc(r.short)}</span></button>`).join('')}
    </div>`;
  }).join('');

  const modeBanner = getMode() !== 'supabase'
    ? `<button class="nav-item" id="demo-banner" style="margin:6px 12px 0;background:rgba(201,162,39,.12);border:1px dashed rgba(201,162,39,.4);cursor:pointer" title="Klik untuk menghubungkan Supabase"><i data-lucide="monitor-play"></i><span style="font-size:.72rem;line-height:1.3">Mode Demo — data contoh. Klik untuk hubungkan Supabase.</span></button>` : '';

  appRoot.innerHTML = `
  <div class="shell">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-head">
        <div class="sidebar-logo"><i data-lucide="shield-check"></i></div>
        <div class="sidebar-name">HR Knowledge Center<span>Yayasan Pendidikan</span></div>
      </div>
      <nav class="sidebar-nav">${modeBanner}${sidebarNav}</nav>
      <div class="sidebar-foot">
        <div class="ver"><b>${esc(APP.name)}</b> v${APP.version}</div>
        <div class="ver">Pusat Pengetahuan, Regulasi &amp; Tata Kelola SDM</div>
      </div>
    </aside>
    ${getMode() !== 'supabase' ? '<div class="sidebar-backdrop" id="sidebar-backdrop" style="display:none"></div>' : ''}
    <div class="main-col">
      <header class="header">
        <div class="header-left">
          <button class="icon-btn" id="menu-btn" aria-label="Menu"><i data-lucide="menu"></i></button>
          <div class="breadcrumb"><span class="bc-title" id="bc-title">Dashboard</span><span class="bc-path" id="bc-path"></span></div>
        </div>
        <div class="global-search">
          <div class="gs-box"><i data-lucide="search"></i><input id="gs-input" type="search" placeholder="Cari regulasi, dokumen, SOP, template, artikel…" autocomplete="off"/><kbd>Ctrl K</kbd></div>
          <div class="gs-dropdown" id="gs-dropdown" style="display:none"></div>
        </div>
        <div class="header-right">
          ${getMode() !== 'supabase' ? '<button class="icon-btn hide-xs" id="demo-top" title="Mode Demo — hubungkan Supabase"><i data-lucide="monitor-play"></i></button>' : ''}
          <button class="icon-btn" id="theme-btn" title="Ganti tema terang/gelap"><i data-lucide="moon"></i></button>
          <div class="user-menu-wrap" id="notif-wrap">
            <button class="icon-btn" id="notif-btn" title="Notifikasi"><i data-lucide="bell"></i><span class="dot" id="notif-dot" style="display:none"></span></button>
          </div>
          <div class="user-menu-wrap">
            <button class="user-btn" id="user-btn">
              <span class="avatar ${prof.role === 'pembina' ? 'gold' : ''}">${esc(initials(prof.full_name))}</span>
              <span class="u-name">${esc(prof.full_name)}<small>${esc((prof.unit || '').slice(0, 26))}</small></span>
              <i data-lucide="chevron-down" style="width:14px;height:14px;color:var(--muted)"></i>
            </button>
          </div>
        </div>
      </header>
      <main class="content" id="page-content"><div class="page-inner"></div></main>
      <footer class="footer">
        <span>© ${new Date().getFullYear()} ${esc(APP.name)} — Pusat Pengetahuan, Regulasi, dan Tata Kelola SDM Yayasan Pendidikan.</span>
        <span>${getMode() === 'supabase' ? 'Terhubung ke Supabase · RBAC &amp; RLS aktif' : 'Mode Demo (data contoh di peramban)'} · v${APP.version}</span>
      </footer>
    </div>
  </div>`;

  // Navigasi sidebar
  appRoot.querySelectorAll('[data-route]').forEach((btn) => btn.addEventListener('click', () => {
    navigate(btn.dataset.route);
    closeSidebar();
  }));
  const demoBanner = appRoot.querySelector('#demo-banner');
  const demoTop = appRoot.querySelector('#demo-top');
  if (demoBanner) demoBanner.addEventListener('click', () => import('./auth.js').then((m) => m.openSupabaseConfigModal()));
  if (demoTop) demoTop.addEventListener('click', () => import('./auth.js').then((m) => m.openSupabaseConfigModal()));

  // Mobile menu
  const menuBtn = appRoot.querySelector('#menu-btn');
  const sidebar = appRoot.querySelector('#sidebar');
  const backdrop = appRoot.querySelector('#sidebar-backdrop');
  menuBtn.addEventListener('click', () => { sidebar.classList.toggle('open'); if (backdrop) backdrop.style.display = sidebar.classList.contains('open') ? 'block' : 'none'; });
  function closeSidebar() { sidebar.classList.remove('open'); if (backdrop) backdrop.style.display = 'none'; }
  if (backdrop) backdrop.addEventListener('click', closeSidebar);

  // Tema
  appRoot.querySelector('#theme-btn').addEventListener('click', () => {
    const cur = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
    if (currentRoute) refreshCurrent();
  });

  // Pencarian global
  setupGlobalSearch(appRoot);

  // Profil & notifikasi
  setupUserMenu(appRoot);
  setupNotifications(appRoot);

  document.title = APP.name;
  refreshIcons(appRoot);

  window.addEventListener('hashchange', () => {
    const id = decodeURIComponent(location.hash.replace(/^#\//, '').split('?')[0]) || 'dashboard';
    if (ROUTES.some((r) => r.id === id) && id !== currentRoute?.id) navigate(id);
  });
}

/* ================= Router ================= */
export function navigate(routeId, params = {}) {
  const route = ROUTES.find((r) => r.id === routeId);
  if (!route) { navigate('dashboard'); return; }
  if (route.perm && !can(route.perm)) {
    toast('Halaman ini memerlukan hak akses yang tidak Anda miliki.', 'error', 'Akses ditolak');
    location.hash = '#/dashboard';
    return;
  }
  currentRoute = route;
  currentParams = params;
  location.hash = `#/${routeId}`;
  destroyCharts();

  const prof = profile();
  document.querySelectorAll('.nav-item[data-route]').forEach((b) => b.classList.toggle('active', b.dataset.route === routeId));
  document.getElementById('bc-title').textContent = route.title;
  document.getElementById('bc-path').innerHTML = route.group
    ? `<i data-lucide="chevron-right"></i> <span>${esc(route.group)}</span> <i data-lucide="chevron-right"></i> <span>${esc(route.short)}</span> <i data-lucide="chevron-right"></i> <span>${esc(prof.full_name)}</span>`
    : `<i data-lucide="chevron-right"></i> <span>${esc(route.short)}</span>`;
  document.title = `${route.title} — ${APP.name}`;
  refreshIcons(document.querySelector('.breadcrumb'));

  const content = document.querySelector('#page-content .page-inner');
  content.innerHTML = '<div class="skeleton" style="height:220px"></div>';
  Promise.resolve(route.render(content, params))
    .catch((err) => {
      console.error(err);
      content.innerHTML = `<div class="empty-state"><i data-lucide="alert-triangle"></i><b>Gagal memuat halaman</b><p>${esc(err.message || 'Terjadi kesalahan tak terduga.')}</p></div>`;
      refreshIcons(content);
    });
}

export function refreshCurrent() {
  if (currentRoute) navigate(currentRoute.id, currentParams || {});
}
export function currentRouteId() { return currentRoute?.id; }
export function currentParamsRef() { return currentParams || {}; }

/* ================= Pencarian global ================= */
function setupGlobalSearch(appRoot) {
  const input = appRoot.querySelector('#gs-input');
  const dropdown = appRoot.querySelector('#gs-dropdown');
  let busy = false;

  const history = () => JSON.parse(localStorage.getItem(LS_KEYS.searchHistory) || '[]');
  const pushHistory = (q) => {
    const h = history().filter((x) => x !== q);
    h.unshift(q); localStorage.setItem(LS_KEYS.searchHistory, JSON.stringify(h.slice(0, 6)));
  };

  const showIdle = () => {
    const h = history();
    dropdown.innerHTML = `
      ${h.length ? `<div class="gs-group-label">Pencarian terakhir</div><div class="gs-recent">${h.map((q) => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : ''}
      <div class="gs-group-label">Saran pencarian</div><div class="gs-recent">
        ${['PKWT dan PKWTT', 'cuti melahirkan', 'PPh 21 guru', 'SOP rekrutmen', 'BPJS', 'formulir exit interview'].map((q) => `<button class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}
      </div>
      <div class="gs-hint">Tekan <b>Enter</b> untuk melihat semua hasil</div>`;
    dropdown.style.display = 'block';
    dropdown.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { input.value = b.dataset.q; doSearch(b.dataset.q); }));
    dropdown.querySelectorAll('[data-route]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.route)));
  };

  let timer = null;
  const doSearch = async (q) => {
    if (!q || q.length < 2) { showIdle(); return; }
    busy = true;
    dropdown.innerHTML = '<div class="gs-hint"><span class="spinner" style="border-color:var(--border);border-top-color:var(--navy-600)"></span> Mencari…</div>';
    dropdown.style.display = 'block';
    try {
      const results = await db.globalSearch(q);
      if (!results.length) {
        dropdown.innerHTML = `<div class="gs-hint">Tidak ditemukan hasil untuk “<b>${esc(q)}</b>”.</div>`;
        return;
      }
      const byType = {};
      results.forEach((r) => { (byType[r.typeLabel] = byType[r.typeLabel] || []).push(r); });
      dropdown.innerHTML = Object.entries(byType).map(([type, items]) => `
        <div class="gs-group-label">${esc(type)} (${items.length})</div>
        ${items.slice(0, 4).map((r) => `
          <button class="gs-item" data-route="${r.route}" data-hl="${esc(r.id)}">
            <span class="gs-ic"><i data-lucide="${r.icon}"></i></span>
            <span class="grow"><b>${esc(r.title)}</b><small>${esc(String(r.subtitle).slice(0, 90))}</small></span>
            ${r.status ? badge(r.status) : ''}
          </button>`).join('')}`).join('')
        + `<div class="gs-foot dd-foot"><button class="btn btn-ghost btn-sm" data-all> Lihat semua hasil (Enter)</button></div>`;
      refreshIcons(dropdown);
      dropdown.querySelectorAll('.gs-item').forEach((b) => b.addEventListener('click', () => {
        pushHistory(q); dropdown.style.display = 'none';
        navigate(b.dataset.route, { highlight: b.dataset.hl });
      }));
      const allBtn = dropdown.querySelector('[data-all]');
      if (allBtn) allBtn.addEventListener('click', () => { pushHistory(q); dropdown.style.display = 'none'; navigate('search', { q }); });
    } catch (e) {
      dropdown.innerHTML = `<div class="gs-hint text-danger">${esc(e.message)}</div>`;
    } finally { busy = false; }
  };

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => doSearch(input.value.trim()), 260); });
  input.addEventListener('focus', () => { if (!input.value) showIdle(); else if (!busy) doSearch(input.value.trim()); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim().length >= 2) {
      pushHistory(input.value.trim()); dropdown.style.display = 'none';
      navigate('search', { q: input.value.trim() });
    }
    if (e.key === 'Escape') dropdown.style.display = 'none';
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.global-search')) dropdown.style.display = 'none';
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.focus(); }
  });
}

async function renderSearchPage(content, params) {
  const q = params?.q || '';
  content.innerHTML = `
    <div class="page-head">
      <div><h2>Hasil Pencarian</h2><div class="ph-desc">Kata kunci: <b>“${esc(q)}”</b> — regulasi, dokumen, kebijakan, SOP, template, artikel, dan referensi.</div></div>
    </div>
    <div id="search-results"></div>`;
  const wrap = content.querySelector('#search-results');
  const results = q ? await db.globalSearch(q) : [];
  if (!results.length) {
    wrap.innerHTML = `<div class="card card-pad">${esc('')/* spacer */}<div class="empty-state"><i data-lucide="search-x"></i><b>Tidak ada hasil</b><p>Gunakan kata kunci lain, misalnya nomor regulasi, judul SOP, atau nama formulir.</p></div></div>`;
    refreshIcons(wrap);
    return;
  }
  const groups = {};
  results.forEach((r) => { (groups[r.typeLabel] = groups[r.typeLabel] || []).push(r); });
  wrap.innerHTML = Object.entries(groups).map(([type, items]) => `
    <div class="card mt-2">
      <div class="card-head"><h3><i data-lucide="search"></i>${esc(type)} <span class="text-muted" style="font-weight:500">(${items.length})</span></h3></div>
      <div class="mini-list">
        ${items.map((r) => `<div class="mini-item" data-route="${r.route}" data-hl="${esc(r.id)}" role="button" tabindex="0">
          <span class="mi-ic"><i data-lucide="${r.icon}"></i></span>
          <span class="grow"><b>${esc(r.title)}</b><small>${esc(String(r.subtitle).slice(0, 110))}</small></span>
          <span class="mi-right">${r.status ? badge(r.status) : ''}${r.year ? `<small>${esc(String(r.year))}</small>` : ''}</span>
        </div>`).join('')}
      </div>
    </div>`).join('');
  refreshIcons(wrap);
  wrap.querySelectorAll('.mini-item').forEach((el) => {
    const go = () => navigate(el.dataset.route, { highlight: el.dataset.hl });
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
}

/* ================= Menu pengguna & notifikasi ================= */
function setupUserMenu(appRoot) {
  const prof = profile();
  const btn = appRoot.querySelector('#user-btn');
  const wrap = btn.parentElement;
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    closeDropdowns(wrap);
    const dd = document.createElement('div');
    dd.className = 'dropdown';
    dd.innerHTML = `
      <div class="dd-profile-head">
        <span class="avatar ${prof.role === 'pembina' ? 'gold' : ''}">${esc(initials(prof.full_name))}</span>
        <div><b>${esc(prof.full_name)}</b><small>${esc(prof.email)}</small><span class="role-pill">${esc(roleShort(prof.role))}</span></div>
      </div>
      <button class="dd-menu-item" data-act="profile"><i data-lucide="user-circle"></i> Profil &amp; Hak Akses</button>
      <button class="dd-menu-item" data-act="password"><i data-lucide="key-round"></i> Ganti Kata Sandi</button>
      <button class="dd-menu-item" data-act="settings"><i data-lucide="settings"></i> Pengaturan</button>
      <button class="dd-menu-item danger" data-act="logout"><i data-lucide="log-out"></i> Keluar</button>`;
    wrap.appendChild(dd);
    refreshIcons(dd);

    dd.querySelector('[data-act="profile"]').addEventListener('click', () => { closeDropdowns(); showProfileModal(prof); });
    dd.querySelector('[data-act="password"]').addEventListener('click', () => { closeDropdowns(); changePasswordModal(); });
    dd.querySelector('[data-act="settings"]').addEventListener('click', () => { closeDropdowns(); navigate('settings'); });
    dd.querySelector('[data-act="logout"]').addEventListener('click', async () => {
      closeDropdowns();
      await authApi.signOut();
      location.hash = '';
      location.reload();
    });
  });
}

function roleShort(role) {
  return ({ super_admin: 'Super Admin', pembina: 'Pembina', direktur_pendidikan: 'Direktur Pendidikan', direktur_pelayanan: 'Direktur Pelayanan', manajer_hrd: 'Manajer HRD', kepala_bidang_hrd: 'Kepala Bidang HRD', kepala_sekolah: 'Kepala Sekolah', pegawai: 'Pegawai', guest: 'Guest' })[role] || role;
}

function showProfileModal(prof) {
  const perms = prof.role === 'super_admin' ? ['(Akses penuh seluruh sistem)'] : permsOf(prof.role).map((p) => p.replaceAll('.', ' › ').replace('view', 'Lihat').replace('manage', 'Kelola').replace('create', 'Tambah').replace('edit', 'Ubah').replace('delete', 'Hapus').replace('verify', 'Verifikasi'));
  import('./ui.js').then(({ modal, refreshIcons }) => {
    const m = modal({
      title: 'Profil Pengguna', icon: 'user-circle',
      body: `
        <div class="detail-grid">
          <div class="detail-item"><div class="dt-label">Nama</div><div class="dt-val">${esc(prof.full_name)}</div></div>
          <div class="detail-item"><div class="dt-label">Email</div><div class="dt-val">${esc(prof.email)}</div></div>
          <div class="detail-item"><div class="dt-label">Unit</div><div class="dt-val">${esc(prof.unit || '-')}</div></div>
          <div class="detail-item"><div class="dt-label">Role</div><div class="dt-val">${esc(ROLES[prof.role]?.name || prof.role)}</div></div>
        </div>
        <div class="detail-item full mt-2"><div class="dt-label">Deskripsi Role</div><div class="dt-val">${esc(ROLES[prof.role]?.desc || '-')}</div></div>
        <div class="detail-item full mt-2"><div class="dt-label">Hak Akses (${prof.role === 'super_admin' ? 1 : perms.length})</div>
        <div class="chips mt-1" style="max-height:180px;overflow:auto">${perms.map((p) => `<span class="chip-tag">${esc(p)}</span>`).join('')}</div></div>`,
    });
    refreshIcons(m.el);
  });
}

async function changePasswordModal() {
  const { formModal } = await import('./ui.js');
  const { authApi } = await import('./supabase.js');
  try {
    await formModal({
      title: 'Ganti Kata Sandi', icon: 'key-round',
      fields: [
        { key: 'p1', label: 'Kata sandi baru', type: 'password', required: true, full: true },
        { key: 'p2', label: 'Ulangi kata sandi baru', type: 'password', required: true, full: true, help: getMode() === 'demo' ? 'Catatan: fitur ini hanya aktif ketika terhubung ke Supabase.' : '' },
      ],
      submitLabel: 'Simpan',
      onSubmit: async (v) => {
        if (v.p1 !== v.p2) { toast('Kedua kata sandi tidak sama.', 'error'); return false; }
        if (v.p1.length < 6) { toast('Kata sandi minimal 6 karakter.', 'error'); return false; }
        await authApi.changePassword(v.p1);
        toast('Kata sandi berhasil diganti.', 'success');
      },
    });
  } catch (err) { toast(err.message, 'warning', 'Mode Demo'); }
}

function setupNotifications(appRoot) {
  const btn = appRoot.querySelector('#notif-btn');
  const wrap = btn.parentElement;
  const dot = appRoot.querySelector('#notif-dot');
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    closeDropdowns(wrap);
    let items = [];
    try { items = await db.list('notifications', { filters: { user_id: profile().id }, order: { col: 'created_at', ascending: false }, limit: 15 }); }
    catch { /* demo guest mungkin tanpa notifikasi */ }
    const unread = items.filter((n) => !n.is_read).length;
    if (dot) dot.style.display = unread ? 'block' : 'none';
    const typeIcon = { warning: 'alert-triangle', workflow: 'git-pull-request-arrow', success: 'check-circle-2', info: 'info' };
    const typeColor = { warning: 'var(--warning-bg)', workflow: 'var(--violet-bg)', success: 'var(--success-bg)', info: 'var(--info-bg)' };
    const dd = document.createElement('div');
    dd.className = 'dropdown';
    dd.innerHTML = `
      <div class="dd-head"><b>Notifikasi</b><button class="btn btn-ghost btn-sm" data-mark>Tandai dibaca</button></div>
      <div class="dd-list">${items.length ? items.map((n) => `
        <div class="dd-item ${n.is_read ? '' : 'unread'}" data-id="${esc(n.id)}" data-link="${esc(n.link || '')}">
          <span class="dd-ic" style="background:${typeColor[n.type] || 'var(--surface-3)'}"><i data-lucide="${typeIcon[n.type] || 'info'}"></i></span>
          <span class="grow"><b>${esc(n.title)}</b><p>${esc(n.message)}</p><time>${esc(fmtAgo(n.created_at))}</time></span>
        </div>`).join('') : '<div class="empty-state" style="padding:26px"><i data-lucide="bell-off"></i><b>Tidak ada notifikasi</b><p>Notifikasi workflow dan monitoring akan muncul di sini.</p></div>'}
      </div>`;
    wrap.appendChild(dd);
    refreshIcons(dd);
    dd.querySelector('[data-mark]').addEventListener('click', async () => {
      for (const n of items.filter((x) => !x.is_read)) { try { await db.update('notifications', n.id, { is_read: true }); } catch { /* noop */ } }
      dd.remove(); if (dot) dot.style.display = 'none';
      toast('Semua notifikasi ditandai dibaca.', 'success');
    });
    dd.querySelectorAll('.dd-item').forEach((el) => el.addEventListener('click', async () => {
      const n = items.find((x) => x.id === el.dataset.id);
      if (n && !n.is_read) { try { await db.update('notifications', n.id, { is_read: true }); } catch { /* noop */ } }
      closeDropdowns();
      if (el.dataset.link) { location.hash = el.dataset.link; const id = el.dataset.link.replace('#/', ''); if (ROUTES.some((r) => r.id === id)) navigate(id); }
    }));
  });
}

function closeDropdowns(except = null) {
  document.querySelectorAll('.dropdown').forEach((d) => { if (d !== except) d.remove(); });
}
document.addEventListener('click', () => closeDropdowns());

/* Mulai aplikasi */
boot();
