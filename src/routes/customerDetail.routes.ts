import express from "express";
import { getCustomerOverallDetail } from "../controllers/customerDetail.controller";

const router = express.Router();

// GET /api/customer/detail/:customerId
router.get("/detail/:customerId", getCustomerOverallDetail);

export default router;
