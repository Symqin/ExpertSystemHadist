/**
 * =============================================================================
 * SISTEM PAKAR BERBASIS ATURAN (RULE-BASED EXPERT SYSTEM) — Client-Side
 * Metode Inferensi: Forward Chaining
 * Seluruh logika berjalan di browser, tanpa server backend.
 * =============================================================================
 */

// =============================================================================
// BASIS PENGETAHUAN (KNOWLEDGE BASE) — Pola-pola Red Flag
// =============================================================================

/**
 * Normalisasi teks: lowercase, hapus tanda baca, rapikan spasi.
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// FAKTA 1: Janji pahala sangat berlebihan (Mubalaghah Fasidah)
// [Ta'liq Al-Muhaddith]: "Di antara tanda matan yang maudhu' adalah Ad-Da'wa Al-Baathilah (klaim yang batil) 
// berupa janji pahala yang mutlak sangat besar untuk amalan yang ringan, atau ancaman neraka yang dahsyat 
// untuk kesalahan kecil. Akal dan naql menolaknya." (Ibn al-Qayyim, Al-Manar al-Munif)
const EXAGGERATED_REWARD_PATTERNS = [
  'barangsiapa yang bergembira dengan datangnya bulan ramadhan, jasadnya diharamkan dari neraka',
  'diampuni dosanya beserta dosa tujuh turunannya',
  'mendapatkan pahala tujuh puluh nabi',
  'mendapatkan pahala tujuh puluh ribu syuhada',
  'seperti beribadah tujuh puluh tahun',
  'barangsiapa membaca doa ini, malaikat jibril akan kebingungan mencatat pahalanya',
  'malaikat pencatat amal sampai kelelahan mencatat pahalanya',
  'dibangunkan seribu kota di surga',
  'barangsiapa yang shalat dhuha, akan dicukupkan rezekinya hingga tujuh turunan',
  'pahalanya seperti mengkhatamkan al quran seribu kali',
  'pahalanya seperti haji dan umrah seribu kali',
  'pahala sejuta', 'pahala seribu', 'pahala satu juta',
  'minum kopi masuk surga',
  'selama rasa kopi masih ada di',
  'malaikat memintakan ampun selama rasa kopi',
  'seperti membebaskan seribu budak dari keturunan ismail',
  'barangsiapa bershalawat kepadaku pada hari jumat seribu kali',
];

// FAKTA 2: Bahasa/istilah modern yang anakronistik (Tarikhiyyah al-Lafz)
// [Ta'liq Al-Muhaddith]: "Mustahil Nabi ﷺ —yang jawami' al-kalim dan hidup di jazirah Arab abad ke-7— 
// menggunakan lafaz yang baru dikonstruksi oleh peradaban modern (Anakronisme). Ini adalah seburuk-buruk 
// kedustaan (kadzib) orang-orang jahil di zaman ini."
const MODERN_LANGUAGE_PATTERNS = [
  'televisi', 'internet', 'komputer', 'handphone', 'hp', 'smartphone',
  'media sosial', 'whatsapp', 'facebook', 'instagram', 'youtube', 'twitter', 'tiktok',
  'email', 'website', 'aplikasi', 'teknologi', 'laptop', 'wifi', 'kuota internet',
  'demokrasi', 'komunisme', 'sosialisme', 'kapitalisme', 'liberalisme', 'sekularisme',
  'partai politik', 'pemilu', 'presiden republik', 'dewan perwakilan',
  'bank sentral', 'saham', 'investasi online', 'kripto', 'bitcoin', 'pinjol',
  // Catatan: 'cina' & 'jepang' TIDAK dimasukkan — keduanya dikenal sejak era Nabi ﷺ (abad ke-7 M)
  'amerika', 'indonesia', 'malaysia', 'australia', 'eropa', 'rusia',
  'vaksin', 'virus corona', 'covid', 'bakteri', 'antibiotik', 'paracetamol',
  'operasi plastik', 'transplantasi', 'kanker', 'diabetes', 'kolesterol',
  'pesawat terbang', 'mobil', 'motor', 'kereta api', 'sepeda', 'helikopter',
  'zodiak', 'ramalan bintang', 'alien', 'ufo',
];

// FAKTA 3: Matan bertentangan dengan prinsip Al-Quran yang qath'i (Mukhalafah lil-Qur'an)
// [Ta'liq Al-Muhaddith]: "Setiap hadits yang menyalahi nash Al-Quran yang syarih (tegas) dan 
// tidak bisa di-jama' (dikompromikan), maka ketahuilah bahwa sanadnya gelap dan matannya bathil. 
// Kalamullah tidak mungkin bertabrakan dengan sabda Rasul-Nya ﷺ."
const QURAN_CONTRADICTION_PATTERNS = [
  'selangkah anak perempuan keluar rumah tanpa menutup aurat, selangkah pula ayahnya ditarik ke neraka',
  'dosa istri mutlak ditanggung suami', // Bertentangan dengan QS. Al-An'am: 164 (Setiap jiwa menanggung dosanya sendiri)
  'dosa ditanggung anak', 'dosa dipikul orang tua',
  'kiamat akan terjadi pada tahun', // Bertentangan dengan QS. Luqman: 34 (Ilmu tentang Kiamat hanya di sisi Allah)
  'umur umatku tidak akan mencapai',
  'kiamat akan terjadi pada hari jumat tanggal',
  'barangsiapa yang bernama muhammad tidak akan masuk neraka', // Bertentangan dengan prinsip hisab berdasarkan amal
  'allah wajib mengabulkan doa ini dalam', // Memaksa kehendak Allah secara mutlak menyalahi QS. Al-Baqarah: 284
  'orang yang meninggalkan shalat jumat tiga kali berturut-turut maka kafir secara mutlak',
  'anak zina tidak akan masuk surga sampai tujuh turunan', // Bertentangan dengan QS. Al-An'am: 164
];

// FAKTA 4: Ancaman tidak proporsional / pola pesan berantai (Tahwil al-Kadzib)
// [Ta'liq Al-Muhaddith]: "Pola ini sering kita temukan di selebaran-selebaran gelap atau pesan digital berantai. 
// Ini adalah tipu daya syaithan untuk menakut-nakuti awam dengan membawa-bawa nama Nabi ﷺ."
const FABRICATED_THREAT_PATTERNS = [
  'lima belas siksaan bagi yang meninggalkan shalat',
  'enam siksaan di dunia, tiga siksaan ketika mati',
  'tiga siksaan di alam kubur, tiga siksaan saat dibangkitkan',
  'barangsiapa yang tidak menyebarkan',
  'barangsiapa mengabaikan pesan ini, tangannya akan lumpuh',
  'barangsiapa berhaji tapi tidak menziarahiku, maka ia telah memboikotku',
  'sebarkan atau sial', 'sebarkan atau kena musibah', 'jangan putus di kamu',
  'forward pesan ini', 'pasti masuk neraka', 'akan mendapat musibah bertubi-tubi',
  'berhentilah sejenak dan kirimkan ke', 'bagikan ke sepuluh kontak',
];

// FAKTA 5: Praktik bid'ah / amalan kontroversial (Ma Laa Asla Lahu fil Ibadah)
// [Ta'liq Al-Muhaddith]: "Sebagian kaum mengarang hadits untuk melegitimasi mu'amalah atau ritual 
// yang mereka ada-adakan. Tidak ada asalnya (la asla lahu) dalam kitab-kitab Sunnah yang mu'tamad."
const BID_AH_PRACTICE_PATTERNS = [
  'shalat raghaib', 'sholat raghaib', 'shalat alfiyah',
  'puasa nisfu sya ban', "puasa nisfu sya'ban", 'puasa nisfu syaaban',
  'malam nisfu sya ban', 'puasa rajab sebulan penuh',
  'memakai celak pada hari asyura, matanya tidak akan sakit',
  'shalat rebo wekasan', 'mandi pada hari rabu terakhir bulan shafar',
  'puasa di hari tarwiyah, akan dihapus dosa setahun',
  'shalat hajat seribu rakaat', 'puasa pada hari asyura bagaikan puasa setahun',
  'menyapu debu mimbarku', 'mengusap makamku niscaya dikabulkan doanya',
];

// FAKTA 6: Pepatah populer / hoaks medis yang sering diklaim hadits (Masyhur 'ala Alsinatun-Naas)
// [Ta'liq Al-Muhaddith]: "Al-'Ajlouni dalam Kasyf al-Khafa' sering mengingatkan bahwa banyak kalimat 
// hikmah dari tabib Arab, filosof, atau orang zuhud yang seiring waktu lisan orang awam membajaknya 
// dan menyandarkannya kepada sayyidul mursalin ﷺ."
const POPULAR_QUOTES_AND_MEDICAL_HOAX = [
  'cinta tanah air sebagian dari iman', // Hubbul wathan minal iman (Maudhu')
  'tuntutlah ilmu dari buaian hingga liang lahat', // Pepatah Arab
  'perbedaan umatku adalah rahmat', // Ikhtilafu ummati rahmat (La asla lahu)
  'agama adalah akal, tidak ada agama bagi yang tidak berakal', // Batil (Ibnu Taimiyyah)
  'bekerjalah untuk duniamu seakan-akan engkau hidup selamanya', // Atsar sahabat/pepatah, bukan marfu'
  'makanlah sebelum lapar dan berhentilah sebelum kenyang', // Perkataan tabib Harits bin Kaladah
  'berbuka puasalah dengan yang manis-manis', // Menyelisihi sunnah berbuka dengan kurma basah (ruthab)
  'jangan minum sambil berdiri', // Penjelasan medis modern, bukan sabda Nabi
  'kebersihan pangkal kesehatan', // Slogan modern
  'surga di bawah telapak kaki ibu', // Lafaz ini lemah/maudhu', yang shahih adalah "Fa innal jannata 'inda rijleiha" (sesungguhnya surga ada di dekat kedua kakinya).
];

// FAKTA 7: Pola regex spesifik (Shorih al-Kadzib)
// [Ta'liq Al-Muhaddith]: "Aturan pendeteksian pola identik untuk teks-teks parah yang sudah di-tahdzir ulama."
const REGEX_RED_FLAGS = [
  // Kasus 1-5: Pola Lama
  { pattern: /tuntut(lah)?\s+ilmu\s+(walau|meski)\s+(ke|sampai)\s+negeri\s+cina/i, issue: 'Dha\'if / Tidak Terbukti Marfu\' (Sanadnya dinilai munqathi\' oleh Ibn Hibban & Al-Uqaili. Namun secara historis, Cina memang dikenal sebagai salah satu pusat peradaban dan ilmu pengetahuan sejak abad ke-7 M, sehingga penyebutan Cina dalam matan bukan merupakan anachronisme. Peringatan ini semata terkait status sanad, bukan isi matannya).' },
  { pattern: /kebersihan\s+(itu\s+)?sebagian\s+dari\s+iman/i, issue: 'Bukan hadits (Ini susunan kata awam. Hadits shahih berbunyi: "Ath-Thuhuru syathrul iiman" / "Bersuci itu setengah keimanan").' },
  { pattern: /tidur(nya)?\s+orang\s+(yang\s+)?berpuasa\s+adalah\s+ibadah/i, issue: 'Dha\'if Jiddan (Sangat Lemah). Ini alasan bagi para pemalas di bulan Ramadhan.' },
  { pattern: /awal(nya)?\s+ramadhan\s+(adalah\s+)?rahmat.*pertengahan(nya)?\s+ampunan/i, issue: 'Munkar/Sangat Lemah. Syaikh Al-Albani menilainya munkar. Ramadhan dari awal hingga akhir adalah rahmat & ampunan.' },
  { pattern: /barang\s*siapa\s+(membaca|menulis)\s+surat\s+(yasin|al waqiah|al mulk).*?(ribuan|\d+)\s+kali/i, issue: 'Maudhu\' (Klaim berlebihan dalam penetapan jumlah ganjaran/bacaan surat tertentu tanpa dalil).' },

  // Kasus 6: Hadits palsu musiman menjelang bulan puasa
  { pattern: /barang\s*siapa\s+(yang\s+)?(menyampaikan|memberitahu(kan)?)\s+(berita\s+|kabar\s+)?masuk(nya)?\s+bulan\s+(ramadhan|rajab|sya'?ban).*?diharamkan\s+api\s+neraka/i, issue: 'Maudhu\' (Pesan berantai musiman menjelang bulan suci yang sering disebar di grup WA. Ini murni kebohongan/kadzib atas nama Nabi).' },

  // Kasus 7: Nasihat tabib yang disandarkan pada Nabi
  { pattern: /makan(lah)?\s+sebelum\s+lapar.*?berhenti(lah)?\s+sebelum\s+kenyang/i, issue: 'Bukan Hadits (Sering diviralkan sebagai "Pola Makan Rasulullah", padahal ini adalah kalimat seorang tabib Arab bernama Al-Harits bin Kaladah).' },

  // Kasus 8: Mitos perpecahan
  { pattern: /(perbedaan|ikhtilaf)(\s+pendapat)?\s+umatku\s+adalah\s+rahmat/i, issue: 'La Asla Lahu (Tidak ada asalnya). Ulama seperti As-Subki dan Al-Albani menyatakan tidak ditemukan sanadnya sama sekali dalam pangkalan hadits.' },

  // Kasus 9: Slogan nasionalis
  { pattern: /cinta\s+(tanah\s+air|negara)\s+sebagian\s+dari\s+iman/i, issue: 'Maudhu\' (Secara sanad dikemukakan pakar hadits dari zaman dulu hingga Syaikh Al-Albani sebagai kepalsuan).' },

  // Kasus 10: Hadits dunia akhirat
  { pattern: /bekerja(lah)?\s+untuk\s+dunia(mu)?\s+seakan.*?hidup\s+selamanya.*?(beramal|ibadah)(lah)?\s+untuk\s+akhirat/i, issue: 'Bukan Hadits Marfu\'. Ini lebih tepat disebut sebagai kata mutiara atau atsar sahabat (seperti Abdullah bin Amr), bukan sabda Nabi ﷺ.' },

  // Kasus 11: Ancaman bohong 15 siksaan
  { pattern: /siapa\s+yang\s+meninggalkan\s+shalat.*?disiksa\s+dengan\s+(lima\s+belas|15)\s+siksaan/i, issue: 'Maudhu\' (Hadits legendaris tentang 15 siksaan bagi peninggal shalat yang sering tertulis di sampul Yasin/selebaran. Bahkan ad-Dzahabi & Ibnu Hajar sepakat ini palsu).' },
];

// =============================================================================
// FUNGSI PENCOCOKAN POLA
// =============================================================================

function containsAny(text, patterns) {
  return patterns.some(p => {
    const escapedPattern = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedPattern}\\b`, 'i');
    return regex.test(text);
  });
}

function matchRegexFlags(text, regexFlags) {
  const matched = [];
  for (const flag of regexFlags) {
    if (flag.pattern.test(text)) {
      matched.push({ issue: flag.issue });
    }
  }
  return matched;
}

// =============================================================================
// TAHAP 1: PENGUMPULAN FAKTA (FACT GATHERING)
// =============================================================================

function gatherFacts(inputText) {
  const normalized = normalizeText(inputText);
  const facts = {
    hasExaggeratedReward: containsAny(normalized, EXAGGERATED_REWARD_PATTERNS),
    hasModernLanguage: containsAny(normalized, MODERN_LANGUAGE_PATTERNS),
    hasQuranContradiction: containsAny(normalized, QURAN_CONTRADICTION_PATTERNS),
    hasFabricatedThreat: containsAny(normalized, FABRICATED_THREAT_PATTERNS),
    hasBidahPractice: containsAny(normalized, BID_AH_PRACTICE_PATTERNS),
    hasPopularQuotes: containsAny(normalized, POPULAR_QUOTES_AND_MEDICAL_HOAX),
    regexMatches: matchRegexFlags(normalized, REGEX_RED_FLAGS),
  };
  facts.hasRegexRedFlag = facts.regexMatches.length > 0;
  return facts;
}

// =============================================================================
// TAHAP 2: FORWARD CHAINING — EVALUASI ATURAN (R1..R8)
// =============================================================================

const SEVERITY = {
  'REQUIRES_FACT_GATHERING': 0,
  'PERLU_TAHQIQ_LANJUT': 1,
  'LEMAH_CENDERUNG_TIDAK_SHOHIH': 2,
  'LA_ASLA_LAHU': 3,
  'INDIKASI_MAUDHU_POLITIS': 4,
  'KUAT_INDIKASI_MAUDHU': 5,
  'HOAKS_BUKAN_HADIS': 6,
};

function evaluateExpertLayer(inputText) {
  const facts = gatherFacts(inputText);
  const reasons = [];
  const rulesFired = [];
  let expertStatus = null;
  let expertLabel = null;

  const updateStatus = (status, label) => {
    if (!expertStatus || SEVERITY[status] >= SEVERITY[expertStatus]) {
      expertStatus = status;
      expertLabel = label;
    }
  };

  // R1: IF hasExaggeratedReward THEN KUAT_INDIKASI_MAUDHU
  if (facts.hasExaggeratedReward) {
    updateStatus('KUAT_INDIKASI_MAUDHU', 'Kuat Indikasi Maudhu\' (Janji Pahala Sangat Berlebihan)');
    reasons.push('R1: Terdapat pola janji pahala yang sangat berlebihan (Al-Mujazafah) yang secara umum diklasifikasikan ulama sebagai ciri kuat hadits maudhu\'.');
    rulesFired.push('R1_EXAGGERATED_REWARD');
  }

  // R2: IF hasFabricatedThreat THEN KUAT_INDIKASI_MAUDHU
  if (facts.hasFabricatedThreat) {
    updateStatus('KUAT_INDIKASI_MAUDHU', 'Kuat Indikasi Maudhu\' (Ancaman Dibuat-buat / Hoaks Berantai)');
    reasons.push('R2: Teks mengandung ancaman yang tidak wajar atau pola khas pesan berantai (hoaks digital) yang bukan berasal dari sumber hadits.');
    rulesFired.push('R2_FABRICATED_THREAT');
  }

  // R3: IF hasQuranContradiction THEN KUAT_INDIKASI_MAUDHU
  if (facts.hasQuranContradiction) {
    updateStatus('KUAT_INDIKASI_MAUDHU', 'Kuat Indikasi Maudhu\' (Bertentangan dengan Prinsip Al-Quran)');
    reasons.push('R3: Matan mengandung pernyataan yang bertentangan dengan prinsip Al-Quran yang sudah qath\'i (jelas dan pasti).');
    rulesFired.push('R3_QURAN_CONTRADICTION');
  }

  // R4: IF hasModernLanguage THEN KUAT_INDIKASI_MAUDHU
  if (facts.hasModernLanguage) {
    updateStatus('KUAT_INDIKASI_MAUDHU', 'Kuat Indikasi Maudhu\' (Mengandung Istilah/Konsep Modern)');
    reasons.push('R4: Matan mengandung istilah atau konsep yang baru dikenal di era modern dan tidak mungkin ada di masa Nabi ﷺ (abad 7 M).');
    rulesFired.push('R4_MODERN_LANGUAGE');
  }

  // R5: IF hasBidahPractice THEN LEMAH_CENDERUNG_TIDAK_SHOHIH
  if (facts.hasBidahPractice) {
    updateStatus('LEMAH_CENDERUNG_TIDAK_SHOHIH', 'Indikasi Lemah / Kontroversial (Amalan Khusus, Perlu Tahqiq Ulama)');
    reasons.push('R5: Redaksi menyebut amalan khusus yang banyak dinilai ulama sebagai tidak memiliki hadits shahih yang kuat.');
    rulesFired.push('R5_BIDAH_PRACTICE');
  }

  // R6: IF hasPopularQuotes THEN LA_ASLA_LAHU
  if (facts.hasPopularQuotes) {
    updateStatus('LA_ASLA_LAHU', 'La Asla Lahu (Pepatah/Mitos Populer, Bukan Hadits)');
    reasons.push('R6: Teks ini sangat mirip dengan pepatah Arab, nasihat tabib, atau mitos populer yang sering keliru disandarkan kepada Nabi ﷺ.');
    rulesFired.push('R6_POPULAR_QUOTES');
  }

  // R7: IF hasRegexRedFlag THEN KUAT_INDIKASI_MAUDHU
  if (facts.hasRegexRedFlag) {
    const issues = facts.regexMatches.map(m => m.issue).join('; ');
    updateStatus('KUAT_INDIKASI_MAUDHU', 'Kuat Indikasi Maudhu\' / Bermasalah (Teridentifikasi Pola Spesifik)');
    reasons.push(`R7: Peringatan Spesifik: ${issues}`);
    rulesFired.push('R7_REGEX_RED_FLAG');
  }

  // R8: IF (tidak ada aturan terpicu) THEN REQUIRES_FACT_GATHERING
  if (rulesFired.length === 0) {
    expertStatus = 'REQUIRES_FACT_GATHERING';
    expertLabel = 'Tidak Terdeteksi Red-Flag Otomatis (Butuh Evaluasi Lanjutan)';
    reasons.push('R8: Sistem tidak menemukan pola red-flag pada teks ini. Diperlukan evaluasi lanjutan melalui penelusuran fakta M1-M5.');
    rulesFired.push('R8_NO_RULES_FIRED');
  }

  return {
    expertStatus, expertLabel, reasons, rulesFired,
    factsGathered: facts,
    requiresFactGathering: expertStatus === 'REQUIRES_FACT_GATHERING',
  };
}
