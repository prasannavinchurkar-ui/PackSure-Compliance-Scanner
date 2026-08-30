import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scansTable = pgTable("scans", {
  id: serial("id").primaryKey(),
  productName: text("product_name").notNull(),
  brand: text("brand").notNull(),
  manufacturer: text("manufacturer"),
  netQuantity: text("net_quantity"),
  category: text("category").notNull(),
  imageName: text("image_name"),
  status: text("status").notNull(),
  riskScore: integer("risk_score").notNull(),
  issueCount: integer("issue_count").notNull(),
  topIssue: text("top_issue"),
  inspector: text("inspector").notNull().default("Aarav Mehta"),
  declarations: jsonb("declarations").notNull().default([]),
  findings: jsonb("findings").notNull().default([]),
  scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScanSchema = createInsertSchema(scansTable).omit({
  id: true,
  scannedAt: true,
});

export type InsertScan = z.infer<typeof insertScanSchema>;
export type Scan = typeof scansTable.$inferSelect;