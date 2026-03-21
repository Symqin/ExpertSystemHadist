/**
 * Modul Hybrid NLP untuk HadistSystemChecker
 * Meliputi: Preprocessing, Typo Correction (Jaro-Winkler token-level),
 *           TF-IDF Vectorization, dan Cosine Similarity.
 */

const { jaroWinklerSimilarity } = require('./similarity');

// Stopwords Bahasa Indonesia + transliterasi Arab umum
const STOPWORDS = new Set([
  // Konjungsi & kata penghubung
  'yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'dengan', 'untuk',
  'pada', 'adalah', 'tidak', 'ada', 'dalam', 'juga', 'akan', 'atau',
  'oleh', 'telah', 'bahwa', 'kami', 'saya', 'dia', 'mereka', 'nya',
  'kita', 'anda', 'ia', 'aku', 'kamu', 'ku', 'mu',
  // Kata fungsi
  'jika', 'maka', 'satu', 'sebuah', 'ketika', 'lebih', 'karena',
  'atas', 'bagi', 'kepada', 'tentang', 'belum', 'pun', 'sudah',
  'terhadap', 'namun', 'apakah', 'lagi', 'bukan', 'seperti', 'sebagai',
  'hal', 'antara', 'selain', 'setelah', 'sebelum', 'agar', 'supaya',
  'walaupun', 'meskipun', 'kalau', 'hingga', 'sampai', 'mulai', 'sejak',
  'serta', 'tetapi', 'tapi', 'ialah', 'yaitu', 'yakni', 'adapun',
  'pula', 'lalu', 'kemudian', 'kecuali', 'tanpa', 'bahkan', 'saja',
  'semua', 'setiap', 'tiap', 'para', 'sesuai', 'bisa', 'dapat',
  'harus', 'boleh', 'perlu', 'hanya', 'lah', 'kah', 'nya',
  // Kata penunjuk bilangan umum
  'seorang', 'suatu', 'beberapa', 'berbagai', 'seluruh', 'semua',
  'masing', 'tiap', 'setiap',
  // Transliterasi Arab umum (partikel/kata fungsi)
  'wa', 'fi', 'min', 'ila', 'al', 'an', 'ma', 'la', 'hu', 'ka',
  'fa', 'bi', 'li', 'qad', 'lam', 'inn', 'inna', 'anna', 'aw',
  'thumma', 'hatta', 'ala', 'ان', 'في', 'من', 'إلى', 'على',
]);

/**
 * Ekstrak matan dari teks hadits lengkap dengan memotong sanad (rantai perawi).
 *
 * Strategi dua lapis:
 *  1. Cari kemunculan PERTAMA "bersabda:" — kata ini spesifik untuk sabda Nabi/Rasul,
 *     tidak digunakan di rantai perawi, sehingga selalu menandai awal matan.
 *  2. Jika tidak ada "bersabda:", fallback ke kemunculan TERAKHIR "berkata:"
 *     (untuk hadits bertipe riwayat perbuatan/taqrir tanpa sabda langsung).
 *
 * @param {string} text - Teks terjemahan hadits lengkap (sanad + matan)
 * @returns {string} Teks matan saja, atau teks asli jika pola tidak ditemukan
 */
function extractMatan(text) {
  if (!text) return text;

  const takeFirstQuoted = (segment) => {
    if (!segment) return segment;
    const firstQuote = segment.indexOf('"');
    if (firstQuote === -1) return segment;
    const secondQuote = segment.indexOf('"', firstQuote + 1);
    if (secondQuote === -1) return segment;
    const quoted = segment.slice(firstQuote + 1, secondQuote).trim();
    return quoted.length > 15 ? quoted : segment;
  };

  // Strategi 1: PERTAMA "bersabda:" — penanda sabda Nabi yang muncul sebelum matan
  const bersabdaMatch = /bersabda\s*[;:]/i.exec(text);
  if (bersabdaMatch) {
    const afterColon = text.slice(bersabdaMatch.index + bersabdaMatch[0].length).trim();
    const quoted = takeFirstQuoted(afterColon);
    if (quoted.length > 15) return quoted;
  }

  // Strategi 2: Fallback ke TERAKHIR "berkata:" jika tidak ada "bersabda:"
  const pattern = /berkata\s*[;:]/gi;
  let lastMatch = null;
  let m;
  while ((m = pattern.exec(text)) !== null) {
    lastMatch = m;
  }
  if (lastMatch) {
    const afterSeparator = text.slice(lastMatch.index + lastMatch[0].length).trim();
    const quoted = takeFirstQuoted(afterSeparator);
    if (quoted.length > 15) return quoted;
  }

  return text; // Fallback: kembalikan teks asli jika pola tidak ditemukan
}

/**
 * Preprocessing teks: case folding, hapus tanda baca & angka, hapus stopwords.
 * @param {string} text
 * @returns {string[]} Array token yang sudah bersih
 */
