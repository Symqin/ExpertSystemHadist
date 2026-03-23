# Penjelasan Sistem HadistSystemChecker

Dokumen ini menjelaskan arsitektur, isi file, kegunaan, serta alur kerja algoritma **Sistem Pakar Berbasis Aturan (Rule-Based Expert System)** dengan metode inferensi **Forward Chaining** yang digunakan untuk mendeteksi indikasi hadits palsu (maudhu') berdasarkan analisis matan.

---

## 1) Struktur dan Kegunaan File

| File | Peran dalam Sistem Pakar | Keterangan |
|------|--------------------------|------------|
| `public/index.html` | **User Interface** | Halaman web utama — struktur HTML murni. Form penelusuran fakta di-render dinamis oleh `app.js`. |
| `public/knowledge_base.js` | **Knowledge Base + Inference Engine (Otomatis)** | Array 7 kategori pola red-flag, fungsi `normalizeText()`, `gatherFacts()`, dan `evaluateExpertLayer()` (R1–R8). |
| `public/fact_evaluator.js` | **Evaluasi Fakta Interaktif (Manual)** | Konfigurasi `FACT_QUESTIONS` (daftar pertanyaan M1-M5) dan `FACT_RULES` (aturan R9–R13). **Edit file ini untuk menambah/mengubah pertanyaan.** |
| `public/app.js` | **UI Controller** | Render form pertanyaan dinamis dari `FACT_QUESTIONS`, event listener, dan rendering hasil ke DOM. |
| `explain.md` | **Dokumentasi Teknis** | Penjelasan lengkap arsitektur, metode, dan alur kerja (dokumen ini). |
| `README.md` | **Dokumentasi** | Ringkasan fitur, tabel aturan, dan cara penggunaan. |

> **Catatan:** Seluruh logika sistem pakar berjalan 100% di browser (client-side). Tidak ada server backend, database, atau dependency npm yang diperlukan.

---

## 2) Arsitektur: Sistem Pakar Forward Chaining & Certainty Factor

### Apa itu Forward Chaining?

Forward chaining adalah metode inferensi yang bekerja **dari fakta menuju kesimpulan** (data-driven):

```
FAKTA AWAL (input)  →  EVALUASI ATURAN (rules diperiksa satu per satu)  →  KESIMPULAN AKHIR
```

Berbeda dengan backward chaining yang memulai dari hipotesis dan mencari bukti, forward chaining **mengevaluasi seluruh aturan secara berurutan** terhadap fakta yang ada, lalu **menyimpulkan** status akhir berdasarkan aturan yang terpicu (fired).

### Penanganan Ketidakpastian (Certainty Factor / CF)

Dalam mengkritik matan hadis, tidak semua indikasi bernilai mutlak (100% salah/benar). Oleh karena itu, sistem ini tidak menggunakan logika pengolahan *Boolean* kaku, melainkan menggunakan paramater ketidakpastian (Uncertainty) bernama **Certainty Factor (CF)**. Setiap aturan (R1 dst.) memiliki **bobot CF spesifik** mulai dari `0.0` hingga `1.0`.

Jika beberapa aturan terdeteksi berbarengan (Multiple Evidence), probabilitas kepalsuan hadis dikombinasikan dengan metode Parallel CF menggunakan rumus:
`CF_Combine = CF1 + CF2 * (1 - CF1)`

### Komponen Sistem Pakar (Separation of Concerns)

| Komponen | File | Keterangan |
|----------|------|------------|
| **Knowledge Base** (Basis Pengetahuan) | `knowledge_base.js` | Array pola red-flag (7 kategori): `EXAGGERATED_REWARD_PATTERNS`, `MODERN_LANGUAGE_PATTERNS`, `QURAN_CONTRADICTION_PATTERNS`, dll. |
| **Inference Engine — Otomatis** | `knowledge_base.js` | Fungsi `gatherFacts()` dan `evaluateExpertLayer()` → Forward Chaining R1–R8 + Algoritma Hitung CF Paralel |
| **Inference Engine — Interaktif** | `fact_evaluator.js` | `FACT_QUESTIONS` (config data-driven) + `evaluateFactGathering()` → Aturan R9–R13 dan kalkulasi manual CF |
| **User Interface** | `index.html` + `app.js` | HTML struktur + DOM controller yang render form dinamis dari `FACT_QUESTIONS` |

---

## 3) Alur Kerja Utama (3 Tahap)

### Tahap 1: Pengumpulan Fakta (Fact Gathering) — `knowledge_base.js`

Fungsi `gatherFacts()` menerima teks input user, menormalisasi teksnya (lowercase, hapus tanda baca), lalu mencocokkannya dengan 7 kategori pola di Knowledge Base:

| Fakta (Qarinah) | Array Pola | Contoh Pattern |
|-----------------|-----------|----------------|
| `hasExaggeratedReward` | `EXAGGERATED_REWARD_PATTERNS` (17 pola regex) | `/barang\s*siapa.*bergembira.*ramadhan/` |
| `hasModernLanguage` | `MODERN_LANGUAGE_PATTERNS` (28+ pola string) | "whatsapp", "pesawat terbang", "demokrasi" |
| `hasQuranContradiction` | `QURAN_CONTRADICTION_PATTERNS` (10 pola regex) | `/dosa\s+istri.*ditanggung\s+suami/` |
| `hasFabricatedThreat` | `FABRICATED_THREAT_PATTERNS` (13 pola regex) | `/sebarkan\s+atau\s+(sial\|kena\s+musibah)/` |
| `hasBidahPractice` | `BID_AH_PRACTICE_PATTERNS` (11 pola regex) | `/sh[oa]lat\s+raghaib/`, `/(puasa\|malam)\s+nisfu\s+sya['\s]?a?ban/` |
| `hasPopularQuotes` | `POPULAR_QUOTES_AND_MEDICAL_HOAX` (8 pola regex) | `/cinta\s+(tanah\s+air\|wathan).*sebagian.*iman/` |
| `hasRegexRedFlag` | `REGEX_RED_FLAGS` (11 pola regex) | `/tuntutlah?\s+ilmu\s+walau\s+ke\s+negeri\s+cina/i` |

> **Metode Hybrid (Regex & String):** Knowledge base mendukung campuran antara objek `RegExp` (untuk kalimat dengan variasi spasi/kata) dan `String` literal (untuk kata kunci sederhana). Keduanya diproses secara otomatis oleh fungsi `containsAny`.

> **Catatan Historis:** Kata "Cina" dan "Jepang" **tidak termasuk** `MODERN_LANGUAGE_PATTERNS` karena kedua wilayah ini sudah dikenal pada abad ke-7 M — bukan anakronisme. Hadits "Tuntut ilmu ke Negeri Cina" ditangani secara terpisah di `REGEX_RED_FLAGS` dengan keterangan yang lebih nuansatif (sisi sanad yang bermasalah, bukan istilahnya).

Output: Objek berisi 7 fakta boolean yang merepresentasikan qarinah yang ditemukan pada teks.

### Tahap 2: Evaluasi Aturan (Forward Chaining & Estimasi CF, R1–R8) — `knowledge_base.js`

Fungsi `evaluateExpertLayer()` mengevaluasi aturan R1–R8 secara **berurutan** berdasarkan fakta yang dikumpulkan di Tahap 1. Sistem akan mengambil status dengan tingkat keparahan (severity) tertinggi, dan mengomputasikan bobot Certainty Factor (persentase) secara paralel jika lebih dari satu aturan terpicu.

```
┌─────────────────────────────────────────────────┐
│  FAKTA AWAL: hasil gatherFacts()                │
│  (7 fakta boolean dari scan regex/keyword)      │
└──────────────────────┬──────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R1: IF hasExaggeratedReward = TRUE              │
│      THEN status = KUAT_INDIKASI_MAUDHU          │
│      CF_weight = 0.80 (Yakin)                    │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R2: IF hasFabricatedThreat = TRUE               │
│      THEN status = KUAT_INDIKASI_MAUDHU          │
│      CF_weight = 0.90 (Sangat Yakin)             │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R3: IF hasQuranContradiction = TRUE             │
│      THEN status = KUAT_INDIKASI_MAUDHU          │
│      CF_weight = 1.0 (Mutlak)                    │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R4: IF hasModernLanguage = TRUE                 │
│      THEN status = KUAT_INDIKASI_MAUDHU          │
│      CF_weight = 0.95 (Sangat Yakin)             │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R5: IF hasBidahPractice = TRUE                  │
│      THEN status = LEMAH_CENDERUNG_TIDAK_SHOHIH  │
│      CF_weight = 0.60 (Cukup Yakin)              │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R6: IF hasPopularQuotes = TRUE                  │
│      THEN status = LA_ASLA_LAHU                  │
│      CF_weight = 0.85 (Yakin)                    │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R7: IF hasRegexRedFlag = TRUE                   │
│      THEN status = KUAT_INDIKASI_MAUDHU          │
│      CF_weight = 0.95 (Sangat Yakin)             │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R8: IF (tidak ada aturan R1-R7 yang terpicu)    │
│      THEN status = REQUIRES_FACT_GATHERING       │
│      CF_weight = 0.0                             │
│      → Lanjut ke Tahap 3 (Penelusuran Manual)    │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  KESIMPULAN OTOMATIS:                            │
│  - expertStatus (kode status akhir)              │
│  - expertLabel (label deskriptif)                │
│  - reasons[] (daftar alasan keputusan)           │
│  - rulesFired[] (daftar aturan yang terpicu)     │
│  - certaintyFactor (Keyakinan komulatif <1.0)    │
└──────────────────────────────────────────────────┘
```

**Mekanisme Severity:** Jika beberapa aturan terpicu bersamaan, status dengan severity tertinggi mendominasi:

| Severity | Status |
|----------|--------|
| 6 | HOAKS_BUKAN_HADIS |
| 5 | KUAT_INDIKASI_MAUDHU |
| 4 | INDIKASI_MAUDHU_POLITIS |
| 3 | LA_ASLA_LAHU |
| 2 | LEMAH_CENDERUNG_TIDAK_SHOHIH |
| 1 | PERLU_TAHQIQ_LANJUT |
| 0 | REQUIRES_FACT_GATHERING |

### Tahap 3: Penelusuran Fakta Interaktif (Fallback Manual, R9–R13) — `fact_evaluator.js`

Jika Tahap 2 tidak menemukan red-flag otomatis (R8 terpicu), frontend menampilkan **Penelusuran Fakta** yang di-generate dinamis dari array `FACT_QUESTIONS`. Pengguna menjawab berdasarkan observasi manual terhadap teks.

**Pendekatan Data-Driven:** Pertanyaan didefinisikan sebagai array objek di `FACT_QUESTIONS`. Form HTML di-render otomatis oleh `app.js` — tidak ada teks pertanyaan yang hardcode di `index.html`.

| Kode | Pertanyaan (Premis) | Bobot (CF) | Jawaban "YA" → Kesimpulan |
|------|---------------------|------------|-----------------------------|
| M1 | Apakah teks memuat janji pahala fantastis atau ancaman mengerikan untuk amalan sepele? | 0.80 | R10: KUAT_INDIKASI_MAUDHU (Al-Mujazafah) |
| M2 | Apakah teks menentukan waktu spesifik kiamat/bencana besar? | 0.90 | R11: KUAT_INDIKASI_MAUDHU (Ghaib/Empiris) |
| M3 | Apakah teks berisi pujian/celaan rasis terhadap suku/kota tertentu? | 0.85 | R12: INDIKASI_MAUDHU_POLITIS |
| M4 | Apakah isi teks bertentangan dengan akal sehat/fakta empiris? | 0.90 | R11: KUAT_INDIKASI_MAUDHU (Ghaib/Empiris) |
| M5 | Apakah susunan kalimat terasa modern/ancaman berantai/rancu? | 0.90 | R9: HOAKS_BUKAN_HADIS |

Jika semua dijawab "TIDAK" → R13: STATUS_TIDAK_DIKENALI (butuh pakar manusia / CF: 0.0).

**Urutan evaluasi prioritas:** R9 (M5) → R10 (M1) → R11 (M2/M4) → R12 (M3) → R13 (semua TIDAK).

#### Cara Menambah Pertanyaan Baru

Edit `fact_evaluator.js` — cukup dua langkah:

```js
// 1. Tambah ke FACT_QUESTIONS
{ id: 'm6', label: 'Label', text: 'M6. Teks pertanyaan baru...' }

// 2. Tambah ke FACT_RULES
{ ids: ['m6'], expertStatus: 'KUAT_INDIKASI_MAUDHU', expertLabel: '...', reason: '...', ruleFired: 'R14_...' }
```

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
- **QS. Al-An'am: 164** — "Setiap jiwa menanggung dosanya sendiri" → Mendeteksi klaim transfer dosa.
- **QS. Luqman: 34 & Al-An'am: 59** — "Ilmu ghaib hanya milik Allah" → Mendeteksi prediksi presisi waktu kiamat.
- **QS. Al-Hujurat: 13** — Kemuliaan berdasarkan ketakwaan → Mendeteksi jaminan keselamatan mutlak berdasarkan nama/keturunan.

### R4: Bahasa/Istilah Modern (Anakronistik / *Tarikhiyyah al-Lafz*)

Dasar: **Hadits adalah ucapan Nabi ﷺ di abad 7 M.** Tidak mungkin mengandung istilah yang baru dikonstruksi peradaban modern.

Kategori: Teknologi (whatsapp, kripto, wifi), politik modern (demokrasi, sekularisme), geografis modern (indonesia, amerika), medis (vaksin, paracetamol, operasi plastik), dan mistis modern (zodiak, ramalan bintang).

> **Catatan:** Nama wilayah yang sudah dikenal pada abad ke-7 M seperti **Cina** dan **Jepang** *tidak* dimasukkan ke kategori ini untuk menghindari false positive.

### R5: Amalan Bid'ah / Kontroversial (*Ma Laa Asla Lahu fil Ibadah*)

Sebagian kaum mengarang hadits untuk melegitimasi mu'amalah atau ritual yang mereka ada-adakan. Status: minimal lemah (dha'if), perlu tahqiq lanjutan.

