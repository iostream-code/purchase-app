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
let _activeTab = 'po'
let _allPO = []
let _allRequest = []
let _query = ''

// warehouse_id diambil dari auth user
const _warehouseId = user?.warehouse_id ?? null

// ─── Mapping status API → label + warna ───────────────────────
const STATUS_TEXT = {
    DRAFT: 'DRAFT',
    SUBMITTED: 'SUBMITTED',
    APPROVED: 'APPROVED',
    SENT: 'SENT',
    PARTIAL_RECEIVED: 'PARTIAL',
    PARTIAL_ORDERED: 'PARTIAL',
    RECEIVED: 'RECEIVED',
    ORDERED: 'ORDERED',
    CLOSED: 'CLOSED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED',
}

const STATUS_BG_CLASS = {
    DRAFT: 'bg-gray-50',
    SUBMITTED: 'bg-orange-50',
    APPROVED: 'bg-green-50',
    SENT: 'bg-blue-50',
    PARTIAL_RECEIVED: 'bg-yellow-50',
    PARTIAL_ORDERED: 'bg-yellow-50',
    RECEIVED: 'bg-blue-50',
    ORDERED: 'bg-blue-50',
    CLOSED: 'bg-gray-100',
    REJECTED: 'bg-red-50',
    CANCELLED: 'bg-red-50',
}

const STATUS_TEXT_CLASS = {
    DRAFT: 'text-gray-500',
    SUBMITTED: 'text-orange-700',
    APPROVED: 'text-green-700',
    SENT: 'text-blue-700',
    PARTIAL_RECEIVED: 'text-yellow-700',
    PARTIAL_ORDERED: 'text-yellow-700',
    RECEIVED: 'text-blue-700',
    ORDERED: 'text-blue-700',
    CLOSED: 'text-gray-600',
    REJECTED: 'text-red-600',
    CANCELLED: 'text-red-600',
}

function badge(status) {
    const label = STATUS_TEXT[status] ?? status
    const textCls = STATUS_TEXT_CLASS[status] ?? 'text-gray-600'
    return `<span class="inline-block text-xs py-0.5 rounded-full font-medium ${textCls}">${label}</span>`
}

