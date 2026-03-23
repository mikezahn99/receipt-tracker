/**
 * Storage layer for the Receipt Expense Tracker.
 *
 * All database operations go through the IStorage interface so the rest
 * of the app never talks to the DB directly.  This keeps routes thin
 * and makes future changes (e.g., swapping SQLite for Postgres) easy.
 */

import {
  type Job,
  type InsertJob,
  type Receipt,
  type InsertReceipt,
  jobs,
  receipts,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

// Open (or create) the SQLite file in the project root
const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL"); // better concurrent-read performance

export const db = drizzle(sqlite);

// ────────────────────────────────────────────
// Storage interface
// ────────────────────────────────────────────
export interface IStorage {
  // Jobs
  getJobs(): Promise<Job[]>;
  getActiveJobs(): Promise<Job[]>;
  getJob(id: number): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: number, job: Partial<InsertJob>): Promise<Job | undefined>;

  // Receipts
  getReceipts(filters?: {
    startDate?: string;
    endDate?: string;
    jobId?: number;
    category?: string;
  }): Promise<Receipt[]>;
  getReceipt(id: number): Promise<Receipt | undefined>;
  createReceipt(receipt: InsertReceipt): Promise<Receipt>;
}

export class DatabaseStorage implements IStorage {
  // ── Jobs ──────────────────────────────────

  async getJobs(): Promise<Job[]> {
    return db.select().from(jobs).all();
  }

  async getActiveJobs(): Promise<Job[]> {
    return db.select().from(jobs).where(eq(jobs.status, "Active")).all();
  }

  async getJob(id: number): Promise<Job | undefined> {
    return db.select().from(jobs).where(eq(jobs.id, id)).get();
  }

  async createJob(job: InsertJob): Promise<Job> {
    return db.insert(jobs).values(job).returning().get();
  }

  async updateJob(id: number, job: Partial<InsertJob>): Promise<Job | undefined> {
    return db.update(jobs).set(job).where(eq(jobs.id, id)).returning().get();
  }

  // ── Receipts ──────────────────────────────

  /**
   * Retrieve receipts with optional filters.
   * Filters:
   *   - startDate / endDate: filter by purchaseDate (YYYY-MM-DD strings)
   *   - jobId: filter to a specific job
   *   - category: "Fuel" or "Other"
   */
  async getReceipts(filters?: {
    startDate?: string;
    endDate?: string;
    jobId?: number;
    category?: string;
  }): Promise<Receipt[]> {
    const conditions = [];

    if (filters?.startDate) {
      conditions.push(gte(receipts.purchaseDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(receipts.purchaseDate, filters.endDate));
    }
    if (filters?.jobId) {
      conditions.push(eq(receipts.jobId, filters.jobId));
    }
    if (filters?.category) {
      conditions.push(eq(receipts.category, filters.category));
    }

    if (conditions.length > 0) {
      return db
        .select()
        .from(receipts)
        .where(and(...conditions))
        .orderBy(desc(receipts.createdAt))
        .all();
    }

    return db.select().from(receipts).orderBy(desc(receipts.createdAt)).all();
  }

  async getReceipt(id: number): Promise<Receipt | undefined> {
    return db.select().from(receipts).where(eq(receipts.id, id)).get();
  }

  async createReceipt(receipt: InsertReceipt): Promise<Receipt> {
    return db.insert(receipts).values(receipt).returning().get();
  }
}

export const storage = new DatabaseStorage();

// ────────────────────────────────────────────
// Seed data – creates example jobs if the table is empty.
// Runs once at server start.
// ────────────────────────────────────────────
export function seedDatabase() {
  const existingJobs = db.select().from(jobs).all();
  if (existingJobs.length === 0) {
    const seedJobs: InsertJob[] = [
      { jobName: "Highway Bridge Repair – Route 9", status: "Active" },
      { jobName: "Municipal Building Renovation", status: "Active" },
      { jobName: "Warehouse Construction – Lot 14", status: "Active" },
      { jobName: "Office Park Landscaping", status: "Active" },
      { jobName: "Old Millwork Project (Completed)", status: "Inactive" },
    ];
    for (const job of seedJobs) {
      db.insert(jobs).values(job).run();
    }
    console.log(`[seed] Inserted ${seedJobs.length} example jobs.`);
  }
}
