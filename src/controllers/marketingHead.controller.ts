import { Request, Response } from "express";
import httpStatus from "http-status";
import mongoose from "mongoose";
import { Counter } from "../models/counter.model";
import EditRequest from "../models/editRequest.model";
import { MarketingHead } from "../models/marketingHead.model";
import { Percentage } from "../models/percentage.model";
import { isEmail, isNull, isPhone, ReE, ReS, toAwait } from "../services/util.service";
import CustomRequest from "../type/customRequest";
import { IEditRequest } from "../type/editRequest";
import { IMarketingHead } from "../type/marketingHead";
import { IPercentage } from "../type/percentage";
import { IUser } from "../type/user";
import { sendPushNotificationToSuperAdmin } from "./common";

export const createMarketingHead = async (req: Request, res: Response) => {
    let body = req.body, err;
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
    if(checkPer.name.toUpperCase()?.trim() !== "DIAMOND DIRECTOR"){
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
        let findPhone;
        [err, findPhone] = await toAwait(MarketingHead.findOne({ phone: phone }))
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (findPhone) {
            return ReE(res, { message: `Phone already exists!.` }, httpStatus.BAD_REQUEST)
        }
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
        if(checkPer.name.toUpperCase()?.trim() !== "DIAMOND DIRECTOR"){
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
        if(!isEmail(updateFields.email)){
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
        let findPhone;
        [err, findPhone] = await toAwait(MarketingHead.findOne({ phone: updateFields.phone, _id: { $ne: _id } }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (findPhone) {
            return ReE(res, { message: `Phone already exists!.` }, httpStatus.BAD_REQUEST)
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
    const search = (req.query.search as string) || "";

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

export const deleteMarketingHead = async (req: Request, res: Response) => {
    let err, { _id } = req.body;
    if (!_id) {
        return ReE(res, { message: `Marketing_head _id is required!` }, httpStatus.BAD_REQUEST);
    }
    if (!mongoose.isValidObjectId(_id)) {
        return ReE(res, { message: `Invalid marketing_head id!` }, httpStatus.BAD_REQUEST);
    }

    let checkUser;
    [err, checkUser] = await toAwait(MarketingHead.findOne({ _id: _id }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!checkUser) {
        return ReE(res, { message: `marketing_head not found for given id!.` }, httpStatus.NOT_FOUND)
    }

    let deleteUser;
    [err, deleteUser] = await toAwait(MarketingHead.deleteOne({ _id: _id }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR)
    ReS(res, { message: "marketing_head deleted" }, httpStatus.OK)

}