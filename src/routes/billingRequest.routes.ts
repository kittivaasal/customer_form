// src/config/multer.ts
import express from "express";
import verifyToken from "../middleware/verfiyToken";
import { approvedBillingRequest, checkBillingRequestForExcel, createBillingRequestForExcel, getAllBillingRequest, getAllTheirBillingRequest, getBillingRequestByID } from "../controllers/billingRequest.controller";

const router = express.Router();

router.put("/approve", verifyToken, approvedBillingRequest)
router.post("/create",verifyToken,  createBillingRequestForExcel)
router.get("/get/all",  getAllBillingRequest)
router.get("/get/id/:id",  getBillingRequestByID)
router.post("/check",verifyToken,  checkBillingRequestForExcel)
router.get("/get/their/request/token", verifyToken, getAllTheirBillingRequest)

export default router;