// ─── Tombol aksi ──────────────────────────────────────────────
function actionButtons(id) {
    return `<div class="flex justify-center gap-1">
        <button data-action="view" data-id="${id}" title="Lihat detail"
            class="w-24 h-8 flex items-center justify-center rounded-md border border-gray-200 bg-linear-to-br from-white to-gray-50
                   font-bold text-gray-400">
            DETAIL
        </button>
        <button data-action="edit" data-id="${id}" title="Edit"
            class="w-24 h-8 flex items-center justify-center rounded-md border border-gray-200
                   font-bold text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition">
            EDIT
        </button>
    </div>`
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
                <td class="px-3 py-1 text-center border border-gray-200 ${bgCls}">${badge(status)}</td>
                <td class="px-3 py-1 border border-gray-200">${actionButtons(po.id)}</td>
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
        const qtyReq = req.total_qty_requested ?? req.items?.reduce((s, it) => s + (it.qty_requested ?? 0), 0) ?? 0
        const qtyOrd = req.total_qty_ordered ?? req.items?.reduce((s, it) => s + (it.qty_ordered ?? 0), 0) ?? 0
        $tbody.append(`
            <tr class="border-t border-gray-100 hover:bg-gray-50 transition">
                <td class="px-3 py-1 text-center text-gray-400 text-xs border border-gray-200">${i + 1}</td>
                <td class="px-3 py-1 font-medium text-gray-800 truncate border border-gray-200">${req.pr_number ?? '-'}</td>
                <td class="px-3 py-1 text-gray-600 truncate border border-gray-200">${req.requester_name ?? '-'}</td>
                <td class="px-3 py-1 text-center text-gray-500 text-xs border border-gray-200">${Format.date(req.pr_date)}</td>
                <td class="px-3 py-1 text-right tabular-nums text-gray-800 border border-gray-200">${Format.number(qtyReq)}</td>
                <td class="px-3 py-1 text-right tabular-nums border border-gray-200 ${qtyOrd > 0 ? 'text-blue-700 font-medium' : 'text-gray-400'}">${Format.number(qtyOrd)}</td>
                <td class="px-3 py-1 text-center border border-gray-200 ${bgCls}">${badge(status)}</td>
                <td class="px-3 py-1 border border-gray-200">
                    <div class="flex justify-center">
                        <button data-action="view" data-id="${req.id}" title="Lihat detail"
                            class="w-64 h-8 flex items-center justify-center rounded-md border border-gray-200 bg-linear-to-b from-gray-100 to-gray-300
                                   font-bold text-gray-500">
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

// ─── Dummy PO — hapus saat endpoint /purchase-orders sudah siap ──
const DUMMY_PO = [
    { id: 1, po_number: 'PO-2024-001', supplier_name: 'PT Sumber Makmur', po_date: '2024-06-01', grand_total: 12500000, status: 'APPROVED' },
    { id: 2, po_number: 'PO-2024-002', supplier_name: 'CV Jaya Abadi', po_date: '2024-06-03', grand_total: 8750000, status: 'DRAFT' },
    { id: 3, po_number: 'PO-2024-003', supplier_name: 'PT Maju Bersama', po_date: '2024-06-05', grand_total: 3200000, status: 'PARTIAL_RECEIVED' },
    { id: 4, po_number: 'PO-2024-004', supplier_name: 'UD Berkah Sejahtera', po_date: '2024-06-07', grand_total: 21000000, status: 'RECEIVED' },
    { id: 5, po_number: 'PO-2024-005', supplier_name: 'PT Andalan Teknik', po_date: '2024-06-09', grand_total: 6800000, status: 'APPROVED' },
    { id: 6, po_number: 'PO-2024-006', supplier_name: 'CV Mitra Sejati', po_date: '2024-06-11', grand_total: 4150000, status: 'REJECTED' },
]

// ─── Load data ────────────────────────────────────────────────
async function loadData() {
    Loading.show(_activeTab === 'po' ? 'Memuat data PO...' : 'Memuat Request PO...')
    animateRefresh()

    try {
        if (_activeTab === 'po') {
            // TODO: ganti dengan Http.get('/purchase-orders', params) saat BE siap
            _allPO = DUMMY_PO

        } else {
            // GET /api/purchase-requests
            const params = { per_page: 100 }
            if (_warehouseId) params.warehouse_id = _warehouseId

            const res = await Http.get('/purchase-requests', params)
            _allRequest = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
        }

        applyFilter()

    } catch (err) {
        Toast.show('Gagal memuat data: ' + err.message, 'error')
    } finally {
        Loading.hide()
    }
}

// ─── Events ───────────────────────────────────────────────────
$('#input-search').on('input', function () {
    _query = $(this).val().trim()
    applyFilter()
})

$('#btn-refresh').on('click', loadData)

$('#btn-add-po').on('click', () => {
    if (_activeTab === 'po') {
        _showFormAddPO()
    } else {
        _showFormAddRequest()
    }
})

$('#btn-history-po').on('click', () => {
    Modal.alert({
        title: 'Riwayat Purchase Order',
        message: 'Fitur riwayat PO belum diimplementasi.',
    })
})

$(document).on('click', '[data-action]', function () {
    const action = $(this).data('action')
    const id = $(this).data('id')
    const label = _activeTab === 'po' ? 'PO' : 'Request PO'

    if (action === 'view') {
        _activeTab === 'po' ? _showDetailPO(id) : _showDetailRequest(id)
    }
    if (action === 'edit') {
        Modal.alert({ title: `Edit ${label}`, message: `Halaman edit #${id} belum diimplementasi.` })
    }
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

    // Sembunyikan tombol tambah di tab Request PO
    $('#btn-add-po').toggle(_activeTab === 'po')

    // Swap colgroup & thead sesuai tab
    _updateTableLayout()

    loadData()
})

function _updateTableLayout() {
    if (_activeTab === 'po') {
        $('table colgroup').html(`
            <col style="width: 40px">
            <col style="width: 140px">
            <col style="width: 200px">
            <col style="width: 110px">
            <col style="width: 130px">
            <col style="width: 90px">
            <col style="width: 200px">`)
        $('thead tr').html(`
            <th class="px-3 py-2 text-center border border-gray-300">No</th>
            <th class="px-3 py-2 text-center border border-gray-300">ID Purchase Order</th>
            <th class="px-3 py-2 text-center border border-gray-300">Supplier</th>
            <th class="px-3 py-2 text-center border border-gray-300">Tanggal</th>
            <th class="px-3 py-2 text-center border border-gray-300">Total</th>
            <th class="px-3 py-2 text-center border border-gray-300">Status</th>
            <th class="px-3 py-2 text-center border border-gray-300">Aksi</th>`)
    } else {
        $('table colgroup').html(`
            <col style="width: 40px">
            <col style="width: 140px">
            <col style="width: 160px">
            <col style="width: 100px">
            <col style="width: 100px">
            <col style="width: 100px">
            <col style="width: 90px">
            <col style="width: 110px">`)
        $('thead tr').html(`
            <th class="px-3 py-2 text-center border border-gray-300">No</th>
            <th class="px-3 py-2 text-center border border-gray-300">No. Request</th>
            <th class="px-3 py-2 text-center border border-gray-300">Pemohon</th>
            <th class="px-3 py-2 text-center border border-gray-300">Tanggal</th>
            <th class="px-3 py-2 text-center border border-gray-300">Qty Request</th>
            <th class="px-3 py-2 text-center border border-gray-300">Qty Order</th>
            <th class="px-3 py-2 text-center border border-gray-300">Status</th>
            <th class="px-3 py-2 text-center border border-gray-300">Aksi</th>`)
    }
}

