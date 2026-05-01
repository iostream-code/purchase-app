import $ from 'jquery'
import { requireAuth, getAuthUser, logout } from './auth.js'
import { Http, Format, Toast, Loading, Modal, injectSharedUI, startClock, startConnectionCheck, injectHeader } from './global.js'

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

// ─────────────────────────────────────────────────────────────
//  State
// ─────────────────────────────────────────────────────────────
let _allRetur = []
let _query = ''
let _statusTab = 'all'   // 'all' | 'submitted' | 'approved'

// ─────────────────────────────────────────────────────────────
//  Konstanta status — sesuai BE (SUBMITTED / APPROVED / SENT, dst.)
// ─────────────────────────────────────────────────────────────
const STATUS_BG = {
    SUBMITTED: 'bg-yellow-50',
    APPROVED: 'bg-green-50',
    SENT: 'bg-blue-50',
    REJECTED: 'bg-red-50',
}
const STATUS_TEXT = {
    SUBMITTED: 'text-yellow-700',
    APPROVED: 'text-green-700',
    SENT: 'text-blue-700',
    REJECTED: 'text-red-600',
}
const STATUS_LABEL = {
    SUBMITTED: 'Menunggu Approval',
    APPROVED: 'Disetujui',
    SENT: 'Dikirim',
    PARTIAL_REPLACED: 'Sebagian Diganti',
    REPLACED: 'Sudah Diganti',
    CLOSED: 'Selesai',
    REJECTED: 'Ditolak',
    CANCELLED: 'Dibatalkan',
}

const ACTION_LABEL = {
    REPLACEMENT: 'Pengganti',
    REFUND: 'Refund',
    SCRAP: 'Dimusnahkan',
    WRITE_OFF: 'Write-off',
}
const ACTION_COLOR = {
    REPLACEMENT: 'text-blue-600',
    REFUND: 'text-green-600',
    SCRAP: 'text-orange-500',
    WRITE_OFF: 'text-gray-500',
}

// ─────────────────────────────────────────────────────────────
//  Badge helpers
// ─────────────────────────────────────────────────────────────
function statusBadge(status) {
    const cls = STATUS_TEXT[status] ?? 'text-gray-500'
    const label = STATUS_LABEL[status] ?? status
    return `<span class="inline-block text-xs px-2 py-0.5 rounded-full font-medium ${cls}">${label}</span>`
}

function actionBadge(action) {
    if (!action) return '-'
    const cls = ACTION_COLOR[action] ?? 'text-gray-500'
    const label = ACTION_LABEL[action] ?? action
    return `<span class="inline-block text-xs px-2 py-0.5 rounded-full font-medium border border-current ${cls}">${label}</span>`
}

// ─────────────────────────────────────────────────────────────
//  Action buttons — kontekstual per status
// ─────────────────────────────────────────────────────────────
function actionButtons(id, status) {
    const detailBtn = `
        <button data-action="view" data-id="${id}" title="Lihat detail"
            class="h-7 px-3 flex items-center justify-center rounded-md border border-gray-200
                   text-xs font-bold text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition">
            DETAIL
        </button>`

    if (status === 'SUBMITTED') {
        return `<div class="flex justify-center gap-1">
            ${detailBtn}
            <button data-action="approve" data-id="${id}" title="Approve"
                class="h-7 px-3 flex items-center justify-center rounded-md
                       bg-green-600 hover:bg-green-700 text-xs font-bold text-white transition">
                APPROVE
            </button>
            <button data-action="reject" data-id="${id}" title="Reject"
                class="h-7 px-3 flex items-center justify-center rounded-md border border-red-200
                       text-xs font-bold text-red-500 hover:bg-red-50 transition">
                REJECT
            </button>
        </div>`
    }

    if (status === 'APPROVED') {
        return `<div class="flex justify-center gap-1">
            ${detailBtn}
            <button data-action="send" data-id="${id}" title="Kirim ke supplier"
                class="h-7 px-3 flex items-center justify-center rounded-md
                       bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white transition">
                KIRIM
            </button>
            <button data-action="reject" data-id="${id}" title="Reject"
                class="h-7 px-3 flex items-center justify-center rounded-md border border-red-200
                       text-xs font-bold text-red-500 hover:bg-red-50 transition">
                REJECT
            </button>
        </div>`
    }

    return `<div class="flex justify-center gap-1">${detailBtn}</div>`
}

