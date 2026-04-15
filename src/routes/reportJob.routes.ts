import express from "express";
import verifyToken from "../middleware/verfiyToken";
import { createReportJob, getReportJobStatus } from "../controllers/reportJob.controller";

const router = express.Router();

router.post("/create", verifyToken, createReportJob);
router.get("/status/:jobId", verifyToken, getReportJobStatus);

export default router;
