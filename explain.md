# Penjelasan Sistem HadistSystemChecker

Dokumen ini menjelaskan isi file utama, kegunaan, serta alur kerja algoritma dari awal sampai akhir, termasuk penjelasan **eksplisit** tentang metode inferensi **forward chaining** yang digunakan pada lapisan sistem pakar.

---

## 1) Struktur dan Kegunaan File

| File | Peran dalam Sistem Pakar | Keterangan |
|------|--------------------------|------------|
| server.js | **User Interface (backend)** | Server Express, middleware JSON, CORS, static file. |
| routes/search.js | **Inference Engine (orkestrator)** | Pipeline utama: memanggil NLP hybrid → lalu memanggil lapisan pakar forward chaining. |
| nlp.js | **Inference Engine (lapisan NLP)** | Fungsi: extractMatan, preprocessText, correctTypos, buildIdf, vectorize, cosineSimilarity, getStatus. |
| similarity.js | **Inference Engine (utilitas)** | Jaro Similarity, Jaro-Winkler Similarity, normalizeQuery. |
| knowledge_base.js | **Knowledge Base + Rule Engine** | Basis pengetahuan berupa pola red-flag + aturan inferensi forward chaining (R0 dst., dapat dikembangkan). |
| database.js | **Knowledge Base (data)** | Koneksi dan inisialisasi database SQLite berisi hadits shahih rujukan. |
| fetcher.js | **Knowledge Acquisition** | Mengunduh hadits dari API publik, normalisasi, dan simpan ke SQLite. |
| public/ | **User Interface (frontend)** | UI web: input teks hadits, tampilan skor NLP, hasil sistem pakar, dan alasan keputusan. |

---

## 2) Alur Kerja Utama (Urutan Algoritma)

Alur di endpoint `/search` memakai **dua lapisan inferensi**: NLP hybrid + lapisan sistem pakar forward chaining.

### Lapisan 1: NLP Hybrid (TF-IDF + Cosine Similarity + Jaro-Winkler)

1. Ambil seluruh hadits dari database SQLite.
2. Ekstrak **matan** dari setiap hadits (menghapus sanad) memakai `extractMatan`.
3. Preprocess setiap matan:
  - Case folding (lowercase)
  - Hapus angka dan tanda baca
  - Hapus stopwords (Bahasa Indonesia + transliterasi Arab)
  - Tokenisasi (hanya unigram/kata tunggal, tanpa n-gram)
4. Bangun vocabulary dari seluruh token corpus.
5. Proses query user:
  - `extractMatan` agar fokus pada isi matan saja
  - `preprocessText` menghasilkan token bersih
  - `correctTypos` memperbaiki typo per kata memakai Jaro-Winkler (threshold ≥ 0.88)
6. Hitung IDF dari seluruh corpus (`buildIdf`).
7. Buat vektor TF-IDF untuk query dan setiap dokumen (`vectorize`).
8. Hitung **Cosine Similarity** antara vektor query dan vektor dokumen (Pencocokan Global).
9. Hitung **Overlap (Coverage) Similarity** untuk mengecek seberapa persen token query tertutupi oleh dokumen dokumen tanpa menghukum panjang dokumen (Pencocokan Substring parsial).
10. **Skor akhir** = kombinasi tertimbang: `(Cosine × 0.40) + (Overlap × 0.60)`.
11. **Substring Boost**: Jika matan query merupakan substring matan dokumen (atau sebaliknya), skor diboost minimal 0.95.
12. Urutkan hasil descending, ambil top 5.
13. Tentukan tier NLP: `found` (>0.80), `review` (≥0.50), atau `notfound` (<0.50).

### Lapisan 2: Sistem Pakar Forward Chaining (knowledge_base.js)

Setelah lapisan NLP menghasilkan tier dan skor, hasilnya dimasukkan ke **mesin inferensi forward chaining** di fungsi `evaluateExpertLayer()`.

#### Apa itu Forward Chaining?

