import { Request, Response } from "express";
import { isValidDate, ReE, ReS, toAwait } from "../services/util.service";
import CustomRequest from "../type/customRequest";
import { IUser } from "../type/user";
import httpStatus from "http-status";
import mongoose from "mongoose";
import { BillingRequest } from "../models/billingRequest.model";
import { IBillingRequest } from "../type/billingRequest";
import { Billing } from "../models/billing.model";
import { IBilling } from "../type/billing";
import { Marketer } from "../models/marketer";
import { IEmi } from "../type/emi";
import { MarketingHead } from "../models/marketingHead.model";
import { Emi } from "../models/emi.model";
import { IMarketingHead } from "../type/marketingHead";
import moment from "moment";
import { Customer } from "../models/customer.model";
import { General } from "../models/general.model";
import { MarketDetail } from "../models/marketDetail.model";


export const approvedBillingRequest = async (req: CustomRequest, res: Response) => {

  try {

    let err, user = req.user as IUser, body = req.body;

    if (!user) {
      return ReE(res, { message: "Unauthorized your not do this" }, httpStatus.UNAUTHORIZED);
    }

    let { id, status, validity } = body;

    let statusValid = ["approved", "rejected"]

    status = status.toLowerCase().trim();

    if (!statusValid.includes(status)) {
      return ReE(res, { message: `Invalid status value valid value are (${statusValid})` }, httpStatus.BAD_REQUEST);
    }

    if (!mongoose.isValidObjectId(id)) {
      return ReE(res, { message: "Invalid billing request id" }, httpStatus.BAD_REQUEST);
    }

    let getBillingRequest;
    [err, getBillingRequest] = await toAwait(BillingRequest.findOne({ _id: id }).populate({
      path: "emi",
      populate: [
        { path: "general" },
        { path: "customer" }
      ]
    }));

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    if (!getBillingRequest) {
      return ReE(res, { message: "billing request not found for given id" }, httpStatus.NOT_FOUND);
    }

    getBillingRequest = getBillingRequest as any;

    
    if (getBillingRequest.requestFor === "create") {
      if (getBillingRequest.status === "approved") {
        return ReE(res, { message: "billing request already approved" }, httpStatus.BAD_REQUEST);
      }

      let oldData = getBillingRequest.emi[0].oldData;

      let checkCustomer;
      let checkGeneral;
      //replace oldData
      // if (oldData) {
      //   let getCustomer;
      //   [err, getCustomer] = await toAwait(Customer.findOne({ id: getBillingRequest?.emi[0]?.supplierCode }));
      //   if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
      //   checkCustomer = getCustomer as any;
      //   let getGeneral;
      //   [err, getGeneral] = await toAwait(General.findOne({ supplierCode: getBillingRequest?.emi[0]?.supplierCode, oldData: true }));
      //   if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
      //   checkGeneral = getGeneral as any;
      // } else {

        checkCustomer = getBillingRequest.emi[0].customer as any;
        checkGeneral = getBillingRequest.emi[0].general as any;
      // }

      if (getBillingRequest.requestFor === "create" && status === "approved") {

        let readyForBill = getBillingRequest.emi as IEmi[];

        for (let i = 0; i < readyForBill.length; i++) {
          let element = readyForBill[i];

          let getAllBill, balanceAmount;
          [err, getAllBill] = await toAwait(
            Billing.find({
              $or: [
                { customer: checkCustomer._id },
                { customerCode: checkCustomer.id, oldData: true },
              ]
            })
          );
          if (err) {
            return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
          }
          getAllBill = getAllBill as IBilling[];
          let totalAmount = checkGeneral.emiAmount! * checkGeneral.noOfInstallments!;
          if (getAllBill.length === 0) {
            balanceAmount = isNaN(totalAmount) ? element.emiAmt : totalAmount - element.emiAmt;
          } else {
            let total = getAllBill.reduce((acc, curr) => acc + curr.amountPaid, 0);
            balanceAmount = totalAmount - (total + element.emiAmt);
          }

          let createBill = {
            emiNo: element.emiNo,
            amountPaid: element.emiAmt,
            paymentDate: new Date(getBillingRequest?.billingDetails?.paymentDate || new Date()),
            transactionType: "EMI Receipt",
            introducer: checkGeneral?.marketer,
            introducerByModel: checkGeneral?.marketerByModel,
            mobileNo: checkCustomer?.phone,
            customer: checkCustomer._id,
            general: element.general,
            status: getBillingRequest.billingDetails.status,
            saleType: getBillingRequest.billingDetails.saleType,
            modeOfPayment: getBillingRequest.billingDetails.modeOfPayment,
            cardNo: getBillingRequest.billingDetails.cardNo,
            cardHolderName: getBillingRequest.billingDetails.cardHolderName,
            remarks: getBillingRequest.billingDetails.remarks,
            referenceId: getBillingRequest.billingDetails.referenceId,
            balanceAmount: balanceAmount,
            customerName: checkCustomer?.name,
            emi: element?._id,
            oldData,
            billFor: getBillingRequest.billingDetails.billFor,
            customerCode: checkCustomer.id,
            createdBy: getBillingRequest?.userId || getBillingRequest?.userId?._id
          };

          let getMarketer;
          if (!checkCustomer.oldData) {
            [err, getMarketer] = await toAwait(
              MarketDetail.findOne({ _id: checkGeneral.marketer }).populate({
                path: "headBy",
                populate: [
                  { path: "percentageId" }
                ]
              })
            );
            if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
            if (!getMarketer) {
              let checkMarketerHead;
              [err, checkMarketerHead] = await toAwait(
                MarketingHead.findOne({ _id: checkGeneral.marketer }).populate("percentageId")
              );

              if (err) {
                return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
              }

              if (!checkMarketerHead && !getMarketer) {
                return ReE(res, { message: "In general inside marketer not in marketer head or marketer table not found" }, httpStatus.BAD_REQUEST);
              }
              if (checkMarketerHead) {
                getMarketer = checkMarketerHead
              }

            }
          }

          let checkAlreadyExist;
          if (!oldData) {
            [err, checkAlreadyExist] = await toAwait(Billing.findOne({
              emiNo: element.emiNo, customer: checkCustomer._id
            }));
          } else {
            [err, checkAlreadyExist] = await toAwait(Billing.findOne({
              emiNo: element.emiNo,
              customerCode: checkCustomer.id,
              oldData: true
            }));
          }

          if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
          if (checkAlreadyExist) {
            checkAlreadyExist = checkAlreadyExist as IBilling | any
            let updateEmiPaid;
            [err, updateEmiPaid] = await toAwait(
              Emi.updateOne(
                { _id: checkAlreadyExist?.emi },
                { $set: { paidDate: checkAlreadyExist?.paymentDate } }
              )
            )
            if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
            // return ReE(res, { message: `billing already exist for this emi no ${element.emiNo} for this customer please try again!` }, httpStatus.BAD_REQUEST);
          } else {

            let billing;
            [err, billing] = await toAwait(Billing.create(createBill));
            if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

            billing = billing as IBilling;
            getMarketer = getMarketer as any;


            let checkAlreadyExistMarketer
            //replace oldData
            // if (!checkCustomer.oldData) {
              let marketerDe: any = {
                customer: checkCustomer._id,
                emiNo: element?.emiNo,
                paidDate: billing.paymentDate,
                paidAmt: billing.amountPaid,
                marketer: billing.introducer,
                emiId: element._id,
                generalId: checkGeneral._id,
                marketerHeadId: checkGeneral.getMarketer?.headBy?._id || getMarketer?._id,
                percentageId: getMarketer?.headBy?.percentageId?._id || getMarketer?.percentageId?._id,
              };
              [err, checkAlreadyExistMarketer] = await toAwait(Marketer.findOne({
                marketer: marketerDe.marketer,
                emiId: marketerDe.emiId,
                general: marketerDe.general,
              }));

              if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
              if (!checkAlreadyExistMarketer) {
                if (getMarketer?.headBy?.percentageId?.rate?.rate) {
                  let percent = Number(
                    getMarketer?.headBy?.percentageId?.replace("%", "")
                  );
                  let correctPercent = billing.amountPaid * (percent / 100);
                  marketerDe.commPercentage = percent;
                  marketerDe.commAmount = isNaN(correctPercent) ? 0 : correctPercent;
                }
                if (getMarketer?.percentageId?.rate) {
                  let percent = Number(
                    getMarketer?.percentageId?.rate?.replace("%", "")
                  );
                  let correctPercent = billing.amountPaid * (percent / 100);
                  marketerDe.commPercentage = percent;
                  marketerDe.commAmount = isNaN(correctPercent) ? 0 : correctPercent;
                }

                let marketer;
                [err, marketer] = await toAwait(Marketer.create(marketerDe));
                if (err) {
                  return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
                }
              }
            // }

            let updateEmi;
            [err, updateEmi] = await toAwait(
              Emi.findOneAndUpdate(
                { _id: element._id },
                { paidDate: billing.paymentDate, paidAmt: billing.amountPaid },
                { new: true }
              )
            );
            if (err) {
              return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
            }

          }

        }

      }
    }

    let approvedDate: Date | null = null;
    let approvedTime: Date | null = null;
    let approvedHours: number | null = null;

    if (getBillingRequest.requestFor === "excel" && status === "approved") {

      if (validity === undefined || validity === null) {
        return ReE(
          res,
          { message: "Please enter validity (1-12 hours) to download excel" },
          httpStatus.BAD_REQUEST
        );
      }

      const hours = Number(validity);

      if (!Number.isInteger(hours) || hours < 1 || hours > 24) {
        return ReE(
          res,
          { message: "Validity must be between 1 and 24 hours" },
          httpStatus.BAD_REQUEST
        );
      }

      // current time
      const now = moment();

      // add validity hours
      const expiry = now.clone().add(hours, "hours");

      approvedDate = expiry.toDate(); // date + time
      approvedTime = expiry.toDate(); // time included
      approvedHours = hours;

      if(expiry.isBefore(moment())){
        return ReE(
          res,
          { message: "Validity time must be in future" },
          httpStatus.BAD_REQUEST
        );
      }

      if (!moment(approvedDate).isSame(moment(), 'day')) {
        let balanceHours = 24 - moment().hour() - 1;
        console.log("balanceHours", balanceHours, moment(approvedDate).isSame(moment(), 'day'));
        return ReE(
          res,
          { message: `Validity date must be within today date request date ${moment().format("YYYY-MM-DD")} so today balance hours are ${balanceHours}` },
          httpStatus.BAD_REQUEST
        );
      }

    }

    let updateRequest;
    [err, updateRequest] = await toAwait(
      BillingRequest.findOneAndUpdate(
        { _id: getBillingRequest._id },
        {
          $set: {
            status: status,
            approvedDate: approvedDate,
            approvedTime: approvedTime,
            approvedHours: approvedHours,
            approvedBy: user._id
          }
        },
        { new: true }
      )
    );

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    if (!updateRequest) {
      return ReE(res, { message: "billing request not found" }, httpStatus.BAD_REQUEST);
    }

    return ReS(res, { message: `billing request ${status}` }, httpStatus.OK);

  } catch (error) {
    ReE(res, error, httpStatus.INTERNAL_SERVER_ERROR);
  }

}

