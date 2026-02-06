import express from "express";
import { createMod, deleteMod, getAllMod, getAllModCustomer, getByIdMod, updateMod } from "../controllers/mod.controller";
import isAdmin from "../middleware/admin";
import verifyToken from "../middleware/verfiyToken";
const router = express.Router();

router.post("/create", createMod);
router.put("/update", verifyToken ,updateMod);
router.get("/get/all", getAllMod);
router.get("/get/all-customer", getAllModCustomer);
router.get("/get/:id", getByIdMod);
router.delete("/delete",[verifyToken,isAdmin(true)], deleteMod);

export default router;

