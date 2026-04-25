import { Storage } from './global.js'

// Path relatif dari www/pages/ ke halaman login
// Cordova: file:///android_asset/www/pages/login.html
// Dev server: /pages/login.html
const LOGIN_PAGE = 'login.html'

// ─── Guard ───────────────────────────────────────────────────
export function requireAuth() {
    const token = Storage.get('auth_token')
    if (!token) {
        window.location.replace(LOGIN_PAGE)
        throw new Error('Unauthenticated — redirecting to login')
    }
    return true
}

// ─── Ambil data user yang sedang login ───────────────────────
export function getAuthUser() {
    return Storage.get('auth_user', null)
}

// ─── Login ───────────────────────────────────────────────────
export async function login(username, password) {
    // Ganti dengan panggilan API nyata:
    // const data = await Http.post('/auth/login', { username, password })
    // Storage.set('auth_token', data.token)
    // Storage.set('auth_user', data.user)

    // ── SIMULASI (hapus saat integrasi API) ──
    if (username === 'admin' && password === '12345') {
        Storage.set('auth_token', 'dummy-token-xyz')
        Storage.set('auth_user', { name: 'Admin', username })
        return true
    }
    throw new Error('Username atau password salah')
}

// ─── Logout ──────────────────────────────────────────────────
export function logout() {
    Storage.remove('auth_token')
    Storage.remove('auth_user')
    window.location.replace(LOGIN_PAGE)
}