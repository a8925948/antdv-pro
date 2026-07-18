import type mysql from 'mysql2/promise'
import { normalizePagination, paginateRows } from '../services/pagination'
import { resolveRuntimeJsonDataFile } from './data-paths'
import { readJsonFile, writeJsonFile } from './json-store'
import { getMysqlPool, isDatabaseRequired, withMysqlTransaction } from './mysql'

export interface TradeOrderRecord {
  code: string
  [key: string]: any
}

const dataFile = resolveRuntimeJsonDataFile('trade-orders.json')

function normalizeRows(rows: unknown): TradeOrderRecord[] {
  return Array.isArray(rows)
    ? rows.filter((row): row is TradeOrderRecord => !!row && typeof row === 'object' && !!(row as any).code)
    : []
}

export const tradeOrderStore = {
  async list() {
    const db = getMysqlPool()
    if (db) {
      await ensureTradeOrderSchema(db)
      const [rows] = await db.query<mysql.RowDataPacket[]>(`
        SELECT order_json
        FROM trade_order
        WHERE deleted_at IS NULL
        ORDER BY id DESC
      `)
      return normalizeRows(rows.map((row: any) => typeof row.order_json === 'string' ? JSON.parse(row.order_json) : row.order_json))
    }

    if (isDatabaseRequired())
      throw new Error('数据库为必需配置，贸易订单禁止读取本地 JSON')
    return normalizeRows(readJsonFile<TradeOrderRecord[]>(dataFile, []))
  },

  async listPage(current: unknown, pageSize: unknown) {
    const page = normalizePagination(current, pageSize)
    const db = getMysqlPool()
    if (db) {
      await ensureTradeOrderSchema(db)
      const [[countRow], [rows]] = await Promise.all([
        db.query<Array<mysql.RowDataPacket & { total: number }>>('SELECT COUNT(*) AS total FROM trade_order WHERE deleted_at IS NULL'),
        db.query<mysql.RowDataPacket[]>('SELECT order_json FROM trade_order WHERE deleted_at IS NULL ORDER BY id DESC LIMIT ? OFFSET ?', [page.pageSize, page.offset]),
      ])
      return {
        records: normalizeRows(rows.map((row: any) => typeof row.order_json === 'string' ? JSON.parse(row.order_json) : row.order_json)),
        total: Number(countRow[0]?.total || 0),
        current: page.current,
        pageSize: page.pageSize,
      }
    }
    if (isDatabaseRequired())
      throw new Error('数据库为必需配置，贸易订单禁止读取本地 JSON')
    return paginateRows(normalizeRows(readJsonFile<TradeOrderRecord[]>(dataFile, [])), page.current, page.pageSize)
  },

  async replace(rows: unknown) {
    const data = normalizeRows(rows)
    const db = getMysqlPool()
    if (db) {
      await ensureTradeOrderSchema(db)
      await withMysqlTransaction(db, async (connection) => {
        await connection.execute('UPDATE trade_order SET deleted_at = NOW() WHERE deleted_at IS NULL')
        for (const row of data) {
          await connection.execute(`
          INSERT INTO trade_order (code, order_json, created_at, updated_at, deleted_at)
          VALUES (?, CAST(? AS JSON), NOW(), NOW(), NULL)
          ON DUPLICATE KEY UPDATE order_json = VALUES(order_json), updated_at = NOW(), deleted_at = NULL
        `, [row.code, JSON.stringify(row)])
        }
      })
      return data
    }

    if (isDatabaseRequired())
      throw new Error('数据库为必需配置，贸易订单禁止写入本地 JSON')
    writeJsonFile(dataFile, data)
    return data
  },

  async applyChanges(input: { upsert?: unknown, deleteCodes?: unknown }) {
    const upsert = normalizeRows(input.upsert)
    const deleteCodes = Array.isArray(input.deleteCodes)
      ? [...new Set(input.deleteCodes.map(String).map(value => value.trim()).filter(Boolean))]
      : []
    const db = getMysqlPool()
    if (db) {
      await ensureTradeOrderSchema(db)
      await withMysqlTransaction(db, async (connection) => {
        for (const code of deleteCodes) {
          await connection.execute('UPDATE trade_order SET deleted_at = NOW() WHERE code = ? AND deleted_at IS NULL', [code])
          await connection.execute('INSERT INTO trade_order_revision (order_code, action, snapshot_json, created_at) VALUES (?, ?, NULL, NOW())', [code, 'delete'])
        }
        for (const row of upsert) {
          await connection.execute(`
            INSERT INTO trade_order (code, order_json, status, loading_date, amount, created_at, updated_at, deleted_at)
            VALUES (?, CAST(? AS JSON), ?, ?, ?, NOW(), NOW(), NULL)
            ON DUPLICATE KEY UPDATE order_json = VALUES(order_json), status = VALUES(status), loading_date = VALUES(loading_date), amount = VALUES(amount), updated_at = NOW(), deleted_at = NULL
          `, [row.code, JSON.stringify(row), row.status || null, row.loadingDate || null, Number(row.receivableLiquidTotal || row.payableTotal || 0)])
          await connection.execute('INSERT INTO trade_order_revision (order_code, action, snapshot_json, created_at) VALUES (?, ?, CAST(? AS JSON), NOW())', [row.code, 'upsert', JSON.stringify(row)])
        }
      })
      return this.list()
    }
    if (isDatabaseRequired())
      throw new Error('数据库为必需配置，贸易订单禁止写入本地 JSON')
    const current = await this.list()
    const deleted = new Set(deleteCodes)
    const byCode = new Map(current.filter(row => !deleted.has(row.code)).map(row => [row.code, row]))
    upsert.forEach(row => byCode.set(row.code, row))
    const data = [...byCode.values()]
    writeJsonFile(dataFile, data)
    return data
  },
}

async function ensureTradeOrderSchema(db: mysql.Pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS trade_order (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      code VARCHAR(128) NOT NULL UNIQUE,
      order_json JSON NOT NULL,
      status VARCHAR(64) NULL,
      loading_date DATE NULL,
      amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      KEY idx_trade_order_deleted (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await ensureColumn(db, 'trade_order', 'status', 'VARCHAR(64) NULL')
  await ensureColumn(db, 'trade_order', 'loading_date', 'DATE NULL')
  await ensureColumn(db, 'trade_order', 'amount', 'DECIMAL(18,2) NOT NULL DEFAULT 0')
  await db.query(`
    CREATE TABLE IF NOT EXISTS trade_order_revision (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      order_code VARCHAR(128) NOT NULL,
      action VARCHAR(32) NOT NULL,
      snapshot_json JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_trade_order_revision_code (order_code, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

async function ensureColumn(db: mysql.Pool, table: string, column: string, definition: string) {
  try {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
  catch (error: any) {
    if (error?.code !== 'ER_DUP_FIELDNAME')
      throw error
  }
}
