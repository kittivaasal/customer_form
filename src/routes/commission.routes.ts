// src/config/multer.ts
import express from "express";
import { getCommissionByCustomer, getCommissionByMarkerId } from "../controllers/commissions.controller";

const router = express.Router();

router.get("/customer/:customerId", getCommissionByCustomer)
router.get("/marketer/:id", getCommissionByMarkerId)

export default router;