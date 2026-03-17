/**
 * Rule-Based Expert Layer for Hadith Evaluation (Matan-focused)
 * Metode Inferensi: Forward Chaining
 *
 * Alur Forward Chaining:
 *   FAKTA AWAL (input teks + skor NLP)
 *     → EVALUASI ATURAN (R1..R6 diperiksa secara berurutan)
 *       → KESIMPULAN AKHIR (status pakar + alasan + confidence band)
 *
 * Daftar Aturan (Rules):
 *   R0  BASE_RULE        — Tentukan status awal dari tier NLP (found/review/notfound)
 *   R1  EXAGGERATED_REWARD — Deteksi janji pahala sangat berlebihan (ciri maudhu)
 *   R2  BIDAH_PRACTICE    — Deteksi amalan khusus kontroversial tanpa dalil shahih
 *   R3  OVER_THREAT       — Deteksi ancaman tidak proporsional (ciri lemah/palsu)
 *   R4  ADJUST_CONFIDENCE — Turunkan keyakinan jika skor NLP "found" tapi < 0.85
 *   R5  QURAN_CONTRADICTION — Deteksi matan yang bertentangan dengan prinsip Al-Quran
 *   R6  MODERN_LANGUAGE   — Deteksi bahasa/istilah modern yang tidak sesuai era kenabian
 *
 * Catatan penting:
 * - Ini BUKAN pengganti tahqiq ulama. Hanya sistem pakar heuristik
 *   yang membantu memberi indikasi berbasis pola teks + hasil NLP.
 * - Aturan disusun dengan pendekatan konservatif dan harus dianggap
 *   sebagai "indikasi awal" yang tetap perlu diverifikasi manual.
 */

const { normalizeQuery } = require('./similarity');

// Pola-pola red flag yang sering muncul pada hadits maudhu'/lemah
const EXAGGERATED_REWARD_PATTERNS = [
  'seperti haji seribu kali',
  'pahala seribu haji',
  'seperti seribu haji',
  'tujuh puluh ribu malaikat',
  'diampuni semua dosanya',
  'diampuni seluruh dosanya',
  'diampuni dosa-dosa yang telah lalu dan yang akan datang',
  'dibangunkan istana di surga',
  'setiap hurufnya',
  'setiap huruf akan',
  'seperti membaca al quran seluruhnya',
];

const WEAK_SIGNAL_PATTERNS = [
  'barangsiapa yang meninggalkan shalat',
  'barangsiapa meninggalkan shalat',
  'barangsiapa meninggalkan solat',
  'siapa yang meninggalkan shalat',
  'siapa yang meninggalkan solat',
  'barangsiapa yang tidak shalat',
];

const BID_AH_PRACTICE_PATTERNS = [
  'shalat raghaib',
  'sholat raghaib',
  'puasa nisfu sya ban',
  'puasa nisfu sya’ban',
  'puasa nisfu syaaban',
  'malam nisfu sya ban',
];

// Pola matan yang bertentangan dengan prinsip-prinsip Al-Quran yang sudah qath'i (jelas)
// Referensi: ulama menetapkan bahwa hadits shahih tidak akan bertentangan dengan Al-Quran
const QURAN_CONTRADICTION_PATTERNS = [
  // Bertentangan dengan "la taziru waziratun wizra ukhra" (QS. Al-An'am:164)
  'anak menanggung dosa orang tua',
  'dosa bapak ditanggung anak',
  'dosa ayah ditanggung anak',
  'anak menanggung dosa ayahnya',
  'anak menanggung dosa ibunya',
  'istri menanggung dosa suami',
  // Bertentangan dengan "man ja'a bil hasanati falahu 'asyru amtsaliha" (QS. Al-An'am:160)
  // (kebaikan dilipatkan 10x, bukan jutaan/tak terbatas)
  'satu kebaikan dibalas sejuta',
  'pahala tak terhingga',
  'pahala yang tidak terbatas',
  // Bertentangan dengan kehendak Allah yang mutlak (QS. Al-Baqarah:284)
  'pasti masuk surga tanpa hisab',
  'dijamin masuk surga',
  'allah wajib mengampuni',
  'allah harus mengampuni',
  // Bertentangan dengan "innallaha la yaghfiru an yusyraka bihi" (QS. An-Nisa:48)
  'syirik diampuni',
  'musyrik diampuni',
];

