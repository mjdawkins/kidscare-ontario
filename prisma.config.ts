import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({ path: ".env.local" });

// prisma migrate uses this URL (needs session mode, no pgbouncer)
// PrismaClient at runtime uses DATABASE_URL via @prisma/adapter-pg (pooler)
const migrateUrl = process.env.DIRECT_URL;

if (!migrateUrl) {
  throw new Error("DIRECT_URL environment variable is required for migrations");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrateUrl,
  },
});
