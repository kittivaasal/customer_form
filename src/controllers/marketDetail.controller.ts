import { Request, Response } from "express";
import httpStatus from "http-status";
import mongoose from "mongoose";
import { Counter } from "../models/counter.model";
import EditRequest from "../models/editRequest.model";
import { MarketDetail } from "../models/marketDetail.model";
import { MarketingHead } from "../models/marketingHead.model";
import { isNull, isPhone, ReE, ReS, toAwait } from "../services/util.service";
import CustomRequest from "../type/customRequest";
import { IEditRequest } from "../type/editRequest";
import { IMarketDetail } from "../type/marketDetail";
import { IUser } from "../type/user";
import { sendPushNotificationToSuperAdmin } from "./common";

export const createMarketDetail = async (req: Request, res: Response) => {
    let body = req.body, err;
    let { headBy, phone, address, status, name } = body;
    let fields = ["headBy", "phone", "address", "status", "name"];
    let inVaildFields = fields.filter(x => isNull(body[x]));
    if (inVaildFields.length > 0) {
        return ReE(res, { message: `Please enter required fields ${inVaildFields}!.` }, httpStatus.BAD_REQUEST);
    }
    if (phone) {
        if (!isPhone(phone)) {
            return ReE(res, { message: `Invalid phone number!.` }, httpStatus.BAD_REQUEST)
        }
        let findPhone;
        [err, findPhone] = await toAwait(MarketDetail.findOne({ phone: phone }))
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (findPhone) {
            return ReE(res, { message: `Phone already exists!.` }, httpStatus.BAD_REQUEST)
        }
    }
    if (!mongoose.isValidObjectId(headBy)) {
        return ReE(res, { message: 'Invalid headBy id!' }, httpStatus.BAD_REQUEST);
    }
    let findExist;
    [err, findExist] = await toAwait(MarketingHead.findById({ _id: headBy }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!findExist) {
        return ReE(res, { message: `Marketing head is not found given id: ${headBy}!.` }, httpStatus.NOT_FOUND);
    }

    let getSequence, count = 0;
    [err, getSequence] = await toAwait(Counter.findOne({ name: "Marketdetail" }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getSequence) {
        let newCounter = new Counter({
            name: "Marketdetail",
            seq: 1
        });
        await newCounter.save();
        count = 1;
    } else {
        getSequence = getSequence as any;
        count = getSequence.seq + 1;
        let updateCustomerCounter;
        [err, updateCustomerCounter] = await toAwait(
            Counter.updateOne({ _id: getSequence._id }, { $set: { seq: count } })
        )
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    }

    body.id = count.toString().padStart(4, '0');

    let marketDetail;
    [err, marketDetail] = await toAwait(MarketDetail.create(body));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!marketDetail) {
        return ReE(res, { message: `Failed to create marketDetail!.` }, httpStatus.INTERNAL_SERVER_ERROR)
    }
    ReS(res, { message: `marketDetail added successfull` }, httpStatus.CREATED);
};

export const updateMarketDetail = async (req: CustomRequest, res: Response) => {
    const body = req.body, user = req.user as IUser;
    let err: any;
    let { _id, headBy, phone, address, status, name } = body;
    let fields = ["headBy", "phone", "address", "status", 'name'];
    let inVaildFields = fields.filter(x => !isNull(body[x]));
    if (inVaildFields.length === 0) {
        return ReE(res, { message: `Please enter any one field to update ${fields}!.` }, httpStatus.BAD_REQUEST);
    }
    if (!_id) {
        return ReE(res, { message: `_id is required!` }, httpStatus.BAD_REQUEST);
    }

    let getMarketDetail;
    [err, getMarketDetail] = await toAwait(MarketDetail.findOne({ _id: _id }));

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getMarketDetail) {
        return ReE(res, { message: `marketDetail not found for given id!.` }, httpStatus.NOT_FOUND)
    }

    const updateFields: Record<string, any> = {};
    for (const key of fields) {
        if (!isNull(body[key])) {
            updateFields[key] = body[key];
        }
    }

    if (headBy) {
        if (!mongoose.isValidObjectId(headBy)) {
            return ReE(res, { message: 'Invalid headBy id!' }, httpStatus.BAD_REQUEST);
        }
        let findExist;
        [err, findExist] = await toAwait(MarketingHead.findById(headBy));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!findExist) {
            return ReE(res, { message: `Marketing head is not found given id: ${headBy}!.` }, httpStatus.NOT_FOUND);
        }
    }

    if (updateFields.phone) {
        if (!isPhone(updateFields.phone)) {
            return ReE(res, { message: `Invalid phone number!.` }, httpStatus.BAD_REQUEST)
        }
        let findPhone;
        [err, findPhone] = await toAwait(MarketDetail.findOne({ phone: updateFields.phone, _id: { $ne: _id } }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (findPhone) {
            return ReE(res, { message: `Phone already exists!.` }, httpStatus.BAD_REQUEST)
        }
    }

    if (user.isAdmin === false) {

        const changes: { field: string; oldValue: any; newValue: any }[] = [];
        fields.forEach((key: any) => {
            const newValue = body[key];
            const oldValue = (getMarketDetail as any)[key];
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
                return ReE(res, { message: "You already have a pending edit request for this marketDetail." }, httpStatus.BAD_REQUEST);
            }
        }

        let createReq;
        [err, createReq] = await toAwait(
            EditRequest.create({
                targetModel: "MarketDetail",
                targetId: _id,
                editedBy: user._id,
                changes,
                status: "pending",
            })
        );

        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

        createReq = createReq as IEditRequest;

        ReS(res, { message: "Edit request created successfully, Awaiting for approval." }, httpStatus.OK);

        let send = await sendPushNotificationToSuperAdmin("Edit request for MarketDetail", `A new edit request for marketDetail has been created by ${user.name}`, createReq._id.toString())

        if (!send.success) {
            return console.log(send.message);
        }

        return console.log("Edit request push notification sent.");

    } else {

        let updateResult;

        [err, updateResult] = await toAwait(
            MarketDetail.updateOne({ _id }, { $set: updateFields })
        );
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR)
        return ReS(res, { message: "MarketDetail updated successfully." }, httpStatus.OK);

    }

};

