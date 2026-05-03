import $ from 'jquery'
import { requireAuth, getAuthUser, logout } from './auth.js'
import { Http, Format, Toast, Loading, Modal, injectSharedUI, startClock, startConnectionCheck, injectHeader } from './global.js'

requireAuth()
injectSharedUI()
injectHeader('purchase-order')
startClock()
startConnectionCheck()

const user = getAuthUser()
$('#header-username').text(user?.name ?? 'Admin PO')
$('#btn-logout').on('click', () => {
    Modal.confirm({
        title: 'Konfirmasi Keluar',
        message: 'Yakin ingin keluar dari aplikasi?',
        labelOk: 'Keluar',
        danger: true,
        onOk: () => logout(),
    })
})

// ─── State ────────────────────────────────────────────────────
// Tab default 'po' — sesuai HTML yang merender tab-po aktif di awal
let _activeTab = 'po'
let _allPO = []
let _allRequest = []
let _query = ''

const _warehouseId = user?.warehouse_id ?? null

// ─── Status mapping ───────────────────────────────────────────
const STATUS_TEXT = {
    DRAFT: 'DRAFT',
    SUBMITTED: 'REQUEST',
    APPROVED: 'BELUM TERIMA',
    PARTIAL_ORDERED: 'SEBAGIAN',
    ORDERED: 'FINISH',
    SENT: 'SENT',
    PARTIAL_RECEIVED: 'SEBAGIAN',
    RECEIVED: 'DITERIMA',
    CLOSED: 'CLOSED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED',
}

const STATUS_BG_CLASS = {
    DRAFT: 'bg-gray-50',
    SUBMITTED: 'bg-orange-50',
    APPROVED: 'bg-gray-50',
    PARTIAL_ORDERED: 'bg-green-50',
    ORDERED: 'bg-blue-50',
    SENT: 'bg-blue-50',
    PARTIAL_RECEIVED: 'bg-green-50',
    RECEIVED: 'bg-blue-50',
    CLOSED: 'bg-gray-100',
    REJECTED: 'bg-red-50',
    CANCELLED: 'bg-red-50',
}

const STATUS_TEXT_CLASS = {
    DRAFT: 'text-gray-500',
    SUBMITTED: 'text-orange-700',
    APPROVED: 'text-gray-700',
    PARTIAL_ORDERED: 'text-green-700',
    ORDERED: 'text-blue-700',
    SENT: 'text-blue-700',
    PARTIAL_RECEIVED: 'text-green-700',
    RECEIVED: 'text-blue-700',
    CLOSED: 'text-gray-600',
    REJECTED: 'text-red-600',
    CANCELLED: 'text-red-600',
}

function badge(status) {
    const label = STATUS_TEXT[status] ?? status
    const textCls = STATUS_TEXT_CLASS[status] ?? 'text-gray-600'
    return `<span class="inline-block text-xs py-0.5 rounded-full font-medium ${textCls}">${label}</span>`
}

