import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@shared/schema';
import path from 'path';
import fs from 'fs';

// 1. Point to the new permanent steel safe on Render
let dbPath = path.resolve(process.cwd(), 'sqlite.db'); // Local default

if (process.env.NODE_ENV === 'production') {
  dbPath = '/var/data/data.db'; // The Permanent Disk
  
  // Make sure the folder is ready before we park the database
  const targetDir = path.dirname(dbPath);
  if (!fs.existsSync(targetDir)) {
    try {
      fs.mkdirSync(targetDir, { recursive: true });
      console.log(`Built new database directory at ${targetDir}`);
    } catch (err) {
      console.error("Could not build /var/data folder. Check Render Disk Mount Path.", err);
    }
  }
}

// 2. Open the valve to the SQLite file
const sqlite = new Database(dbPath);

// 3. Connect Drizzle (our translator) to that file
export const db = drizzle(sqlite, { schema });