Forward chaining adalah metode inferensi yang bekerja **dari fakta menuju kesimpulan** (data-driven):

```
FAKTA AWAL (input)  →  EVALUASI ATURAN (rules diperiksa satu per satu)  →  KESIMPULAN AKHIR
```

Berbeda dengan backward chaining yang memulai dari hipotesis dan mencari bukti, forward chaining **mengevaluasi seluruh aturan secara berurutan** terhadap fakta yang ada, lalu **menyimpulkan** status akhir berdasarkan aturan yang terpicu (fired).

#### Fakta Awal (Working Memory)

Fakta awal yang menjadi input forward chaining dikemas dalam objek `ctx`:

| Fakta (ctx) | Sumber | Keterangan |
|-------------|--------|------------|
| `queryText` | Input user | Teks asli yang dimasukkan pengguna |
| `queryMatan` | `extractMatan()` | Matan yang sudah diekstrak dari teks (tanpa sanad) |
| `bestMatch` | NLP layer | Objek hadits dengan skor tertinggi dari database |
| `topMatches` | NLP layer | Array 5 hadits teratas beserta skor |
| `overallTier` | `getStatus()` | Tier NLP: `'found'` / `'review'` / `'notfound'` |

#### Alur Forward Chaining (Langkah demi Langkah)

```
┌─────────────────────────────────────────────────┐
│  FAKTA AWAL: ctx (queryText, queryMatan, skor,  │
│              bestMatch, overallTier)             │
└──────────────────────┬──────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R0: BASE RULE — Tentukan status awal dari tier  │
│      NLP (found → MAQBUL, review → TAHQIQ,       │
│      notfound → SYUBHAT)                         │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R1: EXAGGERATED_REWARD — Cek pola janji pahala  │
│      berlebihan. Jika cocok → KUAT_INDIKASI_MAUDHU│
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R2: BID'AH_PRACTICE — Cek pola amalan bid'ah   │
│      /amalan khusus kontroversial. Jika cocok    │
│      → LEMAH_CENDERUNG_TIDAK_SHOHIH (perlu       │
│      tahqiq ulama)                               │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R3: OVER_THREAT — Cek pola ancaman tidak        │
│      proporsional (6 pola) + tier == notfound.   │
│      Jika cocok → LEMAH/TIDAK_SHAHIH             │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R4: ADJUST_CONFIDENCE — Jika tier == found tapi │
│      skor < 0.85, turunkan confidence band       │
│      dari 'strong' ke 'medium'                   │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R5: QURAN_CONTRADICTION — Cek pola matan yang   │
│      bertentangan dengan prinsip Al-Quran yang   │
│      qath'i (16 pola). Jika cocok → MAUDHU       │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R6: POPULAR_QUOTES — Cek pepatah/hoaks medis    │
│      populer yang sering diklaim hadits. Jika    │
│      teks tidak ditemukan di database →          │
│      LA_ASLA_LAHU, jika hanya kemiripan sedang   │
│      → PERLU_TAHQIQ_LANJUT.                      │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R7: MODERN_LANGUAGE — Cek pola bahasa/istilah   │
│      modern di matan (bukan komentar). Jika      │
│      cocok → KUAT_INDIKASI_MAUDHU               │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R8: REGEX_RED_FLAGS — Cek pola redaksi khusus   │
│      via regex. Jika tidak ada padanan di        │
│      database → KUAT_INDIKASI_MAUDHU, jika ada   │
│      kemiripan → LEMAH_CENDERUNG_TIDAK_SHOHIH.   │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  KESIMPULAN AWAL OTOMATIS                        │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  KUESIONER PAKAR MANUAL (Diaktifkan pada Frontend│
│  jika skor < 0.60 dan TIDAK ada Red-Flag dari R1-R8)│
│  M1: Janji/Ancaman berlebihan (Al-Mujazafah)     │
│  M2: Penentuan spesifik Kiamat/Ghaib             │
│  M3: Politis / Celaan suku spesifik              │
│  M4: Bertentangan Akal Sehat / Fakta Empiris     │
│  M5: Bahasa Pasaran / Ancaman Berantai (Rikakah) │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R8(m): IF M5="YA" → HOAKS_BUKAN_HADIS           │
│  R9   : IF M1="YA" → KUAT_INDIKASI_MAUDHU        │
│  R10  : IF M2="YA" OR M4="YA" → MAUDHU           │
│  R11  : IF M3="YA" → INDIKASI_MAUDHU_POLITIS     │
│  R12  : IF All="TIDAK" → STATUS_TIDAK_DIKENALI   │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  KESIMPULAN AKHIR (Pusat Analisis):              │
│  - expertStatus (kode status)                    │
│  - expertLabel (label deskriptif)                │
│  - reasons[] (daftar alasan keputusan)           │
└──────────────────────────────────────────────────┘
```

