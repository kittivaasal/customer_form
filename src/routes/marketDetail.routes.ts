import express from "express";
import { createMarketDetail, deleteMarketDetail, getAllMarketDetail, getByIdMarketDetail, getBothMarketerMarketerHead, updateMarketDetail, getFullHierarchy, getUplineDownline, changeMarketDetailToOtherTeam } from "../controllers/marketDetail.controller";
import verifyToken from "../middleware/verfiyToken";
import isAdmin from "../middleware/admin";
const router = express.Router();

router.post("/create",verifyToken, createMarketDetail);
router.put("/update",verifyToken, updateMarketDetail);
router.get("/get/all", getAllMarketDetail);
router.get("/get/all/both", getBothMarketerMarketerHead)
router.get("/get/:id", getByIdMarketDetail);
router.get("/get/full/:id", getFullHierarchy);
router.put("/change/to/other/team", changeMarketDetailToOtherTeam);
router.get("/get/all/up/down/:id", getUplineDownline);
router.delete("/delete",[verifyToken], deleteMarketDetail);

export default router;
