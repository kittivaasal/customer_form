import { Request, Response } from "express";
import { Types } from "mongoose";
import {CustomerEmiModel } from "../models/commision.model";

/**
 * GET /api/commission/customer/:customerId
 * Fetch commissions by customer and populate marketer details
 */
export const getCommissionByCustomer = async (
  req: Request,
  res: Response
) => {
  try {
    const { customerId } = req.params;

    // 1️⃣ Validate customerId
    if (!Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer id",
      });
    }

    // 2️⃣ Aggregation pipeline
    const commissions = await CustomerEmiModel.find({ customer: customerId })

    // 3️⃣ Response
    return res.status(200).json({
      success: true,
      count: commissions.length,
      data: commissions,
    });
  } catch (error) {
    console.error("Get commission by customer error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
