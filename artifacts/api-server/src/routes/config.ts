import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { registrationsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.post("/redirect", async (req, res) => {
  const { name, type } = req.body as { name?: string; type?: string };

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "validation_error", message: "name is required" });
    return;
  }
  if (type !== "standard" && type !== "bot") {
    res.status(400).json({ error: "validation_error", message: "type must be 'standard' or 'bot'" });
    return;
  }

  try {
    const [registration] = await db
      .select()
      .from(registrationsTable)
      .where(
        and(
          eq(registrationsTable.name, name.trim()),
          eq(registrationsTable.registrationType, type),
          eq(registrationsTable.status, "approved"),
        ),
      )
      .limit(1);

    if (!registration) {
      res.status(403).json({ error: "not_approved", message: "User not approved" });
      return;
    }

    const link =
      type === "standard"
        ? process.env.STANDARD_GROUP_LINK
        : process.env.BOT_GROUP_LINK;

    if (!link) {
      res.status(503).json({ error: "link_not_configured", message: "Group link not configured" });
      return;
    }

    res.json({ redirectUrl: link });
  } catch (err) {
    req.log.error({ err }, "Failed to check redirect");
    res.status(500).json({ error: "server_error", message: "Failed to process redirect" });
  }
});

export default router;
