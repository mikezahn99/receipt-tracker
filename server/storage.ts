import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import type { InsertJob, InsertReceipt, Job, Receipt } from "@shared/schema";

export interface IStorage {
  getJobs(): Promise<Job[]>;
  getActiveJobs(): Promise<Job[]>;
  getJob(id: number): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: number, job: Partial<InsertJob>): Promise<Job | undefined>;

  getReceipts(filters?: {
    startDate?: string;
    endDate?: string;
    jobId?: number;
    category?: string;
  }): Promise<Receipt[]>;
  getReceipt(id: number): Promise<Receipt | undefined>;
  createReceipt(receipt: InsertReceipt): Promise<Receipt>;
  updateReceipt(id: number, receipt: Partial<InsertReceipt>): Promise<Receipt | undefined>;
  deleteReceipt(id: number): Promise<boolean>;
}

const dataDir = process.env.DATA_DIR || process.cwd();
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "data.db");
const sqlite = new Database(dbPath);

// Helpful when multiple reads/writes happen
sqlite.pragma("journal_mode = WAL");

// Create tables if they do not exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active'
  );

  CREATE TABLE IF NOT EXISTS receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    image_path TEXT,
    merchant TEXT,
    purchase_date TEXT,
    total REAL,
    category TEXT NOT NULL DEFAULT 'Other',
    gallons REAL,
    job_id INTEGER NOT NULL,
    raw_ocr_text TEXT,
    notes TEXT,
    FOREIGN KEY (job_id) REFERENCES jobs(id)
  );
`);

class SQLiteStorage implements IStorage {
  async getJobs(): Promise<Job[]> {
    const rows = sqlite
      .prepare(
        `
        SELECT
          id,
          job_name as jobName,
          status
        FROM jobs
        ORDER BY id DESC
        `
      )
      .all();

    return rows as Job[];
  }

  async getActiveJobs(): Promise<Job[]> {
    const rows = sqlite
      .prepare(
        `
        SELECT
          id,
          job_name as jobName,
          status
        FROM jobs
        WHERE status = 'Active'
        ORDER BY id DESC
        `
      )
      .all();

    return rows as Job[];
  }

  async getJob(id: number): Promise<Job | undefined> {
    const row = sqlite
      .prepare(
        `
        SELECT
          id,
          job_name as jobName,
          status
        FROM jobs
        WHERE id = ?
        `
      )
      .get(id);

    return row as Job | undefined;
  }

  async createJob(job: InsertJob): Promise<Job> {
    const result = sqlite
      .prepare(
        `
        INSERT INTO jobs (job_name, status)
        VALUES (?, ?)
        `
      )
      .run(job.jobName, job.status ?? "Active");

    return {
      id: Number(result.lastInsertRowid),
      jobName: job.jobName,
      status: job.status ?? "Active",
    };
  }

  async updateJob(id: number, job: Partial<InsertJob>): Promise<Job | undefined> {
    const existing = await this.getJob(id);
    if (!existing) return undefined;

    const nextJobName = job.jobName ?? existing.jobName;
    const nextStatus = job.status ?? existing.status;

    sqlite
      .prepare(
        `
        UPDATE jobs
        SET job_name = ?, status = ?
        WHERE id = ?
        `
      )
      .run(nextJobName, nextStatus, id);

    return {
      id,
      jobName: nextJobName,
      status: nextStatus,
    };
  }

  async getReceipts(filters?: {
    startDate?: string;
    endDate?: string;
    jobId?: number;
    category?: string;
  }): Promise<Receipt[]> {
    let sql = `
      SELECT
        id,
        created_at as createdAt,
        image_path as imagePath,
        merchant,
        purchase_date as purchaseDate,
        total,
        category,
        gallons,
        job_id as jobId,
        raw_ocr_text as rawOcrText,
        notes
      FROM receipts
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filters?.startDate) {
      sql += ` AND purchase_date >= ?`;
      params.push(filters.startDate);
    }

    if (filters?.endDate) {
      sql += ` AND purchase_date <= ?`;
      params.push(filters.endDate);
    }

    if (filters?.jobId) {
      sql += ` AND job_id = ?`;
      params.push(filters.jobId);
    }

    if (filters?.category && filters.category !== "All Categories") {
      sql += ` AND category = ?`;
      params.push(filters.category);
    }

    sql += ` ORDER BY purchase_date DESC, id DESC`;

    const rows = sqlite.prepare(sql).all(...params);
    return rows as Receipt[];
  }

  async getReceipt(id: number): Promise<Receipt | undefined> {
    const row = sqlite
      .prepare(
        `
        SELECT
          id,
          created_at as createdAt,
          image_path as imagePath,
          merchant,
          purchase_date as purchaseDate,
          total,
          category,
          gallons,
          job_id as jobId,
          raw_ocr_text as rawOcrText,
          notes
        FROM receipts
        WHERE id = ?
        `
      )
      .get(id);

    return row as Receipt | undefined;
  }

  async createReceipt(receipt: InsertReceipt): Promise<Receipt> {
    const result = sqlite
      .prepare(
        `
        INSERT INTO receipts (
          image_path,
          merchant,
          purchase_date,
          total,
          category,
          gallons,
          job_id,
          raw_ocr_text,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        receipt.imagePath ?? null,
        receipt.merchant ?? null,
        receipt.purchaseDate ?? null,
        receipt.total ?? null,
        receipt.category ?? "Other",
        receipt.gallons ?? null,
        receipt.jobId,
        receipt.rawOcrText ?? null,
        receipt.notes ?? null
      );

    const created = await this.getReceipt(Number(result.lastInsertRowid));
    if (!created) {
      throw new Error("Failed to create receipt");
    }

    return created;
  }
  
    async updateReceipt(
    id: number,
    receipt: Partial<InsertReceipt>
  ): Promise<Receipt | undefined> {
    const existing = await this.getReceipt(id);
    if (!existing) return undefined;

    const nextMerchant = receipt.merchant ?? existing.merchant;
    const nextPurchaseDate = receipt.purchaseDate ?? existing.purchaseDate;
    const nextTotal = receipt.total ?? existing.total;
    const nextCategory = receipt.category ?? existing.category;
    const nextGallons = receipt.gallons ?? existing.gallons;
    const nextJobId = receipt.jobId ?? existing.jobId;
    const nextNotes = receipt.notes ?? existing.notes;

    sqlite
      .prepare(
        `
        UPDATE receipts
        SET
          merchant = ?,
          purchase_date = ?,
          total = ?,
          category = ?,
          gallons = ?,
          job_id = ?,
          notes = ?
        WHERE id = ?
        `
      )
      .run(
        nextMerchant,
        nextPurchaseDate,
        nextTotal,
        nextCategory,
        nextGallons,
        nextJobId,
        nextNotes,
        id
      );

    return this.getReceipt(id);
  }
  
  async deleteReceipt(id: number): Promise<boolean> {
    const result = sqlite
      .prepare(
        `
        DELETE FROM receipts
        WHERE id = ?
        `
      )
      .run(id);

    return result.changes > 0;
  }
}

export const storage = new SQLiteStorage();

export function seedDatabase() {
  const countRow = sqlite
    .prepare(`SELECT COUNT(*) as count FROM jobs`)
    .get() as { count: number };

  if (countRow.count === 0) {
    sqlite
      .prepare(
        `
        INSERT INTO jobs (job_name, status)
        VALUES
          ('Demo Job 1', 'Active'),
          ('Demo Job 2', 'Active')
        `
      )
      .run();
  }

  console.log(`Using SQLite database at ${dbPath}`);
}