// ─── Form tambah PO ───────────────────────────────────────────
function _showFormAddPO() {
    Modal.form({
        title: 'Tambah Purchase Order',
        formHtml: `
            <div class="space-y-3">
                <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">Supplier</label>
                    <input type="text" id="form-supplier" placeholder="Nama supplier"
                        class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                               focus:outline-none focus:ring-2 focus:ring-blue-200">
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">Tanggal</label>
                    <input type="date" id="form-tanggal"
                        class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                               focus:outline-none focus:ring-2 focus:ring-blue-200">
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">Total (Rp)</label>
                    <input type="number" id="form-total" placeholder="0"
                        class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                               focus:outline-none focus:ring-2 focus:ring-blue-200">
                </div>
            </div>`,
        labelSubmit: 'Simpan',
        onSubmit: () => {
            const supplier = $('#form-supplier').val().trim()
            if (!supplier) { Toast.show('Supplier wajib diisi', 'error'); return }
            Modal.close()
            Toast.show('Form tambah PO belum diimplementasi ke API.', 'warning')
        },
    })
}

// ─── Form tambah Request PO ───────────────────────────────────
function _showFormAddRequest() {
    Modal.form({
        title: 'Tambah Request PO',
        formHtml: `
            <div class="space-y-3">
                <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                    <select id="form-priority"
                        class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                               focus:outline-none focus:ring-2 focus:ring-blue-200">
                        <option value="NORMAL">Normal</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                        <option value="LOW">Low</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">Tanggal Dibutuhkan</label>
                    <input type="date" id="form-required-date"
                        class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                               focus:outline-none focus:ring-2 focus:ring-blue-200">
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">Catatan</label>
                    <textarea id="form-notes" rows="2" placeholder="Catatan opsional..."
                        class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                               focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"></textarea>
                </div>
                <p class="text-xs text-orange-600">
                    ⚠ Item material ditambahkan melalui halaman detail setelah PR dibuat.
                </p>
            </div>`,
        labelSubmit: 'Buat PR',
        onSubmit: async () => {
            if (!_warehouseId) {
                Toast.show('Warehouse tidak terdeteksi. Hubungi admin.', 'error')
                return
            }

            const priority = $('#form-priority').val()
            const requiredDate = $('#form-required-date').val() || null
            const notes = $('#form-notes').val().trim() || null

            try {
                Modal.close()
                Loading.show('Menyimpan request...')

                await Http.post('/purchase-requests', {
                    warehouse_id: _warehouseId,
                    requested_by: user?.user_id ?? user?.id,
                    priority,
                    required_date: requiredDate,
                    notes,
                    items: [],
                })

                Toast.show('Request PO berhasil dibuat.', 'success')
                loadData()

            } catch (err) {
                Toast.show('Gagal menyimpan: ' + err.message, 'error')
            } finally {
                Loading.hide()
            }
        },
    })
}

// ─── Detail PO — sementara dari dummy, ganti Http.get saat BE siap ──
async function _showDetailPO(id) {
    // TODO: ganti dengan Http.get(`/purchase-orders/${id}`) saat BE siap
    const po = DUMMY_PO.find(p => p.id == id)
    if (!po) { Toast.show('Data PO tidak ditemukan.', 'error'); return }

    Modal.open({
        title: `Detail PO — ${po.po_number}`,
        body: `
            <div class="space-y-3 text-sm">
                <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div class="text-gray-500">Supplier</div>
                    <div class="font-medium text-gray-800">${po.supplier_name}</div>
                    <div class="text-gray-500">Tanggal PO</div>
                    <div class="text-gray-700">${Format.date(po.po_date)}</div>
                    <div class="text-gray-500">Status</div>
                    <div>${badge(po.status)}</div>
                    <div class="text-gray-500">Grand Total</div>
                    <div class="font-semibold text-gray-800">${Format.currency(po.grand_total)}</div>
                </div>
                <p class="text-xs text-orange-500 border-t pt-2">
                    ⚠ Detail item akan tersedia setelah endpoint Purchase Order siap.
                </p>
            </div>`,
        actions: `
            <button id="modal-btn-ok"
                class="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700
                       text-white text-sm font-medium transition">Tutup</button>`,
        onOpen: () => { $('#modal-btn-ok').one('click', () => Modal.close()) },
    })
}

