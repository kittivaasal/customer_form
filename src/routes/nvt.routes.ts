import express from "express";
import { createNvt, deleteNvt, getAllNvt, getAllNvtCustomer, getByIdNvt, updateNvt } from "../controllers/nvt.controller";
import verifyToken from "../middleware/verfiyToken";
import isAdmin from "../middleware/admin";
const router = express.Router();

router.post("/create", createNvt);
router.put("/update", verifyToken, updateNvt);
router.get("/get/all", getAllNvt);
router.get("/get/all/customer/:id", getAllNvtCustomer);
router.get("/get/:id", getByIdNvt);
router.delete("/delete",[verifyToken,isAdmin(true)], deleteNvt);

export default router;