// ─────────────────────────────────────────────────────────────
//  Render tabel inbox
// ─────────────────────────────────────────────────────────────
function renderTable(data) {
    const $tbody = $('#tbl-body').empty()
    $('#badge-count').text(data.length)

    if (!data.length) {
        $('#empty-state').removeClass('hidden')
        return
    }
    $('#empty-state').addClass('hidden')

    data.forEach((r, i) => {
        const supplierName = r.supplier?.name ?? '-'
        const poNumber = r.purchase_order?.po_number ?? '-'
        const totalQty = r.total_qty ?? 0

        $tbody.append(`
            <tr class="border-t border-gray-100 hover:bg-gray-50 transition">
                <td class="px-3 py-2.5 text-center text-gray-400 text-xs border border-gray-200">${i + 1}</td>
                <td class="px-3 py-2.5 font-medium text-gray-800 text-xs border border-gray-200 whitespace-nowrap">${r.retur_number}</td>
                <td class="px-3 py-2.5 text-gray-600 text-xs truncate border border-gray-200">${poNumber}</td>
                <td class="px-3 py-2.5 text-gray-600 text-xs truncate border border-gray-200">${supplierName}</td>
                <td class="px-3 py-2.5 text-center text-gray-500 text-xs border border-gray-200 whitespace-nowrap">${Format.date(r.retur_date)}</td>
                <td class="px-3 py-2.5 text-center text-gray-700 tabular-nums text-xs border border-gray-200">${Format.number(totalQty)}</td>
                <td class="px-3 py-2.5 text-center border border-gray-200">${actionBadge(r.retur_action)}</td>
                <td class="px-3 py-2.5 text-center border border-gray-200 ${STATUS_BG[r.status] ?? ''}">${statusBadge(r.status)}</td>
                <td class="px-3 py-2.5 border border-gray-200">${actionButtons(r.id, r.status)}</td>
            </tr>`)
    })
}

// ─────────────────────────────────────────────────────────────
//  Filter lokal
// ─────────────────────────────────────────────────────────────
function applyFilter() {
    const q = _query.toLowerCase()
    const filtered = _allRetur.filter(r => {
        const matchSearch = !q
            || (r.retur_number ?? '').toLowerCase().includes(q)
            || (r.purchase_order?.po_number ?? '').toLowerCase().includes(q)
            || (r.supplier?.name ?? '').toLowerCase().includes(q)
        return matchSearch
    })
    renderTable(filtered)
}

