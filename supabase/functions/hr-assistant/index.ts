// ============================================================================
// Supabase Edge Function — hr-assistant (Madani HR Assistant)
// ----------------------------------------------------------------------------
// 1) Kunci API Gemini TIDAK PERNAH berada di frontend. Simpan sebagai secret:
//      supabase secrets set GEMINI_API_KEY=your_gemini_api_key
//    (opsional) GEMINI_MODEL default: gemini-3.5-flash-lite.
//    PENTING: model lama (gemini-1.5, gemini-2.0, dst.) sudah dimatikan Google
//    dan menjadi penyebab paling umum error 404. Fungsi ini otomatis mencoba
//    model aktif berikutnya bila model yang dipilih sudah tidak tersedia.
// 2) Deploy:
//      supabase functions deploy hr-assistant
// 3) Pemanggilan dari frontend memakai access token pengguna (Authorization:
//    Bearer <jwt>) sehingga hanya pengguna terautentikasi yang dapat mengakses.
// ----------------------------------------------------------------------------
// Fitur:
// - Verifikasi identitas pengguna (JWT) — guest/anon ditolak.
// - RAG dasar: mengambil konteks dari tabel internal (regulations, policies,
//   sop_documents, templates, knowledge_articles) berdasarkan kata kunci.
// - Prompt sistem anti-halusinasi: dilarang mengarang nomor peraturan/pasal,
//   wajib menyebut status verifikasi sumber, wajib disclaimer.
// - Data personal pegawai TIDAK dimasukkan ke konteks AI.
// - Menyimpan percakapan ke ai_conversations / ai_messages.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM_PROMPT = `Anda adalah "Madani HR Assistant", asisten kecerdasan buatan resmi dari HR Knowledge Center Yayasan Pendidikan.

