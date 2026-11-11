/* ============================================================
   auth.js — Autentikasi: layar login, reset kata sandi,
   pendaftaran akun pertama, dan proteksi berbasis permission.
   ============================================================ */

import { APP, LS_KEYS } from './config.js';
import { authApi, getMode, saveConfig, testConnection, resetDemoData, profile, getSavedConfig, can } from './supabase.js';
import { esc, toast, modal, formModal, refreshIcons } from './ui.js';
import { DEMO_USERS } from './seed-data.js';

let onLoginSuccess = null;

export function setLoginCallback(fn) { onLoginSuccess = fn; }

export async function renderAuthScreen() {
  const root = document.getElementById('auth-root');
  root.hidden = false;
  document.getElementById('app-root').hidden = true;
  const mode = getMode();

  root.innerHTML = `
  <div class="auth-page">
    <div class="auth-brand">
      <div class="auth-logo-row">
        <div class="auth-logo-badge"><i data-lucide="shield-check"></i></div>
        <div><h2>${esc(APP.name)}</h2><span>Sistem Informasi Tata Kelola SDM</span></div>
      </div>
      <h1>Pusat Pengetahuan, Regulasi, dan <em>Tata Kelola SDM</em> Yayasan Pendidikan.</h1>
      <p>Integrasikan seluruh regulasi ketenagakerjaan, peraturan yayasan, kebijakan SDM, SOP, dokumen kepegawaian, formulir, dan referensi resmi dalam satu sistem yang aman dan terkontrol peran.</p>
      <div class="auth-feats">
        <div class="auth-feat"><i data-lucide="scale"></i><span>Regulatory Center — pemantauan status regulasi nasional dan sektoral</span></div>
        <div class="auth-feat"><i data-lucide="folder-lock"></i><span>Keamanan berlapis — RBAC, Row Level Security, dan klasifikasi dokumen</span></div>
        <div class="auth-feat"><i data-lucide="sparkles"></i><span>${esc(APP.assistantName)} — bantu jawab regulasi, buat draft SK & SOP</span></div>
        <div class="auth-feat"><i data-lucide="git-pull-request-arrow"></i><span>Workflow persetujuan dokumen dengan jejak audit</span></div>
      </div>
    </div>
    <div class="auth-panel">
      <div class="auth-card">
        <h3>Masuk ke Sistem</h3>
        <p class="sub">Gunakan akun yang diberikan Super Administrator.</p>
        ${mode !== 'supabase' ? `
        <div class="auth-mode-banner"><i data-lucide="monitor-play"></i>
          <span><b>Mode Demo aktif</b> — data contoh tersimpan di peramban, bukan di server. Untuk penggunaan nyata, hubungkan Supabase pada halaman Pengaturan.</span>
        </div>` : `
        <div class="auth-mode-banner" style="background:var(--success-bg);color:var(--success)"><i data-lucide="check-circle-2"></i>
          <span><b>Terhubung ke Supabase</b> — autentikasi dan data dikelola oleh server Supabase Anda.</span>
        </div>`}
        <form id="login-form" novalidate>
          <div class="field mb-2">
            <label>Email</label>
            <input type="email" name="email" placeholder="nama@yayasan.sch.id" required autocomplete="username"/>
          </div>
          <div class="field mb-2">
            <label>Kata Sandi</label>
            <input type="password" name="password" placeholder="••••••••" required autocomplete="current-password"/>
          </div>
          <button type="submit" class="btn btn-primary btn-block" id="login-btn"><i data-lucide="log-in"></i> Masuk</button>
        </form>
        <div class="flex mt-2 justify-between flex-wrap" style="gap:6px">
          <button class="btn btn-ghost btn-sm" id="forgot-btn"><i data-lucide="key-round"></i> Lupa kata sandi?</button>
          <button class="btn btn-ghost btn-sm" id="config-btn"><i data-lucide="database"></i> Konfigurasi Supabase</button>
        </div>
        ${mode !== 'supabase' ? `
        <div class="demo-accounts">
          <div class="label">Akun Demo (kata sandi: demo1234)</div>
          <div class="demo-chips">
            ${DEMO_USERS.map((u) => `<button class="demo-chip" data-email="${esc(u.email)}" data-pass="${esc(u.password)}" title="${esc(u.full_name)}">${esc(u.email.split('@')[0])}</button>`).join('')}
          </div>
          <div class="flex mt-2">
            <button class="btn btn-outline btn-sm" id="reset-demo" title="Kembalikan data demo ke kondisi awal"><i data-lucide="rotate-ccw"></i> Reset data demo</button>
          </div>
        </div>` : ''}
      </div>
    </div>
  </div>`;
  refreshIcons(root);

  const form = root.querySelector('#login-form');
  const btn = root.querySelector('#login-btn');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || !password) { toast('Isi email dan kata sandi.', 'warning'); return; }
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Memproses…';
    try {
      const { profile: prof } = await authApi.signIn(email, password);
      toast(`Selamat datang, ${prof.full_name}.`, 'success');
      if (onLoginSuccess) await onLoginSuccess();
    } catch (err) {
      toast(err.message, 'error', 'Gagal masuk');
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="log-in"></i> Masuk';
      refreshIcons(root);
    }
  });

  root.querySelector('#forgot-btn').addEventListener('click', async () => {
    try {
      await formModal({
        title: 'Reset Kata Sandi', icon: 'key-round',
        fields: [{ key: 'email', label: 'Email akun', type: 'email', required: true, placeholder: 'nama@yayasan.sch.id', full: true,
          help: getMode() === 'supabase' ? 'Tautan reset akan dikirim melalui email dari Supabase Auth.' : 'Mode demo: gunakan kartu akun demo (kata sandi demo1234).' }],
        submitLabel: 'Kirim Tautan Reset',
        onSubmit: async (v) => { await authApi.resetPassword(v.email); toast('Jika email terdaftar, tautan reset telah dikirim.', 'success'); },
      });
    } catch (err) { toast(err.message, 'warning', 'Mode Demo'); }
  });

  // Kartu akun demo: isi cepat email & kata sandi
  root.querySelectorAll('.demo-chip').forEach((chip) => chip.addEventListener('click', () => {
    form.email.value = chip.dataset.email || '';
    form.password.value = chip.dataset.pass || '';
    form.password.focus();
  }));

  root.querySelector('#config-btn').addEventListener('click', () => openSupabaseConfigModal(() => renderAuthScreen()));
  const resetBtn = root.querySelector('#reset-demo');
  if (resetBtn) resetBtn.addEventListener('click', async () => { resetDemoData(); toast('Data demo dikembalikan ke kondisi awal.', 'success'); renderAuthScreen(); });

  document.title = `Masuk — ${APP.name}`;
}

