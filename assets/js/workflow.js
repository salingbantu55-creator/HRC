/* ============================================================
   workflow.js — Modul 11: Document Workflow
   Draft → Diajukan → Review → Revisi → Disetujui → Dipublikasikan → Diarsipkan
   Ekspor fungsi transisi dipakai modul policies/sop/documents.
   ============================================================ */

import { WORKFLOW_STAGES, WORKFLOW_STAGE_LABEL } from './config.js';
import { db, can, profile } from './supabase.js';
import { esc, toast, modal, formModal, DataTable, badge, refreshIcons, fmtDateTime, fmtAgo, pipeline, rowIcon, emptyState } from './ui.js';
import { navigate } from './app.js';

export async function render(content, params = {}) {
  const rows = await db.list('workflow_approvals', { order: { col: 'created_at', ascending: false } });
  const counts = ['diajukan', 'review', 'revisi'].map((s) => ({ s, n: rows.filter((r) => r.stage === s).length }));

  content.innerHTML = `
  <div class="page-head">
    <div>
      <h2>Document Workflow &amp; Approval</h2>
      <div class="ph-desc">Alur persetujuan dokumen dengan jejak pembuat, reviewer, approver, catatan revisi, dan riwayat aktivitas.</div>
    </div>
  </div>
  <div class="card card-pad mb-2">
    ${pipeline(WORKFLOW_STAGES, 'diajukan', WORKFLOW_STAGE_LABEL)}
    <div class="flex flex-wrap mt-1" style="gap:8px">
      ${counts.map((c) => `<span class="chip-tag">Stage ${esc(WORKFLOW_STAGE_LABEL[c.s])}: <b>${c.n}</b></span>`).join('')}
      <span class="chip-tag">Total dokumen dalam alur: <b>${rows.length}</b></span>
    </div>
  </div>
  <div id="wf-table"></div>`;
  refreshIcons(content);

  const table = new DataTable(content.querySelector('#wf-table'), {
    columns: [
      { key: 'title', label: 'Dokumen', render: (r) => `<span class="cell-main">${esc(r.title)}</span><span class="cell-sub">${esc(r.parent_type)} · pembuat: ${esc(r.requester_name)}</span>` },
      { key: 'reviewer_name', label: 'Reviewer' },
      { key: 'approver_name', label: 'Approver' },
      { key: 'stage', label: 'Tahap', render: (r) => badge(r.stage === 'revisi' ? 'revisi' : r.stage === 'diajukan' ? 'diajukan' : r.stage === 'review' ? 'review' : r.stage === 'disetujui' ? 'disetujui' : r.stage === 'dipublikasikan' ? 'dipublikasikan' : 'diarsipkan') },
      { key: 'submitted_at', label: 'Diajukan', render: (r) => esc(r.submitted_at ? fmtDateTime(r.submitted_at) : '-') },
      { key: 'actions', label: 'Aksi', render: (r) => `<div class="row-actions">
        ${rowIcon('view', 'eye', 'Riwayat')}
        ${actionsFor(r).map((a) => rowIcon(a.id, a.icon, a.label, a.gold ? 'gold' : a.danger ? 'danger' : '')).join('')}
      </div>` },
    ],
    searchKeys: ['title', 'requester_name', 'reviewer_name'],
    searchPlaceholder: 'Cari dokumen/pembuat…',
    filters: [{ key: 'stage', label: 'Semua Tahap', options: WORKFLOW_STAGES.filter((s) => !['draft'].includes(s)).map((s) => ({ value: s, label: WORKFLOW_STAGE_LABEL[s] })) }],
    pageSize: 8,
    emptyIcon: 'workflow', emptyTitle: 'Tidak ada workflow',
    rowActionsMap: {
      view: (r) => showHistory(r),
      ...Object.fromEntries(['start_review', 'approve', 'revise', 'resubmit', 'publish', 'archive'].map((a) => [a, (r) => runAction(r, a, () => render(content, params))])),
    },
    onRowClick: (r) => showHistory(r),
  });
  table.setRows(rows);
}

/* ---------- Kewenangan aksi per tahap ---------- */
export function actionsFor(wf) {
  const me = profile();
  if (!me) return [];
  const isReviewer = [wf.reviewer_id, wf.approver_id].includes(me.id);
  const isRequester = wf.requested_by === me.id;
  const manage = can('workflow.manage');
  const out = [];
  if (wf.stage === 'diajukan' && (manage || isReviewer || isRequester)) out.push({ id: 'start_review', icon: 'search-check', label: 'Mulai review' });
  if (['diajukan', 'review'].includes(wf.stage) && (manage || isReviewer)) {
    out.push({ id: 'approve', icon: 'check', label: 'Setujui', gold: true });
    out.push({ id: 'revise', icon: 'message-square-warning', label: 'Minta revisi', danger: true });
  }
  if (wf.stage === 'revisi' && (isRequester || manage)) out.push({ id: 'resubmit', icon: 'send', label: 'Ajukan ulang', gold: true });
  if (wf.stage === 'disetujui' && (manage || isReviewer)) out.push({ id: 'publish', icon: 'send', label: 'Publikasikan', gold: true });
  if (wf.stage === 'dipublikasikan' && manage) out.push({ id: 'archive', icon: 'archive', label: 'Arsipkan', danger: true });
  return out;
}

