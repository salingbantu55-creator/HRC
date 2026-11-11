/* ============================================================
   supabase.js — Lapisan data tunggal aplikasi.
   - Mode "supabase": Supabase Auth + PostgreSQL + Storage (RLS aktif).
   - Mode "demo": adapter lokal untuk evaluasi antarmuka (data contoh).
   Kunci anon/publishable Supabase bersifat publik dan aman di sisi
   klien karena seluruh keamanan diatur lewat Row Level Security.
   SERVICE_ROLE KEY TIDAK PERNAH berada di file frontend ini.
   PENTING: pada mode Supabase, kolom id seluruh tabel bertipe uuid
   dengan default gen_random_uuid() di server — ID TIDAK PERNAH dibuat
   di klien (ID lokal berformat "d-…" hanya untuk penyimpanan demo dan
   akan ditolak Postgres bila terkirim).
   ============================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { LS_KEYS, permsOf } from './config.js';
import { DEMO_SEED, DEMO_USERS, DEMO_PASSWORD } from './seed-data.js';

let sb = null;
let mode = 'demo';
let currentProfile = null;
console.info('[HRKC 1.1.0] supabase.js — id UUID dibuat server (fix "invalid input syntax for type uuid")');

/* ================= Konfigurasi koneksi ================= */
export function getSavedConfig() {
  try { return JSON.parse(localStorage.getItem(LS_KEYS.supabase) || 'null'); }
  catch { return null; }
}
export function saveConfig(url, key) {
  localStorage.setItem(LS_KEYS.supabase, JSON.stringify({ url: url.trim(), key: key.trim() }));
}
export function clearConfig() { localStorage.removeItem(LS_KEYS.supabase); sb = null; mode = 'demo'; }

export function getMode() { return mode; }
export function client() { return sb; }

export async function initBackend() {
  const cfg = getSavedConfig();
  if (cfg && cfg.url && cfg.key) {
    try {
      sb = createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true } });
      const { error } = await sb.auth.getSession();
      if (error && error.message && /Invalid API key|supabase/i.test(error.message)) {
        console.warn('Supabase ditolak, kembali ke mode demo:', error.message);
        sb = null; mode = 'demo';
        return { ok: false, mode, error: error.message };
      }
      mode = 'supabase';
      return { ok: true, mode };
    } catch (e) {
      console.warn('Koneksi Supabase gagal:', e);
      sb = null; mode = 'demo';
      return { ok: false, mode, error: e.message };
    }
  }
  sb = null; mode = 'demo';
  return { ok: true, mode: 'demo' };
}

export async function testConnection(url, key) {
  const t0 = performance.now();
  const res = { auth: '…', database: '…', storage: '…', ms: 0 };
  try {
    const test = createClient(url, key, { auth: { persistSession: false } });
    const { error: authErr } = await test.auth.getSession();
    res.auth = authErr ? 'gagal' : 'aktif';
    const { error: dbErr } = await test.from('profiles').select('id', { count: 'exact', head: true });
    res.database = dbErr ? 'gagal' : 'aktif';
    if (dbErr && /row-level security|permission|not found/i.test(dbErr.message || '')) res.database = dbErr.message.includes('not found') ? 'skema belum dijalankan' : 'terbatas RLS';
    const { error: stErr } = await test.storage.from('documents').list('', { limit: 1 });
    res.storage = stErr ? (stErr.message.includes('Bucket not found') ? 'bucket belum dibuat' : 'gagal') : 'aktif';
    res.ms = Math.round(performance.now() - t0);
    return res;
  } catch (e) {
    res.auth = 'gagal'; res.database = 'gagal'; res.storage = 'gagal'; res.ms = Math.round(performance.now() - t0);
    return res;
  }
}

/* ================= Penyimpanan demo (localStorage) ================= */
let demoDb = null;
let demoFiles = null;

function deepCopy(x) { return JSON.parse(JSON.stringify(x)); }

