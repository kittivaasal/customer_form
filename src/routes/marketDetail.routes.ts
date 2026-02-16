import express from "express";
import { createMarketDetail, deleteMarketDetail, getAllMarketDetail, getByIdMarketDetail, getBothMarketerMarketerHead, updateMarketDetail, getFullHierarchy, getUplineDownline } from "../controllers/marketDetail.controller";
import verifyToken from "../middleware/verfiyToken";
import isAdmin from "../middleware/admin";
const router = express.Router();

router.post("/create",verifyToken, createMarketDetail);
router.put("/update",verifyToken, updateMarketDetail);
router.get("/get/all", getAllMarketDetail);
router.get("/get/all/both", getBothMarketerMarketerHead)
router.get("/get/:id", getByIdMarketDetail);
router.get("/get/full/:id", getFullHierarchy);
router.get("/get/all/up/down/:id", getUplineDownline);
router.delete("/delete",[verifyToken,isAdmin(true)], deleteMarketDetail);

export default router;
