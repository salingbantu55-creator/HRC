/* ============================================================
   assistant.js — Modul 10: AI HR Assistant ("Madani HR Assistant")
   Mode Supabase: memanggil Edge Function hr-assistant (Gemini API,
   kunci di server). Mode demo: pencarian lokal atas data contoh
   (RAG sederhana) dengan penanda jelas.
   ============================================================ */

import { APP } from './config.js';
import { db, getMode, profile, client } from './supabase.js';
import { esc, toast, confirmDialog, refreshIcons, badge, fmtDateTime } from './ui.js';

let state = { conversationId: null, messages: [], busy: false };

export async function render(content, params = {}) {
  state = { conversationId: null, messages: [], busy: false };
  const me = profile();

  content.innerHTML = `
  <div class="page-head">
    <div>
      <h2>${esc(APP.assistantName)}</h2>
      <div class="ph-desc">Asisten kecerdasan buatan untuk regulasi, kebijakan, SOP, draft SK, job description, dan instrumen kinerja.</div>
    </div>
    <div class="ph-actions"><button class="btn btn-outline" id="new-chat"><i data-lucide="plus"></i> Percakapan Baru</button></div>
  </div>
  <div class="assistant-layout">
    <div class="card conv-list-card">
      <div class="card-head"><h3><i data-lucide="messages-square"></i> Riwayat</h3></div>
      <button class="btn btn-gold btn-sm new-chat-btn" id="new-chat-side"><i data-lucide="plus"></i> Percakapan Baru</button>
      <div id="conv-list" class="mini-list"></div>
    </div>
    <div class="card chat-card">
      <div class="chat-banner"><i data-lucide="shield-alert"></i>
        <span>Jawaban diutamakan dari dokumen internal yang terverifikasi. AI <b>tidak mengarang</b> nomor peraturan atau pasal — bila kepastian hukum diperlukan, periksa sumber resmi dan konsultasikan dengan ahli hukum.</span>
      </div>
      <div class="chat-body" id="chat-body">
        <div class="msg ai"><span class="m-avatar"><i data-lucide="sparkles"></i></span>
          <div class="bubble">Selamat datang, <b>${esc(me?.full_name || '')}</b>! Saya ${esc(APP.assistantName)}.
          Saya dapat membantu menjelaskan regulasi ketenagakerjaan, mencari SOP, membuat draft SK/surat, menyusun job description, KPI/IKI, hingga membandingkan dua regulasi.
          Silakan pilih topik di bawah atau ketik pertanyaan Anda.</div></div>
      </div>
      <div class="chat-suggest" id="chat-suggest"></div>
      <div class="chat-input-row">
        <textarea id="chat-input" rows="1" placeholder="Tanyakan tentang regulasi, SOP, kebijakan, atau minta draft dokumen…"></textarea>
        <button class="btn btn-gold" id="chat-send" title="Kirim"><i data-lucide="send"></i></button>
      </div>
    </div>
  </div>`;
  refreshIcons(content);

  const suggest = [
    'Apa perbedaan PKWT dan PKWTT?',
    'Buat draft SK Pengangkatan Guru',
    'Cari SOP penggajian',
    'Jelaskan hak cuti melahirkan',
    'Buat KPI untuk Guru SMA',
    'Bandingkan PP 35/2021 dan PP 36/2021',
    'Bagaimana alur pendaftaran BPJS?',
    'Susun job description kepala sekolah',
  ];
  const sbox = content.querySelector('#chat-suggest');
  sbox.innerHTML = suggest.map((s) => `<button class="chip" data-s="${esc(s)}">${esc(s)}</button>`).join('');
  sbox.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => { content.querySelector('#chat-input').value = b.dataset.s; sendMessage(content); }));

  content.querySelector('#chat-send').addEventListener('click', () => sendMessage(content));
  content.querySelector('#chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(content); }
  });
  content.querySelector('#new-chat').addEventListener('click', () => { state = { conversationId: null, messages: [], busy: false }; render(content, params); });
  content.querySelector('#new-chat-side').addEventListener('click', () => { state = { conversationId: null, messages: [], busy: false }; render(content, params); });

  loadConversations(content);
}