const STATUS_OF_STAGE = { draft: 'draft', diajukan: 'diajukan', review: 'review', revisi: 'revisi', disetujui: 'disetujui', dipublikasikan: 'dipublikasikan', diarsipkan: 'diarsipkan' };

function parentTable(type) {
  return { policy: 'policies', sop: 'sop_documents', document: 'documents', regulation: 'regulations' }[type] || 'documents';
}

/* ---------- Jalankan transisi ---------- */
export async function runAction(wf, action, after, noteGiven = null) {
  const me = profile();
  const note = noteGiven;
  const needNote = action === 'revise';
  const ensureNote = async () => {
    if (note) return note;
    const res = await formModal({
      title: action === 'revise' ? 'Catatan Revisi' : action === 'approve' ? 'Catatan Persetujuan' : 'Catatan',
      icon: 'message-square',
      fields: [{ key: 'note', label: action === 'revise' ? 'Hal yang harus diperbaiki' : 'Catatan (opsional)', type: 'textarea', rows: 3, full: true, required: action === 'revise' }],
      submitLabel: action === 'revise' ? 'Kirim Permintaan Revisi' : 'Konfirmasi',
      onSubmit: async (v) => v.note,
    });
    return res?.note || null;
  };
  const noteText = needNote ? await ensureNote() : (action === 'approve' || action === 'publish' ? await ensureNote() : null);
  if (needNote && !noteText) return;

  const nowIso = new Date().toISOString();
  const histEntry = { stage: action, at: nowIso, by: me?.full_name || '-', note: noteText || '' };
  let newStage = wf.stage;
  let status = wf.status;
  if (action === 'start_review') { newStage = 'review'; status = 'menunggu'; }
  if (action === 'approve') { newStage = 'disetujui'; status = 'disetujui'; }
  if (action === 'revise') { newStage = 'revisi'; status = 'revisi'; }
  if (action === 'resubmit') { newStage = 'diajukan'; status = 'menunggu'; }
  if (action === 'publish') { newStage = 'dipublikasikan'; status = 'disetujui'; }
  if (action === 'archive') { newStage = 'diarsipkan'; status = 'diarsipkan'; }

  try {
    const history = [...(wf.history || []), histEntry];
    await db.update('workflow_approvals', wf.id, {
      stage: newStage, status,
      revision_notes: action === 'revise' ? noteText : wf.revision_notes,
      decided_at: ['approve', 'revise', 'publish'].includes(action) ? nowIso : wf.decided_at,
      history,
    });
    // Sinkronkan status dokumen induk
    await db.update(parentTable(wf.parent_type), wf.parent_id, { status: newStage });
    // Notifikasi
    const notifyMap = {
      start_review: [wf.requested_by, `Review dimulai`, `${wf.title} sedang direview oleh ${me?.full_name}.`],
      approve: [wf.requested_by, 'Dokumen disetujui', `${wf.title} telah disetujui oleh ${me?.full_name}.`],
      revise: [wf.requested_by, 'Permintaan revisi', `${wf.title}: ${noteText}`],
      resubmit: [wf.reviewer_id, 'Diajukan ulang', `${wf.title} telah diperbaiki dan diajukan ulang.`],
      publish: [wf.requested_by, 'Dokumen dipublikasikan', `${wf.title} kini tersedia di modul terkait.`],
      archive: [wf.requested_by, 'Dokumen diarsipkan', `${wf.title} telah diarsipkan.`],
    };
    const [uid, t, msg] = notifyMap[action] || [null, '', ''];
    if (uid) await db.notify(uid, t, msg, 'workflow', '#/workflow');
    await db.logAudit(action, 'workflow', wf.id, { title: wf.title, note: noteText });
    toast(`Aksi "${WORKFLOW_STAGE_LABEL[newStage]}" berhasil diterapkan.`, 'success');
    if (after) after();
  } catch (e) { toast(e.message, 'error', 'Gagal'); }
}

