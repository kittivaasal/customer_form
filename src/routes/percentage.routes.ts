import express from "express";
import { createPercentage, deletePercentage, getAllPercentage, getByIdPercentage, updatePercentage } from "../controllers/percentage.controller";
import verifyToken from "../middleware/verfiyToken";
import isAdmin from "../middleware/admin";
const router = express.Router();

router.post("/create", createPercentage);
router.put("/update",verifyToken, updatePercentage);
router.get("/get/all", getAllPercentage);
router.get("/get/:id", getByIdPercentage);
router.delete("/delete",[verifyToken,isAdmin(true)], deletePercentage);

export default router;
