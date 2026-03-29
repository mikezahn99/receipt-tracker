import { users, receipts, jobs, type User, type InsertUser, type Receipt, type InsertReceipt, type Job } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import session from "express-session";
import createSQLiteStore from "connect-sqlite3";
import bcrypt from "bcryptjs"; 

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
      const [admin] = await db.select().from(users).where(eq(users.username, "admin"));
      const hashedPassword = await bcrypt.hash("changeme123", 10);

      if (!admin) {
        console.log("Master Key missing from SQLite. Creating 'admin' user...");
        await this.createUser({
          username: "admin",
          password: hashedPassword,
          password_hash: hashedPassword // The extra label
        } as any);
      } else {
        console.log("Admin found but lock is old. Cutting it off and replacing...");
        await db.delete(users).where(eq(users.username, "admin"));
        await this.createUser({
          username: "admin",
          password: hashedPassword,
          password_hash: hashedPassword // The extra label
        } as any);
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
    // Put all possible labels on the folder so Drizzle finds the right drawer
    const dataToInsert: any = {
      ...insertUser,
      password_hash: (insertUser as any).password_hash || (insertUser as any).password,
      passwordHash: (insertUser as any).passwordHash || (insertUser as any).password
    };
    const [user] = await db.insert(users).values(dataToInsert).returning();
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
