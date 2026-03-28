import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@shared/schema';
import path from 'path';

// Park the database right on the main job site where we know we have access
const dbPath = path.resolve(process.cwd(), 'sqlite.db');

// Open the valve to the SQLite file
const sqlite = new Database(dbPath);

// Connect Drizzle (our translator) to that file
export const db = drizzle(sqlite, { schema });