Contoh: "shalat hajat seribu rakaat", "puasa nisfu sya'ban", "shalat rebo wekasan"

### R6: Pepatah/Mitos Populer yang Diklaim Hadits (*Masyhur 'ala Alsinatun-Naas*)

Pepatah Arab, nasihat tabib, filosof, atau mitos populer yang seiring waktu lisan orang awam membajaknya dan menyandarkannya kepada Nabi ﷺ (merujuk *Kasyf al-Khafa'* karya Al-Ajlouni).

Contoh: "cinta tanah air sebagian dari iman", "kebersihan pangkal kesehatan", "surga di telapak kaki ibu".

### R7: Pola Regex Spesifik (*Shorih al-Kadzib*)

Sistem memiliki **11 aturan pendeteksian pola regex dinamis** untuk teks-teks parah yang secara mutlak sudah di-tahdzir ulama.

1. **Tuntut ilmu ke Negeri Cina** — Dha'if Jiddan / Diperdebatkan. Cina bukan anakronisme (dikenal abad ke-7 M), tetapi mayoritas ulama (Ibn Hibban, Al-'Uqaili, Al-Albani) menyatakan sanadnya sangat lemah. Lebih tepat sebagai hikam (kata mutiara), bukan hadits marfu'.
2. **Kebersihan sebagian dari iman** — Bukan hadits. Yang shahih: *"Ath-Thuhuru syathrul iiman"* (Bersuci itu setengah keimanan).
3. **Tidur saat puasa adalah ibadah** — Dha'if Jiddan.
4. **Awal ramadhan rahmat, pertengahan ampunan** — Munkar (Syaikh Al-Albani).
5. **Klaim spesifik bacaan surat tertentu** (ribuan kali baca Yasin/Al-Mulk/Al-Waqi'ah).
6. **Ancaman musiman:** *"Barangsiapa memberitahu masuk ramadhan/rajab neraka diharamkan"*.
7. **Nasihat tabib Al-Harits bin Kaladah:** *"Makan sebelum lapar, berhenti sebelum kenyang"*.
8. **Ikhtilafu ummati rahmat** — La Asla Lahu (tidak ada sanadnya).
9. ***Hubbul wathan minal iman*** — Maudhu' (cinta negara sebagian dari iman).
10. ***"Bekerjalah seakan hidup selamanya"*** — Atsar sahabat (Abdullah bin Amr), bukan hadits marfu'.
11. **Legenda palsu 15 siksaan** meninggalkan shalat.

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

## 6) Fungsi Utama per File

### `knowledge_base.js`

| Fungsi | Peran | Input → Output |
|--------|-------|----------------|
| `normalizeText(text)` | Normalisasi teks | String → string lowercase tanpa tanda baca |
| `containsAny(text, patterns)` | Pencocokan Hybrid | Mendukung `RegExp` dan `String`. Jika string, otomatis menggunakan *word boundary* dan *case-insensitive*. |
| `matchRegexFlags(text, regexFlags)` | Pencocokan regex | String + array regex → array issue yang cocok |
| `gatherFacts(inputText)` | **Tahap 1:** Pengumpulan Fakta | String input → objek 7 fakta boolean |
| `evaluateExpertLayer(inputText)` | **Tahap 2:** Forward Chaining R1–R8 | String input → hasil inferensi (status + alasan + rules) |

### `fact_evaluator.js`

| Konstanta/Fungsi | Peran |
|-----------------|-------|
| `FACT_QUESTIONS` | Array config pertanyaan M1-M5 (data-driven). **Edit ini untuk maintenance.** |
| `FACT_RULES` | Array aturan evaluasi R9–R13 berbasis jawaban pengguna beserta parameter probabilitas `.cfWeight` |
| `evaluateFactGathering(answers)` | **Tahap 3:** Mengevaluasi jawaban `{ m1..m5 }` → hasil inferensi manual beserta perhitungan CF kumulatif |

### `app.js`

| Fungsi | Peran |
|--------|-------|
| `renderFactGatheringForm()` | Render form HTML dari `FACT_QUESTIONS` secara dinamis |
| `renderExpertSummary()` | Render panel hasil analisis ke DOM |
| Event Listeners | Menghubungkan form submit → mesin inferensi → render hasil |

---

## 7) Ringkasan Alur Singkat

```
Input teks user
  → normalizeText() (lowercase, hapus tanda baca)
  → gatherFacts() (scan 7 array pola → 7 fakta boolean)
  → evaluateExpertLayer() (Forward Chaining R1–R8)
      → Jika ada rule terpicu → Kesimpulan Otomatis → Render ke UI
      → Jika tidak ada rule terpicu (R8):
          → app.js render form dari FACT_QUESTIONS
          → evaluateFactGathering() (R9–R13)
          → Kesimpulan Manual → Render ke UI
  → Kesimpulan Akhir: status + label + alasan + rules fired
```
