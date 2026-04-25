import $ from 'jquery'
import { requireAuth, getAuthUser, logout } from './auth.js'
import { Http, Format, Toast, Loading, Modal, injectSharedUI, startClock, startConnectionCheck, injectHeader } from './global.js'

requireAuth()
injectSharedUI()
injectHeader('retur')
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
let _allRetur = []
let _query = ''

// ─── Badge status ─────────────────────────────────────────────
const STATUS_BG_CLASS = {
    draft: 'bg-gray-50',
    approved: 'bg-green-50',
    rejected: 'bg-red-50',
    done: 'bg-blue-50',
}

const STATUS_TEXT_CLASS = {
    draft: 'text-gray-600',
    approved: 'text-green-700',
    rejected: 'text-red-600',
    done: 'text-blue-700',
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

// ─── Render tabel ─────────────────────────────────────────────
function renderTable(data) {
    const $tbody = $('#tbl-body').empty()
    $('#badge-count').text(data.length)
    if (!data.length) { $('#empty-state').removeClass('hidden'); return }
    $('#empty-state').addClass('hidden')

    data.forEach((r, i) => {
        $tbody.append(`
            <tr class="border-t border-gray-100 hover:bg-gray-50 transition">
                <td class="px-3 py-2.5 text-center text-gray-400 text-xs border border-gray-200">${i + 1}</td>
                <td class="px-3 py-2.5 font-medium text-gray-800 truncate border border-gray-200">${r.no_retur}</td>
                <td class="px-3 py-2.5 text-gray-600 truncate border border-gray-200">${r.no_po_ref}</td>
                <td class="px-3 py-2.5 text-center text-gray-500 text-xs border border-gray-200">${Format.date(r.tanggal)}</td>
                <td class="px-3 py-2.5 text-right text-gray-800 tabular-nums border border-gray-200">${Format.currency(r.total)}</td>
                <td class="px-3 py-2.5 text-gray-500 text-xs truncate border border-gray-200">${r.alasan}</td>
                <td class="px-3 py-2.5 text-center border border-gray-200 ${STATUS_BG_CLASS[r.status] || ''}">${badge(r.status)}</td>
                <td class="px-3 py-2.5 border border-gray-200">${actionButtons(r.id)}</td>
            </tr>`)
    })
}

// ─── Filter ───────────────────────────────────────────────────
function applyFilter() {
    const q = _query.toLowerCase()
    renderTable(_allRetur.filter(r =>
        r.no_retur.toLowerCase().includes(q) ||
        r.no_po_ref.toLowerCase().includes(q)
    ))
}

// ─── Load data ────────────────────────────────────────────────
async function loadRetur() {
    Loading.show('Memuat data retur...')
    $('#btn-refresh svg').css({ transition: 'transform .5s', transform: 'rotate(360deg)' })
    setTimeout(() => $('#btn-refresh svg').css({ transition: '', transform: '' }), 500)
    try {
        // Ganti dengan: _allRetur = await Http.get('/returs')
        _allRetur = [
            { id: 1, no_retur: 'RTR-2024-001', no_po_ref: 'PO-2024-001', tanggal: '2024-06-10', total: 1500000, status: 'approved', alasan: 'Barang rusak saat pengiriman' },
            { id: 2, no_retur: 'RTR-2024-002', no_po_ref: 'PO-2024-003', tanggal: '2024-06-12', total: 800000, status: 'draft', alasan: 'Tidak sesuai spesifikasi' },
            { id: 3, no_retur: 'RTR-2024-003', no_po_ref: 'PO-2024-005', tanggal: '2024-06-15', total: 2300000, status: 'rejected', alasan: 'Kualitas di bawah standar' },
        ]
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

$('#btn-refresh').on('click', loadRetur)

$(document).on('click', '[data-action]', function () {
    const action = $(this).data('action')
    const id = $(this).data('id')
    if (action === 'view') Modal.alert({ title: 'Detail Retur', message: `Halaman detail Retur #${id} belum diimplementasi.` })
    if (action === 'edit') Modal.alert({ title: 'Edit Retur', message: `Halaman edit Retur #${id} belum diimplementasi.` })
})

$('#btn-add-retur').on('click', () => {
    Modal.form({
        title: 'Tambah Retur',
        formHtml: `
            <div class="space-y-3">
                <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">No PO Referensi</label>
                    <input type="text" id="form-no-po" placeholder="Contoh: PO-2024-001"
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
                <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">Alasan Retur</label>
                    <textarea id="form-alasan" rows="2" placeholder="Jelaskan alasan retur..."
                        class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                               focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"></textarea>
                </div>
            </div>`,
        labelSubmit: 'Simpan',
        onSubmit: () => {
            const noPo = $('#form-no-po').val().trim()
            if (!noPo) { Toast.show('No PO referensi wajib diisi', 'error'); return }
            Modal.close()
            Toast.show('Data retur berhasil disimpan', 'success')
        },
    })
})

// ─── Init ─────────────────────────────────────────────────────
loadRetur()