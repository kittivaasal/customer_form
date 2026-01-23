import express from "express";
import { createMenu, deleteMenu, getAllMenu, getByIdMenu, updateMenu } from "../controllers/menu.controller";
import isAdmin from "../middleware/admin";
import verifyToken from "../middleware/verfiyToken";
const router = express.Router();

router.post("/create" ,[verifyToken,isAdmin(true)], createMenu);
router.put("/update" ,[verifyToken,isAdmin(true)], updateMenu);
router.get("/get/all", getAllMenu);
router.get("/get/:id", getByIdMenu);
router.delete("/delete" ,[verifyToken,isAdmin(true)], deleteMenu);

export default router;
