import e, { Request, Response } from "express";
import { Types } from "mongoose";
import { Commission } from "../models/commision.model";
import { isValidDate, ReE, toAwait } from "../services/util.service";
import httpStatus from "http-status";
import { MarketDetail } from "../models/marketDetail.model";
import { MarketingHead } from "../models/marketingHead.model";

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
    const commissions = await Commission.find({ customer: customerId })

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


export const getCommissionByMarkerId = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let { dateFrom, dateTo, date, page = "1", limit = "50", onlyMarketer = false } = req.query as any;

    // ✅ Validate ObjectId
    if (!Types.ObjectId.isValid(id)) {
      return ReE(res, { message: "Invalid marketer id" }, httpStatus.BAD_REQUEST);
    }

    const marketerId = new Types.ObjectId(id);

    let match: any = {
      "marketer.marketerId": marketerId
    };

    // 📅 Date filter
    if (dateFrom && dateTo) {
      if (!isValidDate(dateFrom) || !isValidDate(dateTo)) {
        return ReE(res, { message: "Invalid date format (YYYY-MM-DD)" }, 400);
      }

      const start = new Date(dateFrom);
      start.setUTCHours(0, 0, 0, 0);

      const end = new Date(dateTo);
      end.setUTCHours(23, 59, 59, 999);

      match.paymentDate = { $gte: start, $lte: end };

    } else if (date) {
      if (!isValidDate(date)) {
        return ReE(res, { message: "Invalid date format (YYYY-MM-DD)" }, 400);
      }

      const start = new Date(date);
      start.setUTCHours(0, 0, 0, 0);

      const end = new Date(date);
      end.setUTCHours(23, 59, 59, 999);

      match.paymentDate = { $gte: start, $lte: end };
    }

    const currentPage = parseInt(page);
    const limitValue = parseInt(limit);

    const skip = (currentPage - 1) * limitValue;
    const limitNum = parseInt(limit);

    const total = await Commission.countDocuments(match);

    const totalPages = Math.ceil(total / limitValue);

    if (currentPage > totalPages) {
      return ReE(res, { message: `Page no ${page} is not available. last page no is ${totalPages}` }, httpStatus.NOT_FOUND);
    }

    const dataPipeline: any[] = [
      { $sort: { paymentDate: -1 } }
    ];

    // 👉 conditionally add stage
    if (onlyMarketer === "true") {
      dataPipeline.push({
        $addFields: {
          marketer: {
            $filter: {
              input: "$marketer",
              as: "m",
              cond: { $eq: ["$$m.marketerId", marketerId] }
            }
          }
        }
      });
    }

    // 👉 pagination
    dataPipeline.push(
      { $skip: skip },
      { $limit: limitNum }
    );

    // 🚀 Aggregation
    const result = await Commission.aggregate([
      { $match: match },
      {
        $facet: {
          summary: [
            { $unwind: "$marketer" },
            {
              $match: {
                "marketer.marketerId": marketerId
              }
            },
            {
              $group: {
                _id: null,
                totalEarnDirect: {
                  $sum: {
                    $cond: [
                      { $ne: ["$marketer.percentage", "1%"] },
                      { $toDouble: "$marketer.commAmount" },
                      0
                    ]
                  }
                },
                totalEarnCommission: {
                  $sum: {
                    $cond: [
                      { $eq: ["$marketer.percentage", "1%"] },
                      { $toDouble: "$marketer.commAmount" },
                      0
                    ]
                  }
                },
                count: { $sum: 1 }
              }
            }
          ],
          data: dataPipeline
        }
      }
    ]);

    // 🎯 Format response
    const summary = result[0]?.summary[0] || {
      totalEarnDirect: 0,
      totalEarnCommission: 0,
      count: 0
    };

    const data = result[0]?.data || [];

    return res.status(200).json({
      success: true,
      count: total,
      data: data,
      commission: {
        totalEarnDirect: summary.totalEarnDirect,
        totalEarnCommission: summary.totalEarnCommission,
        totalEarn: summary.totalEarnDirect + summary.totalEarnCommission
      },
      pagination: {
        page: currentPage,
        limit: limitValue,
        total: total,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
        nextPage: currentPage < totalPages ? currentPage + 1 : null,
        prevPage: currentPage > 1 ? currentPage - 1 : null
      }
    });

  } catch (error: any) {
    console.error("Get commission by marketer error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error: " + error.message
    });
  }
};