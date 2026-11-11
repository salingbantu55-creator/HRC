/* ============================================================
   settings.js — Modul Konfigurasi Supabase, status koneksi,
   manajemen pengguna & role, dan panduan singkat.
   ============================================================ */

import { APP, ROLES, PERMISSIONS, ROLE_PERMS } from './config.js';
import { db, getMode, getSavedConfig, testConnection, can, profile } from './supabase.js';
import { esc, toast, formModal, confirmDialog, refreshIcons, fmtDateTime, badge, rowIcon } from './ui.js';
import { openSupabaseConfigModal } from './auth.js';

export async function render(content, params = {}) {
  const cfg = getSavedConfig();
  const me = profile();
  const isAdmin = can('users.manage');

  content.innerHTML = `
  <div class="page-head">
    <div>
      <h2>Pengaturan Sistem</h2>
      <div class="ph-desc">Koneksi Supabase, status layanan, pengelolaan pengguna, dan informasi aplikasi.</div>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-head"><h3><i data-lucide="database"></i> Koneksi Supabase</h3>
        <button class="btn btn-outline btn-sm" id="cfg-edit"><i data-lucide="pencil"></i> Ubah</button></div>
      <div class="card-pad">
        <table class="kv-table">
          <tr><td>Project URL</td><td style="word-break:break-all">${cfg?.url ? esc(cfg.url) : '<span class="text-muted">Belum dikonfigurasi</span>'}</td></tr>
          <tr><td>Anon / Publishable Key</td><td>${cfg?.key ? esc(cfg.key.slice(0, 24)) + '…' : '<span class="text-muted">Belum dikonfigurasi</span>'}</td></tr>
          <tr><td>Mode Aktif</td><td>${getMode() === 'supabase' ? '<span class="badge b-success">Supabase (Produksi)</span>' : '<span class="badge b-warning">Mode Demo (data contoh)</span>'}</td></tr>
          <tr><td>Akun Aktif</td><td>${esc(me?.email || '-')}</td></tr>
        </table>
        <div class="notice info mt-2" style="margin-bottom:0"><i data-lucide="key-round"></i>
          <span>Kunci anon bersifat publik — keamanan diatur oleh RLS. <b>Service Role Key tidak boleh</b> ditempatkan di frontend; gunakan hanya di Supabase Edge Function.</span>
        </div>
        <button class="btn btn-gold mt-2" id="test-conn"><i data-lucide="plug-zap"></i> Test Koneksi</button>
        <div id="conn-status" class="mt-2"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3><i data-lucide="sparkles"></i> AI HR Assistant (Gemini)</h3></div>
      <div class="card-pad">
        <table class="kv-table">
          <tr><td>Mode AI</td><td>${getMode() === 'supabase' ? '<span class="badge b-success">Edge Function siap</span>' : '<span class="badge b-warning">Mode Demo (RAG lokal)</span>'}</td></tr>
          <tr><td>Endpoint</td><td style="word-break:break-all">${cfg?.url ? esc(cfg.url) + '/functions/v1/hr-assistant' : '—'}</td></tr>
        </table>
        <div class="notice gold mt-2" style="margin-bottom:0"><i data-lucide="lightbulb"></i>
          <span>Pemasangan API Key Gemini dilakukan <b>di sisi server</b>: jalankan
          <code>supabase secrets set GEMINI_API_KEY=…</code> lalu deploy fungsi
          <code>supabase functions deploy hr-assistant</code>. Panduan lengkap ada di README (Bagian: Pemasangan API Key Gemini).</span>
        </div>
      </div>
    </div>
  </div>

  <div class="grid-2 mt-2">
    <div class="card">
      <div class="card-head"><h3><i data-lucide="status"></i> Status Layanan</h3>
        <button class="btn btn-outline btn-sm" id="recheck"><i data-lucide="refresh-cw"></i> Periksa Ulang</button></div>
      <div class="card-pad" id="svc-status">
        <div class="status-row"><div class="st-ic ${getMode() === 'supabase' ? 'ok' : 'warn'}"><i data-lucide="lock"></i></div>
          <div><b>Authentication</b><small>${getMode() === 'supabase' ? 'Supabase Auth aktif (email + kata sandi, reset via email)' : 'Mode demo — sesi disimpan lokal'}</small></div></div>
        <div class="status-row mt-1"><div class="st-ic ${getMode() === 'supabase' ? 'ok' : 'warn'}"><i data-lucide="database"></i></div>
          <div><b>Database PostgreSQL</b><small>${getMode() === 'supabase' ? 'Terhubung dengan RLS aktif' : 'Data contoh tersimpan di peramban'}</small></div></div>
        <div class="status-row mt-1"><div class="st-ic ${getMode() === 'supabase' ? 'ok' : 'warn'}"><i data-lucide="hard-drive"></i></div>
          <div><b>Storage</b><small>${getMode() === 'supabase' ? 'Bucket dokumen dengan kebijakan akses' : 'Berkas contoh di peramban (maks 10 MB)'}</small></div></div>
        <div class="status-row mt-1"><div class="st-ic ok"><i data-lucide="shield-check"></i></div>
          <div><b>Audit Trail</b><small>Aktif — aksi penting tercatat pada tabel audit_logs</small></div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3><i data-lucide="info"></i> Informasi Aplikasi</h3></div>
      <div class="card-pad">
        <table class="kv-table">
          <tr><td>Aplikasi</td><td>${esc(APP.name)}</td></tr>
          <tr><td>Versi</td><td>${APP.version}</td></tr>
          <tr><td>Tagline</td><td style="font-size:.8rem">${esc(APP.tagline)}</td></tr>
          <tr><td>Frontend</td><td>HTML5 · CSS3 · JavaScript (ES6 Modules)</td></tr>
          <tr><td>Backend</td><td>Supabase (PostgreSQL, Auth, Storage, Edge Functions)</td></tr>
          <tr><td>AI</td><td>Gemini API melalui Edge Function (kunci di server)</td></tr>
        </table>
      </div>
    </div>
  </div>

  <div class="card mt-2">
    <div class="card-head"><h3><i data-lucide="users"></i> Matriks Hak Akses (RBAC)</h3><span class="chip-tag">${Object.keys(ROLES).length} role</span></div>
    <div class="table-wrap" style="max-height:340px;overflow:auto">
      <table class="data-table" style="min-width:700px">
        <thead><tr><th>Role</th><th>Deskripsi</th><th>Jumlah Hak</th><th>Hak Akses Utama</th></tr></thead>
        <tbody>
          ${Object.entries(ROLES).map(([key, r]) => {
            const perms = key === 'super_admin' ? PERMISSIONS : ROLE_PERMS[key] || [];
            return `<tr><td><span class="cell-main">${esc(r.name)}</span><span class="cell-sub">${esc(key)}</span></td>
              <td style="font-size:.78rem;color:var(--muted)">${esc(r.desc)}</td>
              <td>${key === 'super_admin' ? 'Semua' : perms.length}</td>
              <td><div class="chips">${perms.slice(0, 5).map((p) => `<span class="chip-tag" style="font-size:.66rem">${esc(p)}</span>`).join('')}${perms.length > 5 ? `<span class="chip-tag" style="font-size:.66rem">+${perms.length - 5}</span>` : ''}</div></td></tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>

  ${isAdmin ? `
  <div class="card mt-2">
    <div class="card-head"><h3><i data-lucide="user-cog"></i> Manajemen Pengguna &amp; Role</h3>
      <span class="chip-tag">Hanya Super Administrator</span></div>
    <div id="users-table"></div>
  </div>` : ''}

  <div class="card mt-2">
    <div class="card-head"><h3><i data-lucide="server"></i> Panduan Penyebaran Singkat</h3></div>
    <div class="card-pad" style="font-size:.86rem;line-height:1.8">
      <b>1. Supabase:</b> buat project → jalankan <code>schema.sql</code> → <code>policies.sql</code> → <code>seed.sql</code> (folder supabase/).<br/>
      <b>2. Koneksi:</b> salin Project URL &amp; Anon Key ke tombol "Ubah" di kartu Koneksi Supabase.<br/>
      <b>3. Admin pertama:</b> buat akun di Dashboard Supabase (Authentication → Add user) lalu promosikan:
      <code>UPDATE profiles SET role='super_admin' WHERE email='email-anda';</code><br/>
      <b>4. AI:</b> <code>supabase secrets set GEMINI_API_KEY=…</code> → <code>supabase functions deploy hr-assistant</code>.<br/>
      <b>5. Deployment:</b> unggah ke GitHub → hubungkan ke Vercel (static). Panduan lengkap di README.
    </div>
  </div>`;
  refreshIcons(content);

  content.querySelector('#cfg-edit').addEventListener('click', () => openSupabaseConfigModal());
  content.querySelector('#test-conn').addEventListener('click', async () => {
    if (!cfg?.url || !cfg?.key) { toast('Konfigurasi belum diisi.', 'warning'); return; }
    const st = content.querySelector('#conn-status');
    st.innerHTML = '<div class="flex"><span class="spinner" style="border-color:var(--navy-100);border-top-color:var(--navy-600)"></span> Menguji…</div>';
    const r = await testConnection(cfg.url, cfg.key);
    st.innerHTML = `
      <div class="status-row"><div class="st-ic ${r.auth === 'aktif' ? 'ok' : 'bad'}"><i data-lucide="lock"></i></div><div><b>Authentication: ${esc(r.auth)}</b><small>${r.ms} ms</small></div></div>
      <div class="status-row mt-1"><div class="st-ic ${r.database === 'aktif' ? 'ok' : 'warn'}"><i data-lucide="database"></i></div><div><b>Database: ${esc(r.database)}</b><small>Tabel profiles</small></div></div>
      <div class="status-row mt-1"><div class="st-ic ${r.storage === 'aktif' ? 'ok' : 'warn'}"><i data-lucide="hard-drive"></i></div><div><b>Storage: ${esc(r.storage)}</b><small>Bucket documents</small></div></div>`;
    refreshIcons(st);
    toast('Pengujian koneksi selesai.', 'success');
  });
  content.querySelector('#recheck').addEventListener('click', () => render(content, params));

  if (isAdmin) await renderUsers(content);
}

async function renderUsers(content) {
  const wrap = content.querySelector('#users-table');
  if (!wrap) return;
  const users = await db.list('profiles', { order: { col: 'created_at', ascending: false } }).catch(() => []);
  wrap.innerHTML = `<div class="table-wrap"><table class="data-table" style="min-width:640px">
    <thead><tr><th>Pengguna</th><th>Email</th><th>Unit</th><th>Role</th><th>Status</th><th>Login Terakhir</th><th>Aksi</th></tr></thead>
    <tbody>
      ${users.length ? users.map((u) => `<tr>
        <td class="cell-main">${esc(u.full_name)}</td>
        <td>${esc(u.email)}</td>
        <td>${esc(u.unit || '-')}</td>
        <td><select data-role="${esc(u.id)}" style="border:1px solid var(--border);border-radius:8px;padding:5px 8px;background:var(--surface);font-size:.78rem">
          ${Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
        </select></td>
        <td>${badge(u.is_active ? 'aktif' : 'nonaktif')}</td>
        <td style="font-size:.76rem">${esc(u.last_login_at ? fmtDateTime(u.last_login_at) : '-')}</td>
        <td><div class="row-actions">
          ${rowIcon('toggle', u.is_active ? 'user-x' : 'user-check', u.is_active ? 'Nonaktifkan' : 'Aktifkan', u.is_active ? 'danger' : 'gold')}
        </div></td>
      </tr>`).join('') : `<tr><td colspan="7"><div class="empty-state"><i data-lucide="users"></i><b>Belum ada pengguna</b><p>Buat pengguna lewat Supabase Auth; profil otomatis dibuat oleh trigger.</p></div></td></tr>`}
    </tbody></table></div>`;
  refreshIcons(wrap);

  wrap.querySelectorAll('[data-role]').forEach((sel) => {
    sel.dataset.prev = sel.value;
    sel.addEventListener('change', async () => {
      const id = sel.dataset.role;
      const role = sel.value;
      if (!(await confirmDialog(`Ubah role menjadi "${ROLES[role]?.name}"? Berlaku setelah pengguna login ulang.`, { title: 'Ubah Role' }))) { sel.value = sel.dataset.prev; return; }
      try {
        await db.update('profiles', id, { role });
        await db.logAudit('update_role', 'profile', id, { role });
        sel.dataset.prev = role;
        toast('Role diperbarui.', 'success');
      } catch (e) { toast(e.message, 'error'); sel.value = sel.dataset.prev; }
    });
  });

  wrap.querySelectorAll('[data-action="toggle"]').forEach((b) => b.addEventListener('click', async () => {
    const tr = b.closest('tr');
    const id = tr.querySelector('[data-role]').dataset.role;
    const u = users.find((x) => x.id === id);
    if (u.id === profile().id) { toast('Anda tidak dapat menonaktifkan akun sendiri.', 'warning'); return; }
    if (!(await confirmDialog(`${u.is_active ? 'Nonaktifkan' : 'Aktifkan'} akun ${u.full_name}?`, { danger: u.is_active }))) return;
    try {
      await db.update('profiles', id, { is_active: !u.is_active });
      await db.logAudit('edit', 'profile', id, { note: u.is_active ? 'dinonaktifkan' : 'diaktifkan' });
      toast('Status akun diperbarui.', 'success');
      render(content, { section: 'users' });
    } catch (e) { toast(e.message, 'error'); }
  }));
}