// Pola bahasa/istilah modern yang tidak mungkin ada di era kenabian (abad 7 M)
// Hadits shahih menggunakan bahasa dan konsep yang sesuai dengan konteks zamannya
const MODERN_LANGUAGE_PATTERNS = [
  // Teknologi modern
  'televisi', 'internet', 'komputer', 'handphone', 'hp', 'smartphone',
  'media sosial', 'whatsapp', 'facebook', 'instagram', 'youtube', 'twitter',
  'email', 'website', 'aplikasi', 'teknologi', 'laptop', 'wifi',
  // Konsep politik/ekonomi modern
  'demokrasi', 'komunisme', 'sosialisme', 'kapitalisme',
  'partai politik', 'pemilu', 'presiden republik',
  'bank sentral', 'saham', 'investasi online',
  // Istilah geografis/negara modern
  'amerika', 'indonesia', 'malaysia', 'australia',
  // Ilmu pengetahuan modern yang anakronistik
  'vaksin', 'virus corona', 'covid', 'bakteri', 'antibiotik',
  'operasi plastik', 'transplantasi',
  // Transportasi modern
  'pesawat terbang', 'mobil', 'motor', 'kereta api',
];

function containsAny(text, patterns) {
  const lower = text.toLowerCase();
  return patterns.some(p => lower.includes(p));
}

/**
 * Expert-layer rule evaluation.
 *
 * @param {Object} ctx
 * @param {string} ctx.queryText - Teks asli input user (bisa berisi sanad + matan)
 * @param {string} ctx.queryMatan - Hasil extractMatan dari query
 * @param {Object} ctx.bestMatch - Objek bestMatch dari NLP (boleh null)
 * @param {Array}  ctx.topMatches - Array topMatches dari NLP
 * @param {string} ctx.overallTier - 'found' | 'review' | 'notfound'
 * @returns {{
 *   expertStatus: string,
 *   expertLabel: string,
 *   confidenceBand: 'strong' | 'medium' | 'weak',
 *   reasons: string[],
 *   rulesFired: string[]
 * }}
 */
