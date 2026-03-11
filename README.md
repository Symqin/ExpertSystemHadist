# Hadith Palsu (Maudhu) Detector App

Aplikasi web pendeteksi hadits palsu (Maudhu) dan Dhaif Jiddan berbasis *Sistem Pakar Forward-Chaining* di Node.js. Sistem ini menggunakan *Knowledge Base* lokal untuk mendeteksi keywords dari matan-matan hadits bermasalah yang sering beredar di masyarakat. Jika matan tidak terdeteksi palsu, sistem akan melakukan *fallback search* ke database lokal SQLite menggunakan algoritma *Jaro-Winkler Hybrid* untuk menemukan referensi aslinya di kitab-kitab shahih.

## 🚀 Fitur App
- **Sistem Pakar (Knowledge Base)**: Mendeteksi indikasi hadits maudhu/palsu (seperti "kebersihan sebagian dari iman", "tuntut ilmu ke cina", dll) dan langsung menembak dengan dalil & sanad ulama mengapa hadits tersebut dihukumi palsu/lemah.
- **Similarity Fallback**: Jika bukan matan yang terdeteksi palsu, mesin langsung mencari rekaman yang mirip dari puluhan ribu data hadits asli.
- **Top 5 Rank & Status**: Menampilkan kemiripan tertinggi beserta status konfirmasinya.
- **Data Cleaner Script**: Script *fetcher* opsional untuk mendownload ribuan hadits dari public API ke dalam SQLite.

## 📁 Struktur Proyek
- `knowledge_base.js`: (BARU) Kumpulan Rules sistem pakar untuk mendeteksi matan bermasalah.
- `database.js`: Setup tabel sqlite local.
- `fetcher.js`: Loop API downloader & populator database.
- `similarity.js`: Modul Jaro & Jaro-Winkler function.
- `server.js`: Root Express Server configuration.
- `routes/search.js`: API search logic & scoring calculator loop.
- `public/`: UI directory (Vanilla HTML + JS + Tailwind CSS via CDN).

## 🛠️ Persyaratan
- Node.js (v14 atau lebih baru direkomendasikan).

---

## 💻 Cara Instalasi

1. Clone atau taruh folder proyek ini di direktori Anda.
2. Buka terminal atau CMD, arahkan pada file proyek ini.
3. Jalankan NPM Install untuk mendownload framework Express dan driver SQLite lokal:
   ```bash
   npm install
   ```

## 📚 Cara Mengisi Database (Populate Data)

Sebelum menggunakan fitur pencarian, Anda **HARUS** mengisi database SQLite lokal terlebih dahulu.

Jalankan script ini:
```bash
node fetcher.js
```
*Tunggu hingga seluruh request API pagination selesai dan log terminal menampilkan teks **"Finished populating database"**.*

## ⚡ Cara Menjalankan Server & Aplikasi

1. Setelah database penuh, jalankan Backend Express web server pakai syntax ini:
   ```bash
   node server.js
   ```
2. Aplikasi port akan berjalan. Buka link ini di browser Anda:
   **[http://localhost:3000](http://localhost:3000)**

3. Ketik potongan hadits pada form pencarian bahasa indonesia dan klik "Cari Kemiripan". Misal `Amal sesuai dengan niat`!
