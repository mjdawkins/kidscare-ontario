import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({ path: ".env.local" });

// DIRECT_URL for migrations (session mode), DATABASE_URL fallback for prisma generate
const migrateUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!migrateUrl) {
  throw new Error("Either DIRECT_URL or DATABASE_URL must be set");
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
