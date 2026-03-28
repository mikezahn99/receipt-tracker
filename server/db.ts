import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@shared/schema';
import path from 'path';

// 1. Locate where the database file should sit
// On Render, we use /var/data/data.db. Locally, we use sqlite.db.
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/var/data/data.db' 
  : path.resolve(process.cwd(), 'sqlite.db');

// 2. Open the valve to the SQLite file
const sqlite = new Database(dbPath);

// 3. Connect Drizzle (our translator) to that file
export const db = drizzle(sqlite, { schema });
