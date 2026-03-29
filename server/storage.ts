import { users, receipts, jobs, type User, type InsertUser, type Receipt, type InsertReceipt, type Job } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import session from "express-session";
import createSQLiteStore from "connect-sqlite3";
import bcrypt from "bcryptjs"; // <-- THE DECODER RING

const SQLiteStore = createSQLiteStore(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getReceipt(id: number): Promise<Receipt | undefined>;
  getReceipts(userId: number): Promise<Receipt[]>;
  createReceipt(receipt: InsertReceipt & { userId: number }): Promise<Receipt>;
  updateReceipt(id: number, receipt: Partial<InsertReceipt>): Promise<Receipt | undefined>;
  deleteReceipt(id: number): Promise<boolean>;
  
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
      const [adminExists] = await db.select().from(users).where(eq(users.username, "admin"));
      if (!adminExists) {
        console.log("Master Key missing from SQLite. Creating 'admin' user...");
        // Scramble the master password before storing it
        const hashedPassword = await bcrypt.hash("changeme123", 10);
        await this.createUser({
          username: "admin",
          password: hashedPassword
        });
      }
    } catch (error) {
      console.error("Error seeding admin:", error);
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getReceipt(id: number): Promise<Receipt | undefined> {
    const [receipt] = await db.select().from(receipts).where(eq(receipts.id, id));
    return receipt;
  }

  async getReceipts(userId: number): Promise<Receipt[]> {
    return await db.select().from(receipts).where(eq(receipts.userId, userId));
  }

  async createReceipt(insertReceipt: InsertReceipt & { userId: number }): Promise<Receipt> {
    const [receipt] = await db.insert(receipts).values(insertReceipt).returning();
    return receipt;
  }

  async updateReceipt(id: number, update: Partial<InsertReceipt>): Promise<Receipt | undefined> {
    const [updated] = await db
      .update(receipts)
      .set(update)
      .where(eq(receipts.id, id))
      .returning();
    return updated;
  }

  async deleteReceipt(id: number): Promise<boolean> {
    await db.delete(receipts).where(eq(receipts.id, id));
    return true; 
  }
}

export const storage = new DatabaseStorage();