function loadDemo(force = false) {
  if (!force && localStorage.getItem(LS_KEYS.demoDb)) {
    try {
      demoDb = JSON.parse(localStorage.getItem(LS_KEYS.demoDb));
      demoFiles = JSON.parse(localStorage.getItem(LS_KEYS.demoFiles) || '{}');
      return;
    } catch { /* re-seed */ }
  }
  demoDb = deepCopy(DEMO_SEED);
  demoFiles = {};
  persistDemo();
}
function persistDemo() {
  localStorage.setItem(LS_KEYS.demoDb, JSON.stringify(demoDb));
  localStorage.setItem(LS_KEYS.demoFiles, JSON.stringify(demoFiles));
}
export function resetDemoData() { loadDemo(true); }

function uidLocal() {
  return 'd-' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 12));
}

// UUID kanonik 8-4-4-4-12 heksadesimal — dipakai untuk menyaring ID buatan
// klien sebelum payload dikirim ke Supabase (kolom uuid).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function demoTable(table) {
  loadDemo();
  if (!demoDb[table]) demoDb[table] = [];
  return demoDb[table];
}

function demoMatch(row, opts) {
  const f = opts.filters || {};
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) { if (!v.includes(row[k])) return false; }
    else if (String(row[k]) !== String(v)) return false;
  }
  if (opts.or) {
    const cols = opts.or.split(',').map((s) => s.split('.')[0].trim()).filter(Boolean);
    const q = (opts.searchText || '').toLowerCase();
    if (q && !cols.some((c) => String(row[c] ?? '').toLowerCase().includes(q))) return false;
  }
  return true;
}

function demoList(table, opts = {}) {
  loadDemo();
  let rows = demoTable(table).filter((r) => demoMatch(r, opts));
  if (opts.order) rows.sort((a, b) => {
    const { col, ascending } = opts.order;
    const av = a[col] ?? '', bv = b[col] ?? '';
    const cmp = av > bv ? 1 : av < bv ? -1 : 0;
    return ascending ? cmp : -cmp;
  });
  if (opts.limit) rows = rows.slice(0, opts.limit);
  return deepCopy(rows);
}

/* ================= Auth ================= */
export const authApi = {
  async getSession() {
    if (mode === 'supabase') {
      const { data } = await sb.auth.getSession();
      if (!data.session) return null;
      const { data: prof } = await sb.from('profiles').select('*').eq('id', data.session.user.id).maybeSingle();
      if (prof && prof.is_active === false) { await sb.auth.signOut(); return null; }
      return { user: data.session.user, profile: prof || { id: data.session.user.id, email: data.session.user.email, full_name: data.session.user.email, role: 'pegawai' } };
    }
    const raw = localStorage.getItem(LS_KEYS.demoSession);
    if (!raw) return null;
    const { userId, at } = JSON.parse(raw);
    if (Date.now() - at > 12 * 3600 * 1000) { localStorage.removeItem(LS_KEYS.demoSession); return null; }
    const u = DEMO_USERS.find((x) => x.id === userId);
    if (!u) return null;
    const { password, ...profile } = u;
    return { user: { id: profile.id, email: profile.email }, profile };
  },

  async signIn(email, password) {
    email = email.trim().toLowerCase();
    if (mode === 'supabase') {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(translateAuthError(error.message));
      const { data: prof } = await sb.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
      if (prof && prof.is_active === false) throw new Error('Akun Anda dinonaktifkan. Hubungi Super Administrator.');
      await sb.from('profiles').update({ last_login_at: new Date().toISOString() }).eq('id', data.user.id);
      await logAudit('login', 'profile', data.user.id, {});
      return { user: data.user, profile: prof || { id: data.user.id, email, full_name: email, role: 'pegawai' } };
    }
    const u = DEMO_USERS.find((x) => x.email.toLowerCase() === email);
    if (!u || u.password !== password) throw new Error('Email atau kata sandi salah. Gunakan salah satu akun demo di bawah.');
    const { password: _, ...profile } = u;
    localStorage.setItem(LS_KEYS.demoSession, JSON.stringify({ userId: u.id, at: Date.now() }));
    return { user: { id: u.id, email: u.email }, profile };
  },

  async signUp(email, password, fullName) {
    if (mode === 'supabase') {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
      if (error) throw new Error(translateAuthError(error.message));
      return data;
    }
    throw new Error('Pendaftaran mandiri hanya tersedia pada mode Supabase. Mode demo menggunakan akun contoh.');
  },

  async signOut() {
    if (mode === 'supabase') { await logAudit('logout', 'profile', currentProfile?.id, {}); await sb.auth.signOut(); }
    localStorage.removeItem(LS_KEYS.demoSession);
    currentProfile = null;
  },

  async resetPassword(email) {
    if (mode === 'supabase') {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (error) throw new Error(translateAuthError(error.message));
      return true;
    }
    throw new Error('Mode demo: reset kata sandi dilakukan dengan menekan kartu akun demo (kata sandi demo1234).');
  },

  async changePassword(newPassword) {
    if (mode === 'supabase') {
      const { error } = await sb.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
      return true;
    }
    throw new Error('Mode demo: fitur ganti kata sandi tersedia pada mode Supabase.');
  },
};