// ─────────────────────────────────────────────────────────────
//  Dummy data — hapus blok ini saat BE sudah siap
// ─────────────────────────────────────────────────────────────
const DUMMY_RETUR = [
    {
        id: 1,
        retur_number: 'RTR-2025-0001',
        retur_date: '2025-04-20',
        retur_action: 'REPLACEMENT',
        status: 'SUBMITTED',
        total_qty: 5,
        notes: 'Barang datang dalam kondisi rusak',
        rejected_reason: null,
        supplier: { name: 'PT Sumber Makmur Abadi' },
        purchase_order: { po_number: 'PO-2025-0421' },
        receive: { receive_number: 'RCV-2025-0089' },
        warehouse: { name: 'Gudang Utama' },
        requester: { username: 'ahmad.fauzi' },
        details: [
            { material: { code: 'MAT-001', name: 'Kertas HVS A4 80gr', unit: { code: 'Rim' } }, qty_returned: 3, unit_price: 45000, condition_status: 'DAMAGED' },
            { material: { code: 'MAT-002', name: 'Map Plastik A4', unit: { code: 'Pack' } }, qty_returned: 2, unit_price: 15000, condition_status: 'WRONG_SPEC' },
        ],
    },
    {
        id: 2,
        retur_number: 'RTR-2025-0002',
        retur_date: '2025-04-22',
        retur_action: 'REFUND',
        status: 'APPROVED',
        total_qty: 2,
        notes: null,
        rejected_reason: null,
        supplier: { name: 'CV Jaya Abadi Sentosa' },
        purchase_order: { po_number: 'PO-2025-0418' },
        receive: { receive_number: 'RCV-2025-0085' },
        warehouse: { name: 'Gudang Utama' },
        requester: { username: 'dewi.lestari' },
        details: [
            { material: { code: 'MAT-010', name: 'Pulpen Pilot G-2 Hitam', unit: { code: 'Lusin' } }, qty_returned: 2, unit_price: 72000, condition_status: 'WRONG_SPEC' },
        ],
    },
    {
        id: 3,
        retur_number: 'RTR-2025-0003',
        retur_date: '2025-04-24',
        retur_action: 'SCRAP',
        status: 'REJECTED',
        total_qty: 3,
        notes: 'Barang tidak sesuai spesifikasi PO',
        rejected_reason: 'Bukti foto kondisi barang tidak dilampirkan, harap ajukan ulang dengan dokumentasi lengkap.',
        supplier: { name: 'PT Global Office Supply' },
        purchase_order: { po_number: 'PO-2025-0415' },
        receive: { receive_number: 'RCV-2025-0081' },
        warehouse: { name: 'Gudang Cadangan' },
        requester: { username: 'budi.santoso' },
        details: [
            { material: { code: 'MAT-021', name: 'Gunting Besar Stainless', unit: { code: 'Pcs' } }, qty_returned: 3, unit_price: 18000, condition_status: 'OTHER' },
        ],
    },
    {
        id: 4,
        retur_number: 'RTR-2025-0004',
        retur_date: '2025-04-28',
        retur_action: 'REFUND',
        status: 'SUBMITTED',
        total_qty: 4,
        notes: 'Produk sudah kedaluwarsa saat diterima',
        rejected_reason: null,
        supplier: { name: 'PT Sumber Makmur Abadi' },
        purchase_order: { po_number: 'PO-2025-0421' },
        receive: { receive_number: 'RCV-2025-0090' },
        warehouse: { name: 'Gudang Utama' },
        requester: { username: 'ahmad.fauzi' },
        details: [
            { material: { code: 'MAT-005', name: 'Tinta Printer Epson L3150 Hitam', unit: { code: 'Botol' } }, qty_returned: 4, unit_price: 85000, condition_status: 'EXPIRED' },
        ],
    },
    {
        id: 5,
        retur_number: 'RTR-2025-0005',
        retur_date: '2025-04-30',
        retur_action: 'WRITE_OFF',
        status: 'SENT',
        total_qty: 10,
        notes: null,
        rejected_reason: null,
        supplier: { name: 'UD Mitra Sejahtera' },
        purchase_order: { po_number: 'PO-2025-0410' },
        receive: { receive_number: 'RCV-2025-0077' },
        warehouse: { name: 'Gudang Utama' },
        requester: { username: 'siti.rahayu' },
        details: [
            { material: { code: 'MAT-033', name: 'Buku Tulis 58 Lembar', unit: { code: 'Lusin' } }, qty_returned: 6, unit_price: 36000, condition_status: 'DAMAGED' },
            { material: { code: 'MAT-034', name: 'Buku Tulis 38 Lembar', unit: { code: 'Lusin' } }, qty_returned: 4, unit_price: 28000, condition_status: 'DAMAGED' },
        ],
    },
]

// ─────────────────────────────────────────────────────────────
//  Load inbox — pakai dummy, ganti dengan Http.post saat BE siap
// ─────────────────────────────────────────────────────────────
async function loadInbox() {
    Loading.show('Memuat data retur...')
    animateRefreshIcon()
    try {
        // ── DUMMY ──────────────────────────────────────────
        await new Promise(r => setTimeout(r, 300)) // simulasi network delay
        const filtered = _statusTab === 'all'
            ? DUMMY_RETUR
            : DUMMY_RETUR.filter(r => r.status === _statusTab.toUpperCase())
        _allRetur = filtered
        // ── Ganti blok di atas dengan ini saat BE siap: ───
        // const res = await Http.post('/purchase-retur/inbox', {
        //     status_filter: _statusTab,
        //     search: _query || undefined,
        // })
        // _allRetur = res?.data ?? res ?? []
        // ──────────────────────────────────────────────────
        applyFilter()
    } catch (err) {
        Toast.show('Gagal memuat data: ' + err.message, 'error')
    } finally {
        Loading.hide()
    }
}

