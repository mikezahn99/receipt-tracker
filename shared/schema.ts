/**
 * Database schema for the Receipt Expense Tracker.
 */

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ────────────────────────────────────────────
// USERS TABLE
// ────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  // THE FIX: Removed .default("") to bypass the SQLite quote bug. 
  // They will naturally default to null safely.
  fullName: text("full_name"),
  email: text("email"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ────────────────────────────────────────────
// JOBS TABLE
// ────────────────────────────────────────────
export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobName: text("job_name").notNull(),
  status: text("status").notNull().default("Active"),
  // THE FIX: Add the Owner Tag. Null = Company Job. Number = Personal Truck.
  userId: integer("user_id"),
});

export const insertJobSchema = createInsertSchema(jobs)
  .omit({ id: true })
  .extend({
    jobName: z.string().min(1, "Job name is required"),
    status: z.string().default("Active"),
    userId: z.number().nullable().optional(),
  });

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

// ────────────────────────────────────────────
// RECEIPTS TABLE
// ────────────────────────────────────────────
export const receipts = sqliteTable("receipts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  imagePath: text("image_path"),
  merchant: text("merchant"),
  purchaseDate: text("purchase_date"),
  total: real("total"),
  category: text("category").notNull().default("Other"),
  gallons: real("gallons"),
  userId: integer("user_id").notNull(),
  jobId: integer("job_id").notNull(),
  rawOcrText: text("raw_ocr_text"),
  notes: text("notes"),
});

export const insertReceiptSchema = createInsertSchema(receipts)
  .omit({ id: true, createdAt: true, userId: true })
  .extend({
    total: z.number().positive("Total must be a positive number").nullable().optional(),
    gallons: z.number().positive("Gallons must be a positive number").nullable().optional(),
    jobId: z.number().min(1, "You must select a job"),
  });

export type InsertReceipt = z.infer<typeof insertReceiptSchema>;
export type Receipt = typeof receipts.$inferSelect;