#### Tabel Lengkap Aturan Sistem Pakar (ringkas)

| Kode | Nama Aturan | Kondisi IF (Premis) | Aksi THEN (Kesimpulan) | Catatan |
|------|-------------|---------------------|------------------------|---------|
| R0 | BASE_RULE | Tier NLP = found / review / notfound | Status awal: MAQBUL / TAHQIQ / SYUBHAT | Basis dari skor NLP |
| R1 | EXAGGERATED_REWARD | Matan mengandung pola janji pahala berlebihan | KUAT_INDIKASI_MAUDHU (confidence: strong) | Ciri khas maudhu |
| R2 | BID'AH_PRACTICE | Matan menyebut amalan bid'ah | LEMAH_CENDERUNG_TIDAK_SHOHIH (confidence: medium) | Tidak langsung memvonis maudhu |
| R3 | OVER_THREAT | Matan mengandung ancaman tidak proporsional DAN tier = notfound | LEMAH_CENDERUNG_TIDAK_SHOHIH (confidence: medium) | Ancaman berlebihan |
| R4 | ADJUST_CONFIDENCE | Tier = found TAPI skor < 0.85 | Turunkan confidence band | Menjaga kehati-hatian |
| R5 | QURAN_CONTRADICTION | Matan bertentangan dengan prinsip Al-Quran yang qath'i | KUAT_INDIKASI_MAUDHU (confidence: strong) | Hadits shahih tidak bertentangan dengan Qur'an |
| R6 | POPULAR_QUOTES | Teks mirip pepatah/hoaks medis populer | LA_ASLA_LAHU / PERLU_TAHQIQ_LANJUT |  |
| R7 | MODERN_LANGUAGE | Matan mengandung istilah modern (anakronistik) | KUAT_INDIKASI_MAUDHU (confidence: strong) | Hanya diterapkan pada matan murni |
| R8 | REGEX_RED_FLAGS | Pola redaksi khusus via regex | KUAT_INDIKASI_MAUDHU / LEMAH_CENDERUNG_TIDAK_SHOHIH | |
| R8(m)| RIKAKAH_AL_LAFZ | M5="YA" (Bahasa sangat rancu / pesan berantai) | HOAKS_BUKAN_HADIS | Kuesioner Manual Frontend |
| R9 | AL_MUJAZAFAH | M1="YA" (Janji pahala/ancaman fantastis berlebihan) | KUAT_INDIKASI_MAUDHU | Kuesioner Manual Frontend |
| R10 | CONTRADICTION | M2="YA" atau M4="YA" (Hal ghaib penentuan waktu/Fakta empiris) | KUAT_INDIKASI_MAUDHU | Kuesioner Manual Frontend |
| R11 | FANATIC_POLITICAL | M3="YA" (Pujian pujian/celaan rasis) | INDIKASI_MAUDHU_POLITIS | Kuesioner Manual Frontend |
| R12 | UNKNOWN_MANUAL | Semua M="TIDAK" | STATUS_TIDAK_DIKENALI | Kuesioner Manual Frontend |

