import { Database as SqlJsDatabase } from 'sql.js'
import { LogEntry, Session, Bookmark } from '../../shared/types'
import { getDatabase } from './Database'

export class LogStore {
  private db: SqlJsDatabase | null = null

  async init(): Promise<void> {
    this.db = await getDatabase()
  }

  private ensureDb(): SqlJsDatabase {
    if (!this.db) throw new Error('Database not initialized. Call init() first.')
    return this.db
  }

  insertBatch(logs: LogEntry[], sessionId: number): void {
    const db = this.ensureDb()
    const stmt = db.prepare(
      `INSERT INTO logs (session_id, timestamp, pid, tid, level, tag, message, device_serial, raw)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const log of logs) {
      stmt.run([sessionId, log.timestamp, log.pid, log.tid, log.level, log.tag, log.message, log.deviceSerial, log.raw])
    }
    stmt.free()
  }

  search(query: string, options?: {
    limit?: number; offset?: number; level?: string; deviceSerial?: string
  }): any[] {
    const db = this.ensureDb()
    const limit = options?.limit || 100
    const offset = options?.offset || 0

    let sql = ''
    const params: any[] = []

    if (query && query.trim()) {
      // Use FTS5 for fast searching
      sql = `SELECT l.* FROM logs l 
             JOIN logs_fts f ON l.id = f.rowid 
             WHERE logs_fts MATCH ?`
      params.push(query.trim())
    } else {
      sql = `SELECT * FROM logs WHERE 1=1`
    }

    if (options?.level) {
      sql += ' AND level = ?'
      params.push(options.level)
    }
    if (options?.deviceSerial) {
      sql += ' AND device_serial = ?'
      params.push(options.deviceSerial)
    }
    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    return this.queryAll(sql, params)
  }

  getByTimeRange(start: string, end: string, options?: {
    limit?: number; offset?: number
  }): any[] {
    const limit = options?.limit || 500
    const offset = options?.offset || 0
    return this.queryAll(
      `SELECT * FROM logs WHERE timestamp >= ? AND timestamp <= ? ORDER BY id ASC LIMIT ? OFFSET ?`,
      [start, end, limit, offset]
    )
  }

  getByDevice(serial: string, options?: {
    limit?: number; offset?: number
  }): any[] {
    const limit = options?.limit || 500
    const offset = options?.offset || 0
    return this.queryAll(
      `SELECT * FROM logs WHERE device_serial = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
      [serial, limit, offset]
    )
  }

  exportLogs(format: 'txt' | 'csv' | 'json', filter?: {
    sessionId?: number; deviceSerial?: string; level?: string
  }): string {
    let sql = 'SELECT * FROM logs WHERE 1=1'
    const params: any[] = []

    if (filter?.sessionId) {
      sql += ' AND session_id = ?'
      params.push(filter.sessionId)
    }
    if (filter?.deviceSerial) {
      sql += ' AND device_serial = ?'
      params.push(filter.deviceSerial)
    }
    if (filter?.level) {
      sql += ' AND level = ?'
      params.push(filter.level)
    }
    sql += ' ORDER BY id ASC'

    const rows = this.queryAll(sql, params)

    switch (format) {
      case 'json':
        return JSON.stringify(rows, null, 2)
      case 'csv': {
        const header = 'id,timestamp,pid,tid,level,tag,message,device_serial'
        const lines = rows.map((r: any) =>
          `${r.id},"${r.timestamp}",${r.pid},${r.tid},${r.level},"${(r.tag || '').replace(/"/g, '""')}","${(r.message || '').replace(/"/g, '""')}","${r.device_serial}"`
        )
        return [header, ...lines].join('\n')
      }
      case 'txt':
      default:
        return rows.map((r: any) => r.raw || `${r.timestamp} ${r.pid} ${r.tid} ${r.level} ${r.tag}: ${r.message}`).join('\n')
    }
  }

  createSession(name: string, deviceSerial: string, deviceName: string): number {
    const db = this.ensureDb()
    db.run(
      `INSERT INTO sessions (name, device_serial, device_name) VALUES (?, ?, ?)`,
      [name, deviceSerial, deviceName]
    )
    const result = db.exec('SELECT last_insert_rowid() as id')
    return result[0]?.values[0]?.[0] as number || 0
  }

  endSession(sessionId: number): void {
    this.ensureDb().run(
      `UPDATE sessions SET ended_at = datetime('now') WHERE id = ?`,
      [sessionId]
    )
  }

  getSessions(): Session[] {
    return this.queryAll('SELECT * FROM sessions ORDER BY started_at DESC', []) as Session[]
  }

  cleanOldData(days: number): number {
    const db = this.ensureDb()
    db.run(`DELETE FROM logs WHERE timestamp < datetime('now', '-' || ? || ' days')`, [days])
    return db.getRowsModified()
  }

  addBookmark(logId: number, note: string, color: string): number {
    const db = this.ensureDb()
    db.run(`INSERT INTO bookmarks (log_id, note, color) VALUES (?, ?, ?)`, [logId, note, color])
    const result = db.exec('SELECT last_insert_rowid() as id')
    return result[0]?.values[0]?.[0] as number || 0
  }

  removeBookmark(id: number): void {
    this.ensureDb().run('DELETE FROM bookmarks WHERE id = ?', [id])
  }

  getBookmarks(): Bookmark[] {
    return this.queryAll(
      `SELECT b.id, b.log_id as logId, b.note, b.color, b.created_at as createdAt
       FROM bookmarks b ORDER BY b.created_at DESC`,
      []
    ) as Bookmark[]
  }

  updateBookmark(id: number, note: string, color: string): void {
    this.ensureDb().run(`UPDATE bookmarks SET note = ?, color = ? WHERE id = ?`, [note, color, id])
  }

  private queryAll(sql: string, params: any[]): any[] {
    const db = this.ensureDb()
    const results: any[] = []
    const stmt = db.prepare(sql)
    stmt.bind(params)
    while (stmt.step()) {
      results.push(stmt.getAsObject())
    }
    stmt.free()
    return results
  }
}
