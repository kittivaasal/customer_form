import { Request, Response } from "express";
import httpStatus from "http-status";
import mongoose from "mongoose";
import EditRequest from "../models/editRequest.model";
import { Percentage } from "../models/percentage.model";
import { isNull, ReE, ReS, toAwait } from "../services/util.service";
import CustomRequest from "../type/customRequest";
import { IEditRequest } from "../type/editRequest";
import { IPercentage } from "../type/percentage";
import { IUser } from "../type/user";
import { sendPushNotificationToSuperAdmin } from "./common";
export const createPercentage = async (req: Request, res: Response) => {
    let body = req.body, err;
    let { name, rate } = body;
    let fields = ["name", "rate"];
    let inVaildFields = fields.filter(x => isNull(body[x]));
    if (inVaildFields.length > 0) {
        return ReE(res, { message: `Please enter required fields ${inVaildFields}!.` }, httpStatus.BAD_REQUEST);
    }
    if (name) {
        name = name.trim().toLowerCase();
        let findPhone;
        [err, findPhone] = await toAwait(Percentage.findOne({ name }))
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (findPhone) {
            return ReE(res, { message: `percentage name already exists!.` }, httpStatus.BAD_REQUEST)
        }
    }
    let percentage;
    [err, percentage] = await toAwait(Percentage.create(body));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!percentage) {
        return ReE(res, { message: `Failed to create percentage!.` }, httpStatus.INTERNAL_SERVER_ERROR)
    }
    ReS(res, { message: `percentage added successfull` }, httpStatus.CREATED);
};

export const updatePercentage = async (req: CustomRequest, res: Response) => {
    const body = req.body, user = req.user as IUser;
    if (!user) return ReE(res, { message: `authentication not added in this api please contact admin!` }, httpStatus.UNAUTHORIZED);
    let err: any;
    let { _id, name, rate } = body;
    let fields = ["name", "rate"];
    let inVaildFields = fields.filter(x => !isNull(body[x]));
    if (inVaildFields.length === 0) {
        return ReE(res, { message: `Please enter any one field to update ${fields}!.` }, httpStatus.BAD_REQUEST);
    }
    if (!_id) {
        return ReE(res, { message: `_id is required!` }, httpStatus.BAD_REQUEST);
    }

    let getPercentage;
    [err, getPercentage] = await toAwait(Percentage.findOne({ _id: _id }));

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getPercentage) {
        return ReE(res, { message: `percentage not found for given id!.` }, httpStatus.NOT_FOUND)
    }

    const updateFields: Record<string, any> = {};
    for (const key of fields) {
        if (!isNull(body[key])) {
            updateFields[key] = body[key];
        }
    }

    if (updateFields.name) {
        updateFields.name = updateFields.name.trim().toLowerCase();
        let findPhone;
        [err, findPhone] = await toAwait(Percentage.findOne({ name, _id: { $ne: _id } }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (findPhone) {
            return ReE(res, { message: `Name already exists!.` }, httpStatus.BAD_REQUEST)
        }
    }

    if (user.isAdmin === false) {
        const changes: { field: string; oldValue: any; newValue: any }[] = [];
        fields.forEach((key: any) => {
            const newValue = body[key];
            const oldValue = (getPercentage as any)[key];
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
                return ReE(res, { message: "You already have a pending edit request for this percentage." }, httpStatus.BAD_REQUEST);
            }
        }

        let createReq;
        [err, createReq] = await toAwait(
            EditRequest.create({
                targetModel: "Percentage",
                targetId: _id,
                editedBy: user._id,
                changes,
                status: "pending"
            })
        );

        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

        createReq = createReq as IEditRequest;

        ReS(res, { message: "Edit request created successfully, Awaiting for approval." }, httpStatus.OK);

        let send = await sendPushNotificationToSuperAdmin("Edit request for Percentage", `A new edit request for Percentage has been created by ${user.name}`, createReq._id.toString())

        if (!send.success) {
            return console.log(send.message);
        }

        return console.log("Edit request push notification sent.");
    } else {

        const [updateErr, updateResult] = await toAwait(
            Percentage.updateOne({ _id }, { $set: updateFields })
        );
        if (updateErr) return ReE(res, updateErr, httpStatus.INTERNAL_SERVER_ERROR)
        return ReS(res, { message: "Percentage updated successfully." }, httpStatus.OK);
    }
};

export const getByIdPercentage = async (req: Request, res: Response) => {
    let err, { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return ReE(res, { message: `Invalid percentage id!` }, httpStatus.BAD_REQUEST);
    }

    let getPercentage;
    [err, getPercentage] = await toAwait(Percentage.findOne({ _id: id }));

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getPercentage) {
        return ReE(res, { message: `percentage not found for given id!.` }, httpStatus.NOT_FOUND)
    }

    ReS(res, { message: "percentage found", data: getPercentage }, httpStatus.OK)
}

export const getAllPercentage = async (req: Request, res: Response) => {
    let err, getPercentage;

    const page = req.query.page ? parseInt(req.query.page as string) : null;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : null;
    const search = (req.query.search as string) || "";

    const searchConditions: any[] = [];
    if (search) {
        searchConditions.push(
            { name: { $regex: search, $options: "i" } },
            { rate: { $regex: search, $options: "i" } },
            { id: { $regex: search, $options: "i" } }
        );

        if (mongoose.Types.ObjectId.isValid(search)) {
            searchConditions.push({ _id: new mongoose.Types.ObjectId(search) });
        }
    }

    let filter: any = {};
    if (searchConditions.length > 0) {
        filter.$or = searchConditions;
    }

    let query = Percentage.find(filter).sort({ createdAt: -1 });

    if (page && limit) {
        const skip = (page - 1) * limit;
        query = query.skip(skip).limit(limit);
    }

    let total;
    let totalPages = 1;

    if (page && limit) {
        let count;
        [err, count] = await toAwait(Percentage.countDocuments(filter));
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

    [err, getPercentage] = await toAwait(query);

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    getPercentage = getPercentage as IPercentage[]
    
    // Note: Removed the 404 check for empty array to be consistent with other endpoints
    // if (getPercentage.length === 0) {
    //     return ReE(res, { message: `percentage not found!.` }, httpStatus.NOT_FOUND)
    // }

    return ReS(res, {
        message: "percentage found",
        data: getPercentage,
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

export const deletePercentage = async (req: Request, res: Response) => {
    let err, { _id } = req.body;
    if (!_id) {
        return ReE(res, { message: `Percentage _id is required!` }, httpStatus.BAD_REQUEST);
    }
    if (!mongoose.isValidObjectId(_id)) {
        return ReE(res, { message: `Invalid percentage id!` }, httpStatus.BAD_REQUEST);
    }

    let checkUser;
    [err, checkUser] = await toAwait(Percentage.findOne({ _id: _id }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!checkUser) {
        return ReE(res, { message: `percentage not found for given id!.` }, httpStatus.NOT_FOUND)
    }

    let deleteUser;
    [err, deleteUser] = await toAwait(Percentage.deleteOne({ _id: _id }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR)
    ReS(res, { message: "percentage deleted" }, httpStatus.OK)

}