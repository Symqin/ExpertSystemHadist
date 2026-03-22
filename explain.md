# Penjelasan Sistem HadistSystemChecker

Dokumen ini menjelaskan arsitektur, isi file, kegunaan, serta alur kerja algoritma **Sistem Pakar Berbasis Aturan (Rule-Based Expert System)** dengan metode inferensi **Forward Chaining** yang digunakan untuk mendeteksi indikasi hadits palsu (maudhu') berdasarkan analisis matan.

---

## 1) Struktur dan Kegunaan File

| File | Peran dalam Sistem Pakar | Keterangan |
|------|--------------------------|------------|
| `public/index.html` | **User Interface** | Halaman web utama — buka langsung di browser, tanpa server. |
| `public/app.js` | **Knowledge Base + Inference Engine + UI** | Berisi: (1) Basis Pengetahuan (array pola red-flag), (2) Mesin Inferensi Forward Chaining (R1–R13), (3) Logika rendering antarmuka pengguna. |
| `explain.md` | **Dokumentasi** | Penjelasan lengkap arsitektur, metode, dan alur kerja (dokumen ini). |
| `README.md` | **Dokumentasi** | Ringkasan fitur, tabel aturan, dan cara penggunaan. |

> **Catatan:** Seluruh logika sistem pakar berjalan 100% di browser (client-side). Tidak ada server backend, database, atau dependency npm yang diperlukan.

---

## 2) Arsitektur: Sistem Pakar Forward Chaining

### Apa itu Forward Chaining?

Forward chaining adalah metode inferensi yang bekerja **dari fakta menuju kesimpulan** (data-driven):

```
FAKTA AWAL (input)  →  EVALUASI ATURAN (rules diperiksa satu per satu)  →  KESIMPULAN AKHIR
```

Berbeda dengan backward chaining yang memulai dari hipotesis dan mencari bukti, forward chaining **mengevaluasi seluruh aturan secara berurutan** terhadap fakta yang ada, lalu **menyimpulkan** status akhir berdasarkan aturan yang terpicu (fired).

### Komponen Sistem Pakar

Sesuai dengan arsitektur standar Sistem Pakar, HadistSystemChecker memiliki 3 komponen utama:

| Komponen | Implementasi | Keterangan |
|----------|-------------|------------|
| **Knowledge Base** (Basis Pengetahuan) | Array `EXAGGERATED_REWARD_PATTERNS`, `MODERN_LANGUAGE_PATTERNS`, `QURAN_CONTRADICTION_PATTERNS`, dll. di `app.js` | Berisi fakta-fakta dan pola yang menjadi dasar pengetahuan sistem |
| **Inference Engine** (Mesin Inferensi) | Fungsi `evaluateExpertLayer()` dan `evaluateFactGathering()` di `app.js` | Mekanisme Forward Chaining yang mengevaluasi aturan R1–R13 secara berurutan |
| **User Interface** (Antarmuka Pengguna) | `index.html` + fungsi rendering di `app.js` | Input teks, tampilan hasil analisis, dan penelusuran fakta interaktif |

---

## 3) Alur Kerja Utama (3 Tahap)

### Tahap 1: Pengumpulan Fakta (Fact Gathering)

Fungsi `gatherFacts()` menerima teks input user, menormalisasi teksnya (lowercase, hapus tanda baca), lalu mencocokkannya dengan 7 kategori pola di Knowledge Base:

| Fakta (Qarinah) | Array Pola | Contoh Pattern |
|-----------------|-----------|----------------|
| `hasExaggeratedReward` | `EXAGGERATED_REWARD_PATTERNS` (15 pola) | "pahala tujuh puluh nabi", "malaikat kelelahan mencatat" |
| `hasModernLanguage` | `MODERN_LANGUAGE_PATTERNS` (30+ pola) | "whatsapp", "pesawat terbang", "demokrasi" |
| `hasQuranContradiction` | `QURAN_CONTRADICTION_PATTERNS` (10 pola) | "dosa ditanggung anak", "kiamat akan terjadi pada tahun" |
| `hasFabricatedThreat` | `FABRICATED_THREAT_PATTERNS` (10 pola) | "sebarkan atau sial", "pasti masuk neraka" |
| `hasBidahPractice` | `BID_AH_PRACTICE_PATTERNS` (11 pola) | "shalat raghaib", "puasa nisfu sya'ban" |
| `hasPopularQuotes` | `POPULAR_QUOTES_AND_MEDICAL_HOAX` (8 pola) | "cinta tanah air sebagian dari iman" |
| `hasRegexRedFlag` | `REGEX_RED_FLAGS` (4 pola regex) | `/tuntutlah? ilmu walau ke negeri cina/i` |

Output: Objek berisi 7 fakta boolean yang merepresentasikan qarinah yang ditemukan pada teks.

### Tahap 2: Evaluasi Aturan (Forward Chaining, R1–R8)

Fungsi `evaluateExpertLayer()` mengevaluasi aturan R1–R8 secara **berurutan** berdasarkan fakta yang dikumpulkan di Tahap 1. Aturan dengan severity lebih tinggi mendominasi aturan yang lebih rendah.

```
┌─────────────────────────────────────────────────┐
│  FAKTA AWAL: hasil gatherFacts()                │
│  (7 fakta boolean dari scan regex/keyword)      │
└──────────────────────┬──────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R1: IF hasExaggeratedReward = TRUE              │
│      THEN status = KUAT_INDIKASI_MAUDHU          │
│      (Mubalaghah Fasidah / Pahala Berlebihan)    │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R2: IF hasFabricatedThreat = TRUE               │
│      THEN status = KUAT_INDIKASI_MAUDHU          │
│      (Tahwil al-Kadzib / Ancaman Dibuat-buat)    │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R3: IF hasQuranContradiction = TRUE             │
│      THEN status = KUAT_INDIKASI_MAUDHU          │
│      (Mukhalafah lil-Qur'an / Kontradiksi Nast)  │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R4: IF hasModernLanguage = TRUE                 │
│      THEN status = KUAT_INDIKASI_MAUDHU          │
│      (Tarikhiyyah al-Lafz / Istilah Modern)       │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R5: IF hasBidahPractice = TRUE                  │
│      THEN status = LEMAH_CENDERUNG_TIDAK_SHOHIH  │
│      (Ma Laa Asla Lahu fil Ibadah)                │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R6: IF hasPopularQuotes = TRUE                  │
│      THEN status = LA_ASLA_LAHU                  │
│      (Masyhur 'ala Alsinatun-Naas / Slogan Populer) │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R7: IF hasRegexRedFlag = TRUE                   │
│      THEN status = KUAT_INDIKASI_MAUDHU          │
│      (Shorih al-Kadzib / 11 Pola Regex Spesifik)  │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R8: IF (tidak ada aturan R1-R7 yang terpicu)    │
│      THEN status = REQUIRES_FACT_GATHERING       │
│      → Lanjut ke Tahap 3 (Penelusuran Fakta M1-M5)│
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  KESIMPULAN OTOMATIS:                            │
│  - expertStatus (kode status akhir)              │
│  - expertLabel (label deskriptif)                │
│  - reasons[] (daftar alasan keputusan)           │
│  - rulesFired[] (daftar aturan yang terpicu)     │
│  - factsGathered (objek fakta boolean)           │
└──────────────────────────────────────────────────┘
```

**Mekanisme Severity:** Setiap status memiliki tingkat keparahan (severity). Jika beberapa aturan terpicu bersamaan, status dengan severity tertinggi yang mendominasi:

| Severity | Status |
|----------|--------|
| 6 | HOAKS_BUKAN_HADIS |
| 5 | KUAT_INDIKASI_MAUDHU |
| 4 | INDIKASI_MAUDHU_POLITIS |
| 3 | LA_ASLA_LAHU |
| 2 | LEMAH_CENDERUNG_TIDAK_SHOHIH |
| 1 | PERLU_TAHQIQ_LANJUT |
| 0 | REQUIRES_FACT_GATHERING |

### Tahap 3: Penelusuran Fakta Interaktif (Fallback Manual, R9–R13)

Jika Tahap 2 tidak menemukan red-flag otomatis (R8 terpicu), frontend menampilkan **Penelusuran Fakta M1–M5** yang harus dijawab oleh pengguna berdasarkan observasi manual terhadap teks:

| Kode | Pertanyaan (Premis) | Jawaban "YA" → Kesimpulan |
|------|---------------------|--------------------------|
| M1 | Apakah teks memuat janji pahala fantastis atau ancaman mengerikan untuk amalan sepele? | R10: KUAT_INDIKASI_MAUDHU (Al-Mujazafah) |
| M2 | Apakah teks menentukan waktu spesifik kiamat/bencana besar? | R11: KUAT_INDIKASI_MAUDHU (Ghaib) |
| M3 | Apakah teks berisi pujian/celaan rasis terhadap suku/kota tertentu? | R12: INDIKASI_MAUDHU_POLITIS |
| M4 | Apakah isi teks bertentangan dengan akal sehat/fakta empiris? | R11: KUAT_INDIKASI_MAUDHU (Empiris) |
| M5 | Apakah susunan kalimat terasa modern/ancaman berantai/rancu? | R9: HOAKS_BUKAN_HADIS (Rikakah al-Lafz) |

Jika semua dijawab "TIDAK" → R13: STATUS_TIDAK_DIKENALI (butuh pakar manusia).

**Urutan evaluasi prioritas:** R9 (M5) → R10 (M1) → R11 (M2/M4) → R12 (M3) → R13 (semua TIDAK).

---

## 4) Detail Kategori Pola Red-Flag

### R1: Janji Pahala Berlebihan (*Mubalaghah Fasidah*)

Pola yang menunjukkan janji pahala yang sangat tidak rasional, yang merupakan ciri khas hadits maudhu' menurut ulama mustalah hadits (seperti Ibnu Qayyim di *Al-Manar al-Munif*).

Contoh: "mendapatkan pahala tujuh puluh nabi", "pahalanya seperti haji seribu kali", "minum kopi masuk surga"

### R2: Ancaman Tidak Proporsional / Hoaks Berantai (*Tahwil al-Kadzib*)

Pola ancaman yang tidak wajar atau khas pesan berantai (chain message/hoaks digital) yang sering beredar demi menakut-nakuti awam.

Contoh: "barangsiapa yang tidak menyebarkan pesan ini", "sebarkan atau sial", "pasti masuk neraka"

### R3: Kontradiksi dengan Prinsip Al-Quran (*Mukhalafah lil-Qur'an*)

Dasar: **Ulama sepakat bahwa hadits shahih mustahil bertentangan dengan Al-Quran.**

Pola berdasarkan ayat Al-Quran yang sudah qath'i:
- **QS. Al-An'am: 164** — "Setiap jiwa menanggung dosanya sendiri" → Mendeteksi klaim transfer dosa (contoh: anak zina tidak masuk surga 7 turunan).
- **QS. Luqman: 34 & Al-An'am: 59** — "Ilmu ghaib hanya milik Allah" → Mendeteksi prediksi presisi waktu kiamat.
- **QS. Al-Hujurat: 13** — Kemuliaan berdasarkan ketakwaan → Mendeteksi jaminan keselamatan mutlak berdasarkan nama/keturunan.

### R4: Bahasa/Istilah Modern (Anakronistik / *Tarikhiyyah al-Lafz*)

Dasar: **Hadits adalah ucapan Nabi ﷺ di abad 7 M.** Tidak mungkin mengandung istilah yang baru dikonstruksi peradaban modern.

Kategori: Teknologi (whatsapp, kripto, wifi), politik modern (demokrasi, sekularisme), geografis (indonesia, amerika), medis (vaksin, paracetamol, operasi plastik), dan mistis modern (zodiak, ramalan bintang).

### R5: Amalan Bid'ah / Kontroversial (*Ma Laa Asla Lahu fil Ibadah*)

Sebagian kaum mengarang hadits untuk melegitimasi mu'amalah atau ritual yang mereka ada-adakan. Status: minimal lemah (dha'if), perlu tahqiq lanjutan.