async function loadConversations(content) {
  const list = content.querySelector('#conv-list');
  try {
    const convs = await db.list('ai_conversations', { filters: { user_id: profile()?.id }, order: { col: 'created_at', ascending: false }, limit: 20 });
    list.innerHTML = convs.length ? convs.map((c) => `
      <div class="conv-item ${state.conversationId === c.id ? 'active' : ''}" data-id="${esc(c.id)}"><i data-lucide="message-circle"></i><span>${esc(c.title || 'Percakapan')}</span></div>`).join('')
      : '<div class="empty-state" style="padding:20px"><i data-lucide="message-circle-off"></i><b>Belum ada percakapan</b></div>';
    refreshIcons(list);
    list.querySelectorAll('.conv-item').forEach((el) => el.addEventListener('click', async () => {
      state.conversationId = el.dataset.id;
      const conv = convs.find((c) => c.id === el.dataset.id);
      const msgs = await db.list('ai_messages', { filters: { conversation_id: state.conversationId }, order: { col: 'created_at', ascending: true } });
      state.messages = msgs.map((m) => ({ role: m.role, content: m.content, sources: m.sources }));
      paintMessages(content, conv?.title);
    }));
  } catch { list.innerHTML = '<div class="empty-state" style="padding:20px"><b>Riwayat tidak tersedia</b></div>'; }
}

function paintMessages(content, title) {
  const body = content.querySelector('#chat-body');
  body.innerHTML = state.messages.map((m) => bubbleHtml(m)).join('') || `<div class="msg ai"><span class="m-avatar"><i data-lucide="sparkles"></i></span><div class="bubble">Percakapan baru siap. Silakan tanyakan apa saja tentang SDM yayasan.</div></div>`;
  refreshIcons(body);
  body.scrollTop = body.scrollHeight;
}

function bubbleHtml(m) {
  const src = (m.sources || []).map((s) => `
    <div class="src-item"><i data-lucide="file-check"></i><span>
      <b>${esc(s.title)}</b> ${s.status ? `<span class="badge ${s.status === 'terverifikasi' ? 'b-success' : 'b-warning'}" style="margin-left:4px">${s.status === 'terverifikasi' ? 'Terverifikasi' : 'Perlu Verifikasi'}</span>` : ''}
      ${s.ref ? `<br>${esc(s.ref)}` : ''}
      ${s.url ? `<br><a href="${esc(s.url)}" target="_blank" rel="noopener" style="font-size:.72rem">Sumber resmi</a>` : ''}
    </span></div>`).join('');
  return `<div class="msg ${m.role === 'user' ? 'user' : 'ai'}">
    <span class="m-avatar">${m.role === 'user' ? '<i data-lucide="user"></i>' : '<i data-lucide="sparkles"></i>'}</span>
    <div class="bubble">${esc(m.content).replaceAll('\n', '<br>')}
      ${src ? `<div class="src-list"><b style="font-size:.72rem;color:var(--muted)">DOKUMEN SUMBER</b>${src}</div>` : ''}
    </div></div>`;
}

async function sendMessage(content) {
  if (state.busy) return;
  const input = content.querySelector('#chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = ''; input.style.height = 'auto';
  state.busy = true;

  const body = content.querySelector('#chat-body');
  state.messages.push({ role: 'user', content: text });
  body.insertAdjacentHTML('beforeend', bubbleHtml({ role: 'user', content: text }));
  body.insertAdjacentHTML('beforeend', `<div class="msg ai" id="typing"><span class="m-avatar"><i data-lucide="sparkles"></i></span><div class="bubble"><span class="typing"><span></span><span></span><span></span></span></div></div>`);
  refreshIcons(body);
  body.scrollTop = body.scrollHeight;

  try {
    let answer, sources = [];
    if (getMode() === 'supabase') {
      ({ answer, sources } = await callEdgeFunction(text));
    } else {
      ({ answer, sources } = await localAnswer(text));
    }
    state.messages.push({ role: 'assistant', content: answer, sources });
    document.getElementById('typing')?.remove();
    body.insertAdjacentHTML('beforeend', bubbleHtml({ role: 'assistant', content: answer, sources }));
    refreshIcons(body);
    body.scrollTop = body.scrollHeight;
    await persist(text, answer, sources);
  } catch (e) {
    document.getElementById('typing')?.remove();
    body.insertAdjacentHTML('beforeend', bubbleHtml({ role: 'assistant', content: `Maaf, terjadi kendala: ${e.message}. ${getMode() === 'demo' ? 'Catatan: kemampuan AI penuh tersedia setelah menghubungkan Supabase dan men-deploy Edge Function hr-assistant.' : 'Pastikan Edge Function hr-assistant telah di-deploy dan GEMINI_API_KEY diset pada secrets.'}` }));
    refreshIcons(body);
    body.scrollTop = body.scrollHeight;
  } finally { state.busy = false; }
}

async function persist(userText, answer, sources) {
  try {
    if (!state.conversationId) {
      const conv = await db.insert('ai_conversations', { user_id: profile()?.id, title: userText.slice(0, 60) });
      state.conversationId = conv.id;
    }
    await db.insert('ai_messages', { conversation_id: state.conversationId, role: 'user', content: userText, sources: [] });
    await db.insert('ai_messages', { conversation_id: state.conversationId, role: 'assistant', content: answer, sources });
  } catch { /* riwayat opsional */ }
}

/* ---------- Panggil Edge Function (mode Supabase) ---------- */
async function callEdgeFunction(message) {
  const sb = client();
  const cfg = JSON.parse(localStorage.getItem('hrk_supabase_config') || '{}');
  const { data: sess } = await sb.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error('Sesi tidak ditemukan — silakan login ulang.');
  const res = await fetch(`${cfg.url}/functions/v1/hr-assistant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message, conversation_id: state.conversationId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Edge Function error (${res.status})`);
  }
  return res.json();
}

