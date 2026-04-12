import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { registrationsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { getTarget, getApprovedCount } from "./settings";

const router: IRouter = Router();

function buildVcfContent(
  contacts: Array<{ name: string; phone: string }>,
): string {
  const entries = contacts.map(({ name, phone }) => {
    const displayName = `${name} 💠`;
    return [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${displayName}`,
      `TEL;TYPE=CELL,VOICE:${phone}`,
      "END:VCARD",
    ].join("\r\n");
  });
  return entries.join("\r\n") + "\r\n";
}

router.get("/vcf/download", async (req, res) => {
  const type = req.query["type"] as string | undefined;

  if (type !== "standard" && type !== "bot") {
    res.status(400).json({ error: "validation_error", message: "type must be 'standard' or 'bot'" });
    return;
  }

  try {
    const targetKey = type === "standard" ? "standard_target" : "bot_target";
    const [target, approvedCount] = await Promise.all([
      getTarget(targetKey),
      getApprovedCount(type),
    ]);

    if (approvedCount < target) {
      res.status(403).json({
        error: "target_not_reached",
        message: `Target of ${target} not yet reached (currently ${approvedCount} approved)`,
      });
      return;
    }

    const contacts = await db
      .select({ name: registrationsTable.name, phone: registrationsTable.phone })
      .from(registrationsTable)
      .where(
        and(
          eq(registrationsTable.registrationType, type),
          eq(registrationsTable.status, "approved"),
        ),
      )
      .orderBy(registrationsTable.createdAt);

    const vcfContent = buildVcfContent(contacts);
    const filename = "NUTTERXVCF.vcf";

    res.setHeader("Content-Type", "text/vcard; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(vcfContent);
  } catch (err) {
    req.log.error({ err }, "Failed to generate VCF");
    res.status(500).json({ error: "server_error", message: "Failed to generate VCF file" });
  }
});

export default router;
