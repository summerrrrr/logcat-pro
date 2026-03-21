import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'

let db: SqlJsDatabase | null = null
let dbPath: string = ''
let saveTimer: ReturnType<typeof setInterval> | null = null

export async function getDatabase(): Promise<SqlJsDatabase> {
  if (db) return db

  const SQL = await initSqlJs()
  dbPath = join(app.getPath('userData'), 'logcat-pro.db')

  const dir = dirname(dbPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  initTables(db)

  // Auto-save every 10 seconds
  saveTimer = setInterval(() => {
    saveDatabase()
  }, 10000)

  return db
}

function initTables(db: SqlJsDatabase): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      device_serial TEXT NOT NULL,
      device_name TEXT DEFAULT '',
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      timestamp TEXT NOT NULL,
      pid INTEGER,
      tid INTEGER,
      level TEXT NOT NULL,
      tag TEXT DEFAULT '',
      message TEXT DEFAULT '',
      device_serial TEXT NOT NULL,
      raw TEXT DEFAULT '',
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_session ON logs(session_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_tag ON logs(tag)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_device ON logs(device_serial)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)`)

  // Create FTS5 virtual table for fast searching
  db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS logs_fts USING fts5(
      tag,
      message,
      content='logs',
      content_rowid='id'
    )
  `)

  // Triggers to keep FTS index in sync
  db.run(`
    CREATE TRIGGER IF NOT EXISTS logs_ai AFTER INSERT ON logs BEGIN
      INSERT INTO logs_fts(rowid, tag, message) VALUES (new.id, new.tag, new.message);
    END
  `)

  db.run(`
    CREATE TRIGGER IF NOT EXISTS logs_ad AFTER DELETE ON logs BEGIN
      INSERT INTO logs_fts(logs_fts, rowid, tag, message) VALUES('delete', old.id, old.tag, old.message);
    END
  `)

  db.run(`
    CREATE TRIGGER IF NOT EXISTS logs_au AFTER UPDATE ON logs BEGIN
      INSERT INTO logs_fts(logs_fts, rowid, tag, message) VALUES('delete', old.id, old.tag, old.message);
      INSERT INTO logs_fts(rowid, tag, message) VALUES (new.id, new.tag, new.message);
    END
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      log_id INTEGER NOT NULL,
      note TEXT DEFAULT '',
      color TEXT DEFAULT '#FFD700',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (log_id) REFERENCES logs(id)
    )
  `)
}

export function saveDatabase(): void {
  if (db && dbPath) {
    try {
      const data = db.export()
      writeFileSync(dbPath, Buffer.from(data))
    } catch (e) {
      console.error('[Database] Save failed:', e)
    }
  }
}

export function closeDatabase(): void {
  if (saveTimer) {
    clearInterval(saveTimer)
    saveTimer = null
  }
  if (db) {
    saveDatabase()
    db.close()
    db = null
  }
}