function translateAuthError(msg) {
  const m = String(msg).toLowerCase();
  if (m.includes('invalid login')) return 'Email atau kata sandi salah.';
  if (m.includes('email not confirmed')) return 'Email belum dikonfirmasi. Periksa kotak masuk Anda.';
  if (m.includes('rate limit')) return 'Terlalu banyak percobaan. Tunggu beberapa lalu coba lagi.';
  if (m.includes('user already registered')) return 'Email sudah terdaftar.';
  if (m.includes('password should be')) return 'Kata sandi minimal 6 karakter.';
  if (m.includes('unable to validate email')) return 'Format email tidak valid.';
  return msg;
}

export function profile() { return currentProfile; }
export function setProfile(p) { currentProfile = p; }
export function myRole() { return currentProfile?.role || 'guest'; }
export function can(perm) {
  if (!currentProfile) return false;
  if (currentProfile.role === 'super_admin') return true;
  return permsOf(currentProfile.role).includes(perm);
}

export async function refreshProfile() {
  if (mode === 'supabase' && currentProfile) {
    const { data } = await sb.from('profiles').select('*').eq('id', currentProfile.id).maybeSingle();
    if (data) currentProfile = data;
  }
  return currentProfile;
}

/* ================= API data (db) ================= */
function parseSearch(orExpr, text) {
  // orExpr contoh: "title.ilike.*abc*,number.ilike.*abc*"
  return { or: orExpr, searchText: text };
}

