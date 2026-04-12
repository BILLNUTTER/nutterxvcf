import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const paylorTransactionsTable = pgTable("paylor_transactions", {
  id: serial("id").primaryKey(),
  paylorTransactionId: text("paylor_transaction_id"),
  reference: text("reference").notNull().unique(),
  registrationId: integer("registration_id"),
  phone: text("phone").notNull(),
  amount: integer("amount").notNull().default(10),
  status: text("status").notNull().default("pending"),
  mpesaReceipt: text("mpesa_receipt"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PaylorTransaction = typeof paylorTransactionsTable.$inferSelect;
