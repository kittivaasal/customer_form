import { Request, Response } from "express";
import httpStatus from "http-status";
import mongoose from "mongoose";
import { Counter } from "../models/counter.model";
import { Customer } from "../models/customer.model";
import EditRequest from "../models/editRequest.model";
import { Project } from "../models/project.model";
import { isEmail, isNull, isPhone, ReE, ReS, toAutoIncrCode, toAwait } from "../services/util.service";
import { ICustomer } from "../type/customer";
import CustomRequest from "../type/customRequest";
import { IEditRequest } from "../type/editRequest";
import { IUser } from "../type/user";
import { sendPushNotificationToSuperAdmin } from "./common";
import { MarketingHead } from "../models/marketingHead.model";
import { MarketDetail } from "../models/marketDetail.model";

export const createCustomer = async (req: Request, res: Response) => {
  let body = req.body, err;
  let { introducerId,marketerDetailId, ddId, cedId, email, phone, projectId } = body;

  //let check if any one present ddId, cedId if not throw error
  if (isNull(ddId) && isNull(cedId)) {
    return ReE(res, { message: `Please enter ddId or cedId!.` }, httpStatus.BAD_REQUEST);
  }

  if(!isNull(ddId) && !isNull(cedId)){
    delete body.cedId;
  }

  if(isNull(introducerId)){
    delete body.introducerId;
  }

  if(!isNull(cedId)){
    console.log(cedId);
    if(!mongoose.isValidObjectId(cedId)){
      return ReE(res, { message: `Invalid cedId!.` }, httpStatus.BAD_REQUEST);
    }
    let findCed;
    [err, findCed] = await toAwait(MarketingHead.findOne({ _id: cedId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!findCed) {
      return ReE(res, { message: `Ced is not found for given id!.` }, httpStatus.BAD_REQUEST);
    }
    delete body.ddId;
  }

  if(!isNull(ddId)){
    if(!mongoose.isValidObjectId(ddId)){
      return ReE(res, { message: `Invalid ddId!.` }, httpStatus.BAD_REQUEST);
    }
    let findDd;
    [err, findDd] = await toAwait(MarketingHead.findOne({ _id: ddId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!findDd) {
      return ReE(res, { message: `Dd is not found for given id!.` }, httpStatus.BAD_REQUEST);
    }
    delete body.cedId;
  }

  if(!isNull(introducerId)){
    if(!mongoose.isValidObjectId(introducerId)){
      return ReE(res, { message: `Invalid introducerId!.` }, httpStatus.BAD_REQUEST);
    }
    let findIntroducer;
    [err, findIntroducer] = await toAwait(MarketingHead.findOne({ _id: introducerId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!findIntroducer) {
      return ReE(res, { message: `Introducer is not found for given id!.` }, httpStatus.BAD_REQUEST);
    }
  }

  if(!isNull(marketerDetailId)){
    if(!mongoose.isValidObjectId(marketerDetailId)){
      return ReE(res, { message: `Invalid marketerDetailId!.` }, httpStatus.BAD_REQUEST);
    }
    let findMarketer;
    [err, findMarketer] = await toAwait(MarketDetail.findOne({ _id: marketerDetailId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!findMarketer) {
      return ReE(res, { message: `Marketer detail is not found for given id!.` }, httpStatus.BAD_REQUEST);
    }
  }

  if (email) {
    email = email.trim().toLowerCase();
    if(!isEmail(email)){
      return ReE(res, { message: `Invalid email!.` }, httpStatus.BAD_REQUEST);
    }
    // let findEmail;
    // [err, findEmail] = await toAwait(Customer.findOne({ email: email }));
    // if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    // if (findEmail) {
    //   return ReE(res, { message: `Email already exists!.` }, httpStatus.BAD_REQUEST);
    // }
  }
  if (phone) {
    if (!isPhone(phone)) {
      return ReE(res, { message: `Invalid phone number!.` }, httpStatus.BAD_REQUEST)
    }
    // let findPhone;
    // [err, findPhone] = await toAwait(Customer.findOne({ phone: phone }))
    // if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    // if (findPhone) {
    //   return ReE(res, { message: `Phone already exists!.` }, httpStatus.BAD_REQUEST)
    // }
  }

  if(isNull(projectId)){
    return ReE(res, { message: `Please enter project id!.` }, httpStatus.BAD_REQUEST);
  }

  let projectData:any={};
  if (projectId) {
    if (!mongoose.isValidObjectId(projectId)) {
      return ReE(res, { message: `Invalid project id!.` }, httpStatus.BAD_REQUEST);
    }
    let findProject;
    [err, findProject] = await toAwait(Project.findOne({ _id: projectId }))
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!findProject) {
      return ReE(res, { message: `Project not found for given project id!.` }, httpStatus.NOT_FOUND);
    }
    body.projectId = projectId;
    projectData=findProject;
  }

  if(projectData?.projectName){
    let id= toAutoIncrCode(projectData?.projectName)
    let getCustomerCounter,count=0;
    [err,getCustomerCounter] = await toAwait(Counter.findOne({name:"customerid"}));
    if(err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if(!getCustomerCounter){
      let newCounter = new Counter({
        name: "customerid",
        seq: 0
      });
      await newCounter.save();
      getCustomerCounter=newCounter;
    }else{
      getCustomerCounter = getCustomerCounter as any;
      count=getCustomerCounter.seq+1;
    }
  
    let updateCustomerCounter;
    [err,updateCustomerCounter] = await toAwait(
      Counter.updateOne({name:"customerid"},{$set:{seq:count}})
    )
    if(err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    body.id= id+"-"+count.toString().padStart(4,'0');
  }

  let customer;
  [err, customer] = await toAwait(Customer.create(body));
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!customer) {
    return ReE(res, { message: `Failed to create customer!.` }, httpStatus.INTERNAL_SERVER_ERROR)
  }
  if (req.query.includeCustomer === 'true') {
    return ReS(res, { message: `customer added successfull`, data: customer }, httpStatus.CREATED);
  }
  ReS(res, { message: `customer added successfull` }, httpStatus.CREATED);
};

export const updateCustomer = async (req: CustomRequest, res: Response) => {
  const body = req.body, user = req.user as IUser;
  const { _id } = body;
  let err: any;

  if (!_id) {
    return ReE(res, { message: `_id is required!` }, httpStatus.BAD_REQUEST);
  }

  if (!mongoose.isValidObjectId(_id)) {
    return ReE(res, { message: `Invalid customer _id!` }, httpStatus.BAD_REQUEST);
  }

  let getCustomer;
  [err, getCustomer] = await toAwait(Customer.findOne({ _id: _id }));

  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!getCustomer) {
    return ReE(res, { message: `customer not found for given id!.` }, httpStatus.NOT_FOUND)
  }

  const allowedFields = [
    "duration",
    "emiAmount",
    "paymentTerms",
    "marketerName",
    "email",
    "pincode",
    "state",
    "city",
    "phone",
    "address",
    "name",
    "marketatName",
    "projectId",
    "introducerId",
    "marketerDetailId",
    "ddId",
    "cedId"
  ];

  const updateFields: Record<string, any> = {};
  for (const key of allowedFields) {
    if (!isNull(body[key])) {
      updateFields[key] = body[key];
    }
  }

  if(!isNull(updateFields.ddId) && !isNull(updateFields.cedId)){
    delete updateFields.cedId;
  }

  if(!isNull(updateFields.cedId)){
    if(!mongoose.isValidObjectId(updateFields.cedId)){
      return ReE(res, { message: `Invalid cedId!.` }, httpStatus.BAD_REQUEST);
    }
    let findCed;
    [err, findCed] = await toAwait(MarketingHead.findOne({ _id: updateFields.cedId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!findCed) {
      return ReE(res, { message: `Ced is not found for given id!.` }, httpStatus.BAD_REQUEST);
    }
  }

  if(!isNull(updateFields.ddId)){
    if(!mongoose.isValidObjectId(updateFields.ddId)){
      return ReE(res, { message: `Invalid ddId!.` }, httpStatus.BAD_REQUEST);
    }
    let findDd;
    [err, findDd] = await toAwait(MarketingHead.findOne({ _id: updateFields.ddId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!findDd) {
      return ReE(res, { message: `Dd is not found for given id!.` }, httpStatus.BAD_REQUEST);
    }
    updateFields.ddId=updateFields.ddId;
    delete updateFields.ddId;
  }

  if(!isNull(updateFields.introducerId)){
    if(!mongoose.isValidObjectId(updateFields.introducerId)){
      return ReE(res, { message: `Invalid introducerId!.` }, httpStatus.BAD_REQUEST);
    }
    let findIntroducer;
    [err, findIntroducer] = await toAwait(MarketingHead.findOne({ _id: updateFields.introducerId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!findIntroducer) {
      return ReE(res, { message: `Introducer is not found for given id!.` }, httpStatus.BAD_REQUEST);
    }
    updateFields.introducerId=updateFields.introducerId;
    delete updateFields.introducerId;
  }

  if(!isNull(updateFields.marketerDetailId)){
    if(!mongoose.isValidObjectId(updateFields.marketerDetailId)){
      return ReE(res, { message: `Invalid marketerDetailId!.` }, httpStatus.BAD_REQUEST);
    }
    let findMarketer;
    [err, findMarketer] = await toAwait(MarketDetail.findOne({ _id: updateFields.marketerDetailId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!findMarketer) {
      return ReE(res, { message: `Marketer detail is not found for given id!.` }, httpStatus.BAD_REQUEST);
    }
  }

  if(updateFields.projectId || updateFields.scheme){
    if(updateFields.scheme){
      updateFields.projectId=updateFields.scheme
    }
    if (!mongoose.isValidObjectId(updateFields.projectId)) {
      return ReE(res, { message: `Invalid project id!.` }, httpStatus.BAD_REQUEST);
    }
    let findProject;
    [err, findProject] = await toAwait(Project.findOne({ _id: updateFields.projectId }))
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!findProject) {
      return ReE(res, { message: `Project not found for given project id!.` }, httpStatus.NOT_FOUND);
    }
  }

  if (updateFields.email) {
    updateFields.email = updateFields.email.trim().toLowerCase();
    if (!isEmail(updateFields.email)) {
      return ReE(res, { message: `Invalid email!` }, httpStatus.BAD_REQUEST);
    }
    // const [emailErr, existingEmail] = await toAwait(
    //   Customer.findOne({ email: updateFields.email, _id: { $ne: _id } })
    // );
    // if (emailErr) return ReE(res, emailErr, httpStatus.INTERNAL_SERVER_ERROR);
    // if (existingEmail) {
    //   return ReE(res, { message: `Email already exists!` }, httpStatus.BAD_REQUEST);
    // }
  }

  if (updateFields.phone) {
    if (!isPhone(updateFields.phone)) {
      return ReE(res, { message: `Invalid phone number!` }, httpStatus.BAD_REQUEST);
    }
    // const [phoneErr, existingPhone] = await toAwait(
    //   Customer.findOne({ phone: updateFields.phone, _id: { $ne: _id } }))
    // if (phoneErr) return ReE(res, phoneErr, httpStatus.INTERNAL_SERVER_ERROR);
    // if (existingPhone) {
    //   return ReE(res, { message: `Phone already exists!` }, httpStatus.BAD_REQUEST);
    // } 
  }

  console.log(updateFields);
  if (user.isAdmin === false) {

    const changes: { field: string; oldValue: any; newValue: any }[] = [];
    console.log(allowedFields,body,getCustomer)
    allowedFields.forEach((key: any) => {
      const newValue = body[key];
      const oldValue = (getCustomer as any)[key];
      if (isNull(newValue)) return
      if (newValue?.toString() !== oldValue?.toString()) {
        changes.push({ field: key, oldValue, newValue });
      }
    });

    if (changes.length === 0) {
      return ReE(res, { message: "No changes found to update." }, httpStatus.BAD_REQUEST);
    }

    //ccdId not null means  ddId as null

    if (changes.some((c) => c.field === "ccdId") && changes.some((c) => c.field === "ddId")) {
      return ReE(res, { message: "You cannot update both ccdId and ddId at the same time." }, httpStatus.BAD_REQUEST);
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
      // if (checkEditRequest.changes.length === get.length && checkEditRequest.status === "pending") {
      //   return ReE(res, { message: "You already have a pending edit request for this customer." }, httpStatus.BAD_REQUEST);
      // }
    }

    let createReq;
    [err, createReq] = await toAwait(
      EditRequest.create({
        targetModel: "Customer",
        targetId: _id,
        editedBy: user._id,
        changes,
        status: "pending",
      })
    );

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    createReq = createReq as IEditRequest;

    ReS(res, { message: "Edit request created successfully, Awaiting for approval." }, httpStatus.OK);

    let send = await sendPushNotificationToSuperAdmin("Edit request for Customer", `A new edit request for customer has been created by ${user.name}`, createReq._id.toString())

    if (!send.success) {
      return console.log(send.message);
    }

    return console.log("Edit request push notification sent.");

  } else {

    const [updateErr, updateResult] = await toAwait(
      Customer.updateOne({ _id }, { $set: updateFields })
    );
    if (updateErr) return ReE(res, updateErr, httpStatus.INTERNAL_SERVER_ERROR)
    return ReS(res, { message: "Customer updated successfully." }, httpStatus.OK);

  }

};

export const getByIdCustomer = async (req: Request, res: Response) => {
  let err, { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return ReE(res, { message: `Invalid customer id!` }, httpStatus.BAD_REQUEST);
  }

  let getCustomer;
  [err, getCustomer] = await toAwait(Customer.findOne({ _id: id }).populate('projectId'));

  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!getCustomer) {
    return ReE(res, { message: `customer not found for given id!.` }, httpStatus.NOT_FOUND)
  }

  ReS(res, { message: "customer found", data: getCustomer }, httpStatus.OK)
}

export const getAllCustomer = async (req: Request, res: Response) => {
  let err, customers;

  const page = req.query.page ? parseInt(req.query.page as string) : null;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : null;
  const search = (req.query.search as string) || "";
  const searchConditions: any[] = [];

  if (search) {
    searchConditions.push(
      { name: { $regex: search, $options: "i" } },
      { mobile: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { id: { $regex: search, $options: "i" }  }
    );

    if (mongoose.Types.ObjectId.isValid(search)) {
      searchConditions.push({ _id: new mongoose.Types.ObjectId(search) });
    }
  }

  const searchQuery = searchConditions.length > 0 ? { $or: searchConditions } : {};

  let query = Customer.find(searchQuery)
    .populate("projectId")
    .populate("cedId")
    .populate("ddId")
    .populate("introducerId")
    .populate("marketerDetailId")
    .sort({ createdAt: -1 });

  if (page && limit) {
    const skip = (page - 1) * limit;
    query = query.skip(skip).limit(limit);
  }

  let total;
  let totalPages = 1;

  if (page && limit) {
    let count;
    [err, count] = await toAwait(Customer.countDocuments(searchQuery));
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

  
  [err, customers] = await toAwait(query);
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

  customers = customers as ICustomer[];

  return ReS(
    res,
    {
      message: "Customer found",
      data: customers,
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
};


export const deleteCustomer = async (req: Request, res: Response) => {
  let err, { _id } = req.body;
  if (!_id) {
    return ReE(res, { message: `Customer _id is required!` }, httpStatus.BAD_REQUEST);
  }
  if (!mongoose.isValidObjectId(_id)) {
    return ReE(res, { message: `Invalid customer id!` }, httpStatus.BAD_REQUEST);
  }

  let checkUser;
  [err, checkUser] = await toAwait(Customer.findOne({ _id: _id }));
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!checkUser) {
    return ReE(res, { message: `customer not found for given id!.` }, httpStatus.NOT_FOUND)
  }

  let deleteUser;
  [err, deleteUser] = await toAwait(Customer.deleteOne({ _id: _id }));
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR)
  ReS(res, { message: "customer deleted" }, httpStatus.OK)

}
