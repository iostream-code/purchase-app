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
    open(opts = {}) {
        $('#modal-title').text(opts.title ?? '')
        $('#modal-body').html(opts.body ?? '')
        $('#modal-actions').html(opts.actions ?? '')
        $('#modal-overlay').removeClass('hidden')
        requestAnimationFrame(() => {
            $('#modal-box')
                .removeClass('translate-y-full sm:scale-95 opacity-0')
                .addClass('translate-y-0 sm:scale-100 opacity-100')
        })
        if (typeof opts.onOpen === 'function') opts.onOpen()
    },

    close() {
        $('#modal-box')
            .removeClass('translate-y-0 sm:scale-100 opacity-100')
            .addClass('translate-y-full sm:scale-95 opacity-0')
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
            },
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
            day: 'numeric', month: 'long', year: 'numeric',
        })
    },
    currency(n) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
        }).format(n)
    },
    number(n) {
        return new Intl.NumberFormat('id-ID').format(n)
    },
}

// ─── Clock ───────────────────────────────────────────────────
export function startClock() {
    function tick() {
        const now = new Date()

        // Jam H:i:s
        const time = now.toLocaleTimeString('id-ID', {
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        })

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
    async function check() {
        try {
            // Fetch dengan no-store agar tidak kena cache browser
            await fetch(window.location.origin + '/', {
                method: 'HEAD',
                cache: 'no-store',
                signal: AbortSignal.timeout(5000),
            })
            $('#connection-check-box')
                .removeClass('bg-red-600')
                .addClass('bg-green-500')
        } catch {
            $('#connection-check-box')
                .removeClass('bg-green-500')
                .addClass('bg-red-600')
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
        class="hidden fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">

        <div id="modal-box" class="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl
                   shadow-xl overflow-hidden
                   translate-y-full sm:translate-y-0 sm:scale-95 opacity-0
                   transition-all duration-200">

          <!-- Modal header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 id="modal-title" class="font-semibold text-gray-800 text-base"></h2>
            <button id="modal-close" class="w-7 h-7 flex items-center justify-center rounded-lg
                       text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Modal body -->
          <div id="modal-body" class="px-5 py-4 text-sm text-gray-600 leading-relaxed"></div>

          <!-- Modal actions -->
          <div id="modal-actions" class="flex gap-2 justify-end px-5 py-3 border-t border-gray-100 bg-gray-50"></div>

        </div>
      </div>
    `)

        // Event listener dipasang setelah markup ada di DOM
        $('#modal-overlay').on('click', function (e) { if (e.target === this) Modal.close() })
        $('#modal-close').on('click', () => Modal.close())
    }
}