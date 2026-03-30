import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/config", (_req, res) => {
  res.json({
    standardGroupLink: process.env.STANDARD_GROUP_LINK ?? "https://chat.whatsapp.com/BYzNlaEiCS9LPblEXIYJnA?mode=gi_t",
    botGroupLink: process.env.BOT_GROUP_LINK ?? "",
  });
});

export default router;
