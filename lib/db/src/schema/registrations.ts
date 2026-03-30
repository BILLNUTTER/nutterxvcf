import { pgTable, serial, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const statusEnum = pgEnum("registration_status", [
  "pending",
  "approved",
  "rejected",
]);

export const registrationTypeEnum = pgEnum("registration_type", [
  "standard",
  "bot",
]);

export const registrationsTable = pgTable("registrations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  countryCode: text("country_code").notNull(),
  status: statusEnum("status").notNull().default("pending"),
  registrationType: registrationTypeEnum("registration_type").notNull(),
  claimToken: text("claim_token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRegistrationSchema = createInsertSchema(
  registrationsTable,
).omit({ id: true, status: true, createdAt: true, claimToken: true });

export type InsertRegistration = z.infer<typeof insertRegistrationSchema>;
export type Registration = typeof registrationsTable.$inferSelect;
