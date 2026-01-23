import express from "express";
import { createRole, deleteRole, getAllRole, getByIdRole, updateRole } from "../controllers/role.controller";
import verifyToken from "../middleware/verfiyToken";
import isAdmin from "../middleware/admin";
const router = express.Router();

router.post("/create" ,[verifyToken,isAdmin(true)], createRole);
router.put("/update" ,[verifyToken,isAdmin(true)], updateRole);
router.get("/get/all", getAllRole);
router.get("/get/:id", getByIdRole);
router.delete("/delete" ,[verifyToken,isAdmin(true)], deleteRole);

export default router;