/* Modal konfigurasi Supabase (dipakai di layar login & halaman Pengaturan) */
export function openSupabaseConfigModal(afterSave) {
  const cfg = getSavedConfig() || { url: '', key: '' };
  modal({
    title: 'Konfigurasi Koneksi Supabase', icon: 'database', size: '',
    body: `
      <div class="notice info"><i data-lucide="info"></i>
        <span>Gunakan <b>Project URL</b> dan <b>Anon/Publishable Key</b> dari Dashboard Supabase (Settings → API). Kunci ini bersifat publik karena keamanan data diatur lewat Row Level Security (RLS). <b>Jangan</b> gunakan Service Role Key di aplikasi.</span>
      </div>
      <form class="form-grid" id="cfg-form">
        <div class="field full" data-field="url">
          <label>Supabase Project URL</label>
          <input name="url" placeholder="https://xxxxx.supabase.co" value="${esc(cfg.url || '')}"/>
        </div>
        <div class="field full" data-field="key">
          <label>Supabase Anon / Publishable Key</label>
          <input name="key" placeholder="eyJhbGciOi…" value="${esc(cfg.key || '')}"/>
        </div>
      </form>
      <div id="cfg-status" class="mt-2"></div>`,
    footer: `<button class="btn btn-outline" data-act="clear">Hapus Koneksi (Mode Demo)</button>
             <button class="btn btn-outline" data-act="test"><i data-lucide="plug-zap"></i> Test Koneksi</button>
             <button class="btn btn-gold" data-act="save"><i data-lucide="save"></i> Simpan & Ulangi Muat</button>`,
    onOpen: (el) => {
      const form = el.querySelector('#cfg-form');
      const status = el.querySelector('#cfg-status');
      el.querySelector('[data-act="test"]').addEventListener('click', async () => {
        const url = form.url.value.trim(), key = form.key.value.trim();
        if (!url || !key) { toast('Isi URL dan kunci terlebih dahulu.', 'warning'); return; }
        status.innerHTML = '<div class="flex"><span class="spinner" style="border-color:var(--navy-100);border-top-color:var(--navy-600)"></span> Menguji koneksi…</div>';
        const r = await testConnection(url, key);
        const st = (s) => s === 'aktif' ? '<span class="badge b-success">Aktif</span>' : `<span class="badge b-danger">${esc(s)}</span>`;
        status.innerHTML = `
          <div class="status-row"><div class="st-ic ${r.auth === 'aktif' ? 'ok' : 'bad'}"><i data-lucide="lock"></i></div>
            <div><b>Authentication ${st(r.auth)}</b><small>Layanan login Supabase (${r.ms} ms)</small></div></div>
          <div class="status-row mt-1"><div class="st-ic ${r.database === 'aktif' ? 'ok' : 'warn'}"><i data-lucide="database"></i></div>
            <div><b>Database ${st(r.database)}</b><small>Tabel profiles terbaca (RLS wajib aktif)</small></div></div>
          <div class="status-row mt-1"><div class="st-ic ${r.storage === 'aktif' ? 'ok' : 'warn'}"><i data-lucide="hard-drive"></i></div>
            <div><b>Storage ${st(r.storage)}</b><small>Bucket dokumen siap digunakan</small></div></div>`;
        refreshIcons(status);
      });
      el.querySelector('[data-act="save"]').addEventListener('click', () => {
        const url = form.url.value.trim(), key = form.key.value.trim();
        if (!url || !key) { toast('Isi URL dan kunci terlebih dahulu.', 'warning'); return; }
        saveConfig(url, key);
        toast('Konfigurasi tersimpan. Halaman dimuat ulang…', 'success');
        setTimeout(() => location.reload(), 700);
      });
      el.querySelector('[data-act="clear"]').addEventListener('click', () => {
        localStorage.removeItem(LS_KEYS.supabase);
        toast('Koneksi dihapus — aplikasi kembali ke Mode Demo.', 'info');
        setTimeout(() => location.reload(), 700);
      });
    },
  });
  if (afterSave) { /* reload menangani pemuatan ulang */ }
}

/* Proteksi: pastikan pengguna punya permission */
export function guard(perm) {
  if (!perm) return true;
  if (!profile()) return false;
  const ok = can(perm);
  if (!ok) toast('Anda tidak memiliki hak akses untuk aksi ini.', 'error', 'Akses ditolak');
  return ok;
}