export const getAllBillingRequest = async (req: CustomRequest, res: Response) => {
  let err, getBillingRequest, totalCount;
  const query = req.query;
  const option: any = {};

  let { status, limit, page, date } = query;

  if (status) {
    status = String(status).toLowerCase().trim();
    const validValue = ["approved", "rejected", "pending"];

    if (!validValue.includes(status)) {
      return ReE(
        res,
        { message: `status value is invalid. valid values are (${validValue})` },
        httpStatus.BAD_REQUEST
      );
    }
    option.status = status;
  }

  if(date){
    if (!isValidDate(date as string)) {
      return ReE(res, { message: "Invalid date format valid format is (YYYY-MM-DD)!" }, httpStatus.BAD_REQUEST);
    }
    const start = moment(date as string).startOf('day').toDate();
    const end = moment(date as string).endOf('day').toDate();
    option.createdAt = { $gte: start, $lte: end };
  }

  let pageNo = Number(page);
  let limitNo = Number(limit);

  pageNo = pageNo < 1 ? 1 : pageNo;
  // limitNo = limitNo > 100 ? 100 : limitNo; // safety cap
  const skip = (pageNo - 1) * limitNo;

  [err, totalCount] = await toAwait(
    BillingRequest.countDocuments(option)
  );

  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

  totalCount = totalCount as number;

  [err, getBillingRequest] = await toAwait(
    BillingRequest.find(option)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNo)
      .populate({
        path: "emi",
        populate: [
          { path: "general" },
          { path: "customer" }
        ]
      }).populate("userId").populate("approvedBy")
  );

  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

  if (!getBillingRequest) {
    return ReE(res, { message: "billing request not found!" }, httpStatus.NOT_FOUND);
  }

  getBillingRequest = getBillingRequest as IBillingRequest[];

  return ReS(
    res,
    {
      message: "billing request found",
      data: getBillingRequest,
      pagination: {
        page,
        limit: limitNo,
        totalRecords: totalCount,
        totalPages: Math.ceil(totalCount / limitNo)
      }
    },
    httpStatus.OK
  );
};


