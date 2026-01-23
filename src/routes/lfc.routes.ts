import express from "express";
import { createLfc, deleteLfc, getAllLfc, getByIdLfc, updateLfc } from "../controllers/lfc.controller";
import verifyToken from "../middleware/verfiyToken";
import isAdmin from "../middleware/admin";
const router = express.Router();

router.post("/create", createLfc);
router.put("/update",verifyToken, updateLfc);
router.get("/get/all", getAllLfc);
router.get("/get/:id", getByIdLfc);
router.delete("/delete",[verifyToken,isAdmin(true)], deleteLfc);

export default router;