function animateRefreshIcon() {
    $('#btn-refresh svg').css({ transition: 'transform .5s', transform: 'rotate(360deg)' })
    setTimeout(() => $('#btn-refresh svg').css({ transition: '', transform: '' }), 500)
}

// ─────────────────────────────────────────────────────────────
//  MODAL DETAIL
// ─────────────────────────────────────────────────────────────
async function openDetail(id) {
    Loading.show('Memuat detail retur...')
    try {
        // ── DUMMY ──────────────────────────────────────────
        await new Promise(resolve => setTimeout(resolve, 200))
        const r = DUMMY_RETUR.find(x => x.id === id)
        // ── Ganti blok di atas dengan ini saat BE siap: ───
        // const res = await Http.post('/purchase-retur/detail', { retur_id: id })
        // const r = res?.data ?? res
        // ──────────────────────────────────────────────────
        Loading.hide()
        showDetailModal(r)
    } catch (err) {
        Loading.hide()
        Toast.show('Gagal memuat detail: ' + err.message, 'error')
    }
}

function renderDetailItems(details = []) {
    if (!details.length) return '<p class="text-xs text-gray-400 italic">Tidak ada item.</p>'

    const rows = details.map((d, i) => {
        const matCode = d.material?.code ?? '-'
        const matName = d.material?.name ?? '-'
        const unit = d.material?.unit?.code ?? '-'
        const subtotal = (d.qty_returned ?? 0) * (d.unit_price ?? 0)

        return `
            <tr class="border-t border-gray-100">
                <td class="py-1.5 px-2 text-center text-gray-400 text-xs">${i + 1}</td>
                <td class="py-1.5 px-2 text-xs text-gray-500">${matCode}</td>
                <td class="py-1.5 px-2 text-gray-700 text-xs">${matName}</td>
                <td class="py-1.5 px-2 text-center text-gray-500 text-xs">${Format.number(d.qty_returned)}</td>
                <td class="py-1.5 px-2 text-center text-gray-400 text-xs">${unit}</td>
                <td class="py-1.5 px-2 text-right text-gray-700 tabular-nums text-xs">${Format.currency(d.unit_price ?? 0)}</td>
                <td class="py-1.5 px-2 text-right text-gray-800 tabular-nums text-xs font-medium">${Format.currency(subtotal)}</td>
                <td class="py-1.5 px-2 text-center text-xs">
                    <span class="px-1.5 py-0.5 rounded text-xs ${conditionClass(d.condition_status)}">
                        ${d.condition_status ?? '-'}
                    </span>
                </td>
            </tr>`
    }).join('')

    return `
        <table class="w-full text-xs border-collapse mt-1">
            <thead class="bg-gray-50 text-gray-500">
                <tr>
                    <th class="py-1.5 px-2 text-center border border-gray-200 w-7">No</th>
                    <th class="py-1.5 px-2 text-left border border-gray-200 w-16">Kode</th>
                    <th class="py-1.5 px-2 text-left border border-gray-200">Nama Barang</th>
                    <th class="py-1.5 px-2 text-center border border-gray-200 w-12">Qty</th>
                    <th class="py-1.5 px-2 text-center border border-gray-200 w-12">Sat</th>
                    <th class="py-1.5 px-2 text-right border border-gray-200 w-24">Harga</th>
                    <th class="py-1.5 px-2 text-right border border-gray-200 w-24">Subtotal</th>
                    <th class="py-1.5 px-2 text-center border border-gray-200 w-20">Kondisi</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`
}

function conditionClass(cond) {
    return {
        DAMAGED: 'bg-red-50 text-red-600',
        WRONG_SPEC: 'bg-orange-50 text-orange-600',
        EXPIRED: 'bg-yellow-50 text-yellow-700',
        OTHER: 'bg-gray-100 text-gray-500',
    }[cond] ?? 'bg-gray-100 text-gray-500'
}

