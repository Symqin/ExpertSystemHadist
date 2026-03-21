/**
 * Rule-Based Expert Layer for Hadith Evaluation (Matan-focused)
 * Metode Inferensi: Forward Chaining
 *
 * Alur Forward Chaining:
 *   FAKTA AWAL (input teks + skor NLP)
 *     → EVALUASI ATURAN OTOMATIS (R0..R8 diperiksa secara berurutan)
 *       → Jika skor < 0.60 dan tidak ada red-flag, lanjut EVALUASI MANUAL KUESIONER (R8m..R12)
 *         → KESIMPULAN AKHIR GABUNGAN (status pakar + alasan)
 *
 * Daftar Aturan (Rules) Otomatis:
 *   R0  BASE_RULE           — Tentukan status awal dari tier NLP (found/review/notfound)
 *   R1  EXAGGERATED_REWARD  — Deteksi janji pahala sangat berlebihan (indikasi kuat maudhu)
 *   R2  BIDAH_PRACTICE      — Deteksi amalan khusus/bid'ah kontroversial (ditandai lemah/kontroversial, perlu tahqiq)
 *   R3  OVER_THREAT         — Deteksi ancaman tidak proporsional (lemah/tidak seimbang, terutama jika tidak ditemukan di database)
 *   R4  ADJUST_CONFIDENCE   — Turunkan keyakinan jika skor NLP "found" tapi < 0.85
 *   R5  QURAN_CONTRADICTION — Deteksi matan yang bertentangan dengan prinsip Al-Quran yang qath'i
 *   R6  POPULAR_QUOTES      — Deteksi pepatah/hoaks medis populer yang sering diklaim hadits (bisa berujung LA_ASLA_LAHU jika notfound)
 *   R7  MODERN_LANGUAGE     — Deteksi istilah/bahasa modern di matan (indikasi kuat maudhu)
 *   R8  REGEX_RED_FLAGS     — Deteksi pola redaksi khusus via regex (maudhu bila benar-benar tidak ditemukan, atau lemah bila ada asalnya)
 *
 * Daftar Aturan Kuesioner (Rules) Manual:
 *   R8m RIKAKAH_AL_LAFZ     — M5 = "YA" (Bahasa Sangat Rancu/Ancaman Berantai) -> Hoaks
 *   R9  AL_MUJAZAFAH        — M1 = "YA" (Pahala/Ancaman Ekstrem) -> Kuat Indikasi Maudhu
 *   R10 GHAIB/EMPIRIS       — M2 = "YA" atau M4 = "YA" (Bertentangan Akal/Waktu Kiamat) -> Kuat Indikasi Maudhu
 *   R11 FANATIC_POLITICAL   — M3 = "YA" (Rasisme/Sektarianisme) -> Indikasi Maudhu Politis
 *   R12 UNKNOWN_MANUAL      — Semua "TIDAK" -> Status Tidak Dikenali (Butuh Pakar Total)
 *
 * Catatan penting:
 * - Ini BUKAN pengganti tahqiq ulama. Hanya sistem pakar heuristik awal.
 */

const { normalizeQuery } = require('./similarity');

// Pola-pola red flag yang sering muncul pada hadits maudhu'/lemah
const EXAGGERATED_REWARD_PATTERNS = [
  // Pahala yang sangat tidak rasional/berlebihan (Mubalaghah fasidah)
  'barangsiapa yang bergembira dengan datangnya bulan ramadhan, jasadnya diharamkan dari neraka',
  'diampuni dosanya beserta dosa tujuh turunannya',
  'mendapatkan pahala tujuh puluh nabi',
  'mendapatkan pahala tujuh puluh ribu syuhada',
  'seperti beribadah tujuh puluh tahun',
  'barangsiapa membaca doa ini, malaikat jibril akan kebingungan mencatat pahalanya',
  'malaikat pencatat amal sampai kelelahan mencatat pahalanya',
  'dibangunkan seribu kota di surga',
  'barangsiapa yang shalat dhuha, akan dicukupkan rezekinya hingga tujuh turunan',
  
  // Hoaks seputar Kopi (Tidak ada di zaman Nabi)
  'minum kopi masuk surga',
  'selama rasa kopi masih ada di',
  'malaikat memintakan ampun selama rasa kopi'
];