#### Detail Aturan R5: Deteksi Kontradiksi dengan Al-Quran

Dasar: **Ulama sepakat bahwa hadits shahih mustahil bertentangan dengan Al-Quran.** Jika matan mengandung klaim yang bertentangan dengan ayat Al-Quran yang sudah qath'i (jelas dan pasti), maka itu merupakan indikasi kuat bahwa hadits tersebut palsu (maudhu).

Pola yang dideteksi antara lain:

- **Bertentangan dengan QS. Al-An'am:164** ("Tidaklah seseorang menanggung dosa orang lain"):
  - "anak menanggung dosa orang tua", "dosa bapak ditanggung anak", "istri menanggung dosa suami", dll.

- **Bertentangan dengan QS. Al-An'am:160** (Kebaikan dilipatkan 10×, bukan tak terbatas):
  - "satu kebaikan dibalas sejuta", "pahala tak terhingga", "pahala yang tidak terbatas"

- **Bertentangan dengan QS. Al-Baqarah:284** (Kehendak Allah yang mutlak):
  - "pasti masuk surga tanpa hisab", "dijamin masuk surga", "allah wajib mengampuni"

- **Bertentangan dengan QS. An-Nisa:48** (Syirik tidak diampuni):
  - "syirik diampuni", "musyrik diampuni"

#### Detail Aturan R6: Deteksi Bahasa/Istilah Modern (Anakronistik)

Dasar: **Hadits adalah ucapan, perbuatan, atau taqrir Nabi ﷺ yang hidup di abad ke-7 Masehi.** Tidak mungkin hadits shahih mengandung istilah, teknologi, atau konsep yang baru dikenal ratusan tahun kemudian. Keberadaan istilah modern dalam matan merupakan indikasi kuat fabrikasi.

Kategori pola yang dideteksi:

- **Teknologi modern**: televisi, internet, komputer, handphone, smartphone, media sosial, whatsapp, facebook, instagram, youtube, twitter, email, website, aplikasi, laptop, wifi
- **Konsep politik/ekonomi modern**: demokrasi, komunisme, sosialisme, kapitalisme, partai politik, pemilu, presiden republik, bank sentral, saham, investasi online
- **Istilah geografis/negara modern**: amerika, indonesia, malaysia, australia
- **Ilmu pengetahuan modern**: vaksin, virus corona, covid, bakteri, antibiotik, operasi plastik, transplantasi
- **Transportasi modern**: pesawat terbang, mobil, motor, kereta api

---

## 3) Penjelasan Fungsi Algoritma

### Jaro-Winkler (Token Typo Correction)
- **Tujuan**: Koreksi kata yang salah ketik pada tahap Pra-Pemrosesan.
- **Cara kerja**: Membandingkan token query dengan vocabulary corpus, pilih skor tertinggi di atas threshold (≥ 0.88). Karena dirancang dengan sistem *Prefix Bonus*, Jaro-Winkler sangat brilian mendeteksi *typo* manusia.

### TF-IDF (Pemberi Bobot Kata Kunci)
- Mengubah teks menjadi vektor angka berbobot.
- **TF (Term Frequency)** menilai seberapa sering kata muncul dalam dokumen.
- **IDF (Inverse Document Frequency)** menurunkan bobot kata yang terlalu umum dan menaikkan kata yang unik.

### Cosine Similarity (Pengukur Kemiripan Semantik Global)
- Mengukur sudut antara vektor query dan vektor dokumen. Digunakan untuk pencocokan 1-to-1 dokumen lengkap (*Global Alignment*).
- Cenderung menghukum (memberi penalti poin) dokumen target yang terlalu panjang jika query cukup pendek.

