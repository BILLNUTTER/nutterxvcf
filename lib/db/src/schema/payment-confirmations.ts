import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const paymentStatusEnum = ["pending", "reviewed", "actioned"] as const;
export type PaymentStatus = (typeof paymentStatusEnum)[number];

export const paymentConfirmationsTable = pgTable("payment_confirmations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  mpesaMessage: text("mpesa_message").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PaymentConfirmation = typeof paymentConfirmationsTable.$inferSelect;
