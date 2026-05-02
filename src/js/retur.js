import $ from 'jquery'
import { requireAuth, getAuthUser, logout } from './auth.js'
import {
    Http, Format, Toast, Loading, Modal,
    injectSharedUI, startClock, startConnectionCheck, injectHeader,
} from './global.js'

requireAuth()
injectSharedUI()
injectHeader('retur')
startClock()
startConnectionCheck()

const user = getAuthUser()
$('#header-username').text(user?.name ?? 'Purchase')
$('#btn-logout').on('click', () => {
    Modal.confirm({
        title: 'Konfirmasi Keluar',
        message: 'Yakin ingin keluar dari aplikasi?',
        labelOk: 'Keluar',
        danger: true,
        onOk: () => logout(),
    })
})

// ═══════════════════════════════════════════════════════════════════════════
//  KONSTANTA
// ═══════════════════════════════════════════════════════════════════════════

// Status yang dianggap selesai → hanya muncul di History
const FINISH_STATUSES = ['REPLACED', 'CLOSED', 'REJECTED', 'CANCELLED']

// Inbox aktif (SUBMITTED + APPROVED)
const INBOX_STATUSES = ['SUBMITTED', 'APPROVED']

// Label status untuk tampilan badge
const STATUS_TEXT = {
    SUBMITTED: 'REQUEST',
    APPROVED: 'DISETUJUI',
    SENT: 'DIKIRIM',
    PARTIAL_REPLACED: 'SEBAGIAN',
    REPLACED: 'DIGANTI',
    CLOSED: 'CLOSED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED',
}

const STATUS_BG_CLASS = {
    SUBMITTED: 'bg-gray-50',
    APPROVED: 'bg-green-50',
    SENT: 'bg-blue-50',
    PARTIAL_REPLACED: 'bg-indigo-50',
    REPLACED: 'bg-teal-50',
    CLOSED: 'bg-gray-100',
    REJECTED: 'bg-red-50',
    CANCELLED: 'bg-red-50',
}

const STATUS_TEXT_CLASS = {
    SUBMITTED: 'text-gray-700',
    APPROVED: 'text-green-700',
    SENT: 'text-blue-700',
    PARTIAL_REPLACED: 'text-indigo-600',
    REPLACED: 'text-teal-600',
    CLOSED: 'text-gray-600',
    REJECTED: 'text-red-600',
    CANCELLED: 'text-red-600',
}

// Disposition (retur_action) — diset di level header saat approve
// Mapping: nilai BE → label FE
const RETUR_ACTION_OPTIONS = [
    { value: 'REPLACEMENT', label: 'Pengganti (Replacement)' },
    { value: 'REFUND', label: 'Pengembalian Dana (Refund)' },
    { value: 'SCRAP', label: 'Dimusnahkan (Scrap)' },
    { value: 'WRITE_OFF', label: 'Hapus Buku (Write-off)' },
]

const RETUR_ACTION_LABEL = {
    REPLACEMENT: 'Pengganti',
    REFUND: 'Refund',
    SCRAP: 'Scrap',
    WRITE_OFF: 'Write-off',
}

const RETUR_ACTION_CLASS = {
    REPLACEMENT: 'text-blue-600',
    REFUND: 'text-green-600',
    SCRAP: 'text-orange-600',
    WRITE_OFF: 'text-gray-500',
}

// Label kondisi item — nilai BE: DAMAGED, WRONG_SPEC, EXPIRED, OTHER
const CONDITION_LABEL = {
    DAMAGED: 'Rusak',
    WRONG_SPEC: 'Item Salah',
    EXPIRED: 'Kadaluarsa',
    OTHER: 'Lainnya',
}

const CONDITION_CLASS = {
    DAMAGED: 'bg-red-50 text-red-600',
    WRONG_SPEC: 'bg-orange-50 text-orange-600',
    EXPIRED: 'bg-yellow-50 text-yellow-700',
    OTHER: 'bg-gray-100 text-gray-500',
}

// ═══════════════════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════════════════

let _allRetur = []   // data inbox aktif
let _query = ''

