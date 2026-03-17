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
| knowledge_base.js | **Knowledge Base + Rule Engine** | Basis pengetahuan berupa pola red-flag + aturan inferensi forward chaining (R0–R6). |
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
   - Tokenisasi
   - Tambah n-gram (bi-gram/tri-gram) untuk menjaga konteks frasa
4. Bangun vocabulary dari seluruh token corpus.
5. Proses query user:
   - `extractMatan` agar fokus pada isi matan saja
   - `preprocessText` menghasilkan token bersih
   - `correctTypos` memperbaiki typo per kata memakai Jaro-Winkler (threshold ≥ 0.88)
   - Tambah n-gram agar frasa penting ikut terbaca
6. Hitung IDF dari seluruh corpus (`buildIdf`).
7. Buat vektor TF-IDF untuk query dan setiap dokumen (`vectorize`).
8. Hitung **Cosine Similarity** antara vektor query dan vektor dokumen.
9. Hitung **Jaro-Winkler Similarity** di level matan yang sudah dinormalisasi.
10. **Skor akhir** = kombinasi tertimbang: `(Cosine × 0.75) + (Jaro-Winkler × 0.25)`.
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
│      berlebihan (11 pola). Jika cocok → MAUDHU   │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  R2: BID'AH_PRACTICE — Cek pola amalan bid'ah   │
│      kontroversial (6 pola). Jika cocok → MAUDHU │
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
│  R6: MODERN_LANGUAGE — Cek pola bahasa/istilah   │
│      modern yang anakronistik, tidak mungkin ada  │
│      di era kenabian (30+ pola). Jika cocok       │
│      → MAUDHU                                    │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│  KESIMPULAN AKHIR:                               │
│  - expertStatus (kode status)                    │
│  - expertLabel (label deskriptif)                │
│  - confidenceBand (strong / medium / weak)       │
│  - reasons[] (daftar alasan keputusan)           │
│  - rulesFired[] (daftar aturan yang terpicu)     │
└──────────────────────────────────────────────────┘
```

#### Tabel Lengkap Aturan Sistem Pakar (R0–R6)

| Kode | Nama Aturan | Kondisi IF (Premis) | Aksi THEN (Kesimpulan) | Jumlah Pola |
|------|-------------|---------------------|------------------------|-------------|
| R0 | BASE_RULE | Tier NLP = found / review / notfound | Status awal: MAQBUL / TAHQIQ / SYUBHAT | — |
| R1 | EXAGGERATED_REWARD | Matan mengandung pola janji pahala berlebihan | KUAT_INDIKASI_MAUDHU (confidence: strong) | 11 pola |
| R2 | BID'AH_PRACTICE | Matan menyebut amalan bid'ah kontroversial | KUAT_INDIKASI_MAUDHU (confidence: strong) | 6 pola |
| R3 | OVER_THREAT | Matan mengandung ancaman tidak proporsional DAN tier = notfound | LEMAH_CENDERUNG_TIDAK_SHAHIH (confidence: medium) | 6 pola |
| R4 | ADJUST_CONFIDENCE | Tier = found TAPI skor < 0.85 | Turunkan confidence band dari strong → medium | — |
| R5 | QURAN_CONTRADICTION | Matan bertentangan dengan prinsip Al-Quran yang qath'i | KUAT_INDIKASI_MAUDHU (confidence: strong) | 16 pola |
| R6 | MODERN_LANGUAGE | Matan mengandung istilah/konsep modern (anakronistik) | KUAT_INDIKASI_MAUDHU (confidence: strong) | 30+ pola |

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
- **Tujuan**: Koreksi kata yang salah ketik.
- **Cara kerja**: Membandingkan token query dengan vocabulary corpus, pilih skor tertinggi di atas threshold (≥ 0.88).
- Dipakai per kata, bukan per kalimat, karena urutan kata hadits bisa berbeda.

### TF-IDF (Pemberi Bobot Kata Kunci)
- Mengubah teks menjadi vektor angka berbobot.
- **TF (Term Frequency)** menilai seberapa sering kata muncul dalam dokumen.
- **IDF (Inverse Document Frequency)** menurunkan bobot kata yang terlalu umum dan menaikkan kata yang unik.

### Cosine Similarity (Pengukur Kemiripan Semantik)
- Mengukur sudut antara vektor query dan vektor dokumen.
- Nilai mendekati 1 berarti distribusi kata-kata penting sangat mirip meski urutan berbeda.
- Bersifat **order-independent** (tidak bergantung pada urutan kata).

### Jaro-Winkler (Matan-level)
- Memberi sinyal tambahan untuk kemiripan kutipan yang sangat dekat secara urutan karakter.
- Digabung dengan Cosine (bobot 25%) untuk meningkatkan presisi pada kutipan yang mirip sekali.

### N-gram (Frasa/Konteks)
- Menambahkan token gabungan seperti "minum_kopi" agar frasa tetap dikenali sebagai satu unit.
- Membantu kasus di mana kata tunggal kehilangan konteks jika dipisah-pisah.

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
| INSYAALLAH_MAQBUL | InsyaAllah Maqbul | Ditemukan dalam sumber rujukan, tidak ada red flag |
| PERLU_TAHQIQ_LANJUT | Perlu Tahqiq Lanjut | Kemiripan sedang, butuh verifikasi ulama |
| SYUBHAT_TIDAK_DITEMUKAN | Syubhat | Tidak ditemukan, patut dicurigai |
| LEMAH_CENDERUNG_TIDAK_SHAHIH | Lemah | Mengandung sinyal kelemahan |
| KUAT_INDIKASI_MAUDHU | Kuat Indikasi Maudhu | Red flag terpicu: janji berlebihan, kontradiksi Quran, bahasa modern, atau amalan bid'ah |

---

## 5) Ringkasan Alur Singkat

```
Input teks user
  → Normalisasi
  → Extract matan (pisahkan dari sanad)
  → Preprocess (lowercase, hapus tanda baca, stopwords)
  → Typo correction (Jaro-Winkler per token)
  → TF-IDF vectorization
  → Cosine Similarity (bobot 75%)
  → Jaro-Winkler matan (bobot 25%)
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
  → Kesimpulan: status pakar + confidence + alasan + rules fired
```

