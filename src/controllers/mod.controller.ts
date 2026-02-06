import { Request, Response } from "express";
import httpStatus from "http-status";
import mongoose from "mongoose";
import EditRequest from "../models/editRequest.model";
import { Mod } from "../models/mod.model";
import { isNull, ReE, ReS } from "../services/util.service";
import CustomRequest from "../type/customRequest";
import { IUser } from "../type/user";
import { sendPushNotificationToSuperAdmin } from "./common";

import { ModCustomer } from "../models/modCustomer.model";

export const createMod = async (req: CustomRequest, res: Response) => {
    try {
        const body = req.body;
        const user = req.user as IUser; // Assuming user is attached to request

        // Fields from body
        const {
            modCustomerId, // Existing ModCustomer ID
            name, phone, email, address, // New ModCustomer fields
            projectId,
            paidDate,
            plotNo,
            landCost,
            ratePerSqft,
            referenceId,
            introducerName,
            introducerPhone,
            directorName,
            directorPhone,
            EDName,
            EDPhone,
            totalAmount,
            paidAmount,
            status
        } = body;

        // Basic validation
        if (!projectId || !mongoose.isValidObjectId(projectId)) {
            return ReE(res, { message: `Valid projectId is required!` }, httpStatus.BAD_REQUEST);
        }

        let customerIdToUse;

        // Logic: Either use existing modCustomerId OR create new ModCustomer
        if (modCustomerId) {
            if (!mongoose.isValidObjectId(modCustomerId)) {
                return ReE(res, { message: 'Invalid modCustomerId!' }, httpStatus.BAD_REQUEST);
            }
            const existingCustomer = await ModCustomer.findById(modCustomerId);
            if (!existingCustomer) {
                return ReE(res, { message: `ModCustomer not found for id: ${modCustomerId}` }, httpStatus.NOT_FOUND);
            }
            customerIdToUse = existingCustomer._id;
        } else {
            // Validate required fields for new customer if needed (e.g., name)
            if (!name) {
                return ReE(res, { message: `Name is required for new customer!` }, httpStatus.BAD_REQUEST);
            }

            // Create new ModCustomer
            const newCustomer = await ModCustomer.create({
                name,
                phone,
                email,
                address,
                projectId,
                createdBy: user?._id
            });
            customerIdToUse = newCustomer._id;
        }

        // Create Mod
        const modData = {
            paidDate,
            projectId,
            plotNo,
            landCost,
            ratePerSqft,
            referenceId,
            customerId: customerIdToUse,
            introducerName,
            introducerPhone,
            directorName,
            directorPhone,
            EDName,
            EDPhone,
            totalAmount,
            paidAmount,
            status: status || 'active'
        };

        const mod = await Mod.create(modData);

        if (!mod) {
            return ReE(res, { message: `Failed to create mod!` }, httpStatus.INTERNAL_SERVER_ERROR);
        }

        return ReS(res, { message: `Mod added successfully`, data: mod }, httpStatus.CREATED);

    } catch (error) {
        return ReE(res, error, httpStatus.INTERNAL_SERVER_ERROR);
    }
};