// ═══════════════════════════════════════════════════════════════════════════
//  BADGE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function badge(status) {
    const label = STATUS_TEXT[status] ?? status
    const textCls = STATUS_TEXT_CLASS[status] ?? 'text-gray-600'
    return `<span class="inline-block text-xs py-0.5 rounded-full font-medium ${textCls}">${label}</span>`
}

function actionBadge(action) {
    if (!action) return '<span class="text-gray-300 text-xs">—</span>'
    const label = RETUR_ACTION_LABEL[action] ?? action
    const cls = RETUR_ACTION_CLASS[action] ?? 'text-gray-500'
    return `<span class="text-xs font-medium ${cls}">${label}</span>`
}

// ═══════════════════════════════════════════════════════════════════════════
//  RENDER TABEL UTAMA
// ═══════════════════════════════════════════════════════════════════════════

function renderTable(data) {
    const $tbody = $('#tbl-body').empty()
    $('#badge-count').text(data.length)

    if (!data.length) {
        $('#empty-state').removeClass('hidden')
        return
    }
    $('#empty-state').addClass('hidden')

    data.forEach((r, i) => {
        const status = r.status ?? ''
        const bgCls = STATUS_BG_CLASS[status] ?? ''
        $tbody.append(`
            <tr class="border-t border-gray-100 hover:bg-gray-50 transition">
                <td class="px-3 py-1 text-center text-gray-400 text-xs border border-gray-200">${i + 1}</td>
                <td class="px-3 py-1 font-medium text-gray-800 truncate border border-gray-200">${r.retur_number ?? '-'}</td>
                <td class="px-3 py-1 text-gray-600 truncate border border-gray-200">${r.purchase_order?.po_number ?? '-'}</td>
                <td class="px-3 py-1 text-gray-600 truncate border border-gray-200">${r.supplier?.name ?? '-'}</td>
                <td class="px-3 py-1 text-center text-gray-500 text-xs border border-gray-200">${Format.date(r.retur_date)}</td>
                <td class="px-3 py-1 text-center text-gray-800 tabular-nums border border-gray-200">${Format.number(r.total_qty ?? 0)}</td>
                <td class="px-3 py-1 text-center border border-gray-200 whitespace-nowrap ${bgCls}">${badge(status)}</td>
                <td class="px-3 py-1 border border-gray-200">
                    <div class="flex justify-center">
                        <button data-action="view-retur" data-id="${r.id}"
                            class="w-24 h-7 flex items-center justify-center rounded-md border border-gray-200
                                   bg-gray-50 font-bold text-gray-500 hover:bg-blue-50 hover:text-blue-700
                                   hover:border-blue-200 transition text-xs">
                            DETAIL
                        </button>
                    </div>
                </td>
            </tr>`)
    })
}

// ═══════════════════════════════════════════════════════════════════════════
//  FILTER CLIENT-SIDE
// ═══════════════════════════════════════════════════════════════════════════

function applyFilter() {
    const q = _query.toLowerCase()
    renderTable(_allRetur.filter(r =>
        (r.retur_number ?? '').toLowerCase().includes(q) ||
        (r.purchase_order?.po_number ?? '').toLowerCase().includes(q) ||
        (r.supplier?.name ?? '').toLowerCase().includes(q)
    ))
}

// ═══════════════════════════════════════════════════════════════════════════
//  ANIMASI REFRESH
// ═══════════════════════════════════════════════════════════════════════════

function animateRefresh() {
    $('#btn-refresh svg').css({ transition: 'transform .5s', transform: 'rotate(360deg)' })
    setTimeout(() => $('#btn-refresh svg').css({ transition: '', transform: '' }), 500)
}

// ═══════════════════════════════════════════════════════════════════════════
//  LOAD DATA — GET inbox (SUBMITTED + APPROVED)
//  BE: POST /purchase-retur/inbox
//  Body: { status_filter, search, filter_month, filter_year }
// ═══════════════════════════════════════════════════════════════════════════

