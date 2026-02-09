import { Request, Response } from "express";
import httpStatus from "http-status";
import { Customer } from "../models/customer.model";
import plotBookingFormModel from "../models/plotBookingForm.model";
import { isNull, isPhone, ReE, ReS, toAwait } from "../services/util.service";
import { IPlotBookingForm } from "../type/plotBookingForm";
import { toLowerCaseObj } from "./common";
import mongoose from "mongoose";

export const createPlotBookingForm = async (req: Request, res: Response) => {
    let err;
    let photo;
    let referenceId = req.body.referenceId; // Extract before lowercase conversion
    let scheme = req.body.scheme;
    if(req.body.photo){
        photo = req.body.photo
        delete req.body.photo
    }
    let body = toLowerCaseObj(req.body);
    if(referenceId) {
        body.referenceId = referenceId; // Add back with correct casing
    }

    
    let fields = [ "mobileNo", "email", "nameOfCustomer" ];
    let inVaildFields = fields.filter(x => isNull(body[x]));
    if (inVaildFields.length > 0) {
        return ReE(res, { message: `Please enter required fields ${inVaildFields}!.` }, httpStatus.BAD_REQUEST);
    }
    let { mobileNo, email, pincode, address, nameOfCustomer } = body
    if (!isPhone(mobileNo)) {
        return ReE(res, { message: `Invalid mobile number!.` }, httpStatus.BAD_REQUEST)
    }
    // 🔍 check for duplicate with all provided fields
    let checkAlready;
    [err, checkAlready] = await toAwait(plotBookingFormModel.findOne(body));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (checkAlready) {
        return ReE(res, { message: `This plotBookingForm already exists.` }, httpStatus.BAD_REQUEST);
    }
    email = email.trim().toLowerCase();
    if(photo){
        body.photo = photo;
    }
    let plotBookingForm;
    [err, plotBookingForm] = await toAwait(plotBookingFormModel.create({...body, referenceId, scheme }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!plotBookingForm) {
        return ReE(res, { message: `Failed to create plotBookingForm!` }, httpStatus.INTERNAL_SERVER_ERROR);
    }

    let checkCustomer;
    [err,checkCustomer] = await toAwait(Customer.findOne({email, phone:mobileNo}))

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    
    if (!checkCustomer) {
        let customer;
        [err, customer] = await toAwait(Customer.create({
            phone:mobileNo,
            email,
            name : nameOfCustomer,
            pincode, 
            address,
            referenceId
        }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!customer) {
            return ReE(res, { message: `Failed to create customer!.` }, httpStatus.INTERNAL_SERVER_ERROR)
        }
    }

    return ReS(res, { message: "plotBookingForm created successfully" }, httpStatus.OK);
};


export const getAllPlotBookingForms = async (req: Request, res: Response) => {

    let err, getAll;
    let { page = "1", limit = "10", search } = req.query;

    let filter: any = {};

    if (search) {
        const searchString = search as string;
        const searchConditions: any[] = [
            { nameOfCustomer: { $regex: searchString, $options: "i" } },
            { mobileNo: { $regex: searchString, $options: "i" } },
            { email: { $regex: searchString, $options: "i" } },
            { plotNo: { $regex: searchString, $options: "i" } },
            { referenceId: { $regex: searchString, $options: "i" } },
            { scheme: { $regex: searchString, $options: "i" } }
        ];

        if (mongoose.Types.ObjectId.isValid(searchString)) {
            searchConditions.push({ _id: new mongoose.Types.ObjectId(searchString) });
        }

        if (filter.$or) {
            filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
            delete filter.$or;
        } else {
            filter.$or = searchConditions;
        }
    }

    let count;
    [err, count] = await toAwait(plotBookingFormModel.countDocuments(filter));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    let pagination: any = {};

    if (page && limit) {
        let pageNum = parseInt(page as string) || 1;
        let limitNum = parseInt(limit as string) || 10;
        let skip = (pageNum - 1) * limitNum;
        let lastPageNo = Math.ceil((count as number) / limitNum);

        [err, getAll] = await toAwait(plotBookingFormModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum));

        pagination = {
            totalItems: count,
            currentPage: pageNum,
            totalPages: lastPageNo,
            pageSize: limitNum,
            hasNextPage: pageNum < lastPageNo,
            hasPrevPage: pageNum > 1
        };

    } else {
        [err, getAll] = await toAwait(plotBookingFormModel.find(filter).sort({ createdAt: -1 }));
    }

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    return ReS(res, { message: "plotBookingForm fetched", data: getAll, pagination }, httpStatus.OK)

}