/**
 * Database Abstraction Layer
 *
 * Supports both PostgreSQL (production) and SQLite (local dev)
 * Switch via USE_POSTGRES=true in .env
 */

const USE_POSTGRES = process.env.USE_POSTGRES === 'true';

let db;

if (USE_POSTGRES) {
  // PostgreSQL for production
  const { Pool } = require('pg');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  db = {
    query: async (text, params) => {
      const result = await pool.query(text, params);
      return result.rows;
    },
    prepare: (sql) => ({
      run: async (...params) => {
        await pool.query(sql, params);
      },
      get: async (...params) => {
        const result = await pool.query(sql, params);
        return result.rows[0];
      },
      all: async (...params) => {
        const result = await pool.query(sql, params);
        return result.rows;
      }
    }),
    exec: async (sql) => {
      await pool.query(sql);
    },
    pool
  };

  console.log('[DB] Using PostgreSQL');
} else {
  // SQLite for local development
  const Database = require('better-sqlite3');
  const path = require('path');

  const sqliteDb = new Database(path.join(__dirname, '../../data/app.db'));
  sqliteDb.pragma('journal_mode = WAL');

  db = {
    query: (sql, params = []) => {
      return sqliteDb.prepare(sql).all(...params);
    },
    prepare: (sql) => {
      const stmt = sqliteDb.prepare(sql);
      return {
        run: (...params) => stmt.run(...params),
        get: (...params) => stmt.get(...params),
        all: (...params) => stmt.all(...params)
      };
    },
    exec: (sql) => sqliteDb.exec(sql),
    sqlite: sqliteDb
  };

  console.log('[DB] Using SQLite');
}

module.exports = db;
