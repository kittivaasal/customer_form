import { Request, Response } from "express";
import httpStatus from "http-status";
import mongoose, { Types } from "mongoose";
import activityLogErrorModel from "../models/activityLogError.model";
import { Counter } from "../models/counter.model";
import { Customer } from "../models/customer.model";
import EditRequest from "../models/editRequest.model";
import { MarketDetail } from "../models/marketDetail.model";
import { MarketingHead } from "../models/marketingHead.model";
import { Percentage } from "../models/percentage.model";
import { escapeRegex, isEmail, isNull, isPhone, ReE, ReS, toAwait } from "../services/util.service";
import { IActivityLog } from "../type/activityLog";
import { ICustomer } from "../type/customer";
import CustomRequest from "../type/customRequest";
import { IEditRequest } from "../type/editRequest";
import { IMarketDetail } from "../type/marketDetail";
import { IMarketingHead } from "../type/marketingHead";
import { IPercentage } from "../type/percentage";
import { IUser } from "../type/user";
import { addActivityLog, processBulkWrite, sendPushNotificationToSuperAdmin } from "./common";
import { BillingRequest } from "../models/billingRequest.model";
import { Marketer } from "../models/marketer";
import { MarketDetail } from "../models/marketDetail.model";
import { IMarketDetail } from "../type/marketDetail";
import { Customer } from "../models/customer.model";
import { ICustomer } from "../type/customer";
import activityLogErrorModel from "../models/activityLogError.model";
import { IActivityLog } from "../type/activityLog";
import fs from "fs";

