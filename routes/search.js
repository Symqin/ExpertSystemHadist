const express = require('express');
const router = express.Router();
const { getDbConnection } = require('../database');
const { jaroWinklerSimilarity, normalizeQuery } = require('../similarity');
const { MAUDHU_RULES } = require('../knowledge_base');

function getInterpretation(score) {
  if (score >= 0.90) return "Sangat Mirip";
  if (score >= 0.85) return "Mirip";
  if (score >= 0.70) return "Kurang Mirip";
  return "Tidak ditemukan";
}

/**
 * Forward Chaining Logic System
 * Mengecek teks terhadap aturan (rules) pakar hadits palsu.
 */
function runForwardChaining(text) {
    const normalizedText = normalizeQuery(text);
    
    for (const rule of MAUDHU_RULES) {
        let matchedCount = 0;
        for (const keyword of rule.keywords) {
            // String match check (exact keyword in text)
            if (normalizedText.includes(normalizeQuery(keyword))) {
                matchedCount++;
            }
        }
        
        // Membandingkan jumlah kata kunci yang cocok dengan syarat Minimal (Threshold certainty)
        if (matchedCount >= rule.requiredMatches) {
            return rule; // Rule fired! (Terdeteksi maudhu)
        }
    }
    
    return null; // Rules gagal fired, matan kemungkinan asli atau palsu belum tercatat di KB
}

router.post('/', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: 'Text input parameter is required' });
    }

    const query = normalizeQuery(text);
    if (!query) {
       return res.status(400).json({ success: false, error: 'Text must contain valid letters/numbers' });
    }

    // 1. SISTEM PAKAR KEPALSUAN: Jalankan pengecekan Maudhu (Forward Chaining)
    const maudhuRuleMatched = runForwardChaining(text);
    if (maudhuRuleMatched) {
        return res.json({
            success: true,
            isFake: true,
            status: maudhuRuleMatched.status,
            reasoning: maudhuRuleMatched.reasoning,
            ruleId: maudhuRuleMatched.id
        });
    }

    // 2. FALLBACK SHAHIH: Jika bukan riwayat palsu populer, cari kemiripannya di DB Bukhari/Muslim dll.
    const db = await getDbConnection();

    // Fetch all hadiths to calculate similarity in backend
    const hadiths = await db.all('SELECT * FROM hadiths');
    
    if (hadiths.length === 0) {
      return res.json({ success: false, error: 'Database is empty. Please run fetcher.js script first.' });
    }

    // Calculate similarity against normalized_text
    const results = [];
    const queryWords = query.split(' ');

    for (const h of hadiths) {
      // 1. Base Jaro-Winkler Score
      let score = jaroWinklerSimilarity(query, h.normalized_text, 0.1);
      
      // 2. Exact substring match boost
      if (h.normalized_text.includes(query)) {
         score += 0.3; // Huge boost for exact phrase match
      } else {
         // 3. Word-level match boost
         let wordMatches = 0;
         for (const word of queryWords) {
             if (h.normalized_text.includes(word)) {
                 wordMatches++;
             }
         }
         if (wordMatches > 0) {
             score += (wordMatches / queryWords.length) * 0.15; // Proportional boost
         }
      }

      // Cap score at 1.0 MAX
      score = Math.min(score, 1.0);
      // Collecting all, though we could filter out completely irrelevant ones (e.g. < 0.3)
      // to save memory if dataset is huge, but here we just collect and sort
      results.push({
        book_id: h.book_id,
        number: h.number,
        arab: h.arab,
        translation: h.translation,
        score: score
      });
    }

    // Sort descending by highest similarity score
    results.sort((a, b) => b.score - a.score);

    // Take top 5 highest similarities
    const topMatches = results.slice(0, 5).map(r => ({
      ...r,
      score: r.score.toFixed(4),
      interpretation: getInterpretation(r.score)
    }));

    res.json({
      success: true,
      isFake: false, // Menandakan bahwa terdeteksi aman dari rules maudhu
      bestMatch: topMatches[0],
      topMatches: topMatches,
      confidenceScore: topMatches[0].score
    });

  } catch (error) {
    console.error('Search POST error:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;