/* ---------- Buat workflow baru ---------- */
export async function createWorkflow({ parentType, parentId, title }) {
  const me = profile();
  if (!me) return null;
  const existing = await db.list('workflow_approvals', { filters: { parent_type: parentType, parent_id: parentId } }).catch(() => []);
  if (existing.length && !['diarsipkan'].includes(existing[0].stage)) {
    toast('Dokumen ini sudah berada dalam alur persetujuan.', 'warning');
    return existing[0];
  }
  const people = await db.list('profiles').catch(() => []);
  const eligible = people.filter((p) => ['manajer_hrd', 'direktur_pendidikan', 'direktur_pelayanan', 'pembina', 'super_admin'].includes(p.role) && p.id !== me.id);
  const res = await formModal({
    title: 'Ajukan untuk Review', icon: 'send',
    introHtml: `<div class="notice info"><i data-lucide="info"></i><span>Dokumen akan berstatus <b>Diajukan</b>. Pilih reviewer dan approver sesuai matriks kewenangan.</span></div>`,
    fields: [
      { key: 'reviewer_id', label: 'Reviewer', type: 'select', required: true, options: eligible.map((p) => ({ value: p.id, label: `${p.full_name} — ${(p.role || '').replace('_', ' ')}` })), full: true },
      { key: 'approver_id', label: 'Approver', type: 'select', required: true, options: eligible.map((p) => ({ value: p.id, label: `${p.full_name} — ${(p.role || '').replace('_', ' ')}` })), full: true },
      { key: 'note', label: 'Catatan pengajuan (opsional)', type: 'textarea', rows: 2, full: true },
    ],
    submitLabel: 'Ajukan',
    onSubmit: async (v) => {
      const reviewer = people.find((p) => p.id === v.reviewer_id);
      const approver = people.find((p) => p.id === v.approver_id);
      const nowIso = new Date().toISOString();
      const wf = await db.insert('workflow_approvals', {
        parent_type: parentType, parent_id: parentId, title,
        requested_by: me.id, requester_name: me.full_name,
        reviewer_id: reviewer?.id, reviewer_name: reviewer?.full_name,
        approver_id: approver?.id, approver_name: approver?.full_name,
        stage: 'diajukan', status: 'menunggu', revision_notes: null,
        submitted_at: nowIso, decided_at: null,
        history: [
          { stage: 'draft', at: nowIso, by: me.full_name, note: 'Dokumen disusun' },
          { stage: 'diajukan', at: nowIso, by: me.full_name, note: v.note || 'Diajukan untuk review' },
        ],
      });
      await db.update(parentTable(parentType), parentId, { status: 'diajukan' });
      await db.notify(reviewer?.id, 'Permintaan review dokumen', `${title} menunggu review Anda.`, 'workflow', '#/workflow');
      await db.logAudit('submit_review', 'workflow', wf.id, { title });
      toast('Dokumen diajukan untuk review.', 'success');
      return true;
    },
  });
  return res ? true : null;
}

/* ---------- Riwayat ---------- */
function showHistory(wf) {
  const m = modal({
    title: wf.title, icon: 'workflow', size: '',
    body: `
      ${pipeline(WORKFLOW_STAGES, wf.stage, WORKFLOW_STAGE_LABEL)}
      <div class="detail-grid mt-2">
        <div class="detail-item"><div class="dt-label">Pembuat</div><div class="dt-val">${esc(wf.requester_name)}</div></div>
        <div class="detail-item"><div class="dt-label">Reviewer</div><div class="dt-val">${esc(wf.reviewer_name || '-')}</div></div>
        <div class="detail-item"><div class="dt-label">Approver</div><div class="dt-val">${esc(wf.approver_name || '-')}</div></div>
        <div class="detail-item"><div class="dt-label">Status</div><div class="dt-val">${badge(wf.status)}</div></div>
        <div class="detail-item"><div class="dt-label">Waktu Pengajuan</div><div class="dt-val">${esc(fmtDateTime(wf.submitted_at))}</div></div>
        <div class="detail-item"><div class="dt-label">Waktu Keputusan</div><div class="dt-val">${esc(wf.decided_at ? fmtDateTime(wf.decided_at) : '-')}</div></div>
        ${wf.revision_notes ? `<div class="detail-item full"><div class="dt-label">Catatan Revisi</div><div class="dt-val prose">${esc(wf.revision_notes)}</div></div>` : ''}
      </div>
      <h4 class="mt-3" style="font-size:.9rem">Riwayat Aktivitas</h4>
      <div class="mini-list mt-1" style="border:1px solid var(--border);border-radius:10px">
        ${(wf.history || []).map((h) => `
          <div class="mini-item" style="cursor:default">
            <span class="mi-ic"><i data-lucide="${h.stage === 'revisi' ? 'message-square-warning' : h.stage === 'diajukan' ? 'send' : 'check'}"></i></span>
            <span class="grow"><b>${esc(WORKFLOW_STAGE_LABEL[h.stage] || h.stage)}</b><small>${esc(h.by)}${h.note ? ' — ' + esc(h.note) : ''}</small></span>
            <span class="mi-right"><small>${esc(fmtAgo(h.at))}</small></span>
          </div>`).join('')}
      </div>`,
    footer: `${actionsFor(wf).map((a) => `<button class="btn ${a.gold ? 'btn-gold' : a.danger ? 'btn-danger' : 'btn-outline'}" data-wf="${a.id}"><i data-lucide="${a.icon}"></i> ${esc(a.label)}</button>`).join('')}`,
    onOpen: (el, close) => {
      refreshIcons(el);
      el.querySelectorAll('[data-wf]').forEach((b) => b.addEventListener('click', () => {
        close();
        runAction(wf, b.dataset.wf, () => { navigate('workflow'); });
      }));
    },
  });
  refreshIcons(m.el);
}
