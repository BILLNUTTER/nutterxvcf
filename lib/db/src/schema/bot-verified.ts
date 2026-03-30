import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

export const botVerifiedPhonesTable = pgTable("bot_verified_phones", {
  phone: text("phone").primaryKey(),
  verifiedAt: timestamp("verified_at").notNull().defaultNow(),
  registrationId: integer("registration_id"),
});

export type BotVerifiedPhone = typeof botVerifiedPhonesTable.$inferSelect;