function showDetailModal(r) {
    const totalNominal = (r.details ?? []).reduce(
        (s, d) => s + (d.qty_returned ?? 0) * (d.unit_price ?? 0), 0
    )

    // Tentukan tombol aksi di footer modal berdasarkan status
    let actionArea = ''
    if (r.status === 'SUBMITTED') {
        actionArea = `
            <button id="modal-btn-approve"
                class="h-8 px-4 rounded-lg bg-green-600 hover:bg-green-700
                       text-white text-sm font-medium transition">
                Approve
            </button>
            <button id="modal-btn-reject"
                class="h-8 px-4 rounded-lg border border-red-200
                       text-sm font-medium text-red-500 hover:bg-red-50 transition">
                Reject
            </button>`
    } else if (r.status === 'APPROVED') {
        actionArea = `
            <button id="modal-btn-send"
                class="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700
                       text-white text-sm font-medium transition">
                Kirim ke Supplier
            </button>
            <button id="modal-btn-reject"
                class="h-8 px-4 rounded-lg border border-red-200
                       text-sm font-medium text-red-500 hover:bg-red-50 transition">
                Reject
            </button>`
    }

    const body = `
        <div class="space-y-3 text-sm">
            <!-- Info utama -->
            <div class="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                    <p class="text-xs text-gray-400">No Retur</p>
                    <p class="font-semibold text-gray-800">${r.retur_number}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-400">Tanggal</p>
                    <p class="text-gray-700">${Format.date(r.retur_date)}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-400">Ref PO</p>
                    <p class="text-gray-700">${r.purchase_order?.po_number ?? '-'}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-400">No Receive</p>
                    <p class="text-gray-700">${r.receive?.receive_number ?? '-'}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-400">Supplier</p>
                    <p class="text-gray-700 font-medium">${r.supplier?.name ?? '-'}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-400">Gudang</p>
                    <p class="text-gray-700">${r.warehouse?.name ?? '-'}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-400">Status</p>
                    <p>${statusBadge(r.status)}</p>
                </div>
                <div>
                    <p class="text-xs text-gray-400">Disposisi</p>
                    <p>${actionBadge(r.retur_action)}</p>
                </div>
                <div class="col-span-2">
                    <p class="text-xs text-gray-400">Diminta oleh</p>
                    <p class="text-gray-700">${r.requester?.username ?? '-'}</p>
                </div>
                ${r.notes ? `
                <div class="col-span-2">
                    <p class="text-xs text-gray-400">Catatan</p>
                    <p class="text-gray-700 text-xs">${r.notes}</p>
                </div>` : ''}
                ${r.rejected_reason ? `
                <div class="col-span-2 bg-red-50 rounded-lg p-2">
                    <p class="text-xs text-red-400 font-medium">Alasan Ditolak</p>
                    <p class="text-red-700 text-xs mt-0.5">${r.rejected_reason}</p>
                </div>` : ''}
            </div>

            <hr class="border-gray-100">

            <!-- Detail item -->
            <div>
                <p class="text-xs font-medium text-gray-500 mb-1.5">Detail Item</p>
                ${renderDetailItems(r.details ?? [])}
            </div>

            <!-- Total nominal -->
            <div class="flex justify-end pt-1">
                <div class="text-right">
                    <p class="text-xs text-gray-400">Total Nilai</p>
                    <p class="text-base font-bold text-gray-800">${Format.currency(totalNominal)}</p>
                </div>
            </div>
        </div>`

    Modal.open({
        title: `Detail Retur — ${r.retur_number}`,
        body,
        actions: `
            ${actionArea}
            <button id="modal-btn-close"
                class="h-8 px-4 rounded-lg bg-gray-100 hover:bg-gray-200
                       text-gray-700 text-sm font-medium transition">
                Tutup
            </button>`,
        onOpen: () => {
            $('#modal-btn-close').one('click', () => Modal.close())

            if (r.status === 'SUBMITTED') {
                $('#modal-btn-approve').one('click', () => {
                    Modal.close()
                    openApproveForm(r.id, r.retur_number)
                })
                $('#modal-btn-reject').one('click', () => {
                    Modal.close()
                    openRejectForm(r.id, r.retur_number)
                })
            } else if (r.status === 'APPROVED') {
                $('#modal-btn-send').one('click', () => {
                    Modal.close()
                    confirmSend(r.id, r.retur_number)
                })
                $('#modal-btn-reject').one('click', () => {
                    Modal.close()
                    openRejectForm(r.id, r.retur_number)
                })
            }
        },
    })
}