/* ---------- Mode demo: retrieval lokal atas data contoh ---------- */
async function localAnswer(text) {
  const q = text.toLowerCase();
  const kw = (s) => String(s || '').toLowerCase();
  const score = (row, cols) => cols.reduce((acc, c) => acc + (kw(row[c]).includes(q.slice(0, Math.max(4, q.length - 2))) ? 2 : (q.split(/\s+/).some((w) => w.length > 3 && kw(row[c]).includes(w)) ? 1 : 0)), 0);

  const [regs, pols, sops, tpls, kbs] = await Promise.all([
    db.list('regulations'), db.list('policies'), db.list('sop_documents'), db.list('templates'), db.list('knowledge_articles'),
  ]);

  const regScored = regs.map((r) => ({ r, s: score(r, ['title', 'summary', 'provisions', 'number']) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.r);
  const polScored = pols.map((r) => ({ r, s: score(r, ['title', 'summary', 'content']) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 2).map((x) => x.r);
  const sopScored = sops.map((r) => ({ r, s: score(r, ['name', 'purpose', 'procedure', 'category']) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 2).map((x) => x.r);
  const tplScored = tpls.map((r) => ({ r, s: score(r, ['name', 'description']) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.r);
  const kbScored = kbs.map((r) => ({ r, s: score(r, ['title', 'summary', 'content']) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 2).map((x) => x.r);

  const sources = [
    ...regScored.map((r) => ({ title: `${r.number} — ${r.title}`, status: r.verification_status, ref: `Status: ${r.status}`, url: r.official_url || null })),
    ...polScored.map((r) => ({ title: `${r.number} — ${r.title} (v${r.version})`, status: null, ref: `Kebijakan internal` })),
    ...sopScored.map((r) => ({ title: `${r.number} — ${r.name}`, status: null, ref: `SOP internal` })),
    ...tplScored.map((r) => ({ title: `${r.code} — ${r.name}`, status: null, ref: `Template` })),
    ...kbScored.map((r) => ({ title: r.title, status: null, ref: `Artikel: ${r.author}` })),
  ];

  // Jawaban template berbasis intent sederhana + hasil retrieval
  let answer = '';
  if (/pkwt|pkwtt|kontrak/.test(q)) {
    answer = `Perbedaan inti PKWT dan PKWTT:
1. PKWT (Perjanjian Kerja Waktu Tertentu) dibuat berdasarkan jangka waktu atau selesainya pekerjaan tertentu. Pada yayasan, umumnya untuk guru honorer per tahun ajaran. Total durasi maksimal mengikuti ketentuan PP No. 35 Tahun 2021 (maksimal 5 tahun).
2. PKWTT (Perjanjian Kerja Waktu Tidak Tertentu) tidak memiliki batas waktu, memberi proteksi PHK lebih kuat, hak cuti tahunan, dan keterkaitan dengan jaminan sosial.

Rujukan pada dokumen internal terverifikasi di bawah. Catatan: pastikan total durasi PKWT diperiksa pada naskah konsolidasi terbaru sebelum diterapkan.`;
  } else if (/cuti|izin|melahirkan/.test(q)) {
    answer = `Berdasarkan Pedoman Cuti dan Izin (${polScored[0]?.number || 'HR-POL-004'}) dan SOP Pengajuan Cuti:
- Cuti tahunan: 12 hari kerja.
- Cuti melahirkan: 3 bulan sesuai ketentuan perundang-undangan ketenagakerjaan.
- Pengajuan minimal 3 hari kerja sebelumnya kecuali keadaan darurat.
- Alur: pengajuan → rekomendasi atasan → verifikasi saldo (HRD) → persetujuan pimpinan → pencatatan sistem.

Gunakan Formulir Cuti (TPL-FM-003). Untuk kepastian hukum, rujuk UU Ketenagakerjaan dan peraturan pelaksananya melalui JDIH resmi.`;
  } else if (/sop|prosedur|alur/.test(q)) {
    answer = sopScored.length
      ? `SOP yang relevan dengan pertanyaan Anda:\n${sopScored.map((s) => `- ${s.number}: ${s.name} — ${s.purpose?.slice(0, 90)}`).join('\n')}\n\nBuka modul SOP Center untuk melihat uraian prosedur, flowchart, SLA, dan formulir terkait.`
      : 'Tidak ditemukan SOP yang cocok dengan kata kunci Anda. Coba sebutkan proses kerja, misalnya "rekrutmen", "presensi", atau "pengunduran diri".';
  } else if (/draft|buat|susun.*(sk|surat|kpi|iki|job)/.test(q)) {
    const tpl = tplScored[0];
    answer = `Saya dapat membantu menyusun draf. Berdasarkan template yang tersedia:${tpl ? `\n- ${tpl.code}: ${tpl.name} (v${tpl.version})` : ''}
\nKerangka draf SK Pengangkatan Pegawai:
1. Kop: Yayasan Pendidikan [nama], alamat.
2. Nomor SK dan hal "SURAT KEPUTUSAN ... tentang Pengangkatan [nama/jabatan]".
3. Menimbang, Mengingat (dasar: AD/ART, Pedoman Manajemen SDM, UU 13/2003 sesuai konteks).
4. MEMUTUSKAN: Menetapkan (pertama), Menganugerahkan/Mengangkat (kedua), biaya (ketiga), berlaku sejak tanggal ditetapkan (keempat).
5. Ttd Direktur/Pimpinan berwenang sesuai Matriks Kewenangan, diketahui organ terkait.

Lengkapi nomor SK, nama, dan jabatan sesuai kebutuhan. Pastikan penandatangan berwenang sesuai Matriks Kewenangan Yayasan.`;
  } else if (/bandingkan|perbedaan/.test(q)) {
    answer = `Perbandingan berdasarkan dokumen internal:
${regScored.slice(0, 2).map((r) => `- ${r.number}: ${r.summary?.slice(0, 160)}`).join('\n- ')}

Untuk perbandingan menyeluruh antar dua peraturan, gunakan fitur ini pada mode Supabase (Gemini) atau bandingkan ringkasan masing-masing pada modul Regulatory Center. Verifikasi status keduanya melalui JDIH sebelum dikutip.`;
  } else {
    answer = (regScored.length || polScored.length || sopScored.length || kbScored.length)
      ? `Hasil pencarian pada dokumen internal:\n${[...regScored.slice(0, 2).map((r) => `- Regulasi ${r.number}: ${r.title} (${r.status})`), ...polScored.slice(0, 2).map((p) => `- Kebijakan ${p.number}: ${p.title}`), ...sopScored.slice(0, 2).map((s) => `- SOP ${s.number}: ${s.name}`), ...kbScored.slice(0, 1).map((k) => `- Artikel: ${k.title}`)].join('\n')}\n\nBuka dokumen tersebut dari modul terkait untuk detail lengkap. Untuk analisis lebih dalam, hubungkan Supabase agar ${APP.assistantName} berjalan dengan Gemini penuh.`
      : `Saya belum menemukan dokumen internal yang cocok. Coba kata kunci lain (misalnya "cuti", "PKWT", "BPJS", "penggajian"). Catatan: jawaban analitik penuh tersedia setelah menghubungkan Supabase dan men-deploy Edge Function hr-assistant.`;
  }
  answer += '\n\n⚠️ Disclaimer: jawaban ini bukan pendapat hukum. Untuk kepastian peraturan yang berlaku, periksa sumber resmi (peraturan.bpk.go.id / JDIH) atau konsultasikan dengan ahli hukum.';
  await new Promise((r) => setTimeout(r, 600)); // efek mengetik
  return { answer, sources };
}