export const updateMod = async (req: CustomRequest, res: Response) => {
    try {
        const body = req.body;
        const user = req.user as IUser;

        if (!user) return ReE(res, { message: "authentication not added in this api please contact admin" }, httpStatus.NOT_FOUND);

        const { _id } = body;

        // Mod Fields
        const modFields = [
            "paidDate", "projectId", "plotNo", "landCost", "ratePerSqft", 
            "referenceId", "customerId", 
            "introducerName", "introducerPhone", 
            "directorName", "directorPhone", 
            "EDName", "EDPhone", 
            "totalAmount", "paidAmount", "status"
        ];

        // ModCustomer Fields
        const customerFields = ["name", "phone", "email", "address"];

        if (!_id) {
            return ReE(res, { message: `_id is required!` }, httpStatus.BAD_REQUEST);
        }

        const getMod = await Mod.findOne({ _id }).populate('customerId');
        if (!getMod) {
            return ReE(res, { message: `mod not found for given id!.` }, httpStatus.NOT_FOUND);
        }

        const getCustomer = await ModCustomer.findOne({ _id: (getMod.customerId as any)._id });
        if (!getCustomer) {
             return ReE(res, { message: `Linked ModCustomer not found` }, httpStatus.NOT_FOUND);
        }


        // Prepare update objects
        const modUpdateData: any = {};
        for (const key of modFields) {
            if (!isNull(body[key])) {
                modUpdateData[key] = body[key];
            }
        }

        const customerUpdateData: any = {};
        for (const key of customerFields) {
            if (!isNull(body[key])) {
                customerUpdateData[key] = body[key];
            }
        }

        if (user.isAdmin === false) {
            // Check for Mod changes
            const modChanges: any[] = [];
            modFields.forEach((key) => {
                const newValue = body[key];
                const oldValue = (getMod as any)[key];
                if (isNull(newValue)) return;
                 // Handle ObjectIds comparisons
                const isObjectId = mongoose.isValidObjectId(newValue) && mongoose.isValidObjectId(oldValue);
                if (isObjectId) {
                    if (newValue.toString() !== oldValue.toString()) {
                        modChanges.push({ field: key, oldValue, newValue });
                    }
                } else if (newValue?.toString() !== oldValue?.toString()) {
                     modChanges.push({ field: key, oldValue, newValue });
                }
            });

            // Check for Customer changes
            const customerChanges: any[] = [];
            customerFields.forEach((key) => {
                const newValue = body[key];
                const oldValue = (getCustomer as any)[key];
                if (isNull(newValue)) return;
                if (newValue?.toString() !== oldValue?.toString()) {
                    customerChanges.push({ field: key, oldValue, newValue });
                }
            });

            if (modChanges.length === 0 && customerChanges.length === 0) {
                return ReE(res, { message: "No changes found to update." }, httpStatus.BAD_REQUEST);
            }

            // Create Edit Requests
            if (modChanges.length > 0) {
                const existingReq = await EditRequest.findOne({ targetId: _id, targetModel: 'Mod', status: 'pending', editedBy: user._id });
                if (existingReq) {
                     return ReE(res, { message: "You already have a pending edit request for this mod." }, httpStatus.BAD_REQUEST);
                }
                const createReq = await EditRequest.create({
                    targetModel: "Mod",
                    targetId: _id,
                    editedBy: user._id,
                    changes: modChanges,
                    status: "pending"
                });
                await sendPushNotificationToSuperAdmin("Edit request for Mod", `A new edit request for Mod has been created by ${user.name}`, createReq._id.toString());
            }

            if (customerChanges.length > 0) {
                 const existingReq = await EditRequest.findOne({ targetId: getCustomer._id, targetModel: 'ModCustomer', status: 'pending', editedBy: user._id });
                 if (!existingReq) { // Only create if not exists
                    const createReq = await EditRequest.create({
                        targetModel: "ModCustomer",
                        targetId: getCustomer._id,
                        editedBy: user._id,
                        changes: customerChanges,
                        status: "pending"
                    });
                     await sendPushNotificationToSuperAdmin("Edit request for ModCustomer", `A new edit request for ModCustomer has been created by ${user.name}`, createReq._id.toString());
                 }
            }

            return ReS(res, { message: "Edit request(s) created successfully, Awaiting for approval." }, httpStatus.OK);

        } else {
            // Admin Update
            if (Object.keys(modUpdateData).length > 0) {
                await Mod.updateOne({ _id }, { $set: modUpdateData });
            }
            if (Object.keys(customerUpdateData).length > 0) {
                await ModCustomer.updateOne({ _id: getCustomer._id }, { $set: customerUpdateData });
            }
            return ReS(res, { message: "Mod and Customer updated successfully." }, httpStatus.OK);
        }

    } catch (error) {
        return ReE(res, error, httpStatus.INTERNAL_SERVER_ERROR);
    }
};

export const getByIdMod = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return ReE(res, { message: `Invalid mod id!` }, httpStatus.BAD_REQUEST);
        }

        const getMod = await Mod.findOne({ _id: id })
            .populate("customerId")
            .populate("projectId");

        if (!getMod) {
            return ReE(res, { message: `Mod not found!` }, httpStatus.NOT_FOUND);
        }

        return ReS(res, { message: "Mod found", data: getMod }, httpStatus.OK);
    } catch (error) {
        return ReE(res, error, httpStatus.INTERNAL_SERVER_ERROR);
    }
}

