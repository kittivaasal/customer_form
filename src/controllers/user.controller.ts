import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import httpStatus from "http-status";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Role } from "../models/role.model";
import { User } from "../models/user.model";
import { isNull, isPhone, ReE, ReS, toAwait } from "../services/util.service";
import CustomRequest from "../type/customRequest";
import { IUser } from "../type/user";

export const createUserByAdmin = async (req: Request, res: Response) => {
    let body = req.body, err;
    let { name, email, role, phone, password } = body;
    let fields = ["name", "email", "role", "phone"];
    let inVaildFields = fields.filter(x => isNull(body[x]));
    if (inVaildFields.length > 0) {
        return ReE(res, { message: `Please enter required fields ${inVaildFields}!.` }, httpStatus.BAD_REQUEST);
    }
    name = name.toLowerCase().trim();
    email = email.toLowerCase().trim();
    if (name.length < 3) {
        return ReE(res, { message: `name length must be greater than 3 letter` }, httpStatus.BAD_REQUEST);
    }
    if (!mongoose.isValidObjectId(role)) {
        return ReE(res, { message: `Invalid role id!` }, httpStatus.BAD_REQUEST);
    }
    if (!isPhone(phone)) {
        return ReE(res, { message: `Invalid phone number!.` }, httpStatus.BAD_REQUEST)
    }
    let checkUser;
    [err, checkUser] = await toAwait(User.findOne({ email }))
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (checkUser) return ReE(res, { message: "email already exist" }, httpStatus.BAD_REQUEST);
    let checkPhone;
    [err, checkPhone] = await toAwait(User.findOne({ phone }))
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (checkPhone) return ReE(res, { message: "Phone no already exist" }, httpStatus.BAD_REQUEST);
    let user;
    let getRole;
    [err, getRole] = await toAwait(Role.findOne({ _id: role }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getRole) {
        return ReE(res, { message: `role not found for given id!.` }, httpStatus.NOT_FOUND)
    }
    if (!password) {
        password = name.slice(0, 1).toUpperCase() + name.slice(1, 3) + '@123'
    }
    let hashedPassword;
    [err, hashedPassword] = await toAwait(bcrypt.hash(password, 10));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!hashedPassword) {
        return ReE(res, { message: `Error in hashing password please try again later` }, httpStatus.INTERNAL_SERVER_ERROR)
    }
    [err, user] = await toAwait(User.create({
        name,
        email,
        phone,
        password: hashedPassword,
        role
    }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!user) {
        return ReE(res, { message: `Failed to create user!.` }, httpStatus.INTERNAL_SERVER_ERROR)
    }
    ReS(res, { message: `user added successfull` }, httpStatus.CREATED);
};

export const createAdminUser = async (req: Request, res: Response) => {
    let body = req.body, err;
    let { name, email, phone, password } = body;
    let fields = ["name", "email", "phone", "password"];
    let inVaildFields = fields.filter(x => isNull(body[x]));
    if (inVaildFields.length > 0) {
        return ReE(res, { message: `Please enter required fields ${inVaildFields}!.` }, httpStatus.BAD_REQUEST);
    }
    name = name.toLowerCase().trim();
    email = email.toLowerCase().trim();
    if (name.length < 3) {
        return ReE(res, { message: `name length must be greater than 3 letter` }, httpStatus.BAD_REQUEST);
    }
    if (!isPhone(phone)) {
        return ReE(res, { message: `Invalid phone number!.` }, httpStatus.BAD_REQUEST)
    }
    let checkUser;
    [err, checkUser] = await toAwait(User.findOne({ email }))
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (checkUser) return ReE(res, { message: "email already exist" }, httpStatus.BAD_REQUEST);
    let checkPhone;
    [err, checkPhone] = await toAwait(User.findOne({ phone }))
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (checkPhone) return ReE(res, { message: "Phone no already exist" }, httpStatus.BAD_REQUEST);
    let hashedPassword;
    [err, hashedPassword] = await toAwait(bcrypt.hash(password, 10));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!hashedPassword) {
        return ReE(res, { message: `Error in hashing password please try again later` }, httpStatus.INTERNAL_SERVER_ERROR)
    }
    let user;
    [err, user] = await toAwait(User.create({
        name,
        email,
        phone,
        password: hashedPassword,
        isAdmin: true
    }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!user) {
        return ReE(res, { message: `Failed to create admin!.` }, httpStatus.INTERNAL_SERVER_ERROR)
    }
    ReS(res, { message: `admin added successfull` }, httpStatus.CREATED);
};

export const updateUserByAdmin = async (req: Request, res: Response) => {
    const body = req.body;
    const { _id } = body;
    let err: any;

    if (!_id) {
        return ReE(res, { message: `_id is required!` }, httpStatus.BAD_REQUEST);
    }

    if (!mongoose.isValidObjectId(_id)) {
        return ReE(res, { message: `Invalid user _id!` }, httpStatus.BAD_REQUEST);
    }

    let fields = ["name", "email", "role", "phone", "password"];
    let inVaildFields = fields.filter(x => !isNull(body[x]));
    if (inVaildFields.length === 0) {
        return ReE(res, { message: `Please enter any one field to update ${fields}!.` }, httpStatus.BAD_REQUEST);
    }

    let getUser;
    [err, getUser] = await toAwait(User.findOne({ _id: _id }));

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getUser) {
        return ReE(res, { message: `user not found for given id!.` }, httpStatus.NOT_FOUND)
    }

    const updateFields: Record<string, any> = {};
    for (const key of fields) {
        if (!isNull(body[key])) {
            updateFields[key] = body[key];
        }
    }


    if (updateFields.email) {
        let checkUser;
        [err, checkUser] = await toAwait(User.findOne({ email: updateFields.email, _id: { $ne: _id } }))
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (checkUser) return ReE(res, { message: "email already exist" }, httpStatus.BAD_REQUEST);
    }

    if (updateFields.phone) {
        let checkPhone;
        [err, checkPhone] = await toAwait(User.findOne({ phone: updateFields.phone, _id: { $ne: _id } }))
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (checkPhone) return ReE(res, { message: "Phone no already exist" }, httpStatus.BAD_REQUEST);
    }

    if (updateFields.role) {
        if (!mongoose.isValidObjectId(updateFields.role)) {
            return ReE(res, { message: `Invalid role id!` }, httpStatus.BAD_REQUEST);
        }
        let getRole;
        [err, getRole] = await toAwait(Role.findOne({ _id: updateFields.role }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!getRole) {
            return ReE(res, { message: `role not found for given id!.` }, httpStatus.NOT_FOUND)
        }
    }

    if (updateFields.password) {
        let hashedPassword;
        [err, hashedPassword] = await toAwait(bcrypt.hash(updateFields.password, 10));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!hashedPassword) {
            return ReE(res, { message: `Error in hashing password please try again later` }, httpStatus.INTERNAL_SERVER_ERROR)
        }
    }

    const [updateErr, updateResult] = await toAwait(
        User.updateOne({ _id }, { $set: updateFields })
    );
    if (updateErr) return ReE(res, updateErr, httpStatus.INTERNAL_SERVER_ERROR)
    if (!updateResult) {
        return ReE(res, { message: `Failed to update user!.` }, httpStatus.INTERNAL_SERVER_ERROR)
    }

    return ReS(res, { message: "User updated successfully." }, httpStatus.OK);
};

