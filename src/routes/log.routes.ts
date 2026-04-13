import express from "express";
import { getAllActivityLogs, getAllLogs } from "../controllers/log.Controller";
const router = express.Router();

router.get("/get/all", getAllActivityLogs);
router.get("/get/all/previous", getAllLogs);

export default router;
