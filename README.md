# Hadith Matan Checker — Sistem Pakar Deteksi Hadits Palsu

Aplikasi web **Sistem Pakar** untuk mendeteksi indikasi hadits palsu (maudhu') berdasarkan analisis **matan** (isi teks hadits). Menggunakan metode inferensi **Forward Chaining** murni dengan basis pengetahuan berupa pola-pola red-flag yang sudah dikategorikan.

> **100% Client-Side** — Seluruh logika berjalan langsung di browser. Cukup buka `public/index.html`, tidak perlu server atau database.

## 🚀 Fitur Utama

- **Forward Chaining Expert System** — Aturan inferensi (R1–R8) yang mengevaluasi matan secara berurutan dari fakta menuju kesimpulan.
- **Fact Gathering Otomatis (Hybrid)** — Scan teks menggunakan kombinasi **Regex fleksibel** (untuk kalimat bervariasi) dan **Keyword literal** (untuk istilah tetap).
- **Sesi Penelusuran Fakta Pakar** — Pertanyaan observasi manual (M1–M5) yang aktif jika tidak ada red-flag otomatis terdeteksi, memicu aturan R9–R13.
- **7 Kategori Deteksi Red-Flag** — Mengadopsi pedoman pakar (*Mustalah al-Hadith*) seperti Mubalaghah Fasidah, Tahwil al-Kadzib, Mukhalafah lil-Qur'an, Tarikhiyyah al-Lafz, dan Shorih al-Kadzib (11 pola regex dinamis).
- **Data-Driven Questions** — Pertanyaan M1-M5 dikelola dari satu array config (`FACT_QUESTIONS`) sehingga mudah ditambah atau diubah.

## 🔬 Arsitektur Sistem Pakar (Forward Chaining + Certainty Factor)

```
Input Teks User
  → TAHAP 1: Pengumpulan Fakta (Fact Gathering)
      Scan teks dengan 7 array (Hybrid Regex & Strings) → menghasilkan Fakta boolean (Qarinah)
  → TAHAP 2: Evaluasi Aturan (Forward Chaining + Parallel CF, R1–R8)
      R1: IF hasExaggeratedReward  THEN KUAT_INDIKASI_MAUDHU (CF: 0.80)
      R2: IF hasFabricatedThreat   THEN KUAT_INDIKASI_MAUDHU (CF: 0.90)
      R3: IF hasQuranContradiction THEN KUAT_INDIKASI_MAUDHU (CF: 1.0)
      R4: IF hasModernLanguage     THEN KUAT_INDIKASI_MAUDHU (CF: 0.95)
      R5: IF hasBidahPractice      THEN LEMAH_CENDERUNG_TIDAK_SHOHIH (CF: 0.60)
      R6: IF hasPopularQuotes      THEN LA_ASLA_LAHU (CF: 0.85)
      R7: IF hasRegexRedFlag       THEN KUAT_INDIKASI_MAUDHU (CF: 0.95)
      R8: IF (tidak ada rule terpicu) THEN REQUIRES_FACT_GATHERING (CF: 0.0)
  → TAHAP 3: Fallback Manual (Penelusuran Fakta M1–M5)
      R9:  IF M5="YA" (Rikakah al-Lafz)     → HOAKS_BUKAN_HADIS (CF: 0.90)
      R10: IF M1="YA" (Al-Mujazafah)         → KUAT_INDIKASI_MAUDHU (CF: 0.80)
      R11: IF M2="YA" OR M4="YA" (Ghaib)     → KUAT_INDIKASI_MAUDHU (CF: 0.90)
      R12: IF M3="YA" (Politis)              → INDIKASI_MAUDHU_POLITIS (CF: 0.85)
      R13: IF Semua="TIDAK"                  → STATUS_TIDAK_DIKENALI (CF: 0.0)
  → Kesimpulan Akhir: status + label + alasan + rules fired + Cumulative Certainty Factor (%)
```

### Tabel Aturan Forward Chaining & CF Weights

| Kode | Nama Aturan | Kondisi (IF) | Kesimpulan (THEN) | Bobot CF |
|------|-------------|--------------|-------------------|----------|
| R1 | EXAGGERATED_REWARD | Janji pahala fantastis (*Mubalaghah Fasidah*) | KUAT_INDIKASI_MAUDHU | 0.80 |
| R2 | FABRICATED_THREAT | Ancaman hoaks berantai (*Tahwil al-Kadzib*) | KUAT_INDIKASI_MAUDHU | 0.90 |
| R3 | QURAN_CONTRADICTION | Bertentangan dengan Al-Quran (*Mukhalafah lil-Qur'an*) | KUAT_INDIKASI_MAUDHU | 1.0 |
| R4 | MODERN_LANGUAGE | Istilah modern/anakronistik (*Tarikhiyyah al-Lafz*) | KUAT_INDIKASI_MAUDHU | 0.95 |
| R5 | BIDAH_PRACTICE | Amalan khusus tanpa asal (*Ma Laa Asla Lahu fil Ibadah*) | LEMAH_TIDAK_SHOHIH | 0.60 |
| R6 | POPULAR_QUOTES | Slogan populer/nasihat tabib (*Masyhur 'ala Alsinatun-Naas*) | LA_ASLA_LAHU | 0.85 |
| R7 | REGEX_RED_FLAGS | 11 Pola ekstrem spesifik via regex (*Shorih al-Kadzib*) | KUAT_INDIKASI_MAUDHU | 0.95 |
| R8 | NO_RULES_FIRED | Tidak ada aturan otomatis terpicu | REQUIRES_FACT_GATHERING | 0.0 |
| R9 | RIKAKAH_AL_LAFZ | M5="YA" (Bahasa rancu / pesan berantai) | HOAKS_BUKAN_HADIS | 0.90 |
| R10 | AL_MUJAZAFAH | M1="YA" (Pahala/ancaman fantastis berlebihan) | KUAT_INDIKASI_MAUDHU | 0.80 |
| R11 | GHAIB_EMPIRIS | M2="YA" atau M4="YA" (Hal ghaib / fakta empiris) | KUAT_INDIKASI_MAUDHU | 0.90 |
| R12 | FANATIC_POLITICAL | M3="YA" (Pujian/celaan rasis terhadap kelompok) | INDIKASI_MAUDHU_POLITIS | 0.85 |
| R13 | UNKNOWN_MANUAL | Semua M="TIDAK" | STATUS_TIDAK_DIKENALI | 0.0 |

## 📁 Struktur Proyek

| File | Peran | Keterangan |
|------|-------|------------|
| `public/index.html` | **User Interface** | Halaman utama — struktur HTML murni, tanpa logika bisnis |
| `public/knowledge_base.js` | **Knowledge Base + Inference Engine** | Basis pengetahuan (pola hybrid), fungsi `gatherFacts()`, dan `evaluateExpertLayer()` (R1–R8) |
| `public/fact_evaluator.js` | **Evaluasi Fakta Interaktif** | Config `FACT_QUESTIONS` (daftar pertanyaan M1-M5) dan `evaluateFactGathering()` (R9–R13). **Edit file ini untuk menambah/mengubah pertanyaan.** |
| `public/app.js` | **UI Controller** | Render form dinamis dari `FACT_QUESTIONS`, event listener, dan rendering hasil analisis |
| `explain.md` | **Dokumentasi Teknis** | Penjelasan lengkap arsitektur, metode, dan alur kerja |
| `README.md` | **Dokumentasi** | Ringkasan fitur, tabel aturan, dan cara penggunaan |

## 🛠️ Cara Menambah Pertanyaan Baru (M6, M7, dst.)

Cukup edit **satu file**: `public/fact_evaluator.js`

**1. Tambah ke `FACT_QUESTIONS`:**
```js
{ id: 'm6', label: 'Label Baru', text: 'M6. Teks pertanyaan baru...' }
```

**2. Tambah ke `FACT_RULES`:**
```js
{ ids: ['m6'], expertStatus: 'KUAT_INDIKASI_MAUDHU', expertLabel: '...', reason: '...', ruleFired: 'R14_RULE_BARU' }
```

Form HTML dan pengumpulan jawaban otomatis menyesuaikan — tidak perlu sentuh `index.html` atau `app.js`.

## 💻 Cara Menjalankan

Cukup buka file `public/index.html` langsung di browser:

```bash
# Opsi 1: Buka langsung
xdg-open public/index.html       # Linux
open public/index.html            # macOS
start public/index.html           # Windows

# Opsi 2: Klik dua kali file public/index.html di file manager
```

> Tidak perlu `npm install`, `node server.js`, atau tools lainnya. Seluruh logika berjalan di browser.

## 📊 Interpretasi Hasil

| Status | Artinya |
|--------|---------|
| KUAT_INDIKASI_MAUDHU | Red-flag kuat terpicu (pahala berlebihan, kontradiksi Quran, bahasa modern, ancaman hoaks) |
| HOAKS_BUKAN_HADIS | Teks teridentifikasi sebagai hoaks / bukan hadits |
| INDIKASI_MAUDHU_POLITIS | Matan terindikasi fabrikasi politik / fanatisme golongan |
| LEMAH_CENDERUNG_TIDAK_SHOHIH | Mengandung sinyal kelemahan (amalan bid'ah, kontroversial) |
| LA_ASLA_LAHU | Teks mirip pepatah/mitos populer, bukan hadits |
| REQUIRES_FACT_GATHERING | Tidak ada red-flag otomatis, butuh evaluasi lanjutan (penelusuran fakta M1–M5) |
| STATUS_TIDAK_DIKENALI | Teks tidak memiliki red-flag yang dikenali. Butuh pakar manusia |

## ⚠️ Disclaimer

Sistem ini **bukan pengganti tahqiq ulama**. Ini adalah alat bantu heuristik berbasis Sistem Pakar (Rule-Based Expert System) yang memberikan **indikasi awal** dan tetap perlu diverifikasi oleh ahli hadits.
