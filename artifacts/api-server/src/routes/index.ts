import { Router, type IRouter } from "express";
import healthRouter from "./health";
import registrationsRouter from "./registrations";
import adminRouter from "./admin";
import configRouter from "./config";
import settingsRouter from "./settings";
import vcfRouter from "./vcf";

const router: IRouter = Router();

router.use(healthRouter);
router.use(configRouter);
router.use(registrationsRouter);
router.use(adminRouter);
router.use(settingsRouter);
router.use(vcfRouter);

export default router;