// ─────────────────────────────────────────────────────────────
//  APPROVE — form pilih disposisi + opsional catatan
// ─────────────────────────────────────────────────────────────
function openApproveForm(id, docNumber) {
    const formHtml = `
        <div class="space-y-3 text-sm">
            <p class="text-gray-600">
                Approve retur <span class="font-semibold">${docNumber}</span>?
            </p>

            <!-- Disposisi -->
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">
                    Disposisi <span class="text-red-500">*</span>
                </label>
                <select id="approve-action"
                    class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
                    <option value="REPLACEMENT">Pengganti (Replacement)</option>
                    <option value="REFUND">Refund</option>
                    <option value="SCRAP">Dimusnahkan (Scrap)</option>
                    <option value="WRITE_OFF">Write-off</option>
                </select>
            </div>

            <!-- Catatan opsional -->
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Catatan (opsional)</label>
                <textarea id="approve-notes" rows="2" placeholder="Tambahkan catatan jika perlu..."
                    class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"></textarea>
            </div>
        </div>`

    Modal.form({
        title: 'Approve Retur',
        formHtml,
        labelSubmit: 'Approve',
        onSubmit: () => submitApprove(id),
    })
}

async function submitApprove(id) {
    const returAction = $('#approve-action').val()
    const notes = $('#approve-notes').val().trim() || null

    Modal.close()
    Loading.show('Memproses approval...')
    try {
        // ── DUMMY ──────────────────────────────────────────
        await new Promise(resolve => setTimeout(resolve, 400))
        const item = DUMMY_RETUR.find(x => x.id === id)
        if (item) { item.status = 'APPROVED'; item.retur_action = returAction; item.notes = notes }
        // ── Ganti blok di atas dengan ini saat BE siap: ───
        // await Http.post('/purchase-retur/approve', {
        //     retur_id: id, user_id: user?.id ?? null, retur_action: returAction, notes,
        // })
        // ──────────────────────────────────────────────────
        Toast.show('Retur berhasil di-approve', 'success')
        await loadInbox()
    } catch (err) {
        Toast.show('Gagal approve: ' + err.message, 'error')
    } finally {
        Loading.hide()
    }
}

// ─────────────────────────────────────────────────────────────
//  SEND — konfirmasi + opsional no. resi
// ─────────────────────────────────────────────────────────────
function confirmSend(id, docNumber) {
    const formHtml = `
        <div class="space-y-3 text-sm">
            <p class="text-gray-600">
                Konfirmasi pengiriman retur <span class="font-semibold">${docNumber}</span> ke supplier?
                <br><span class="text-xs text-gray-400">Stok akan langsung dikurangi setelah dikirim.</span>
            </p>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">No. Resi / Catatan Pengiriman (opsional)</label>
                <textarea id="send-notes" rows="2" placeholder="Misal: nomor resi JNE, nama kurir, dll."
                    class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"></textarea>
            </div>
        </div>`

    Modal.form({
        title: 'Kirim Retur ke Supplier',
        formHtml,
        labelSubmit: 'Konfirmasi Kirim',
        onSubmit: () => submitSend(id),
    })
}

async function submitSend(id) {
    const notes = $('#send-notes').val().trim() || null

    Modal.close()
    Loading.show('Memproses pengiriman...')
    try {
        // ── DUMMY ──────────────────────────────────────────
        await new Promise(resolve => setTimeout(resolve, 400))
        const item = DUMMY_RETUR.find(x => x.id === id)
        if (item) { item.status = 'SENT'; item.notes = notes }
        // ── Ganti blok di atas dengan ini saat BE siap: ───
        // await Http.post('/purchase-retur/send', {
        //     retur_id: id, user_id: user?.id ?? null, notes,
        // })
        // ──────────────────────────────────────────────────
        Toast.show('Retur berhasil dikirim ke supplier', 'success')
        await loadInbox()
    } catch (err) {
        Toast.show('Gagal mengirim: ' + err.message, 'error')
    } finally {
        Loading.hide()
    }
}

