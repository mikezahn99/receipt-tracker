import { users, receipts, jobs, type User, type InsertUser, type Receipt, type InsertReceipt, type Job, type InsertJob } from "@shared/schema";
import { db } from "./db";
import { eq, or, isNull, and } from "drizzle-orm";
import session from "express-session";
import createSQLiteStore from "connect-sqlite3";
import bcrypt from "bcryptjs"; 

const SQLiteStore = createSQLiteStore(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  getReceipt(id: number): Promise<Receipt | undefined>;
  getReceipts(userId: number): Promise<Receipt[]>;
  getAllReceipts(): Promise<Receipt[]>;
  createReceipt(receipt: InsertReceipt & { userId: number }): Promise<Receipt>;
  updateReceipt(id: number, receipt: Partial<InsertReceipt>): Promise<Receipt | undefined>;
  deleteReceipt(id: number): Promise<boolean>;

  getJobs(userId: number, role: string): Promise<Job[]>;
  getJob(id: number): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  getActiveJobs(userId: number, role: string): Promise<Job[]>;
  updateJob(id: number, job: Partial<InsertJob>): Promise<Job | undefined>;
  
  // THE FIX: Add the delete blueprint
  deleteJob(id: number): Promise<boolean>;
  
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new SQLiteStore({ 
      dir: process.env.NODE_ENV === 'production' ? '/var/data' : './',
      db: "sessions.db" 
    });
    this.seedAdmin();
  }

private async seedAdmin() {
    try {
      // --- 1. Original Admin Account ---
      const [admin1] = await db.select().from(users).where(eq(users.username, "admin"));
      
      if (!admin1) {
        const hashed1 = await bcrypt.hash("changeme123", 10);
        // We explicitly stamp the role as "admin" so the security gates recognize it
        await this.createUser({ username: "admin", password: hashed1, password_hash: hashed1, role: "admin" } as any);
      }
      // (Notice we removed the "else" block! Now your password won't get reset every time the server restarts)

      // --- 2. New Secondary Admin Account ---
      const [admin2] = await db.select().from(users).where(eq(users.username, "Admin"));
      
      if (!admin2) {
        const hashed2 = await bcrypt.hash("Mvdcc123", 10);
        await this.createUser({ username: "Admin", password: hashed2, password_hash: hashed2, role: "admin" } as any);
      }

    } catch (error) {
      console.error("Error seeding admins:", error);
    }
  }

  // --- USER METHODS ---
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const dataToInsert: any = {
      ...insertUser,
      password_hash: (insertUser as any).password_hash || (insertUser as any).password,
      passwordHash: (insertUser as any).passwordHash || (insertUser as any).password
    };
    const [user] = await db.insert(users).values(dataToInsert).returning();
    return user;
  }
  
  async getAllUsers(): Promise<User[]> {
    // Grabs every user account in the database
    return await db.select().from(users);
  }
  
  // --- RECEIPT METHODS ---
  async getReceipt(id: number): Promise<Receipt | undefined> {
    const [receipt] = await db.select().from(receipts).where(eq(receipts.id, id));
    return receipt;
  }

  async getReceipts(userId: number): Promise<Receipt[]> {
    return await db.select().from(receipts).where(eq(receipts.userId, userId));
  }

  async getAllReceipts(): Promise<Receipt[]> {
    return await db.select().from(receipts);
  }
  
  async createReceipt(insertReceipt: InsertReceipt & { userId: number }): Promise<Receipt> {
    const [receipt] = await db.insert(receipts).values(insertReceipt).returning();
    return receipt;
  }

  async updateReceipt(id: number, update: Partial<InsertReceipt>): Promise<Receipt | undefined> {
    const [updated] = await db.update(receipts).set(update).where(eq(receipts.id, id)).returning();
    return updated;
  }

  async deleteReceipt(id: number): Promise<boolean> {
    await db.delete(receipts).where(eq(receipts.id, id));
    return true; 
  }

// --- JOB METHODS ---
  async getJobs(userId: number, role: string): Promise<Job[]> {
    if (role === "admin") {
      // Admin sees absolutely everything
      return await db.select().from(jobs);
    } else {
      // Crew only sees Company jobs (null) OR their own personal trucks
      return await db.select().from(jobs).where(
        or(isNull(jobs.userId), eq(jobs.userId, userId))
      );
    }
  }

  async getActiveJobs(userId: number, role: string): Promise<Job[]> {
    if (role === "admin") {
      return await db.select().from(jobs).where(eq(jobs.status, "Active"));
    } else {
      return await db.select().from(jobs).where(
        and(
          eq(jobs.status, "Active"),
          or(isNull(jobs.userId), eq(jobs.userId, userId))
        )
      );
    }
  }

  // THE FIX: Restoring the accidentally deleted tools!
  async getJob(id: number): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const [job] = await db.insert(jobs).values(insertJob).returning();
    return job;
  }

  async updateJob(id: number, update: Partial<InsertJob>): Promise<Job | undefined> {
    const [updated] = await db.update(jobs).set(update).where(eq(jobs.id, id)).returning();
    return updated;
  }

  // The Demolition Tool
  async deleteJob(id: number): Promise<boolean> {
    await db.delete(jobs).where(eq(jobs.id, id));
    return true; 
  }
} // <-- End of the DatabaseStorage class

export const storage = new DatabaseStorage();
