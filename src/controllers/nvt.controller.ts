import { Request, Response } from "express";
import { isEmpty, isNull, isPhone, isValidDate, isValidUUID, IsValidUUIDV4, ReE, ReS, toAwait } from "../services/util.service";
import httpStatus from "http-status";
import { Nvt } from "../models/nvt.model";
import { INVT } from "../type/nvt";
import mongoose from "mongoose";
import { Customer } from "../models/customer.model";
import { IMOD } from "../type/mod";
import { Mod } from "../models/mod.model";
import EditRequest from "../models/editRequest.model";
import CustomRequest from "../type/customRequest";
import { IUser } from "../type/user";
import { IEditRequest } from "../type/editRequest";
import { sendPushNotificationToSuperAdmin } from "./common";
import { BillingRequest } from "../models/billingRequest.model";

export const createNvt = async (req: Request, res: Response) => {
    let body = req.body, err;
    let { mod, nvt } = body
    if (!nvt) {
        return ReE(res, "nvt is required", httpStatus.BAD_REQUEST);
    }
    let { needMod, conversion, initialPayment, totalPayment, emi, introducerName, customer } = nvt;
    let fields = ["needMod", "conversion", "initialPayment", "totalPayment", "emi", "introducerName", "customer"];
    let inVaildFields = fields.filter(x => isNull(nvt[x]));
    if (inVaildFields.length > 0) {
        return ReE(res, { message: `Please enter required fields ${inVaildFields}!.` }, httpStatus.BAD_REQUEST);
    }
    if (typeof needMod !== 'boolean') {
        return ReE(res, "needMod must be boolean", httpStatus.BAD_REQUEST);
    }
    if (!customer) {
        return ReE(res, { message: `Please enter customer id!.` }, httpStatus.BAD_REQUEST)
    }
    if (!mongoose.isValidObjectId(customer)) {
        return ReE(res, { message: 'Invalid customer id!' }, httpStatus.BAD_REQUEST);
    }
    let findExist;
    [err, findExist] = await toAwait(Customer.findById({ _id: customer }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!findExist) {
        return ReE(res, { message: `customer is not found given id: ${customer}!.` }, httpStatus.NOT_FOUND);
    }
    if (typeof conversion !== 'boolean') {
        return ReE(res, "nvt.conversion must be boolean", httpStatus.BAD_REQUEST);
    }
    let createMod: any;
    if (needMod === true) {
        if (!mod) {
            return ReE(res, "mod is required", httpStatus.BAD_REQUEST);
        }
        let { date, siteName, plotNo, introducerPhone, directorName, directorPhone, EDName, EDPhone, amount, status } = mod;
        let fields = ["date", "siteName", "plotNo", "introducerPhone", "directorName", "directorPhone", "EDName", "EDPhone", "amount", "status"];
        let inVaildFields = fields.filter(x => isNull(mod[x]));
        if (inVaildFields.length > 0) {
            return ReE(res, { message: `Please enter required fields ${inVaildFields}! for mod create.` }, httpStatus.BAD_REQUEST);
        }
        if (!isValidDate(date)) {
            return ReE(res, { message: `Invalid date, valid format is (YYYY-MM-DD)!.` }, httpStatus.BAD_REQUEST);
        }
        [err, createMod] = await toAwait(Mod.create({ ...mod, introducerName, customer }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!createMod) {
            return ReE(res, { message: `Failed to create mod!.` }, httpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    let createnvt;
    let obj = nvt;
    if (needMod) {
        obj = { ...obj, mod: createMod._id }
    }
    [err, createnvt] = await toAwait(Nvt.create(obj));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!createnvt) {
        return ReE(res, { message: `Failed to create nvt!.` }, httpStatus.INTERNAL_SERVER_ERROR)
    }
    ReS(res, { message: `nvt added successfull` }, httpStatus.CREATED);
};

export const updateNvt = async (req: CustomRequest, res: Response) => {
    const body = req.body, user = req.user as IUser;
    let err: any;
    let { mod, nvt } = body
    if (!nvt) {
        return ReE(res, "nvt is required", httpStatus.BAD_REQUEST);
    }
    if (!nvt._id) {
        return ReE(res, "nvt._id is required", httpStatus.BAD_REQUEST);
    }
    let checkNvt;
    [err, checkNvt] = await toAwait(Nvt.findById(nvt._id));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!checkNvt) {
        return ReE(res, { message: `nvt not found!.` }, httpStatus.NOT_FOUND);
    }
    checkNvt = checkNvt as INVT;
    let { needMod, conversion, initialPayment, totalPayment, emi, introducerName, customer } = nvt;
    let fields = ["needMod", "conversion", "initialPayment", "totalPayment", "emi", "introducerName", "customer"];
    let modFields = ["date", "siteName", "plotNo", "introducerPhone", "directorName", "directorPhone", "EDName", "EDPhone", "amount", "status"];
    let inVaildFields = fields.filter(x => !isNull(nvt[x]));
    if (inVaildFields.length === 0) {
        return ReE(res, { message: `Please enter any one fields to update ${inVaildFields}!.` }, httpStatus.BAD_REQUEST);
    }
    if (needMod) {
        if (typeof needMod !== 'boolean') {
            return ReE(res, "needMod must be boolean", httpStatus.BAD_REQUEST);
        }
    }
    if (customer) {
        if (!customer) {
            return ReE(res, { message: `Please enter customer id!.` }, httpStatus.BAD_REQUEST)
        }
        if (!mongoose.isValidObjectId(customer)) {
            return ReE(res, { message: 'Invalid customer id!' }, httpStatus.BAD_REQUEST);
        }
        let findExist;
        [err, findExist] = await toAwait(Customer.findById({ _id: customer }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!findExist) {
            return ReE(res, { message: `customer is not found given id: ${customer}!.` }, httpStatus.NOT_FOUND);
        }
    }

    if (conversion) {
        if (typeof conversion !== 'boolean') {
            return ReE(res, "nvt.conversion must be boolean", httpStatus.BAD_REQUEST);
        }
    }
    let createMod: any;
    if (needMod === true || checkNvt.needMod === true) {
        if (needMod === true && checkNvt.needMod !== true) {
            if (!mod) {
                return ReE(res, "mod is required", httpStatus.BAD_REQUEST);
            }
            let { date, siteName, plotNo, introducerPhone, directorName, directorPhone, EDName, EDPhone, amount, status } = mod;
            let inVaildFields = modFields.filter(x => isNull(mod[x]));
            if (inVaildFields.length > 0) {
                return ReE(res, { message: `Please enter required fields ${inVaildFields}! for mod create.` }, httpStatus.BAD_REQUEST);
            }
            if (!isValidDate(date)) {
                return ReE(res, { message: `Invalid date, valid format is (YYYY-MM-DD)!.` }, httpStatus.BAD_REQUEST);
            }
            [err, createMod] = await toAwait(Mod.create({ ...mod, introducerName: checkNvt.introducerName, customer: customer ?? checkNvt.customer }))
            if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
            if (!createMod) {
                return ReE(res, { message: `Failed to create mod!.` }, httpStatus.INTERNAL_SERVER_ERROR);
            }
        } else if (checkNvt.needMod === true && !isEmpty(mod)) {
            const updateFields: Record<string, any> = {};
            for (const key of modFields) {
                if (!isNull(mod[key])) {
                    updateFields[key] = mod[key];
                }
            }
            if (!isEmpty(updateFields)) {
                [err, createMod] = await toAwait(Mod.updateOne({ _id: checkNvt.mod }, { $set: updateFields }));
                if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
                if (!createMod) {
                    return ReE(res, { message: `Failed to update mod!.` }, httpStatus.INTERNAL_SERVER_ERROR)
                }
            }
        }
    }

    let updateFields: Record<string, any> = {};
    for (const key of fields) {
        if (!isNull(nvt[key])) {
            updateFields[key] = nvt[key];
        }
    }
    if (needMod === true) {
        updateFields = { ...updateFields, mod: createMod?._id }
    }
    if (needMod === false && checkNvt.needMod === true) {
        updateFields = { ...updateFields, mod: null }
    }

    if (!isEmpty(updateFields)) {

        if (user.isAdmin === false) {

            const changes: { field: string; oldValue: any; newValue: any }[] = [];
            fields.forEach((key: any) => {
                const newValue = nvt[key];
                const oldValue = (checkNvt as any)[key];
                if (isNull(newValue)) return
                if (newValue.toString() !== oldValue.toString()) {
                    changes.push({ field: key, oldValue, newValue });
                }
            });

            if (changes.length === 0) {
                return ReE(res, { message: "No changes found to update nvt." }, httpStatus.BAD_REQUEST);
            }

            let checkEditRequest;
            [err, checkEditRequest] = await toAwait(
                EditRequest.findOne({ targetId: nvt._id, editedBy: user._id })
            )

            if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
            if (checkEditRequest) {
                checkEditRequest = checkEditRequest as IEditRequest;
                let get = []
                checkEditRequest.changes.forEach((change) => {
                    if (changes.some((c) => c.field.toString() === change.field.toString())) {
                        get.push(change)
                    }
                })
                if (checkEditRequest.changes.length === get.length && checkEditRequest.status === "pending") {
                    return ReE(res, { message: "You already have a pending edit request for this marketDetail." }, httpStatus.BAD_REQUEST);
                }
            }

            let option: any = {
                targetModel: "Nvt",
                targetId: nvt._id,
                editedBy: user._id,
                changes,
                status: "pending",
            }

            if (needMod === false && checkNvt.needMod === true) {
                option = { ...option, deletedId: checkNvt.mod, deletedTableName: "Mod" }
            }

            let createReq;
            [err, createReq] = await toAwait(
                EditRequest.create(option)
            );

            if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

            createReq = createReq as IEditRequest;

            ReS(res, { message: "Edit request created successfully, Awaiting for approval." }, httpStatus.OK);

            let send = await sendPushNotificationToSuperAdmin("Edit request for NVT", `A new edit request for NVT has been created by ${user.name}`, createReq._id.toString())

            if (!send.success) {
                return console.log(send.message);
            }

            return console.log("Edit request push notification sent.");
        } else {

            let updateNvt

            [err, updateNvt] = await toAwait(Nvt.updateOne({ _id: nvt._id }, { $set: updateFields }));
            if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
            if (!updateNvt) {
                return ReE(res, { message: `Failed to update nvt!.` }, httpStatus.INTERNAL_SERVER_ERROR)
            }

            if (needMod === false && checkNvt.needMod === true) {
                let removeMod;
                [err, removeMod] = await toAwait(Mod.deleteOne({ _id: checkNvt.mod }));
                if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
                if (!removeMod) {
                    return ReE(res, { message: `Failed to remove nvt!.` }, httpStatus.INTERNAL_SERVER_ERROR)
                }
            }
        }
    }
    ReS(res, { message: `nvt updated successfull` }, httpStatus.OK);
};

export const getByIdNvt = async (req: Request, res: Response) => {
    let err, { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return ReE(res, { message: `Invalid nvt id!` }, httpStatus.BAD_REQUEST);
    }

    let getNvt;
    [err, getNvt] = await toAwait(Nvt.findOne({ _id: id }).populate("customer").populate("mod"));

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getNvt) {
        return ReE(res, { message: `nvt not found for given id!.` }, httpStatus.NOT_FOUND)
    }

    ReS(res, { message: "nvt found", data: getNvt }, httpStatus.OK)
}

export const getAllNvt = async (req: Request, res: Response) => {
    let err, getNvt;
    [err, getNvt] = await toAwait(Nvt.find().populate("customer").populate("mod"));

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    getNvt = getNvt as INVT[]
    if (getNvt.length === 0) {
        return ReE(res, { message: `nvt not found!.` }, httpStatus.NOT_FOUND)
    }

    ReS(res, { message: "nvt found", data: getNvt }, httpStatus.OK)
}

export const getAllNvtCustomer = async (req: Request, res: Response) => {
    let err, getNvt, id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
        return ReE(res, { message: `Invalid nvt id!` }, httpStatus.BAD_REQUEST)
    }
    let getCustomer;
    [err, getCustomer] = await toAwait(Customer.findOne({ _id: id }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getCustomer) {
        return ReE(res, { message: `customer not found for given id!.` }, httpStatus.BAD_REQUEST)
    }
    [err, getNvt] = await toAwait(Nvt.find({
        customer: id
    }).populate("customer").populate("mod"));

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    getNvt = getNvt as INVT[]
    if (getNvt.length === 0) {
        return ReE(res, { message: `nvt not found!.` }, httpStatus.NOT_FOUND)
    }

    ReS(res, { message: "nvt found", data: getNvt }, httpStatus.OK)
}

export const deleteNvt = async (req: CustomRequest, res: Response) => {

    let err, { _id, reason } = req.body, user = req.user as IUser;
    if (!_id) {
            return ReE(res, { message: `Nvt _id is required!` }, httpStatus.BAD_REQUEST);
        }
    if (!mongoose.isValidObjectId(_id)) {
        return ReE(res, { message: `Invalid nvt id!` }, httpStatus.BAD_REQUEST);
    }

    if (!user.isAdmin) {
        if (!reason) {
            return ReE(
                res,
                { message: `Please enter reason for delete!` },
                httpStatus.BAD_REQUEST,
            );
        }
        let checkBillingRequest;
        [err, checkBillingRequest] = await toAwait(
            BillingRequest.findOne({ targetId: _id, requestFor: "delete", status: "pending" })
        )
        if(err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if(checkBillingRequest) {
            return ReE(
            res,
            { message: "Nvt delete request already pending for this billing id!" },
            httpStatus.BAD_REQUEST,
            );
        }
        let createBillingRequest;
        [err, createBillingRequest] = await toAwait(
            BillingRequest.create({
                userId: user._id,
                targetId: _id,
                targetModel: "Nvt",
                requestFor: "delete",
                status: "pending",
            }),
        );
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!createBillingRequest) {
            return ReE(
                res,
                { message: "Nvt delete request not created please try again later" },
                httpStatus.INTERNAL_SERVER_ERROR,
            );
        }
        return ReS(res, { message: "Nvt delete request created" }, httpStatus.OK);

    }

    let checkNvt: any;
    [err, checkNvt] = await toAwait(Nvt.findOne({ _id: _id }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!checkNvt) {
        return ReE(res, { message: `nvt not found for given id!.` }, httpStatus.NOT_FOUND)
    }
    if (checkNvt.mod) {
        let removeMod;
        [err, removeMod] = await toAwait(Mod.deleteOne({ _id: checkNvt.mod }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!removeMod) {
            return ReE(res, { message: `Failed to remove mod!.` }, httpStatus.INTERNAL_SERVER_ERROR)
        }
    }
    let deleteNvt;
    [err, deleteNvt] = await toAwait(Nvt.deleteOne({ _id: _id }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR)
    ReS(res, { message: "nvt deleted" }, httpStatus.OK)

}