export const db = {
  async list(table, opts = {}) {
    if (mode === 'supabase') {
      const { select = '*', filters = {}, order = null, limit = null, or = null, searchText = null } = opts;
      let q = sb.from(table).select(select);
      for (const [k, v] of Object.entries(filters)) {
        if (v === undefined || v === null || v === '') continue;
        q = Array.isArray(v) ? q.in(k, v) : q.eq(k, v);
      }
      if (or) q = q.or(or);
      if (order) q = q.order(order.col, { ascending: order.ascending !== false });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw new Error(dbErr(error));
      return data || [];
    }
    return demoList(table, opts);
  },

  async get(table, id) {
    if (mode === 'supabase') {
      const { data, error } = await sb.from(table).select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(dbErr(error));
      return data;
    }
    return deepCopy(demoTable(table).find((r) => r.id === id) || null);
  },

  async count(table, filters = {}) {
    const rows = await this.list(table, { select: 'id', filters, limit: 10000 });
    return rows.length;
  },

  async insert(table, row, opts = {}) {
    const now = new Date().toISOString();
    if (mode === 'supabase') {
      // id uuid dibuat server (gen_random_uuid) — klien TIDAK mengirim id.
      // Bila ada id bawaan dari pemanggil yang bukan UUID valid (sisa mode
      // demo), buang agar Postgres yang menentukan.
      const payload = { created_at: now, updated_at: now, ...row };
      if (payload.id !== undefined && !UUID_RE.test(String(payload.id))) delete payload.id;
      const { data, error } = await sb.from(table).insert(payload).select(opts.select || '*').single();
      if (error) throw new Error(dbErr(error));
      return data;
    }
    const payload = { id: uidLocal(), created_at: now, updated_at: now, ...row };
    loadDemo();
    demoTable(table).push(payload);
    persistDemo();
    return deepCopy(payload);
  },

  async insertMany(table, rows) {
    if (!rows.length) return [];
    const now = new Date().toISOString();
    if (mode === 'supabase') {
      const payloads = rows.map((r) => {
        const p = { created_at: now, updated_at: now, ...r };
        if (p.id !== undefined && !UUID_RE.test(String(p.id))) delete p.id;
        return p;
      });
      const { data, error } = await sb.from(table).insert(payloads).select('*');
      if (error) throw new Error(dbErr(error));
      return data;
    }
    const payloads = rows.map((r) => ({ id: uidLocal(), created_at: now, updated_at: now, ...r }));
    loadDemo();
    demoTable(table).push(...payloads);
    persistDemo();
    return deepCopy(payloads);
  },

  async update(table, id, patch) {
    const payload = { ...patch, updated_at: new Date().toISOString() };
    if (mode === 'supabase') {
      const { data, error } = await sb.from(table).update(payload).eq('id', id).select('*').single();
      if (error) throw new Error(dbErr(error));
      return data;
    }
    loadDemo();
    const row = demoTable(table).find((r) => r.id === id);
    if (!row) throw new Error('Data tidak ditemukan.');
    Object.assign(row, payload);
    persistDemo();
    return deepCopy(row);
  },

  async remove(table, id) {
    if (mode === 'supabase') {
      const { error } = await sb.from(table).delete().eq('id', id);
      if (error) throw new Error(dbErr(error));
      return true;
    }
    loadDemo();
    const t = demoTable(table);
    const idx = t.findIndex((r) => r.id === id);
    if (idx >= 0) t.splice(idx, 1);
    persistDemo();
    return true;
  },

  /* ---------- Storage ---------- */
  bucketOf(path) { return String(path || '').split('/')[0] || 'documents'; },

  async upload(path, file) {
    if (mode === 'supabase') {
      const bucket = this.bucketOf(path);
      const { error } = await sb.storage.from(bucket).upload(path.replace(`${bucket}/`, ''), file, { upsert: true });
      if (error) throw new Error('Unggah gagal: ' + error.message);
      return path;
    }
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        loadDemo();
        demoFiles[path] = { name: file.name, type: file.type, size: file.size, dataUrl: fr.result };
        persistDemo();
        resolve(path);
      };
      fr.onerror = () => reject(new Error('Gagal membaca berkas.'));
      fr.readAsDataURL(file);
    });
  },

  async fileUrl(path, expiresIn = 600) {
    if (!path) return null;
    if (mode === 'supabase') {
      const bucket = this.bucketOf(path);
      const { data, error } = await sb.storage.from(bucket).createSignedUrl(path.replace(`${bucket}/`, ''), expiresIn);
      if (error) throw new Error('Gagal membuat tautan berkas: ' + error.message);
      return data.signedUrl;
    }
    loadDemo();
    const f = demoFiles[path];
    return f ? f.dataUrl : null;
  },

  async removeFile(path) {
    if (!path) return;
    if (mode === 'supabase') {
      const bucket = this.bucketOf(path);
      await sb.storage.from(bucket).remove([path.replace(`${bucket}/`, '')]);
      return;
    }
    loadDemo(); delete demoFiles[path]; persistDemo();
  },

  /* ---------- Log & notifikasi ---------- */
  async logAccess(parentType, parentId, action, userName) {
    await this.insert('document_access_logs', {
      parent_type: parentType, parent_id: parentId, action,
      user_name: userName || currentProfile?.full_name || 'Pengguna',
      user_id: currentProfile?.id || null,
    });
  },

  async logAudit(action, entityType, entityId, details) {
    try {
      await this.insert('audit_logs', {
        user_id: currentProfile?.id || null,
        user_name: currentProfile?.full_name || 'Sistem',
        action, entity_type: entityType, entity_id: entityId || null, details: details || {},
      });
    } catch { /* audit jangan blokir aksi utama */ }
  },

  async notify(userId, title, message, type = 'info', link = null) {
    try {
      await this.insert('notifications', { user_id: userId, title, message, type, link, is_read: false });
    } catch { /* noop */ }
  },

  /* ---------- Pencarian global ---------- */
  async globalSearch(text) {
    const q = text.trim();
    if (q.length < 2) return [];
    const like = `%${q.replace(/[%,()*]/g, '')}%`;
    const types = [
      { table: 'regulations', type: 'regulation', route: 'regulations', cols: 'title.ilike.%*%,number.ilike.%*%', icon: 'scale', typeLabel: 'Regulasi' },
      { table: 'documents', type: 'document', route: 'documents', cols: 'title.ilike.%*%,doc_number.ilike.%*%', icon: 'folder', typeLabel: 'Dokumen' },
      { table: 'policies', type: 'policy', route: 'policies', cols: 'title.ilike.%*%,number.ilike.%*%', icon: 'book-marked', typeLabel: 'Kebijakan' },
      { table: 'sop_documents', type: 'sop', route: 'sop', cols: 'name.ilike.%*%,number.ilike.%*%', icon: 'git-branch', typeLabel: 'SOP', titleKey: 'name' },
      { table: 'templates', type: 'template', route: 'templates', cols: 'name.ilike.%*%,code.ilike.%*%', icon: 'layout-template', typeLabel: 'Template', titleKey: 'name' },
      { table: 'knowledge_articles', type: 'knowledge', route: 'knowledge', cols: 'title.ilike.%*%,summary.ilike.%*%', icon: 'lightbulb', typeLabel: 'Artikel' },
      { table: 'external_links', type: 'link', route: 'links', cols: 'name.ilike.%*%,url.ilike.%*%,description.ilike.%*%', icon: 'globe', typeLabel: 'Referensi', titleKey: 'name' },
    ];
    const results = await Promise.all(types.map(async (t) => {
      try {
        const rows = await this.list(t.table, {
          select: '*', limit: 6,
          or: mode === 'supabase' ? t.cols.replaceAll('%*%', like) : t.cols.replaceAll('%*%', q),
          searchText: q,
        });
        return rows.map((r) => ({
          id: r.id, type: t.type, typeLabel: t.typeLabel, icon: t.icon, route: t.route,
          title: r[t.titleKey || 'title'] || '-', subtitle: r.summary || r.description || r.number || r.code || r.url || '',
          status: r.status || r.verification_status || (r.is_active === true ? 'aktif' : '') || '',
          year: r.year || (r.published_at ? String(r.published_at).slice(0, 4) : ''),
        }));
      } catch { return []; }
    }));
    return results.flat();
  },
};

function dbErr(err) {
  const m = String(err?.message || err || '');
  if (/row-level security/i.test(m)) return 'Akses ditolak oleh kebijakan keamanan (RLS). Klasifikasi dokumen atau role Anda tidak mengizinkan aksi ini.';
  if (/duplicate key/i.test(m)) return 'Data dengan nomor/kode tersebut sudah ada.';
  if (/violates foreign key/i.test(m)) return 'Referensi data tidak valid (relasi tidak ditemukan).';
  if (/invalid input syntax for type uuid/i.test(m)) return 'Format ID data tidak valid (bukan UUID). Perbarui aplikasi ke versi terbaru (assets/js/supabase.js) lalu muat ulang halaman.';
  return m || 'Terjadi kesalahan database.';
}
