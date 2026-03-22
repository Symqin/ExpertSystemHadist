# Hadith Matan Checker — Sistem Pakar Deteksi Hadits Palsu

Aplikasi web **Sistem Pakar** untuk mendeteksi indikasi hadits palsu (maudhu') berdasarkan analisis **matan** (isi teks hadits). Menggunakan metode inferensi **Forward Chaining** murni dengan basis pengetahuan berupa pola-pola red-flag yang sudah dikategorikan.

> **100% Client-Side** — Seluruh logika berjalan langsung di browser. Cukup buka `public/index.html`, tidak perlu server atau database.

## 🚀 Fitur Utama

- **Forward Chaining Expert System** — Aturan inferensi (R1–R8) yang mengevaluasi matan secara berurutan dari fakta menuju kesimpulan.
- **Fact Gathering Otomatis** — Scan teks menggunakan array regex/keyword untuk mengidentifikasi qarinah (indikator red-flag).
- **Kuesioner Interaktif Pakar** — Pertanyaan observasi manual (M1–M5) yang aktif jika tidak ada red-flag otomatis terdeteksi, memicu aturan R9–R13.
- **7 Kategori Deteksi Red-Flag** — Mengadopsi pedoman pakar (*Mustalah al-Hadith*) seperti Mubalaghah Fasidah (janji pahala fantastis), Tahwil al-Kadzib (ancaman hoaks), Mukhalafah lil-Qur'an, Tarikhiyyah al-Lafz (anakronisme), dan Shorih al-Kadzib (11 pola regex dinamis).

## 🔬 Arsitektur Sistem Pakar (Forward Chaining)

```
Input Teks User
  → TAHAP 1: Pengumpulan Fakta (Fact Gathering)
      Scan teks dengan 7 array regex/keyword → menghasilkan Fakta boolean (Qarinah)
  → TAHAP 2: Evaluasi Aturan (Forward Chaining, R1–R8)
      R1: IF hasExaggeratedReward  THEN KUAT_INDIKASI_MAUDHU (Mubalaghah Fasidah)
      R2: IF hasFabricatedThreat   THEN KUAT_INDIKASI_MAUDHU (Tahwil al-Kadzib)
      R3: IF hasQuranContradiction THEN KUAT_INDIKASI_MAUDHU (Mukhalafah lil-Qur'an)
      R4: IF hasModernLanguage     THEN KUAT_INDIKASI_MAUDHU (Tarikhiyyah al-Lafz)
      R5: IF hasBidahPractice      THEN LEMAH_CENDERUNG_TIDAK_SHOHIH (Ma Laa Asla Lahu fil Ibadah)
      R6: IF hasPopularQuotes      THEN LA_ASLA_LAHU (Masyhur 'ala Alsinatun-Naas)
      R7: IF hasRegexRedFlag       THEN KUAT_INDIKASI_MAUDHU (Shorih al-Kadzib - 11 Pola Regex)
      R8: IF (tidak ada rule terpicu) THEN REQUIRES_MANUAL_QUESTIONNAIRE
  → TAHAP 3: Fallback Manual (Kuesioner M1–M5)
      R9:  IF M5="YA" (Rikakah al-Lafz)     → HOAKS_BUKAN_HADIS
      R10: IF M1="YA" (Al-Mujazafah)         → KUAT_INDIKASI_MAUDHU
      R11: IF M2="YA" OR M4="YA" (Ghaib)     → KUAT_INDIKASI_MAUDHU
      R12: IF M3="YA" (Politis)              → INDIKASI_MAUDHU_POLITIS
      R13: IF Semua="TIDAK"                  → STATUS_TIDAK_DIKENALI
  → Kesimpulan Akhir: status + label + alasan + rules fired
```

### Tabel Aturan Forward Chaining

| Kode | Nama Aturan | Kondisi (IF) | Kesimpulan (THEN) |
|------|-------------|--------------|-------------------|
| R1 | EXAGGERATED_REWARD | Janji pahala fantastis (*Mubalaghah Fasidah*) | KUAT_INDIKASI_MAUDHU |
| R2 | FABRICATED_THREAT | Ancaman hoaks berantai (*Tahwil al-Kadzib*) | KUAT_INDIKASI_MAUDHU |
| R3 | QURAN_CONTRADICTION | Bertentangan dengan Al-Quran (*Mukhalafah lil-Qur'an*) | KUAT_INDIKASI_MAUDHU |
| R4 | MODERN_LANGUAGE | Istilah modern/anakronistik (*Tarikhiyyah al-Lafz*) | KUAT_INDIKASI_MAUDHU |
| R5 | BIDAH_PRACTICE | Amalan khusus tanpa asal (*Ma Laa Asla Lahu fil Ibadah*) | LEMAH_CENDERUNG_TIDAK_SHOHIH |
| R6 | POPULAR_QUOTES | Slogan populer/nasihat tabib (*Masyhur 'ala Alsinatun-Naas*) | LA_ASLA_LAHU |
| R7 | REGEX_RED_FLAGS | 11 Pola ekstrem spesifik via regex (*Shorih al-Kadzib*) | KUAT_INDIKASI_MAUDHU |
| R8 | NO_RULES_FIRED | Tidak ada aturan otomatis terpicu | REQUIRES_MANUAL_QUESTIONNAIRE |
| R9 | RIKAKAH_AL_LAFZ | M5="YA" (Bahasa sangat rancu / pesan berantai) | HOAKS_BUKAN_HADIS |
| R10 | AL_MUJAZAFAH | M1="YA" (Pahala/ancaman fantastis berlebihan) | KUAT_INDIKASI_MAUDHU |
| R11 | GHAIB_EMPIRIS | M2="YA" atau M4="YA" (Hal ghaib / fakta empiris) | KUAT_INDIKASI_MAUDHU |
| R12 | FANATIC_POLITICAL | M3="YA" (Pujian/celaan rasis terhadap kelompok) | INDIKASI_MAUDHU_POLITIS |
| R13 | UNKNOWN_MANUAL | Semua M="TIDAK" | STATUS_TIDAK_DIKENALI |

## 📁 Struktur Proyek

| File | Peran | Keterangan |
|------|-------|------------|
| `public/index.html` | User Interface | Halaman utama — buka langsung di browser |
| `public/app.js` | Knowledge Base + Inference Engine + UI | Basis pengetahuan (pola red-flag), mesin inferensi (forward chaining R1–R13), dan logika rendering UI |
| `explain.md` | Dokumentasi | Penjelasan lengkap sistem, metode, dan alur kerja |
| `README.md` | Dokumentasi | Ringkasan fitur, arsitektur, dan cara penggunaan |

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
| REQUIRES_MANUAL_QUESTIONNAIRE | Tidak ada red-flag otomatis, butuh evaluasi manual (kuesioner M1–M5) |
| STATUS_TIDAK_DIKENALI | Teks tidak memiliki red-flag yang dikenali. Butuh pakar manusia |

## ⚠️ Disclaimer

Sistem ini **bukan pengganti tahqiq ulama**. Ini adalah alat bantu heuristik berbasis Sistem Pakar (Rule-Based Expert System) yang memberikan **indikasi awal** dan tetap perlu diverifikasi oleh ahli hadits.
