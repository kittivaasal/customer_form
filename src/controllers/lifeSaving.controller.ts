// controllers/lifeSaving.controller.ts
import { Request, Response } from "express";
import httpStatus from "http-status";
import mongoose from "mongoose";
import { Counter } from "../models/counter.model";
import { Customer } from "../models/customer.model";
import lifeSavingModel from "../models/lifeSaving.model";
import { Project } from "../models/project.model";
import { getEmiDate, isEmail, isNull, isPhone, ReE, ReS, toAutoIncrCode, toAwait } from "../services/util.service";
import { IProject } from "../type/project";
import { toLowerCaseObj } from "./common";
import { MarketingHead } from "../models/marketingHead.model";
import { MarketDetail } from "../models/marketDetail.model";
import { General } from "../models/general.model";
import { ICustomer } from "../type/customer";
import { IGeneral } from "../type/general";
import { Emi } from "../models/emi.model";

export const createLifeSaving = async (req: Request, res: Response) => {
    let payload = toLowerCaseObj(req.body), err, body = req.body;

    let fields = ["data"];
    let inVaildFields = fields.filter(x => isNull(payload[x]));
    if (inVaildFields.length > 0) {
        return ReE(res, { message: `Please enter required fields ${inVaildFields} array!.` }, httpStatus.BAD_REQUEST);
    }

    let { data } = body;
    if (!data || !Array.isArray(data) || data.length === 0) {
        return ReE(res, { message: `Data must be a non-empty array!.` }, httpStatus.BAD_REQUEST);
    }

    for (let i = 0; i < data.length; i++) {
        let element = data[i];
        let fields = ["mobileNo", "email", "nameOfCustomer", "schemeNo", "ddId"];
        let inVaildFields = fields.filter(x => isNull(element[x]));
        if (inVaildFields.length > 0) {
            return ReE(res, { message: `Please enter required fields ${inVaildFields} in data index ${i}!.` }, httpStatus.BAD_REQUEST);
        }

        let { mobileNo, email, projectId, ddId, cedId } = element;

        if (!isEmail(email)) {
            return ReE(res, { message: `Invalid email Id in data index ${i}!.` }, httpStatus.BAD_REQUEST);
        }

        if (!isPhone(mobileNo)) {
            return ReE(res, { message: `Invalid mobile No in data index ${i}!.` }, httpStatus.BAD_REQUEST);
        }

        if (!mongoose.isValidObjectId(projectId)) {
            return ReE(res, { message: `Invalid projectId in data index ${i}!.` }, httpStatus.BAD_REQUEST);
        }

        if (!mongoose.isValidObjectId(ddId)) {
            return ReE(res, { message: `Invalid ddId in data index ${i}!.` }, httpStatus.BAD_REQUEST);
        }

        if (cedId) {
            if (!mongoose.isValidObjectId(cedId)) {
                return ReE(res, { message: `Invalid cedId in data index ${i}!.` }, httpStatus.BAD_REQUEST);
            }
            let checkCed;
            [err, checkCed] = await toAwait(MarketDetail.findOne({ _id: cedId }))
            if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
            if (!checkCed) {
                return ReE(res, { message: `ced not found for this cedId in data index ${i}, id is ${cedId}!..` }, httpStatus.BAD_REQUEST);
            }
        }

        let checkDD;
        [err, checkDD] = await toAwait(MarketingHead.findOne({ _id: ddId }))
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!checkDD) {
            return ReE(res, { message: `dd not found for this ddId in data index ${i}, id is ${ddId}!..` }, httpStatus.BAD_REQUEST);
        }

        let checkProject;
        [err, checkProject] = await toAwait(Project.findOne({ _id: projectId }))
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!checkProject) {
            return ReE(res, { message: `project not found for this projectId in data index ${i}, id is ${projectId}!..` }, httpStatus.BAD_REQUEST);
        }

        checkProject = checkProject as IProject;

        data[i] = element;
        element.projectData = checkProject;

    }

    for (let i = 0; i < data.length; i++) {
        let element = data[i], cusAutoId = '';
        let { mobileNo, email, pincode, communicationAddress, nameOfCustomer } = element;
        let projectData = element.projectData
        delete element.projectData;
        let cretaeLSS;
        [err, cretaeLSS] = await toAwait(lifeSavingModel.create(element));
        if (err){
            console.log(err)
            return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        } 

        if (!cretaeLSS) {
            return ReE(res, { message: `Failed to create LifeSaving in data index ${i}!.` }, httpStatus.INTERNAL_SERVER_ERROR)
        }

        if (projectData?.projectName) {
            let id = projectData?.shortName ? projectData?.shortName.endsWith("-") ? projectData?.shortName : projectData?.shortName + "-" : toAutoIncrCode(projectData?.projectName);
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
            cusAutoId = id + count.toString().padStart(4, '0');
        }


        let createCustomer;
        [err, createCustomer] = await toAwait(Customer.create({
            phone: mobileNo,
            id: cusAutoId,
            email,
            name: nameOfCustomer,
            pincode,
            project: projectData?._id,
            cedId: element.cedId,
            ddId: element.ddId,
            nomineeName: element.nomineeName,
            nomineeAge: element.nomineeAge,
            address: element.communicationAddress
        }))

        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

        if (!createCustomer) {
            return ReE(res, { message: `Failed to create customer in data index ${i}!.` }, httpStatus.INTERNAL_SERVER_ERROR)
        }

        createCustomer = createCustomer as ICustomer

        let checkGeneral;
        [err, checkGeneral] = await toAwait(General.findOne({ project: projectData?._id, customer:createCustomer._id }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        // if (checkGeneral) {
        //     return ReE(res, { message: `General already exist for this project in data index ${i}!.` }, httpStatus.BAD_REQUEST);
        // }

        checkGeneral = checkGeneral as IGeneral

        console.log(projectData?.emiAmount, projectData?.duration, projectData?._id, createCustomer._id)
        let createGeneral;
        // if(!checkGeneral){
            [err, createGeneral] = await toAwait(General.create({
                project: projectData?._id,
                customer: createCustomer._id,
                emiAmount: projectData?.emiAmount,
                noOfInstallments: projectData?.duration ? Number(projectData?.duration) : null
            }))
    
            if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    
            if (!createGeneral) {
                return ReE(res, { message: `Failed to create general in data index ${i}!.` }, httpStatus.INTERNAL_SERVER_ERROR)
            }
            
            createGeneral = createGeneral as IGeneral
        // }


        let newEmis = [];

        for (let i = 0; i < Number(projectData?.duration); i++) {
            newEmis.push({
                customer: createCustomer._id,
                general: createGeneral._id,
                emiNo: i+1,
                emiAmt: projectData.emiAmount,
                date: getEmiDate(i),
                paidDate: null
            });
        }
        
        let inset;
        [err, inset] = await toAwait(Emi.insertMany(newEmis))
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    }

    ReS(res, { message: "LifeSaving created" }, httpStatus.OK);
};

export const getAllLifeSaving = async (req: Request, res: Response) => {

    let err, getAll, query = req.query;
    let filter: any = {};
    let { projectId, pageNo, limit, search } = query;
    if (projectId) {
        if (!mongoose.isValidObjectId(projectId)) {
            return ReE(res, { message: `Invalid projectId!..` }, httpStatus.BAD_REQUEST);
        }
        let checkProject;
        [err, checkProject] = await toAwait(Project.findOne({ _id: projectId }))
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!checkProject) {
            return ReE(res, { message: `project not found for this projectId!..` }, httpStatus.BAD_REQUEST);
        }
        filter.projectId = projectId;
    }

    if (search) {
        const searchString = search as string;
        const searchConditions: any[] = [
            { nameOfCustomer: { $regex: searchString, $options: "i" } },
            { mobileNo: { $regex: searchString, $options: "i" } },
            { email: { $regex: searchString, $options: "i" } },
            { schemeNo: { $regex: searchString, $options: "i" } },
            { idNo: { $regex: searchString, $options: "i" } },

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

    let lifeSavingCount;
    [err, lifeSavingCount] = await toAwait(lifeSavingModel.countDocuments(filter));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    lifeSavingCount = lifeSavingCount as number;

    let pagination: any = {};

    if (pageNo && limit) {
        let page = parseInt(pageNo as string) || 1;
        let lim = parseInt(limit as string) || 10;
        let skip = (page - 1) * lim;
        //get last page no 2 if page No 3 requested send error as last page no is 2
        let lastPageNo = Math.ceil(lifeSavingCount / lim);

        // Handle case where count is 0, lastPageNo will be 0. 
        // If page is 1 and lastPageNo is 0, we shouldn't error, just return empty.
        // But if page > 1 and page > lastPageNo, then error.
        if (page > lastPageNo && lastPageNo > 0) {
            return ReE(res, { message: `Only ${lastPageNo} page available!.` }, httpStatus.BAD_REQUEST);
        }

        [err, getAll] = await toAwait(lifeSavingModel.find(filter).populate('projectId').skip(skip).limit(lim).sort({ createdAt: -1 }));

        pagination = {
            totalItems: lifeSavingCount,
            currentPage: page,
            totalPages: lastPageNo,
            pageSize: lim,
            hasNextPage: page < lastPageNo,
            hasPrevPage: page > 1
        };

    } else {
        [err, getAll] = await toAwait(lifeSavingModel.find(filter).populate('projectId').sort({ createdAt: -1 }));
    }
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);


    ReS(res, { message: "LifeSaving fetched", data: getAll, pagination }, httpStatus.OK);

};

export const getByIdLifeSaving = async (req: Request, res: Response) => {
    let data, err, id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
        return ReE(res, { message: `Invalid id!..` }, httpStatus.BAD_REQUEST);
    }
    [err, data] = await toAwait(lifeSavingModel.findById(id).populate('projectId'))
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!data) {
        return ReE(res, { message: "Life saving not found for given id" }, httpStatus.NOT_FOUND)
    }
    ReS(res, { message: "LifeSaving fetched", data }, httpStatus.OK);

}
