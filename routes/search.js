const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../database');
const { normalizeQuery } = require('../similarity');
const {
  extractMatan,
  preprocessText,
  correctTypos,
  buildIdf,
  vectorize,
  cosineSimilarity,
  queryCoverageSimilarity,
  getStatus,
} = require('../nlp');
const { evaluateExpertLayer, evaluateInteractiveQuestionnaire } = require('../knowledge_base');

router.post('/', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: 'Text input parameter is required' });
    }

    const rawNormalized = normalizeQuery(text);
    if (!rawNormalized) {
      return res.status(400).json({ success: false, error: 'Text must contain valid letters/numbers' });
    }

    // ── TAHAP: Hybrid NLP (TF-IDF + Cosine Similarity) ───────────────────────
    const db = await getDbConnection();
    const hadiths = await db.all('SELECT * FROM hadiths');

    if (hadiths.length === 0) {
      return res.json({
        success: false,
        error: 'Database kosong. Jalankan fetcher.js terlebih dahulu.',
      });
    }

    // 2a. Tokenisasi corpus: ekstrak matan terlebih dahulu, lalu preprocess
    //     (gunakan h.translation agar extractMatan dapat mendeteksi tanda baca "berkata:")
    const corpusMatan = hadiths.map(h => extractMatan(h.translation));
    const corpusTokens = corpusMatan.map(matan => preprocessText(matan));

    // 2b. Bangun vocabulary dari corpus untuk typo correction
    const vocabulary = new Set();
    for (const tokens of corpusTokens) {
      for (const token of tokens) vocabulary.add(token);
    }

    // 2c. Preprocessing query + koreksi typo (Jaro-Winkler di level token)
    //     Ekstrak matan agar urutan sanad tidak mengganggu bobot TF-IDF.
    const queryMatan = extractMatan(text);
    const rawQueryTokens = preprocessText(queryMatan);
    const queryTokens = correctTypos(rawQueryTokens, vocabulary);

    if (queryTokens.length === 0) {
      return res.json({
        success: false,
        error: 'Teks query tidak mengandung kata bermakna setelah preprocessing.',
      });
    }

    // 2d. Hitung IDF dari corpus
    const idf = buildIdf(corpusTokens);

    // 2e. Vektorisasi query dengan TF-IDF
    const queryVector = vectorize(queryTokens, idf);

    const normalizedQueryMatan = normalizeQuery(queryMatan);

    // 2f. Hitung Cosine Similarity query vs setiap hadits
    const results = [];
    for (let i = 0; i < hadiths.length; i++) {
      const h = hadiths[i];
      const docVector = vectorize(corpusTokens[i], idf);
      const cosineScore = cosineSimilarity(queryVector, docVector);
      const overlapScore = queryCoverageSimilarity(queryVector, docVector);
      const normalizedDocMatan = normalizeQuery(corpusMatan[i]);

      // Gabungkan skor Cosine murni (global document match) dan Overlap murni (substring/partial match)
      // Memberi bobot lebih dominan pada Overlap (60%) agar user tidak dihukum bila matannya sangat panjang.
      let score = (cosineScore * 0.4) + (overlapScore * 0.6);

      if (normalizedQueryMatan && normalizedDocMatan) {
        if (normalizedDocMatan.includes(normalizedQueryMatan) || normalizedQueryMatan.includes(normalizedDocMatan)) {
          score = Math.max(score, 0.95);
        }
      }

      results.push({
        book_id: h.book_id,
        number: h.number,
        arab: h.arab,
        translation: h.translation,
        score,
      });
    }

    // 2g. Urutkan descending berdasarkan skor tertinggi
    results.sort((a, b) => b.score - a.score);

    // 2h. Ambil top 5 dan terapkan thresholding status
    const topMatches = results.slice(0, 5).map(r => {
      const statusInfo = getStatus(r.score);
      return {
        ...r,
        score: parseFloat(r.score.toFixed(4)),
        status: statusInfo.status,
        interpretation: statusInfo.label,
        tier: statusInfo.tier,
      };
    });

    const best = topMatches[0];
    const bestStatusInfo = getStatus(best.score);

    const expertResult = evaluateExpertLayer({
      queryText: text,
      queryMatan,
      bestMatch: best,
      topMatches,
      overallTier: bestStatusInfo.tier,
    });

    res.json({
      success: true,
      bestMatch: best,
      topMatches,
      confidenceScore: best.score,
      overallStatus: bestStatusInfo.status,
      overallTier: bestStatusInfo.tier,
      expertStatus: expertResult.expertStatus,
      expertLabel: expertResult.expertLabel,
      expertConfidenceBand: expertResult.confidenceBand,
      expertReasons: expertResult.reasons,
      expertRulesFired: expertResult.rulesFired,
    });

  } catch (error) {
    console.error('Search POST error:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// ── ENDPOINT BARU: Evaluasi Kuesioner Interaktif (M1 - M5) ────────────
router.post('/evaluate-questionnaire', (req, res) => {
  try {
    const { m1, m2, m3, m4, m5 } = req.body;

    // Memastikan data yang dikirim adalah boolean
    const answers = {
      m1: Boolean(m1),
      m2: Boolean(m2),
      m3: Boolean(m3),
      m4: Boolean(m4),
      m5: Boolean(m5)
    };

    // Jalankan Rule R8 - R12
    const expertResult = evaluateInteractiveQuestionnaire(answers);

    res.json({
      success: true,
      expertStatus: expertResult.expertStatus,
      expertLabel: expertResult.expertLabel,
      expertReason: expertResult.reason,
      expertRulesFired: expertResult.rulesFired
    });
  } catch (error) {
    console.error('Evaluate Questionnaire POST error:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;
