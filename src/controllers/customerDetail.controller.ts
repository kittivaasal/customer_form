import { Request, Response } from "express";
import { Types } from "mongoose";
import { ReE } from "../services/util.service";
import httpStatus from "http-status";
import { Customer } from "../models/customer.model";
import { General } from "../models/general.model";
import { Emi } from "../models/emi.model";
import { Billing } from "../models/billing.model";

/**
 * GET /api/customer/detail/:customerId
 * Returns full customer overview: personal info, general/project deal,
 * EMI schedule, billing history, and computed summary totals.
 */
export const getCustomerOverallDetail = async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    // ✅ Validate ObjectId
    if (!Types.ObjectId.isValid(customerId)) {
      return ReE(res, { message: "Invalid customer id" }, httpStatus.BAD_REQUEST);
    }

    const customerObjectId = new Types.ObjectId(customerId);

    // 🚀 Fetch all data in parallel
    const [customer, general, emis, billings] = await Promise.all([
      Customer.findById(customerObjectId)
        .populate("projectId", "projectName shortName duration emiAmount schema")
        .populate("cedId", "name phone leader")
        .populate("ddId", "name phone")
        .populate("introducerId", "name phone")
        .lean(),

      General.findOne({ customer: customerObjectId })
        .populate("project", "projectName shortName")
        .lean(),

      Emi.find({ customer: customerObjectId })
        .sort({ emiNo: 1 })
        .lean(),

      Billing.find({ customer: customerObjectId })
        .sort({ paymentDate: 1 })
        .lean(),
    ]);

    // 🔍 Customer not found
    if (!customer) {
      return ReE(res, { message: "Customer not found" }, httpStatus.NOT_FOUND);
    }

    // 📊 Compute EMI summary
    const totalEmis = emis.length;
    const emisPaid = emis.filter((e) => e.paidDate).length;
    const emisPending = totalEmis - emisPaid;
    const totalEmiAmountScheduled = emis.reduce((sum, e) => sum + (e.emiAmt || 0), 0);
    const totalEmiAmountPaid = emis.reduce((sum, e) => sum + (e.paidAmt || 0), 0);

    // 📊 Compute billing summary
    const totalBillingPaid = billings.reduce((sum, b) => sum + (b.amountPaid || 0), 0);

    // 📊 Overall summary
    // Prefer general.totalAmount; fall back to EMI scheduled total when general has no value.
    const totalAmount = general?.totalAmount && general.totalAmount > 0
      ? general.totalAmount
      : totalEmiAmountScheduled;

    // Use EMI paid amount as source of truth for paid amount
    // (billing receipts may overlap with EMI paid records)
    const totalPaid = totalEmiAmountPaid;
    const totalBalance = totalAmount - totalPaid;

    // 🗂️ Format EMI schedule rows
    const emiSchedule = emis.map((e) => ({
      emiNo: e.emiNo,
      dueDate: e.date,
      emiAmt: e.emiAmt,
      paidDate: e.paidDate || null,
      paidAmt: e.paidAmt || null,
      status: e.paidDate ? "Paid" : "Pending",
    }));

    // 🗂️ Format billing history rows
    const billingHistory = billings.map((b) => ({
      billingId: b.billingId,
      paymentDate: b.paymentDate,
      amountPaid: b.amountPaid,
      enteredAmount: b.enteredAmount,
      modeOfPayment: b.modeOfPayment || b.payMode,
      balanceAmount: b.balanceAmount,
      remarks: b.remarks,
      emiNo: b.emiNo,
      transactionType: b.transactionType,
    }));

    // 🎯 Build response payload
    return res.status(200).json({
      success: true,
      data: {
        customer: {
          _id: customer._id,
          customerCode: customer.id || null,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          dob: customer.dob,
          gender: customer.gender,
          address: customer.address,
          panNo: customer.panNo,
          occupation: customer.occupation,
          qualification: customer.qualification,
          fatherOrHusbandName: customer.fatherOrHusbandName,
          motherName: customer.motherName,
          nationality: customer.nationality,
          referenceId: customer.referenceId,
          plotNo: customer.plotNo,
          projectArea: customer.projectArea,
          // Nominee details
          nomineeName: customer.nomineeName,
          nomineeAge: customer.nomineeAge,
          nomineeRelationship: customer.nomineeRelationship,
          nameOfGuardian: customer.nameOfGuardian,
          // Marketer (from customer record – denormalized)
          marketerName: customer.marketerName,
          marketerPercent: customer.marketerPercent,
          // Populated marketer/introducer references
          cedId: customer.cedId || null,
          ddId: customer.ddId || null,
          introducerId: customer.introducerId || null,
          // Populated project
          project: customer.projectId || null,
        },

        general: general
          ? {
              _id: general._id,
              totalAmount: general.totalAmount,
              paymentTerms: general.paymentTerms,
              emiAmount: general.emiAmount,
              noOfInstallments: general.noOfInstallments,
              percentage: general.percentage,
              status: general.status,
              saleType: general.saleType,
              startDate: general.startDate,
              loan: general.loan,
              offered: general.offered,
              sSalesNo: general.sSalesNo,
              sBookedDate: general.sBookedDate,
              // Plot / Flat / Villa guide value breakdown
              plotGuideValue: general.plotGuideValue
                ? {
                    guideRateSqFt: general.plotGuideValue.guideRateSqFt ?? null,
                    guideLandValue: general.plotGuideValue.guideLandValue ?? null,
                    landValue: general.plotGuideValue.landValue ?? null,
                    regValue: general.plotGuideValue.regValue ?? null,
                    additionalCharges: general.plotGuideValue.additionalCharges ?? null,
                    totalValue: general.plotGuideValue.totalValue ?? null,
                  }
                : null,
              // Documents related to plot/flat/villa
              saleDeedDoc: general.saleDeedDoc || null,
              motherDoc: general.motherDoc || null,
              // Legacy / denormalized identifiers
              supplierCode: general.supplierCode || null,
              sPartyCode: general.sPartyCode || null,
              sMarketerId: general.sMarketerId || null,
              customerName: general.customerName || null,
              createdOn: general.createdOn || null,
              modifiedOn: general.modifiedOn || null,
              editDeleteReason: general.editDeleteReason || null,
              project: general.project || null,
            }
          : null,

        emiSchedule,
        billingHistory,

        summary: {
          totalAmount,
          totalPaid,
          totalBalance,
          totalEmis,
          emisPaid,
          emisPending,
          totalEmiAmountScheduled,
          totalBillingPaid,
        },
      },
    });
  } catch (error: any) {
    console.error("Get customer overall detail error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error: " + error.message,
    });
  }
};
