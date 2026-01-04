// routes/lifeSaving.routes.ts
import { Router } from "express";
import { createLifeSaving, getAllLifeSaving, getByIdLifeSaving } from "../controllers/lifeSaving.controller";

const router = Router();

router.post("/create", createLifeSaving);
router.get("/get/all", getAllLifeSaving);
router.get("/get/id/:id", getByIdLifeSaving);

export default router;
