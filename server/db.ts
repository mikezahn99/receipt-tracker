import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@shared/schema';
import path from 'path';
import fs from 'fs';

// 1. Determine where the site trailer is supposed to be parked
let dbPath = process.env.NODE_ENV === 'production' 
  ? '/var/data/data.db' 
  : path.resolve(process.cwd(), 'sqlite.db');

// 2. Clear the land: Ensure the folder actually exists before we park the database there
const targetDir = path.dirname(dbPath);
if (!fs.existsSync(targetDir)) {
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`Built new database directory at ${targetDir}`);
  } catch (err) {
    console.warn("⚠️ Could not build /var/data folder. Falling back to local job site directory.");
    dbPath = path.resolve(process.cwd(), 'sqlite.db');
  }
}

// 3. Open the valve to the SQLite file
const sqlite = new Database(dbPath);

// 4. Connect Drizzle (our translator) to that file
export const db = drizzle(sqlite, { schema });
