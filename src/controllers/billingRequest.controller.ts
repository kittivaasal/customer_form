import { Request, Response } from "express";
import httpStatus from "http-status";
import moment from "moment";
import mongoose from "mongoose";
import { Billing } from "../models/billing.model";
import { BillingRequest } from "../models/billingRequest.model";
import { Customer } from "../models/customer.model";
import { Emi } from "../models/emi.model";
import { General } from "../models/general.model";
import { User } from "../models/user.model";
import { isValidDate, ReE, ReS, toAwait } from "../services/util.service";
import { IBilling } from "../type/billing";
import { IBillingRequest } from "../type/billingRequest";
import { ICustomer } from "../type/customer";
import CustomRequest from "../type/customRequest";
import { IEmi } from "../type/emi";
import { IGeneral } from "../type/general";
import { IUser } from "../type/user";
import { get } from "http";
import { convertCommissionToMarketer } from "./common.controller";
import { CustomerEmiModel } from "../models/commision.model";


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

      if (getBillingRequest.status === "approved" ) {
        return ReE(res, { message: "billing request already approved" }, httpStatus.BAD_REQUEST);
      }

      if (getBillingRequest.status === "rejected") {
        return ReE(res, { message: "billing request already in rejected status" }, httpStatus.BAD_REQUEST);
      }

      let oldData = getBillingRequest.emi[0]?.oldData;

      let checkCustomer;
      let checkGeneral;
      let customerId;

      if(getBillingRequest?.customerId){
        customerId = getBillingRequest.customerId
      }else{
        customerId = (getBillingRequest.emi[0]?.customer && (getBillingRequest.emi[0]?.customer as any)._id) ? (getBillingRequest.emi[0].customer as any)._id : getBillingRequest.emi[0]?.customer;
      }
      

      let getCustomer;
      [err, getCustomer] = await toAwait(Customer.findOne({ _id: customerId }));
      if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
      if (!getCustomer) return ReE(res, { message: "Customer not found" }, httpStatus.NOT_FOUND);
      checkCustomer = getCustomer as ICustomer;

      let getGeneral;
      [err, getGeneral] = await toAwait(General.findOne({ customer: checkCustomer._id }));
      if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
      if (!getGeneral) return ReE(res, { message: "General info not found" }, httpStatus.NOT_FOUND);
      checkGeneral = getGeneral as IGeneral;

      if (getBillingRequest.requestFor === "create" && status === "approved") {

        let readyForBill = getBillingRequest.emi as IEmi[];

        if (getBillingRequest.billingDetails?.housing && getBillingRequest.billingDetails?.parciallyPaid === true) {

          let createBill;
          [err, createBill] = await toAwait(
            Billing.create({
              paymentDate: new Date(getBillingRequest?.billingDetails?.paymentDate || new Date()),
              transactionType: "EMI Receipt",
              introducer: checkCustomer?.ddId,
              introducerByModel: "MarketDetail",
              mobileNo: checkCustomer?.phone,
              customer: checkCustomer._id,
              general: checkGeneral._id,
              status: getBillingRequest.billingDetails.status,
              saleType: getBillingRequest.billingDetails.saleType,
              modeOfPayment: getBillingRequest.billingDetails.modeOfPayment,
              cardNo: getBillingRequest.billingDetails.cardNo,
              cardHolderName: getBillingRequest.billingDetails.cardHolderName,
              remarks: getBillingRequest.billingDetails.remarks,
              referenceId: getBillingRequest.billingDetails.referenceId,
              customerName: checkCustomer?.name,
              oldData : oldData ? oldData : checkCustomer?.oldData,
              billFor: getBillingRequest.billingDetails.billFor,
              customerCode: checkCustomer.id,
              createdBy: getBillingRequest?.userId || getBillingRequest?.userId?._id,
              enteredAmount: getBillingRequest.billingDetails.enteredAmount,
            })
          );
          if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

          if (!createBill) {
            return ReE(
              res,
              { message: "billing not created" },
              httpStatus.INTERNAL_SERVER_ERROR
            );
          }

          createBill = createBill as IBilling;

          let updateCustomer;
          [err, updateCustomer] = await toAwait(
            Customer.updateOne({ _id: customerId }, { $inc: { balanceAmount: Number(getBillingRequest.billingDetails.enteredAmount) } })
          );
          if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
          if (!updateCustomer) {
            return ReE(
              res,
              { message: "customer not updated" },
              httpStatus.INTERNAL_SERVER_ERROR
            );
          }

          let am=0
          if(getBillingRequest.billingDetails?.enteredAmount){
            am=getBillingRequest.billingDetails.enteredAmount
          }else{
            if(createBill?.enteredAmount){
              am=createBill?.enteredAmount
            }else{
              am=createBill?.amountPaid
            }
          }

          let getCommission = await convertCommissionToMarketer(checkCustomer, am)
  
          if (!getCommission.success) return ReE(res, { message: getCommission.message }, httpStatus.INTERNAL_SERVER_ERROR);
  
          let createCommission;
          [err, createCommission] = await toAwait(
            CustomerEmiModel.create({
              bill: createBill?._id,
              customer: customerId,
              emiId:  null,
              amount: am,
              marketer: getCommission.data
            })
          );
  
          if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

          if (!createCommission) {
            return ReE(res,{ message: "commission not created" },httpStatus.INTERNAL_SERVER_ERROR);
          }

          let updateBillRequest;
          [err, updateBillRequest] = await toAwait(
            BillingRequest.updateOne(
              { _id: getBillingRequest._id },
              { $set: { status: "approved" } }
            )
          )

          if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

          if (!updateBillRequest) {
            return ReE(
              res,
              { message: "billing request not updated" },
              httpStatus.INTERNAL_SERVER_ERROR
            );
          }

          return ReS(res, { message: "billing approved successfully" }, httpStatus.OK);
          
        }

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

          let createBill: any = {
            emiNo: element.emiNo,
            amountPaid: element.emiAmt,
            paymentDate: new Date(getBillingRequest?.billingDetails?.paymentDate || new Date()),
            transactionType: "EMI Receipt",
            introducer: checkCustomer?.ddId,
            introducerByModel: "MarketDetail",
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
            balanceAmount: isNaN(balanceAmount) ? 0 : balanceAmount,
            customerName: checkCustomer?.name,
            emi: element?._id,
            oldData,
            billFor: getBillingRequest.billingDetails.billFor,
            customerCode: checkCustomer.id,
            createdBy: getBillingRequest?.userId || getBillingRequest?.userId?._id,
            enteredAmount: getBillingRequest.billingDetails.enteredAmount
          };

          let getMarketer;

          if (getBillingRequest?.billingDetails?.housing) {
            if (i === 0) {
              createBill.emiCover = readyForBill.map((emi) => emi._id)
              let updateEmis;
              [err, updateEmis] = await toAwait(
                Emi.updateMany(
                  { _id: { $in: createBill.emiCover } },
                  { $set: { paidDate: new Date(createBill.paymentDate) } }
                )
              )

              if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

              if (!updateEmis) {
                return ReE(res, { message: "Failed to update emis" }, httpStatus.INTERNAL_SERVER_ERROR);
              }

            } else {
              continue;
            }
          }

          let checkAlreadyExist;
          [err, checkAlreadyExist] = await toAwait(Billing.findOne({
            emiNo: element.emiNo,
            customerCode: checkCustomer.id,
          }));

          if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
          if (checkAlreadyExist && !getBillingRequest.billingDetails.housing) {
            checkAlreadyExist = checkAlreadyExist as IBilling | any
            let updateEmiPaid;
            [err, updateEmiPaid] = await toAwait(
              Emi.updateOne(
                { _id: checkAlreadyExist?.emi },
                { $set: { paidDate: checkAlreadyExist?.paymentDate, paidAmt: checkAlreadyExist.amountPaid } }
              )
            )
            if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
            let getEmi;
            [err, getEmi] = await toAwait(Emi.findOne({ _id: checkAlreadyExist?.emi }));
            if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
            getEmi = getEmi as IEmi
            if (getEmi?.paidDate) {
              if (i === readyForBill.length - 1) {
                return ReS(res, { message: `billing already exist for this emi no ${readyForBill.map(element => element.emiNo)} for this customer, please try again!` }, httpStatus.BAD_REQUEST);
              }
            }
          } else {

            let billing;
            if (i !== 0 && getBillingRequest.billingDetails.housing) {
              continue;
            }

            [err, billing] = await toAwait(Billing.create(createBill));
            if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

            billing = billing as IBilling;
            getMarketer = getMarketer as any;
          
            let am=0;

            if (getBillingRequest.billingDetails?.housing) {
              am = getBillingRequest.billingDetails.enteredAmount;
            }else{
              am = billing.amountPaid
            }

            let getCommission = await convertCommissionToMarketer(checkCustomer, am)
    
            if (!getCommission.success) return ReE(res, { message: getCommission.message }, httpStatus.INTERNAL_SERVER_ERROR);

            let createCommission;
            [err, createCommission] = await toAwait(
              CustomerEmiModel.create({
                bill: createBill?._id,
                customer: customerId,
                emiId:  null,
                amount: am,
                marketer: getCommission.data
              })
            );
    
            if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

            if (!createCommission) {
              return ReE(res,{ message: "commission not created" },httpStatus.INTERNAL_SERVER_ERROR);
            }

            let updateEmi;

            if (!getBillingRequest.billingDetails.housing) {
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

        let updateCustomer;
        [err, updateCustomer] = await toAwait(
          Customer.updateOne({ _id: customerId }, { $set: { balanceAmount: Number(getBillingRequest.billingDetails?.customerBalanceAmount) } })
        );
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!updateCustomer) {
          return ReE(
            res,
            { message: "customer not updated" },
            httpStatus.INTERNAL_SERVER_ERROR
          );
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

      if (expiry.isBefore(moment())) {
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

    if (status === "rejected") {
      approvedDate = null;
      approvedTime = null;
      approvedHours = null;
    }

    if(getBillingRequest.requestFor === "delete" && status === "approved"){
      
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

  let { status, limit, page, date, search } = query;

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

  if (date) {
    if (!isValidDate(date as string)) {
      return ReE(res, { message: "Invalid date format valid format is (YYYY-MM-DD)!" }, httpStatus.BAD_REQUEST);
    }
    const start = moment(date as string).startOf('day').toDate();
    const end = moment(date as string).endOf('day').toDate();
    option.createdAt = { $gte: start, $lte: end };
  }

  // Search Logic
  if (search) {
    const searchString = search as string;
    const searchConditions: any[] = [];

    // 1. Search in BillingRequest fields
    searchConditions.push(
      { status: { $regex: searchString, $options: "i" } },
      // { message: { $regex: searchString, $options: "i" } } // Optional: search message
    );

    if (mongoose.Types.ObjectId.isValid(searchString)) {
      searchConditions.push({ _id: new mongoose.Types.ObjectId(searchString) });
    }

    // 2. Search in Customer fields (find matching customers first)
    // We assume BillingRequest has a customerId field as per model, or we can look up via aggregation if needed.
    // Based on model: customerId: { type: Schema.Types.ObjectId, ref: "Customer" }

    let customers;
    [err, customers] = await toAwait(Customer.find({
      $or: [
        { name: { $regex: searchString, $options: "i" } },
        { phone: { $regex: searchString, $options: "i" } },
        { email: { $regex: searchString, $options: "i" } },
        { id: { $regex: searchString, $options: "i" } } // Customer custom ID
      ]
    }).select('_id'));

    if (customers && (customers as any[]).length > 0) {
      const customerIds = (customers as any[]).map(c => c._id);
      searchConditions.push({ customerId: { $in: customerIds } });

      // Also check 'emi' -> 'customer' if customerId is not reliably populated on BillingRequest (fallback)
      // But 'find' with 'in' on nested arrays via another collection is hard in a simple query.
      // We'll rely on 'customerId' being present on BillingRequest as per schema.
    }

    // 3. Search in User fields (find matching users)
    let users;
    [err, users] = await toAwait(User.find({
      $or: [
        { name: { $regex: searchString, $options: "i" } },
        { email: { $regex: searchString, $options: "i" } },
        { phone: { $regex: searchString, $options: "i" } }
      ]
    }).select('_id'));

    if (users && (users as any[]).length > 0) {
      const userIds = (users as any[]).map(u => u._id);
      searchConditions.push({ userId: { $in: userIds } });
    }

    if (searchConditions.length > 0) {
      if (option.$or) {
        option.$and = [{ $or: option.$or }, { $or: searchConditions }];
        delete option.$or;
      } else {
        option.$or = searchConditions;
      }
    }
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

  // Handle pagination only if page and limit are provided (backward compatibility logic mostly implies 
  // if not provided, usually return all, but here code had defaults or logic. 
  // The original code calculated skip/limit but didn't enforce if page/limit undefined? 
  // Actually page/limit were 'undefined' -> Number(undefined) is NaN.
  // We should handle that.

  let queryObj = BillingRequest.find(option).sort({ createdAt: -1 }).populate({
    path: "emi",
    populate: [
      { path: "general" },
      { path: "customer" }
    ]
  }).populate("userId").populate("approvedBy").populate("customerId"); // Added populate customerId

  if (page && limit) {
    queryObj = queryObj.skip(skip).limit(limitNo);
  }

  [err, getBillingRequest] = await toAwait(queryObj);

  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

  // if (!getBillingRequest) {
  //   return ReE(res, { message: "billing request not found!" }, httpStatus.NOT_FOUND);
  // }

  getBillingRequest = getBillingRequest as IBillingRequest[];

  return ReS(
    res,
    {
      message: "billing request found",
      data: getBillingRequest,
      ...(page && limit && {
        pagination: {
          page: pageNo,
          limit: limitNo,
          totalRecords: totalCount,
          totalPages: Math.ceil(totalCount / limitNo),
          hasNextPage: pageNo < Math.ceil(totalCount / limitNo),
          hasPreviousPage: pageNo > 1
        }
      })
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


