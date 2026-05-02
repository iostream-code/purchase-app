import $ from 'jquery'

// ─── Storage ─────────────────────────────────────────────────
export const Storage = {
    set(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)) } catch { }
    },
    get(key, fallback = null) {
        try {
            const item = localStorage.getItem(key)
            return item !== null ? JSON.parse(item) : fallback
        } catch { return fallback }
    },
    remove(key) { localStorage.removeItem(key) },
    clear() { localStorage.clear() },
}

// ─── Toast ───────────────────────────────────────────────────
export const Toast = {
    show(message, type = 'info', duration = 3000) {
        const bg = {
            info: 'bg-blue-500',
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
        }[type] ?? 'bg-gray-700'

        // Pastikan container ada
        if (!$('#toast-container').length) {
            $('body').append('<div id="toast-container" class="fixed bottom-20 right-4 z-50 flex flex-col gap-2"></div>')
        }

        const $t = $(`
      <div class="px-4 py-3 rounded-lg text-white text-sm shadow-lg
                  transition-all duration-300 opacity-0 translate-y-2 ${bg}">
        ${message}
      </div>`)

        $('#toast-container').append($t)
        requestAnimationFrame(() => $t.removeClass('opacity-0 translate-y-2'))
        setTimeout(() => {
            $t.addClass('opacity-0 translate-y-2')
            setTimeout(() => $t.remove(), 300)
        }, duration)
    },
}

export const Modal = {
    _onClose: null,   // callback cleanup — diset oleh open(), dipanggil saat close()

    open(opts = {}) {
        this._onClose = typeof opts.onClose === 'function' ? opts.onClose : null
        $('#modal-title').text(opts.title ?? '')
        $('#modal-body').html(opts.body ?? '')
        $('#modal-actions').html(opts.actions ?? '')
        $('#modal-overlay').removeClass('hidden')
        requestAnimationFrame(() => {
            $('#modal-box')
                .removeClass('translate-y-full opacity-0')
                .addClass('translate-y-0 opacity-100')
        })
        if (typeof opts.onOpen === 'function') opts.onOpen()
    },

    close() {
        // Jalankan cleanup sebelum menyembunyikan modal
        if (typeof this._onClose === 'function') {
            try { this._onClose() } catch { /* abaikan error di cleanup */ }
            this._onClose = null
        }
        $('#modal-box')
            .removeClass('translate-y-0 opacity-100')
            .addClass('translate-y-full opacity-0')
        setTimeout(() => $('#modal-overlay').addClass('hidden'), 200)
    },

    confirm(opts = {}) {
        const okClass = opts.danger
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        this.open({
            title: opts.title ?? 'Konfirmasi',
            body: `<p class="text-gray-600">${opts.message ?? 'Apakah Anda yakin?'}</p>`,
            actions: `
                <button id="modal-btn-cancel"
                    class="h-8 px-4 rounded-lg border border-gray-200
                        text-sm text-gray-600 hover:bg-gray-100 transition">
                    ${opts.labelCancel ?? 'Batal'}
                </button>
                <button id="modal-btn-ok"
                    class="h-8 px-4 rounded-lg text-sm font-medium transition ${okClass}">
                    ${opts.labelOk ?? 'Ya'}
                </button>`,
            onOpen: () => {
                $('#modal-btn-ok').one('click', () => { this.close(); opts.onOk?.() })
                $('#modal-btn-cancel').one('click', () => { this.close(); opts.onCancel?.() })
            },
        })
    },

    alert(opts = {}) {
        this.open({
            title: opts.title ?? 'Informasi',
            body: `<p class="text-gray-600">${opts.message ?? ''}</p>`,
            actions: `
                <button id="modal-btn-ok"
                    class="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700
                           text-white text-sm font-medium transition">
                    ${opts.label ?? 'OK'}
                </button>`,
            onOpen: () => { $('#modal-btn-ok').one('click', () => this.close()) },
        })
    },

    form(opts = {}) {
        this.open({
            title: opts.title ?? 'Form',
            body: opts.formHtml ?? '',
            actions: `
                <button id="modal-btn-cancel"
                    class="h-8 px-4 rounded-lg border border-gray-200
                           text-sm text-gray-600 hover:bg-gray-100 transition">
                    Batal
                </button>
                <button id="modal-btn-submit"
                    class="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700
                           text-white text-sm font-medium transition">
                    ${opts.labelSubmit ?? 'Simpan'}
                </button>`,
            onOpen: () => {
                $('#modal-btn-cancel').one('click', () => this.close())
                $('#modal-btn-submit').one('click', () => opts.onSubmit?.())
                // Tangkap return value dari onOpen caller sebagai onClose cleanup
                if (typeof opts.onOpen === 'function') {
                    const cleanup = opts.onOpen()
                    if (typeof cleanup === 'function') this._onClose = cleanup
                }
            },
            onClose: opts.onClose ?? null,
        })
    },
}

