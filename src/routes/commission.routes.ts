// src/config/multer.ts
import express from "express";
import { getCommissionByCustomer } from "../controllers/commissions.controller";

const router = express.Router();

router.get("/customer/:customerId", getCommissionByCustomer)

export default router;