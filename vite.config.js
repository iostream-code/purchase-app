import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
    plugins: [tailwindcss()],
    root: 'src',
    base: './',   // ← WAJIB untuk Cordova: pakai path relatif, bukan '/'
    build: {
        outDir: '../www',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                login: resolve(__dirname, 'src/pages/login.html'),
                purchaseOrder: resolve(__dirname, 'src/pages/purchase-order.html'),
                retur: resolve(__dirname, 'src/pages/retur.html'),
            },
        },
    },
    server: {
        port: 3000,
        open: '/pages/login.html',
    },
})