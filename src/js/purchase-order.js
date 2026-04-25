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

// ─── Data dummy ───────────────────────────────────────────────
const DUMMY_PO = [
    { id: 1, no_po: 'PO-2024-001', supplier: 'PT Sumber Makmur', tanggal: '2024-06-01', total: 12500000, status: 'approved' },
    { id: 2, no_po: 'PO-2024-002', supplier: 'CV Jaya Abadi', tanggal: '2024-06-03', total: 8750000, status: 'draft' },
    { id: 3, no_po: 'PO-2024-003', supplier: 'PT Maju Bersama', tanggal: '2024-06-05', total: 3200000, status: 'partial' },
    { id: 4, no_po: 'PO-2024-004', supplier: 'UD Berkah Sejahtera', tanggal: '2024-06-07', total: 21000000, status: 'done' },
    { id: 5, no_po: 'PO-2024-005', supplier: 'PT Andalan Teknik', tanggal: '2024-06-09', total: 6800000, status: 'approved' },
    { id: 6, no_po: 'PO-2024-006', supplier: 'CV Mitra Sejati', tanggal: '2024-06-11', total: 4150000, status: 'rejected' },
]

const DUMMY_REQUEST = [
    { id: 1, no_req: 'REQ-2024-001', supplier: 'PT Sumber Makmur', tanggal: '2024-05-28', total: 5000000, status: 'pending' },
    { id: 2, no_req: 'REQ-2024-002', supplier: 'CV Jaya Abadi', tanggal: '2024-05-30', total: 2300000, status: 'approved' },
    { id: 3, no_req: 'REQ-2024-003', supplier: 'PT Global Niaga', tanggal: '2024-06-02', total: 9750000, status: 'pending' },
    { id: 4, no_req: 'REQ-2024-004', supplier: 'UD Karya Mandiri', tanggal: '2024-06-04', total: 1850000, status: 'rejected' },
    { id: 5, no_req: 'REQ-2024-005', supplier: 'PT Andalan Teknik', tanggal: '2024-06-06', total: 14000000, status: 'approved' },
]

// ─── Badge status ─────────────────────────────────────────────
const STATUS_BG_CLASS = {
    draft: 'bg-gray-50',
    approved: 'bg-green-50',
    rejected: 'bg-red-50',
    partial: 'bg-yellow-50',
    done: 'bg-blue-50',
    pending: 'bg-orange-50',
}

const STATUS_TEXT_CLASS = {
    draft: 'text-gray-600',
    approved: 'text-green-700',
    rejected: 'text-red-600',
    partial: 'text-yellow-700',
    done: 'text-blue-700',
    pending: 'text-orange-700',
}

function badge(status) {
    const cls = STATUS_TEXT_CLASS[status] ?? 'text-gray-600'
    const label = status.charAt(0).toUpperCase() + status.slice(1)
    return `<span class="inline-block text-xs px-2 py-0.5 rounded-full font-medium ${cls}">${label}</span>`
}

// ─── Icon actions ─────────────────────────────────────────────
const ICON_EYE = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7
           -1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
</svg>`

const ICON_EDIT = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
           m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
</svg>`

function actionButtons(id) {
    return `<div class="flex justify-center gap-1">
        <button data-action="view" data-id="${id}" title="Lihat detail"
            class="w-24 h-8 flex items-center justify-center rounded-md border border-gray-200
                font-bold text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition">
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
        $tbody.append(`
            <tr class="border-t border-gray-100 hover:bg-gray-50 transition">
                <td class="px-3 py-1 text-center text-gray-400 text-xs border border-gray-200">${i + 1}</td>
                <td class="px-3 py-1 font-medium text-gray-800 truncate border border-gray-200">${po.no_po}</td>
                <td class="px-3 py-1 text-gray-600 truncate border border-gray-200">${po.supplier}</td>
                <td class="px-3 py-1 text-center text-gray-500 text-xs border border-gray-200">${Format.date(po.tanggal)}</td>
                <td class="px-3 py-1 text-right text-gray-800 tabular-nums border border-gray-200">${Format.currency(po.total)}</td>
                <td class="px-3 py-1 text-center border border-gray-200 ${STATUS_BG_CLASS[po.status] || ''}">${badge(po.status)}</td>
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
        $tbody.append(`
            <tr class="border-t border-gray-100 hover:bg-gray-50 transition">
                <td class="px-3 py-1 text-center text-gray-400 text-xs border border-gray-200">${i + 1}</td>
                <td class="px-3 py-1 font-medium text-gray-800 truncate border border-gray-200">${req.no_req}</td>
                <td class="px-3 py-1 text-gray-600 truncate border border-gray-200">${req.supplier}</td>
                <td class="px-3 py-1 text-gray-500 text-xs border border-gray-200">${Format.date(req.tanggal)}</td>
                <td class="px-3 py-1 text-right text-gray-800 tabular-nums border border-gray-200">${Format.currency(req.total)}</td>
                <td class="px-3 py-1 text-center border border-gray-200 ${STATUS_BG_CLASS[req.status] || ''}">${badge(req.status)}</td>
                <td class="px-3 py-1 border border-gray-200">${actionButtons(req.id)}</td>
            </tr>`)
    })
}

// ─── Filter ───────────────────────────────────────────────────
function applyFilter() {
    const q = _query.toLowerCase()
    if (_activeTab === 'po') {
        renderPO(_allPO.filter(po =>
            po.no_po.toLowerCase().includes(q) ||
            po.supplier.toLowerCase().includes(q)
        ))
    } else {
        renderRequest(_allRequest.filter(req =>
            req.no_req.toLowerCase().includes(q) ||
            req.supplier.toLowerCase().includes(q)
        ))
    }
}

// ─── Load data ────────────────────────────────────────────────
async function loadData() {
    Loading.show(_activeTab === 'po' ? 'Memuat data PO...' : 'Memuat Request PO...')
    $('#btn-refresh svg').css({ transition: 'transform .5s', transform: 'rotate(360deg)' })
    setTimeout(() => $('#btn-refresh svg').css({ transition: '', transform: '' }), 500)
    try {
        if (_activeTab === 'po') {
            _allPO = DUMMY_PO       // ganti: await Http.get('/purchase-orders')
        } else {
            _allRequest = DUMMY_REQUEST  // ganti: await Http.get('/request-po')
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
    Modal.form({
        title: _activeTab === 'po' ? 'Tambah Purchase Order' : 'Tambah Request PO',
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
            Toast.show('Data berhasil disimpan', 'success')
        },
    })
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
    if (action === 'view') Modal.alert({ title: `Detail ${label}`, message: `Halaman detail #${id} belum diimplementasi.` })
    if (action === 'edit') Modal.alert({ title: `Edit ${label}`, message: `Halaman edit #${id} belum diimplementasi.` })
})

// ─── Tangkap event tab ────────────────────────────────────────
document.addEventListener('tab:change', ({ detail }) => {
    _activeTab = detail.tab
    _query = ''
    $('#input-search').val('').attr('placeholder',
        _activeTab === 'po' ? 'Cari nomor PO / supplier...' : 'Cari nomor request / supplier...'
    )
    loadData()
})

// ─── Init ─────────────────────────────────────────────────────
loadData()