export const getBillingRequestByID = async (req: Request, res: Response) => {
  let err, getBillingRequest;
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return ReE(res, { message: `Invalid billing request id!` }, httpStatus.BAD_REQUEST);
  }

  [err, getBillingRequest] = await toAwait(
    BillingRequest.findById(id)
      .populate({
        path: "emi",
        populate: [
          { path: "general" },
          { path: "customer" }
        ]
      }).populate("userId").populate("approvedBy")
  );

  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

  if (!getBillingRequest) {
    return ReE(res, { message: "billing request not found for given id!" }, httpStatus.NOT_FOUND);
  }

  return ReS(res, { message: "billing request found", data: getBillingRequest }, httpStatus.OK);

}


export const createBillingRequestForExcel = async (req: CustomRequest, res: Response) => {
  let err, body = req.body, user = req.user as IUser;

  if (!user) {
    return ReE(res, { message: "Unauthorized your not do this" }, httpStatus.UNAUTHORIZED);
  }

  if (user.isAdmin) {
    return ReE(res, { message: "Do need request for download excel for admin" }, httpStatus.BAD_REQUEST);
  }

  let fields = ["dateFrom", "dateTo"];

  let invalidFields = fields.filter((field) => !body[field]);

  if (invalidFields.length > 0) {
    return ReE(res, { message: `Please enter required fields ${invalidFields}!.` }, httpStatus.BAD_REQUEST);
  }

  let { dateFrom, dateTo } = body;

  if (!isValidDate(dateFrom)) {
    return ReE(res, { message: "Invalid date format for dateFrom valid format is (YYYY-MM-DD)!" }, httpStatus.BAD_REQUEST);
  }

  if (!isValidDate(dateTo)) {
    return ReE(res, { message: "Invalid date format for dateTo valid format is (YYYY-MM-DD)!" }, httpStatus.BAD_REQUEST);
  }

  let checkRequest;
  [err, checkRequest] = await toAwait(
    BillingRequest.findOne({
      userId: user._id,
      excelFromDate: new Date(dateFrom as string),
      excelToDate: new Date(dateTo as string),
      requestFor: "excel",
      status: "pending"
    })
  )

  checkRequest = checkRequest as IBillingRequest;
  if (checkRequest) {
    return ReE(res, { message: "Your request for this date is pending" }, httpStatus.BAD_REQUEST);
  }

  //get all approved request
  let approvedRequest;
  const now = moment();

  let startDate = moment(dateFrom as string).startOf('day').toDate();
  let endDate = moment(dateTo as string).endOf('day').toDate();
  [err, approvedRequest] = await toAwait(
    BillingRequest.findOne({
      userId: user._id,
      excelFromDate: new Date(dateFrom as string),
      excelToDate: new Date(dateTo as string),
      requestFor: "excel",
      status: "approved",
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    })
  )

  approvedRequest = approvedRequest as IBillingRequest;

  if (approvedRequest) {
    return ReE(res, { message: "Your request for this date for today" }, httpStatus.BAD_REQUEST);
  }

  let createRequest;
  [err, createRequest] = await toAwait(
    BillingRequest.create({
      userId: user._id,
      status: "pending",
      message: `This user ${user.name} want to get billing report from ${dateFrom} to ${dateTo}`,
      requestFor: "excel",
      excelFromDate: new Date(dateFrom as string),
      excelToDate: new Date(dateTo as string),
    })
  )

  return ReS(res, { message: "Billing request created successfully" }, httpStatus.OK);

}

