// src/config/multer.ts
import multer, { FileFilterCallback } from "multer";
import path from "path";
import { Request } from "express";
import express from "express";
import fs from "fs";
import { checkEmi, createBilling, deleteBilling, createCommonData, getAllBilling, getAllBillingReport, getAllDataBasedOnGeneral, getAllDetailsByCustomerId, getAllEmi, getAllFlat, getAllGeneral, getAllMarketer, getAllPlot, getByIdBilling, getByIdEmi, getByIdFlat, getByIdGeneral, getByIdMarketer, getByIdPlot, getDataBasedOnGeneralById, storeFcmToken, updateBilling, UpdateCommonData, uploadImages, bulkUpdateEmi, updateBillingBulk } from "../controllers/common.controller";
import verifyToken from "../middleware/verfiyToken";
import isAdmin from "../middleware/admin";

let router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/upload", upload.array("files"), uploadImages);
router.post("/create/all", createCommonData)
router.post("/create/billing",verifyToken, createBilling)
// router.put("/update/bulk/billing",verifyToken, updateBillingBulk)
router.put("/update/billing",[verifyToken,isAdmin(true)], updateBilling)
router.put("/update/all",verifyToken, UpdateCommonData)
router.get("/general/get/all", getAllGeneral)
router.get("/general/get/:id", getByIdGeneral)
router.get("/plot/get/all", getAllPlot)
router.get("/plot/get/:id", getByIdPlot)
router.get("/flat/get/all", getAllFlat)
router.get("/flat/get/:id", getByIdFlat)
router.get("/billing/get/all", getAllBilling)
router.get("/billing/get/all/report", verifyToken, getAllBillingReport)
router.get("/billing/get/:id", getByIdBilling)
router.delete("/billing/delete",[verifyToken,isAdmin(true)], deleteBilling)
router.get("/emi/get/all", getAllEmi)
router.get("/emi/get/:id", getByIdEmi)
router.get("/marketer/get/all", getAllMarketer)
router.get("/marketer/get/:id", getByIdMarketer)
router.get("/get/all/detail", getAllDetailsByCustomerId)//
router.get("/get/all/estimate", getAllDataBasedOnGeneral)
router.get("/get/all/estimate/:id", getDataBasedOnGeneralById)
router.post("/check/emi", checkEmi)
router.post("/add/fcm/token",storeFcmToken)
router.put("/billing/bulk/update",verifyToken, upload.array("files"), bulkUpdateEmi)

export default router;