export const getByIdUser = async (req: Request, res: Response) => {
    let err, { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return ReE(res, { message: `Invalid user id!` }, httpStatus.BAD_REQUEST);
    }

    let getUser;
    [err, getUser] = await toAwait(User.findOne({ _id: id }).populate("role").select("-password").select("-isAdmin"));

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getUser) {
        return ReE(res, { message: `user not found for given id!.` }, httpStatus.NOT_FOUND)
    }

    ReS(res, { message: "user found", data: getUser }, httpStatus.OK)
}

export const getUserByToken = async (req: CustomRequest, res: Response) => {
    return ReS(res, { message: "user found", data: req.user }, httpStatus.OK)
}

export const getAllUser = async (req: Request, res: Response) => {
    let err, getUser, query = req.query, option: any = {};
    if (query) {
        let { role } = query
        role = role as string;
        if (role) {
            if (!mongoose.isValidObjectId(role)) {
                return ReE(res, { message: `Invalid role id!` }, httpStatus.BAD_REQUEST);
            }
            let getRole;
            [err, getRole] = await toAwait(Role.findOne({ _id: role }));
            if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
            if (!getRole) {
                return ReE(res, { message: `role not found for given id!.` }, httpStatus.NOT_FOUND)
            }
            option.role = role
        }
    }

    const page = req.query.page ? parseInt(req.query.page as string) : null;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : null;
    const search = (req.query.search as string) || "";

    const searchConditions: any[] = [];
    if (search) {
        searchConditions.push(
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { id: { $regex: search, $options: "i" } }
        );

        if (mongoose.Types.ObjectId.isValid(search)) {
            searchConditions.push({ _id: new mongoose.Types.ObjectId(search) });
        }
    }

    if (searchConditions.length > 0) {
        option.$or = searchConditions;
    }

    let queryObj = User.find(option).populate("role").select("-password").select("-isAdmin").sort({ createdAt: -1 });

    if (page && limit) {
        const skip = (page - 1) * limit;
        queryObj = queryObj.skip(skip).limit(limit);
    }

    let total;
    let totalPages = 1;

    if (page && limit) {
        let count;
        [err, count] = await toAwait(User.countDocuments(option));
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

    [err, getUser] = await toAwait(queryObj);

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    getUser = getUser as IUser[]
    
    // Note: Removed the 404 check for empty array to be consistent with other endpoints
    // if (getUser.length === 0) {
    //     return ReE(res, { message: `user not found!.` }, httpStatus.NOT_FOUND)
    // }

    return ReS(res, {
        message: "user found",
        data: getUser,
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


export const deleteUser = async (req: Request, res: Response) => {
    let err, { _id } = req.body;
    if (!_id) {
        return ReE(res, { message: `User _id is required!` }, httpStatus.BAD_REQUEST);
    }
    if (!mongoose.isValidObjectId(_id)) {
        return ReE(res, { message: `Invalid user id!` }, httpStatus.BAD_REQUEST);
    }

    let checkUser;
    [err, checkUser] = await toAwait(User.findOne({ _id: _id }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!checkUser) {
        return ReE(res, { message: `user not found for given id!.` }, httpStatus.NOT_FOUND)
    }

    let deleteUser;
    [err, deleteUser] = await toAwait(User.deleteOne({ _id: _id }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR)
    ReS(res, { message: "user deleted" }, httpStatus.OK)

}

export const login = async (req: Request, res: Response) => {
    let err, body = req.body;
    let { email, password } = body;

    let fields = ["email", "password"];
    let inVaildFields = fields.filter(x => isNull(body[x]));

    if (inVaildFields.length > 0) {
        return ReE(res, { message: `Please enter required fields ${inVaildFields}!.` }, httpStatus.BAD_REQUEST);
    }

    let checkUser;
    [err, checkUser] = await toAwait(User.findOne({ email: email }));

    if (err) {
        return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    }

    if (!checkUser) {
        return ReE(res, { message: "User not found" }, httpStatus.NOT_FOUND);
    }

    const typedUser = checkUser as IUser;
    const secretKey = process.env.JWT_SECRET as string;
    // const expired = process.env.JWT_EXPIRED as string;

    if (!secretKey) {
        return ReE(res, { message: "Missing JWT_SECRET environment variables" }, httpStatus.INTERNAL_SERVER_ERROR);
    }

    let match;
    [err, match] = await toAwait(bcrypt.compare(password, typedUser.password));

    if (err) {
        return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    }

    if (!match) {
        return ReE(res, { message: "Invalid password" }, httpStatus.UNAUTHORIZED);
    }

    const token = jwt.sign({ userId: typedUser._id }, secretKey);

    return ReS(res, { message: "User logged in successfully", token, isAdmin: typedUser.isAdmin, roleId: typedUser.role }, httpStatus.OK);

}

export const updateUserByToken = async (req: CustomRequest, res: Response) => {
    const body = req.body, user = req.user as IUser;
    let err: any;
    if(!user) return ReE(res, { message: "authentication not added in this api please contact admin" }, httpStatus.NOT_FOUND);

    let fields = ["name", "phone", "imageUrl"];
    let inVaildFields = fields.filter(x => !isNull(body[x]));
    if (inVaildFields.length === 0) {
        return ReE(res, { message: `Please enter any one fields to update ${fields}!.` }, httpStatus.BAD_REQUEST);
    }

    const updateFields: Record<string, any> = {};
    for (const key of fields) {
        if (!isNull(body[key])) {
            updateFields[key] = body[key];
        }
    }

    if (updateFields.name) {
        updateFields.name = updateFields.name.toLowerCase().trim();
        if (updateFields.name.length < 3) {
            return ReE(res, { message: `name length must be greater than 3 letter` }, httpStatus.BAD_REQUEST);
        }

    }

    if (updateFields.email) {
        updateFields.email = updateFields.email.toLowerCase().trim();
        let checkUser;
        [err, checkUser] = await toAwait(User.findOne({ email: updateFields.email, _id: { $ne: user._id } }))
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (checkUser) return ReE(res, { message: "email already exist" }, httpStatus.BAD_REQUEST);

    }
    if (updateFields.phone) {
        if (!isPhone(updateFields.phone)) {
            return ReE(res, { message: `Invalid phone number!.` }, httpStatus.BAD_REQUEST)
        }
        let checkPhone;
        [err, checkPhone] = await toAwait(User.findOne({ phone: updateFields.phone, _id: { $ne: user._id } }))
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (checkPhone) return ReE(res, { message: "Phone no already exist" }, httpStatus.BAD_REQUEST);
    }


    let updateUser;
    [err, updateUser] = await toAwait(User.updateOne({ _id: user._id }, updateFields));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR)
    ReS(res, { message: "user updated" }, httpStatus.OK)

}

export const changePasswordByToken = async (req: CustomRequest, res: Response) => {
    const body = req.body, user = req.user as IUser;
    let err: any;
    if(!user) return ReE(res, { message: "authentication not added in this api please contact admin" }, httpStatus.NOT_FOUND);

    let fields = ["oldPassword", "newPassword"];
    let inVaildFields = fields.filter(x => isNull(body[x]));
    if (inVaildFields.length > 0) {
        return ReE(res, { message: `Please enter required fields ${inVaildFields}!.` }, httpStatus.BAD_REQUEST);
    }

    const { oldPassword, newPassword } = body;

    let checkUser;
    [err, checkUser] = await toAwait(User.findOne({ _id: user._id }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!checkUser) {
        return ReE(res, { message: "User not found" }, httpStatus.NOT_FOUND);
    }

    checkUser = checkUser as IUser;

    let match;
    [err, match] = await toAwait(bcrypt.compare(oldPassword, checkUser.password));

    if (err) {
        return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    }

    if (!match) {
        return ReE(res, { message: "Invalid old password" }, httpStatus.UNAUTHORIZED);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    let updateUser;
    [err, updateUser] = await toAwait(User.updateOne({ _id: user._id }, { password: hashedPassword }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR)
    ReS(res, { message: "password updated" }, httpStatus.OK)

}