export const checkBillingRequestForExcel = async (req: CustomRequest, res: Response) => {
  let err, body = req.body, user = req.user as IUser;

  if (!user) {
    return ReE(res, { message: "Unauthorized your not do this" }, httpStatus.UNAUTHORIZED);
  }

  if (user.isAdmin) {
    return ReE(res, { message: "Do need request for download excel for admin" }, httpStatus.BAD_REQUEST);
  }

  let fields = ["dateFrom", "dateTo"];

  let invalidFields = fields.filter((field) => !body[field]);

  if (invalidFields.length > 0) {
    return ReE(res, { message: `Please enter required fields ${invalidFields}!.` }, httpStatus.BAD_REQUEST);
  }

  let { dateFrom, dateTo } = body;

  let checkRequest;
  let startDate = moment(dateFrom as string).startOf('day').toDate();
  let endDate = moment(dateTo as string).endOf('day').toDate();
  [err, checkRequest] = await toAwait(
    BillingRequest.findOne({
      userId: user._id,
      excelFromDate: new Date(dateFrom as string),
      excelToDate: new Date(dateTo as string),
      requestFor: "excel",
      approvedDate: {
        $gte: startDate,
        $lte: endDate
      }
    })
  )

  checkRequest = checkRequest as IBillingRequest;
  if (!checkRequest) {
    return ReE(res, { message: "Your request for this date's is not found for today" }, httpStatus.BAD_REQUEST);
  }

  if (checkRequest.status === "pending") {
    return ReE(res, { message: "Your request for this date is pending" }, httpStatus.BAD_REQUEST);
  }

  if (moment().isAfter(moment(checkRequest.approvedTime))) {
    return ReS(res, { message: "Excel download request already approved for this date has expired please contact admin to extend the validity", expired: true }, httpStatus.OK);
  }

  return ReS(res, { message: "Your request for this date is found", expired: false }, httpStatus.OK);

}

