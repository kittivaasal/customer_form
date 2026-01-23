import express from "express";
import { createRoleMenu, createRoleMultiMenuMap, deleteRoleMenu, getAllMenuAccessByRoleId, getAllRoleMenu, getByIdRoleMenu, updateRoleMenu, updateRoleMultiMenuMap } from "../controllers/roleMenu.controller";
import verifyToken from "../middleware/verfiyToken";
import isAdmin from "../middleware/admin";
const router = express.Router();

router.post("/create" ,[verifyToken,isAdmin(true)], createRoleMenu);
router.post("/multi/create" ,[verifyToken,isAdmin(true)], createRoleMultiMenuMap);
router.put("/multi/update" ,[verifyToken,isAdmin(true)], updateRoleMultiMenuMap);
router.put("/update" ,[verifyToken,isAdmin(true)], updateRoleMenu);
router.get("/get/role/:id", getAllMenuAccessByRoleId);
router.get("/get/all", getAllRoleMenu);
router.get("/get/:id", getByIdRoleMenu);
router.delete("/delete" ,[verifyToken,isAdmin(true)], deleteRoleMenu);

export default router;