export const getAllMod = async (req: Request, res: Response) => {
    try {
        const page = req.query.page ? parseInt(req.query.page as string) : null;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : null;
        const search = (req.query.search as string) || "";
        const searchConditions: any[] = [];

        if (search) {
             // 1. Search in Mod Fields
            searchConditions.push(
                { plotNo: { $regex: search, $options: "i" } },
                { introducerName: { $regex: search, $options: "i" } },
                { directorName: { $regex: search, $options: "i" } },
                { EDName: { $regex: search, $options: "i" } },
                { referenceId: { $regex: search, $options: "i" } }
            );

             if (mongoose.Types.ObjectId.isValid(search)) {
                searchConditions.push({ _id: new mongoose.Types.ObjectId(search) });
            }

            // 2. Search in ModCustomer Fields (Name, CustomID)
            const matchingCustomers = await ModCustomer.find({
                $or: [
                    { name: { $regex: search, $options: "i" } },
                    { customId: { $regex: search, $options: "i" } }
                ]
            }).select('_id');

            if (matchingCustomers.length > 0) {
                const customerIds = matchingCustomers.map(c => c._id);
                searchConditions.push({ customerId: { $in: customerIds } });
            }
        }

        const searchQuery = searchConditions.length > 0 ? { $or: searchConditions } : {};

        let query = Mod.find(searchQuery)
            .populate("customerId")
            .populate("projectId")
            .sort({ createdAt: -1 });

        if (page && limit) {
            const skip = (page - 1) * limit;
            query = query.skip(skip).limit(limit);
        }

        let total;
        let totalPages = 1;

        if (page && limit) {
            const count = await Mod.countDocuments(searchQuery);
            total = count;
            totalPages = Math.ceil(total / limit);

            if (page > totalPages && totalPages > 0) {
                return ReE(
                    res,
                    { message: `Page no ${page} not available. The last page no is ${totalPages}.` },
                    httpStatus.NOT_FOUND
                );
            }
        }

        const getMod = await query;
        
        return ReS(
            res,
            {
                message: "Mod found",
                data: getMod,
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
            },
            httpStatus.OK
        );

    } catch (error) {
        return ReE(res, error, httpStatus.INTERNAL_SERVER_ERROR);
    }
}

export const deleteMod = async (req: Request, res: Response) => {
    try {
        const { _id } = req.body;

        if (!_id) {
            return ReE(res, { message: `Mod _id is required!` }, httpStatus.BAD_REQUEST);
        }
        if (!mongoose.isValidObjectId(_id)) {
            return ReE(res, { message: `Invalid mod id!` }, httpStatus.BAD_REQUEST);
        }

        const modToDelete = await Mod.findOne({ _id });

        if (!modToDelete) {
             return ReE(res, { message: `Mod not found for given id!` }, httpStatus.NOT_FOUND);
        }

        const customerId = modToDelete.customerId; 
        
        let message = "Mod deleted successfully.";

        if (customerId) {
            const count = await Mod.countDocuments({ customerId: customerId });
            
            // Delete the Mod entry
            await Mod.deleteOne({ _id });

            // If this was the only mod, delete the customer too
            if (count === 1) {
                await ModCustomer.deleteOne({ _id: customerId });
                message = "Mod and associated Customer deleted successfully.";
            }
        } else {
             // Fallback if no customerId (shouldn't happen with strict schema but good for safety)
             await Mod.deleteOne({ _id });
        }

        return ReS(res, { message }, httpStatus.OK);

    } catch (error) {
        return ReE(res, error, httpStatus.INTERNAL_SERVER_ERROR);
    }
}

export const getAllModCustomer = async (req: Request, res: Response) => {
    try {
        const page = req.query.page ? parseInt(req.query.page as string) : null;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : null;
        const search = (req.query.search as string) || "";
        const searchConditions: any[] = [];

        if (search) {
            searchConditions.push(
                { name: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { customId: { $regex: search, $options: "i" } }
            );

            if (mongoose.Types.ObjectId.isValid(search)) {
                searchConditions.push({ _id: new mongoose.Types.ObjectId(search) });
            }
        }

        const searchQuery = searchConditions.length > 0 ? { $or: searchConditions } : {};

        let query = ModCustomer.find(searchQuery)
            .populate("projectId")
            .sort({ createdAt: -1 });

        if (page && limit) {
            const skip = (page - 1) * limit;
            query = query.skip(skip).limit(limit);
        }

        let total;
        let totalPages = 1;

        if (page && limit) {
            const count = await ModCustomer.countDocuments(searchQuery);
            total = count;
            totalPages = Math.ceil(total / limit);

            if (page > totalPages && totalPages > 0) {
                 return ReE(
                    res,
                    { message: `Page no ${page} not available. The last page no is ${totalPages}.` },
                    httpStatus.NOT_FOUND
                );
            }
        }

        const getCustomers = await query;
        
        return ReS(
            res,
            {
                message: "Mod Customers found",
                data: getCustomers,
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
            },
            httpStatus.OK
        );

    } catch (error) {
        return ReE(res, error, httpStatus.INTERNAL_SERVER_ERROR);
    }
}