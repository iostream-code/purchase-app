import $ from 'jquery'
import { login } from './auth.js'
import { Storage, Loading, injectSharedUI } from './global.js'

injectSharedUI()

// Kalau sudah login, skip halaman ini
if (Storage.get('auth_token')) {
    window.location.replace('purchase-order.html')
}

$('#form-login').on('submit', async function (e) {
    e.preventDefault()

    // Reset error
    $('#err-username, #err-password, #err-global').addClass('hidden').text('')

    const username = $('#input-username').val().trim()
    const password = $('#input-password').val()

    // Validasi
    let valid = true
    if (!username) {
        $('#err-username').text('Username wajib diisi').removeClass('hidden')
        valid = false
    }
    if (!password) {
        $('#err-password').text('Password wajib diisi').removeClass('hidden')
        valid = false
    }
    if (!valid) return

    // Submit
    $('#btn-login').prop('disabled', true).text('Memproses...')
    Loading.show('Masuk...')

    try {
        await login(username, password)
        window.location.replace('purchase-order.html')
    } catch (err) {
        $('#err-global').text(err.message).removeClass('hidden')
        $('#input-password').val('')
    } finally {
        $('#btn-login').prop('disabled', false).text('Masuk')
        Loading.hide()
    }
})