ATURAN WAJIB (pelanggaran berarti jawaban ditolak):
1. UTAMAKAN KONTEKS INTERNAL. Gunakan hanya dokumen yang diberikan dalam bagian KONTEKS untuk fakta spesifik tentang yayasan.
2. DILARANG MENGARANG: jangan pernah membuat/mengarang nomor peraturan, tahun, isi pasal, atau kutipan hukum yang tidak ada pada konteks. Bila tidak yakin, katakan terus terang bahwa informasi perlu diverifikasi.
3. DILARANG MENYATAKAN PERATURAN MASIH BERLAKU tanpa status verifikasi pada konteks. Sebutkan status verifikasi sumber ("Terverifikasi" atau "Perlu Verifikasi") setiap kali menyebut regulasi.
4. Ketika menjawab berdasarkan konteks, cantumkan di akhir bagian "DOKUMEN SUMBER" berupa daftar: nomor/judul dokumen, status verifikasi, dan tautan resmi bila ada.
5. Untuk pertanyaan hukum umum (mis. perbedaan PKWT/PKWTT), berikan penjelasan konseptual umum yang telah menjadi pengetahuan standar, TANPA mengutip pasal spesifik, dan tetap arahkan untuk memeriksa JDIH resmi (peraturan.bpk.go.id, jdih.kemnaker.go.id).
6. JANGAN PERNAH meminta atau menampilkan data personal pegawai (gaji, NIK, alamat). Data tersebut tidak diberikan ke Anda.
7. Untuk permintaan draft (SK, surat, SOP, job description, KPI/IKI), buat draf profesional berbahasa Indonesia dengan bagian kosong dalam kurung siku seperti [Nama Pegawai] agar pengguna mengisi sendiri.
8. Jawab ringkas, terstruktur (poin bernomor bila cocok), dan berbahasa Indonesia.
9. TUTUP setiap jawaban dengan disclaimer satu baris: "Disclaimer: bukan nasihat hukum; periksa sumber resmi (JDIH) atau konsultasikan dengan ahli hukum untuk kepastian."`;

interface SourceInfo {
  title: string;
  ref?: string;
  status?: string;
  url?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Metode harus POST.' }, 405);
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite';
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'Butuh token autentikasi (Bearer).' }, 401);

    // Verifikasi pengguna via service role (bypass RLS hanya di server)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: 'Token tidak valid atau kedaluwarsa.' }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const message: string = String(body.message || '').slice(0, 4000);
    const conversationId: string | null = body.conversation_id || null;
    if (!message) return json({ error: 'Pesan kosong.' }, 400);

    // ---------------- RAG: ambil konteks dari tabel internal ----------------
    const keywords = Array.from(
      new Set(
        message
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 4),
      ),
    ).slice(0, 8);
    const orExpr = (cols: string[]) =>
      keywords.flatMap((k) => cols.map((c) => `${c}.ilike.*${k}*`)).join(',');

    const [regs, pols, sops, tpls, kbs] = await Promise.all([
      keywords.length
        ? admin.from('regulations').select('number,year,title,summary,status,verification_status,official_url').or(orExpr(['title', 'summary', 'provisions', 'number'])).limit(6)
        : Promise.resolve({ data: [] }),
      keywords.length
        ? admin.from('policies').select('number,title,version,summary,status').or(orExpr(['title', 'summary', 'content', 'number'])).limit(4)
        : Promise.resolve({ data: [] }),
      keywords.length
        ? admin.from('sop_documents').select('number,name,purpose,category,sla').or(orExpr(['name', 'purpose', 'procedure', 'number'])).limit(4)
        : Promise.resolve({ data: [] }),
      keywords.length
        ? admin.from('templates').select('code,name,version,description').or(orExpr(['name', 'description', 'code'])).limit(4)
        : Promise.resolve({ data: [] }),
      keywords.length
        ? admin.from('knowledge_articles').select('title,author,summary,category').eq('status', 'dipublikasikan').or(orExpr(['title', 'summary', 'content'])).limit(4)
        : Promise.resolve({ data: [] }),
    ]);

    const sources: SourceInfo[] = [];
    const ctxBlocks: string[] = [];
    const pushSources = (rows: any[], kind: string, map: (r: any) => SourceInfo) => {
      for (const r of rows || []) {
        sources.push(map(r));
      }
      if (rows?.length) {
        ctxBlocks.push(`[${kind.toUpperCase()}]\n${(rows as any[]).map((r) => JSON.stringify(r)).join('\n')}`);
      }
    };
    pushSources(regs.data, 'Regulasi', (r) => ({
      title: `${r.number} (${r.year}) — ${r.title}`,
      ref: `Status: ${r.status}`,
      status: r.verification_status,
      url: r.official_url,
    }));
    pushSources(pols.data, 'Kebijakan Internal', (r) => ({
      title: `${r.number} — ${r.title} (v${r.version})`,
      ref: `Kebijakan internal`,
    }));
    pushSources(sops.data, 'SOP Internal', (r) => ({
      title: `${r.number} — ${r.name}`,
      ref: `SOP internal`,
    }));
    pushSources(tpls.data, 'Template', (r) => ({
      title: `${r.code} — ${r.name}`,
      ref: `Template`,
    }));
    pushSources(kbs.data, 'Artikel Knowledge Base', (r) => ({
      title: r.title,
      ref: `Artikel oleh ${r.author}`,
    }));

    const contextText = ctxBlocks.length
      ? `KONTEKS DOKUMEN INTERNAL (paling relevan ditemukan):\n\n${ctxBlocks.join('\n\n')}`
      : 'Tidak ditemukan dokumen internal yang cocok. Jawab dengan pengetahuan umum yang aman dan TANPA mengarang nomor peraturan; sarankan pengguna mencari di modul terkait.';

    // ---------------- Panggil Gemini ----------------
    if (!GEMINI_API_KEY) {
      return json({
        answer: 'GEMINI_API_KEY belum diset pada secrets Edge Function. Jalankan:\nsupabase secrets set GEMINI_API_KEY=…\nlalu deploy ulang: supabase functions deploy hr-assistant.',
        sources,
      });
    }

    // Rantai model: secret GEMINI_MODEL dipakai lebih dulu, lalu fallback ke
    // model aktif lainnya. Google memensiunkan model lama secara berkala
    // (404 "model not found"), sehingga fallback menjaga asisten tetap hidup.
    const modelChain = Array.from(new Set([
      GEMINI_MODEL,
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-flash-latest',
    ]));

    const callGemini = (model: string) =>
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Kirim kunci via header (bukan query string) agar tidak masuk log.
            'x-goog-api-key': GEMINI_API_KEY,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [
              {
                role: 'user',
                parts: [{ text: `${contextText}\n\nPERTANYAAN PENGGUNA:\n${message}` }],
              },
            ],
            generationConfig: {
              temperature: 0.4,
              // Perlu ruang cukup karena token "thinking" model 3.x dihitung
              // dari total maxOutputTokens — terlalu kecil = jawaban kosong.
              maxOutputTokens: 4096,
              // Batasi tingkat berpikir model Gemini 3.x agar cepat & hemat.
              // Untuk model selain 3.x field ini tidak dikirim (kompatibilitas).
              ...(/^(gemini-3|gemini-flash-latest)/.test(model)
                ? { thinkingLevel: 'low' }
                : {}),
            },
          }),
        },
      );

    let geminiRes: Response | null = null;
    let lastStatus = 0;
    let lastBody = '';
    for (const model of modelChain) {
      const res = await callGemini(model);
      if (res.ok) {
        geminiRes = res;
        break;
      }
      lastStatus = res.status;
      lastBody = await res.text();
      console.error(`Gemini error (${model}, status ${res.status}):`, lastBody.slice(0, 500));
      // 404 = model tidak ditemukan/dipensiunkan → coba model berikutnya.
      // Kesalahan lain (kunci, kuota, format) langsung dilaporkan.
      if (res.status !== 404) break;
    }

    if (!geminiRes) {
      let detail = '';
      try {
        detail = JSON.parse(lastBody)?.error?.message || '';
      } catch { /* bukan JSON */ }
      if (!detail) detail = lastBody.slice(0, 300);
      const hint =
        lastStatus === 404
          ? ' Model tidak ditemukan. Model lama (gemini-1.5/2.0/2.5) sudah dipensiunkan Google — set secret GEMINI_MODEL ke model aktif (mis. gemini-3.5-flash-lite) lalu deploy ulang.'
          : lastStatus === 429
          ? ' Kuota/rate limit Gemini tercapai — periksa Google AI Studio.'
          : lastStatus === 400 || lastStatus === 403
          ? ' Periksa GEMINI_API_KEY (kunci tidak valid atau Generative Language API belum aktif untuk proyek kunci tersebut).'
          : ' Periksa status layanan Gemini lalu coba lagi.';
      return json({ error: `Gemini API error (${lastStatus}).${hint}${(detail ? ' Detail: ' : '') + detail}` }, 502);
    }

    const geminiJson = await geminiRes.json();
    const candidate = geminiJson?.candidates?.[0];
    const answer: string =
      candidate?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('') ||
      (candidate?.finishReason === 'MAX_TOKENS'
        ? 'Jawaban terpotong karena batas token model. Coba pertanyaan yang lebih ringkas.'
        : 'Tidak ada jawaban yang dihasilkan.');

    // ---------------- Simpan percakapan ----------------
    let convId = conversationId;
    if (convId) {
      const { data: conv } = await admin.from('ai_conversations').select('id,user_id').eq('id', convId).maybeSingle();
      if (!conv || conv.user_id !== user.id) convId = null;
    }
    if (!convId) {
      const { data: conv } = await admin
        .from('ai_conversations')
        .insert({ user_id: user.id, title: message.slice(0, 60) })
        .select('id')
        .single();
      convId = conv.id;
    }
    await admin.from('ai_messages').insert({ conversation_id: convId, role: 'user', content: message, sources: [] });
    await admin.from('ai_messages').insert({ conversation_id: convId, role: 'assistant', content: answer, sources });

    return json({ answer, sources, conversation_id: convId });
  } catch (e) {
    console.error(e);
    return json({ error: e?.message || 'Kesalahan tidak terduga.' }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
