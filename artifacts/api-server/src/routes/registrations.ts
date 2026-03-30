import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { registrationsTable } from "@workspace/db/schema";
import {
  SubmitRegistrationBody,
  GetVerifiedUsersResponse,
} from "@workspace/api-zod";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.post("/register", async (req, res) => {
  const parsed = SubmitRegistrationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { name, phone, countryCode, registrationType, alsoRegisterStandard } = parsed.data;

  try {
    const results: typeof registrationsTable.$inferSelect[] = [];

    const existing = await db
      .select()
      .from(registrationsTable)
      .where(
        and(
          eq(registrationsTable.phone, phone),
          eq(registrationsTable.registrationType, registrationType),
        ),
      );

    if (existing.length > 0) {
      res
        .status(409)
        .json({ error: "already_registered", message: "This phone number is already registered for this VCF type." });
      return;
    }

    const [primary] = await db
      .insert(registrationsTable)
      .values({ name, phone, countryCode, registrationType })
      .returning();
    results.push(primary);

    if (alsoRegisterStandard && registrationType === "bot") {
      const existingStandard = await db
        .select()
        .from(registrationsTable)
        .where(
          and(
            eq(registrationsTable.phone, phone),
            eq(registrationsTable.registrationType, "standard"),
          ),
        );

      if (existingStandard.length === 0) {
        const [secondary] = await db
          .insert(registrationsTable)
          .values({ name, phone, countryCode, registrationType: "standard" })
          .returning();
        results.push(secondary);
      }
    }

    res.status(201).json(primary);
  } catch (err) {
    req.log.error({ err }, "Registration failed");
    res.status(500).json({ error: "server_error", message: "Registration failed" });
  }
});

router.get("/users/verified", async (req, res) => {
  try {
    const all = await db
      .select({
        id: registrationsTable.id,
        name: registrationsTable.name,
        registrationType: registrationsTable.registrationType,
      })
      .from(registrationsTable)
      .where(eq(registrationsTable.status, "approved"));

    const standard = all.filter((u) => u.registrationType === "standard");
    const bot = all.filter((u) => u.registrationType === "bot");

    const response = GetVerifiedUsersResponse.parse({ standard, bot });
    res.json(response);
  } catch (err) {
    req.log.error({ err }, "Failed to get verified users");
    res.status(500).json({ error: "server_error", message: "Failed to get verified users" });
  }
});

export default router;