function preprocessText(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/['’]/g, '')       // Hapus tanda kutip tunggal agar qur'an -> quran
    .replace(/[^\w\s]/g, ' ')   // Hapus tanda baca lainnya
    .replace(/\d+/g, ' ')       // Hapus angka
    .replace(/\s+/g, ' ')       // Normalkan spasi
    .trim()
    .split(' ')
    .filter(token => token.length > 1 && !STOPWORDS.has(token));
}


/**
 * Koreksi typo di level token menggunakan Jaro-Winkler.
 * Hanya mengoreksi jika ada kandidat di vocabulary dengan skor >= 0.88
 * dan selisih panjang kata <= 2 karakter.
 * @param {string[]} tokens - Token query hasil preprocessText
 * @param {Set<string>} vocabulary - Himpunan semua token dari corpus
 * @returns {string[]} Token yang sudah dikoreksi
 */
function correctTypos(tokens, vocabulary) {
  if (!vocabulary || vocabulary.size === 0) return tokens;
  const vocabArray = Array.from(vocabulary);

  return tokens.map(token => {
    if (vocabulary.has(token)) return token;       // Token sudah benar
    if (token.length <= 2) return token;           // Lewati token sangat pendek

    let bestWord = token;
    let bestScore = 0.88; // Threshold minimum untuk koreksi typo

    for (const vocabWord of vocabArray) {
      // Optimisasi: lewati kata dengan perbedaan panjang > 2
      if (Math.abs(vocabWord.length - token.length) > 2) continue;
      const score = jaroWinklerSimilarity(token, vocabWord);
      if (score > bestScore) {
        bestScore = score;
        bestWord = vocabWord;
      }
    }
    return bestWord;
  });
}

/**
 * Membangun peta IDF (Inverse Document Frequency) dari seluruh corpus.
 * IDF(t) = log(N / (1 + df(t)))
 * @param {string[][]} corpus - Array of token arrays
 * @returns {Object} Peta { term: idfScore }
 */
function buildIdf(corpus) {
  const N = corpus.length;
  const docFreq = {};

  for (const tokens of corpus) {
    const uniqueTerms = new Set(tokens);
    for (const term of uniqueTerms) {
      docFreq[term] = (docFreq[term] || 0) + 1;
    }
  }

  const idf = {};
  for (const term in docFreq) {
    idf[term] = Math.log(N / (1 + docFreq[term]));
  }
  return idf;
}

/**
 * Membuat vektor TF-IDF dari sebuah dokumen (array token).
 * TF(t, d) = frekuensi(t) / total_token(d)
 * TF-IDF(t, d) = TF(t, d) * IDF(t)
 * @param {string[]} tokens
 * @param {Object} idf - Peta IDF dari buildIdf()
 * @returns {Object} Sparse vector { term: tfidfScore }
 */
function vectorize(tokens, idf) {
  if (tokens.length === 0) return {};

  const tf = {};
  for (const token of tokens) {
    tf[token] = (tf[token] || 0) + 1;
  }

  const vector = {};
  for (const token in tf) {
    const tfScore = tf[token] / tokens.length;
    const idfScore = idf[token] !== undefined ? idf[token] : 0;
    // Hanya sertakan term dengan IDF > 0 (term yang tidak ada di semua dokumen)
    if (idfScore > 0) {
      vector[token] = tfScore * idfScore;
    }
  }
  return vector;
}

/**
 * Menghitung Cosine Similarity antara dua vektor TF-IDF (sparse, sebagai plain object).
 * @param {Object} vec1
 * @param {Object} vec2
 * @returns {number} Skor antara 0.0 - 1.0
 */
function cosineSimilarity(vec1, vec2) {
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (const term in vec1) {
    mag1 += vec1[term] * vec1[term];
    if (vec2[term]) {
      dotProduct += vec1[term] * vec2[term];
    }
  }
  for (const term in vec2) {
    mag2 += vec2[term] * vec2[term];
  }

  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

/**
 * Menghitung persentase liputan (Coverage) pencarian terhadap dokumen.
 * Tidak menghukum matan database yang jauh lebih panjang dari teks pencarian,
 * sangat cocok untuk skenario substring / pencocokan sebagian.
 * @param {Object} queryVec
 * @param {Object} docVec
 * @returns {number} Skor antara 0.0 - 1.0
 */
function queryCoverageSimilarity(queryVec, docVec) {
  let overlapWeight = 0;
  let queryTotalWeight = 0;

  for (const term in queryVec) {
    queryTotalWeight += queryVec[term];
    if (docVec[term]) { // Jika dokumen memiliki kata yang dicari
      overlapWeight += queryVec[term];
    }
  }

  if (queryTotalWeight === 0) return 0;
  return overlapWeight / queryTotalWeight;
}

/**
 * Menentukan status akhir berdasarkan skor Cosine Similarity.
 * > 0.8  → SHAHIH / Ditemukan
 * >= 0.5 → PERLU_REVIEW
 * < 0.5  → TIDAK_DITEMUKAN
 * @param {number} score
 * @returns {{ status: string, label: string, tier: string }}
 */
function getStatus(score) {
  if (score > 0.8) {
    return { status: 'SHAHIH', label: 'Shahih / Ditemukan', tier: 'found' };
  }
  if (score >= 0.5) {
    return { status: 'PERLU_REVIEW', label: 'Perlu Review', tier: 'review' };
  }
  return { status: 'TIDAK_DITEMUKAN', label: 'Tidak Ditemukan / Terindikasi Palsu', tier: 'notfound' };
}

module.exports = {
  extractMatan,
  preprocessText,
  correctTypos,
  buildIdf,
  vectorize,
  cosineSimilarity,
  queryCoverageSimilarity,
  getStatus,
};
