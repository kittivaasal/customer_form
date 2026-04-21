import express from "express";
import { changeMarketingHead, createMarketingHead, deleteMarketingHead, getAllMarketingHead, getByIdMarketingHead, updateMarketingHead, upgradeMarketerDetailToHead } from "../controllers/marketingHead.controller";
import verifyToken from "../middleware/verfiyToken";
import { getMarketingHeadEstimates } from "../controllers/gerMarketingHeadEstimates";
import isAdmin from "../middleware/admin";
const router = express.Router();

router.post("/create", verifyToken, createMarketingHead);
router.put("/update", verifyToken , updateMarketingHead);
router.get("/get/all", getAllMarketingHead);
router.get("/get/:id", getByIdMarketingHead);
router.get('/get/:id/estimates', getMarketingHeadEstimates);
router.delete("/delete",[verifyToken, isAdmin(true)], deleteMarketingHead);
router.put("/change/head", [verifyToken, isAdmin(true)] , changeMarketingHead);
router.put("/upgrade/head", [verifyToken, isAdmin(true)] , upgradeMarketerDetailToHead);

export default router;
