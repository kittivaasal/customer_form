import { PutObjectCommand } from "@aws-sdk/client-s3";
import { Request, Response } from "express";
import httpStatus from "http-status";
import mongoose from "mongoose";
import { Billing } from "../models/billing.model";
import { Customer } from "../models/customer.model";
import { Emi } from "../models/emi.model";
import { Flat } from "../models/flat.model";
import { General } from "../models/general.model";
import { Marketer } from "../models/marketer";
import { MarketingHead } from "../models/marketingHead.model";
import { Plot } from "../models/plot.model";
import { User } from "../models/user.model";
import { s3 } from "../services/digitalOceanConfig";
import {
  isNull,
  isValidDate,
  ReE,
  ReS,
  toAwait,
} from "../services/util.service";
import { IBilling } from "../type/billing";
import { ICustomer } from "../type/customer";
import CustomRequest from "../type/customRequest";
import { IEmi } from "../type/emi";
import { IFlat } from "../type/flat";
import { IGeneral } from "../type/general";
import IMarketer from "../type/Marketer";
import { IMarketingHead } from "../type/marketingHead";
import { IPlot } from "../type/plot";
import { IUser } from "../type/user";

export const uploadImages = async (req: Request, res: Response) => {
  try {
    const BUCKET = process.env.DO_SPACES_BUCKET;
    const CDN_URL = process.env.DO_SPACES_CDN;
    if (!BUCKET || !CDN_URL) {
      return ReE(
        res,
        { message: "Missing environment variables for Digital Ocean" },
        httpStatus.INTERNAL_SERVER_ERROR
      );
    }
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return ReE(
        res,
        { message: "please upload at least one files" },
        httpStatus.BAD_REQUEST
      );
    }
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = `uploads/${Date.now()}_${file.originalname?.replace(
        /\s+/g,
        ""
      )}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: fileName,
          Body: file.buffer,
          ACL: "public-read",
          ContentType: file.mimetype,
        })
      );
      urls.push(`${CDN_URL}/${fileName}`);
    }
    return ReS(
      res,
      { message: "files uploaded successfully", data: urls },
      httpStatus.OK
    );
  } catch (error) {
    return ReE(res, error, httpStatus.INTERNAL_SERVER_ERROR);
  }
};

export const createCommonData = async (req: Request, res: Response) => {
  let body = req.body,
    err;
  const { customerId, general, plot, billing, flat } = body;

  if (!customerId) {
    return ReE(
      res,
      { message: "customerId is required" },
      httpStatus.BAD_REQUEST
    );
  }

  if (!mongoose.isValidObjectId(customerId)) {
    return ReE(res, { message: "Invalid customerId" }, httpStatus.BAD_REQUEST);
  }

  let checkCustomer;
  [err, checkCustomer] = await toAwait(Customer.findOne({ _id: customerId }));
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!checkCustomer) {
    return ReE(
      res,
      { message: "customer not found for given id" },
      httpStatus.BAD_REQUEST
    );
  }

  let fields = ["general", "plot", "flat"];
  let inVaildFields = fields.filter((x) => !isNull(body[x]));
  if (inVaildFields.length === 0) {
    return ReE(
      res,
      { message: `Please enter required field to create ${fields}!.` },
      httpStatus.BAD_REQUEST
    );
  }

  const results: any = {};
  const errors: any[] = [];

  const tryCreate = async (model: any, data: any, key: string) => {
    try {
      results[key] = await model.create({ ...data, customer: customerId });
      return true;
    } catch (err: any) {
      errors.push({ [key]: err.message });
      return false;
    }
  };

  if (general) {
    if (general.status) {
      general.status = general.status.toLowerCase();
      let validValue = ["enquired", "blocked", "vacant"];
      if (!validValue.includes(general.status)) {
        return ReE(
          res,
          {
            message: `general status value is invalid valid value are (${validValue})`,
          },
          httpStatus.BAD_REQUEST
        );
      }
      general.status =
        general.status === "enquired"
          ? "Enquired"
          : general.status === "blocked"
          ? "Blocked"
          : "Vacant";
    }
    if (!general.noOfInstallments) {
      return ReE(
        res,
        { message: "no of installments is required in general" },
        httpStatus.BAD_REQUEST
      );
    }

    if (isNaN(general.noOfInstallments)) {
      return ReE(
        res,
        { message: "no of installments must be number in general" },
        httpStatus.BAD_REQUEST
      );
    }

    if (!general.emiAmount) {
      return ReE(
        res,
        { message: "emi amount is required in general" },
        httpStatus.BAD_REQUEST
      );
    }

    if (!general.marketer) {
      return ReE(
        res,
        { message: "marketer is required in general" },
        httpStatus.BAD_REQUEST
      );
    }

    if (!mongoose.isValidObjectId(general.marketer)) {
      return ReE(
        res,
        { message: "Invalid marketer id in general" },
        httpStatus.BAD_REQUEST
      );
    }

    if (!general.percentage) {
      return ReE(
        res,
        { message: "percentage is required in general" },
        httpStatus.BAD_REQUEST
      );
      }
      if (typeof general.percentage !== "number") {
        general.percentage = Number(general.percentage);
      }
    if (isNaN(general.percentage)) {
      return ReE(
        res,
        { message: "percentage must be number in general" },
        httpStatus.BAD_REQUEST
      );
    }

    if (general.percentage < 0 || general.percentage > 100) {
      return ReE(
        res,
        { message: "percentage must be between 0 and 100 in general" },
        httpStatus.BAD_REQUEST
      );
    }

    let checkIntroducer, err: any;
    [err, checkIntroducer] = await toAwait(
      MarketingHead.findOne({ _id: general.marketer })
    );
    if (err) {
      return ReE(
        res,
        { message: `${err.message} - in marketer in general` },
        httpStatus.INTERNAL_SERVER_ERROR
      );
    }
    if (!checkIntroducer) {
      return ReE(
        res,
        { message: "marketer id not found in create general" },
        httpStatus.BAD_REQUEST
      );
    }
  }

  let checkAlreadyExist = await General.findOne(general);
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (checkAlreadyExist)
    return ReE(
      res,
      { message: `general already exist based on given all details` },
      httpStatus.BAD_REQUEST
    );
  let createGeneral;
  [err, createGeneral] = await toAwait(
    General.create({ ...general, customer: customerId })
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!createGeneral) {
    return ReE(
      res,
      { message: "general not created please try again after sometime" },
      httpStatus.INTERNAL_SERVER_ERROR
    );
  }
  results.general = createGeneral;
  createGeneral = createGeneral as IGeneral;
  if (createGeneral.noOfInstallments) {
    let id = createGeneral._id;
    for (let index = 0; index < general.noOfInstallments; index++) {
      let emi = {
        customer: customerId,
        emiNo: index + 1,
        date: new Date(new Date().setMonth(new Date().getMonth() + index)),
        emiAmt: general.emiAmount,
        general: id,
      };
      await tryCreate(Emi, emi, "emi");
    }
  }

  if (plot) {
    plot.general = createGeneral._id;
    let checkAlreadyExist = await Plot.findOne(plot);
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (checkAlreadyExist)
      return ReE(
        res,
        { message: `plot already exist based on given all details` },
        httpStatus.BAD_REQUEST
      );
    await tryCreate(Plot, plot, "plot");
  }

  if (flat) {
    flat.general = createGeneral._id;
    let checkAlreadyExist = await Flat.findOne(flat);
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (checkAlreadyExist)
      return ReE(
        res,
        { message: `flat already exist based on given all details` },
        httpStatus.BAD_REQUEST
      );
    if (flat) await tryCreate(Flat, flat, "flat");
  }

  if (errors.length > 0)
    return ReE(res, { message: errors }, httpStatus.BAD_REQUEST);
  return ReS(res, { message: "success", data: results }, httpStatus.OK);
};

export const UpdateCommonData = async (req: CustomRequest, res: Response) => {
  let body = req.body,
    user = req.user,
    err: any;
  const { general, plot, flat } = body;

  if (user) {
    if (user.isAdmin === false) {
      return ReE(
        res,
        { message: "You are not access this api" },
        httpStatus.UNAUTHORIZED
      );
    }
  }

  let fields = ["general", "plot", "flat"];
  let inVaildFields = fields.filter((x) => !isNull(body[x]));
  if (inVaildFields.length === 0) {
    return ReE(
      res,
      { message: `Please enter any one field to update ${fields}!.` },
      httpStatus.BAD_REQUEST
    );
  }

  const results: any = {};
  const errors: any[] = [];

  if (general) {
    let keyLength = Object.keys(general).length;
    if (keyLength === 0) {
      return ReE(
        res,
        { message: `If update general then general object is required` },
        httpStatus.BAD_REQUEST
      );
    }

    if (!general.editDeleteReason) {
      return ReE(
        res,
        {
          message: `If update general then general.editDeleteReason is required`,
        },
        httpStatus.BAD_REQUEST
      );
    }

    if (general.status) {
      general.status = general.status.toLowerCase();
      let validValue = ["enquired", "blocked", "vacant"];
      if (!validValue.includes(general.status)) {
        return ReE(
          res,
          {
            message: `general status value is invalid valid value are (${validValue})`,
          },
          httpStatus.BAD_REQUEST
        );
      }
      general.status =
        general.status === "enquired"
          ? "Enquired"
          : general.status === "blocked"
          ? "Blocked"
          : "Vacant";
    }

    if (!general._id) {
      return ReE(
        res,
        { message: "when update general then general._id is required" },
        httpStatus.BAD_REQUEST
      );
    }

    if (!mongoose.isValidObjectId(general._id)) {
      return ReE(
        res,
        { message: "general _id is invalid" },
        httpStatus.BAD_REQUEST
      );
    }

    let checkAlreadyExist = await General.findOne({ _id: general._id });
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!checkAlreadyExist)
      return ReE(
        res,
        { message: `general not found given id` },
        httpStatus.BAD_REQUEST
      );
  }

  if (flat) {
    let keyLength = Object.keys(flat).length;
    if (keyLength === 0) {
      return ReE(
        res,
        { message: `If update flat then flat object is required` },
        httpStatus.BAD_REQUEST
      );
    }

    if (!flat._id) {
      return ReE(
        res,
        { message: "when update flat then flat _id is required" },
        httpStatus.BAD_REQUEST
      );
    }

    if (!mongoose.isValidObjectId(flat._id)) {
      return ReE(
        res,
        { message: "flat _id is invalid" },
        httpStatus.BAD_REQUEST
      );
    }

    let checkAlreadyExist = await Flat.findOne({ _id: flat._id });
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!checkAlreadyExist)
      return ReE(
        res,
        { message: `flat not found given id` },
        httpStatus.BAD_REQUEST
      );
  }

  if (plot) {
    let keyLength = Object.keys(plot).length;
    if (keyLength === 0) {
      return ReE(
        res,
        { message: `If update plot then plot object is required` },
        httpStatus.BAD_REQUEST
      );
    }

    if (!plot._id) {
      return ReE(
        res,
        { message: "when update plot then plot._id is required" },
        httpStatus.BAD_REQUEST
      );
    }

    if (!mongoose.isValidObjectId(plot._id)) {
      return ReE(
        res,
        { message: "plot _id is invalid" },
        httpStatus.BAD_REQUEST
      );
    }

    let checkAlreadyExist = await Plot.findOne({ _id: plot._id });
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!checkAlreadyExist)
      return ReE(
        res,
        { message: `plot not found given id` },
        httpStatus.BAD_REQUEST
      );
  }

  if (general) {
    let updateGeneral;
    [err, updateGeneral] = await toAwait(
      General.updateOne({ _id: general._id }, general)
    );
    if (err) {
      errors.push(`error in while updating general: ${err.message}`);
    }
    results.general = updateGeneral;
    results.message = "general updated successfully";
  }

  if (plot) {
    let updatePlot;
    [err, updatePlot] = await toAwait(Plot.updateOne({ _id: plot._id }, plot));
    if (err) {
      errors.push(`error in while updating plot: ${err.message}`);
    }
    results.plot = updatePlot;
    results.message = "plot updated successfully";
  }

  if (flat) {
    let updateFlat;
    [err, updateFlat] = await toAwait(Flat.updateOne({ _id: flat._id }, flat));
    if (err) {
      errors.push(`error in while updating flat: ${err.message}`);
    }
    results.flat = updateFlat;
    results.message = "flat updated successfully";
  }

  if (errors.length > 0)
    return ReE(res, { message: errors }, httpStatus.BAD_REQUEST);

  return ReS(res, { message: "updated successfully" }, httpStatus.OK);
};

export const getAllGeneral = async (req: Request, res: Response) => {
  let getGeneral;
  let err;

  const { customerId, pageNo, limit } = req.query as any;
  let option: any = {};

  // Validate customerId
  if (customerId) {
    if (!mongoose.isValidObjectId(customerId)) {
      return ReE(
        res,
        { message: "customer id is invalid" },
        httpStatus.BAD_REQUEST
      );
    }

    let getCustomer;
    [err, getCustomer] = await toAwait(
      Customer.findOne({ _id: customerId })
    );
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    if (!getCustomer) {
      return ReE(
        res,
        { message: "customer not found given id" },
        httpStatus.NOT_FOUND
      );
    }

    option.customer = customerId;
  }

  // 🔹 CHECK PAGINATION PARAMETERS
  const isPagination =
    pageNo !== undefined && limit !== undefined;

  // 🔹 NO PAGINATION → RETURN ALL DATA
  if (!isPagination) {
    [err, getGeneral] = await toAwait(
      General.find(option)
        .populate("customer")
        .populate("marketer")
        .sort({ createdAt: -1 })
    );

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    getGeneral = getGeneral as IGeneral[];

    if (!getGeneral || getGeneral.length === 0) {
      return ReE(
        res,
        { message: "general not found in db" },
        httpStatus.NOT_FOUND
      );
    }

    return ReS(res, { data: getGeneral }, httpStatus.OK);
  }

  // 🔹 PAGINATION LOGIC
  const page = Number(pageNo);
  const pageLimit = Number(limit);

  if (page < 1 || pageLimit < 1) {
    return ReE(
      res,
      { message: "pageNo and limit must be positive numbers" },
      httpStatus.BAD_REQUEST
    );
  }

  // Total count
  let total;
  [err, total] = await toAwait(General.countDocuments(option));
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

  const lastPage = Math.ceil(total as number / pageLimit) || 1;

  if (page > lastPage) {
    return ReE(
      res,
      { message: `last page no is ${lastPage}` },
      httpStatus.BAD_REQUEST
    );
  }

  const skip = (page - 1) * pageLimit;

  // Fetch paginated data
  [err, getGeneral] = await toAwait(
    General.find(option)
      .populate("customer")
      .populate("marketer")
      .skip(skip)
      .limit(pageLimit)
      .sort({ createdAt: -1 })
  );

  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

  getGeneral = getGeneral as IGeneral[];

  if (!getGeneral || getGeneral.length === 0) {
    return ReE(
      res,
      { message: "general not found in db" },
      httpStatus.NOT_FOUND
    );
  }

  return ReS(
    res,
    {
      data: getGeneral,
      pagination: {
        total,
        pageNo: page,
        limit: pageLimit,
        lastPage
      }
    },
    httpStatus.OK
  );
};


export const getAllBilling = async (req: Request, res: Response) => {
  let getBilling;
  let err;
  let { customerId, generalId } = req.query,
    option: any = {};
  if (customerId) {
    if (!mongoose.isValidObjectId(customerId)) {
      return ReE(
        res,
        { message: "customer id is invalid" },
        httpStatus.BAD_REQUEST
      );
    }
    let getCustomer;
    [err, getCustomer] = await toAwait(Customer.findOne({ _id: customerId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getCustomer) {
      return ReE(
        res,
        { message: "customer not found given id" },
        httpStatus.NOT_FOUND
      );
    }
    option.customer = customerId;
  }
  if (generalId) {
    if (!mongoose.isValidObjectId(generalId)) {
      return ReE(
        res,
        { message: "general id is invalid" },
        httpStatus.BAD_REQUEST
      );
    }
    let getGeneral;
    [err, getGeneral] = await toAwait(General.findOne({ _id: generalId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getGeneral) {
      return ReE(
        res,
        { message: "general not found given id" },
        httpStatus.NOT_FOUND
      );
    }
    option.general = generalId;
  }
  [err, getBilling] = await toAwait(
    Billing.find(option)
      .populate("customer")
      .populate("general")
      .populate("introducer")
      .populate("emi")
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  getBilling = getBilling as IBilling[];
  if (getBilling.length === 0) {
    return ReE(
      res,
      { message: "billing not found in db" },
      httpStatus.NOT_FOUND
    );
  }
  return ReS(res, { data: getBilling }, httpStatus.OK);
};

export const getAllPlot = async (req: Request, res: Response) => {
  let getPlot;
  let err;
  let { customerId, generalId } = req.query,
    option: any = {};
  if (customerId) {
    if (!mongoose.isValidObjectId(customerId)) {
      return ReE(
        res,
        { message: "customer id is invalid" },
        httpStatus.BAD_REQUEST
      );
    }
    let getCustomer;
    [err, getCustomer] = await toAwait(Customer.findOne({ _id: customerId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getCustomer) {
      return ReE(
        res,
        { message: "customer not found given id" },
        httpStatus.NOT_FOUND
      );
    }
    option.customer = customerId;
  }
  if (generalId) {
    if (!mongoose.isValidObjectId(generalId)) {
      return ReE(
        res,
        { message: "general id is invalid" },
        httpStatus.BAD_REQUEST
      );
    }
    let getGeneral;
    [err, getGeneral] = await toAwait(General.findOne({ _id: generalId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getGeneral) {
      return ReE(
        res,
        { message: "general not found given id" },
        httpStatus.NOT_FOUND
      );
    }
    option.general = generalId;
  }
  [err, getPlot] = await toAwait(
    Plot.find(option).populate("customer").populate("general")
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  getPlot = getPlot as IPlot[];
  if (getPlot.length === 0) {
    return ReE(res, { message: "plot not found in db" }, httpStatus.NOT_FOUND);
  }
  return ReS(res, { data: getPlot }, httpStatus.OK);
};

export const getAllFlat = async (req: Request, res: Response) => {
  let getFlat;
  let err;
  let { customerId, generalId } = req.query,
    option: any = {};
  if (customerId) {
    if (!mongoose.isValidObjectId(customerId)) {
      return ReE(
        res,
        { message: "customer id is invalid" },
        httpStatus.BAD_REQUEST
      );
    }
    let getCustomer;
    [err, getCustomer] = await toAwait(Customer.findOne({ _id: customerId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getCustomer) {
      return ReE(
        res,
        { message: "customer not found given id" },
        httpStatus.NOT_FOUND
      );
    }
    option.customer = customerId;
  }
  if (generalId) {
    if (!mongoose.isValidObjectId(generalId)) {
      return ReE(
        res,
        { message: "general id is invalid" },
        httpStatus.BAD_REQUEST
      );
    }
    let getGeneral;
    [err, getGeneral] = await toAwait(General.findOne({ _id: generalId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getGeneral) {
      return ReE(
        res,
        { message: "general not found given id" },
        httpStatus.NOT_FOUND
      );
    }
    option.general = generalId;
  }
  [err, getFlat] = await toAwait(
    Flat.find(option).populate("customer").populate("general")
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  getFlat = getFlat as IFlat[];
  if (getFlat.length === 0) {
    return ReE(res, { message: "flat not found in db" }, httpStatus.NOT_FOUND);
  }
  return ReS(res, { data: getFlat }, httpStatus.OK);
};

export const getAllEmi = async (req: Request, res: Response) => {
  let getEmi;
  let err;
  let { customerId, generalId, paid } = req.query,
    option: any = {};
  if (customerId) {
    if (!mongoose.isValidObjectId(customerId)) {
      return ReE(
        res,
        { message: "customer id is invalid" },
        httpStatus.BAD_REQUEST
      );
    }
    let getCustomer;
    [err, getCustomer] = await toAwait(Customer.findOne({ _id: customerId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getCustomer) {
      return ReE(
        res,
        { message: "customer not found given id" },
        httpStatus.NOT_FOUND
      );
    }
    option.customer = customerId;
  }
  if (generalId) {
    if (!mongoose.isValidObjectId(generalId)) {
      return ReE(
        res,
        { message: "general id is invalid" },
        httpStatus.BAD_REQUEST
      );
    }
    let getGeneral;
    [err, getGeneral] = await toAwait(General.findOne({ _id: generalId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getGeneral) {
      return ReE(
        res,
        { message: "general not found given id" },
        httpStatus.NOT_FOUND
      );
    }
    option.general = generalId;
  }
  if (paid) {
    let valid = ["true", "false"];
    paid = paid.toString().toLocaleLowerCase();
    if (!valid.includes(paid)) {
      return ReE(
        res,
        { message: "paid is invalid value valid value is true or false" },
        httpStatus.BAD_REQUEST
      );
    }
    // option.paidDate = paid;
    //paidDate is null if paid false and if paid true get not null
    if (paid === "true") {
      option.paidDate = { $ne: null };
    } else {
      option.paidDate = null;
    }
  }
  [err, getEmi] = await toAwait(
    Emi.find(option).populate("customer").populate("general")
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  getEmi = getEmi as IEmi[];
  if (getEmi.length === 0) {
    return ReE(res, { message: "emi not found in db" }, httpStatus.NOT_FOUND);
  }
  return ReS(res, { data: getEmi }, httpStatus.OK);
};

export const getAllMarketer = async (req: Request, res: Response) => {
  let getMarketer;
  let err;
  let { customerId, generalId } = req.query,
    option: any = {};
  if (customerId) {
    if (!mongoose.isValidObjectId(customerId)) {
      return ReE(
        res,
        { message: "customer id is invalid" },
        httpStatus.BAD_REQUEST
      );
    }
    let getCustomer;
    [err, getCustomer] = await toAwait(Customer.findOne({ _id: customerId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getCustomer) {
      return ReE(
        res,
        { message: "customer not found given id" },
        httpStatus.NOT_FOUND
      );
    }
    option.customer = customerId;
  }
  if (generalId) {
    if (!mongoose.isValidObjectId(generalId)) {
      return ReE(
        res,
        { message: "general id is invalid" },
        httpStatus.BAD_REQUEST
      );
    }
    let getGeneral;
    [err, getGeneral] = await toAwait(General.findOne({ _id: generalId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getGeneral) {
      return ReE(
        res,
        { message: "general not found given id" },
        httpStatus.NOT_FOUND
      );
    }
    option.general = generalId;
  }
  [err, getMarketer] = await toAwait(
    Marketer.find(option)
      .populate("customer")
      .populate("generalId")
      .populate("emiId")
      .populate("marketerHeadId")
      .populate("percentageId")
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  getMarketer = getMarketer as IMarketer[];
  if (getMarketer.length === 0) {
    return ReE(
      res,
      { message: "marketer not found in db" },
      httpStatus.NOT_FOUND
    );
  }
  return ReS(res, { data: getMarketer }, httpStatus.OK);
};

export const getByIdGeneral = async (req: Request, res: Response) => {
  let getGeneral;
  let { id } = req.params;
  let err;
  if (!mongoose.isValidObjectId(id)) {
    return ReE(
      res,
      { message: "invalid id passed in params" },
      httpStatus.BAD_REQUEST
    );
  }
  [err, getGeneral] = await toAwait(
    General.findById(id).populate("customer").populate("marketer")
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!getGeneral) {
    return ReE(
      res,
      { message: "general not found given id" },
      httpStatus.NOT_FOUND
    );
  }
  return ReS(res, { data: getGeneral }, httpStatus.OK);
};

export const getByIdBilling = async (req: Request, res: Response) => {
  let getBilling;
  let { id } = req.params;
  let err;
  if (!mongoose.isValidObjectId(id)) {
    return ReE(
      res,
      { message: "invalid id passed in params" },
      httpStatus.BAD_REQUEST
    );
  }
  [err, getBilling] = await toAwait(
    Billing.findById(id)
      .populate("customer")
      .populate("general")
      .populate("introducer")
      .populate("emi")
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!getBilling) {
    return ReE(
      res,
      { message: "billing not found given id" },
      httpStatus.NOT_FOUND
    );
  }
  return ReS(res, { data: getBilling }, httpStatus.OK);
};

export const getByIdEmi = async (req: Request, res: Response) => {
  let getEmi;
  let { id } = req.params;
  let err;
  if (!mongoose.isValidObjectId(id)) {
    return ReE(
      res,
      { message: "invalid emi id passed in params" },
      httpStatus.BAD_REQUEST
    );
  }
  [err, getEmi] = await toAwait(
    Emi.findById(id).populate("customer").populate("general")
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!getEmi) {
    return ReE(
      res,
      { message: "emi not found given id" },
      httpStatus.NOT_FOUND
    );
  }
  return ReS(res, { data: getEmi }, httpStatus.OK);
};

export const getByIdMarketer = async (req: Request, res: Response) => {
  let getMarketer;
  let { id } = req.params;
  let err;
  if (!mongoose.isValidObjectId(id)) {
    return ReE(
      res,
      { message: "invalid marketer id passed in params" },
      httpStatus.BAD_REQUEST
    );
  }
  [err, getMarketer] = await toAwait(
    Marketer.findById(id)
      .populate("customer")
      .populate("generalId")
      .populate("emiId")
      .populate("marketerHeadId")
      .populate("percentageId")
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!getMarketer) {
    return ReE(
      res,
      { message: "marketer not found given id" },
      httpStatus.NOT_FOUND
    );
  }
  return ReS(res, { data: getMarketer }, httpStatus.OK);
};

export const getByIdPlot = async (req: Request, res: Response) => {
  let getPlot;
  let { id } = req.params;
  let err;
  if (!mongoose.isValidObjectId(id)) {
    return ReE(
      res,
      { message: "invalid id passed in params" },
      httpStatus.BAD_REQUEST
    );
  }
  [err, getPlot] = await toAwait(
    Plot.findById(id).populate("customer").populate("general")
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!getPlot) {
    return ReE(
      res,
      { message: "plot not found given id" },
      httpStatus.NOT_FOUND
    );
  }
  return ReS(res, { data: getPlot }, httpStatus.OK);
};

export const getByIdFlat = async (req: Request, res: Response) => {
  let getFlat;
  let { id } = req.params;
  let err;
  if (!mongoose.isValidObjectId(id)) {
    return ReE(
      res,
      { message: "invalid id passed in params" },
      httpStatus.BAD_REQUEST
    );
  }
  [err, getFlat] = await toAwait(
    Flat.findById(id).populate("customer").populate("general")
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!getFlat) {
    return ReE(
      res,
      { message: "flat not found given id" },
      httpStatus.NOT_FOUND
    );
  }
  return ReS(res, { data: getFlat }, httpStatus.OK);
};

export const createBilling = async (req: Request, res: Response) => {
  let body = req.body;
  let err;

  let fields = [
    "customerId",
    "status",
    "modeOfPayment",
    "saleType",
    "amount",
    "paymentDate",
    "emi",
  ];
  let inVaildFields = fields.filter((x) => isNull(body[x]));
  if (inVaildFields.length > 0) {
    return ReE(
      res,
      { message: `Please enter require fields: ${inVaildFields}!.` },
      httpStatus.BAD_REQUEST
    );
  }

  let {
    customerId,
    status,
    modeOfPayment,
    saleType,
    amount,
    cardNo,
    cardHolderName,
    remarks,
    paymentDate,
    emi,
    balanceAmount,
  } = body;

  if (!customerId) {
    return ReE(
      res,
      { message: "customerId is required" },
      httpStatus.BAD_REQUEST
    );
  }

  if (!mongoose.isValidObjectId(customerId)) {
    return ReE(res, { message: "Invalid customerId" }, httpStatus.BAD_REQUEST);
  }

  let checkCustomer;
  [err, checkCustomer] = await toAwait(Customer.findOne({ _id: customerId }));
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!checkCustomer) {
    return ReE(
      res,
      { message: "customer not found for given id" },
      httpStatus.BAD_REQUEST
    );
  }

  checkCustomer = checkCustomer as ICustomer;
  if (!isValidDate(paymentDate)) {
    return ReE(
      res,
      { message: `Invalid date, valid format is (YYYY-MM-DD)!.` },
      httpStatus.BAD_REQUEST
    );
  }

  if (!mongoose.isValidObjectId(emi)) {
    return ReE(
      res,
      { message: "Invalid emi id in billing" },
      httpStatus.BAD_REQUEST
    );
  }

  let checkEmi;
  [err, checkEmi] = await toAwait(Emi.findOne({ _id: emi }));
  if (err) {
    return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  }
  if (!checkEmi) {
    return ReE(
      res,
      { message: "emi id not found in create billing" },
      httpStatus.BAD_REQUEST
    );
  }

  checkEmi = checkEmi as IEmi;

  if (status) {
    status = status.toLowerCase();
    let validValue = ["enquired", "blocked"];
    if (!validValue.includes(status)) {
      return ReE(
        res,
        { message: `status value is invalid valid value are (${validValue})` },
        httpStatus.BAD_REQUEST
      );
    }
    status = status === "enquired" ? "Enquiry" : "Blocked";
  }

  if (modeOfPayment) {
    let validValue = ["cash", "card", "online"];
    modeOfPayment = modeOfPayment.toLowerCase();
    if (!validValue.includes(modeOfPayment)) {
      return ReE(
        res,
        {
          message: `mode of payment value is invalid valid value are (${validValue})`,
        },
        httpStatus.BAD_REQUEST
      );
    }
    modeOfPayment =
      modeOfPayment === "cash"
        ? "Cash"
        : modeOfPayment === "card"
        ? "Card"
        : "Online";
  }

  if (saleType) {
    let validValue = ["plot", "flat", "villa"];
    saleType = saleType.toLowerCase();
    if (!validValue.includes(saleType)) {
      return ReE(
        res,
        {
          message: `sale type value is invalid valid value are (${validValue})`,
        },
        httpStatus.BAD_REQUEST
      );
    }
    saleType =
      saleType === "plot" ? "Plot" : saleType === "flat" ? "Flat" : "Villa";
  }

  let checkGeneral;
  [err, checkGeneral] = await toAwait(
    General.findOne({ _id: checkEmi.general })
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!checkGeneral) {
    return ReE(
      res,
      { message: "general not found for given id" },
      httpStatus.BAD_REQUEST
    );
  }

  checkGeneral = checkGeneral as IGeneral;

  let getAllBill;
  [err, getAllBill] = await toAwait(
    Billing.find({ general: checkEmi.general, customer: customerId })
  );
  if (err) {
    return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  }
  getAllBill = getAllBill as IBilling[];
  let totalAmount = checkGeneral.emiAmount! * checkGeneral.noOfInstallments!;
  if (getAllBill.length === 0) {
    balanceAmount = isNaN(totalAmount) ? amount : totalAmount - amount;
  } else {
    let total = getAllBill.reduce((acc, curr) => acc + curr.amountPaid, 0);
    balanceAmount = totalAmount - (total + amount);
  }

  let createBill = {
    emiNo: checkEmi.emiNo,
    amountPaid: amount,
    paymentDate: new Date(paymentDate),
    transactionType: "EMI Receipt",
    saleType,
    introducer: checkGeneral.marketer,
    status,
    modeOfPayment,
    mobileNo: checkCustomer.phone,
    cardNo,
    customer: customerId,
    general: checkEmi.general,
    cardHolderName,
    remarks,
    customerName: checkCustomer.name,
    balanceAmount: balanceAmount,
    emi,
  };

  let getMarketerHead;
  [err, getMarketerHead] = await toAwait(
    MarketingHead.findOne({ _id: checkGeneral.marketer }).populate(
      "percentageId"
    )
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!getMarketerHead) {
    return ReE(
      res,
      { message: "emi inside marketer head not found" },
      httpStatus.BAD_REQUEST
    );
  }

  let checkAlreadyExist = await Billing.findOne({
    emi,
    general: checkEmi.general,
    customer: customerId,
  });
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (checkAlreadyExist)
    return ReE(
      res,
      {
        message: `billing already exist for this emi no ${checkEmi.emiNo} for this customer!`,
      },
      httpStatus.BAD_REQUEST
    );

  // let getAllPaidEmi;
  // [err, getAllPaidEmi] = await toAwait(Emi.find({ customer: customerId, general: checkEmi.general, paidDate: { $ne: null } }));

  // if (err) {
  //     return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  // }

  // getAllPaidEmi = getAllPaidEmi as IEmi[]

  // getAllPaidEmi.sort((a, b) => a.emiNo - b.emiNo);

  // if(getAllPaidEmi.length !== 0){
  //     let lastEmi = getAllPaidEmi[getAllPaidEmi.length - 1];
  //     if(lastEmi.emiNo + 1 !== checkEmi.emiNo){
  //         return ReE(res, { message: `Cannot create billing for EMI No. ${checkEmi.emiNo}. Latest pending EMI is No. ${lastEmi.emiNo  + 1 }` }, httpStatus.BAD_REQUEST);
  //     }
  // }else{
  //     if(checkEmi.emiNo !== 1){
  //         return ReE(res, { message: "Cannot create billing for EMI No. "+ checkEmi.emiNo+". Pending EMI is No. 1." }, httpStatus.BAD_REQUEST);
  //     }
  // }

  let billing;
  [err, billing] = await toAwait(Billing.create(createBill));
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

  billing = billing as IBilling;

  getMarketerHead = getMarketerHead as IMarketingHead | any;

  let marketerDe: any = {
    customer: customerId,
    emiNo: checkEmi?.emiNo,
    paidDate: billing.paymentDate,
    paidAmt: billing.amountPaid,
    marketer: billing.introducer,
    emiId: emi,
    generalId: checkGeneral._id,
    marketerHeadId: checkGeneral.marketer,
    percentageId: getMarketerHead.percentageId,
  };

  let checkAlreadyExistMarketer = await Marketer.findOne({
    marketer: marketerDe.marketer,
    emiId: marketerDe.emiId,
    general: marketerDe.general,
  });
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!checkAlreadyExistMarketer) {
    if (getMarketerHead?.percentageId?.rate) {
      let percent = Number(
        getMarketerHead?.percentageId?.rate?.replace("%", "")
      );
      let correctPercent = billing.amountPaid * (percent / 100);
      marketerDe.commPercentage = percent;
      marketerDe.commAmount = isNaN(correctPercent) ? 0 : correctPercent;
    }

    let marketer;
    [err, marketer] = await toAwait(Marketer.create(marketerDe));
    if (err) {
      return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    }

    let updateEmi;
    [err, updateEmi] = await toAwait(
      Emi.findOneAndUpdate(
        { _id: emi },
        { paidDate: billing.paymentDate, paidAmt: billing.amountPaid },
        { new: true }
      )
    );
    if (err) {
      return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  return ReS(
    res,
    { message: "billing created successfully!", data: billing },
    httpStatus.OK
  );
};

export const getAllDetailsByCustomerId = async (
  req: Request,
  res: Response
) => {
  let err;
  let { customerId, generalId } = req.query,
    option: any = {};
  if (customerId) {
    if (!mongoose.isValidObjectId(customerId)) {
      return ReE(
        res,
        { message: "customer id is invalid" },
        httpStatus.BAD_REQUEST
      );
    }
    let getCustomer;
    [err, getCustomer] = await toAwait(Customer.findOne({ _id: customerId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getCustomer) {
      return ReE(
        res,
        { message: "customer not found given id" },
        httpStatus.NOT_FOUND
      );
    }
    option.customer = customerId;
  }
  if (generalId) {
    if (!mongoose.isValidObjectId(generalId)) {
      return ReE(
        res,
        { message: "general id is invalid" },
        httpStatus.BAD_REQUEST
      );
    }
    let getGeneral;
    [err, getGeneral] = await toAwait(General.findOne({ _id: generalId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getGeneral) {
      return ReE(
        res,
        { message: "general not found given id" },
        httpStatus.NOT_FOUND
      );
    }
    option.general = generalId;
  }
  let data: any = {};

  //get all general
  let filterGeneral = { customer: customerId };
  let getGeneral;
  [err, getGeneral] = await toAwait(
    General.find(filterGeneral).populate("customer").populate("marketer")
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  data.general = getGeneral;

  //get all emi
  let getAllEmi;
  [err, getAllEmi] = await toAwait(
    Emi.find(option).populate("customer").populate("general")
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  data.emi = getAllEmi;

  //get all marketer
  let getAllMarketer;
  [err, getAllMarketer] = await toAwait(
    Marketer.find(option)
      .populate("customer")
      .populate("generalId")
      .populate("emiId")
      .populate("marketerHeadId")
      .populate("percentageId")
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  data.marketer = getAllMarketer;

  //get all flat
  let getAllFlat;
  [err, getAllFlat] = await toAwait(
    Flat.find(option).populate("customer").populate("general")
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  data.flat = getAllFlat;

  let getAllPlot;
  [err, getAllPlot] = await toAwait(
    Plot.find(option).populate("customer").populate("general")
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  data.plot = getAllPlot;

  let getAllBilling;
  [err, getAllBilling] = await toAwait(
    Billing.find(option)
      .populate("customer")
      .populate("general")
      .populate("introducer")
      .populate("emi")
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  data.billing = getAllBilling;

  return ReS(res, { message: "success", data: data }, httpStatus.OK);
};

export const getAllTypeBasedGenId = async (req: Request, res: Response) => {
  let err;
  let { customerId } = req.query,
    option: any = {};
  if (customerId) {
    if (!mongoose.isValidObjectId(customerId)) {
      return ReE(
        res,
        { message: "customer id is invalid" },
        httpStatus.BAD_REQUEST
      );
    }
    let getCustomer;
    [err, getCustomer] = await toAwait(Customer.findOne({ _id: customerId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getCustomer) {
      return ReE(
        res,
        { message: "customer not found given id" },
        httpStatus.NOT_FOUND
      );
    }
    option.customer = customerId;
  }
  let getGeneral;
  [err, getGeneral] = await toAwait(General.find({ customer: customerId }));
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  //obj = [{general:objGeneral, flat:objFlat, plot:objPlot, marketer:objMarketer, emi:objEmi, billing:objBilling}]

  return ReS(res, { message: "success", data: getGeneral }, httpStatus.OK);
};

export const getAllDataBasedOnGeneral = async (req: Request, res: Response) => {
  const { customerId } = req.query;

  if (!customerId || !mongoose.isValidObjectId(customerId.toString())) {
    return ReE(
      res,
      { message: "Invalid or missing customerId" },
      httpStatus.BAD_REQUEST
    );
  }

  // ✅ Get all general entries for the customer
  let err, generalList;
  [err, generalList] = await toAwait(
    General.find({ customer: customerId })
      .populate("customer")
      .populate("marketer")
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

  // ✅ Prepare result array
  const result = [];

  generalList = generalList as IGeneral[];

  for (const general of generalList) {
    let objPlot, objFlat, objMarketer, objEmi, objBilling;
    if (general?._id) {
      [err, objPlot] = await toAwait(
        Plot.find({ general: general._id })
          .populate("customer")
          .populate("general")
      );
      if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
      [err, objFlat] = await toAwait(
        Flat.find({ general: general._id })
          .populate("customer")
          .populate("general")
      );
      if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

      [err, objMarketer] = await toAwait(
        Marketer.find({ generalId: general._id })
          .populate("customer")
          .populate("generalId")
          .populate("emiId")
          .populate("marketerHeadId")
          .populate("percentageId")
      );
      if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

      [err, objEmi] = await toAwait(
        Emi.find({ general: general._id })
          .populate("customer")
          .populate("general")
      );
      if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

      [err, objBilling] = await toAwait(
        Billing.find({ general: general._id })
          .populate("customer")
          .populate("general")
          .populate("introducer")
          .populate("emi")
      );
      if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
      result.push({
        general,
        plot: objPlot,
        flat: objFlat,
        marketer: objMarketer,
        emi: objEmi,
        billing: objBilling,
      });
    }
  }

  return ReS(res, { message: "success", data: result }, httpStatus.OK);
};

export const getDataBasedOnGeneralById = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;

  if (!id || !mongoose.isValidObjectId(id.toString())) {
    return ReE(
      res,
      { message: "Invalid or missing general id" },
      httpStatus.BAD_REQUEST
    );
  }

  // ✅ Get all general entries for the customer
  let err, general;
  [err, general] = await toAwait(
    General.findOne({ _id: id }).populate("customer").populate("marketer")
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

  if (!general) {
    return ReE(
      res,
      { message: "general not found for given id" },
      httpStatus.NOT_FOUND
    );
  }

  general = general as IGeneral;

  let objPlot, objFlat, objMarketer, objEmi, objBilling;

  if (general?._id) {
    [err, objPlot] = await toAwait(
      Plot.find({ general: general._id })
        .populate("customer")
        .populate("general")
    );
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    [err, objFlat] = await toAwait(
      Flat.find({ general: general._id })
        .populate("customer")
        .populate("general")
    );
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    [err, objMarketer] = await toAwait(
      Marketer.find({ generalId: general._id })
        .populate("customer")
        .populate("generalId")
        .populate("emiId")
        .populate("marketerHeadId")
        .populate("percentageId")
    );
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    [err, objEmi] = await toAwait(
      Emi.find({ general: general._id })
        .populate("customer")
        .populate("general")
    );
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    [err, objBilling] = await toAwait(
      Billing.find({ general: general._id })
        .populate("customer")
        .populate("general")
        .populate("introducer")
        .populate("emi")
    );
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  }

  let result = {
    general,
    plot: objPlot,
    flat: objFlat,
    marketer: objMarketer,
    emi: objEmi,
    billing: objBilling,
  };

  return ReS(res, { message: "success", data: result }, httpStatus.OK);
};

//when pass cusId and emiId checkEmi belong to that customer
export const checkEmi = async (req: Request, res: Response) => {
  let body = req.body,
    err;
  let { customerId, emiId } = body;
  if (!customerId) {
    return ReE(
      res,
      { message: `customerId is required!` },
      httpStatus.BAD_REQUEST
    );
  }
  if (!emiId) {
    return ReE(res, { message: `emiId is required!` }, httpStatus.BAD_REQUEST);
  }
  if (!mongoose.isValidObjectId(customerId)) {
    return ReE(res, { message: `Invalid customerId!` }, httpStatus.BAD_REQUEST);
  }
  if (!mongoose.isValidObjectId(emiId)) {
    return ReE(res, { message: `Invalid emi id!` }, httpStatus.BAD_REQUEST);
  }
  let checkEmi;
  [err, checkEmi] = await toAwait(Emi.findOne({ _id: emiId }));
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!checkEmi) {
    return ReE(
      res,
      { message: `emi not found for given id!.` },
      httpStatus.NOT_FOUND
    );
  }
  checkEmi = checkEmi as IEmi;
  let checkCustomer;
  [err, checkCustomer] = await toAwait(Customer.findOne({ _id: customerId }));
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!checkCustomer) {
    return ReE(
      res,
      { message: `customer not found for given id!.` },
      httpStatus.NOT_FOUND
    );
  }
  checkCustomer = checkCustomer as any;
  if (checkEmi.customer.toString() !== checkCustomer._id.toString()) {
    return ReE(
      res,
      { message: `This emi doesn't belong to this customer!` },
      httpStatus.BAD_REQUEST
    );
  }
  let getGeneral;
  [err, getGeneral] = await toAwait(General.findOne({ _id: checkEmi.general }));
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!getGeneral) {
    return ReE(
      res,
      { message: `general not found for given emi id so can't do billing!.` },
      httpStatus.NOT_FOUND
    );
  }
  getGeneral = getGeneral as IGeneral;
  if (getGeneral.status === "blocked") {
    return ReE(
      res,
      { message: `This general is blocked so can't do billing!` },
      httpStatus.NOT_FOUND
    );
  }
  if (checkEmi?.paidAmt) {
    return ReE(
      res,
      { message: `This emi is already paid!` },
      httpStatus.NOT_FOUND
    );
  }
  ReS(res, { message: "emi found", data: checkEmi }, httpStatus.OK);
};

