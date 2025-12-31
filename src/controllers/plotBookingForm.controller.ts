import httpStatus from "http-status"
import { isNull, isPhone, ReE, ReS, toAwait } from "../services/util.service"
import { Request, Response } from "express"
import plotBookingFormModel from "../models/plotBookingForm.model";
import { IPlotBookingForm } from "../type/plotBookingForm";
import { toLowerCaseObj } from "./common";
import { Customer } from "../models/customer.model";

export const createPlotBookingForm = async (req: Request, res: Response) => {
    let err;
    let photo;
    let referenceId = req.body.referenceId; // Extract before lowercase conversion
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
    [err, plotBookingForm] = await toAwait(plotBookingFormModel.create(body));
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

    let err;

    let plotBookingForm;
    [err, plotBookingForm] = await toAwait(plotBookingFormModel.find());
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    plotBookingForm = plotBookingForm as IPlotBookingForm[]
    if (plotBookingForm.length == 0) {
        return ReE(res, { message: `No plotBookingForm found!.` }, httpStatus.INTERNAL_SERVER_ERROR)
    }

    return ReS(res, { message: "plotBookingForm fetched", data: plotBookingForm }, httpStatus.OK)

}