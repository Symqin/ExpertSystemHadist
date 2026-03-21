# Hadith Matan Checker — Sistem Pakar Deteksi Hadits Palsu

Aplikasi web **sistem pakar** untuk mendeteksi indikasi hadits palsu (maudhu) berdasarkan analisis **matan** (isi teks hadits). Dibangun dengan Node.js, menggunakan pendekatan **NLP Hybrid** (TF-IDF + Cosine Similarity + Overlap Coverage Score) dan **Forward Chaining Expert System** dengan beberapa aturan inferensi terstruktur.

## 🚀 Fitur Utama

- **NLP Hybrid Engine** — Kombinasi TF-IDF, Cosine Similarity (40%), dan Overlap/Coverage Score (60%) untuk pencarian kemiripan parsial. Jaro-Winkler digunakan **khusus di tahap preprocessing** untuk koreksi ejaan (typo correction), **bukan** untuk scoring.
- **OOV Penalty (Out-of-Vocabulary)** — Kata asing, makian, atau typo parah yang tidak ada di corpus hadits akan mendapat bobot hukuman maksimal (_maxIdf), sehingga skor NLP langsung jatuh drastis alih-alih diabaikan.
- **Forward Chaining Expert System** — serangkaian aturan inferensi (R0, R1, ...) yang mengevaluasi matan secara berurutan dari fakta menuju kesimpulan. Aturan baru bisa ditambah tanpa mengubah arsitektur.
- **Kuesioner Interaktif Pakar** — Pertanyaan observasi manual (M1-M5) yang aktif jika skor < 0.60 dan tidak ada red-flag otomatis, memicu aturan R8m-R12.
- **Deteksi Red Flag** — Mengenali pola janji pahala berlebihan, amalan bid'ah, ancaman tidak proporsional, kontradiksi Al-Quran, dan bahasa modern.
- **Database 30.000+ Hadits** — Koleksi hadits shahih dari API publik sebagai rujukan.
- **Top 5 Ranking** — Menampilkan 5 hadits paling mirip beserta skor dan status.

## 🔬 Arsitektur Sistem Pakar

```
Input Teks User
  → Extract Matan (pisahkan dari sanad)
  → Preprocess (lowercase, hapus tanda baca, stopwords)
  → Typo Correction (Jaro-Winkler per token, HANYA preprocessing)
  → TF-IDF Vectorization + OOV Penalty (kata asing diberi bobot hukuman)
  → Cosine Similarity (Global Match, 40%) + Overlap Score (Substring Match, 60%)
  → Ranking + Tier NLP (found / review / notfound)
  → Forward Chaining Sistem Pakar:
      R0: Base Rule (tier NLP → status awal)
      R1: Deteksi pola pahala berlebihan → KUAT_INDIKASI_MAUDHU
      R2: Deteksi amalan bid'ah/khusus kontroversial → LEMAH / PERLU TAHQIQ
      R3: Deteksi ancaman tidak proporsional → LEMAH
      R4: Adjust confidence jika skor borderline
      R5: Deteksi kontradiksi dengan Al-Quran → KUAT_INDIKASI_MAUDHU
      R6: Deteksi pepatah/hoaks medis populer → LA_ASLA_LAHU / PERLU TAHQIQ
      R7: Deteksi bahasa/istilah modern → KUAT_INDIKASI_MAUDHU
      R8: Deteksi pola redaksi via regex → LEMAH / KUAT_INDIKASI_MAUDHU
  → Kesimpulan Otomatis (Jika status = unknown/syubhat & skor < 0.60):
      Pertanyaan Observasi M1 - M5 (Kuesioner Manual)
      R8: M5="YA" (Rikakah Lafadz) → HOAKS / BUKAN HADIS
      R9: M1="YA" (Al-Mujazafah) → KUAT_INDIKASI_MAUDHU
      R10: M2="YA" atau M4="YA" (Ghaib/Mukhalafah) → KUAT_INDIKASI_MAUDHU
      R11: M3="YA" (Politis) → INDIKASI_MAUDHU_POLITIS
      R12: Semua="TIDAK" → STATUS_TIDAK_DIKENALI
  → Kesimpulan Akhir: status pakar + confidence + alasan + rules fired
```