// ─── Loading ─────────────────────────────────────────────────
export const Loading = {
    show(msg = 'Memuat...') {
        $('#loading-overlay').find('#loading-msg').text(msg)
        $('#loading-overlay').removeClass('hidden')
    },
    hide() {
        $('#loading-overlay').addClass('hidden')
    },
}

// ─── HTTP ────────────────────────────────────────────────────
export const Http = {
    _base: import.meta.env.VITE_API_BASE_URL ?? '',

    _headers() {
        const token = Storage.get('auth_token')
        return {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }
    },

    async _fetch(method, endpoint, body = null) {
        const res = await fetch(`${this._base}${endpoint}`, {
            method,
            headers: this._headers(),
            ...(body ? { body: JSON.stringify(body) } : {}),
        })

        // Token expired → paksa logout
        if (res.status === 401) {
            Storage.remove('auth_token')
            Storage.remove('auth_user')
            window.location.replace('login.html')
            return
        }

        // HEAD / 204 No Content → tidak ada body, langsung return null
        const hasBody = method !== 'HEAD' && res.status !== 204
        if (!hasBody) {
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return null
        }

        // Cek Content-Type sebelum parse JSON agar tidak crash
        // jika server mengembalikan HTML (misal halaman error)
        const ct = res.headers.get('Content-Type') ?? ''
        if (!ct.includes('application/json')) {
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return null
        }

        const data = await res.json()
        if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`)
        return data
    },

    get(endpoint, params = {}) {
        const qs = new URLSearchParams(params).toString()
        return this._fetch('GET', endpoint + (qs ? '?' + qs : ''))
    },
    post(endpoint, body) { return this._fetch('POST', endpoint, body) },
    put(endpoint, body) { return this._fetch('PUT', endpoint, body) },
    delete(endpoint) { return this._fetch('DELETE', endpoint) },
}

// ─── Format ──────────────────────────────────────────────────
export const Format = {
    date(iso) {
        return new Date(iso).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric',
        })
    },

    /**
     * Format angka menjadi string ribuan dengan delimiter titik (.)
     * Contoh: 1500000 → "1.500.000"
     */
    number(n) {
        return Number(n).toLocaleString('id-ID')
    },

    /**
     * Format angka sebagai harga DENGAN prefix "Rp " dan delimiter titik.
     * Contoh: 1500000 → "Rp 1.500.000"
     */
    currency(n) {
        return 'Rp\u00a0' + Format.number(n)
    },

    /**
     * Format angka sebagai harga TANPA prefix "Rp", delimiter titik.
     * Contoh: 1500000 → "1.500.000"
     * Berguna untuk input, kolom tabel sempit, atau kalkulasi tampilan.
     */
    amount(n) {
        return Format.number(n)
    },
}

// ─── Clock ───────────────────────────────────────────────────
export function startClock() {
    function tick() {
        const now = new Date()

        // Jam H:i:s
        const time = now.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        }).replace(/\./g, ':');

        // Tanggal DD-MMM-YYYY (contoh: 12-Apr-2026)
        const day = String(now.getDate()).padStart(2, '0')
        const month = now.toLocaleString('en-GB', { month: 'short' })
        const year = now.getFullYear()
        const date = `${day}-${month}-${year}`

        $('#clock-time').text(time)
        $('#clock-date').text(date)
    }
    tick()
    setInterval(tick, 1000)
}

// ─── Connection Check ─────────────────────────────────────────
export function startConnectionCheck(intervalMs = 30000) {
    // Strip trailing slash agar tidak jadi double slash
    const _apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

    // Jika VITE_API_BASE_URL tidak diset (dev di browser biasa), fallback ke origin
    const _pingUrl = _apiBase
        ? `${_apiBase}/ping`
        : `${window.location.origin}/ping`

    const $box = $('#connection-check-box')

    /** Set warna indikator: 'checking' | 'online' | 'offline' */
    function setStatus(status) {
        $box
            .removeClass('bg-red-600 bg-green-500 bg-yellow-400')
            .addClass(
                status === 'online' ? 'bg-green-500' :
                    status === 'checking' ? 'bg-yellow-400' :
                        'bg-red-600'
            )
    }

    async function check() {
        setStatus('checking')
        try {
            const res = await fetch(_pingUrl, {
                method: 'HEAD',
                cache: 'no-store',
                signal: AbortSignal.timeout(5000),
            })
            // Anggap online hanya jika server merespons 2xx
            setStatus(res.ok ? 'online' : 'offline')
        } catch {
            setStatus('offline')
        }
    }

    check()
    setInterval(check, intervalMs)
}

// ─── Shared HTML fragments ───────────────────────────────────
// Dipakai semua halaman — inject loading overlay, toast, dan modal
export function injectSharedUI() {
    // Loading overlay
    if (!$('#loading-overlay').length) {
        $('body').prepend(`
      <div id="loading-overlay"
        class="hidden fixed inset-0 bg-white/80 backdrop-blur-sm z-50
               flex flex-col items-center justify-center gap-3">
        <div class="w-9 h-9 border-4 border-blue-500 border-t-transparent
                    rounded-full animate-spin"></div>
        <span id="loading-msg" class="text-sm text-gray-500">Memuat...</span>
      </div>
    `)
    }

    // Toast container
    if (!$('#toast-container').length) {
        $('body').append('<div id="toast-container" class="fixed bottom-20 right-4 z-50 flex flex-col gap-2"></div>')
    }

    // Modal — inject markup + pasang event listener (hanya sekali)
    if (!$('#modal-overlay').length) {
        $('body').append(`
      <div id="modal-overlay"
        class="hidden fixed inset-0 z-50 flex items-start justify-center">

        <div id="modal-box" class="bg-white w-full h-full flex flex-col
                   translate-y-full opacity-0
                   transition-all duration-200">

          <!-- Modal header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0
                      bg-linear-315 from-[#1e40af] to-[#2563eb]">
            <h2 id="modal-title" class="font-semibold text-white text-base"></h2>
            <button id="modal-close" class="w-7 h-7 flex items-center justify-center rounded-lg
                       text-white/70 hover:bg-white/20 hover:text-white transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Modal body -->
          <div id="modal-body" class="flex-1 overflow-y-auto px-5 py-4 text-sm text-gray-600 leading-relaxed"></div>

          <!-- Modal actions -->
          <div id="modal-actions" class="flex gap-2 justify-end px-5 py-3 border-t border-gray-100 bg-gray-50 shrink-0"></div>

        </div>
      </div>
    `)

        // Event listener dipasang setelah markup ada di DOM
        $('#modal-close').on('click', () => Modal.close())
    }
}

// ─── Header & Nav ────────────────────────────────────────────
// Definisi tab — tambahkan entri baru di sini untuk halaman baru
const NAV_TABS = [
    {
        id: 'purchase-order',
        label: 'Purchase',
        href: 'purchase-order.html',
    },
    {
        id: 'retur',
        label: 'Return',
        href: 'retur.html',
    },
]

/**
 * injectHeader(activeNavId)
 * Menyuntikkan header biru + navbar halaman ke awal <body>.
 * activeNavId — id tab nav aktif, misal 'purchase-order' atau 'retur'
 *
 * Elemen yang dihasilkan:
 *   1. <header>  — background biru, berisi baris connection-box / username / clock / logout
 *   2. gap px-3  — jarak antara header dan navbar
 *   3. #app-nav  — bar tab halaman (abu gradient)
 */
export function injectHeader(activeNavId) {
    // ── 1. Header biru ──────────────────────────────────────
    const header = `
        <header id="app-header"
                class="bg-linear-315 from-[#1e40af] to-[#2563eb] px-3 py-3 shrink-0 z-30">
            <div class="flex items-center justify-between">
                <!-- Kiri: indikator koneksi + nama user -->
                <div class="flex items-center gap-2">
                    <div id="connection-check-box"
                         class="w-6 h-6 bg-red-600 border-2 border-white rounded-xs shrink-0"></div>
                    <span id="header-username"
                          class="font-semibold text-white text-lg leading-none"></span>
                </div>
                <!-- Kanan: jam & tanggal + tombol logout -->
                <div class="flex items-center gap-3">
                    <div class="text-right leading-none">
                        <div id="clock-time"
                             class="text-sm font-semibold text-white tabular-nums"></div>
                        <div id="clock-date"
                             class="text-xs text-blue-200 mt-0.5"></div>
                    </div>
                    <button id="btn-logout" title="Keluar"
                            class="flex items-center justify-center text-white/80 hover:text-white transition">
                        <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6
                                   a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                        </svg>
                    </button>
                </div>
            </div>
        </header>`

    // ── 2. Navbar tab halaman ────────────────────────────────
    const tabs = NAV_TABS.map(tab => {
        const isActive = tab.id === activeNavId
        const cls = isActive
            ? 'bg-[#f97316] text-white font-bold border border-orange-700'
            : 'text-gray-600 font-semibold hover:bg-gray-100/60 border border-gray-300'
        return `
            <a href="${tab.href}"
               class="flex-1 flex items-center justify-center py-2.5 text-sm
                      transition-colors ${cls}">
                ${tab.label}
            </a>`
    }).join('')

    const nav = `
        <div id="app-nav"
             class="flex shrink-0 mt-2 px-2">
            ${tabs}
        </div>`

    // ── Inject ke awal <body> (sebelum konten halaman) ───────
    $('body').prepend(nav).prepend(header)
}

/** @deprecated Gunakan injectHeader(). Alias untuk kompatibilitas mundur. */
export function injectNav(activeId) { injectHeader(activeId) }