// controllers/lifeSaving.controller.ts
import { Request, Response } from "express";
import LifeSaving from "../models/lifeSaving.model";
import lifeSavingModel from "../models/lifeSaving.model";
import { isNull, ReE, ReS, toAwait } from "../services/util.service";
import httpStatus from "http-status";
import { toLowerCaseObj } from "./common";
import { Customer } from "../models/customer.model";

export const createLifeSaving = async (req: Request, res: Response) => {
    let payload = toLowerCaseObj(req.body),err;

    let fields = [ "mobileNo", "email", "nameOfCustomer" ];
    let inVaildFields = fields.filter(x => isNull(payload[x]));
    if (inVaildFields.length > 0) {
        return ReE(res, { message: `Please enter required fields ${inVaildFields}!.` }, httpStatus.BAD_REQUEST);
    }
    let { mobileNo, email, pincode, communicationAddress,nameOfCustomer} = payload
    
    let checkAlready;
    [err, checkAlready] = await toAwait(lifeSavingModel.findOne(payload));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (checkAlready) {
        return ReE(res, { message: `This LifeSaving already exists.` }, httpStatus.BAD_REQUEST);
    }

    let cretaeLSS;
    [err,cretaeLSS] = await toAwait(lifeSavingModel.create(payload));    
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

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
            address:communicationAddress
        }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!customer) {
            return ReE(res, { message: `Failed to create customer!.` }, httpStatus.INTERNAL_SERVER_ERROR)
        }
    }

    ReS(res, { message: "LifeSaving created"}, httpStatus.OK);
};

export const getAllLifeSaving = async (req: Request, res: Response) => {

    let err, getAll;
    [err, getAll] = await toAwait(lifeSavingModel.find());
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    ReS(res, { message: "LifeSaving fetched", data: getAll }, httpStatus.OK);

};
