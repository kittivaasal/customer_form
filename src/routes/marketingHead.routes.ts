import express from "express";
import { createMarketingHead, deleteMarketingHead, getAllMarketingHead, getByIdMarketingHead, updateMarketingHead } from "../controllers/marketingHead.controller";
import verifyToken from "../middleware/verfiyToken";
import { getMarketingHeadEstimates } from "../controllers/gerMarketingHeadEstimates";
import isAdmin from "../middleware/admin";
const router = express.Router();

router.post("/create", verifyToken, createMarketingHead);
router.put("/update", verifyToken , updateMarketingHead);
router.get("/get/all", getAllMarketingHead);
router.get("/get/:id", getByIdMarketingHead);
router.get('/get/:id/estimates', getMarketingHeadEstimates);
router.delete("/delete",[verifyToken,isAdmin(true)], deleteMarketingHead);

export default router;