### Overlap / Coverage Similarity (Pengukur Persentase Substring)
- Dibuat khusus (Custom) untuk menoleransi matan acuan yang panjang.
- Hanya mengecek: "Berapa banyak dari Term input user yang termuat di dalam Term dokumen?".
- Menghindari turunnya skor di The Cosine Similarity akibat perbedaan rasio ekstrim panjang kalimat antara kata kunci pengguna dan hadits aslinya.
- Pembobotan 60% Overlap dan 40% Cosine memberikan hasil optimal untuk memfasilitasi pencarian sub-kalimat/potongan *(Substring Match)*.

### Representasi Token
- Saat ini sistem hanya memakai token kata tunggal (unigram) setelah preprocessing dan koreksi typo.
- Informasi konteks frasa ditangkap lewat kombinasi distribusi kata (TF-IDF) dan gabungan skor Cosine + Jaro-Winkler, tanpa perlu membentuk n-gram eksplisit.

### Substring Boost
- Jika query matan ada di dalam matan dokumen (atau sebaliknya), skor ditingkatkan ke minimal 0.95.
- Membantu kasus kutipan pendek yang merupakan bagian dari matan panjang.

---

## 4) Status dan Interpretasi Skor

### Status NLP (Lapisan 1)
| Skor | Status | Interpretasi |
|------|--------|--------------|
| > 0.80 | SHAHIH | Ditemukan padanan matan dengan kemiripan tinggi dalam database |
| ≥ 0.50 | PERLU_REVIEW | Kemiripan sedang, perlu verifikasi lanjut |
| < 0.50 | TIDAK_DITEMUKAN | Tidak ditemukan padanan, terindikasi palsu/tidak tercatat |

### Status Sistem Pakar (Lapisan 2)
| Status | Label | Artinya |
|--------|-------|---------|
| INSYAALLAH_MAQBUL | InsyaAllah Maqbul | Ditemukan dalam sumber rujukan, tidak ada red flag signifikan |
| PERLU_TAHQIQ_LANJUT | Perlu Tahqiq Lanjut | Kemiripan sedang/ada indikasi populer, butuh verifikasi ulama |
| SYUBHAT_TIDAK_DITEMUKAN | Syubhat | Tidak ditemukan, patut dicurigai |
| LEMAH_CENDERUNG_TIDAK_SHOHIH | Lemah | Mengandung sinyal kelemahan atau riwayat bermasalah |
| LA_ASLA_LAHU | La Asla Lahu | Teks sangat mirip pepatah/mitos populer yang tidak dikenal sebagai hadits dalam sumber rujukan |
| KUAT_INDIKASI_MAUDHU | Kuat Indikasi Maudhu | Red flag kuat terpicu (pahala berlebihan, kontradiksi Qur'an, bahasa modern, ancaman/hoaks spesifik) |

---

## 5) Ringkasan Alur Singkat

```
Input teks user
  → Normalisasi
  → Extract matan (pisahkan dari sanad)
  → Preprocess (lowercase, hapus tanda baca, stopwords)
  → Typo correction (Jaro-Winkler per token)
  → TF-IDF vectorization
  → Cosine Similarity (bobot 40%)
  → Overlap Coverage Similarity (bobot 60%)
  → Substring Boost
  → Ranking + Tier NLP (found / review / notfound)
  → Forward Chaining Sistem Pakar:
      R0: Base Rule (tier → status awal)
      R1: Cek pola pahala berlebihan
      R2: Cek pola amalan bid'ah
      R3: Cek pola ancaman berlebihan
      R4: Adjust confidence jika skor borderline
      R5: Cek kontradiksi dengan Al-Quran
      R6: Cek bahasa/istilah modern
      R8: Tepat Pola Spesifik
  → Kesimpulan Awal Otomatis
  → JIKA skor < 0.60 & Tiada RedFlag Otomatis:
      Kuesioner Pakar Manual Berbasis Observasi
      M1-M5: Kriteria Kritik Teks Manual (Al-Mujazafah, Rikakah, dsb)
      Memicu Aturan R9-R12.
  → Kesimpulan Akhir Gabungan
  → Kesimpulan: status pakar + confidence + alasan + rules fired
```

