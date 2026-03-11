/**
 * Manual implementation of Jaro Similarity.
 * Calculates similarity between two strings from 0.0 (no match) to 1.0 (exact match).
 * @param {string} s1 
 * @param {string} s2 
 * @returns {number} Score between 0.0 and 1.0
 */
function jaroSimilarity(s1, s2) {
  if (s1 === s2) return 1.0;
  
  const len1 = s1.length;
  const len2 = s2.length;
  
  if (len1 === 0 || len2 === 0) return 0.0;
  
  // Maximum distance up to which matching characters are considered
  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);
  
  let matches = 0;
  
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    
    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  
  if (matches === 0) return 0.0;
  
  let transpositions = 0;
  let k = 0;
  
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  transpositions /= 2;
  
  return ((matches / len1) + (matches / len2) + ((matches - transpositions) / matches)) / 3.0;
}

/**
 * Manual implementation of Jaro-Winkler Similarity.
 * Gives favorable ratings to strings that match from the beginning.
 * @param {string} s1 
 * @param {string} s2 
 * @param {number} scalingFactor - generally 0.1
 * @returns {number} Score between 0.0 and 1.0
 */
function jaroWinklerSimilarity(s1, s2, scalingFactor = 0.1) {
  let jaro = jaroSimilarity(s1, s2);
  let prefix = 0;
  
  // Calculate common prefix up to 4 characters
  for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
    if (s1[i] === s2[i]) {
      prefix++;
    } else {
      break;
    }
  }
  
  return jaro + (prefix * scalingFactor * (1.0 - jaro));
}

/**
 * Normalizes text to improve similarity accuracy
 * Lowercase, removing punctuation, trimming spaces
 */
function normalizeQuery(text) {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  jaroSimilarity,
  jaroWinklerSimilarity,
  normalizeQuery
};