function evaluateExpertLayer(ctx) {
  const reasons = [];
  const rulesFired = [];

  const normalizedMatan = normalizeQuery(ctx.queryMatan || ctx.queryText || '');

  // Base rule dari NLP tier
  let expertStatus;
  let expertLabel;
  let confidenceBand;

  if (ctx.overallTier === 'found') {
    expertStatus = 'INSYAALLAH_MAQBUL';
    expertLabel = 'InsyaAllah Maqbul (Ditemukan dalam sumber rujukan)';
    confidenceBand = 'strong';
    reasons.push('Redaksi matan memiliki kemiripan tinggi dengan koleksi hadits rujukan yang dianggap maqbul.');
    rulesFired.push('BASE_FOUND_MATCH');
  } else if (ctx.overallTier === 'review') {
    expertStatus = 'PERLU_TAHQIQ_LANJUT';
    expertLabel = 'Perlu Tahqiq Lanjut (Kemiripan Sedang)';
    confidenceBand = 'medium';
    reasons.push('Terdapat kemiripan sedang dengan beberapa matan hadits, namun belum cukup kuat untuk disamakan.');
    rulesFired.push('BASE_MEDIUM_MATCH');
  } else {
    expertStatus = 'SYUBHAT_TIDAK_DITEMUKAN';
    expertLabel = 'Syubhat / Tidak Ditemukan dalam Database Rujukan';
    confidenceBand = 'medium';
    reasons.push('Tidak ditemukan kemiripan signifikan pada kumpulan hadits rujukan yang digunakan sistem.');
    rulesFired.push('BASE_NOT_FOUND');
  }

  // Rule 1: Red flag kelebihan janji pahala
  if (normalizedMatan && containsAny(normalizedMatan, EXAGGERATED_REWARD_PATTERNS)) {
    expertStatus = 'KUAT_INDIKASI_MAUDHU';
    expertLabel = 'Kuat Indikasi Maudhu (Janji Pahala Sangat Berlebihan)';
    confidenceBand = 'strong';
    reasons.push('Terdapat pola janji pahala yang sangat berlebihan yang secara umum diklasifikasikan ulama sebagai ciri kuat hadits maudhu\'.');
    rulesFired.push('RED_FLAG_EXAGGERATED_REWARD');
  }

  // Rule 2: Praktik yang dikenal banyak ulama sebagai bid\'ah atau tidak bersandar pada dalil kuat
  if (normalizedMatan && containsAny(normalizedMatan, BID_AH_PRACTICE_PATTERNS)) {
    expertStatus = 'KUAT_INDIKASI_MAUDHU';
    expertLabel = 'Kuat Indikasi Maudhu / Lemah (Amalan Khusus Kontroversial)';
    confidenceBand = 'strong';
    reasons.push('Redaksi menyebut amalan khusus yang secara luas dinyatakan tidak memiliki hadits shahih yang menguatkan.');
    rulesFired.push('RED_FLAG_BIDAH_PRACTICE');
  }

  // Rule 3: Ancaman ekstrem untuk dosa yang sudah ditetapkan kadarnya dalam nash shahih lain
  if (normalizedMatan && containsAny(normalizedMatan, WEAK_SIGNAL_PATTERNS) && ctx.overallTier === 'notfound') {
    expertStatus = 'LEMAH_CENDERUNG_TIDAK_SHOHIH';
    expertLabel = 'Lemah / Cenderung Tidak Shahih (Ancaman Tidak Seimbang)';
    confidenceBand = 'medium';
    reasons.push('Teks mengandung ancaman yang tampak tidak proporsional dan tidak ditemukan padanannya dalam sumber rujukan yang digunakan.');
    rulesFired.push('WEAK_SIGNAL_OVER_THREAT');
  }

  // Rule 4: Bila overallTier "found" tapi skor di bawah 0.85, turunkan band
  if (ctx.overallTier === 'found' && ctx.bestMatch && ctx.bestMatch.score < 0.85) {
    if (confidenceBand === 'strong') confidenceBand = 'medium';
    reasons.push('Kemiripan tinggi namun tidak ekstrem (skor < 0.85), sehingga masih perlu kehati-hatian dalam penyamaan redaksi.');
    rulesFired.push('ADJUST_FOUND_CONFIDENCE');
  }

  // Rule 5: Deteksi matan yang bertentangan dengan prinsip Al-Quran yang sudah qath'i
  // Dasar: Ulama sepakat hadits shahih mustahil bertentangan dengan Al-Quran
  if (normalizedMatan && containsAny(normalizedMatan, QURAN_CONTRADICTION_PATTERNS)) {
    expertStatus = 'KUAT_INDIKASI_MAUDHU';
    expertLabel = 'Kuat Indikasi Maudhu (Bertentangan dengan Prinsip Al-Quran)';
    confidenceBand = 'strong';
    reasons.push('Matan mengandung pernyataan yang bertentangan dengan prinsip Al-Quran yang sudah qath\'i (jelas dan pasti). Ulama menetapkan bahwa hadits shahih mustahil bertentangan dengan Al-Quran.');
    rulesFired.push('RED_FLAG_QURAN_CONTRADICTION');
  }

  // Rule 6: Deteksi bahasa/istilah modern yang anakronistik (tidak sesuai era kenabian)
  // Dasar: Hadits adalah ucapan/perbuatan Nabi ﷺ di abad 7 M, tidak mungkin mengandung
  //        istilah teknologi, politik, atau konsep yang baru muncul ratusan tahun kemudian
  if (normalizedMatan && containsAny(normalizedMatan, MODERN_LANGUAGE_PATTERNS)) {
    expertStatus = 'KUAT_INDIKASI_MAUDHU';
    expertLabel = 'Kuat Indikasi Maudhu (Mengandung Istilah/Konsep Modern)';
    confidenceBand = 'strong';
    reasons.push('Matan mengandung istilah atau konsep yang baru dikenal di era modern dan tidak mungkin ada di masa Nabi ﷺ (abad 7 M). Ini merupakan indikasi kuat bahwa teks tersebut adalah fabrikasi.');
    rulesFired.push('RED_FLAG_MODERN_LANGUAGE');
  }

  return {
    expertStatus,
    expertLabel,
    confidenceBand,
    reasons,
    rulesFired,
  };
}

module.exports = {
  evaluateExpertLayer,
};
