import express from "express";
import { createCustomer, deleteCustomer, getAllCustomer, getByIdCustomer, updateCustomer } from "../controllers/customer.controller";
import verifyToken from "../middleware/verfiyToken";
import isAdmin from "../middleware/admin";
const router = express.Router();

router.post("/create", verifyToken,createCustomer);
router.put("/update",verifyToken, updateCustomer);
router.get("/get/all", getAllCustomer);
router.get("/get/:id", getByIdCustomer);
router.delete("/delete",[verifyToken,isAdmin(true)], deleteCustomer);

export default router;
