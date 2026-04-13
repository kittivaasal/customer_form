import express from "express";
import { getAllActivityLogs, getAllLogs, getByIdLods } from "../controllers/log.Controller";
const router = express.Router();

router.get("/get/all", getAllActivityLogs);
router.get("/get/:id", getByIdLods);
router.get("/get/all/previous", getAllLogs);

export default router;