async function loadData() {
    Loading.show('Memuat data retur...')
    animateRefresh()
    try {
        const res = await Http.post('/purchase-retur/inbox', {
            status_filter: 'all',   // SUBMITTED + APPROVED
        })
        // BE mengembalikan: { data: [...], message: '...' }
        _allRetur = Array.isArray(res?.data) ? res.data : []
        applyFilter()
    } catch (err) {
        Toast.show('Gagal memuat data: ' + err.message, 'error')
    } finally {
        Loading.hide()
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  HISTORY RETUR — status REPLACED / CLOSED / REJECTED / CANCELLED
//  BE: POST /purchase-retur/inbox — tidak ada endpoint history terpisah,
//  kita kirim semua status lalu filter di client.
//  TODO: Minta BE tambahkan endpoint /purchase-retur/history jika perlu
//        filter bulan/tahun dari server.
// ═══════════════════════════════════════════════════════════════════════════

async function _showHistoryRetur() {
    Loading.show('Memuat riwayat retur...')
    try {
        // Ambil data di luar inbox (status finish)
        // Catatan: endpoint inbox hanya mengembalikan SUBMITTED+APPROVED.
        // Untuk history (REPLACED/CLOSED/REJECTED/CANCELLED) perlu endpoint
        // terpisah. Sementara kita fetch semua dari history endpoint kalau ada,
        // atau tampilkan pesan jika belum ada.
        //
        // ── Gunakan endpoint ini kalau sudah ada di BE: ──────────────────
        // const res = await Http.post('/purchase-retur/history', {})
        // const data = Array.isArray(res?.data) ? res.data : []
        // ────────────────────────────────────────────────────────────────
        //
        // Sementara: fetch inbox semua status (workaround)
        const res = await Http.post('/purchase-retur/inbox', {
            status_filter: 'all',
        })
        const all = Array.isArray(res?.data) ? res.data : []
        const data = all.filter(r => FINISH_STATUSES.includes(r.status))

        const rows = data.length
            ? data.map((r, i) => {
                const status = r.status ?? ''
                const bgCls = STATUS_BG_CLASS[status] ?? ''
                return `
                    <tr class="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                        data-action="view-retur-history" data-id="${r.id}">
                        <td class="py-1.5 px-2 text-gray-400 text-xs text-center border border-gray-100">${i + 1}</td>
                        <td class="py-1.5 px-2 font-medium text-gray-800 text-xs border border-gray-100 whitespace-nowrap">${r.retur_number ?? '-'}</td>
                        <td class="py-1.5 px-2 text-gray-600 text-xs border border-gray-100 whitespace-nowrap">${r.purchase_order?.po_number ?? '-'}</td>
                        <td class="py-1.5 px-2 text-gray-600 text-xs truncate border border-gray-100">${r.supplier?.name ?? '-'}</td>
                        <td class="py-1.5 px-2 text-gray-500 text-xs text-center border border-gray-100 whitespace-nowrap">${Format.date(r.retur_date)}</td>
                        <td class="py-1.5 px-2 text-center tabular-nums text-gray-800 text-xs border border-gray-100">${Format.number(r.total_qty ?? 0)}</td>
                        <td class="py-1.5 px-2 text-center text-xs border border-gray-100 whitespace-nowrap ${bgCls}">${badge(status)}</td>
                    </tr>`
            }).join('')
            : '<tr><td colspan="7" class="text-center py-4 text-gray-400 text-xs">Tidak ada data riwayat</td></tr>'

        Modal.open({
            title: 'Riwayat Retur',
            body: `
                <div class="overflow-x-auto">
                    <table class="w-full text-xs border-collapse">
                        <thead class="bg-gray-100 text-gray-500 sticky top-0">
                            <tr>
                                <th class="py-1.5 px-2 border border-gray-200 text-center">No</th>
                                <th class="py-1.5 px-2 border border-gray-200 text-left whitespace-nowrap">No Retur</th>
                                <th class="py-1.5 px-2 border border-gray-200 text-left whitespace-nowrap">Ref PO</th>
                                <th class="py-1.5 px-2 border border-gray-200 text-left">Supplier</th>
                                <th class="py-1.5 px-2 border border-gray-200 text-center">Tanggal</th>
                                <th class="py-1.5 px-2 border border-gray-200 text-center">Qty</th>
                                <th class="py-1.5 px-2 border border-gray-200 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <p class="text-xs text-gray-400 mt-2">Klik baris untuk melihat detail.</p>`,
            actions: '',
            onOpen: () => {
                $('#modal-body').on('click', '[data-action="view-retur-history"]', function () {
                    const id = +$(this).data('id')
                    Modal.close()
                    setTimeout(() => _showDetailRetur(id, true), 220)
                })
            },
            onClose: () => {
                $('#modal-body').off('click', '[data-action="view-retur-history"]')
            },
        })
    } catch (err) {
        Toast.show('Gagal memuat riwayat: ' + err.message, 'error')
    } finally {
        Loading.hide()
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  DETAIL RETUR
//  BE: POST /purchase-retur/detail  Body: { retur_id }
//  Response: { data: { ...header, details: [...] } }
//
//  isHistory = true  → read-only, tombol ← Kembali ke history
//  isHistory = false → mode approval jika status === 'SUBMITTED'
// ═══════════════════════════════════════════════════════════════════════════

async function _showDetailRetur(id, isHistory = false) {
    Loading.show('Memuat detail retur...')
    try {
        const res = await Http.post('/purchase-retur/detail', { retur_id: id })
        const r = res?.data ?? null
        Loading.hide()

        if (!r) { Toast.show('Data tidak ditemukan', 'error'); return }

        // Approve hanya kalau status SUBMITTED (belum ada keputusan dari purchase)
        const canApprove = r.status === 'SUBMITTED'
        const items = r.details ?? []
        const totalNominal = items.reduce(
            (s, d) => s + (d.qty_returned ?? 0) * (d.unit_price ?? 0), 0
        )

        // ── Render baris item (read-only, kondisi + progress replacement) ──
        function renderItemRows() {
            return items.map((d, i) => {
                const condLabel = CONDITION_LABEL[d.condition_status] ?? d.condition_status ?? '-'
                const condCls = CONDITION_CLASS[d.condition_status] ?? 'bg-gray-100 text-gray-500'
                const subtotal = (d.qty_returned ?? 0) * (d.unit_price ?? 0)

                // Kolom qty: saat status pasca-approve tampilkan progress replaced
                const hasReplaced = (d.qty_replaced ?? 0) > 0
                const qtyCell = hasReplaced
                    ? `<td class="py-1 px-2 text-right tabular-nums text-gray-800">
                           ${Format.number(d.qty_returned ?? 0)}
                           <span class="text-green-600 text-xs">+${Format.number(d.qty_replaced)}</span>
                       </td>`
                    : `<td class="py-1 px-2 text-right tabular-nums text-gray-800">${Format.number(d.qty_returned ?? 0)}</td>`

                return `
                    <tr class="border-t border-gray-100 text-xs">
                        <td class="py-1 px-2 text-gray-400">${i + 1}</td>
                        <td class="py-1 px-2 text-gray-700 whitespace-nowrap">
                            <span class="text-gray-500">${d.material?.code ?? '-'}</span> | ${d.material?.name ?? '-'}
                        </td>
                        ${qtyCell}
                        <td class="py-1 px-2 text-center text-gray-600">${d.material?.unit?.code ?? '-'}</td>
                        <td class="py-1 px-2 text-right tabular-nums text-gray-800">${Format.currency(d.unit_price ?? 0)}</td>
                        <td class="py-1 px-2 text-right tabular-nums font-medium text-gray-800">${Format.currency(subtotal)}</td>
                        <td class="py-1 px-2 text-center">
                            <span class="px-1.5 py-0.5 rounded text-xs ${condCls}">${condLabel}</span>
                        </td>
                    </tr>`
            }).join('')
        }

        // ── Section approve: satu dropdown retur_action di header ─────────
        // Berbeda dari versi lama (per-item decision), BE menyimpan keputusan
        // di level header (retur_action). FE cukup pilih satu keputusan untuk
        // seluruh dokumen.
        const approveSection = canApprove ? `
            <div class="border-t pt-3 mt-1">
                <p class="text-xs font-bold text-gray-600 mb-2">
                    Keputusan Approval
                    <span class="text-red-500 font-normal">*</span>
                </p>
                <div class="flex flex-col gap-2">
                    <div>
                        <label class="block text-xs text-gray-500 mb-1">Tindakan untuk semua item retur ini</label>
                        <select id="select-retur-action"
                            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5
                                   focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
                            <option value="">— pilih keputusan —</option>
                            ${RETUR_ACTION_OPTIONS.map(o =>
            `<option value="${o.value}">${o.label}</option>`
        ).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-500 mb-1">Catatan (opsional)</label>
                        <textarea id="input-approval-notes" rows="2"
                            placeholder="Catatan untuk gudang..."
                            class="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5
                                   focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"></textarea>
                    </div>
                </div>
            </div>` : ''

        // ── Info disposition (pasca-approve) ──────────────────────────────
        const dispositionInfo = (!canApprove && r.retur_action) ? `
            <div>
                <div class="text-gray-500">Keputusan</div>
                <div>${actionBadge(r.retur_action)}</div>
            </div>` : ''

        // ── Info approver / sender / rejecter ─────────────────────────────
        const actorInfo = (() => {
            if (r.approver && r.approved_at) {
                return `<div class="col-span-2 text-xs text-gray-400">
                    Disetujui oleh <strong>${r.approver.username}</strong>
                    pada ${Format.date(r.approved_at)}
                </div>`
            }
            if (r.rejecter && r.rejected_at) {
                return `<div class="col-span-2 text-xs text-red-400">
                    Ditolak oleh <strong>${r.rejecter.username}</strong>
                    pada ${Format.date(r.rejected_at)}
                </div>`
            }
            return ''
        })()

        // ── Body modal ────────────────────────────────────────────────────
        const body = `
            <div class="space-y-3 text-sm">
                <!-- Info header -->
                <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div>
                        <div class="text-gray-500">No Retur</div>
                        <div class="font-medium text-gray-800">${r.retur_number ?? '-'}</div>
                    </div>
                    <div>
                        <div class="text-gray-500">Tanggal</div>
                        <div class="text-gray-700">${Format.date(r.retur_date)}</div>
                    </div>
                    <div>
                        <div class="text-gray-500">Ref PO</div>
                        <div class="text-gray-700">${r.purchase_order?.po_number ?? '-'}</div>
                    </div>
                    <div>
                        <div class="text-gray-500">No Receive</div>
                        <div class="text-gray-700">${r.receive?.receive_number ?? '-'}</div>
                    </div>
                    <div>
                        <div class="text-gray-500">Supplier</div>
                        <div class="font-medium text-gray-800">${r.supplier?.name ?? '-'}</div>
                    </div>
                    <div>
                        <div class="text-gray-500">Gudang</div>
                        <div class="text-gray-700">${r.warehouse?.name ?? '-'}</div>
                    </div>
                    <div>
                        <div class="text-gray-500">Status</div>
                        <div>${badge(r.status)}</div>
                    </div>
                    <div>
                        <div class="text-gray-500">Diminta oleh</div>
                        <div class="text-gray-700">${r.requester?.username ?? '-'}</div>
                    </div>
                    ${dispositionInfo}
                    ${actorInfo}
                    ${r.notes ? `
                    <div class="col-span-2">
                        <div class="text-gray-500">Catatan</div>
                        <div class="text-gray-800">${r.notes}</div>
                    </div>` : ''}
                    ${r.rejected_reason ? `
                    <div class="col-span-2">
                        <div class="text-gray-500">Alasan Ditolak / Dikembalikan</div>
                        <div class="font-medium text-red-700 whitespace-pre-line">${r.rejected_reason}</div>
                    </div>` : ''}
                </div>

                <!-- Tabel item -->
                <div class="border-t pt-2">
                    <p class="text-xs font-bold text-gray-600 mb-1">
                        Item Retur | ${items.length} baris
                    </p>
                    <div class="overflow-x-auto max-h-48">
                        <table class="w-full text-xs">
                            <thead class="bg-gray-50 text-gray-500 sticky top-0">
                                <tr>
                                    <th class="py-1 px-2 text-left w-6">No</th>
                                    <th class="py-1 px-2 text-left">Material</th>
                                    <th class="py-1 px-2 text-right">Qty</th>
                                    <th class="py-1 px-2 text-center">Sat</th>
                                    <th class="py-1 px-2 text-right">Harga</th>
                                    <th class="py-1 px-2 text-right">Subtotal</th>
                                    <th class="py-1 px-2 text-center">Kondisi</th>
                                </tr>
                            </thead>
                            <tbody>${renderItemRows()}</tbody>
                        </table>
                    </div>
                    <div class="flex justify-end items-center mt-1.5 pt-1.5 border-t gap-3">
                        <span class="text-xs text-gray-500">Total Nilai:</span>
                        <span class="text-xs font-semibold text-gray-800">${Format.currency(totalNominal)}</span>
                    </div>
                </div>

                <!-- Section approve -->
                ${approveSection}
            </div>`

        // ── Tombol footer ─────────────────────────────────────────────────
        const approveActions = canApprove ? `
            <button id="modal-btn-submit-approval"
                class="h-8 px-4 rounded-lg bg-green-600 hover:bg-green-700
                       text-white text-sm font-medium transition">
                Simpan
            </button>
            <button id="modal-btn-reject"
                class="h-8 px-4 rounded-lg border border-red-200
                       text-sm font-medium text-red-500 hover:bg-red-50 transition">
                Tolak
            </button>` : ''

        const backAction = isHistory ? `
            <button id="modal-btn-back"
                class="h-8 px-4 rounded-lg border border-gray-200
                       text-sm text-gray-600 hover:bg-gray-100 transition">
                ← Kembali
            </button>` : ''

        // ── Tombol Send — muncul jika status APPROVED ─────────────────────
        const sendAction = (r.status === 'APPROVED') ? `
            <button id="modal-btn-send"
                class="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700
                       text-white text-sm font-medium transition">
                Kirim
            </button>` : ''

        Modal.open({
            title: r.retur_number ?? 'Detail Retur',
            body,
            actions: `
                ${backAction}
                ${approveActions}
                ${sendAction}
                `,
            onOpen: () => {
                // Tombol tutup
                $('#modal-btn-ok').one('click', () => Modal.close())

                // Tombol kembali ke history
                if (isHistory) {
                    $('#modal-btn-back').one('click', () => {
                        Modal.close()
                        setTimeout(() => _showHistoryRetur(), 220)
                    })
                }

                // ── Tombol APPROVE ─────────────────────────────────────
                if (canApprove) {
                    let _inProgress = false

                    $('#modal-btn-submit-approval').on('click', async () => {
                        if (_inProgress) return

                        const action = $('#select-retur-action').val()
                        if (!action) {
                            Toast.show('Pilih keputusan approval terlebih dahulu.', 'error')
                            $('#select-retur-action').addClass('ring-2 ring-red-400')
                            return
                        }
                        const notes = $('#input-approval-notes').val().trim() || null

                        Modal.confirm({
                            title: 'Konfirmasi Approval',
                            message: `Setujui retur <strong>${r.retur_number}</strong>
                                dengan keputusan <strong>${RETUR_ACTION_LABEL[action]}</strong>?`,
                            labelOk: 'Ya, Approve',
                            onOk: async () => {
                                _inProgress = true
                                try {
                                    Modal.close()
                                    await _submitApprove(r.id, action, notes)
                                } finally {
                                    _inProgress = false
                                }
                            },
                        })
                    })

                    // Hilangkan ring merah saat dropdown disentuh
                    $('#select-retur-action').on('change', function () {
                        $(this).removeClass('ring-2 ring-red-400')
                    })

                    // ── Tombol REJECT ──────────────────────────────────
                    $('#modal-btn-reject').one('click', () => {
                        Modal.form({
                            title: 'Tolak Retur',
                            formHtml: `
                                <p class="text-xs text-gray-500 mb-2">
                                    Retur <strong>${r.retur_number}</strong> akan dikembalikan ke warehouse.
                                </p>
                                <div>
                                    <label class="block text-xs font-medium text-gray-600 mb-1">
                                        Alasan Penolakan <span class="text-red-500">*</span>
                                    </label>
                                    <textarea id="form-reject-reason" rows="3"
                                        placeholder="Jelaskan alasan penolakan..."
                                        class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                                               focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"></textarea>
                                </div>`,
                            labelSubmit: 'Tolak Retur',
                            onOpen: () => {
                                $('#modal-btn-submit')
                                    .removeClass('bg-blue-600 hover:bg-blue-700')
                                    .addClass('bg-red-600 hover:bg-red-700')
                            },
                            onSubmit: async () => {
                                const reason = $('#form-reject-reason').val().trim()
                                if (!reason) {
                                    Toast.show('Alasan wajib diisi.', 'error')
                                    return
                                }
                                try {
                                    Modal.close()
                                    await _submitReject(r.id, reason)
                                } catch (err) {
                                    Toast.show('Gagal menolak: ' + err.message, 'error')
                                }
                            },
                        })
                    })
                }

                // ── Tombol SEND (APPROVED → SENT) ──────────────────────
                if (r.status === 'APPROVED') {
                    $('#modal-btn-send').one('click', () => {
                        Modal.confirm({
                            title: 'Kirim ke Supplier?',
                            message: `Konfirmasi pengiriman fisik barang retur
                                <strong>${r.retur_number}</strong> ke supplier
                                <strong>${r.supplier?.name ?? '-'}</strong>?
                                <br><span class="text-xs text-gray-500">
                                Stok akan berkurang setelah dikonfirmasi.</span>`,
                            labelOk: 'Ya, Kirim',
                            onOk: async () => {
                                try {
                                    Modal.close()
                                    await _submitSend(r.id)
                                } catch (err) {
                                    Toast.show('Gagal: ' + err.message, 'error')
                                }
                            },
                        })
                    })
                }
            },
        })
    } catch (err) {
        Loading.hide()
        Toast.show('Gagal memuat detail: ' + err.message, 'error')
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SUBMIT APPROVE  (SUBMITTED → APPROVED)
//  BE: POST /purchase-retur/approve
//  Body: { retur_id, user_id, retur_action, notes }
// ═══════════════════════════════════════════════════════════════════════════

async function _submitApprove(id, returAction, notes = null) {
    Loading.show('Memproses approval...')
    try {
        const res = await Http.post('/purchase-retur/approve', {
            retur_id: id,
            user_id: user?.user_id ?? user?.id ?? null,
            retur_action: returAction,
            notes: notes,
        })
        Toast.show(`Retur ${res?.data?.doc_number ?? ''} berhasil di-approve. ✓`, 'success')
        loadData()
    } catch (err) {
        Toast.show('Gagal approve: ' + err.message, 'error')
    } finally {
        Loading.hide()
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SUBMIT SEND  (APPROVED → SENT)
//  BE: POST /purchase-retur/send
//  Body: { retur_id, user_id, notes }
// ═══════════════════════════════════════════════════════════════════════════

async function _submitSend(id, notes = null) {
    Loading.show('Mengirim retur ke supplier...')
    try {
        const res = await Http.post('/purchase-retur/send', {
            retur_id: id,
            user_id: user?.user_id ?? user?.id ?? null,
            notes: notes,
        })
        Toast.show(`Retur ${res?.data?.doc_number ?? ''} berhasil dikirim ke supplier. ✓`, 'success')
        loadData()
    } catch (err) {
        Toast.show('Gagal mengirim: ' + err.message, 'error')
    } finally {
        Loading.hide()
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SUBMIT REJECT  (SUBMITTED|APPROVED → REJECTED)
//  BE: POST /purchase-retur/reject
//  Body: { retur_id, user_id, reason }
// ═══════════════════════════════════════════════════════════════════════════

async function _submitReject(id, reason) {
    Loading.show('Memproses penolakan...')
    try {
        const res = await Http.post('/purchase-retur/reject', {
            retur_id: id,
            user_id: user?.user_id ?? user?.id ?? null,
            reason: reason,
        })
        Toast.show(`Retur ${res?.data?.doc_number ?? ''} berhasil ditolak.`, 'success')
        loadData()
    } catch (err) {
        Toast.show('Gagal menolak: ' + err.message, 'error')
    } finally {
        Loading.hide()
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  EVENTS
// ═══════════════════════════════════════════════════════════════════════════

$('#input-search').on('input', function () {
    _query = $(this).val().trim()
    applyFilter()
})

$('#btn-refresh').on('click', loadData)
$('#btn-history-retur').on('click', () => _showHistoryRetur())

$(document).on('click', '[data-action]', function () {
    const action = $(this).data('action')
    const id = +$(this).data('id')
    if (action === 'view-retur') _showDetailRetur(id)
})

// ═══════════════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════════════

loadData()