### Tabel Aturan Forward Chaining (ringkas)

| Kode | Nama Aturan | Kondisi (IF) | Kesimpulan (THEN) |
|------|-------------|--------------|-------------------|
| R0 | BASE_RULE | Tier NLP = found / review / notfound | Status awal: MAQBUL / TAHQIQ / SYUBHAT |
| R1 | EXAGGERATED_REWARD | Pola janji pahala sangat berlebihan | KUAT_INDIKASI_MAUDHU |
| R2 | BID'AH_PRACTICE | Amalan khusus bid'ah/khusus kontroversial | LEMAH_CENDERUNG_TIDAK_SHOHIH (confidence medium) |
| R3 | OVER_THREAT | Ancaman tidak proporsional + tier notfound | LEMAH_CENDERUNG_TIDAK_SHOHIH |
| R4 | ADJUST_CONFIDENCE | Tier found tapi skor < 0.85 | Turunkan confidence band |
| R5 | QURAN_CONTRADICTION | Bertentangan dengan prinsip Al-Quran | KUAT_INDIKASI_MAUDHU |
| R6 | POPULAR_QUOTES | Mirip pepatah/hoaks medis populer | LA_ASLA_LAHU (jika notfound) / PERLU_TAHQIQ (jika review) |
| R7 | MODERN_LANGUAGE | Istilah/bahasa modern di matan | KUAT_INDIKASI_MAUDHU |
| R8 | REGEX_RED_FLAGS | Pola redaksi khas via regex | KUAT_INDIKASI_MAUDHU / LEMAH |
| R8(m) | RIKAKAH_AL_LAFZ | M5="YA" (Bahasa Sangat Rancu) | HOAKS_BUKAN_HADIS |
| R9 | AL_MUJAZAFAH | M1="YA" (Pahala/Ancaman Fantastis) | KUAT_INDIKASI_MAUDHU |
| R10 | CONTRADICTION | M2="YA" atau M4="YA" (Ghaib / Empiris) | KUAT_INDIKASI_MAUDHU |
| R11 | FANATIC_POLITICAL| M3="YA" (Kesan pujian/celaan rasis terharap kelompok) | INDIKASI_MAUDHU_POLITIS |
| R12 | UNKNOWN_MANUAL | Semua M="TIDAK" | STATUS_TIDAK_DIKENALI |

## 📁 Struktur Proyek

| File | Peran | Keterangan |
|------|-------|------------|
| `server.js` | User Interface (backend) | Server Express, middleware JSON, CORS, static file |
| `routes/search.js` | Inference Engine | Pipeline utama: NLP hybrid → forward chaining |
| `nlp.js` | Inference Engine (NLP) | extractMatan, preprocessText, correctTypos, buildIdf, vectorize, cosineSimilarity |
| `similarity.js` | Inference Engine (utilitas) | Jaro-Winkler (hanya untuk Typo Correction), normalizeQuery |
| `knowledge_base.js` | Knowledge Base + Rule Engine | Pola red-flag + aturan forward chaining (R0–R8, dapat dikembangkan) |
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
| LEMAH_CENDERUNG_TIDAK_SHOHIH | Mengandung sinyal kelemahan atau riwayat bermasalah |
| LA_ASLA_LAHU | Teks mirip pepatah/mitos populer, tidak dikenal sebagai hadits dalam sumber rujukan |
| KUAT_INDIKASI_MAUDHU | Red flag kuat terpicu (pahala berlebihan, kontradiksi Quran, bahasa modern, ancaman/hoaks spesifik) |

## ⚠️ Disclaimer

Sistem ini **bukan pengganti tahqiq ulama**. Ini adalah alat bantu heuristik berbasis pola teks dan NLP yang memberikan **indikasi awal** dan tetap perlu diverifikasi oleh ahli hadits.
