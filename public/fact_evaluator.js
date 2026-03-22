/**
 * =============================================================================
 * EVALUASI PENELUSURAN FAKTA (FACT GATHERING) — Data-Driven Config
 * Tahap 3 dari Sistem Pakar: Aturan R9-R13 (Inferensi Manual)
 *
 * Untuk MENAMBAH pertanyaan baru:
 *   1. Tambah satu objek baru ke array FACT_QUESTIONS di bawah.
 *   2. Tambah entri di FACT_RULES sesuai 'id' pertanyaan.
 *   3. Selesai — form HTML dan logika evaluasi otomatis menyesuaikan.
 * =============================================================================
 */

/**
 * Daftar pertanyaan penelusuran fakta interaktif (M1-M5, dst).
 * Ini adalah SATU-SATUNYA tempat edit untuk menambah/mengubah pertanyaan.
 *
 * Properti:
 *  - id     : string unik, digunakan sebagai name pada input radio.
 *  - label  : label singkat untuk identifikasi (opsional, untuk debugging).
 *  - text   : teks pertanyaan yang tampil kepada pengguna.
 */
const FACT_QUESTIONS = [
  {
    id: 'm1',
    label: 'Al-Mujazafah',
    text: 'M1. Apakah teks ini memuat janji pahala yang fantastis atau ancaman yang sangat mengerikan untuk amalan yang sepele?',
  },
  {
    id: 'm2',
    label: 'Hal Ghaib',
    text: 'M2. Apakah teks ini menentukan waktu, hari, atau tahun spesifik akan terjadinya kiamat atau bencana besar?',
  },
  {
    id: 'm3',
    label: 'Fanatisme Golongan',
    text: 'M3. Apakah teks ini berisi pujian atau celaan yang sangat berlebihan dan rasis terhadap suatu kabilah, suku, atau nama kota tertentu?',
  },
  {
    id: 'm4',
    label: 'Empiris',
    text: 'M4. Apakah isi teks ini secara nyata bertentangan dengan akal sehat, fakta sejarah yang pasti, atau ilmu medis dasar?',
  },
  {
    id: 'm5',
    label: 'Rikakah al-Lafz',
    text: 'M5. Apakah susunan kalimatnya terasa seperti bahasa pasaran modern, mengandung ancaman berantai (misal: "sebarkan atau sial"), atau tata bahasanya sangat rancu?',
  },
];

/**
 * Aturan evaluasi berdasarkan jawaban pengguna.
 * Key = id pertanyaan, Value = fungsi penentu status jika jawaban = true.
 *
 * Urutan pengecekan: prioritas tertinggi (m5) ke terendah.
 */
const FACT_RULES = [
  {
    ids: ['m5'],
    expertStatus: 'HOAKS_BUKAN_HADIS',
    expertLabel: 'Hoaks / Bukan Hadis',
    reason: 'Susunan bahasa (Lafal) sangat rancu, menggunakan pola ancaman psikologis modern (Rikakah al-Lafz).',
    ruleFired: 'R9_RIKAKAH_AL_LAFZ',
  },
  {
    ids: ['m1'],
    expertStatus: 'KUAT_INDIKASI_MAUDHU',
    expertLabel: "Kuat Indikasi Maudhu'",
    reason: "Kandungan makna (Ma'na) tidak proporsional dengan prinsip syariat (Al-Mujazafah).",
    ruleFired: 'R10_AL_MUJAZAFAH',
  },
  {
    ids: ['m2', 'm4'],
    expertStatus: 'KUAT_INDIKASI_MAUDHU',
    expertLabel: "Kuat Indikasi Maudhu'",
    reason: "Matan bertentangan dengan dalil Qath'i (hal ghaib) atau akal sehat empiris.",
    ruleFired: 'R11_GHAIB_EMPIRIS_CONTRADICTION',
  },
  {
    ids: ['m3'],
    expertStatus: 'INDIKASI_MAUDHU_POLITIS',
    expertLabel: "Indikasi Maudhu' (Politis)",
    reason: 'Matan terindikasi sebagai fabrikasi politik/fanatisme golongan di masa lalu.',
    ruleFired: 'R12_FANATIC_POLITICAL',
  },
];

/**
 * Evaluasi jawaban penelusuran fakta menggunakan FACT_RULES.
 * @param {Object} answers - { m1: bool, m2: bool, ... }
 * @returns {{ expertStatus, expertLabel, reason, rulesFired: string[] }}
 */
function evaluateFactGathering(answers) {
  for (const rule of FACT_RULES) {
    const triggered = rule.ids.some(id => answers[id] === true);
    if (triggered) {
      return {
        expertStatus: rule.expertStatus,
        expertLabel: rule.expertLabel,
        reason: rule.reason,
        rulesFired: [rule.ruleFired],
      };
    }
  }

  return {
    expertStatus: 'STATUS_TIDAK_DIKENALI',
    expertLabel: 'Status Tidak Dikenali',
    reason: 'Teks tidak memiliki red-flag yang dikenali sistem. Butuh pakar manusia untuk Tahqiq manual.',
    rulesFired: ['R13_UNKNOWN_MANUAL_TAHQIQ'],
  };
}