const BID_AH_PRACTICE_PATTERNS = [
  'shalat raghaib',
  'sholat raghaib',
  'shalat alfiyah',
  'puasa nisfu sya ban',
  'puasa nisfu sya’ban',
  'puasa nisfu syaaban',
  'malam nisfu sya ban',
  'puasa rajab sebulan penuh',
  'memakai celak pada hari asyura, matanya tidak akan sakit',
  'shalat rebo wekasan',
  'puasa di hari tarwiyah, akan dihapus dosa setahun',
];

const FABRICATED_THREAT_PATTERNS = [
  'lima belas siksaan bagi yang meninggalkan shalat',
  'enam siksaan di dunia, tiga siksaan ketika mati',
  'tiga siksaan di alam kubur, tiga siksaan saat dibangkitkan',
  'barangsiapa yang tidak menyebarkan pesan ini',
  'barangsiapa mengabaikan pesan ini, tangannya akan lumpuh',
  'barangsiapa berhaji tapi tidak menziarahiku, maka ia telah memboikotku'
];

const QURAN_CONTRADICTION_PATTERNS = [
  // 1. Bertentangan dengan prinsip "Setiap jiwa menanggung dosanya sendiri" (QS. Al-An'am: 164)
  // Menargetkan hoaks populer tentang transfer dosa matematis yang tidak ada sanadnya.
  'selangkah anak perempuan keluar rumah tanpa menutup aurat, selangkah pula ayahnya ditarik ke neraka', // (Hoaks sangat populer. Ada hadits tentang Dayyuth, tapi redaksi matematis "selangkah-selangkah" ini palsu)
  'dosa istri mutlak ditanggung suami', // (Suami wajib mendidik, tapi jika suami sudah lepas tangan dan istri membangkang, dosa ditanggung istri sendiri - spt kisah istri Nabi Luth - QS At-Tahrim: 10)
  
  // 2. Bertentangan dengan prinsip "Ilmu Ghaib hanya milik Allah" (QS. Luqman: 34 & Al-An'am: 59)
  // Menargetkan klaim palsu mengetahui masa depan secara mutlak (selain tanda kiamat dari dalil shahih).
  'kiamat akan terjadi pada tahun',
  'umur umatku tidak akan mencapai', // (Hadits palsu yang sempat viral memprediksi kiamat tahun 1500 H)
  'kiamat akan terjadi pada hari jumat tanggal', // (Penentuan tanggal pasti adalah kedustaan atas nama agama)

  // 3. Bertentangan dengan Keadilan Mutlak Allah (Iman & Amal)
  // Menargetkan jaminan keselamatan palsu berbasis keturunan/nama, bukan ketakwaan (QS. Al-Hujurat: 13).
  'barangsiapa yang bernama muhammad tidak akan masuk neraka', // (Ini adalah hadits Maudhu'/Palsu)
  'allah wajib mengabulkan doa ini dalam', // (Memaksa kehendak Allah dengan tenggat waktu, bertentangan dengan hak prerogatif Allah)
  
  // 4. Bertentangan dengan Syariat Universal Al-Quran
  'orang yang meninggalkan shalat jumat tiga kali berturut-turut maka kafir secara mutlak', // (Redaksi "kafir mutlak" bertentangan dengan ijma ulama; hadits shahihnya menyebut "dicetak hatinya/munafik", bukan otomatis keluar dari Islam jika bukan karena mengingkari kewajibannya)
];