export const getAllTheirBillingRequest = async (req: CustomRequest, res: Response) => {
  let err, user = req.user as IUser;

  if (!user) {
    return ReE(res, { message: "Unauthorized your not do this" }, httpStatus.UNAUTHORIZED);
  }

  if (user.isAdmin) {
    return ReE(res, { message: "Do need request for download excel for admin" }, httpStatus.BAD_REQUEST);
  }

  let { status, page, limit } = req.query;

  let option: any = {};

  if (status) {
    let statusValue = ["pending", "approved", "rejected"];
    status = String(status).toLowerCase().trim();
    if (!statusValue.includes(status.toString().toLowerCase())) {
      return ReE(res, { message: `Invalid status detail, valid type is (${statusValue}) in query` }, httpStatus.BAD_REQUEST);
    }
    option.status = status;
  }

  option.userId = user._id;

  let pageNo = Number(page);
  let limitNo = Number(limit);

  pageNo = pageNo < 1 ? 1 : pageNo;
  // limitNo = limitNo > 100 ? 100 : limitNo; // safety cap
  const skip = (pageNo - 1) * limitNo;

  let totalCount, getBillingRequest;
  [err, totalCount] = await toAwait(
    BillingRequest.countDocuments(option)
  );

  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

  totalCount = totalCount as number;

  [err, getBillingRequest] = await toAwait(
    BillingRequest.find(option)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNo)
      .populate({
        path: "emi",
        populate: [
          { path: "general" },
          { path: "customer" }
        ]
      }).populate("userId").populate("approvedBy")
  );

  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

  if (!getBillingRequest) {
    return ReE(res, { message: "billing request not found!" }, httpStatus.NOT_FOUND);
  }

  getBillingRequest = getBillingRequest as IBillingRequest[];

  return ReS(
    res,
    {
      message: "billing request found",
      data: getBillingRequest,
      pagination: {
        page,
        limit: limitNo,
        totalRecords: totalCount,
        totalPages: Math.ceil(totalCount / limitNo)
      }
    },
    httpStatus.OK
  );

}


