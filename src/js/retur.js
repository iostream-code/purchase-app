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
const FINISH_STATUSES = ['SENT']

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
        // History Retur — hanya status SENT (sudah dikirim ke supplier)
        // Menggunakan endpoint /purchase-retur/history
        const res = await Http.post('/purchase-retur/history', {
            status_filter: 'SENT',
        })
        const data = Array.isArray(res?.data) ? res.data : []

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
                        <td class="py-1.5 px-2 text-center border border-gray-100">
                            <button data-action="view-retur-photos"
                                    data-id="${r.id}" data-number="${r.retur_number ?? ''}"
                                class="h-6 w-6 flex items-center justify-center rounded border border-gray-200
                                       bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-blue-600
                                       hover:border-blue-200 transition mx-auto"
                                title="Foto Penerimaan">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                </svg>
                            </button>
                        </td>
                    </tr>`
            }).join('')
            : '<tr><td colspan="8" class="text-center py-4 text-gray-400 text-xs">Tidak ada retur yang telah dikirim</td></tr>'

        Modal.open({
            title: 'Riwayat Retur (Terkirim)',
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
                                <th class="py-1.5 px-2 border border-gray-200 text-center">Foto</th>
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
                $('#modal-body').on('click', '[data-action="view-retur-photos"]', function (e) {
                    e.stopPropagation()
                    const id = +$(this).data('id')
                    const num = $(this).data('number')
                    Modal.close()
                    setTimeout(() => _showReturPhotos(id, num), 220)
                })
            },
            onClose: () => {
                $('#modal-body').off('click', '[data-action="view-retur-history"]')
                $('#modal-body').off('click', '[data-action="view-retur-photos"]')
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
                            ${d.material?.name ?? '-'} |
                            <span class="text-gray-500 ml-1">${d.material?.unit?.code ?? ''}</span>
                        </td>
                        ${qtyCell}
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

        // ── Info disposition dihapus — keputusan tampil di header modal ────
        const dispositionInfo = ''

        // ── Section upload bukti transfer (REFUND + APPROVED) ─────────────
        const refundSection = (r.status === 'APPROVED' && r.retur_action === 'REFUND') ? `
            <div class="border-t pt-3 mt-1">
                <p class="text-xs font-bold text-gray-600 mb-2">Bukti Transfer Refund</p>
                ${r.refund_proof_url ? `
                <div class="mb-2 flex items-center gap-2">
                    <a href="${r.refund_proof_url}" target="_blank"
                       class="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                        </svg>
                        Lihat bukti sebelumnya
                    </a>
                </div>` : ''}
                <div class="flex items-center gap-2">
                    <label class="flex-1">
                        <div class="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300
                                    rounded-lg bg-gray-50 hover:bg-blue-50 hover:border-blue-300
                                    transition cursor-pointer">
                            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                            </svg>
                            <span id="refund-file-label" class="text-xs text-gray-400">
                                Pilih foto / PDF bukti transfer...
                            </span>
                        </div>
                        <input id="refund-file-input" type="file"
                               accept="image/*,.pdf" class="hidden">
                    </label>
                    <button id="btn-upload-refund"
                        class="h-9 px-3 rounded-lg bg-green-600 hover:bg-green-700
                               text-white text-xs font-medium transition whitespace-nowrap disabled:opacity-40"
                        disabled>
                        Upload
                    </button>
                </div>
                <p class="text-xs text-gray-400 mt-1">Format: JPG, PNG, atau PDF. Maks 5MB.</p>
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
                        Data | ${items.length}
                    </p>
                    <div class="overflow-x-auto max-h-48">
                        <table class="w-full text-xs">
                            <thead class="bg-gray-50 text-gray-500 sticky top-0">
                                <tr>
                                    <th class="py-1 px-2 text-left w-6">No</th>
                                    <th class="py-1 px-2 text-left">Material</th>
                                    <th class="py-1 px-2 text-right">Qty</th>
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

                <!-- Section upload bukti refund -->
                ${refundSection}
            </div>`

        // ── Tombol footer ─────────────────────────────────────────────────
        const approveActions = canApprove ? `
            <button id="modal-btn-reject"
                class="h-8 px-4 rounded-lg border border-red-200
                       text-sm font-medium text-red-500 hover:bg-red-50 transition">
                Tolak
            </button>
            <button id="modal-btn-submit-approval"
                class="h-8 px-4 rounded-lg bg-green-600 hover:bg-green-700
                       text-white text-sm font-medium transition">
                Simpan
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
                        // REPLACEMENT → buka form ekspedisi dulu sebelum kirim
                        if (r.retur_action === 'REPLACEMENT') {
                            Modal.form({
                                title: 'Pengiriman Retur ke Supplier',
                                formHtml: `
                                    <p class="text-xs text-gray-500 mb-3">
                                        Isi data ekspedisi untuk pengiriman barang retur
                                        <strong>${r.retur_number}</strong> ke
                                        <strong>${r.supplier?.name ?? '-'}</strong>.
                                    </p>
                                    <div class="flex flex-col gap-3">
                                        <div>
                                            <label class="block text-xs font-medium text-gray-600 mb-1">
                                                Ekspedisi <span class="text-red-500">*</span>
                                            </label>
                                            <input id="form-expedition-name" type="text"
                                                placeholder="Contoh: JNE, TIKI, SiCepat, Wahana..."
                                                class="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5
                                                       focus:outline-none focus:ring-2 focus:ring-blue-200">
                                        </div>
                                        <div>
                                            <label class="block text-xs font-medium text-gray-600 mb-1">
                                                No. Resi / Tracking
                                            </label>
                                            <input id="form-tracking-number" type="text"
                                                placeholder="Nomor resi pengiriman (opsional)"
                                                class="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5
                                                       focus:outline-none focus:ring-2 focus:ring-blue-200">
                                        </div>
                                        <div>
                                            <label class="block text-xs font-medium text-gray-600 mb-1">
                                                Catatan
                                            </label>
                                            <textarea id="form-send-notes" rows="2"
                                                placeholder="Catatan tambahan (opsional)"
                                                class="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5
                                                       focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"></textarea>
                                        </div>
                                    </div>`,
                                labelSubmit: 'Konfirmasi Kirim',
                                onSubmit: async () => {
                                    const expedition = $('#form-expedition-name').val().trim()
                                    if (!expedition) {
                                        Toast.show('Nama ekspedisi wajib diisi.', 'error')
                                        $('#form-expedition-name').addClass('ring-2 ring-red-400')
                                        return
                                    }
                                    const tracking = $('#form-tracking-number').val().trim() || null
                                    const notes = $('#form-send-notes').val().trim() || null
                                    try {
                                        Modal.close()
                                        await _submitSend(r.id, {
                                            expedition_name: expedition,
                                            tracking_number: tracking,
                                            notes,
                                        })
                                    } catch (err) {
                                        Toast.show('Gagal mengirim: ' + err.message, 'error')
                                    }
                                },
                            })
                        } else {
                            // Selain REPLACEMENT — konfirmasi langsung
                            Modal.confirm({
                                title: 'Konfirmasi Pengiriman',
                                message: `Konfirmasi pengiriman retur
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
                        }
                    })
                }

                // ── Upload bukti refund ────────────────────────────────────
                if (r.status === 'APPROVED' && r.retur_action === 'REFUND') {
                    $('#refund-file-input').on('change', function () {
                        const file = this.files[0]
                        if (!file) return
                        if (file.size > 5 * 1024 * 1024) {
                            Toast.show('File terlalu besar. Maksimal 5MB.', 'error')
                            this.value = ''
                            return
                        }
                        $('#refund-file-label').text(file.name)
                        $('#btn-upload-refund').prop('disabled', false)
                    })

                    $('#btn-upload-refund').on('click', async function () {
                        const file = $('#refund-file-input')[0].files[0]
                        if (!file) return
                        try {
                            await _uploadRefundProof(r.id, file)
                            $('#refund-file-label').text('Pilih foto / PDF bukti transfer...')
                            $('#refund-file-input').val('')
                            $('#btn-upload-refund').prop('disabled', true)
                        } catch { /* error sudah ditangani di _uploadRefundProof */ }
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
//  Body: { retur_id, user_id, expedition_name?, tracking_number?, notes? }
// ═══════════════════════════════════════════════════════════════════════════

async function _submitSend(id, payload = {}) {
    Loading.show('Mengirim retur ke supplier...')
    try {
        const res = await Http.post('/purchase-retur/send', {
            retur_id: id,
            user_id: user?.user_id ?? user?.id ?? null,
            ...payload,
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
//  UPLOAD BUKTI TRANSFER REFUND
//  BE: POST /purchase-retur/upload-refund  (multipart/form-data)
//  Body: FormData { retur_id, file }
// ═══════════════════════════════════════════════════════════════════════════

async function _uploadRefundProof(returId, file) {
    Loading.show('Mengupload bukti transfer...')
    try {
        const token = localStorage.getItem('auth_token')
        const formData = new FormData()
        formData.append('retur_id', returId)
        formData.append('file', file)
        const res = await fetch(
            `${import.meta.env.VITE_API_BASE_URL ?? ''}/purchase-retur/upload-refund`,
            { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData }
        )
        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.message ?? `HTTP ${res.status}`)
        }
        Toast.show('Bukti transfer berhasil diupload. ✓', 'success')
        return await res.json()
    } catch (err) {
        Toast.show('Gagal upload: ' + err.message, 'error')
        throw err
    } finally {
        Loading.hide()
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  LIHAT FOTO PENERIMAAN BARANG RETUR
//  BE: GET /purchase-retur/{id}/photos
//  Response: { data: [{ url, caption, uploaded_at }] }
// ═══════════════════════════════════════════════════════════════════════════

async function _showReturPhotos(id, returNumber) {
    Loading.show('Memuat foto...')
    try {
        const res = await Http.get(`/purchase-retur/${id}/photos`)
        const photos = Array.isArray(res?.data) ? res.data : []
        Loading.hide()
        const photosHtml = photos.length
            ? `<div class="grid grid-cols-2 gap-2">
                ${photos.map(p => `
                    <div class="rounded-lg overflow-hidden border border-gray-100">
                        <img src="${p.url}" alt="${p.caption ?? 'Foto'}"
                            class="w-full object-cover aspect-square cursor-pointer"
                            onclick="window.open('${p.url}', '_blank')" />
                        ${p.caption || p.uploaded_at ? `
                        <div class="px-2 py-1 bg-gray-50 text-xs text-gray-400 truncate">
                            ${p.caption ?? ''} ${p.uploaded_at ? Format.date(p.uploaded_at) : ''}
                        </div>` : ''}
                    </div>`).join('')}
               </div>`
            : `<div class="py-10 text-center text-gray-400 text-sm">Belum ada foto penerimaan.</div>`
        Modal.open({
            title: `Foto Penerimaan — ${returNumber}`,
            body: photosHtml,
            actions: `<button id="modal-btn-ok"
                class="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700
                       text-white text-sm font-medium transition">Tutup</button>`,
            onOpen: () => { $('#modal-btn-ok').one('click', () => Modal.close()) },
        })
    } catch (err) {
        Loading.hide()
        Toast.show('Gagal memuat foto: ' + err.message, 'error')
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