const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function getDbConnection() {
  return open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });
}

async function initDb() {
  const db = await getDbConnection();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS hadiths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id TEXT,
      number INTEGER,
      arab TEXT,
      translation TEXT,
      normalized_text TEXT
    );
  `);
  console.log('Database and hadiths table initialized.');
  return db;
}

module.exports = {
  getDbConnection,
  initDb
};