const POPULAR_QUOTES_AND_MEDICAL_HOAX = [
  'cinta tanah air sebagian dari iman',
  'tuntutlah ilmu dari buaian hingga liang lahat',
  'perbedaan umatku adalah rahmat',
  'agama adalah akal, tidak ada agama bagi yang tidak berakal',
  'bekerjalah untuk duniamu seakan-akan engkau hidup selamanya',
  'makanlah sebelum lapar dan berhentilah sebelum kenyang',
  'berbuka puasalah dengan yang manis-manis',
  'jangan minum sambil berdiri karena ginjal tidak menyaring'
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

const REGEX_RED_FLAGS = [
  { pattern: /tuntut(lah)?\s+ilmu\s+(walau|meski)\s+(ke|sampai)\s+negeri\s+cina/i, issue: 'Batil/Palsu (Sanad bermasalah parah)' },
  { pattern: /kebersihan\s+(itu\s+)?sebagian\s+dari\s+iman/i, issue: 'Bukan hadits (Redaksi shahih: "Bersuci itu setengah keimanan")' },
  { pattern: /tidur(nya)?\s+orang\s+(yang\s+)?berpuasa\s+adalah\s+ibadah/i, issue: 'Dha\'if Jiddan (Sangat Lemah)' },
  { pattern: /awal(nya)?\s+ramadhan\s+(adalah\s+)?rahmat.*pertengahan(nya)?\s+ampunan/i, issue: 'Munkar/Sangat Lemah' }
];

function containsAny(text, patterns) {
  return patterns.some(p => {
    // Escaping special regex characters is a good practice, even though current patterns might not need it
    const escapedPattern = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedPattern}\\b`, 'i');
    return regex.test(text);
  });
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
  const normalizedMatanOnly = ctx.queryMatan ? normalizeQuery(ctx.queryMatan) : normalizedMatan;

  // Tingkat keparahan status (makin tinggi makin mendominasi)
  // Ini menghindari aturan "lemah" (severity 4) menimpa aturan "maudhu" (severity 6)
  const SEVERITY = {
    'INSYAALLAH_MAQBUL': 1,
    'PERLU_TAHQIQ_LANJUT': 2,
    'SYUBHAT_TIDAK_DITEMUKAN': 3,
    'LEMAH_CENDERUNG_TIDAK_SHOHIH': 4,
    'LA_ASLA_LAHU': 5,
    'KUAT_INDIKASI_MAUDHU': 6
  };

  let expertStatus;
  let expertLabel;
  let confidenceBand;

  const updateStatus = (status, label, confidence) => {
    if (!expertStatus || SEVERITY[status] >= SEVERITY[expertStatus]) {
      expertStatus = status;
      expertLabel = label;
      if (confidence) confidenceBand = confidence;
    }
  };

  // R0: Base rule dari NLP tier
  if (ctx.overallTier === 'found') {
    updateStatus('INSYAALLAH_MAQBUL', 'InsyaAllah Maqbul (Ditemukan dalam sumber rujukan)', 'strong');
    reasons.push('Redaksi matan memiliki kemiripan tinggi dengan koleksi hadits rujukan yang dianggap maqbul.');
    rulesFired.push('BASE_FOUND_MATCH');
  } else if (ctx.overallTier === 'review') {
    updateStatus('PERLU_TAHQIQ_LANJUT', 'Perlu Tahqiq Lanjut (Kemiripan Sedang)', 'medium');
    reasons.push('Terdapat kemiripan sedang dengan beberapa matan hadits, namun belum cukup kuat untuk disamakan.');
    rulesFired.push('BASE_MEDIUM_MATCH');
  } else {
    updateStatus('SYUBHAT_TIDAK_DITEMUKAN', 'Syubhat / Tidak Ditemukan dalam Database Rujukan', 'medium');
    reasons.push('Tidak ditemukan kemiripan signifikan pada kumpulan hadits rujukan yang digunakan sistem.');
    rulesFired.push('BASE_NOT_FOUND');
  }

  // R1: Red flag kelebihan janji pahala
  if (normalizedMatan && containsAny(normalizedMatan, EXAGGERATED_REWARD_PATTERNS)) {
    updateStatus('KUAT_INDIKASI_MAUDHU', 'Kuat Indikasi Maudhu (Janji Pahala Sangat Berlebihan)', 'strong');
    reasons.push('Terdapat pola janji pahala yang sangat berlebihan yang secara umum diklasifikasikan ulama sebagai ciri kuat hadits maudhu\'.');
    rulesFired.push('RED_FLAG_EXAGGERATED_REWARD');
  }

  // R2: Praktik yang dikenal banyak ulama sebagai bid\'ah atau tidak bersandar pada dalil kuat
  if (normalizedMatan && containsAny(normalizedMatan, BID_AH_PRACTICE_PATTERNS)) {
    updateStatus('LEMAH_CENDERUNG_TIDAK_SHOHIH', 'Indikasi Lemah / Kontroversial (Amalan Khusus, Perlu Tahqiq Ulama)', 'medium');
    if (confidenceBand === 'strong') confidenceBand = 'medium'; // Turunkan confidence jika sebelumnya strong
    reasons.push('Redaksi menyebut amalan khusus yang banyak dinilai ulama sebagai tidak memiliki hadits shahih yang kuat, sehingga statusnya minimal lemah dan perlu tahqiq lanjutan.');
    rulesFired.push('RED_FLAG_BIDAH_PRACTICE');
  }

  // R3: Ancaman Palsu / Pesan Berantai
  if (normalizedMatan && containsAny(normalizedMatan, FABRICATED_THREAT_PATTERNS)) {
    updateStatus('KUAT_INDIKASI_MAUDHU', 'Kuat Indikasi Maudhu (Ancaman Dibuat-buat / Hoaks)', 'strong');
    reasons.push('Teks mengandung ancaman yang tidak wajar atau pola khas pesan berantai (hoaks digital).');
    rulesFired.push('RED_FLAG_FABRICATED_THREAT');
  }

  // R4  Bila overallTier "found" tapi skor di bawah 0.85, turunkan band
  if (ctx.overallTier === 'found' && ctx.bestMatch && ctx.bestMatch.score < 0.85) {
    if (confidenceBand === 'strong') confidenceBand = 'medium';
    reasons.push('Kemiripan tinggi namun tidak ekstrem (skor < 0.85), sehingga masih perlu kehati-hatian dalam penyamaan redaksi.');
    rulesFired.push('ADJUST_FOUND_CONFIDENCE');
  }

  // R5: Deteksi matan yang bertentangan dengan prinsip Al-Quran yang sudah qath'i
  // Dasar: Ulama sepakat hadits shahih mustahil bertentangan dengan Al-Quran
  if (normalizedMatan && containsAny(normalizedMatan, QURAN_CONTRADICTION_PATTERNS)) {
    updateStatus('KUAT_INDIKASI_MAUDHU', 'Kuat Indikasi Maudhu (Bertentangan dengan Prinsip Al-Quran)', 'strong');
    reasons.push('Matan mengandung pernyataan yang bertentangan dengan prinsip Al-Quran yang sudah qath\'i (jelas dan pasti). Ulama menetapkan bahwa hadits shahih mustahil bertentangan dengan Al-Quran.');
    rulesFired.push('RED_FLAG_QURAN_CONTRADICTION');
  }

  // R6: Pepatah Populer & Hoaks Medis yang diklaim Hadits
  if (normalizedMatan && containsAny(normalizedMatan, POPULAR_QUOTES_AND_MEDICAL_HOAX)) {
    reasons.push('Teks ini sangat mirip dengan pepatah Arab, nasihat tabib, atau mitos populer yang sering keliru disandarkan kepada Nabi ﷺ.');
    rulesFired.push('RED_FLAG_POPULAR_QUOTES');

    if (ctx.overallTier === 'notfound') {
      updateStatus('LA_ASLA_LAHU', 'La Asla Lahu (Pepatah/Mitos, Bukan Hadits Ma’ruf dalam Sumber Rujukan)', 'strong');
    } else if (ctx.overallTier === 'review') {
      updateStatus('PERLU_TAHQIQ_LANJUT', 'Perlu Tahqiq: Teks Mirip Pepatah/Mitos yang Sering Disangka Hadits', 'medium');
      if (confidenceBand === 'strong') confidenceBand = 'medium';
    }
  }

  // R7: Deteksi bahasa/istilah modern yang anakronistik (tidak sesuai era kenabian)
  // Dasar: Hadits adalah ucapan/perbuatan Nabi ﷺ di abad 7 M, tidak mungkin mengandung istilah teknologi/modern
  // Perbaikan: HANYA jalankan jika ctx.queryMatan benar-benar ada (bukan hasil fallback dari teks user)
  if (ctx.queryMatan) {
    const strictMatan = normalizeQuery(ctx.queryMatan);
    if (containsAny(strictMatan, MODERN_LANGUAGE_PATTERNS)) {
      updateStatus('KUAT_INDIKASI_MAUDHU', 'Kuat Indikasi Maudhu (Mengandung Istilah/Konsep Modern)', 'strong');
      reasons.push('Matan mengandung istilah atau konsep yang baru dikenal di era modern dan tidak mungkin ada di masa Nabi ﷺ (abad 7 M). Ini merupakan indikasi kuat bahwa teks tersebut adalah fabrikasi.');
      rulesFired.push('RED_FLAG_MODERN_LANGUAGE');
    }
  }


  // R8: Regex Checks (Pendeteksi Variasi Penulisan)
  if (normalizedMatan) {
    REGEX_RED_FLAGS.forEach(flag => {
      if (flag.pattern.test(normalizedMatan)) {
        reasons.push(`Peringatan Spesifik: ${flag.issue}`);

        if (ctx.overallTier === 'notfound') {
          updateStatus('KUAT_INDIKASI_MAUDHU', 'Kuat Indikasi Maudhu / Bermasalah (Tidak Ditemukan Padanan Shahih dalam Rujukan)', 'strong');
        } else {
          updateStatus('LEMAH_CENDERUNG_TIDAK_SHOHIH', 'Indikasi Hadits Lemah / Bermasalah (Perlu Tahqiq Lanjut)', 'medium');
          if (confidenceBand === 'strong') confidenceBand = 'medium';
        }

        if (!rulesFired.includes('RED_FLAG_REGEX_MATCH')) {
          rulesFired.push('RED_FLAG_REGEX_MATCH');
        }
      }
    });
  }

  return {
    expertStatus,
    expertLabel,
    confidenceBand,
    reasons,
    rulesFired,
  };
}

/**
 * 2. Logika Forward Chaining Manual (Murni Matan)
 * Tambahan Kuesioner Interaktif (R8 - R12) jika skor awal < 0.60
 * 
 * @param {Object} answers - { m1, m2, m3, m4, m5 } (berisi boolean true/false)
 * @returns {Object} Hasil inferensi
 */
function evaluateInteractiveQuestionnaire(answers) {
  const { m1, m2, m3, m4, m5 } = answers;

  let expertStatus = '';
  let expertLabel = '';
  let reason = '';
  let rulesFired = [];

  // R8: IF M5 = "YA" -> HOAKS / BUKAN HADIS (Rikakah al-Lafz)
  if (m5) {
    expertStatus = 'HOAKS_BUKAN_HADIS';
    expertLabel = 'Hoaks / Bukan Hadis';
    reason = 'Susunan bahasa (Lafal) sangat rancu, menggunakan pola ancaman psikologis modern (Rikakah al-Lafz).';
    rulesFired.push('R8_RIKAKAH_AL_LAFZ');
  }
  // R9: IF M1 = "YA" -> KUAT INDIKASI MAUDHU (Al-Mujazafah)
  else if (m1) {
    expertStatus = 'KUAT_INDIKASI_MAUDHU';
    expertLabel = 'Kuat Indikasi Maudhu';
    reason = 'Kandungan makna (Ma\'na) tidak proporsional dengan prinsip syariat (Al-Mujazafah).';
    rulesFired.push('R9_AL_MUJAZAFAH');
  }
  // R10: IF M2 = "YA" OR M4 = "YA" -> KUAT INDIKASI MAUDHU (Ghaib/Mukhalafah al-Waqi')
  else if (m2 || m4) {
    expertStatus = 'KUAT_INDIKASI_MAUDHU';
    expertLabel = 'Kuat Indikasi Maudhu';
    reason = 'Matan bertentangan dengan dalil Qath\'i (hal ghaib) atau akal sehat empiris.';
    rulesFired.push('R10_GHAIB_EMPIRIS_CONTRADICTION');
  }
  // R11: IF M3 = "YA" -> INDIKASI MAUDHU (POLITIS)
  else if (m3) {
    expertStatus = 'INDIKASI_MAUDHU_POLITIS';
    expertLabel = 'Indikasi Maudhu (Politis)';
    reason = 'Matan terindikasi sebagai fabrikasi politik/fanatisme golongan di masa lalu.';
    rulesFired.push('R11_FANATIC_POLITICAL');
  }
  // R12: IF Semua = "TIDAK" -> STATUS TIDAK DIKENALI
  else {
    expertStatus = 'STATUS_TIDAK_DIKENALI';
    expertLabel = 'Status Tidak Dikenali';
    reason = 'Teks tidak memiliki red-flag tekstual, namun tidak ada di database. Butuh pakar manusia untuk Tahqiq manual.';
    rulesFired.push('R12_UNKNOWN_MANUAL_TAHQIQ');
  }

  return {
    expertStatus,
    expertLabel,
    reason,
    rulesFired
  };
}

module.exports = {
  evaluateExpertLayer,
  evaluateInteractiveQuestionnaire,
};
