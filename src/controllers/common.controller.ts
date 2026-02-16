import { PutObjectCommand } from "@aws-sdk/client-s3";
import e, { Request, Response } from "express";
import httpStatus from "http-status";
import mongoose, { isValidObjectId, Types } from "mongoose";
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
  getEmiDate,
  getMonthStartEndDate,
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
import editRequestModel from "../models/editRequest.model";
import { BillingRequest } from "../models/billingRequest.model";
import { IBillingRequest } from "../type/billingRequest";
import moment from "moment-timezone";
import { MarketDetail } from "../models/marketDetail.model";
import { IMarketDetail } from "../type/marketDetail";
import { Project } from "../models/project.model";
import { IProject } from "../type/project";
import { get } from "http";
import { sendPushNotificationToSuperAdmin } from "./common";
import { CustomerEmiModel } from "../models/commision.model";
import to from "await-to-js";

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
  let body = req.body, err: any;
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

  checkCustomer = checkCustomer as ICustomer;

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

    general.project = checkCustomer.projectId;

    let checkProject;
    [err, checkProject] = await toAwait(Project.findOne({ _id: general.project }));

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    if (!checkProject) {
      return ReE(
        res,
        { message: "project id not found in create general" },
        httpStatus.BAD_REQUEST
      );
    }

    checkProject = checkProject as IProject;

    // if (checkProject.emiAmount != general.emiAmount) {
    //   return ReE(
    //     res,
    //     { message: `emi amount not match with project emi amount in general project emi amount is ${checkProject.emiAmount}` },
    //     httpStatus.BAD_REQUEST
    //   )
    // }

    // if (Number(checkProject.duration) !== Number(general.noOfInstallments)) {
    //   return ReE(
    //     res,
    //     { message: `no of installments not match with project duration in general, project duration is ${checkProject.duration}` },
    //     httpStatus.BAD_REQUEST
    //   )
    // }

    // if (checkCustomer.cedId) {
    //   let checkMarketDetail;
    //   [err, checkMarketDetail] = await toAwait(MarketDetail.findOne({ _id: checkCustomer.cedId }));

    //   if (err) {
    //     return ReE(
    //       res,
    //       err,
    //       httpStatus.INTERNAL_SERVER_ERROR
    //     );
    //   }
    //   if (!checkMarketDetail) {
    //     return ReE(
    //       res,
    //       { message: "MarketDetail not found inside map with this customer" },
    //       httpStatus.BAD_REQUEST
    //     );
    //   }
    //   general.marketerByModel = "MarketDetail";
    //   general.marketer = checkCustomer.cedId;
    // } else {
    //   let checkMarketingHead;
    //   [err, checkMarketingHead] = await toAwait(MarketingHead.findOne({ _id: checkCustomer.ddId }));

    //   if (err) {
    //     return ReE(
    //       res,
    //       err,
    //       httpStatus.INTERNAL_SERVER_ERROR
    //     );
    //   }

    //   if (!checkMarketingHead) {
    //     return ReE(
    //       res,
    //       { message: "MarketingHead not found inside map with this customer" },
    //       httpStatus.BAD_REQUEST
    //     );
    //   }

    //   general.marketerByModel = "MarketingHead";
    //   general.marketer = checkCustomer.ddId;
    // }

  }

  let checkAlreadyExist = await General.findOne({
    customer: customerId,
    project: general.project
  });

  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (checkAlreadyExist)
    return ReE(
      res,
      { message: `general already exist based on given cutomer id` },
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

  let updateGeneralInCustomer;
  [err, updateGeneralInCustomer] = await toAwait(
    Customer.updateOne(
      { _id: customerId },
      { generalId: createGeneral._id }
    )
  );

  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

  if (createGeneral.noOfInstallments) {
    let id = createGeneral._id;
    for (let index = 0; index < general.noOfInstallments; index++) {
      let emi = {
        customer: customerId,
        date: getEmiDate(index),
        emiNo: index + 1,
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
  const { customerId, general, plot, flat } = body;

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

    // if (!general.editDeleteReason) {
    //   return ReE(
    //     res,
    //     {
    //       message: `If update general then general.editDeleteReason is required`,
    //     },
    //     httpStatus.BAD_REQUEST
    //   );
    // }

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
      if (customerId && !mongoose.isValidObjectId(customerId)) {
        return ReE(
          res,
          { message: "customerId is invalid" },
          httpStatus.BAD_REQUEST
        );
      }

      if (customerId) {
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
        let getEmi;
        [err, getEmi] = await toAwait(Emi.findOne({ customer: customerId }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!getEmi) {
          return ReE(
            res,
            { message: "emi not found for this customer so create estimate for this customer" },
            httpStatus.BAD_REQUEST
          );
        }
        getEmi = getEmi as IEmi;
        general._id = getEmi.general;
      }
      if (!customerId) {
        return ReE(
          res,
          { message: "general _id is invalid" },
          httpStatus.BAD_REQUEST
        );
      }
    }


    if (!general._id) {

      return ReE(
        res,
        { message: "when update general then general._id or customerId is required" },
        httpStatus.BAD_REQUEST
      );

    }

    let checkAlreadyExist = await General.findOne({ _id: general._id });
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!checkAlreadyExist) {
      return ReE(
        res,
        { message: `general not found given id` },
        httpStatus.BAD_REQUEST
      );
    }

    let getProject;
    [err, getProject] = await toAwait(Project.findOne({ _id: checkAlreadyExist.project }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getProject) {
      return ReE(
        res,
        { message: "project id not found in update general" },
        httpStatus.BAD_REQUEST
      );
    }

    getProject = getProject as IProject;

    let checkBillForCus;
    [err, checkBillForCus] = await toAwait(Billing.findOne({ customer: customerId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    if (general.emiAmount || general.noOfInstallments) {
      if (!user.isAdmin) {
        return ReE(res, { message: "You don't have permission to update the emi_amount or noOfInstallments " }, httpStatus.BAD_REQUEST)
      }
    }

    if (checkBillForCus) {
      if (general.emiAmount) {
        return ReE(res, { message: "You can't update the emi_amount beacause many billing already created" }, httpStatus.BAD_REQUEST)
      }
    }

    if (general.noOfInstallments) {
      if (checkAlreadyExist.noOfInstallments == general.noOfInstallments) {
        delete general.noOfInstallments
      }
      let getAllEmiUnPaid;
      [err, getAllEmiUnPaid] = await toAwait(Emi.find({ customer: customerId, paidDate: null }));
      if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
      getAllEmiUnPaid = getAllEmiUnPaid as IEmi[];

      let getPaidEmi;
      [err, getPaidEmi] = await toAwait(Emi.find({ customer: customerId, paidDate: { $ne: null } }));
      if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
      getPaidEmi = getPaidEmi as IEmi[];

      if (getPaidEmi.length > general.noOfInstallments) {
        return ReE(res, { message: `Cannot reduce installments. Customer already paid ${getPaidEmi.length} EMIs` }, httpStatus.BAD_REQUEST)
      }

    }

    // if (general.noOfInstallments && getProject.duration != general.noOfInstallments) {
    //   return ReE(
    //     res,
    //     { message: "You can't update the no_of_installments directly. When you update the project duration, the no_of_installments is updated automatically" },
    //     httpStatus.BAD_REQUEST
    //   )
    // }

    // if (general.emiAmount && getProject.emiAmount != general.emiAmount) {
    //   return ReE(
    //     res,
    //     { message: "You can't update the emi_amount directly. When you update the project emi_amount, the emi_amount is updated automatically" },
    //     httpStatus.BAD_REQUEST
    //   )
    // }
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
    let getGeneral;
    [err, getGeneral] = await toAwait(
      General.findOne({ _id: general._id })
    );
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getGeneral) return ReE(res, { message: "General not found" }, httpStatus.NOT_FOUND);

    getGeneral = getGeneral as IGeneral;
    if (general.noOfInstallments) {
      const oldInstallments = getGeneral.noOfInstallments;
      const newInstallments = general.noOfInstallments;
      if (oldInstallments) {
        if (oldInstallments !== newInstallments) {
          if (oldInstallments > newInstallments) {
            const deleteCount = oldInstallments - newInstallments;

            let unpaidEmis;
            [err, unpaidEmis] = await toAwait(
              Emi.find({
                customer: getGeneral.customer,
                paidDate: null
              }).sort({ emiNo: -1 }) // ✅ using emiNo
            );
            if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
            unpaidEmis = unpaidEmis as IEmi[];
            const emisToDelete = unpaidEmis.slice(0, deleteCount);
            const emiIds = emisToDelete.map((e: any) => e._id);

            if (emiIds.length > 0) {
              await Emi.deleteMany({ _id: { $in: emiIds } });
            }
          }

          if (oldInstallments < newInstallments) {

            const addCount = newInstallments - oldInstallments;

            let lastEmi;
            [err, lastEmi] = await toAwait(
              Emi.findOne({ customer: getGeneral.customer })
                .sort({ emiNo: -1 })
            );
            if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

            lastEmi = lastEmi as IEmi;

            let lastEmiNo = lastEmi?.emiNo || 0;
            let lastDueDate = lastEmi?.date || new Date();

            const newEmis = [];

            for (let i = 1; i <= addCount; i++) {

              let nextDueDate = new Date("2028-02-29");
              nextDueDate.setMonth(nextDueDate.getMonth() + i);
              newEmis.push({
                customer: getGeneral.customer,
                general: getGeneral._id,
                emiNo: lastEmiNo + i,
                emiAmt: getGeneral.emiAmount,
                date: getEmiDate(i, new Date(lastDueDate)),
                paidDate: null
              });

            }
            await Emi.insertMany(newEmis);
          }

        }
      }
    }
    if (general.emiAmount) {
      if (getGeneral.emiAmount !== general.emiAmount) {
        let updateAllEmis;
        [err, updateAllEmis] = await toAwait(Emi.updateMany({ general: getGeneral._id }, { emiAmt: general.emiAmount }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!updateAllEmis) {
          errors.push(`error in while updating emis: ${err.message}`);
        }
      }
    }
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

  if (customerId) {
    if (mongoose.isValidObjectId(customerId)) {
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
      getCustomer = getCustomer as ICustomer
      option.$or = [
        { customer: customerId },
        { supplierCode: getCustomer.id }
      ]
    } else {
      option.supplierCode = customerId
    }
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
  let { customerId, generalId, page, limit, search } = req.query,
    option: any = {};

  // Existing customerId validation
  if (customerId) {
    if (mongoose.isValidObjectId(customerId)) {
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
      getCustomer = getCustomer as ICustomer
      option.$or = [
        { customer: customerId },
        { customerCode: getCustomer.id }
      ]
    } else {
      option.customerCode = customerId
    }
  }

  // Existing generalId validation
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

  // Pagination validation
  if (limit && !page) {
    return ReE(
      res,
      { message: "limit send in query means page is required or do not send the limit." },
      httpStatus.BAD_REQUEST
    );
  }

  if (page && !limit) {
    return ReE(
      res,
      { message: "page send in query means limit is required or do not send the page." },
      httpStatus.BAD_REQUEST
    );
  }

  // Search logic - multi-field search
  if (search) {
    const searchRegex = new RegExp(search as string, 'i'); // case-insensitive

    option.$or = [
      { mobileNo: searchRegex },
      { customerName: searchRegex },
      { billingId: searchRegex },
      { remarks: searchRegex },
      { id: searchRegex },
      { customerCode: searchRegex },
      // Exact match for enums (case-insensitive)
      { transactionType: new RegExp(`^${search}$`, 'i') },
      { modeOfPayment: new RegExp(`^${search}$`, 'i') },
      { saleType: new RegExp(`^${search}$`, 'i') },
      { status: new RegExp(`^${search}$`, 'i') },
    ];

    if (mongoose.Types.ObjectId.isValid(search as string)) {
      option.$or.push({ _id: new mongoose.Types.ObjectId(search as string) });
      option.$or.push({ customer: new mongoose.Types.ObjectId(search as string) });
    }


    console.log(option)
  }

  // Get total count for pagination
  let totalCount;
  [err, totalCount] = await toAwait(Billing.countDocuments(option));
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

  totalCount = totalCount as number;

  if (totalCount === 0) {
    return ReS(
      res,
      { message: "billing not found in db", data: [] },
      httpStatus.OK
    );
  }

  // Check if pagination is requested
  const isPaginated = !!(page && limit);
  let setPage: number = 1;
  let setLimit: number = totalCount;
  let setOffset: number = 0;

  if (isPaginated) {
    setPage = parseInt(page as string);
    setLimit = parseInt(limit as string);
    setOffset = (setPage - 1) * setLimit;

    // Validate page number
    const totalPages = Math.ceil(totalCount / setLimit);
    if (setPage > totalPages) {
      return ReE(
        res,
        { message: `Page no ${page} not available. The last page no is ${totalPages}.` },
        httpStatus.NOT_FOUND
      );
    }
  }

  // Build query with pagination if requested
  [err, getBilling] = await toAwait(
    Billing.find(option)
      .populate({
        path: "general",
        populate: [
          { path: "project" }
        ]
      })
      .populate("introducer")
      .populate("emi")
      .populate({
        path: "customer",
        populate: [
          { path: "cedId" },
          { path: "ddId" }
        ]
      })
      .populate("createdBy", "-password -fcmToken")
      .sort({ createdAt: -1 })
      .limit(setLimit)
      .skip(setOffset)
  );

  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  getBilling = getBilling as IBilling[];

  // Return response with or without pagination metadata
  if (isPaginated) {
    const totalPages = Math.ceil(totalCount / setLimit);
    return ReS(
      res,
      {
        data: getBilling,
        pagination: {
          totalRecords: totalCount,
          totalPages: totalPages,
          currentPage: setPage,
          pageSize: setLimit,
          hasNextPage: setPage < totalPages,
          hasPreviousPage: setPage > 1
        }
      },
      httpStatus.OK
    );
  } else {
    // Backward compatible response
    return ReS(res, { data: getBilling }, httpStatus.OK);
  }
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
    Plot.find(option).populate("customer").populate("general").sort({ createdAt: -1 })
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
    Flat.find(option).populate("customer").populate("general").sort({ createdAt: -1 })
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
  let { customerId, generalId, paid } = req.query, option: any = {};

  const page = req.query.page ? parseInt(req.query.page as string) : null;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : null;
  const search = (req.query.search as string) || "";
  const searchConditions: any[] = [];

  if (customerId) {
    if (mongoose.isValidObjectId(customerId)) {
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
      getCustomer = getCustomer as ICustomer
      option.$or = [
        { supplierCode: getCustomer.id },
        { customer: getCustomer._id }
      ]

    } else {
      option.supplierCode = customerId
    }
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

  let query = Emi.find(option).populate("customer").populate("general").sort({ createdAt: -1 });

  let total;
  let totalPages = 1;

  if (page && limit) {
    const skip = (page - 1) * limit;
    query = query.skip(skip).limit(limit);

    let count;
    [err, count] = await toAwait(Emi.countDocuments(option));
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

  [err, getEmi] = await toAwait(query);
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

  getEmi = getEmi as IEmi[];

  return ReS(res, {
    data: getEmi,
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
  }, httpStatus.OK);

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
      .populate("percentageId").sort({ createdAt: -1 })
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
  try {
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
        //-----
        .populate({
          path: "general",
          populate: [
            { path: "project" }
          ]
        })
        //------
        .populate("introducer")
        .populate("emi")
        .populate({
          path: "customer",
          populate: [
            {
              path: "ddId",               // populate cedId first
              populate: {
                path: "percentageId"       // then populate marketerId inside cedId
              }
            },
            {
              path: "cedId",
              populate: [
                { path: "percentageId" },
                {
                  path: "overAllHeadBy.headBy",   // populate headBy inside overAllHeadBy array
                  populate: { path: "percentageId" } // populate headBy.percentageId
                }
              ]
            },
          ]
        })
        .populate("createdBy", "-password -fcmToken")
    );
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getBilling) {
      return ReE(
        res,
        { message: "billing not found given id" },
        httpStatus.NOT_FOUND
      );
    }

    getBilling = (getBilling as any).toObject();

    let getAllFull, generalId, customerId;
    if (isValidObjectId(getBilling.general)) {
      generalId = getBilling.general
    } else if (isValidObjectId(getBilling.general._id)) {
      generalId = getBilling.general._id
    }

    let checkDownLineforCed;
    let cedId = ""
    if (getBilling.customer.cedId) {
      if (isValidObjectId(getBilling.customer.cedId)) {
        cedId = getBilling.customer.cedId
      } else if (isValidObjectId(getBilling.customer.cedId._id)) {
        cedId = getBilling.customer.cedId._id
      }
      [err, checkDownLineforCed] = await toAwait(
        MarketDetail.findOne({ headBy: cedId })
      )
      if (err) {
        return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
      }
      if (!checkDownLineforCed) {
        getBilling.customer.cedId.downLine = false
      } else {
        getBilling.customer.cedId.downLine = true
      }
    } else {
      if (getBilling.customer.ddId) {
        getBilling.customer.ddId.downLine = false
      }
    }

    if (isValidObjectId(getBilling.customer)) {
      customerId = getBilling.customer
    } else if (isValidObjectId(getBilling.customer._id)) {
      customerId = getBilling.customer._id
    }

    [err, getAllFull] = await toAwait(
      Emi.find({ general: generalId, customer: customerId }).populate("customer").populate("general")
    )

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    getBilling.fullEmi = getAllFull;

    let totalAmount = 0;
    if(getBilling.general){
      if(getBilling.general?.totalAmount){
        totalAmount = getBilling.general.totalAmount
      }else{
        if(getBilling?.totalAmount){
          totalAmount = getBilling.totalAmount
        }else if(getBilling.general?.emiAmount && getBilling.general?.noOfInstallments){
          totalAmount = Number(getBilling.general.emiAmount) * Number(getBilling.general.noOfInstallments)
        }
      }
    }

    let getAllPaid;
    [err, getAllPaid] = await toAwait(
      Billing.find({ general: generalId, customer: customerId }).populate("customer").populate("general")
    )
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    getAllPaid = getAllPaid as IBilling[]

    let totalPaid = getAllPaid.reduce((total, current) => total + Number(current?.enteredAmount === 0 ? current?.amountPaid : current?.enteredAmount), 0);
    let totalunPaid = totalAmount - totalPaid
    let totalPrevPaid = totalPaid - Number(getBilling.enteredAmount === 0 ? getBilling.amountPaid : getBilling.enteredAmount)

    let billData = {
      totalAmount: totalAmount,
      totalPaid: totalPaid,
      totalunPaid: totalunPaid,
      totalPreviouslyPaid: totalPrevPaid
    }

    return ReS(res, { data: getBilling, emi: getAllFull,billData  }, httpStatus.OK);

  } catch (error) {
    return ReE(res, error, httpStatus.INTERNAL_SERVER_ERROR);
  }
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

export function validateEmiPayment(
  enteredAmount: number,
  monthlyEmi: number,
  pendingAmount: number
) {

  if (enteredAmount <= 0) {
    return { valid: false, message: "Amount must be greater than zero" };
  }

  if (enteredAmount > pendingAmount) {
    return { valid: false, message: "Amount exceeds pending EMI amount" };
  }

  if (monthlyEmi > enteredAmount) {
    return { valid: false, message: "please enter amount must be greater than or equal to " + monthlyEmi };
  }

  if (enteredAmount % monthlyEmi !== 0) {
    return {
      valid: false,
      message: `Amount must be in multiples of ₹${monthlyEmi}`
    };
  }

  const emiCount = enteredAmount / monthlyEmi;

  return {
    valid: true,
    emiCount,
  };
}

export const createBilling = async (req: CustomRequest, res: Response) => {
  try {


    let body = req.body, user = req.user;
    let err;

    let fields = [
      "customerId",
      "status",
      "modeOfPayment",
      "amount",
      "paymentDate",
      "billFor",
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
      balanceAmount,
      billFor,
      referenceId,
      housing = false
    } = body;

    amount = Number(amount);
    let customerBalanceAmount = 0;
    const enteredAmount = amount;

    if (housing) {
      if (housing !== true) {
        return ReE(res, { message: "Invalid housing value, valid value is true in boolean" }, httpStatus.BAD_REQUEST);
      }
    }

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

    let billForValues = ["previous", "current", "advance"];
    billFor = billFor.toLowerCase();
    if (!billForValues.includes(billFor)) {
      return ReE(res, { message: "Invalid billFor values valid value are " + billForValues }, httpStatus.BAD_REQUEST);
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
      General.findOne({ customer: customerId })
    );
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!checkGeneral) {
      return ReE(
        res,
        { message: "general not found for given customer id" },
        httpStatus.BAD_REQUEST
      );
    }

    checkGeneral = checkGeneral as IGeneral;

    if (checkGeneral.status?.toLowerCase() === "blocked") {
      return ReE(res, { message: "Customer is in blocked status so you can't create billing" }, httpStatus.BAD_REQUEST);
    }

    let readyForBill: IEmi[] = []

    if (billFor === "current") {
      //replace oldData
      let getAllBill;
      [err, getAllBill] = await toAwait(
        Billing.find({
          general: checkGeneral._id, customer: customerId
        })
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

      let date = getMonthStartEndDate()

      let getEmi
      [err, getEmi] = await toAwait(
        Emi.findOne({
          general: checkGeneral._id,
          customer: customerId,
          date: {
            $gte: date.start,
            $lte: date.end
          },
        }
        ));

      if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
      if (!getEmi) {
        return ReE(
          res,
          { message: "emi not found for current month for given customer" },
          httpStatus.BAD_REQUEST
        );
      }

      getEmi = getEmi as IEmi;

      if (getEmi.paidDate) {
        return ReE(
          res,
          { message: "emi already paid for current month" },
          httpStatus.BAD_REQUEST
        );
      }

      if (getEmi.emiAmt !== amount) {
        return ReE(
          res,
          { message: "emi amount not matched with your entered amount emi amount is " + getEmi.emiAmt },
          httpStatus.BAD_REQUEST
        );
      }

      readyForBill.push(getEmi)

    } else {

      let checkBillingRequestForCustomer;
      [err, checkBillingRequestForCustomer] = await toAwait(
        BillingRequest.findOne({ requestFor: "create", customerId: customerId, status: "pending" })
      );
      if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
      if (checkBillingRequestForCustomer) {
        return ReE(
          res,
          { message: "billing request already pending for this customer" },
          httpStatus.BAD_REQUEST
        );
      }

      let getAllEmiPast;
      //replace oldData
      [err, getAllEmiPast] = await toAwait(
        Emi.find({ general: checkGeneral._id, customer: customerId, paidDate: null }).sort({ emiNo: 1 })
      );

      if (err) {
        return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
      }

      getAllEmiPast = getAllEmiPast as IEmi[];

      if (getAllEmiPast.length === 0) {
        let getEmi;
        [err, getEmi] = await toAwait(
          Emi.findOne({
            general: checkGeneral._id,
            customer: customerId,
          })
        )

        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!getEmi) {
          return ReE(
            res,
            { message: "emi's not found for given customer and general id" },
            httpStatus.BAD_REQUEST
          );
        }
        return ReE(
          res,
          { message: "This customer has already paided all emi" },
          httpStatus.BAD_REQUEST
        );
      }


      if (housing) {
        amount += Number(checkCustomer.balanceAmount)
        if (getAllEmiPast[0].emiAmt > amount) {
          let createBill;
          if (!user.isAdmin) {
            [err, checkBillingRequestForCustomer] = await toAwait(
              BillingRequest.findOne({ requestFor: "create", customerId: customerId, status: "pending" })
            );
            if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
            if (checkBillingRequestForCustomer) {
              return ReE(
                res,
                { message: "billing request already pending for this customer" },
                httpStatus.BAD_REQUEST
              );
            }

            let createBillingRequest
            [err, createBillingRequest] = await toAwait(
              BillingRequest.create({
                status: "pending",
                userId: user._id,
                message: `Billing parcially paid creation Request from  ${user.name} for ${readyForBill.length} EMIs`,
                requestFor: "create",
                customerId: customerId,
                emi: readyForBill.map((emi) => emi._id),
                billingDetails: {
                  saleType: saleType,
                  modeOfPayment,
                  paymentDate,
                  cardHolderName,
                  remarks,
                  cardNo,
                  referenceId,
                  billFor,
                  customerBalanceAmount: customerBalanceAmount,
                  housing,
                  enteredAmount,
                  parciallyPaid: true
                },
              })
            );

            if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
            if (!createBillingRequest) {
              return ReE(
                res,
                { message: "billing request not created" },
                httpStatus.INTERNAL_SERVER_ERROR
              );
            }

            // let createCommission;
            // [err, createCommission] = await toAwait(
            //   CustomerEmiModel.create({
            //     bill: createBillingRequest?._id,
            //     customer: customerId,
            //     emi: readyForBill.map((emi) => emi._id),
            //     amount: enteredAmount

            //   })
            // );

            // if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
            // if (!createCommission) {
            //   return ReE(
            //     res,
            //     { message: "commission request not created" },
            //     httpStatus.INTERNAL_SERVER_ERROR
            //   );
            // }

            return ReS(res, { message: "billing request created successfully" }, httpStatus.OK);
          }
          [err, createBill] = await toAwait(
            Billing.create({
              // amountPaid: enteredAmount,
              paymentDate: new Date(paymentDate),
              transactionType: "EMI Receipt",
              saleType,
              introducer: checkCustomer?.cedId || checkCustomer?.ddId,
              introducerByModel: checkCustomer?.cedId ? "MarketDetail" : "MarketingHead",
              status,
              modeOfPayment,
              referenceId,
              mobileNo: checkCustomer.phone,
              cardNo,
              customer: customerId,
              general: checkGeneral._id,
              cardHolderName,
              remarks,
              customerName: checkCustomer.name,
              oldData: checkCustomer.oldData,
              customerCode: checkCustomer.id,
              billFor,
              createdBy: user._id,
              enteredAmount,
            })
          );
          if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

          if (!createBill) {
            return ReE(
              res,
              { message: "billing not created" },
              httpStatus.INTERNAL_SERVER_ERROR
            );
          }

          let updateCustomer;
          [err, updateCustomer] = await toAwait(
            Customer.updateOne({ _id: customerId }, { $inc: { balanceAmount: Number(enteredAmount) } })
          );
          if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
          if (!updateCustomer) {
            return ReE(
              res,
              { message: "customer not updated" },
              httpStatus.INTERNAL_SERVER_ERROR
            );
          }

          createBill = createBill as IBilling

          let getCommission = await convertCommissionToMarketer(checkCustomer, enteredAmount)

          if (!getCommission.success) return ReE(res, { message: getCommission.message }, httpStatus.INTERNAL_SERVER_ERROR);

          let createCommission;
          [err, createCommission] = await toAwait(
            CustomerEmiModel.create({
              bill: createBill?._id,
              customer: customerId,
              emiId: null,
              amount: enteredAmount,
              marketer: getCommission.data
            })
          );

          if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

          if (!createCommission) {
            return ReE(
              res,
              { message: "commission not created" },
              httpStatus.INTERNAL_SERVER_ERROR
            );
          }

          return ReS(res, { message: "billing created successfully" }, httpStatus.OK);
        }
      }

      let unPaidTotal = getAllEmiPast.reduce((acc, curr) => acc + curr.emiAmt, 0);
      unPaidTotal = unPaidTotal as number;

      if (!housing) {
        let validAmount = validateEmiPayment(amount, getAllEmiPast[0].emiAmt, unPaidTotal);

        if (validAmount.valid === false) {
          return ReE(
            res,
            { message: validAmount.message },
            httpStatus.BAD_REQUEST
          );
        }
      }

      let noOfEmiPay = amount / getAllEmiPast[0].emiAmt;

      noOfEmiPay = Math.floor(noOfEmiPay);

      readyForBill = getAllEmiPast.slice(0, noOfEmiPay);

      if (housing) {
        customerBalanceAmount = Number(amount) - (getAllEmiPast[0].emiAmt * noOfEmiPay)
        amount = getAllEmiPast[0].emiAmt * noOfEmiPay
      }

    }

    if (!user?.isAdmin) {
      if (billFor !== "current") {

        let checkBillingRequest: any;
        [err, checkBillingRequest] = await toAwait(
          BillingRequest.findOne({ userId: user._id, requestFor: "create", customerId: customerId, status: "pending" })
        );

        if (err) {
          return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        }

        if (checkBillingRequest) {
          checkBillingRequest = checkBillingRequest as IBillingRequest;

          let allreadyExist = readyForBill.filter((emi) => checkBillingRequest.emi.includes(emi._id));

          if (allreadyExist.length !== 0) {
            return ReE(
              res,
              { message: "You already have pending billing request for existing EMIs" },
              httpStatus.BAD_REQUEST
            );
          }

        }

        let createBillRequest;
        [err, createBillRequest] = await toAwait(
          BillingRequest.create({
            status: "pending",
            userId: user._id,
            message: `Billing creation Request from  ${user.name} for ${readyForBill.length} EMIs`,
            requestFor: "create",
            customerId: customerId,
            emi: readyForBill.map((emi) => emi._id),
            billingDetails: {
              saleType: saleType,
              modeOfPayment,
              paymentDate,
              cardHolderName,
              remarks,
              cardNo,
              referenceId,
              billFor,
              customerBalanceAmount: customerBalanceAmount,
              housing,
              enteredAmount,
              parciallyPaid: false
            },
          })
        );

        if (err) {
          return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        }

        if (!createBillRequest) {
          return ReE(res, { message: "Failed to create billing request" }, httpStatus.INTERNAL_SERVER_ERROR);
        }

        ReS(
          res,
          { message: "Billing request created successfully" },
          httpStatus.OK
        );

        createBillRequest = createBillRequest as IBillingRequest;

        if (!createBillRequest) return;

        if (!createBillRequest._id) return;

        let send = await sendPushNotificationToSuperAdmin("Billing create request", `Billing creation Request from  ${user.name} for ${readyForBill.length} EMIs`, createBillRequest._id.toString())

        if (!send.success) {
          return console.log(send.message);
        }

        return console.log("Edit request push notification sent.");

      }
    }

    let noOFPay = amount / readyForBill[0].emiAmt;
    amount = amount / noOFPay;

    for (let i = 0; i < readyForBill.length; i++) {
      let element = readyForBill[i];

      let getAllBill;
      [err, getAllBill] = await toAwait(
        Billing.find({
          customer: customerId,
          general: checkGeneral._id,
        })
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

      let createBill: any = {
        emiNo: element.emiNo,
        amountPaid: amount,
        paymentDate: new Date(paymentDate),
        transactionType: "EMI Receipt",
        saleType,
        introducer: checkCustomer?.cedId || checkCustomer?.ddId,
        introducerByModel: checkCustomer?.cedId ? "MarketDetail" : "MarketingHead",
        status,
        modeOfPayment,
        referenceId,
        mobileNo: checkCustomer.phone,
        cardNo,
        customer: customerId,
        general: checkGeneral._id,
        cardHolderName,
        remarks,
        customerName: checkCustomer.name,
        balanceAmount: isNaN(balanceAmount) ? 0 : balanceAmount,
        emi: element._id,
        oldData: checkCustomer.oldData,
        customerCode: checkCustomer.id,
        billFor,
        createdBy: user._id,
        enteredAmount
      };

      if (housing) {
        if (i === 0) {
          createBill.emiCover = readyForBill.map((emi) => emi._id)
          let updateEmis;
          [err, updateEmis] = await toAwait(
            Emi.updateMany(
              { _id: { $in: createBill.emiCover } },
              { $set: { paidDate: new Date(paymentDate) } }
            )
          )

          if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

          if (!updateEmis) {
            return ReE(res, { message: "Failed to update emis" }, httpStatus.INTERNAL_SERVER_ERROR);
          }

        } else {
          continue;
        }
      }

      let checkAlreadyExist;
      [err, checkAlreadyExist] = await toAwait(Billing.findOne({
        emiNo: element.emiNo,
        customer: customerId
      }));

      if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

      if (checkAlreadyExist && !housing) {
        checkAlreadyExist = checkAlreadyExist as IBilling
        let updateEmiPaid;
        [err, updateEmiPaid] = await toAwait(
          Emi.updateOne(
            { _id: checkAlreadyExist?.emi },
            { $set: { paidDate: checkAlreadyExist?.paymentDate, paidAmt: checkAlreadyExist.amountPaid } }
          )
        )
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        let getEmi;
        [err, getEmi] = await toAwait(Emi.findOne({ _id: checkAlreadyExist?.emi }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        getEmi = getEmi as IEmi
        if (getEmi?.paidDate) {
          if (i === readyForBill.length - 1) {
            return ReS(res, { message: `billing already exist for this emi no ${readyForBill.map(element => element.emiNo)} for this customer, please try again!` }, httpStatus.BAD_REQUEST);
          }
          // return ReE(res, { message: `billing already exist for this emi no ${element.emiNo} for this customer please try again!` }, httpStatus.BAD_REQUEST);
        }
        // return ReE(res, { message: `billing already exist for this emi no ${element.emiNo} for this customer please try again!` }, httpStatus.BAD_REQUEST);
      } else {

        if(i !== 0 && housing) continue

        let billing;
        [err, billing] = await toAwait(Billing.create(createBill));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

        billing = billing as IBilling;

        let getCommission = await convertCommissionToMarketer(checkCustomer, !housing ? amount : enteredAmount)

        if (!getCommission.success) return ReE(res, { message: getCommission.message }, httpStatus.INTERNAL_SERVER_ERROR);

        let createCommission;
        [err, createCommission] = await toAwait(
          CustomerEmiModel.create({
            bill: createBill?._id,
            customer: customerId,
            emiId: element?._id ? element._id : null,
            amount: !housing ? amount : enteredAmount,
            marketer: getCommission.data
          })
        );

        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

        if (!createCommission) {
          return ReE(
            res,
            { message: "commission not created" },
            httpStatus.INTERNAL_SERVER_ERROR
          );
        }

        if (!housing) {
          let updateEmi;
          [err, updateEmi] = await toAwait(
            Emi.findOneAndUpdate(
              { _id: element._id },
              { paidDate: billing.paymentDate, paidAmt: billing.amountPaid },
              { new: true }
            )
          );
          if (err) {
            return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
          }
        }

      }

    }

    let updateCustomerBalance;
    [err, updateCustomerBalance] = await toAwait(
      Customer.findOneAndUpdate(
        { _id: customerId },
        { $set: { balanceAmount: customerBalanceAmount } },
        { new: true }
      )
    );

    if (err) {
      return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    }


    return ReS(
      res,
      { message: "billing created successfully!" },
      httpStatus.OK
    );
  } catch (error) {
    return ReE(res, error, httpStatus.INTERNAL_SERVER_ERROR);
  }
};

export const updateBilling = async (req: CustomRequest, res: Response) => {
  try {
    let err, body = req.body, user = req.user, obj: any = {};
    let fields = ["status", "paymentDate", "modeOfPayment"];

    if (!user) return ReE(res, { message: "You are not access this api" }, httpStatus.UNAUTHORIZED);

    if (!user.isAdmin) return ReE(res, { message: "You are not access this api" }, httpStatus.UNAUTHORIZED);

    let inVaildFields = fields.filter((x) => !isNull(body[x]));
    if (inVaildFields.length === 0) {
      return ReE(
        res,
        { message: `Please enter any one field to update ${fields}!.` },
        httpStatus.BAD_REQUEST
      );
    }

    let { status, paymentDate, modeOfPayment, _id, cardNo, cardHolderName, remarks, referenceId } = body;

    if (!_id) {
      return ReE(res, { message: `_id is required!` }, httpStatus.BAD_REQUEST);
    }
    if (!mongoose.isValidObjectId(_id)) {
      return ReE(res, { message: `Invalid _id!` }, httpStatus.BAD_REQUEST);
    }

    if (status) {
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
        obj.status = status;
      }
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
      obj.modeOfPayment = modeOfPayment;
      if (obj.modeOfPayment !== "Cash") {
        if (!referenceId) {
          return ReE(res, { message: `referenceId is required!` }, httpStatus.BAD_REQUEST);
        }
        obj.referenceId = referenceId
      } else {
        obj.referenceId = null
      }
      if (obj.modeOfPayment === "Card") {
        if (!cardNo) {
          return ReE(res, { message: `cardNo is required!` }, httpStatus.BAD_REQUEST);
        }
        if (!cardHolderName) {
          return ReE(res, { message: `cardHolderName is required!` }, httpStatus.BAD_REQUEST);
        }
        obj.cardNo = cardNo;
        obj.cardHolderName = cardHolderName
      } else {
        obj.cardNo = null;
        obj.cardHolderName = null
      }
    }

    if (remarks) {
      obj.remarks = remarks
    }

    if (referenceId) {
      obj.referenceId = referenceId
    }

    if (paymentDate) {
      if (!isValidDate(paymentDate as string)) {
        return ReE(res, { message: "Invalid paymentDate format, valid format is (YYYY-MM-DD)!" }, httpStatus.BAD_REQUEST);
      }
      paymentDate = new Date(paymentDate);
      obj.paymentDate = paymentDate
    }

    let getBilling;
    [err, getBilling] = await toAwait(Billing.findOne({ _id: _id }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getBilling) {
      return ReE(
        res,
        { message: "billing not found given id" },
        httpStatus.NOT_FOUND
      );
    }

    getBilling = getBilling as IBilling

    let updateBilling;
    [err, updateBilling] = await toAwait(
      Billing.findOneAndUpdate(
        { _id: _id },
        { $set: obj },
        { new: true }
      )
    );
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    return ReS(
      res,
      { message: "billing updated successfully!" },
      httpStatus.OK
    );

  } catch (error) {
    return ReE(res, error, httpStatus.INTERNAL_SERVER_ERROR);
  }
}

export const deleteBilling = async (req: CustomRequest, res: Response) => {
  let err, { _id } = req.body, user = req.user as IUser;
  if (!_id) {
    return ReE(res, { message: `billing _id is required!` }, httpStatus.BAD_REQUEST);
  }
  if (!mongoose.isValidObjectId(_id)) {
    return ReE(res, { message: `Invalid billing id!` }, httpStatus.BAD_REQUEST);
  }

  let getBilling;
  [err, getBilling] = await toAwait(Billing.findOne({ _id: _id }));
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!getBilling) {
    return ReE(
      res,
      { message: "billing not found given id" },
      httpStatus.NOT_FOUND
    );
  }

  getBilling = getBilling as IBilling

  let checkBillRequest;
  [err, checkBillRequest] = await toAwait(BillingRequest.findOne({ customerId: getBilling.customer, requestFor: "create", status: "pending" }));
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (checkBillRequest) {
    return ReE(res, { message: "create bill request already pending for this customer!" }, httpStatus.BAD_REQUEST);
  }

  if(!user.isAdmin){
    let createBillingRequest;
    [err, createBillingRequest] = await toAwait(BillingRequest.create({
      customerId: getBilling.customer,
      requestFor: "delete",
      status: "pending",
      createdBy: user._id,
      billId: getBilling._id
    }))
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!createBillingRequest) {
      return ReE(res, { message: "billing request not created!" }, httpStatus.INTERNAL_SERVER_ERROR);
    }
    return ReS(res, { message: "billing delete request created successfully!" }, httpStatus.OK);
  }

  let updateEmi;
  if(getBilling.emi){
    [err, updateEmi] = await toAwait(
      Emi.findOneAndUpdate(
        { _id: getBilling.emi },
        { $set: { paidAmt: 0, paidDate: null } },
        { new: true }
      )
    );
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!updateEmi) {
      return ReE(res, { message: "emi not found inside in billing" }, httpStatus.NOT_FOUND);
    }
  }
  if(getBilling.emiCover.length > 0){
    [err, updateEmi] = await toAwait(
      Emi.updateMany(
        { _id: { $in: getBilling.emiCover } },
        { $set: { paidAmt: 0, paidDate: null } },
        { new: true }
      )
    );
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!updateEmi) {
      return ReE(res, { message: "cover emi not found inside in billing" }, httpStatus.NOT_FOUND);
    }
  }

  let deleteBilling;
  [err, deleteBilling] = await toAwait(
    Billing.findOneAndDelete({ _id: _id })
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

  return ReS(
    res,
    { message: "billing deleted successfully!" },
    httpStatus.OK
  );

}

export const getAllDetailsByCustomerId = async (
  req: Request,
  res: Response
) => {
  let err;
  let { customerId, generalId } = req.query, option: any = {};

  if (customerId) {
    if (mongoose.isValidObjectId(customerId)) {
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
      getCustomer = getCustomer as ICustomer
      option.$or = [
        { _id: customerId },
        { id: getCustomer.id },
        { customerCode: getCustomer.id },
        { supplierCode: getCustomer.id },
        { customer: customerId }
      ]
    } else {
      option.$or = [
        { id: customerId },
        { customerCode: customerId },
        { supplierCode: customerId },
      ]
    }
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

  let getGeneral;
  [err, getGeneral] = await toAwait(
    General.find(option).populate("customer").populate("marketer").sort({ createdAt: -1 })
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
      .populate({
        path: "general",
        populate: [
          { path: "project" }
        ]
      })
      .populate("introducer")
      .populate("emi")
      .populate({
        path: "customer",
        populate: [
          { path: "cedId" },
          { path: "ddId" }
        ]
      })
      .populate("createdBy", "-password -fcmToken")
      .sort({ createdAt: -1 })
  );
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  data.billing = getAllBilling;

  return ReS(res, { message: "success", data: data }, httpStatus.OK);
};

export const getAllTypeBasedGenId = async (req: Request, res: Response) => {
  let err;
  let { customerId } = req.query, option: any = {};

  if (customerId) {
    if (mongoose.isValidObjectId(customerId)) {
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
      getCustomer = getCustomer as ICustomer
      option.$or = [
        { supplierCode: getCustomer.id },
        { customer: customerId }
      ]
    } else {
      option.supplierCode = customerId
    }
  }

  let getGeneral;
  [err, getGeneral] = await toAwait(General.find(option).populate("customer").populate("marketer").sort({ createdAt: -1 }));
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
      .populate("marketer").sort({ createdAt: -1 })
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
          .populate("general").sort({ createdAt: -1 })
      );
      if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
      [err, objFlat] = await toAwait(
        Flat.find({ general: general._id })
          .populate("customer")
          .populate("general").sort({ createdAt: -1 })
      );
      if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

      [err, objMarketer] = await toAwait(
        CustomerEmiModel.find({ customer: customerId })
          // .populate("customer")
          // .populate("generalId")
          // .populate("emiId")
          // .populate("marketerHeadId")
          // .populate("percentageId")
          .sort({ createdAt: -1 })
      );
      if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

      [err, objEmi] = await toAwait(
        Emi.find({ general: general._id })
          .populate("customer")
          .populate("general").sort({ createdAt: -1 })
      );
      if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

      [err, objBilling] = await toAwait(
        Billing.find({ general: general._id })
          .populate({
            path: "general",
            populate: [
              { path: "project" }
            ]
          })
          .populate("introducer")
          .populate("emi")
          .populate({
            path: "customer",
            populate: [
              { path: "cedId" },
              { path: "ddId" }
            ]
          })
          .populate("createdBy", "-password -fcmToken")
          .sort({ createdAt: -1 })
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

    // [err, objMarketer] = await toAwait(
    //   Marketer.find({ generalId: general._id })
    //     .populate("customer")
    //     .populate("generalId")
    //     .populate("emiId")
    //     .populate("marketerHeadId")
    //     .populate("percentageId")
    // );
    // if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    [err, objEmi] = await toAwait(
      Emi.find({ general: general._id })
        .populate("customer")
        .populate("general")
    );
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    [err, objBilling] = await toAwait(
      Billing.find({ general: general._id })
        .populate({
          path: "general",
          populate: [
            { path: "project" }
          ]
        })
        .populate("introducer")
        .populate("emi")
        .populate({
          path: "customer",
          populate: [
            { path: "cedId" },
            { path: "ddId" }
          ]
        })
        .populate("createdBy", "-password -fcmToken")
        .sort({ createdAt: -1 })
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


export const getAllBillingReport = async (req: CustomRequest, res: Response) => {
  let user = req.user as IUser;
  let err;

  let { dateFrom, dateTo, date, status, blocked } = req.query, option: any = {}, emiOption: any = {};

  if (status) {
    status = status as string;
    let validValue = ["paid", "unpaid", "blocked", "all"];
    status = status.toLowerCase().trim();
    if (!validValue.includes(status)) {
      return ReE(res, { message: `invalid status value in query valid value are (${validValue})` }, httpStatus.BAD_REQUEST)
    }
    if (status === "paid") {
      emiOption.paidDate = { $ne: null }
    } else if (status === "unpaid") {
      emiOption.paidDate = null
    } else if (status === "blocked") {
      option.status = "blocked"
      emiOption.status = "blocked"
    } else if (status === "all") {

    }
  }

  if (blocked) {
    let valid = ["true", "false"];
    blocked = blocked.toString().toLocaleLowerCase();
    if (!valid.includes(blocked)) {
      return ReE(
        res,
        { message: "blocked is invalid value valid value is true or false" },
        httpStatus.BAD_REQUEST
      );
    }
    if (blocked === "true") {
      option.status = "blocked"
      emiOption.status = "blocked"
    }
  }

  if (isNull(date as string) && isNull(dateFrom as string)) {
    return ReE(res, { message: "Please send date or dateFrom and dateTo in query" }, httpStatus.BAD_REQUEST);
  }

  if (!user) {
    return ReE(res, { message: "Unauthorized your not do this" }, httpStatus.UNAUTHORIZED);
  }

  if (dateFrom && !dateTo) {
    return ReE(res, { message: "If send dateFrom then dateTo is required" }, httpStatus.BAD_REQUEST);
  }

  if (dateTo && !dateFrom) {
    return ReE(res, { message: "if send dateTo then dateFrom is required" }, httpStatus.BAD_REQUEST);
  }

  if (dateFrom && dateTo) {
    dateFrom = dateFrom as string;
    dateTo = dateTo as string;
    if (!isValidDate(dateFrom)) {
      return ReE(res, { message: "Invalid date format for dateFrom valid format is (YYYY-MM-DD)!" }, httpStatus.BAD_REQUEST);
    }
    if (!isValidDate(dateTo)) {
      return ReE(res, { message: "Invalid date format for dateTo valid format is (YYYY-MM-DD)!" }, httpStatus.BAD_REQUEST);
    }
    option.paymentDate = { $gte: new Date(dateFrom), $lte: new Date(dateTo) };
    emiOption.date = { $gte: new Date(dateFrom), $lte: new Date(dateTo) };
  } else if (date) {
    date = date as string;
    if (!isValidDate(date)) {
      return ReE(res, { message: "Invalid date format for date valid format is (YYYY-MM-DD)!" }, httpStatus.BAD_REQUEST);
    }

    if (new Date(date).toDateString() !== new Date().toDateString()) {
      return ReE(res, { message: "Date must be today!" }, httpStatus.BAD_REQUEST);
    }

    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);

    option.paymentDate = {
      $gte: start,
      $lte: end
    }

    emiOption.date = {
      $gte: start,
      $lte: end
    };

  }

  date = date as string;

  if (isNull(date)) {
    if (!user.isAdmin) {
      let checkRequest;
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const end = new Date();
      end.setHours(23, 59, 59, 999);

      [err, checkRequest] = await toAwait(
        BillingRequest.findOne({
          userId: user._id,
          excelFromDate: new Date(dateFrom as string),
          excelToDate: new Date(dateTo as string),
          requestFor: "excel",
          createdAt: { $gte: start, $lte: end },
        }),
      );

      if (err) {
        return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
      }

      if (!checkRequest) {

        let createRequest;
        [err, createRequest] = await toAwait(
          BillingRequest.create({
            userId: user._id,
            status: "pending",
            message: `This user ${user._id} want to get billing report from ${dateFrom} to ${dateTo}`,
            requestFor: "excel",
            excelFromDate: new Date(dateFrom as string),
            excelToDate: new Date(dateTo as string)
          })
        )

        if (err) {
          return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        }

        if (!createRequest) {
          return ReE(res, { message: "Failed to create request" }, httpStatus.INTERNAL_SERVER_ERROR);
        }

        createRequest = createRequest as IBillingRequest;


        ReS(res, { message: "Request created successfully please wait for approval" }, httpStatus.OK);

        if (!createRequest._id) {
          return console.log("Billing request id not found, can't send push notification.");
        }

        let send = await sendPushNotificationToSuperAdmin("Billing request for some date", `This user ${user.name} want to get billing report from ${dateFrom} to ${dateTo}`, createRequest._id.toString())

        if (!send.success) {
          return console.log(send.message);
        }

        return console.log("Edit request push notification sent.");

      }

      checkRequest = checkRequest as IBillingRequest;

      if (checkRequest.status === "pending") {
        return ReE(res, { message: "Your billing request is not approved yet" }, httpStatus.UNAUTHORIZED);
      }
      if (checkRequest.status === "rejected") {
        return ReE(res, { message: "Your billing request is rejected please contact admin to approved" }, httpStatus.UNAUTHORIZED);
      }

      const approvedTime = checkRequest.approvedTime;

      if (!approvedTime) {
        return ReE(
          res,
          { message: "Approval time not found" },
          httpStatus.BAD_REQUEST
        );
      }

      // Convert stored time to moment
      const expiryTime = moment(new Date(approvedTime));

      // Current time
      const now = moment();

      // Check if expired
      if (now.isAfter(expiryTime)) {
        return ReE(res, { message: "Excel download request expired, please create new request on tommorrow or contact admin extend the validity" }, httpStatus.FORBIDDEN);
      }

    }
  }

  let getBilling: any = [];
  if (status !== "unpaid") {
    [err, getBilling] = await toAwait(
      Billing.find(option)
        .populate({
          path: "general",
          populate: [
            { path: "project" }
          ]
        })
        .populate("introducer")
        .populate("emi")
        .populate({
          path: "customer",
          populate: [
            { path: "cedId" },
            { path: "ddId" }
          ]
        })
        .populate("createdBy", "-password -fcmToken")
        .sort({ createdAt: -1 })
    );
  }

  if (err) {
    return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  }

  getBilling = getBilling as IBilling[];

  let getEmi;
  console.log(option)
  if (status === "unpaid" || status === "all") {
    [err, getEmi] = await toAwait(
      Emi.find(emiOption)
        .populate({
          path: "customer",
          populate: [
            { path: "cedId" },
            { path: "ddId" }
          ]
        })
        .populate({
          path: "general",
          populate: [
            { path: "project" }
          ]
        })
        .sort({ createdAt: -1 })
    )
  }

  if (err) {
    return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  }


  return ReS(res, { billing: getBilling, emi: getEmi }, httpStatus.OK);

};

export const convertCommissionToMarketer = async (customer: ICustomer | any, emiAmount: number) => {

  try {
    let getHead, commision: any[] = [];
    if (customer.ddId) {
      getHead = await MarketingHead.findOne({ _id: customer.ddId }).populate("percentageId")

      if (!getHead) {
        return {
          success: false,
          message: "Customer inside dd id id not found",
          data: null
        }
      }

      getHead = getHead as any
      let comm: any = {
        marketerId: getHead._id,
        marketerModel: "MarketingHead",
        emiAmount: emiAmount,
      }
      if (!customer.cedId) {
        comm.commAmount = emiAmount * (Number(getHead.percentageId.rate.split("%")[0]) / 100)
        comm.percentage= getHead.percentageId.rate
      }else{
        comm.commAmount = emiAmount * (1 / 100)
        comm.percentage= "1%"
      }
      commision.push(comm)
    }

    let getMarketer;
    if (customer.cedId) {
      getMarketer = await MarketDetail.findOne({ _id: customer.cedId }).populate(
        "overAllHeadBy"
      ).populate({
        path: "overAllHeadBy",
        populate: [
          {
            path: "headBy",
            populate: { path: "percentageId" }
          }
        ]
      }).populate("percentageId")
      if (!getMarketer) {
        return {
          success: false,
          message: "Customer inside ced id id not found",
          data: null
        }
      }
      getMarketer = getMarketer as any

      // console.log(getMarketer.overAllHeadBy)

      for (let index = 0; index < getMarketer.overAllHeadBy.length; index++) {
        const element = getMarketer.overAllHeadBy[index];

        if(index === 0){
          continue;
        }

        let comm: any = {
          marketerId: element.headBy._id,
          marketerModel: "MarketDetail",
          emiAmount: emiAmount,
          commAmount : emiAmount * (Number(1) / 100),
          percentage : "1%"
        }
        // console.log(comm,index)
        commision.push(comm)
      }
    }

    let comm:any={
      marketerId: getMarketer._id,
      marketerModel: "MarketDetail",
      emiAmount: emiAmount,
    }
    console.log(getMarketer.percentageId)
    if(getMarketer.percentageId?.rate){
      if(!isNaN(emiAmount * (Number(getMarketer.percentageId.rate.split("%")[0]) / 100))){
        comm.commAmount = emiAmount * (Number(getMarketer.percentageId.rate.split("%")[0]) / 100)
        comm.percentage= getMarketer.percentageId.rate
      }
    }
    commision.push(comm)
    return {
      success: true,
      message: "Commission found",
      data: commision 
    }
  } catch (error:any) {
    return {
      success: false,
      message: error?.message,
      data: null
    }
  }
}