export const storeFcmToken = async (req: Request, res: Response) => {
  let body = req.body,
    err;

  let { fcm_token } = body;

  let field = ["fcm_token"];

  let inVaildFields = field.filter((x) => isNull(body[x]));

  if (inVaildFields.length > 0) {
    return ReE(
      res,
      { message: `Please enter required fields ${inVaildFields}!.` },
      httpStatus.BAD_REQUEST
    );
  }

  let getAllSuperAdmin;

  [err, getAllSuperAdmin] = await toAwait(User.find({ isAdmin: true }));

  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

  getAllSuperAdmin = getAllSuperAdmin as IUser[];

  if (getAllSuperAdmin.length === 0) {
    return ReE(
      res,
      { message: `Super Admin not found!.` },
      httpStatus.NOT_FOUND
    );
  }

  for (let index = 0; index < getAllSuperAdmin.length; index++) {
    let element = getAllSuperAdmin[index];
    element = element as IUser;
    let fcmToken = element.fcmToken as string[];
    let newValue = [...fcmToken, fcm_token];
    //remove duplicate
    let unique = newValue.filter((v, i) => newValue.indexOf(v) === i);
    unique = unique as string[];
    if (unique.length === 0) continue;
    let updateUser;
    [err, updateUser] = await toAwait(
      User.updateOne({ _id: element._id }, { $set: { fcmToken: unique } })
    );
    if (err) return console.log(err);
  }

  return ReS(res, { message: "successfully store fcm token" }, httpStatus.OK);
};
