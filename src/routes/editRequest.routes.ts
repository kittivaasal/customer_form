import express from "express";
import { approvedEditRequest, getAllEditRequests, getByIdEditRequest } from "../controllers/editRequest.controller";
import verifyToken from "../middleware/verfiyToken";
import isAdmin from "../middleware/admin";
const router = express.Router();

router.post("/approve", [verifyToken,isAdmin(true)], approvedEditRequest);
router.get("/get/all", [verifyToken, isAdmin(true)], getAllEditRequests);
router.get("/get/:id", [verifyToken,isAdmin(true)], getByIdEditRequest);
// router

export default router;
