import { Request, Response } from "express";
import { ReE, ReS, toAwait } from "../services/util.service";
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


export const approvedBillingRequest = async (req: CustomRequest, res: Response) => {

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

    // if (getBillingRequest.status === "approved") {
    //     return ReE(res, { message: "billing request already approved" }, httpStatus.BAD_REQUEST);
    // }

    let date = new Date();

    // let approvedAt: Date | null = null;
    // let approvedUntil: Date | null = null;
    // let approvedHours: number | null = null;

    if (getBillingRequest.requestFor === "create") {

        let cutomer = getBillingRequest.emi[0].customer as any;
        let checkGeneral = getBillingRequest.emi[0].general as any;

        if (getBillingRequest.requestFor === "create" && status === "approved") {

            let readyForBill = getBillingRequest.emi as IEmi[];

            for (let i = 0; i < readyForBill.length; i++) {
                let element = readyForBill[i];

                let getAllBill, balanceAmount;
                [err, getAllBill] = await toAwait(
                    Billing.find({ general: element.general, customer: element.customer })
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
                    introducer: checkGeneral.marketer,
                    mobileNo: cutomer.phone,
                    customer: cutomer._id,
                    general: element.general,
                    status: getBillingRequest.billingDetails.status,
                    modeOfPayment: getBillingRequest.billingDetails.modeOfPayment,
                    cardNo: getBillingRequest.billingDetails.cardNo,
                    cardHolderName: getBillingRequest.billingDetails.cardHolderName,
                    remarks: getBillingRequest.billingDetails.remarks,
                    balanceAmount: balanceAmount,
                    customerName: cutomer.name,
                    emi: element._id,
                };

                let getMarketerHead;
                [err, getMarketerHead] = await toAwait(
                    MarketingHead.findOne({ _id: checkGeneral.marketer }).populate("percentageId")
                );
                if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
                if (!getMarketerHead) {
                    return ReE(
                        res,
                        { message: "emi inside marketer head not found" },
                        httpStatus.BAD_REQUEST
                    );
                }

                let checkAlreadyExist = await Billing.findOne({
                    emi: element._id,
                    general: element.general,
                    customer: cutomer._id,
                });

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
                    return ReE(res, { message: `billing already exist for this emi no ${element.emiNo} for this customer please try again!` }, httpStatus.BAD_REQUEST);
                }

                let billing;
                [err, billing] = await toAwait(Billing.create(createBill));
                if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

                billing = billing as IBilling;

                getMarketerHead = getMarketerHead as IMarketingHead | any;

                let marketerDe: any = {
                    customer: cutomer._id,
                    emiNo: element?.emiNo,
                    paidDate: billing.paymentDate,
                    paidAmt: billing.amountPaid,
                    marketer: billing.introducer,
                    emiId: element._id,
                    generalId: checkGeneral._id,
                    marketerHeadId: checkGeneral.marketer,
                    percentageId: getMarketerHead.percentageId,
                };

                let checkAlreadyExistMarketer = await Marketer.findOne({
                    marketer: marketerDe.marketer,
                    emiId: marketerDe.emiId,
                    general: marketerDe.general,
                });

                if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
                if (!checkAlreadyExistMarketer) {
                    if (getMarketerHead?.percentageId?.rate) {
                        let percent = Number(
                            getMarketerHead?.percentageId?.rate?.replace("%", "")
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

        if (!Number.isInteger(hours) || hours < 1 || hours > 12) {
            return ReE(
                res,
                { message: "Validity must be between 1 and 12 hours" },
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

}

export const getAllBillingRequest = async (req: CustomRequest, res: Response) => {
    let err, getBillingRequest, totalCount;
    const query = req.query;
    const option: any = {};

    let { status, limit, page } = query;

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

export const checkValidity = async (req: CustomRequest, res: Response) => {
    let err, getBillingRequest, user = req.user as IUser;
    // const { id } = req.params;

    // if (!mongoose.isValidObjectId(id)) {
    //     return ReE(res, { message: `Invalid billing request id!` }, httpStatus.BAD_REQUEST);
    // }

    [err, getBillingRequest] = await toAwait(
        BillingRequest.findOne(
            {
                userId: user._id,
                createAt: new Date()
            }
        )
    );

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    if (!getBillingRequest) {
        return ReE(res, { message: "billing request not found for today for this user!" }, httpStatus.NOT_FOUND);
    }

    getBillingRequest = getBillingRequest as IBillingRequest

    if (getBillingRequest.status !== "approved") {
        return ReE(res, { message: "billing request not approved!" }, httpStatus.NOT_FOUND);
    }

    if (!getBillingRequest.approvedValidity) {
        return ReE(res, { message: "billing request not approved!" }, httpStatus.NOT_FOUND);
    }

    let check = moment(getBillingRequest.approvedValidity).isBefore(new Date());

    if (check) {
        return ReE(res, { message: "billing request expired!" }, httpStatus.NOT_FOUND);
    }

    return ReS(res, { message: "billing request found", data: check }, httpStatus.OK);

    // let check = moment(getBillingRequest.approvedValidity).isBefore(new Date());

    // return ReS(res, { message: "billing request found", data: check }, httpStatus.OK);

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
    [err, approvedRequest] = await toAwait(
        BillingRequest.find({
            userId: user._id,
            excelFromDate: new Date(dateFrom as string),
            excelToDate: new Date(dateTo as string),
            requestFor: "excel",
            status: "approved",
            approvedTime: { $gte: now.toDate() }
        })
    )

    approvedRequest = approvedRequest as IBillingRequest[];

    if (approvedRequest.length > 0) {
        return ReE(res, { message: "Your request for this date is already approved and not expired" }, httpStatus.BAD_REQUEST);
    }

    // approvedRequest.forEach((request: IBillingRequest) => {

    //     const approvedTime = request.approvedTime;
    
    //     if (!approvedTime) {
    //         return ReE(
    //             res,
    //             { message: "Approval time not found" },
    //             httpStatus.BAD_REQUEST
    //         );
    //     }
    
    //     // Convert stored time to moment
    //     const expiryTime = moment(new Date(approvedTime));
    
    //     // Current time
    //     const now = moment();
    
    //     // Check if expired
    //     if (!now.isAfter(expiryTime)) {
    //         return ReE(res, { message: "Excel download request already approved for this date has not expired" }, httpStatus.FORBIDDEN);
    //     }

    // })

    //create request
    let createRequest;
    [err, createRequest] = await toAwait(
        BillingRequest.create({
            userId: user._id,
            status: "pending",
            message: `This user ${user._id} want to get billing report from ${dateFrom} to ${dateTo}`,
            requestFor: "excel",
            excelFromDate: new Date(dateFrom as string),
            excelToDate: new Date(dateTo as string)
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
    [err, checkRequest] = await toAwait(
        BillingRequest.findOne({
            userId: user._id,
            excelFromDate: new Date(dateFrom as string),
            excelToDate: new Date(dateTo as string),
            requestFor: "excel",
        })
    )

    checkRequest = checkRequest as IBillingRequest;
    if (!checkRequest) {
        return ReE(res, { message: "Your request for this date is not found" }, httpStatus.BAD_REQUEST);
    }

    if(checkRequest.status === "pending") {
        return ReE(res, { message: "Your request for this date is pending" }, httpStatus.BAD_REQUEST);
    }

    if (moment().isAfter(moment(checkRequest.approvedTime))) {
        return ReE(res, { message: "Excel download request already approved for this date has expired", expired: true }, httpStatus.FORBIDDEN);
    }

    return ReS(res, { message: "Your request for this date is found", expired: false }, httpStatus.OK);

}

