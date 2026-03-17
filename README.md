# Hadith Matan Checker — Sistem Pakar Deteksi Hadits Palsu

Aplikasi web **sistem pakar** untuk mendeteksi indikasi hadits palsu (maudhu) berdasarkan analisis **matan** (isi teks hadits). Dibangun dengan Node.js, menggunakan pendekatan **NLP Hybrid** (TF-IDF + Cosine Similarity + Jaro-Winkler) dan **Forward Chaining Expert System** dengan 7 aturan inferensi.

## 🚀 Fitur Utama

- **NLP Hybrid Engine** — Kombinasi TF-IDF, Cosine Similarity (75%), dan Jaro-Winkler (25%) untuk pencarian kemiripan matan.
- **Forward Chaining Expert System** — 7 aturan inferensi (R0–R6) yang mengevaluasi matan secara berurutan dari fakta menuju kesimpulan.
- **Deteksi Red Flag** — Mengenali pola janji pahala berlebihan, amalan bid'ah, ancaman tidak proporsional, kontradiksi Al-Quran, dan bahasa modern.
- **Database 30.000+ Hadits** — Koleksi hadits shahih dari API publik sebagai rujukan.
- **Top 5 Ranking** — Menampilkan 5 hadits paling mirip beserta skor dan status.

## 🔬 Arsitektur Sistem Pakar

```
Input Teks User
  → Extract Matan (pisahkan dari sanad)
  → Preprocess (lowercase, hapus tanda baca, stopwords)
  → Typo Correction (Jaro-Winkler per token)
  → TF-IDF Vectorization + Cosine Similarity
  → Jaro-Winkler Matan-level + Substring Boost
  → Ranking + Tier NLP (found / review / notfound)
  → Forward Chaining Sistem Pakar:
      R0: Base Rule (tier NLP → status awal)
      R1: Deteksi pola pahala berlebihan → MAUDHU
      R2: Deteksi amalan bid'ah kontroversial → MAUDHU
      R3: Deteksi ancaman tidak proporsional → LEMAH
      R4: Adjust confidence jika skor borderline
      R5: Deteksi kontradiksi dengan Al-Quran → MAUDHU
      R6: Deteksi bahasa/istilah modern → MAUDHU
  → Kesimpulan: status pakar + confidence + alasan + rules fired
```

### Tabel Aturan Forward Chaining (R0–R6)

| Kode | Nama Aturan | Kondisi (IF) | Kesimpulan (THEN) |
|------|-------------|-------------|-------------------|
| R0 | BASE_RULE | Tier NLP = found / review / notfound | Status awal: MAQBUL / TAHQIQ / SYUBHAT |
| R1 | EXAGGERATED_REWARD | Pola janji pahala berlebihan (11 pola) | KUAT_INDIKASI_MAUDHU |
| R2 | BID'AH_PRACTICE | Pola amalan bid'ah kontroversial (6 pola) | KUAT_INDIKASI_MAUDHU |
| R3 | OVER_THREAT | Ancaman tidak proporsional + tier notfound | LEMAH_TIDAK_SHAHIH |
| R4 | ADJUST_CONFIDENCE | Tier found tapi skor < 0.85 | Turunkan confidence band |
| R5 | QURAN_CONTRADICTION | Bertentangan dengan prinsip Al-Quran (16 pola) | KUAT_INDIKASI_MAUDHU |
| R6 | MODERN_LANGUAGE | Bahasa/istilah modern anakronistik (30+ pola) | KUAT_INDIKASI_MAUDHU |

## 📁 Struktur Proyek

| File | Peran | Keterangan |
|------|-------|------------|
| `server.js` | User Interface (backend) | Server Express, middleware JSON, CORS, static file |
| `routes/search.js` | Inference Engine | Pipeline utama: NLP hybrid → forward chaining |
| `nlp.js` | Inference Engine (NLP) | extractMatan, preprocessText, correctTypos, buildIdf, vectorize, cosineSimilarity |
| `similarity.js` | Inference Engine (utilitas) | Jaro Similarity, Jaro-Winkler, normalizeQuery |
| `knowledge_base.js` | Knowledge Base + Rule Engine | Pola red-flag + aturan forward chaining R0–R6 |
| `database.js` | Knowledge Base (data) | Koneksi dan inisialisasi SQLite |
| `fetcher.js` | Knowledge Acquisition | Download hadits dari API publik ke SQLite |
| `public/` | User Interface (frontend) | UI web: input, skor NLP, hasil pakar, alasan keputusan |
| `explain.md` | Dokumentasi | Penjelasan lengkap sistem, algoritma, dan alur kerja |

## 🛠️ Persyaratan

- Node.js (v14 atau lebih baru)

## 💻 Cara Instalasi

1. Clone repository ini:
   ```bash
   git clone https://github.com/Symqin/HadistSystemChecker.git
   cd HadistSystemChecker
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

## 📚 Cara Mengisi Database (Populate Data)

Sebelum menggunakan fitur pencarian, Anda **HARUS** mengisi database SQLite lokal terlebih dahulu:

```bash
node fetcher.js
```
> Tunggu hingga seluruh request API selesai dan terminal menampilkan **"Finished populating database"**.

## ⚡ Cara Menjalankan

1. Jalankan server:
   ```bash
   node server.js
   ```
2. Buka di browser: **[http://localhost:3000](http://localhost:3000)**
3. Ketik potongan matan hadits dan klik **"Cari Kemiripan"**. Contoh: `Amal sesuai dengan niat`

## 📊 Interpretasi Hasil

### Status NLP (Lapisan 1)
| Skor | Status | Artinya |
|------|--------|---------|
| > 0.80 | SHAHIH | Ditemukan padanan matan dengan kemiripan tinggi |
| ≥ 0.50 | PERLU_REVIEW | Kemiripan sedang, perlu verifikasi lanjut |
| < 0.50 | TIDAK_DITEMUKAN | Tidak ditemukan padanan dalam database |

### Status Sistem Pakar (Lapisan 2)
| Status | Artinya |
|--------|---------|
| INSYAALLAH_MAQBUL | Ditemukan dalam sumber rujukan, tidak ada red flag |
| PERLU_TAHQIQ_LANJUT | Kemiripan sedang, butuh verifikasi ulama |
| SYUBHAT | Tidak ditemukan, patut dicurigai |
| LEMAH | Mengandung sinyal kelemahan |
| KUAT_INDIKASI_MAUDHU | Red flag terpicu (pahala berlebihan, kontradiksi Quran, bahasa modern, atau bid'ah) |

## ⚠️ Disclaimer

Sistem ini **bukan pengganti tahqiq ulama**. Ini adalah alat bantu heuristik berbasis pola teks dan NLP yang memberikan **indikasi awal** dan tetap perlu diverifikasi oleh ahli hadits.
