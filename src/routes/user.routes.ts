import express from "express";
import { changePasswordByToken, createAdminUser, createUserByAdmin, deleteUser, getAllUser, getByIdUser, getUserByToken, login, updateUserByAdmin, updateUserByToken } from "../controllers/user.controller";
import verifyToken from "../middleware/verfiyToken";
import isAdmin from "../middleware/admin";
const router = express.Router();

router.post("/admin/create",createAdminUser);
router.post("/create", createUserByAdmin);
router.post("/login", login);
router.put("/update", updateUserByAdmin);
router.get("/get/by/token",verifyToken, getUserByToken);
router.put("/update/their/profile",verifyToken, updateUserByToken);
router.put("/update/their/password",verifyToken, changePasswordByToken);
router.get("/get/all", getAllUser);
router.get("/get/:id", getByIdUser);
router.delete("/delete" ,[verifyToken,isAdmin(true)], deleteUser);

export default router;
