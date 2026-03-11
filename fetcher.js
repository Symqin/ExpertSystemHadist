const { initDb } = require('./database');

const API_BASE = 'https://api.hadith.gading.dev/books';
const CHUNK_SIZE = 300; // API usually supports max 300 per request
const DELAY_MS = 1000;

function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const delay = ms => new Promise(res => setTimeout(res, ms));

async function fetchBooks() {
  const res = await fetch(API_BASE);
  const json = await res.json();
  return json.data;
}

async function fetchAndStore(db, book) {
  const total = book.available;
  console.log(`Starting to fetch book: ${book.name} (${total} hadiths)`);
  
  for (let start = 1; start <= total; start += CHUNK_SIZE) {
    let end = start + CHUNK_SIZE - 1;
    if (end > total) end = total;
    
    console.log(`  Fetching ${book.id} range ${start}-${end}...`);
    try {
      const res = await fetch(`${API_BASE}/${book.id}?range=${start}-${end}`);
      const json = await res.json();
      
      const hadiths = json.data.hadiths;
      
      // Use transactions for faster bulk inserts
      await db.exec('BEGIN TRANSACTION');
      for (const h of hadiths) {
        // API puts Indonesian translation in 'id' field, and arabic in 'arab'
        const translationText = h.id || '';
        const normalized = normalizeText(translationText);
        await db.run(
          `INSERT INTO hadiths (book_id, number, arab, translation, normalized_text) VALUES (?, ?, ?, ?, ?)`,
          [book.id, h.number, h.arab, translationText, normalized]
        );
      }
      await db.exec('COMMIT');
      
      await delay(DELAY_MS);
    } catch (err) {
      console.error(`  Error fetching range ${start}-${end}:`, err);
      // rollback in case of error
      try { await db.exec('ROLLBACK'); } catch(e) {}
    }
  }
}

async function main() {
  const db = await initDb();
  console.log('Fetching available books list...');
  const books = await fetchBooks();
  
  for (const book of books) {
    await fetchAndStore(db, book);
  }
  
  console.log('Finished populating database.');
  await db.close();
  process.exit(0);
}

main().catch(console.error);
