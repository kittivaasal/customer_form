import express from "express";
import { createMod, deleteMod, getAllMod, getByIdMod, updateMod } from "../controllers/mod.controller";
import verifyToken from "../middleware/verfiyToken";
import isAdmin from "../middleware/admin";
const router = express.Router();

router.post("/create", createMod);
router.put("/update", verifyToken ,updateMod);
router.get("/get/all", getAllMod);
router.get("/get/:id", getByIdMod);
router.delete("/delete",[verifyToken,isAdmin(true)], deleteMod);

export default router;