export const getByIdMarketDetail = async (req: Request, res: Response) => {
    let err, { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return ReE(res, { message: `Invalid marketDetail id!` }, httpStatus.BAD_REQUEST);
    }

    let getMarketDetail;
    [err, getMarketDetail] = await toAwait(MarketDetail.findOne({ _id: id }).populate("headBy"));

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getMarketDetail) {
        return ReE(res, { message: `marketDetail not found for given id!.` }, httpStatus.NOT_FOUND)
    }

    ReS(res, { message: "marketDetail found", data: getMarketDetail }, httpStatus.OK)
}

export const getAllMarketDetail = async (req: Request, res: Response) => {
    let err, getMarketDetail, query = req.query;

    let { head } = query
    let option: any = {};

    if (head) {
        if (!mongoose.isValidObjectId(head)) {
            return ReE(res, { message: `Invalid head id!` }, httpStatus.BAD_REQUEST);
        }
        let getHead;
        [err, getHead] = await toAwait(MarketingHead.findOne({ _id: head }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!getHead) {
            return ReE(res, { message: `head not found for given id!.` }, httpStatus.NOT_FOUND)
        }
        option.headBy = head
    }

    const page = req.query.page ? parseInt(req.query.page as string) : null;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : null;

    let queryTo = MarketDetail.find(option)
        .populate({
            path: "headBy",
            populate: [
                { path: "percentageId" }
            ]
        })
        .sort({ createdAt: -1 });

    if (page && limit) {
        const skip = (page - 1) * limit;
        queryTo = queryTo.skip(skip).limit(limit);
    }

    let total;
    let totalPages = 1;

    if (page && limit) {
        let count;
        [err, count] = await toAwait(MarketDetail.countDocuments(option));
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

    [err, getMarketDetail] = await toAwait(queryTo);

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    getMarketDetail = getMarketDetail as IMarketDetail[]
    // if (getMarketDetail.length === 0) {
    //     return ReE(res, { message: `marketDetail not found!.` }, httpStatus.NOT_FOUND)
    // }

    ReS(res, { message: "marketDetail found", data: getMarketDetail }, httpStatus.OK)
}

export const getBothMarketerMarketerHead = async (req: Request, res: Response) => {
    let err, getMarketDetail: any, getMarketerHead: any;
    let { search, page, limit, head } = req.query;

    let baseQuery: any = {};
    if (search) {
        baseQuery = {
            $or: [
                { name: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ]
        };
    }

    // Separate queries because 'head' filters differently for each collection
    let queryMD = { ...baseQuery };
    let queryMH = { ...baseQuery };

    if (head) {
        if (!mongoose.isValidObjectId(head)) {
            return ReE(res, { message: `Invalid head id!` }, httpStatus.BAD_REQUEST);
        }
        queryMD.headBy = head;
        queryMH._id = head;
    }

    const pageNum = page ? parseInt(page as string) : null;
    const limitNum = limit ? parseInt(limit as string) : null;

    if (pageNum && limitNum) {
        let countMarketDetail: any = 0;
        
        let countRes: any[] = await toAwait(MarketDetail.countDocuments(queryMD));
        err = countRes[0];
        countMarketDetail = countRes[1];

        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

        const skip = (pageNum - 1) * limitNum;

        let marketDetailsPromise: Promise<any> = Promise.resolve([]);
        let marketingHeadsPromise: Promise<any> = Promise.resolve([]);

        if (skip < countMarketDetail) {
            marketDetailsPromise = MarketDetail.find(queryMD)
                .populate({
                    path: "headBy",
                    populate: { path: "percentageId" }
                })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum);
        }

        let fetchedFromDetailCount = 0;
        if(skip < countMarketDetail) {
             fetchedFromDetailCount = Math.min(limitNum, countMarketDetail - skip);
        }

        let remainingLimit = limitNum - fetchedFromDetailCount;

        if (remainingLimit > 0) {
            let headSkip = Math.max(0, skip - countMarketDetail);
            marketingHeadsPromise = MarketingHead.find(queryMH)
                .populate("percentageId")
                .sort({ createdAt: -1 })
                .skip(headSkip)
                .limit(remainingLimit);
        }

        let marketDetailRes: any[] = await toAwait(marketDetailsPromise);
        err = marketDetailRes[0];
        getMarketDetail = marketDetailRes[1];
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

        let marketerHeadRes: any[] = await toAwait(marketingHeadsPromise);
        err = marketerHeadRes[0];
        getMarketerHead = marketerHeadRes[1];
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    } else {
        let marketDetailRes: any[] = await toAwait(MarketDetail.find(queryMD)
            .populate({
                path: "headBy",
                populate: { path: "percentageId" }
            })
            .sort({ createdAt: -1 }));
        err = marketDetailRes[0];
        getMarketDetail = marketDetailRes[1];
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

        let marketerHeadRes: any[] = await toAwait(MarketingHead.find(queryMH)
            .populate("percentageId")
            .sort({ createdAt: -1 }));
        err = marketerHeadRes[0];
        getMarketerHead = marketerHeadRes[1];
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    }

    const combinedData = [
        ...(getMarketDetail || []), 
        ...(getMarketerHead || [])
    ];

    ReS(res, { message: "Data found", data: combinedData }, httpStatus.OK);
}

export const deleteMarketDetail = async (req: Request, res: Response) => {
    let err, { _id } = req.body;
    if (!_id) {
        return ReE(res, { message: `MarketDetail _id is required!` }, httpStatus.BAD_REQUEST);
    }
    if (!mongoose.isValidObjectId(_id)) {
        return ReE(res, { message: `Invalid marketDetail id!` }, httpStatus.BAD_REQUEST);
    }

    let checkUser;
    [err, checkUser] = await toAwait(MarketDetail.findOne({ _id: _id }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!checkUser) {
        return ReE(res, { message: `marketDetail not found for given id!.` }, httpStatus.NOT_FOUND)
    }

    let deleteUser;
    [err, deleteUser] = await toAwait(MarketDetail.deleteOne({ _id: _id }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR)
    ReS(res, { message: "marketDetail deleted" }, httpStatus.OK)

}