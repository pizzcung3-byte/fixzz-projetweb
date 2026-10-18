// Ubah pengaturan toko di sini, lalu restart server.
module.exports = {
  siteName: 'Fixzz Store',

  // Warna aksen: 'mint' | 'sky' | 'amber' | 'rose' | 'violet'. Ganti lalu restart server.
  accent: 'mint',

  // true = pengunjung langsung disuruh masuk atau daftar (username + password) sebelum melihat toko.
  requireLogin: true,

  // Kunci domain: website hanya mau jalan di host yang terdaftar di sini. Kalau kodenya dicopot dan
  // dijalankan di domain lain, yang muncul hanya tulisan "Mau Ngapain bg? By @maklodevv".
  // Isi dengan domain atau IP aslimu (tanpa http dan tanpa port). Kalau pakai IP:port dari panel hosting, tambahkan IP-nya di sini juga.
  // Kosongkan [] kalau mau mematikan pengecekan.
  allowedHosts: ['fixzzstore.biz.id', 'www.fixzzstore.biz.id', 'www-fixzzstore.biz.id', '*.fixzzstore.biz.id', 'localhost', '127.0.0.1', '[::1]'],

  // Kontak yang tampil di website dan di halaman maintenance.
  telegram: 'policee619',            // username Telegram, tanpa @
  whatsapp: '',                     // nomor WA pakai kode negara, tanpa + dan spasi. Contoh: '6281234567890'. Kosongkan kalau tidak dipakai.
  timezoneLabel: 'WIB',             // label zona waktu di jam maintenance

  port: 3000,                       // bisa ditimpa env PORT
  host: '0.0.0.0',

  // Akun owner dibuat otomatis saat server pertama kali jalan.
  // Password: isi di sini, atau set env OWNER_PASSWORD, atau biarkan kosong
  // (server membuat password acak dan menampilkannya di console sekali saja).
  ownerUsername: 'owner',
  ownerPassword: 'ownervnda',

  minDeposit: 500,                // minimal deposit (Rupiah)
  trustProxy: false,                // true jika di belakang nginx/cloudflare (pakai X-Forwarded-For)

  // Ditampilkan ke user di halaman Deposit. GANTI dengan data asli kamu.
  paymentMethods: [
    { name: 'DANA', detail: '085784203407 a.n. hapiz' },
    { name: 'QRIS', detail: 'Minta kode QRIS lewat chat Telegram' },
    { name: 'Transfer Bank', detail: 'BCA 0000000000 a.n. Nama Kamu' },
  ],

  // Pembayaran otomatis lewat Atlantic (deposit QRIS). Aktif kalau ATLANTIC_API_KEY terisi di file .env.
  payment: {
    atlantic: {
      enabled: true,
      baseUrl: 'https://atlantich2h.com',
      // Dua nilai ini dikirim saat membuat deposit. CEK di dokumentasi Atlantic bagian "create deposit".
      type: 'ewallet',
      metode: 'qris',
      expireMinutes: 15,            // batas waktu bayar
      creditMode: 'nominal',        // 'nominal' = user dapat sebesar nominal (fee ditanggung toko); 'net' = sebesar saldo bersih dari Atlantic
    },
  },

  // Nokos (nomor OTP). Mode bawaan: stok sendiri. Owner mengisi nomor di Owner menu, kode OTP dimasukkan
  // owner atau dikirim otomatis lewat aplikasi peneruus SMS ke /api/nokos/inbound (butuh NOKOS_INBOUND_SECRET di .env).
  nokos: {
    waitMinutes: 20,                // batas menunggu kode; lewat dari ini saldo dikembalikan otomatis
    recycleNumbers: true,           // nomor yang tidak dapat kode dikembalikan ke stok
  },
};