// ─── Render tabel PO ──────────────────────────────────────────
function renderPO(data) {
    const $tbody = $('#tbl-body').empty()
    $('#badge-count').text(data.length)
    if (!data.length) { $('#empty-state').removeClass('hidden'); return }
    $('#empty-state').addClass('hidden')

    data.forEach((po, i) => {
        const status = po.status ?? ''
        const bgCls = STATUS_BG_CLASS[status] ?? ''
        $tbody.append(`
            <tr class="border-t border-gray-100 hover:bg-gray-50 transition">
                <td class="px-3 py-1 text-center text-gray-400 text-xs border border-gray-200">${i + 1}</td>
                <td class="px-3 py-1 font-medium text-gray-800 truncate border border-gray-200">${po.po_number ?? '-'}</td>
                <td class="px-3 py-1 text-gray-600 truncate border border-gray-200">${po.supplier_name ?? '-'}</td>
                <td class="px-3 py-1 text-center text-gray-500 text-xs border border-gray-200">${Format.date(po.po_date)}</td>
                <td class="px-3 py-1 text-right text-gray-800 tabular-nums border border-gray-200">${Format.currency(po.grand_total ?? 0)}</td>
                <td class="px-3 py-1 text-center border border-gray-200 whitespace-nowrap ${bgCls}">${badge(status)}</td>
                <td class="px-3 py-1 border border-gray-200">
                    <div class="flex justify-center">
                        <button data-action="view-po" data-id="${po.id}"
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

// ─── Render tabel Request PO ──────────────────────────────────
function renderRequest(data) {
    const $tbody = $('#tbl-body').empty()
    $('#badge-count').text(data.length)
    if (!data.length) { $('#empty-state').removeClass('hidden'); return }
    $('#empty-state').addClass('hidden')

    data.forEach((req, i) => {
        const status = req.status ?? ''
        const bgCls = STATUS_BG_CLASS[status] ?? ''

        $tbody.append(`
            <tr class="border-t border-gray-100 hover:bg-gray-50 transition">
                <td class="px-3 py-1 text-center text-gray-400 text-xs border border-gray-200">${i + 1}</td>
                <td class="px-3 py-1 font-medium text-gray-800 truncate border border-gray-200">${req.pr_number ?? '-'}</td>
                <td class="px-3 py-1 text-gray-600 truncate border border-gray-200">${req.requester_name ?? '-'}</td>
                <td class="px-3 py-1 text-center text-gray-500 text-xs border border-gray-200">${Format.date(req.pr_date)}</td>
                <td class="px-3 py-1 text-center border border-gray-200 whitespace-nowrap ${bgCls}">${badge(status)}</td>
                <td class="px-3 py-1 border border-gray-200">
                    <div class="flex justify-center">
                        <button data-action="view-request" data-id="${req.id}"
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

// ─── Filter client-side ───────────────────────────────────────
function applyFilter() {
    const q = _query.toLowerCase()
    if (_activeTab === 'po') {
        renderPO(_allPO.filter(po =>
            (po.po_number ?? '').toLowerCase().includes(q) ||
            (po.supplier_name ?? '').toLowerCase().includes(q)
        ))
    } else {
        renderRequest(_allRequest.filter(req =>
            (req.pr_number ?? '').toLowerCase().includes(q) ||
            (req.requester_name ?? '').toLowerCase().includes(q)
        ))
    }
}

// ─── Animasi tombol refresh ───────────────────────────────────
function animateRefresh() {
    $('#btn-refresh svg').css({ transition: 'transform .5s', transform: 'rotate(360deg)' })
    setTimeout(() => $('#btn-refresh svg').css({ transition: '', transform: '' }), 500)
}

// ─── Load data ────────────────────────────────────────────────
async function loadData() {
    Loading.show(_activeTab === 'po' ? 'Memuat data PO...' : 'Memuat Request PO...')
    animateRefresh()

    try {
        if (_activeTab === 'po') {
            const params = { per_page: 100 }
            if (_warehouseId) params.warehouse_id = _warehouseId
            const res = await Http.get('/purchase-orders', params)
            const raw = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
            // Halaman utama hanya tampilkan status aktif (bukan ORDERED / RECEIVED)
            _allPO = raw.filter(po => !['ORDERED', 'RECEIVED'].includes(po.status))

        } else {
            const params = { per_page: 100 }
            if (_warehouseId) params.warehouse_id = _warehouseId
            const res = await Http.get('/purchase-requests', params)
            const raw = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
            // Halaman utama hanya tampilkan request yang belum selesai (bukan ORDERED)
            _allRequest = raw.filter(req => req.status !== 'ORDERED')
        }

        applyFilter()

    } catch (err) {
        Toast.show('Gagal memuat data: ' + err.message, 'error')
    } finally {
        Loading.hide()
    }
}

// ─── Toggle toolbar sesuai tab aktif ─────────────────────────
function _syncToolbarButtons() {
    const isPO = _activeTab === 'po'
    $('#btn-history-po').toggle(isPO)
    $('#btn-history-request').toggle(!isPO)
}

// ─── Events ───────────────────────────────────────────────────
$('#input-search').on('input', function () {
    _query = $(this).val().trim()
    applyFilter()
})

$('#btn-refresh').on('click', loadData)
$('#btn-history-po').on('click', () => _showHistoryPO())
$('#btn-history-request').on('click', () => _showHistoryRequest())

$(document).on('click', '[data-action]', function () {
    const action = $(this).data('action')
    const id = $(this).data('id')

    if (action === 'view-po') _showDetailPO(id)
    if (action === 'view-request') _showDetailRequest(id)
    if (action === 'show-po') _showPOsFromRequest(id)
})

document.addEventListener('tab:change', ({ detail }) => {
    _activeTab = detail.tab
    _query = ''
    $('#input-search')
        .val('')
        .attr('placeholder', _activeTab === 'po'
            ? 'Cari nomor PO / supplier...'
            : 'Cari nomor request / requester...'
        )
    _syncToolbarButtons()
    _updateTableLayout()
    loadData()
})

function _updateTableLayout() {
    if (_activeTab === 'po') {
        $('table colgroup').html(`
            <col style="width: 40px">
            <col style="width: 140px">
            <col style="width: 200px">
            <col style="width: 120px">
            <col style="width: 140px">
            <col style="width: 140px">
            <col style="width: 100px">`)
        $('thead tr').html(`
            <th class="px-3 py-2 text-center border border-gray-300">No</th>
            <th class="px-3 py-2 text-center border border-gray-300">No. PO</th>
            <th class="px-3 py-2 text-center border border-gray-300">Supplier</th>
            <th class="px-3 py-2 text-center border border-gray-300">Tanggal</th>
            <th class="px-3 py-2 text-center border border-gray-300">Grand Total</th>
            <th class="px-3 py-2 text-center border border-gray-300">Status</th>
            <th class="px-3 py-2 text-center border border-gray-300">Aksi</th>`)
    } else {
        $('table colgroup').html(`
            <col style="width:40px"><col style="width:150px"><col style="width:160px">
            <col style="width:120px"><col style="width:110px"><col style="width:100px">`)
        $('thead tr').html(`
            <th class="px-3 py-2 text-center border border-gray-300">No</th>
            <th class="px-3 py-2 text-center border border-gray-300">No. Request</th>
            <th class="px-3 py-2 text-center border border-gray-300">Pemohon</th>
            <th class="px-3 py-2 text-center border border-gray-300">Tanggal</th>
            <th class="px-3 py-2 text-center border border-gray-300">Status</th>
            <th class="px-3 py-2 text-center border border-gray-300">Aksi</th>`)
    }
}

// ═════════════════════════════════════════════════════════════════════════════
//  SUPPLIER PICKER (overlay — untuk modal detail / approve)
// ═════════════════════════════════════════════════════════════════════════════
function _showSupplierPicker(currentSupplierId, onSelect) {
    const pickerId = 'supplier-picker-overlay'
    $(`#${pickerId}`).remove()

    Loading.show('Memuat supplier...')

    Http.get('/shared/suppliers', { per_page: 200 })
        .then(res => {
            Loading.hide()
            const suppliers = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])

            $('body').append(`
                <div id="${pickerId}"
                    class="fixed inset-0 z-[999] flex items-end justify-center sm:items-center"
                    style="background:rgba(0,0,0,0.25)">
                    <div class="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
                        <div class="flex items-center justify-between px-4 py-3 border-b">
                            <p class="font-semibold text-sm text-gray-800">Pilih Supplier</p>
                            <button id="sup-picker-close" class="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
                        </div>
                        <div class="px-3 pt-2 pb-1">
                            <input type="text" id="sup-picker-search" placeholder="Cari kode / nama..."
                                class="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5
                                       focus:outline-none focus:ring-2 focus:ring-blue-200">
                        </div>
                        <div id="sup-picker-list" class="overflow-y-auto max-h-64 p-1">
                            ${suppliers.length
                    ? suppliers.map(s => `
                                    <button class="sup-picker-item w-full text-left px-3 py-2 rounded-lg
                                                   hover:bg-blue-50 transition text-xs
                                                   ${s.supplier_id === currentSupplierId ? 'bg-blue-50 text-blue-700' : ''}"
                                            data-id="${s.supplier_id}" data-code="${s.code ?? ''}"
                                            data-name="${s.supplier_nama ?? s.name ?? ''}">
                                        <span class="font-medium">${s.code ?? '-'}</span>
                                        <span class="ml-1 text-gray-500">${s.supplier_nama ?? s.name ?? '-'}</span>
                                    </button>`).join('')
                    : '<p class="text-xs text-gray-400 text-center py-4">Tidak ada supplier.</p>'
                }
                        </div>
                    </div>
                </div>`)

            $('#sup-picker-search').on('input', function () {
                const q = $(this).val().toLowerCase()
                $('#sup-picker-list .sup-picker-item').each(function () {
                    const match = ($(this).data('code') + ' ' + $(this).data('name')).toLowerCase().includes(q)
                    $(this).toggle(match)
                })
            }).trigger('focus')

            $(document).on('click.supPicker', '.sup-picker-item', function () {
                const sup = {
                    id: $(this).data('id'),
                    code: $(this).data('code'),
                    name: $(this).data('name'),
                }
                $(`#${pickerId}`).remove()
                $(document).off('click.supPicker')
                onSelect(sup)
            })

            $('#sup-picker-close, #' + pickerId).on('click', function (e) {
                if (e.target.id === pickerId || e.target.id === 'sup-picker-close') {
                    $(`#${pickerId}`).remove()
                    $(document).off('click.supPicker')
                }
            })
        })
        .catch(err => {
            Loading.hide()
            Toast.show('Gagal memuat supplier: ' + err.message, 'error')
        })
}

// ═════════════════════════════════════════════════════════════════════════════
//  DETAIL REQUEST — dengan kolom harga editable + approve/reject
// ═════════════════════════════════════════════════════════════════════════════
async function _showDetailRequest(id) {
    Loading.show('Memuat detail request...')
    try {
        const res = await Http.get(`/purchase-requests/${id}`)
        const pr = res.data
        const items = pr.items ?? []

        // Apakah bisa diedit (harga & qty)
        const canEdit = ['DRAFT', 'SUBMITTED', 'PARTIAL_ORDERED'].includes(pr.status)
        const canApprove = ['SUBMITTED', 'PARTIAL_ORDERED'].includes(pr.status)

        // ── State lokal: qty_ordered + unit_price per item ────────────
        // Default qty input approve = sisa (qty_requested - qty_ordered).
        // Berlaku untuk SUBMITTED (qty_ordered = 0, sisa = qty_requested)
        // maupun PARTIAL_ORDERED (qty_ordered > 0, sisa = selisihnya).
        const _itemQtys = {}
        const _itemPrices = {}
        items.forEach(item => {
            const qtyReq = (item.qty_requested ?? 0)
            const qtyOrd = (item.qty_ordered ?? 0)
            _itemQtys[item.id] = Math.max(0, qtyReq - qtyOrd)
            _itemPrices[item.id] = item.estimated_unit_price ?? 0
        })

        // ── State supplier ────────────────────────────────────────────
        let _selectedSupplier = pr.supplier_id
            ? { id: pr.supplier_id, code: pr.supplier_code ?? '', name: pr.supplier_name ?? '-' }
            : null

        // ── Render cell qty (editable saat canEdit) ───────────────────
        function renderQtyCell(item) {
            const qty = _itemQtys[item.id]
            if (!canEdit) {
                return `<span class="text-gray-800 tabular-nums">${Format.number(qty)}</span>`
            }
            return `<input type="number" data-qty-item="${item.id}"
                        class="qty-cell-input w-20 text-right text-xs border border-dashed border-blue-300
                               rounded px-1.5 py-0.5 text-blue-700 font-medium focus:outline-none
                               focus:ring-1 focus:ring-blue-400 tabular-nums"
                        value="${qty}" min="0" step="0.01">`
        }

        // ── Render cell harga (editable saat canEdit) ─────────────────
        function renderPriceCell(item) {
            const price = _itemPrices[item.id]
            if (!canEdit) {
                return `<span class="text-gray-800 tabular-nums">${Format.currency(price)}</span>`
            }
            return `<input type="number" data-price-item="${item.id}"
                        class="price-cell-input w-24 text-right text-xs border border-dashed border-green-300
                               rounded px-1.5 py-0.5 text-green-700 font-medium focus:outline-none
                               focus:ring-1 focus:ring-green-400 tabular-nums"
                        value="${price}" min="0" step="any">`
        }

        // ── Render subtotal baris ──────────────────────────────────────
        function renderSubtotal(item) {
            const qty = _itemQtys[item.id]
            const price = _itemPrices[item.id]
            return `<span class="subtotal-${item.id} tabular-nums text-gray-700">
                        ${Format.currency(qty * price)}
                    </span>`
        }

        const itemRows = items.map((item, i) => {
            const qtyReq = (item.qty_requested ?? 0)
            const qtyOrd = (item.qty_ordered ?? 0)
            const qtySisa = Math.max(0, qtyReq - qtyOrd)
            return `
            <tr class="border-t border-gray-100 text-xs">
                <td class="py-1 px-2 text-gray-400">${i + 1}</td>
                <td class="py-1 px-2 whitespace-nowrap text-gray-700">
                    ${item.material_name ?? '-'} |
                    <span class="text-gray-500 ml-1">${item.unit_code ?? ''}</span>
                </td>
                <td class="py-1 px-2 text-right tabular-nums text-gray-800 font-semibold">
                    ${Format.number(qtyReq)}
                </td>
                <td class="py-1 px-2 text-right tabular-nums ${qtyOrd > 0 ? 'text-blue-600 font-medium' : 'text-gray-300'}">
                    ${Format.number(qtyOrd)}
                </td>
                <td class="py-1 px-2 text-right tabular-nums ${qtySisa > 0 ? 'text-orange-500 font-medium' : 'text-gray-300'}">
                    ${Format.number(qtySisa)}
                </td>
                <td class="py-1 px-2 text-right" id="qty-cell-${item.id}">
                    ${renderQtyCell(item)}
                </td>
                <td class="py-1 px-2 text-right" id="price-cell-${item.id}">
                    ${renderPriceCell(item)}
                </td>
                <td class="py-1 px-2 text-right" id="subtotal-cell-${item.id}">
                    ${renderSubtotal(item)}
                </td>
            </tr>`
        }).join('')

        // ── Render field supplier ─────────────────────────────────────
        function supplierDisplayHtml(supplier) {
            if (supplier) {
                return `<div class="flex items-center justify-between gap-2">
                            <div class="min-w-0">
                                <span class="text-xs text-gray-400">${supplier.code}</span>
                                <span class="ml-1 font-medium text-gray-800">${supplier.name}</span>
                            </div>
                            <svg class="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                            </svg>
                        </div>`
            }
            return `<div class="flex items-center justify-between gap-2 text-blue-500">
                        <span>Pilih supplier...</span>
                        <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                        </svg>
                    </div>`
        }

        // ── Estimasi total ────────────────────────────────────────────
        function calcTotal() {
            return items.reduce((s, item) => s + (_itemQtys[item.id] ?? 0) * (_itemPrices[item.id] ?? 0), 0)
        }

        Modal.open({
            title: `${pr.pr_number ?? id} — ${pr.pr_date ? Format.date(pr.pr_date) : '-'} ${pr.priority === 'URGENT' ? '⚠' : ''}`,
            body: `
                <div class="space-y-3 text-sm">
                    <!-- Header info -->
                    <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                        <div>
                            <div class="text-gray-500">Oleh</div>
                            <div class="font-medium text-gray-800">${pr.requester_name ?? '-'}</div>
                        </div>
                        <div>
                            <div class="text-gray-500">Departemen</div>
                            <div class="font-medium text-gray-800">${pr.department_name ?? '-'}</div>
                        </div>
                        ${pr.status === 'REJECTED' ? `
                        <div class="col-span-2">
                            <div class="text-gray-500">Alasan Penolakan</div>
                            <div class="font-medium text-red-700">${pr.rejected_reason ?? '-'}</div>
                        </div>` : ''}

                        <!-- Supplier (hanya tampil saat SUBMITTED untuk pilih, atau ORDERED untuk info) -->
                        ${canApprove ? `
                        <div class="col-span-2">
                            <div class="text-gray-500 mb-0.5">Supplier <span class="text-red-500">*</span></div>
                            <button id="btn-pick-supplier"
                                    class="w-full text-left text-xs px-2.5 py-1.5 rounded-lg border
                                           ${_selectedSupplier
                        ? 'border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-200'
                        : 'border-dashed border-blue-300 bg-blue-50 hover:bg-blue-100'}
                                           transition">
                                ${supplierDisplayHtml(_selectedSupplier)}
                            </button>
                        </div>` : ''}

                        <div class="col-span-2">
                            <div class="text-gray-500">Catatan</div>
                            <div class="text-gray-800">${pr.notes ?? '-'}</div>
                        </div>
                    </div>

                    <!-- Tabel item -->
                    <div class="border-t pt-2">
                        <p class="text-xs font-bold text-gray-600 mb-1">
                            Data | ${pr.total_items ?? items.length}
                        </p>
                        <div class="overflow-x-auto max-h-52">
                            <table class="w-full text-xs">
                                <thead class="bg-gray-50 text-gray-500 sticky top-0">
                                    <tr>
                                        <th class="py-1 px-2 text-left w-6">No</th>
                                        <th class="py-1 px-2 text-left">Material</th>
                                        <th class="py-1 px-2 text-right whitespace-nowrap">Diminta</th>
                                        <th class="py-1 px-2 text-right whitespace-nowrap text-blue-600">Sudah PO</th>
                                        <th class="py-1 px-2 text-right whitespace-nowrap text-orange-500">Sisa</th>
                                        <th class="py-1 px-2 text-right">
                                            ${canEdit ? '<span class="text-blue-600">Qty PO ✎</span>' : 'Qty PO'}
                                        </th>
                                        <th class="py-1 px-2 text-right">
                                            ${canEdit ? '<span class="text-green-600">Harga ✎</span>' : 'Harga'}
                                        </th>
                                        <th class="py-1 px-2 text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemRows || '<tr><td colspan="8" class="text-center py-3 text-gray-400">Tidak ada item</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                        <div class="flex justify-end mt-1.5 pt-1.5 border-t">
                            <span class="text-xs text-gray-500">Estimasi Total:</span>
                            <span id="modal-total-value" class="ml-2 text-xs font-semibold text-gray-800">
                                ${Format.currency(pr.total_estimated_value ?? calcTotal())}
                            </span>
                        </div>
                    </div>
                </div>`,

            actions: (() => {
                if (!canApprove) return ''
                return `
                    <button id="modal-btn-approve"
                        class="h-8 px-4 rounded-lg bg-green-600 hover:bg-green-700
                               text-white text-sm font-medium transition">
                        PO
                    </button>`
            })(),

            onOpen: () => {
                // ── Input qty: update state + subtotal + total realtime ──────
                if (canEdit) {
                    let _debounceQty = {}
                    let _debouncePrice = {}

                    $(document).on('input.itemQty', '.qty-cell-input', function () {
                        const itemId = $(this).data('qty-item')
                        const val = parseFloat($(this).val())
                        if (isNaN(val) || val < 0) return
                        _itemQtys[itemId] = val
                        _updateSubtotal(itemId)
                        _updateModalTotal()

                        clearTimeout(_debounceQty[itemId])
                        _debounceQty[itemId] = setTimeout(async () => {
                            try {
                                await Http.put(`/purchase-requests/${id}/items/${itemId}`, {
                                    qty_ordered: val,
                                })
                            } catch (e) {
                                Toast.show('Gagal simpan qty: ' + e.message, 'error')
                            }
                        }, 600)
                    })

                    // ── Input harga: update state + subtotal + total realtime ──
                    $(document).on('input.itemPrice', '.price-cell-input', function () {
                        const itemId = $(this).data('price-item')
                        const val = parseFloat($(this).val())
                        if (isNaN(val) || val < 0) return
                        _itemPrices[itemId] = val
                        _updateSubtotal(itemId)
                        _updateModalTotal()

                        clearTimeout(_debouncePrice[itemId])
                        _debouncePrice[itemId] = setTimeout(async () => {
                            try {
                                await Http.put(`/purchase-requests/${id}/items/${itemId}`, {
                                    estimated_unit_price: val,
                                })
                            } catch (e) {
                                Toast.show('Gagal simpan harga: ' + e.message, 'error')
                            }
                        }, 600)
                    })
                }

                function _updateSubtotal(itemId) {
                    const sub = (_itemQtys[itemId] ?? 0) * (_itemPrices[itemId] ?? 0)
                    $(`#subtotal-cell-${itemId} .subtotal-${itemId}`).text(Format.currency(sub))
                }

                function _updateModalTotal() {
                    const total = items.reduce((s, it) => s + (_itemQtys[it.id] ?? 0) * (_itemPrices[it.id] ?? 0), 0)
                    $('#modal-total-value').text(Format.currency(total))
                }

                // ── Supplier picker ─────────────────────────────────────────
                $(document).on('click.supplierPick', '#btn-pick-supplier', function () {
                    _showSupplierPicker(_selectedSupplier?.id ?? null, function (supplier) {
                        _selectedSupplier = supplier
                        $('#btn-pick-supplier').html(supplierDisplayHtml(supplier))
                            .removeClass('border-dashed border-blue-300 bg-blue-50 hover:bg-blue-100')
                            .addClass('border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-200')
                    })
                })

                // Cleanup — dipanggil Modal.close() dari trigger apapun
                Modal._onClose = () => {
                    $(document).off('input.itemQty input.itemPrice click.supplierPick')
                }

                if (!canApprove) return

                // ── Tombol APPROVE ──────────────────────────────────────────
                let _approveInProgress = false   // ← tambahkan guard ini

                $('#modal-btn-approve').on('click', () => {
                    if (_approveInProgress) return   // cegah double-submit

                    // Baca nilai terkini dari DOM
                    $('.qty-cell-input').each(function () {
                        _itemQtys[$(this).data('qty-item')] = parseFloat($(this).val()) || 0
                    })
                    $('.price-cell-input').each(function () {
                        _itemPrices[$(this).data('price-item')] = parseFloat($(this).val()) || 0
                    })

                    // Validasi supplier
                    if (!_selectedSupplier) {
                        Toast.show('Supplier wajib dipilih sebelum approve.', 'error')
                        $('#btn-pick-supplier')
                            .addClass('border-red-400 bg-red-50')
                            .removeClass('border-dashed border-blue-300 bg-blue-50')
                        return   // ← sekarang listener TIDAK mati, user bisa klik lagi
                    }

                    // Bersihkan highlight error supplier jika sudah dipilih
                    $('#btn-pick-supplier')
                        .removeClass('border-red-400 bg-red-50')

                    // Validasi semua qty > 0
                    const hasAnyQty = items.some(it => (_itemQtys[it.id] ?? 0) > 0)
                    if (!hasAnyQty) {
                        Toast.show('Minimal 1 item harus memiliki Qty PO > 0.', 'error')
                        return
                    }

                    // Susun payload
                    const qtyPayload = items.map(it => ({
                        id: it.id,
                        qty_ordered: _itemQtys[it.id],
                        unit_price: _itemPrices[it.id],
                    }))

                    const grandTotal = qtyPayload.reduce((s, it) => s + it.qty_ordered * it.unit_price, 0)

                    Modal.confirm({
                        title: 'Konfirmasi Approve',
                        message: `Setujui <strong>${pr.pr_number}</strong> dengan supplier <strong>${_selectedSupplier.name}</strong>?
                  <br><span class="text-xs text-gray-500">Grand Total estimasi: ${Format.currency(grandTotal)}</span>
                  <br><span class="text-xs text-orange-600">PO akan dibuat otomatis dan PR tidak bisa diubah lagi.</span>`,
                        labelOk: 'Ya, Approve & Buat PO',
                        onOk: async () => {
                            _approveInProgress = true   // ← lock saat async berlangsung
                            try {
                                Loading.show('Memproses approve & membuat PO...')
                                const result = await Http.post(`/purchase-requests/${id}/approve`, {
                                    action: 'approve',
                                    supplier_id: _selectedSupplier.id,
                                    items: qtyPayload,
                                })
                                Toast.show(
                                    `PR di-approve. PO ${result.data?.po_number ?? ''} berhasil dibuat. ✓`,
                                    'success'
                                )
                                $(document).off('input.itemQty input.itemPrice click.supplierPick')
                                Modal.close()
                                loadData()
                            } catch (err) {
                                Toast.show('Gagal approve: ' + err.message, 'error')
                            } finally {
                                Loading.hide()
                                _approveInProgress = false   // ← unlock setelah selesai
                            }
                        },
                    })
                })

                // ── Tombol REJECT ───────────────────────────────────────────
                $('#modal-btn-reject').one('click', () => {
                    Modal.form({
                        title: 'Tolak Purchase Request',
                        formHtml: `
                            <p class="text-xs text-gray-500 mb-2">
                                Request <strong>${pr.pr_number}</strong> akan ditolak sepenuhnya.
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
                        labelSubmit: 'Tolak Request',
                        onSubmit: async () => {
                            const reason = $('#form-reject-reason').val().trim()
                            if (!reason) { Toast.show('Alasan wajib diisi.', 'error'); return }
                            try {
                                Modal.close()
                                Loading.show('Memproses penolakan...')
                                await Http.post(`/purchase-requests/${id}/approve`, {
                                    action: 'reject',
                                    rejected_reason: reason,
                                })
                                Toast.show('Request berhasil ditolak.', 'success')
                                $(document).off('input.itemQty input.itemPrice click.supplierPick')
                                loadData()
                            } catch (err) {
                                Toast.show('Gagal menolak: ' + err.message, 'error')
                            } finally {
                                Loading.hide()
                            }
                        },
                    })
                })
            },
        })

    } catch (err) {
        Toast.show('Gagal memuat detail request: ' + err.message, 'error')
    } finally {
        Loading.hide()
    }
}

// ═════════════════════════════════════════════════════════════════════════════
//  DETAIL PO
// ═════════════════════════════════════════════════════════════════════════════
async function _showDetailPO(id) {
    Loading.show('Memuat detail PO...')
    try {
        const res = await Http.get(`/purchase-orders/${id}`)
        const po = res.data
        const items = po.items ?? []

        const itemRows = items.map((item, i) =>
            `<tr class="border-t border-gray-100 text-xs">
                <td class="py-1 px-2 text-gray-400">${i + 1}</td>
                <td class="py-1 px-2 text-gray-700 whitespace-nowrap">
                    ${item.material_name ?? '-'} |
                    <span class="text-gray-500 ml-1">${item.unit_code ?? ''}</span>
                </td>
                <td class="py-1 px-2 text-right tabular-nums text-gray-800">${Format.number(item.qty_ordered ?? 0)}</td>
                <td class="py-1 px-2 text-right tabular-nums text-gray-600">${Format.number(item.qty_received ?? 0)}</td>
                <td class="py-1 px-2 text-right tabular-nums text-gray-800">${Format.currency(item.unit_price ?? 0)}</td>
                <td class="py-1 px-2 text-right tabular-nums font-medium text-gray-800">${Format.currency(item.line_total ?? 0)}</td>
            </tr>`
        ).join('')

        Modal.open({
            title: `${po.po_number ?? 'Detail PO'}`,
            body: `
                <div class="space-y-3 text-sm">
                    <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                        <div>
                            <div class="text-gray-500">Supplier</div>
                            <div class="font-medium text-gray-800">${po.supplier_name ?? '-'}</div>
                        </div>
                        <div>
                            <div class="text-gray-500">Tanggal PO</div>
                            <div class="text-gray-700">${Format.date(po.po_date)}</div>
                        </div>
                        <div>
                            <div class="text-gray-500">No. Request</div>
                            <div class="text-gray-700">${po.pr_number ?? '-'}</div>
                        </div>
                        <div>
                            <div class="text-gray-500">Status</div>
                            <div>${badge(po.status)}</div>
                        </div>
                    </div>
                    <div class="border-t pt-2">
                        <p class="text-xs font-bold text-gray-600 mb-1">Data | ${items.length}</p>
                        <div class="overflow-x-auto max-h-52">
                            <table class="w-full text-xs">
                                <thead class="bg-gray-50 text-gray-500 sticky top-0">
                                    <tr>
                                        <th class="py-1 px-2 text-left">No</th>
                                        <th class="py-1 px-2 text-left">Material</th>
                                        <th class="py-1 px-2 text-right whitespace-nowrap">PO</th>
                                        <th class="py-1 px-2 text-right whitespace-nowrap">Diterima</th>
                                        <th class="py-1 px-2 text-right">Harga</th>
                                        <th class="py-1 px-2 text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${itemRows || '<tr><td colspan="6" class="text-center py-3 text-gray-400">Tidak ada item</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                        ${po.tax_amount > 0 ? `
                        <div class="flex justify-end gap-4 text-xs">
                            <span class="text-gray-500">Pajak</span>
                            <span class="tabular-nums text-gray-800">${Format.currency(po.tax_amount ?? 0)}</span>
                        </div>` : ''}
                        ${po.shipping_cost > 0 ? `
                        <div class="flex justify-end gap-4 text-xs">
                            <span class="text-gray-500">Ongkir</span>
                            <span class="tabular-nums text-gray-800">${Format.currency(po.shipping_cost ?? 0)}</span>
                        </div>` : ''}
                        <div class="flex justify-end gap-4 text-xs font-semibold">
                            <span class="text-gray-700">Grand Total</span>
                            <span class="tabular-nums text-gray-900">${Format.currency(po.grand_total ?? 0)}</span>
                        </div>
                    </div>
                </div>`,
            actions: `<button id="modal-btn-ok"
                class="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700
                       text-white text-sm font-medium transition">Tutup</button>`,
            onOpen: () => { $('#modal-btn-ok').one('click', () => Modal.close()) },
        })
    } catch (err) {
        Toast.show('Gagal memuat detail PO: ' + err.message, 'error')
    } finally {
        Loading.hide()
    }
}

// ═════════════════════════════════════════════════════════════════════════════
//  DAFTAR PO DARI SATU REQUEST (klik qty_ordered di tabel)
// ═════════════════════════════════════════════════════════════════════════════
async function _showPOsFromRequest(prId) {
    Loading.show('Memuat daftar PO...')
    try {
        const res = await Http.get(`/purchase-requests/${prId}/purchase-orders`)
        const pos = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])

        if (!pos.length) {
            Toast.show('Belum ada PO dari request ini.', 'info')
            return
        }

        const rows = pos.map((po, i) =>
            `<tr class="border-t border-gray-100 hover:bg-blue-50 cursor-pointer" data-po-id="${po.id}">
                <td class="py-1.5 px-2 text-gray-400 text-xs text-center">${i + 1}</td>
                <td class="py-1.5 px-2 font-medium text-gray-800 text-xs">${po.po_number ?? '-'}</td>
                <td class="py-1.5 px-2 text-gray-600 text-xs truncate">${po.supplier_name ?? '-'}</td>
                <td class="py-1.5 px-2 text-gray-500 text-xs">${Format.date(po.po_date)}</td>
                <td class="py-1.5 px-2 text-right tabular-nums text-gray-800 text-xs">${Format.currency(po.grand_total ?? 0)}</td>
                <td class="py-1.5 px-2 text-center text-xs">${badge(po.status ?? '')}</td>
            </tr>`
        ).join('')

        Modal.open({
            title: 'Purchase Order dari Request',
            body: `<div class="overflow-x-auto">
                        <table class="w-full text-xs border-collapse">
                            <thead class="bg-gray-100 text-gray-500 sticky top-0">
                                <tr>
                                    <th class="py-1.5 px-2 border border-gray-200">No</th>
                                    <th class="py-1.5 px-2 border border-gray-200 text-left">No. PO</th>
                                    <th class="py-1.5 px-2 border border-gray-200 text-left">Supplier</th>
                                    <th class="py-1.5 px-2 border border-gray-200 text-left">Tanggal</th>
                                    <th class="py-1.5 px-2 border border-gray-200 text-right">Total</th>
                                    <th class="py-1.5 px-2 border border-gray-200">Status</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                    <p class="text-xs text-gray-400 mt-2">Klik baris untuk melihat detail PO.</p>`,
            actions: '',
            onOpen: () => {
                $('#modal-body').on('click', '[data-po-id]', function () {
                    const poId = $(this).data('po-id')
                    Modal.close()
                    setTimeout(() => _showDetailPO(poId), 220)
                })
            },
            onClose: () => {
                $('#modal-body').off('click', '[data-po-id]')
            },
        })
    } catch (err) {
        Toast.show('Gagal memuat daftar PO: ' + err.message, 'error')
    } finally {
        Loading.hide()
    }
}

// ═════════════════════════════════════════════════════════════════════════════
//  HISTORY REQUEST (riwayat PO yang berasal dari Request — per warehouse)
//  Data diambil dari /purchase-orders; kolom No. Request ditampilkan sebagai
//  referensi agar user tahu PO ini berasal dari PR mana.
// ═════════════════════════════════════════════════════════════════════════════
async function _showHistoryRequest() {
    Loading.show('Memuat riwayat request...')
    try {
        const params = { per_page: 200 }
        if (_warehouseId) params.warehouse_id = _warehouseId

        // Ambil dari endpoint Purchase Request, filter hanya yang ORDERED
        const res = await Http.get('/purchase-requests', params)
        const raw = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
        const data = raw.filter(req => req.status === 'ORDERED')

        const rows = data.map((req, i) =>
            `<tr class="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                 data-action="view-request" data-id="${req.id}">
                 <td class="py-1.5 px-2 text-gray-400 text-xs text-center border border-gray-100">${i + 1}</td>
                 <td class="py-1.5 px-2 font-medium text-blue-700 text-xs border border-gray-100 whitespace-nowrap">${req.pr_number ?? '-'}</td>
                 <td class="py-1.5 px-2 text-gray-600 text-xs truncate border border-gray-100">${req.requester_name ?? '-'}</td>
                 <td class="py-1.5 px-2 text-gray-500 text-xs text-center border border-gray-100 whitespace-nowrap">${Format.date(req.pr_date)}</td>
             </tr>`
        ).join('')

        Modal.open({
            title: 'Riwayat Request Order',
            body: `<div class="overflow-x-auto">
                        <table class="w-full text-xs border-collapse">
                            <thead class="bg-gray-100 text-gray-500 sticky top-0">
                                <tr>
                                    <th class="py-1.5 px-2 border border-gray-200 text-center">No</th>
                                    <th class="py-1.5 px-2 border border-gray-200 text-left whitespace-nowrap">No. Request</th>
                                    <th class="py-1.5 px-2 border border-gray-200 text-left">Pemohon</th>
                                    <th class="py-1.5 px-2 border border-gray-200 text-center whitespace-nowrap">Tanggal</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows || '<tr><td colspan="4" class="text-center py-4 text-gray-400">Tidak ada data</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                    <p class="text-xs text-gray-400 mt-2">Klik baris untuk melihat detail request.</p>`,
            actions: '',
            onOpen: () => {
                $('#modal-body').on('click', '[data-action="view-request"]', function () {
                    const reqId = $(this).data('id')
                    Modal.close()
                    setTimeout(() => _showDetailRequest(reqId), 220)
                })
            },
            onClose: () => {
                $('#modal-body').off('click', '[data-action="view-request"]')
            },
        })
    } catch (err) {
        Toast.show('Gagal memuat riwayat: ' + err.message, 'error')
    } finally {
        Loading.hide()
    }
}

// ═════════════════════════════════════════════════════════════════════════════
//  HISTORY PO
// ═════════════════════════════════════════════════════════════════════════════
async function _showHistoryPO() {
    Loading.show('Memuat riwayat PO...')
    try {
        const params = { per_page: 200 }
        if (_warehouseId) params.warehouse_id = _warehouseId

        const res = await Http.get('/purchase-orders', params)
        const raw = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
        // History hanya berisi PO yang sudah selesai (ORDERED / RECEIVED)
        const data = raw.filter(po => ['ORDERED', 'RECEIVED'].includes(po.status))

        const rows = data.map((po, i) => {
            const status = po.status ?? ''
            const btnCls = status === 'RECEIVED'
                ? 'bg-green-600 hover:bg-green-700 text-white border-green-700'
                : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700'
            const btnLabel = status === 'RECEIVED' ? 'DITERIMA' : 'ORDERED'
            return `<tr class="border-t border-gray-100 hover:bg-gray-50">
                        <td class="py-1.5 px-2 text-gray-400 text-xs text-center border border-gray-100">${i + 1}</td>
                        <td class="py-1.5 px-2 font-medium text-gray-800 text-xs border border-gray-100 whitespace-nowrap">${po.po_number ?? '-'}</td>
                        <td class="py-1.5 px-2 text-gray-600 text-xs truncate border border-gray-100">${po.supplier_name ?? '-'}</td>
                        <td class="py-1.5 px-2 text-gray-500 text-xs text-center border border-gray-100 whitespace-nowrap">${Format.date(po.po_date)}</td>
                        <td class="py-1.5 px-2 text-right tabular-nums text-gray-800 text-xs border border-gray-100">${Format.currency(po.grand_total ?? 0)}</td>
                        <td class="py-1.5 px-2 text-center border border-gray-100">
                            <button data-action="view-receive" data-id="${po.id}" data-po-number="${po.po_number ?? ''}"
                                class="h-6 px-2.5 rounded border text-xs font-bold transition ${btnCls}">
                                ${btnLabel}
                            </button>
                        </td>
                    </tr>`
        }).join('')

        Modal.open({
            title: 'Riwayat Purchase Order',
            body: `<div class="overflow-x-auto">
                        <table class="w-full text-xs border-collapse">
                            <thead class="bg-gray-100 text-gray-500 sticky top-0">
                                <tr>
                                    <th class="py-1.5 px-2 border border-gray-200">No</th>
                                    <th class="py-1.5 px-2 border border-gray-200 text-left whitespace-nowrap">No. PO</th>
                                    <th class="py-1.5 px-2 border border-gray-200 text-left whitespace-nowrap">Supplier</th>
                                    <th class="py-1.5 px-2 border border-gray-200 whitespace-nowrap">Tanggal</th>
                                    <th class="py-1.5 px-2 border border-gray-200 text-right whitespace-nowrap">Grand Total</th>
                                    <th class="py-1.5 px-2 border border-gray-200 whitespace-nowrap">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows || '<tr><td colspan="6" class="text-center py-4 text-gray-400">Tidak ada data</td></tr>'}
                            </tbody>
                        </table>
                    </div>`,
            actions: '',
            onOpen: () => {
                $('#modal-body').on('click', '[data-action="view-receive"]', function () {
                    const poId = $(this).data('id')
                    const poNumber = $(this).data('po-number')
                    Modal.close()
                    setTimeout(() => _showDetailReceive(poId, poNumber), 220)
                })
            },
            onClose: () => {
                $('#modal-body').off('click', '[data-action="view-receive"]')
            },
        })
    } catch (err) {
        Toast.show('Gagal memuat riwayat PO: ' + err.message, 'error')
    } finally {
        Loading.hide()
    }
}


// ═════════════════════════════════════════════════════════════════════════════
//  DETAIL RECEIVED — daftar dokumen penerimaan dari satu PO
// ═════════════════════════════════════════════════════════════════════════════
async function _showDetailReceive(poId, poNumber) {
    Loading.show('Memuat data penerimaan...')
    try {
        // Sesuaikan endpoint dengan BE Anda
        const res = await Http.get(`/purchase-orders/${poId}/receives`)
        const receives = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])

        if (!receives.length) {
            Toast.show('Belum ada data penerimaan untuk PO ini.', 'info')
            return
        }

        const rows = receives.map((rcv, i) => {
            const itemRows = (rcv.items ?? []).map((item, j) =>
                `<tr class="border-t border-gray-100">
                    <td class="py-1 px-2 text-gray-400 text-xs text-center">${j + 1}</td>
                    <td class="py-1 px-2 text-gray-700 text-xs whitespace-nowrap">
                        ${item.material_name ?? '-'}
                        <span class="text-gray-400 ml-1">${item.unit_code ?? ''}</span>
                    </td>
                    <td class="py-1 px-2 text-right tabular-nums text-gray-800 text-xs">${Format.number(item.qty_received ?? 0)}</td>
                    <td class="py-1 px-2 text-right tabular-nums text-gray-800 text-xs">${Format.currency(item.unit_price ?? 0)}</td>
                    <td class="py-1 px-2 text-right tabular-nums font-medium text-gray-800 text-xs">${Format.currency((item.qty_received ?? 0) * (item.unit_price ?? 0))}</td>
                </tr>`
            ).join('')

            return `
                <!-- Header dokumen receive -->
                <div class="rounded-lg border border-gray-200 overflow-hidden mb-3">
                    <div class="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <div class="flex items-center gap-3">
                            <span class="font-semibold text-gray-800 text-xs">${rcv.receive_number ?? '-'}</span>
                            <span class="text-gray-400 text-xs">${Format.date(rcv.receive_date)}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            ${rcv.notes ? `<span class="text-gray-400 text-xs italic truncate max-w-[140px]">${rcv.notes}</span>` : ''}
                            <span class="text-xs font-bold text-blue-600">
                                ${Format.currency((rcv.items ?? []).reduce((s, it) => s + (it.qty_received ?? 0) * (it.unit_price ?? 0), 0))}
                            </span>
                        </div>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-xs">
                            <thead class="bg-gray-100 text-gray-500">
                                <tr>
                                    <th class="py-1 px-2 text-center w-6">No</th>
                                    <th class="py-1 px-2 text-left">Material</th>
                                    <th class="py-1 px-2 text-right whitespace-nowrap">Qty Terima</th>
                                    <th class="py-1 px-2 text-right">Harga</th>
                                    <th class="py-1 px-2 text-right">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemRows || '<tr><td colspan="5" class="text-center py-2 text-gray-400">Tidak ada item</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>`
        }).join('')

        const grandTotal = receives.reduce((sum, rcv) =>
            sum + (rcv.items ?? []).reduce((s, it) => s + (it.qty_received ?? 0) * (it.unit_price ?? 0), 0), 0)

        Modal.open({
            title: `Penerimaan — ${poNumber}`,
            body: `
                <div class="text-xs text-gray-500 mb-3">
                    <span class="font-medium text-gray-700">${receives.length}</span> dokumen penerimaan ditemukan
                </div>
                ${rows}
                <div class="flex justify-end items-center gap-2 pt-2 border-t border-gray-100 mt-1">
                    <span class="text-xs text-gray-500 font-medium">Total Nilai Terima</span>
                    <span class="text-sm font-bold text-gray-900 tabular-nums">${Format.currency(grandTotal)}</span>
                </div>`,
            actions: `
                <button id="modal-btn-back"
                    class="h-8 px-4 rounded-lg border border-gray-200
                           text-sm text-gray-600 hover:bg-gray-100 transition">
                    ← Kembali
                </button>
                <button id="modal-btn-ok"
                    class="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700
                           text-white text-sm font-medium transition">
                    Tutup
                </button>`,
            onOpen: () => {
                $('#modal-btn-ok').one('click', () => Modal.close())
                $('#modal-btn-back').one('click', () => {
                    Modal.close()
                    setTimeout(() => _showHistoryPO(), 220)
                })
            },
        })
    } catch (err) {
        Toast.show('Gagal memuat data penerimaan: ' + err.message, 'error')
    } finally {
        Loading.hide()
    }
}

// ─── Init ─────────────────────────────────────────────────────
_syncToolbarButtons()
_updateTableLayout()
loadData()