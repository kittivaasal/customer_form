import { Request, Response } from "express";
import httpStatus from "http-status";
import { Customer } from "../models/customer.model";
import plotBookingFormModel from "../models/plotBookingForm.model";
import { isEmail, isNull, isPhone, ReE, ReS, toAutoIncrCode, toAwait } from "../services/util.service";
import { IPlotBookingForm } from "../type/plotBookingForm";
import { toLowerCaseObj } from "./common";
import mongoose from "mongoose";
import { MarketDetail } from "../models/marketDetail.model";
import { MarketingHead } from "../models/marketingHead.model";
import { Project } from "../models/project.model";
import { Counter } from "../models/counter.model";
import { IProject } from "../type/project";

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

    let fields = [ "mobileNo", /* "email", */ "nameOfCustomer", "ddId" ];
    let inVaildFields = fields.filter(x => isNull(body[x]));
    if (inVaildFields.length > 0) {
        return ReE(res, { message: `Please enter required fields ${inVaildFields}!.` }, httpStatus.BAD_REQUEST);
    }
    let { mobileNo, email, pincode, address, nameOfCustomer, ddId, cedId, projectId } = body
    // if(!isEmail(email)) {
    //     return ReE(res, { message: `Invalid email!.` }, httpStatus.BAD_REQUEST)
    // }
    if(!projectId){
        return ReE(res, { message: `projectId is required!.` }, httpStatus.BAD_REQUEST)
    }
    if (!isPhone(mobileNo)) {
        return ReE(res, { message: `Invalid mobile number!.` }, httpStatus.BAD_REQUEST)
    }

    if (!mongoose.isValidObjectId(ddId)) {
        return ReE(res, { message: `Invalid ddId!.` }, httpStatus.BAD_REQUEST);
    }

    if (cedId) {
        if (!mongoose.isValidObjectId(cedId)) {
            return ReE(res, { message: `Invalid cedId!.` }, httpStatus.BAD_REQUEST);
        }
        let checkCed;
        [err, checkCed] = await toAwait(MarketDetail.findOne({ _id: cedId }))
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!checkCed) {
            return ReE(res, { message: `ced not found for this cedId, id is ${cedId}!..` }, httpStatus.BAD_REQUEST);
        }
    }

    let checkDD;
    [err, checkDD] = await toAwait(MarketingHead.findOne({ _id: ddId }))
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!checkDD) {
        return ReE(res, { message: `dd not found for this ddId, id is ${ddId}!..` }, httpStatus.BAD_REQUEST);
    }
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

    if (!mongoose.isValidObjectId(projectId)) {
        return ReE(res, { message: `Invalid projectId!.` }, httpStatus.BAD_REQUEST);
    }
    let checkProject;
    [err, checkProject] = await toAwait(Project.findOne({ _id: projectId }))
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!checkProject) {
        return ReE(res, { message: `project not found for this projectId, id is ${projectId}!..` }, httpStatus.BAD_REQUEST);
    }
    checkProject = checkProject as IProject;
    let id = checkProject?.shortName ? checkProject?.shortName.endsWith("-") ? checkProject?.shortName : checkProject?.shortName + "-" : toAutoIncrCode(checkProject?.projectName);
    let getCustomerCounter, count = 1;
    [err, getCustomerCounter] = await toAwait(Counter.findOne({ name: "customerid" }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getCustomerCounter) {
        let newCounter = new Counter({ name: "customerid", seq: 1 });
        await newCounter.save();
    } else {
        getCustomerCounter = getCustomerCounter as any;
        count = getCustomerCounter.seq + 1;
        let updateCustomerCounter;
        [err, updateCustomerCounter] = await toAwait(
            Counter.updateOne({ name: "customerid" }, { $set: { seq: count } })
        )
    }
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    body.id = id + count.toString().padStart(4, '0');

    let plotBookingForm;
    [err, plotBookingForm] = await toAwait(plotBookingFormModel.create({...body, referenceId, scheme }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!plotBookingForm) {
        return ReE(res, { message: `Failed to create plotBookingForm!` }, httpStatus.INTERNAL_SERVER_ERROR);
    }

    let customer;
    [err, customer] = await toAwait(Customer.create({
        phone:mobileNo,
        email,
        name : nameOfCustomer,
        pincode,
        id: body?.id,
        ddId,
        cedId,
        address,
        projectId,
        referenceId
    }));

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!customer) {
        return ReE(res, { message: `Failed to create customer!.` }, httpStatus.INTERNAL_SERVER_ERROR)
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