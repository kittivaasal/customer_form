import express from "express";
import { createProject, deleteProject, getAllProject, getByIdProject, updateProject } from "../controllers/project.controller";
import verifyToken from "../middleware/verfiyToken";
import isAdmin from "../middleware/admin";
const router = express.Router();

router.post("/create", createProject);
router.put("/update",verifyToken, updateProject);
router.get("/get/all", getAllProject);
router.get("/get/:id", getByIdProject);
router.delete("/delete",[verifyToken,isAdmin(true)], deleteProject);

export default router;