Contoh: "shalat hajat seribu rakaat", "puasa nisfu sya'ban", "shalat rebo wekasan"

### R6: Pepatah/Mitos Populer yang Diklaim Hadits (*Masyhur 'ala Alsinatun-Naas*)

Pepatah Arab, nasihat tabib, filosof, atau mitos populer yang seiring waktu lisan orang awam membajaknya dan menyandarkannya kepada Nabi ﷺ (merujuk *Kasyf al-Khafa'* karya Al-Ajlouni).

Contoh: "cinta tanah air sebagian dari iman", "kebersihan pangkal kesehatan", "surga di telapak kaki ibu".

### R7: Pola Regex Spesifik (*Shorih al-Kadzib*)

Sistem memiliki **11 aturan pendeteksian pola regex dinamis** untuk teks-teks parah yang secara mutlak sudah di-tahdzir ulama.

1. Hadits menuntut ilmu ke China
2. Kebersihan sebagian dari iman (Bukan hadits, yang shahih: _Ath-Thuhuru syathrul iiman_)
3. Tidur saat puasa adalah ibadah
4. Awal ramadhan rahmat, pertengahan ampunan (Munkar)
5. Klaim spesifik bacaan surat tertentu (ribuan kali baca Yasin/Al-Mulk/Al-Waqi'ah)
6. Ancaman musiman: *"Barangsiapa memberitahu masuk ramadhan/rajab neraka diharamkan"*
7. Nasehat tabib Al-Harits bin Kaladah: *"Makan sebelum lapar, berhenti sebelum kenyang"*
8. Ikhtilafu ummati rahmat (Perbedaan umat adalah rahmat)
9. *Hubbul wathan minal iman* (Cinta negara sebagian dari iman)
10. *"Bekerjalah seakan hidup selamanya"* (Atsar Abdullah bin Amr, bukan hadits marfu')
11. Legenda palsu 15 siksaan meninggalkan shalat.

---

## 5) Status dan Interpretasi Hasil

| Status | Label | Artinya |
|--------|-------|---------|
| KUAT_INDIKASI_MAUDHU | Kuat Indikasi Maudhu' | Red-flag kuat terpicu (pahala berlebihan, kontradiksi Quran, bahasa modern, ancaman hoaks) |
| HOAKS_BUKAN_HADIS | Hoaks / Bukan Hadis | Teks teridentifikasi sebagai hoaks/bukan hadits (bahasa sangat rancu/modern) |
| INDIKASI_MAUDHU_POLITIS | Indikasi Maudhu' (Politis) | Matan terindikasi fabrikasi politik/fanatisme golongan |
| LEMAH_CENDERUNG_TIDAK_SHOHIH | Indikasi Lemah / Kontroversial | Mengandung sinyal kelemahan (amalan bid'ah, kontroversial) |
| LA_ASLA_LAHU | La Asla Lahu | Teks mirip pepatah/mitos populer, bukan hadits |
| REQUIRES_FACT_GATHERING | Butuh Evaluasi Lanjutan | Tidak ada red-flag otomatis, perlu penelusuran fakta M1–M5 |
| STATUS_TIDAK_DIKENALI | Status Tidak Dikenali | Tidak ada indikasi palsu maupun shahih. Butuh pakar manusia |

---

## 6) Fungsi Utama di `app.js`

| Fungsi | Peran | Input → Output |
|--------|-------|----------------|
| `normalizeText(text)` | Normalisasi teks | String → string lowercase tanpa tanda baca |
| `containsAny(text, patterns)` | Pencocokan keyword | String + array pola → boolean |
| `matchRegexFlags(text, regexFlags)` | Pencocokan regex | String + array regex → array issue yang cocok |
| `gatherFacts(inputText)` | **Tahap 1:** Pengumpulan Fakta | String input → objek 7 fakta boolean |
| `evaluateExpertLayer(inputText)` | **Tahap 2:** Forward Chaining R1–R8 | String input → hasil inferensi (status + alasan + rules) |
| `evaluateFactGathering(answers)` | **Tahap 3:** Penelusuran Fakta R9–R13 | Objek {m1..m5} boolean → hasil inferensi manual |

---

## 7) Ringkasan Alur Singkat

```
Input teks user
  → normalizeText() (lowercase, hapus tanda baca)
  → gatherFacts() (scan 7 array pola → 7 fakta boolean)
  → evaluateExpertLayer() (Forward Chaining R1–R8)
      → Jika ada rule terpicu → Kesimpulan Otomatis
      → Jika tidak ada rule terpicu (R8):
          → Tampilkan Penelusuran Fakta M1–M5
          → evaluateFactGathering() (R9–R13)
  → Kesimpulan Akhir: status + label + alasan + rules fired
```