// ─────────────────────────────────────────────────────────────
//  REJECT — wajib isi alasan
// ─────────────────────────────────────────────────────────────
function openRejectForm(id, docNumber) {
    const formHtml = `
        <div class="space-y-3 text-sm">
            <p class="text-gray-600">
                Tolak retur <span class="font-semibold">${docNumber}</span>?
                <br><span class="text-xs text-gray-400">Reservasi stok akan dilepas.</span>
            </p>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">
                    Alasan Penolakan <span class="text-red-500">*</span>
                </label>
                <textarea id="reject-reason" rows="3" placeholder="Jelaskan alasan penolakan..."
                    class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                           focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"></textarea>
            </div>
        </div>`

    Modal.form({
        title: 'Tolak Retur',
        formHtml,
        labelSubmit: 'Tolak Retur',
        onOpen: () => {
            // Ganti warna tombol submit jadi merah
            $('#modal-btn-submit')
                .removeClass('bg-blue-600 hover:bg-blue-700')
                .addClass('bg-red-600 hover:bg-red-700')
        },
        onSubmit: () => submitReject(id),
    })
}

async function submitReject(id) {
    const reason = $('#reject-reason').val().trim()
    if (!reason) {
        Toast.show('Alasan penolakan wajib diisi', 'error')
        return
    }

    Modal.close()
    Loading.show('Memproses penolakan...')
    try {
        // ── DUMMY ──────────────────────────────────────────
        await new Promise(resolve => setTimeout(resolve, 400))
        const item = DUMMY_RETUR.find(x => x.id === id)
        if (item) { item.status = 'REJECTED'; item.rejected_reason = reason }
        // ── Ganti blok di atas dengan ini saat BE siap: ───
        // await Http.post('/purchase-retur/reject', {
        //     retur_id: id, user_id: user?.id ?? null, reason,
        // })
        // ──────────────────────────────────────────────────
        Toast.show('Retur berhasil ditolak', 'success')
        await loadInbox()
    } catch (err) {
        Toast.show('Gagal menolak: ' + err.message, 'error')
    } finally {
        Loading.hide()
    }
}

// ─────────────────────────────────────────────────────────────
//  Tab filter status
// ─────────────────────────────────────────────────────────────
function setActiveTab(tab) {
    _statusTab = tab

    // Update style tab
    $('[data-tab]').each(function () {
        const isActive = $(this).data('tab') === tab
        $(this)
            .toggleClass('bg-blue-600 text-white border-blue-600', isActive)
            .toggleClass('text-gray-600 border-gray-300 hover:bg-gray-100/60', !isActive)
    })

    loadInbox()
}

// ─────────────────────────────────────────────────────────────
//  Event binding
// ─────────────────────────────────────────────────────────────
$('#input-search').on('input', function () {
    _query = $(this).val().trim()
    applyFilter()
})

$('#btn-refresh').on('click', loadInbox)

// Tab filter
$(document).on('click', '[data-tab]', function () {
    setActiveTab($(this).data('tab'))
})

// Row action buttons
$(document).on('click', '[data-action]', function () {
    const action = $(this).data('action')
    const id = +$(this).data('id')

    if (action === 'view') openDetail(id)
    if (action === 'approve') openApproveForm(id, '')  // docNumber dimuat di detail
    if (action === 'send') confirmSend(id, '')
    if (action === 'reject') openRejectForm(id, '')
})

// Cleanup delegasi saat modal ditutup
$(document).on('modal:closed', () => {
    // tidak ada delegasi tambahan di halaman ini — bersih
})

// Patch Modal.close agar trigger event cleanup (ikuti pola retur.js)
const _origClose = Modal.close.bind(Modal)
Modal.close = function () {
    _origClose()
    $(document).trigger('modal:closed')
}

// ─────────────────────────────────────────────────────────────
//  Init
// ─────────────────────────────────────────────────────────────
setActiveTab('all')