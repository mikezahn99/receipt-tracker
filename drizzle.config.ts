import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    // THE FIX: Point to the exact same vault the live app uses!
    url: process.env.NODE_ENV === 'production' ? '/var/data/data.db' : './sqlite.db',
  },
});