export const createMarketingHead = async (req: CustomRequest, res: Response) => {
    let body = req.body, err, user = req.user as IUser;
    let { name, email, gender, age, phone, address, status, percentageId } = body;
    let fields = ["name", "email", "gender", "age", "phone", "address", "status", "percentageId"];
    let inVaildFields = fields.filter(x => isNull(body[x]));
    if (inVaildFields.length > 0) {
        return ReE(res, { message: `Please enter required fields ${inVaildFields}!.` }, httpStatus.BAD_REQUEST);
    }
    if (!mongoose.isValidObjectId(percentageId)) {
        return ReE(res, { message: "Invalid percentage id" }, httpStatus.BAD_REQUEST);
    }
    let checkPer;
    [err, checkPer] = await toAwait(Percentage.findOne({ _id: percentageId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!checkPer) return ReE(res, { message: "Percentage is not found for given id" }, httpStatus.NOT_FOUND)
    if (gender) {
        gender = gender.toLowerCase();
        let genderList = ["male", "female", "other"];
        if (!genderList.includes(gender)) {
            return ReE(res, { message: `Invalid gender valid values are (${genderList})!.` }, httpStatus.BAD_REQUEST);
        }
    }
    checkPer = checkPer as IPercentage;
    console.log(checkPer)
    if (checkPer.name.toUpperCase()?.trim() !== "DIAMOND DIRECTOR") {
        return ReE(res, { message: `Marking_head must be in DIAMOND DIRECTOR!.` }, httpStatus.BAD_REQUEST);
    }
    if (email) {
        email = email.trim().toLowerCase();
        let findEmail;
        [err, findEmail] = await toAwait(MarketingHead.findOne({ email: email }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (findEmail) {
            return ReE(res, { message: `Email already exists!.` }, httpStatus.BAD_REQUEST);
        }
    }
    if (phone) {
        if (!isPhone(phone)) {
            return ReE(res, { message: `Invalid phone number!.` }, httpStatus.BAD_REQUEST)
        }
        // let findPhone;
        // [err, findPhone] = await toAwait(MarketingHead.findOne({ phone: phone }))
        // if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        // if (findPhone) {
        //     return ReE(res, { message: `Phone already exists!.` }, httpStatus.BAD_REQUEST)
        // }
    }
    let findExist;
    [err, findExist] = await toAwait(MarketingHead.findOne(body));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (findExist) {
        return ReE(res, { message: `Project already exist for given all data` }, httpStatus.BAD_REQUEST);
    }
    //get auto id
    let getSequence, count = 0;
    [err, getSequence] = await toAwait(Counter.findOne({ name: "marketinghead" }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getSequence) {
        let newCounter = new Counter({
            name: "marketinghead",
            seq: 1
        });
        await newCounter.save();
        count = 1;
    } else {
        getSequence = getSequence as any;
        count = getSequence.seq + 1;
        let updateCustomerCounter;
        [err, updateCustomerCounter] = await toAwait(
            Counter.updateOne({ name: "marketinghead" }, { $set: { seq: count } })
        )
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    }

    body.id = count.toString().padStart(4, '0');
    body.createdBy = user._id;

    let marketing_head;
    [err, marketing_head] = await toAwait(MarketingHead.create(body));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!marketing_head) {
        return ReE(res, { message: `Failed to create marketing_head!.` }, httpStatus.INTERNAL_SERVER_ERROR)
    }
    ReS(res, { message: `marketing_head added successfull` }, httpStatus.CREATED);
};

export const updateMarketingHead = async (req: CustomRequest, res: Response) => {
    const body = req.body, user = req.user as IUser;
    if (!user) return ReE(res, { message: "authentication not added in this api please contact admin" }, httpStatus.NOT_FOUND);
    let { _id, name, email, gender, age, phone, address, status, percentageId } = body;
    let err: any;
    if (!_id) {
        return ReE(res, { message: `_id is required!` }, httpStatus.BAD_REQUEST);
    }
    if (!mongoose.isValidObjectId(_id)) {
        return ReE(res, { message: `Invalid marketing_head _id!` }, httpStatus.BAD_REQUEST);
    }
    let fields = ["name", "email", "gender", "age", "phone", "address", "status", "percentageId"];
    let inVaildFields = fields.filter(x => !isNull(body[x]));
    if (inVaildFields.length === 0) {
        return ReE(res, { message: `Please enter any one field to update ${fields}!.` }, httpStatus.BAD_REQUEST);
    }
    if (percentageId) {
        if (!mongoose.isValidObjectId(percentageId)) {
            return ReE(res, { message: "Invalid percentage id" }, httpStatus.BAD_REQUEST);
        }
        let checkPer;
        [err, checkPer] = await toAwait(Percentage.findOne({ _id: percentageId }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!checkPer) return ReE(res, { message: "Percentage is not found for given id" }, httpStatus.NOT_FOUND)
        checkPer = checkPer as IPercentage;
        if (checkPer.name.toUpperCase()?.trim() !== "DIAMOND DIRECTOR") {
            return ReE(res, { message: `Marking_head must be in DIAMOND DIRECTOR!.` }, httpStatus.BAD_REQUEST);
        }
    }
    if (gender) {
        gender = gender.toLowerCase();
        let genderList = ["male", "female", "other"];
        if (!genderList.includes(gender)) {
            return ReE(res, { message: `Invalid gender valid values are (${genderList})!.` }, httpStatus.BAD_REQUEST);
        }
    }

    let getMarketing_head;
    [err, getMarketing_head] = await toAwait(MarketingHead.findOne({ _id: _id }));

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getMarketing_head) {
        return ReE(res, { message: `marketing_head not found for given id!.` }, httpStatus.NOT_FOUND)
    }

    getMarketing_head = getMarketing_head as IMarketingHead;

    const updateFields: Record<string, any> = {};
    for (const key of fields) {
        if (!isNull(body[key])) {
            updateFields[key] = body[key];
        }
    }

    if (updateFields.email) {
        updateFields.email = updateFields.email.trim().toLowerCase();
        if (!isEmail(updateFields.email)) {
            return ReE(res, { message: `Invalid email!.` }, httpStatus.BAD_REQUEST)
        }
        let findEmail;
        [err, findEmail] = await toAwait(MarketingHead.findOne({ email: updateFields.email, _id: { $ne: _id } }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (findEmail) {
            return ReE(res, { message: `Email already exists!.` }, httpStatus.BAD_REQUEST);
        }
    }
    if (updateFields.phone) {
        if (!isPhone(updateFields.phone)) {
            return ReE(res, { message: `Invalid phone number!.` }, httpStatus.BAD_REQUEST)
        }
    }

    if (updateFields.percentageId) {
        if (!mongoose.isValidObjectId(percentageId)) {
            return ReE(res, { message: "Invalid percentage id" }, httpStatus.BAD_REQUEST);
        }
        let checkPer;
        [err, checkPer] = await toAwait(Percentage.findOne({ _id: percentageId }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!checkPer) return ReE(res, { message: "Percentage is not found for given id" }, httpStatus.NOT_FOUND)
    }

    if (user.isAdmin === false) {
        const changes: { field: string; oldValue: any; newValue: any }[] = [];
        fields.forEach((key: any) => {
            const newValue = body[key];
            const oldValue = (getMarketing_head as any)[key];
            if (isNull(newValue)) return
            if (newValue.toString() !== oldValue.toString()) {
                changes.push({ field: key, oldValue, newValue });
            }
        });

        if (changes.length === 0) {
            return ReE(res, { message: "No changes found to update." }, httpStatus.BAD_REQUEST);
        }

        let checkEditRequest;
        [err, checkEditRequest] = await toAwait(
            EditRequest.findOne({ targetId: _id, editedBy: user._id })
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
                return ReE(res, { message: "You already have a pending edit request for this marketingHead." }, httpStatus.BAD_REQUEST);
            }
        }

        let createReq;
        [err, createReq] = await toAwait(
            EditRequest.create({
                targetModel: "MarketingHead",
                targetId: _id,
                editedBy: user._id,
                changes,
                status: "pending",
            })
        );

        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

        createReq = createReq as IEditRequest;

        ReS(res, { message: "Edit request created successfully, Awaiting for approval." }, httpStatus.OK);

        let send = await sendPushNotificationToSuperAdmin("Edit request for marketingHead", `A new edit request for marketingHead has been created by ${user.name}`, createReq._id.toString())

        if (!send.success) {
            return console.log(send.message);
        }

        return console.log("Edit request push notification sent.");

    } else {

        const [updateErr, updateResult] = await toAwait(
            MarketingHead.updateOne({ _id }, { $set: updateFields })
        );
        if (updateErr) return ReE(res, updateErr, httpStatus.INTERNAL_SERVER_ERROR)
        return ReS(res, { message: "Marketing_head updated successfully." }, httpStatus.OK);

    }
};

export const getByIdMarketingHead = async (req: Request, res: Response) => {
    let err, { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return ReE(res, { message: `Invalid marketing_head id!` }, httpStatus.BAD_REQUEST);
    }

    let getMarketing_head;
    [err, getMarketing_head] = await toAwait(MarketingHead.findOne({ _id: id }).populate("percentageId"));

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getMarketing_head) {
        return ReE(res, { message: `marketing_head not found for given id!.` }, httpStatus.NOT_FOUND)
    }

    ReS(res, { message: "marketing_head found", data: getMarketing_head }, httpStatus.OK)
}

export const getAllMarketingHead = async (req: Request, res: Response) => {
    let err, getMarketing_head;
    const { percentageName } = req.query;

    const page = req.query.page ? parseInt(req.query.page as string) : null;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : null;

    const rawSearch = (req.query.search as string) || "";
    const search = escapeRegex(rawSearch);

    // Build the query filter
    let filter: any = {};

    // If percentageName is provided, first find the percentage ID(s) matching that name
    if (percentageName && typeof percentageName === 'string') {
        let percentage;
        [err, percentage] = await toAwait(Percentage.findOne({ name: percentageName }));
        percentage = percentage as IPercentage & { _id: string } | null;

        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

        // If percentage name is provided but not found, return empty result
        if (!percentage) {
            return ReE(res, { message: `No percentage found with name: ${percentageName}` }, httpStatus.NOT_FOUND);
        }

        // Add the percentageId to the filter
        filter.percentageId = percentage._id;
    }

    const searchConditions: any[] = [];
    if (search) {
        searchConditions.push(
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { address: { $regex: search, $options: "i" } },
            { id: { $regex: search, $options: "i" } }
        );

        if (mongoose.Types.ObjectId.isValid(search)) {
            searchConditions.push({ _id: new mongoose.Types.ObjectId(search) });
        }
    }

    if (searchConditions.length > 0) {
        // If there's an existing filter (e.g. from percentageName), we need to AND it with the search OR condition
        // But since filter is an object, we can just add the $or property if it doesn't conflict. 
        // However, if we want to be safe and combine proper AND logic if filter was more complex:
        // filter = { $and: [filter, { $or: searchConditions }] };
        // For simplicity and typical mongoose behavior, adding $or to the top level works 
        // as long as there isn't another $or. 
        // Given the code above, filter only has percentageId, so it is safe to add $or.
        filter.$or = searchConditions;
    }

    let query = MarketingHead.find(filter).populate("percentageId").sort({ createdAt: -1 });

    if (page && limit) {
        const skip = (page - 1) * limit;
        query = query.skip(skip).limit(limit);
    }

    let total;
    let totalPages = 1;

    if (page && limit) {
        let count;
        [err, count] = await toAwait(MarketingHead.countDocuments(filter));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

        total = count as number;
        totalPages = Math.ceil(total / limit);

        if (totalPages === 0) {
            return ReS(
                res, {
                message: "success",
                data: [],
            },
                httpStatus.OK
            )
        }

        if (page > totalPages) {
            return ReE(
                res,
                { message: `Page no ${page} not available. The last page no is ${totalPages}.` },
                httpStatus.NOT_FOUND
            );
        }
    }

    [err, getMarketing_head] = await toAwait(query);

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    getMarketing_head = getMarketing_head as IMarketingHead[]

    // Note: User requested mirroring, and in previous examples we removed the check for empty array 404 
    // to support smooth pagination/search results (returning empty list instead of error).
    // if (getMarketing_head.length === 0) {
    //     return ReE(res, { message: `marketing_head not found!.` }, httpStatus.NOT_FOUND)
    // }

    return ReS(res, {
        message: "marketing_head found",
        data: getMarketing_head,
        ...(page && limit && {
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1
            }
        })
    }, httpStatus.OK)
}

export const deleteMarketingHead = async (req: CustomRequest, res: Response) => {
    let err, { _id, reason } = req.body, user = req.user as IUser;
    if (!_id) {
        return ReE(res, { message: `MarketingHead _id is required!` }, httpStatus.BAD_REQUEST);
    }
    if (!mongoose.isValidObjectId(_id)) {
        return ReE(res, { message: `Invalid MarketingHead id!` }, httpStatus.BAD_REQUEST);
    }

    let checkMarketingHead;
    [err, checkMarketingHead] = await toAwait(MarketingHead.findOne({ _id: _id }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!checkMarketingHead) {
        return ReE(res, { message: `marketing_head not found for given id!.` }, httpStatus.NOT_FOUND)
    }

    checkMarketingHead = checkMarketingHead as IMarketingHead;

    let getAllCedCustomer;
    [err, getAllCedCustomer] = await toAwait(Customer.find({ cedId: _id }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    getAllCedCustomer = getAllCedCustomer as ICustomer[];

    if (getAllCedCustomer.length !== 0) {
        return ReE(res, { message: "Some customer not have cedId, so can not delete this marketing head!" }, httpStatus.BAD_REQUEST);
    }

    let getAllCustomer;
    [err, getAllCustomer] = await toAwait(Customer.find({ ddId: _id }).populate("cedId"));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    getAllCustomer = getAllCustomer as ICustomer[];

    let updateBulkCustomer: any = []

    for (let index = 0; index < getAllCustomer.length; index++) {
        const element = getAllCustomer[index] as any;
        if (element.cedId && element.cedId.overAllHeadBy.length > 0) {
            if (element.level === 2) {
                updateBulkCustomer.push({
                    updateOne: {
                        filter: { _id: element._id },
                        update: { $set: { ddId: element.cedId._id } }
                    }
                })
            } else {
                let overAllHeadBy = element.cedId.overAllHeadBy.find((i: any) => i.level === 2);
                if (overAllHeadBy) {
                    updateBulkCustomer.push({
                        updateOne: {
                            filter: { _id: element._id },
                            update: { $set: { ddId: overAllHeadBy.headBy } }
                        }
                    })
                }
            }
        }
    }

    let getAllLevel2Marketer;
    [err, getAllLevel2Marketer] = await toAwait(MarketDetail.find({ "overAllHeadBy.headBy": _id, level: 2 }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    getAllLevel2Marketer = getAllLevel2Marketer as any[]

    let bulkAddMarketHead: any = []
    let deleteMarketer: any = []

    if (getAllLevel2Marketer.length > 0) {
        let getPercentageId;
        [err, getPercentageId] = await toAwait(Percentage.findOne({ name: "DIAMOND DIRECTOR" }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!getPercentageId) return ReE(res, { message: "Percentage not found for DIAMOND DIRECTOR" }, httpStatus.NOT_FOUND)
        getPercentageId = getPercentageId as IPercentage
        for (let index = 0; index < getAllLevel2Marketer.length; index++) {
            const element = getAllLevel2Marketer[index];
            let obj = {
                name: element.name,
                phone: element.phone,
                address: element.address,
                email: element.email,
                age: element.age,
                gender: element.gender,
                id: element.id,
                status: element.status,
                oldData: element.oldData,
                level: 1,
                percentageId: getPercentageId._id,
                _id: element._id
            }
            bulkAddMarketHead.push(obj);
            deleteMarketer.push(element._id)
        }
    }

    let getAllMarketer;
    [err, getAllMarketer] = await toAwait(MarketDetail.find({ "overAllHeadBy.headBy": _id, level: { $gt: 2 } }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    getAllMarketer = getAllMarketer as IMarketDetail[]

    let bulkUpdate: any = []

    let getAllPercentage;
    [err, getAllPercentage] = await toAwait(Percentage.find({}).sort({ level: 1 }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    getAllPercentage = getAllPercentage as IPercentage[];

    if (getAllPercentage.length === 0) {
        return ReE(res, { message: "No percentage found in database" }, httpStatus.BAD_REQUEST);
    }

    for (let index = 0; index < getAllMarketer.length; index++) {
        const element = getAllMarketer[index];
        let overAllArray = element.overAllHeadBy.filter((i: any) => i.level > 1).map((i: any) => {
            if (i.level > 1) {
                return {
                    headBy: i.headBy,
                    level: i.level - 1,
                    headByModel: i.level - 1 === 1 ? "MarketingHead" : "MarketDetail"
                }
            }
        })
        const lastOverAll = overAllArray.length > 0 ? overAllArray[overAllArray.length - 1] : undefined;
        const headBy = lastOverAll ? lastOverAll.headBy : null;
        let level = overAllArray.length + 1;
        let headByModel = lastOverAll ? lastOverAll.headByModel : null;
        let percentageId = getAllPercentage.find((i: any) => i.level === level)?._id;
        if (!percentageId) {
            let findMaxLevel = Math.max(...getAllPercentage.map((i: any) => i.level));
            percentageId = getAllPercentage.find((i: any) => i.level === findMaxLevel)?._id;
        }
        if (!percentageId) {
            return ReE(res, { message: `Percentage not found for this level ${level}!.` }, httpStatus.NOT_FOUND)
        }
        bulkUpdate.push({
            updateOne: {
                filter: { _id: element._id },
                update: { $set: { overAllHeadBy: overAllArray, level, headBy, headByModel, percentageId } }
            }
        })
    }

    let batchSize = 500;

    // if (bulkAddMarketHead.length > 0) {
    //     let bulkAdd;
    //     for (let i = 0; i < bulkAddMarketHead.length; i += batchSize) {
    //         const batch = bulkAddMarketHead.slice(i, i + batchSize);
    //         [err, bulkAdd] = await toAwait(MarketingHead.insertMany(batch));
    //         if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    //         if (bulkAddMarketHead.length === deleteMarketer.length) {
    //             let deleteM;
    //             const batch = deleteMarketer.slice(i, i + batchSize);
    //             [err, deleteM] = await toAwait(MarketDetail.deleteMany({ _id: { $in: batch } }));
    //             if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    //         }
    //     }
    // }

    // if (deleteMarketer.length > 0 && bulkAddMarketHead.length !== deleteMarketer.length) {
    //     let deleteM;
    //     for (let i = 0; i < deleteMarketer.length; i += batchSize) {
    //         const batch = deleteMarketer.slice(i, i + batchSize);
    //         [err, deleteM] = await toAwait(MarketDetail.deleteMany({ _id: { $in: batch } }));
    //         if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    //     }
    // }

    const operations: Promise<any>[] = [];

    // Insert MarketingHead
    if (bulkAddMarketHead.length > 0) {
        for (let i = 0; i < bulkAddMarketHead.length; i += batchSize) {
            const batch = bulkAddMarketHead.slice(i, i + batchSize);
            operations.push(MarketingHead.insertMany(batch));
            if (bulkAddMarketHead.length === deleteMarketer.length) {
                // let deleteM;
                // const batch = deleteMarketer.slice(i, i + batchSize);
                // [err, deleteM] = await toAwait(MarketDetail.deleteMany({ _id: { $in: batch } }));
                // if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
                const batch = deleteMarketer.slice(i, i + batchSize);
                operations.push(MarketDetail.deleteMany({ _id: { $in: batch } }))
            }
        }
    }

    // Delete MarketDetail
    if (deleteMarketer.length > 0 && bulkAddMarketHead.length !== deleteMarketer.length) {
        for (let i = 0; i < deleteMarketer.length; i += batchSize) {
            const batch = deleteMarketer.slice(i, i + batchSize);
            operations.push(MarketDetail.deleteMany({ _id: { $in: batch } }));
        }
    }

    try {
        await Promise.all(operations);
        // return ReS(res, { message: "Bulk operation completed successfully!" }, httpStatus.OK);
    } catch (err) {
        return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    }

    // if (bulkUpdate.length > 0) {
    //     let bulkU;
    //     for (let i = 0; i < bulkUpdate.length; i += batchSize) {
    //         const batch = bulkUpdate.slice(i, i + batchSize);
    //         [err, bulkU] = await toAwait(MarketDetail.bulkWrite(batch, { ordered: false }));
    //         if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    //     }
    // }

    // if (updateBulkCustomer.length > 0) {
    //     let bulkCustomer;
    //     for (let i = 0; i < updateBulkCustomer.length; i += batchSize) {
    //         const batch = updateBulkCustomer.slice(i, i + batchSize);
    //         [err, bulkCustomer] = await toAwait(Customer.bulkWrite(batch, { ordered: false }));
    //         if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    //     }
    // }

    try {
        await Promise.all([
            updateBulkCustomer.length && processBulkWrite(Customer, updateBulkCustomer, "Customer"),
            bulkUpdate.length && processBulkWrite(MarketDetail, bulkUpdate, "MarketDetail"),
        ]);
    } catch (err) {
        return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    }

    let deleteUser;
    [err, deleteUser] = await toAwait(MarketingHead.deleteOne({ _id: _id }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR)

    if (!deleteUser) {
        return ReE(res, { message: "Failed to delete marketing head!" }, httpStatus.INTERNAL_SERVER_ERROR);
    }

    let obj = {
        userId: user._id,
        action: "DELETE",
        collectionName: "MarketingHead",
        documentId: _id,
        oldData: checkMarketingHead,
        newData: null,
        createdBy: user._id,
        message: `MarketingHead deleted successfully. This head downline MarketDetails levels upgraded and level 2 marketers promoted to MarketingHead.`,
        date: new Date()
    } as unknown as IActivityLog

    let createLog = await addActivityLog(obj)

    if (createLog.success === false) {
        let createErrorLog;
        [err, createErrorLog] = await toAwait(
            activityLogErrorModel.create({
                data: obj,
                errorMsg: createLog.message,
                date: new Date(),
            })
        );
    }

    ReS(res, { message: "marketing_head deleted" }, httpStatus.OK)

}

export const changeMarketingHead = async (req: Request, res: Response) => {
    let err, { id, changeId, memberId } = req.body, marketHead = true, marketData: any;
    let requiredFields = ["id", "changeId"];
    let inVaildFields = requiredFields.filter(x => isNull(req.body[x]));
    if (inVaildFields.length > 0) {
        return ReE(res, { message: `Please enter required fields ${inVaildFields}!.` }, httpStatus.BAD_REQUEST);
    }

    if (!mongoose.isValidObjectId(id)) {
        return ReE(res, { message: `Invalid id!` }, httpStatus.BAD_REQUEST);
    }

    if (!mongoose.isValidObjectId(changeId)) {
        return ReE(res, { message: `Invalid changeId!` }, httpStatus.BAD_REQUEST);
    }

    // let checkMemberId;
    // if(memberId){
    //     if (!mongoose.isValidObjectId(memberId)) {
    //         return ReE(res, { message: `Invalid memberId!` }, httpStatus.BAD_REQUEST);
    //     }
    //     if(memberId === id || memberId === changeId) {
    //         return ReE(res, { message: `memberId can not be same as id or changeId!` }, httpStatus.BAD_REQUEST);
    //     }
    //     [err, checkMemberId] = await toAwait(MarketDetail.findOne({ _id: memberId }));
    //     if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    //     if (!checkMemberId) {
    //         return ReE(res, { message: `marketer detail not found for given memberId!.` }, httpStatus.NOT_FOUND)
    //     }
    //     checkMemberId = checkMemberId as IMarketDetail;
    // }

    if (id === changeId) {
        return ReE(res, { message: `id and changeId can not be same!` }, httpStatus.BAD_REQUEST);
    }

    let checkId;
    [err, checkId] = await toAwait(MarketingHead.findOne({ _id: id }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!checkId) {
        return ReE(res, { message: `marketing_head not found for given id!.` }, httpStatus.NOT_FOUND)
    }

    let checkChangeId;
    [err, checkChangeId] = await toAwait(MarketingHead.findOne({ _id: changeId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!checkChangeId) {
        [err, checkChangeId] = await toAwait(MarketDetail.findOne({ _id: changeId }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!checkChangeId) {
            return ReE(res, { message: `changeId not found in marketing_head and MarketDetail!.` }, httpStatus.NOT_FOUND)
        }
        marketHead = false;
        checkChangeId = checkChangeId as IMarketDetail;
        marketData = checkChangeId;
        if (Number(checkChangeId.level) !== 2) {
            return ReE(res, { message: `Only marketer with level 2 can be changed to marketing head given change user level is ${checkChangeId.level}!.` }, httpStatus.BAD_REQUEST)
        }
        let checkMarketDetailBelong;
        [err, checkMarketDetailBelong] = await toAwait(MarketDetail.findOne({ "overAllHeadBy.headBy": checkChangeId._id }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (checkMarketDetailBelong) {
            return ReE(res, { message: `Given change user is already downline of another marketer so can not be changed!` }, httpStatus.NOT_FOUND)
        }
    }

    let getPercentage;
    [err, getPercentage] = await toAwait(Percentage.findOne({ level: 1 }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getPercentage) {
        return ReE(res, { message: `percentage not found for level 1!.` }, httpStatus.NOT_FOUND)
    }
    getPercentage = getPercentage as IPercentage;

    let getAllCustomer;
    [err, getAllCustomer] = await toAwait(Customer.find({ ddId: id }).populate("cedId"));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    getAllCustomer = getAllCustomer as ICustomer[];

    let updateBulkCustomer: any = []

    for (let index = 0; index < getAllCustomer.length; index++) {
        const element = getAllCustomer[index] as any;
        updateBulkCustomer.push({
            updateOne: {
                filter: { _id: element._id },
                update: { $set: { ddId: changeId } }
            }
        })
    }

    let obj: any = {}

    // if(memberId){
    //     let getLastLevelMarketer;
    //     [err, getLastLevelMarketer] = await toAwait(MarketDetail.find({ "overAllHeadBy.headBy": memberId }));
    //     if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    //     getLastLevelMarketer = getLastLevelMarketer as IMarketDetail;
    //     let overAllObj = [
    //         { headBy: changeId, headByModel: "MarketingHead", level: 1 }
    //     ];
    //     // if(getLastLevelMarketer?.overAllHeadBy?.length !== 0){
    //     //     getLastLevelMarketer?.overAllHeadBy?.map((item: any) => {
    //     //         if(item.headBy.toString() !== memberId.toString()){
    //     //             overAllObj.push(item)
    //     //         }
    //     //     })
    //     // }
    //     // obj = { "overAllHeadBy.headBy": id, overAllHeadBy: overAllObj }

    // }else{
    //     obj = { "overAllHeadBy.headBy": id }
    // }

    let getAllLevel1Marketer;
    [err, getAllLevel1Marketer] = await toAwait(MarketDetail.find({ "overAllHeadBy.headBy": id }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    getAllLevel1Marketer = getAllLevel1Marketer as any[]

    let bulkUpMarketer: any = []

    for (let index = 0; index < getAllLevel1Marketer.length; index++) {
        const element = getAllLevel1Marketer[index];
        let overAllObj = [
            { headBy: changeId, headByModel: "MarketingHead", level: 1 }
        ];
        if (element?.overAllHeadBy?.length !== 0) {
            element?.overAllHeadBy?.map((item: any) => {
                if (item.headBy.toString() !== id.toString()) {
                    overAllObj.push(item)
                }
            })
        }
        let obj: any = { overAllHeadBy: overAllObj };
        let overAllArrayLen = element.overAllHeadBy.length;
        if (Number(element.level) === 2 || overAllArrayLen === 1) {
            obj.headBy = changeId;
        }
        bulkUpMarketer.push({
            updateOne: {
                filter: { _id: element._id },
                update: { $set: obj }
            }
        })
    }

    // let batchSize = 500;

    // if (bulkUpMarketer.length > 0) {
    //     let bulkU;
    //     for (let i = 0; i < bulkUpMarketer.length; i += batchSize) {
    //         const batch = bulkUpMarketer.slice(i, i + batchSize);
    //         [err, bulkU] = await toAwait(MarketDetail.bulkWrite(batch, { ordered: false }));
    //         if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    //     }
    // }

    // if (updateBulkCustomer.length > 0) {
    //     let bulkCustomer;
    //     for (let i = 0; i < updateBulkCustomer.length; i += batchSize) {
    //         const batch = updateBulkCustomer.slice(i, i + batchSize);
    //         [err, bulkCustomer] = await toAwait(Customer.bulkWrite(batch, { ordered: false }));
    //         if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    //     }
    // }

    try {
        await Promise.all([
            updateBulkCustomer.length && processBulkWrite(Customer, updateBulkCustomer, "Customer"),
            bulkUpMarketer.length && processBulkWrite(MarketDetail, bulkUpMarketer, "MarketDetail"),
        ]);
    } catch (err) {
        return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    }

    if (!marketHead) {
        let createMHead;
        [err, createMHead] = await toAwait(MarketingHead.create({
            name: marketData.name,
            phone: marketData.phone,
            address: marketData.address,
            email: marketData.email,
            age: marketData.age,
            level: 1,
            gender: marketData.gender,
            id: marketData.id,
            status: marketData.status,
            percentageId: getPercentage._id,
            oldData: marketData.oldData,
            _id: changeId
        }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        let deleteM;
        [err, deleteM] = await toAwait(MarketDetail.deleteOne({ _id: changeId }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    }

    return ReS(res, { message: "Marketing head updated successfully!" }, httpStatus.OK)

}

export const upgradeMarketerDetailToHead = async (req: CustomRequest, res: Response) => {
    let err, { id } = req.body, user = req.user as IUser;
    if (!id) {
        return ReE(res, { message: `Marketer Detail id is required!` }, httpStatus.BAD_REQUEST);
    }

    if (!mongoose.isValidObjectId(id)) {
        return ReE(res, { message: `Invalid Marketer Detail id!` }, httpStatus.BAD_REQUEST);
    }

    let marketDetail;
    [err, marketDetail] = await toAwait(MarketDetail.findOne({ _id: id }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!marketDetail) {
        return ReE(res, { message: `marketDetail not found for given id!.` }, httpStatus.NOT_FOUND)
    }
    marketDetail = marketDetail as IMarketDetail;

    let headId = marketDetail.overAllHeadBy.find((i: any) => i.level === 1)?.headBy;

    let getAllMarketDetail;
    [err, getAllMarketDetail] = await toAwait(MarketDetail.find({ "overAllHeadBy.headBy": id }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    getAllMarketDetail = getAllMarketDetail as IMarketDetail[];

    let bulkUpMarketer: any = [];

    let getAllPercentage;
    [err, getAllPercentage] = await toAwait(Percentage.find({}).sort({ level: 1 }));

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    getAllPercentage = getAllPercentage as IPercentage[];

    if (getAllPercentage.length === 0) {
        return ReE(res, { message: `Percentage data's not found in database!.` }, httpStatus.NOT_FOUND)
    }

    for (let index = 0; index < getAllMarketDetail.length; index++) {
        const element = getAllMarketDetail[index] as IMarketDetail;
        let overAllObj: any = []
        if (element.level < marketDetail.level) {
            console.log("element.level", element.level, marketDetail.level, index);
            overAllObj = element.overAllHeadBy?.filter((item: any) => item?.level < marketDetail.level);
            if (overAllObj.length !== 0) {
                let obj: any = { overAllHeadBy: overAllObj }
                if (element.headBy?.toString() === id.toString()) {
                    let lastLevel = overAllObj[overAllObj.length - 1]
                    if (lastLevel) {
                        obj.headBy = lastLevel.headBy;
                    }
                }
                bulkUpMarketer.push({
                    updateOne: {
                        filter: { _id: element._id },
                        update: { $set: obj }
                    }
                })
            }
        } else if (element.level > marketDetail.level) {
            let upLevel = Math.abs(Number(element.level) + 1 - Number(marketDetail.level));
            let percentage = getAllPercentage.find((item: any) => item.level === upLevel);
            if (!percentage) {
                let findMaxLevel = Math.max(...getAllPercentage.map((i: any) => i.level));
                percentage = getAllPercentage.find((i: any) => i.level === findMaxLevel);
            }
            if (!percentage) {
                return ReE(res, { message: `Percentage not found for this level ${upLevel}!.` }, httpStatus.NOT_FOUND)
            }
            overAllObj = element.overAllHeadBy?.map((item: any, i) => {
                if (item?.level === marketDetail.level) {
                    return {
                        headBy: marketDetail._id,
                        level: 1,
                        headByModel: "MarketingHead"
                    }
                }
                if (item?.level > marketDetail.level) {
                    let level = Math.abs(Number(item.level) + 1 - Number(marketDetail.level));
                    return { headBy: item.headBy, level: level, headByModel: item.headByModel }
                }
                return null;
            })
                .filter(Boolean);
            let overAllLast = overAllObj.length > 0 ? Math.max(...overAllObj.map((i: any) => i.level)) : undefined;
            overAllLast = overAllLast as any
            let headBy = overAllObj.find((i: any) => i.level === overAllLast)?.headBy;
            let headByModel = overAllObj.length === 1 ? "MarketingHead" : "MarketerDetail"
            bulkUpMarketer.push({
                updateOne: {
                    filter: { _id: element._id },
                    update: { $set: { overAllHeadBy: overAllObj, level: upLevel, percentageId: percentage?._id, headBy: headBy, headByModel } }
                }
            })
        }
    }

    let bulkCustomerUpdate: any = [];
    let getAllCustomerCedAsId;
    [err, getAllCustomerCedAsId] = await toAwait(Customer.find({ cedId: id }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    getAllCustomerCedAsId = getAllCustomerCedAsId as ICustomer[];

    if (getAllCustomerCedAsId.length !== 0) {
        for (let index = 0; index < getAllCustomerCedAsId.length; index++) {
            const element = getAllCustomerCedAsId[index];
            bulkCustomerUpdate.push({
                updateOne: {
                    filter: { _id: element._id },
                    update: { $set: { ddId: marketDetail._id, cedId: null } }
                }
            })
        }
    }

    let getAllCustomerDD;
    [err, getAllCustomerDD] = await toAwait(Customer.aggregate([
        {
            $match: { ddId: headId, cedId: { $ne: id } }
        },
        {
            $lookup: {
                from: "marketdetails",
                localField: "cedId",
                foreignField: "_id",
                as: "cedId"
            }
        },
        {
            $unwind: {
                path: "$cedId",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $match: {
                "cedId.overAllHeadBy.headBy": Types.ObjectId.createFromHexString(id)
            }
        }
    ]));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    getAllCustomerDD = getAllCustomerDD as ICustomer[];

    if (getAllCustomerDD.length !== 0) {
        for (let index = 0; index < getAllCustomerDD.length; index++) {
            const element = getAllCustomerDD[index];
            bulkCustomerUpdate.push({
                updateOne: {
                    filter: { _id: element._id },
                    update: { $set: { ddId: marketDetail._id } }
                }
            })
        }
    }

    let getPercentage = getAllPercentage.find((item: any) => item.level === 1) as IPercentage;

    if (!getPercentage) {
        return ReE(res, { message: `Percentage not found for level 1 in db!.` }, httpStatus.NOT_FOUND)
    }

    try {
        await Promise.all([
            bulkCustomerUpdate.length && processBulkWrite(Customer, bulkCustomerUpdate, "Customer"),
            bulkUpMarketer.length && processBulkWrite(MarketDetail, bulkUpMarketer, "MarketDetail"),
        ]);
    } catch (err) {
        return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    }

    // let batchSize = 500;
    // if (bulkCustomerUpdate.length > 0) {
    //     let bulkCustomer;
    //     for (let i = 0; i < bulkCustomerUpdate.length; i += batchSize) {
    //         const batch = bulkCustomerUpdate.slice(i, i + batchSize);
    //         [err, bulkCustomer] = await toAwait(Customer.bulkWrite(batch, { ordered: false }));
    //         if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    //         console.log(` ${i + batch.length} / ${bulkCustomerUpdate.length} customers updated.`);
    //     }
    // }

    // if (bulkUpMarketer.length > 0) {
    //     let bulkU;
    //     for (let i = 0; i < bulkUpMarketer.length; i += batchSize) {
    //         const batch = bulkUpMarketer.slice(i, i + batchSize);
    //         [err, bulkU] = await toAwait(MarketDetail.bulkWrite(batch, { ordered: false }));
    //         if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    //         console.log(` ${i + batch.length} / ${bulkUpMarketer.length} marketer details updated.`);
    //     }
    // }

    let createMHead;
    [err, createMHead] = await toAwait(MarketingHead.create({
        name: marketDetail.name,
        phone: marketDetail.phone,
        address: marketDetail.address,
        level: 1,
        id: marketDetail.id,
        status: marketDetail.status,
        percentageId: getPercentage._id,
        oldData: marketDetail.oldData,
        _id: id
    }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    let deleteM;
    [err, deleteM] = await toAwait(MarketDetail.deleteOne({ _id: id }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    let obj = {
        userId: user._id,
        action: "UPDATE",
        collectionName: "MarketerDetail",
        documentId: id,
        oldData: marketDetail,
        newData: null,
        createdBy: user._id,
        message: `Marketer detail name: ${marketDetail.name} is upgraded to MarketingHead successfully. This marketer downline MarketDetails levels are also upgraded and percentage updated according to new level. Also, this marketer based customers ddId are updated.`,
        date: new Date()
    } as unknown as IActivityLog

    let createLog = await addActivityLog(obj)

    if (createLog.success === false) {
        let createErrorLog;
        [err, createErrorLog] = await toAwait(
            activityLogErrorModel.create({
                data: obj,
                errorMsg: createLog.message,
                date: new Date(),
            })
        );
    }

    return ReS(res, { message: "Marketer Detail upgrade to head successfully!" }, httpStatus.OK)

}