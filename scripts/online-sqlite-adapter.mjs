import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const migrations = fileURLToPath(new URL('../drizzle/', import.meta.url));

// A real SQLite adapter for tests and loopback-only online-edition previews.
// It exposes D1's prepared-statement and transactional-batch methods without
// imitating identity dispatch or contacting an inference provider.
export async function openOnlineSqlite({file = ':memory:', migrationsDir = migrations} = {}) {
  const sql = new DatabaseSync(file);
  sql.exec('CREATE TABLE IF NOT EXISTS preview_migrations (name TEXT PRIMARY KEY)');
  for (const name of (await fs.readdir(migrationsDir)).filter(name => name.endsWith('.sql')).sort()) {
    if (sql.prepare('SELECT name FROM preview_migrations WHERE name = ?').get(name)) continue;
    sql.exec('BEGIN');
    try {
      sql.exec(await fs.readFile(path.join(migrationsDir, name), 'utf8'));
      sql.prepare('INSERT INTO preview_migrations (name) VALUES (?)').run(name);
      sql.exec('COMMIT');
    } catch (error) { sql.exec('ROLLBACK'); sql.close(); throw error; }
  }
  const prepared = (query, params = []) => ({
    query, params,
    bind(...values) { return prepared(query, values); },
    async first() { return sql.prepare(query).get(...params) ?? null; },
    async all() { return {success: true, results: sql.prepare(query).all(...params)}; },
    async run() { const result = sql.prepare(query).run(...params); return {success: true, results: [], meta: {changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid)}}; },
  });
  const DB = {prepare: prepared, async batch(statements) {
    sql.exec('BEGIN');
    try {
      const results = statements.map(statement => ({success: true, results: sql.prepare(statement.query).all(...statement.params)}));
      sql.exec('COMMIT'); return results;
    } catch (error) { sql.exec('ROLLBACK'); throw error; }
  }};
  return {DB, sql, close: () => sql.close()};
}
