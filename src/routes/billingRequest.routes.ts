// src/config/multer.ts
import express from "express";
import verifyToken from "../middleware/verfiyToken";
import { approvedBillingRequest, getAllBillingRequest, getBillingRequestByID } from "../controllers/billingRequest.controller";

const router = express.Router();

router.post("/approve", verifyToken, approvedBillingRequest)
router.get("/get/all",  getAllBillingRequest)
router.get("/get/id/:id",  getBillingRequestByID)

export default router;