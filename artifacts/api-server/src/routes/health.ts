import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/debug", (_req, res) => {
  res.json({
    ok: true,
    env: {
      ADMIN_USERNAME: !!process.env.ADMIN_USERNAME,
      ADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD,
      ADMIN_TOKEN_SECRET: !!process.env.ADMIN_TOKEN_SECRET,
      SUPABASE_DATABASE_URL: !!process.env.SUPABASE_DATABASE_URL,
      DATABASE_URL: !!process.env.DATABASE_URL,
      NODE_ENV: process.env.NODE_ENV ?? "not set",
    },
  });
});

export default router;