// ─── Detail Request PO ────────────────────────────────────────
async function _showDetailRequest(id) {
    Loading.show('Memuat detail request...')
    try {
        const res = await Http.get(`/purchase-requests/${id}`)
        const pr = res.data

        const items = pr.items ?? []
        const canEdit = ['DRAFT', 'SUBMITTED'].includes(pr.status)

        // ── State qty_ordered per item ─────────────────────────────────
        const _itemQtys = {}
        items.forEach(item => {
            _itemQtys[item.id] = item.qty_ordered ?? 0
        })

        // ── Render satu cell qty_ordered ───────────────────────────────
        function renderQtyCell(itemId) {
            const qty = _itemQtys[itemId]
            if (!canEdit) {
                return `<span class="text-gray-800 tabular-nums">${Format.number(qty)}</span>`
            }
            return `
                <input type="number" data-qty-item="${itemId}"
                    class="qty-cell-input w-20 text-right text-xs border border-dashed border-blue-300
                           rounded px-1.5 py-0.5 text-blue-700 font-medium focus:outline-none
                           focus:ring-1 focus:ring-blue-400 tabular-nums"
                    value="${qty}" min="0" step="0.01">`
        }

        const itemRows = items.map((item, i) => `
            <tr class="border-t border-gray-100 text-xs">
                <td class="py-1 px-2 text-gray-400">${i + 1}</td>
                <td class="py-1 px-2 whitespace-nowrap text-gray-700">${item.material_code ?? '-'} — ${item.material_name ?? '-'}</td>
                <td class="py-1 px-2 text-right tabular-nums text-gray-600">${Format.number(item.qty_requested ?? 0)}</td>
                <td class="py-1 px-2 text-center" id="qty-cell-${item.id}">${renderQtyCell(item.id)}</td>
                <td class="py-1 px-2 text-center text-gray-600">${item.unit_code ?? '-'}</td>
            </tr>`).join('')

        Modal.open({
            title: `${pr.pr_number ?? id} — ${pr.priority ?? ''} ${pr.priority === 'URGENT' ? '⚠' : ''}`,
            body: `
                <div class="space-y-3 text-sm">
                    <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                        <div class="flex flex-col">
                            <div class="text-gray-500">Oleh</div>
                            <div class="font-medium text-gray-800">${pr.requester_name ?? '-'}</div>
                        </div>
                        <div class="flex flex-col">
                            <div class="text-gray-500">Departemen</div>
                            <div class="font-medium text-gray-800">${pr.department_name ?? '-'}</div>
                        </div>
                        <div class="flex flex-col">
                            <div class="text-gray-500">Gudang</div>
                            <div class="font-medium text-gray-800">${pr.warehouse_name ?? '-'}</div>
                        </div>
                        <div class="flex flex-col">
                            <div class="text-gray-500">Tanggal</div>
                            <div class="font-medium text-gray-800">${pr.pr_date ? Format.date(pr.pr_date) : '-'}</div>
                        </div>
                        <div class="flex flex-col">
                            <div class="text-gray-500">Status</div>
                            <div class="font-medium text-gray-800"> ${pr.status ?? ''}</div>
                        </div>
                        <div class="flex flex-col">
                            <div class="text-gray-500">Catatan</div>
                            <div class="font-medium text-gray-800"> ${pr.notes ?? '-'}</div>
                        </div>
                    </div>
                    <div class="border-t pt-2">
                        <p class="text-md font-bold text-gray-600 mb-1">Data | ${pr.total_items ?? items.length}</p>
                        <div class="overflow-x-auto max-h-48">
                            <table class="w-full text-xs">
                                <thead class="bg-gray-50 text-gray-500 sticky top-0">
                                    <tr>
                                        <th class="py-1 px-2 text-left w-6">#</th>
                                        <th class="py-1 px-2 text-left">Material</th>
                                        <th class="py-1 px-2 text-right">Requested</th>
                                        <th class="py-1 px-2 text-right">PO</th>
                                        <th class="py-1 px-2 text-center">Satuan</th>
                                    </tr>
                                </thead>
                                <tbody>${itemRows || '<tr><td colspan="5" class="text-center py-3 text-gray-400">Tidak ada item</td></tr>'}</tbody>
                            </table>
                        </div>
                    </div>
                </div>`,
            actions: (() => {
                const canApprove = pr.status === 'SUBMITTED'
                if (!canApprove) return ''
                return `
                        <button id="modal-btn-reject"
                            class="h-8 px-4 rounded-lg border border-red-300 bg-red-50
                                   text-red-600 text-sm font-medium hover:bg-red-100 transition">
                            Tolak
                        </button>
                        <button id="modal-btn-approve"
                            class="h-8 px-4 rounded-lg bg-green-600 hover:bg-green-700
                                   text-white text-sm font-medium transition">
                            Approve
                        </button>`
            })(),
            onOpen: () => {
                // ── Input qty hanya update state lokal, TIDAK auto-save ────
                // Sinkronkan state saat nilai input berubah
                if (canEdit) {
                    $(document).on('input.qtyLocal', '.qty-cell-input', function () {
                        const itemId = $(this).data('qty-item')
                        const val = parseFloat($(this).val())
                        if (!isNaN(val) && val >= 0) {
                            _itemQtys[itemId] = val
                            // Hapus highlight error jika ada
                            $(this).removeClass('border-red-400 bg-red-50')
                        }
                    })

                    $('#modal-close').one('click.qtyCleanup', () => {
                        $(document).off('input.qtyLocal')
                    })
                }

                // ── Approve — validasi, lalu kirim qty bersama payload approve ──
                $('#modal-btn-approve').one('click', () => {
                    // Baca nilai terkini dari DOM ke state
                    $('.qty-cell-input').each(function () {
                        const itemId = $(this).data('qty-item')
                        const val = parseFloat($(this).val())
                        if (!isNaN(val)) _itemQtys[itemId] = val
                    })

                    // Validasi semua item qty > 0
                    const emptyItems = items.filter(item => (_itemQtys[item.id] ?? 0) <= 0)
                    if (emptyItems.length > 0) {
                        const names = emptyItems.map(item => item.material_code ?? ('#' + item.id)).join(', ')
                        Toast.show('Qty PO belum diisi untuk: ' + names, 'error')
                        emptyItems.forEach(item => {
                            $(`#qty-cell-${item.id} input`).addClass('border-red-400 bg-red-50')
                        })
                        return
                    }

                    // Susun payload qty per item
                    const qtyPayload = items.map(item => ({
                        id: item.id,
                        qty_ordered: _itemQtys[item.id],
                    }))

                    Modal.confirm({
                        title: 'Konfirmasi Approve',
                        message: `Setujui Request <strong>${pr.pr_number}</strong>? Pastikan semua qty PO sudah benar.`,
                        labelOk: 'Ya, Approve',
                        onOk: async () => {
                            try {
                                Loading.show('Memproses approve...')
                                await Http.post(`/purchase-requests/${id}/approve`, {
                                    action: 'approve',
                                    items: qtyPayload,
                                })
                                Toast.show('Request berhasil di-approve.', 'success')
                                $(document).off('input.qtyLocal')
                                loadData()
                            } catch (err) {
                                Toast.show('Gagal approve: ' + err.message, 'error')
                            } finally {
                                Loading.hide()
                            }
                        },
                    })
                })

                // ── Reject ─────────────────────────────────────────────────
                $('#modal-btn-reject').one('click', () => {
                    Modal.form({
                        title: 'Tolak Request',
                        formHtml: `
                                <p class="text-xs text-gray-500 mb-2">
                                    Request <strong>${pr.pr_number}</strong> akan ditolak.
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
                            if (!reason) { Toast.show('Alasan penolakan wajib diisi.', 'error'); return }
                            try {
                                Modal.close()
                                Loading.show('Memproses penolakan...')
                                await Http.post(`/purchase-requests/${id}/approve`, {
                                    action: 'reject',
                                    rejected_reason: reason,
                                })
                                Toast.show('Request berhasil ditolak.', 'success')
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

// ─── Init ─────────────────────────────────────────────────────
// Sesuaikan layout tabel & visibilitas tombol tambah sesuai tab awal
$('#btn-add-po').toggle(_activeTab === 'po')
_updateTableLayout()
loadData()