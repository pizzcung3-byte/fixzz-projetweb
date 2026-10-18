# Fixzz Store

Website jual beli akun Telegram, channel, panel Pterodactyl, top up game, dan nokos, dengan saldo deposit, chat dengan owner, dan menu khusus owner. By @maklodevv

Tanpa dependensi. Cukup Node.js 18 atau lebih baru: `node server.js`.

## Mulai cepat

1. Salin `.env.example` menjadi `.env`, isi `OWNER_PASSWORD` (dan kunci lain yang kamu pakai). Jangan bagikan file ini.
2. Edit `config.js`: `siteName`, `telegram`, `whatsapp`, `paymentMethods`, dan **`allowedHosts`** (domain atau IP aslimu).
3. Jalankan `node server.js`, buka alamatnya, masuk dengan akun owner.
4. Pasang HTTPS (Cloudflare, nginx, atau panel hosting).

Semua data ada di satu file: `data/db.json`. **Backup file ini rutin.**

## Tampilan

Desain minimal dengan efek kaca cair (liquid glass), satu warna aksen. Ganti `accent` di `config.js`: `mint`, `sky`, `amber`, `rose`, atau `violet`. Judul muncul huruf demi huruf saat di-scroll, kartu dan panel masuk otomatis di semua halaman, dan animasi pesawat serta teks berjalan di halaman depan tetap ada. Animasi mati sendiri kalau perangkat meminta gerak dikurangi. Font memakai Google Fonts, jadi perlu internet di sisi pengunjung.

Centang biru kecil muncul di samping nama **owner** (chat, menu, dashboard, kartu kontak) supaya semua orang tahu mana akun owner resmi. Itu penanda di dalam website ini, bukan verifikasi dari Telegram.

## Pembayaran otomatis (Atlantic, QRIS)

1. Isi `ATLANTIC_API_KEY` di `.env`, restart.
2. Di dashboard Atlantic, isi **IP Whitelist** dengan IP publik server, dan **Callback** dengan alamat yang tampil di Owner menu > Pembayaran.
3. User buka Akun > Deposit, isi nominal, scan QRIS. Saldo masuk otomatis.

Cara kerjanya aman: saldo hanya bertambah setelah server menanyakan status ke Atlantic dengan API key dan Atlantic menjawab `success`. Isi kiriman callback tidak dipercaya. Deposit tidak bisa dobel, nominal yang tidak cocok masuk status "Perlu dicek" untuk diputuskan owner, dan API key tidak pernah muncul di website atau database.

**Penting:** alamat dan isi permintaan untuk *cek status* dan *batalkan* sudah sesuai dokumentasi. Untuk *buat deposit* (`/deposit/create`: `reff_id`, `nominal`, `type`, `metode`) dan nama kolom QR di balasannya, dokumentasi yang dikirim belum memuatnya, jadi memakai dugaan yang bisa diubah di `config.js` (`payment.atlantic.type` dan `metode`). Tes dengan deposit kecil (Rp 10.000) sebelum dibuka ke pelanggan.

## Nokos

Mode stok sendiri, lengkap di database: katalog (layanan, negara, harga), stok nomor, dan pesanan.

- **Owner menu > Nokos:** tambah layanan, tempel daftar nomor (satu per baris), lihat pesanan.
- User memilih layanan dan negara, saldo terpotong, dan satu nomor diberikan. Kode OTP muncul di layar user setelah owner menekan **Isi kode**, atau otomatis lewat penerima SMS (di bawah).
- Kalau kode tidak masuk dalam `nokos.waitMinutes` (20 menit), pesanan kedaluwarsa, saldo dikembalikan, dan nomor kembali ke stok.
- **Penerima SMS otomatis:** isi `NOKOS_INBOUND_SECRET` di `.env`. Aplikasi peneruus SMS di HP berisi SIM-mu mengirim `POST /api/nokos/inbound` dengan header `X-Secret` dan isi `{ "number": "...", "text": "..." }`. Kode di dalam SMS dibaca otomatis.

Untuk nomor dari penyedia (misalnya layanan SMS virtual), dibutuhkan akun penyedia yang punya API. Kirim dokumentasinya dan adaptornya bisa ditambahkan.

## Owner

- **Pengguna:** atur saldo user (tambah atau kurangi), saldo owner sendiri, reset password, blokir. Saat owner menambah saldo, user menerima chat "Owner menambahkan saldo Rp 15.000".
- **Deposit, Pesanan, Produk:** kelola seperti biasa.
- **Maintenance:** matikan bagian tertentu (Akun Telegram, Channel & Panel, Top Up Game, Nokos). Pengunjung melihat pemberitahuan dengan jam maintenance dan kontak, owner tetap bisa membuka.
- **Broadcast:** kirim pesan ke semua user.

## Keamanan

Password di-hash (scrypt) dan password lemah ditolak. Sesi memakai cookie HttpOnly, ada batas percobaan login, penolakan permintaan lintas-situs, header keamanan, dan hak owner dicek di server. Pengunjung yang belum login hanya melihat layar masuk (`requireLogin`). Rahasia disimpan di `.env`, bukan di kode.

**Kunci domain:** `allowedHosts` di `config.js` berisi domain atau IP yang boleh menjalankan website ini. Di host lain yang muncul hanya "Mau Ngapain bg? By @maklodevv". Ini mencegah penyalinan biasa. Orang yang paham kode masih bisa menghapus pengecekannya, jadi jangan bagikan source code ke sembarang orang.

## Belum jadi (masih pratinjau)

Pengiriman otomatis **akun Telegram** (bot login, OTP, 2FA) dan **top up game** ke provider masih berupa tampilan. Tombol bayarnya belum memproses apa pun.
