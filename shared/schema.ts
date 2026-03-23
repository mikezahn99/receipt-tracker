/**
 * Database schema for the Receipt Expense Tracker.
 *
 * Two tables:
 * 1. jobs   – predefined list of jobs/projects that receipts can be assigned to
 * 2. receipts – individual expense receipts with OCR-extracted data
 */

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ────────────────────────────────────────────
// JOBS TABLE
// Each job represents a project/contract that expenses can be assigned to.
// ────────────────────────────────────────────
export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobName: text("job_name").notNull(),
  /** "Active" or "Inactive" – only active jobs appear in the receipt form dropdown */
  status: text("status").notNull().default("Active"),
});

export const insertJobSchema = createInsertSchema(jobs).omit({ id: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

// ────────────────────────────────────────────
// RECEIPTS TABLE
// Stores each receipt entry along with OCR-extracted fields and the uploaded image path.
// ────────────────────────────────────────────
export const receipts = sqliteTable("receipts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** ISO timestamp of when the receipt was created in the system */
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  /** Path to the uploaded receipt image on disk (relative to uploads/) */
  imagePath: text("image_path"),
  /** Merchant / place of purchase (extracted from OCR or entered manually) */
  merchant: text("merchant"),
  /** Date of purchase as a string (YYYY-MM-DD), extracted from OCR or entered manually */
  purchaseDate: text("purchase_date"),
  /** Total cost of the receipt */
  total: real("total"),
  /** "Fuel" or "Other" — determined by OCR fuel-word detection or set manually */
  category: text("category").notNull().default("Other"),
  /** Total gallons (only relevant when category is "Fuel") */
  gallons: real("gallons"),
  /** Foreign key to the jobs table — every receipt must be assigned to a job */
  jobId: integer("job_id").notNull(),
  /** Full raw OCR text stored for debugging / reference */
  rawOcrText: text("raw_ocr_text"),
  /** Free-text description of items purchased */
  notes: text("notes"),
});

export const insertReceiptSchema = createInsertSchema(receipts)
  .omit({ id: true, createdAt: true })
  .extend({
    /** Total cost must be a positive number */
    total: z.number().positive("Total must be a positive number").nullable().optional(),
    /** Gallons must be positive when provided */
    gallons: z.number().positive("Gallons must be a positive number").nullable().optional(),
    /** Job selection is required */
    jobId: z.number().min(1, "You must select a job"),
  });

export type InsertReceipt = z.infer<typeof insertReceiptSchema>;
export type Receipt = typeof receipts.$inferSelect;
