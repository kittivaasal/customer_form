import { Response } from "express";
import httpStatus from "http-status";
import moment from "moment-timezone";
import mongoose from "mongoose";

import { BillingRequest } from "../models/billingRequest.model";
import ActivityLogError from "../models/activityLogError.model";
import { Project } from "../models/project.model";
import { Customer } from "../models/customer.model";
import { ReportJob } from "../models/reportJob.model";
import { IBillingRequest } from "../type/billingRequest";
import { IActivityLog } from "../type/activityLog";
import { IUser } from "../type/user";
import CustomRequest from "../type/customRequest";
import { ReE, ReS, toAwait, isNull, isValidDate } from "../services/util.service";
import { addActivityLog, sendPushNotificationToSuperAdmin } from "./common";
import { processReportJob } from "../services/reportWorker.service";

// ─── Create Report Job ────────────────────────────────────────────────────────

export const createReportJob = async (req: CustomRequest, res: Response) => {
  const rawUser = req.user as any;
  const user = rawUser as IUser;

  if (!rawUser) {
    return ReE(res, { message: "Unauthorized" }, httpStatus.UNAUTHORIZED);
  }

  // Ensure we have a valid ObjectId for the user — never rely on IUser._id typing alone
  const userId: mongoose.Types.ObjectId | undefined = mongoose.isValidObjectId(rawUser._id)
    ? new mongoose.Types.ObjectId(rawUser._id.toString())
    : undefined;

  if (!userId) {
    return ReE(
      res,
      { message: "User session invalid — could not resolve user ID" },
      httpStatus.UNAUTHORIZED,
    );
  }

  let err: any;
  let { dateFrom, dateTo, date, status, blocked, projectId, customerId } = req.query;

  // ── Validate projectId ──
  if (projectId) {
    if (!mongoose.isValidObjectId(projectId)) {
      return ReE(res, { message: "Invalid project id" }, httpStatus.BAD_REQUEST);
    }
    let getProject;
    [err, getProject] = await toAwait(Project.findOne({ _id: projectId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getProject) {
      return ReE(res, { message: "Project not found for given id" }, httpStatus.NOT_FOUND);
    }
  }

  // ── Validate customerId ──
  if (customerId) {
    if (!mongoose.isValidObjectId(customerId)) {
      return ReE(res, { message: "Invalid customer id" }, httpStatus.BAD_REQUEST);
    }
    let getCustomer;
    [err, getCustomer] = await toAwait(Customer.findOne({ _id: customerId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getCustomer) {
      return ReE(res, { message: "Customer not found for given id" }, httpStatus.NOT_FOUND);
    }
  }

  // ── Validate status ──
  if (status) {
    status = status as string;
    const validStatus = ["paid", "unpaid", "blocked", "all"];
    status = status.toLowerCase().trim();
    if (!validStatus.includes(status)) {
      return ReE(
        res,
        { message: `invalid status value. Valid values: (${validStatus})` },
        httpStatus.BAD_REQUEST,
      );
    }
  }

  // ── Require at least one date param ──
  if (isNull(date as string) && isNull(dateFrom as string)) {
    return ReE(
      res,
      { message: "Please send date or dateFrom and dateTo in query" },
      httpStatus.BAD_REQUEST,
    );
  }

  // ── dateFrom/dateTo mutual requirement ──
  if (dateFrom && !dateTo) {
    return ReE(res, { message: "If send dateFrom then dateTo is required" }, httpStatus.BAD_REQUEST);
  }
  if (dateTo && !dateFrom) {
    return ReE(res, { message: "If send dateTo then dateFrom is required" }, httpStatus.BAD_REQUEST);
  }

  // ── Validate date formats ──
  if (dateFrom && dateTo) {
    dateFrom = dateFrom as string;
    dateTo = dateTo as string;
    if (!isValidDate(dateFrom)) {
      return ReE(
        res,
        { message: "Invalid date format for dateFrom. Valid format: (YYYY-MM-DD)" },
        httpStatus.BAD_REQUEST,
      );
    }
    if (!isValidDate(dateTo)) {
      return ReE(
        res,
        { message: "Invalid date format for dateTo. Valid format: (YYYY-MM-DD)" },
        httpStatus.BAD_REQUEST,
      );
    }
  }

  if (date) {
    date = date as string;
    if (!isValidDate(date)) {
      return ReE(
        res,
        { message: "Invalid date format for date. Valid format: (YYYY-MM-DD)" },
        httpStatus.BAD_REQUEST,
      );
    }
  }

  date = date as string;

  // ── BillingRequest approval gate (same as getAllBillingReport) ──
  let approvedBillingRequest: IBillingRequest | null = null;

  if (isNull(date)) {
    if (!user.isAdmin) {
      let checkRequest;
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      [err, checkRequest] = await toAwait(
        BillingRequest.findOne({
          userId: userId,
          excelFromDate: new Date(dateFrom as string),
          excelToDate: new Date(dateTo as string),
          requestFor: "excel",
          createdAt: { $gte: start, $lte: end },
        }),
      );
      if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

      let message = `This user ${user.name} want to get billing report `;
      if (!isNull(dateFrom as string) && !isNull(dateTo as string)) {
        message += `from ${dateFrom} to ${dateTo}`;
      } else if (!isNull(date as string)) {
        message += `for date ${date}`;
      }
      message += " at " + new Date().toLocaleString();

      if (!checkRequest) {
        // No request yet — create one and ask user to wait for approval
        let createRequest;
        [err, createRequest] = await toAwait(
          BillingRequest.create({
            userId: userId,
            status: "pending",
            message: message,
            requestFor: "excel",
            excelFromDate: new Date(dateFrom as string),
            excelToDate: new Date(dateTo as string),
          }),
        );
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!createRequest) {
          return ReE(res, { message: "Failed to create request" }, httpStatus.INTERNAL_SERVER_ERROR);
        }

        createRequest = createRequest as IBillingRequest;

        const logObj = {
          userId: userId,
          action: "BILLING REQUEST",
          billingRequestAction: "GET REPORT",
          collectionName: "Billing",
          documentId: createRequest._id,
          oldData: null,
          newData: null,
          createdBy: user._id,
          message: createRequest.message,
          date: new Date(),
        } as unknown as IActivityLog;

        const createLog = await addActivityLog(logObj);
        if (createLog.success === false) {
          await toAwait(
            ActivityLogError.create({ data: logObj, errorMsg: createLog.message, date: new Date() }),
          );
        }

        ReS(res, { message: "Request created successfully please wait for approval" }, httpStatus.OK);

        if (createRequest._id) {
          await sendPushNotificationToSuperAdmin(
            "Billing request for some date",
            `This user ${user.name} want to get billing report from ${dateFrom} to ${dateTo}`,
            createRequest._id.toString(),
          );
        }
        return;
      }

      checkRequest = checkRequest as IBillingRequest;

      if (checkRequest.status === "pending") {
        return ReE(res, { message: "Your billing request is not approved yet" }, httpStatus.UNAUTHORIZED);
      }
      if (checkRequest.status === "rejected") {
        return ReE(
          res,
          { message: "Your billing request is rejected please contact admin to approve" },
          httpStatus.UNAUTHORIZED,
        );
      }

      const approvedTime = checkRequest.approvedTime;
      if (!approvedTime) {
        return ReE(res, { message: "Approval time not found" }, httpStatus.BAD_REQUEST);
      }

      if (moment().isAfter(moment(new Date(approvedTime)))) {
        return ReE(
          res,
          {
            message:
              "Excel download request expired, please create new request tomorrow or contact admin to extend the validity",
          },
          httpStatus.FORBIDDEN,
        );
      }

      approvedBillingRequest = checkRequest;
    }
  }

  // ── Create the job ──
  let job;
  [err, job] = await toAwait(
    ReportJob.create({
      userId: userId,
      billingRequestId: approvedBillingRequest?._id ?? undefined,
      params: {
        dateFrom: dateFrom as string | undefined,
        dateTo: dateTo as string | undefined,
        date: date as string | undefined,
        status: status as string | undefined,
        blocked: blocked as string | undefined,
        projectId: projectId as string | undefined,
        customerId: customerId as string | undefined,
      },
      status: "queued",
    }),
  );

  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!job) {
    return ReE(res, { message: "Failed to create report job" }, httpStatus.INTERNAL_SERVER_ERROR);
  }

  const createdJob = job as any;

  // Fire-and-forget: start worker in background
  processReportJob(createdJob._id.toString()).catch((workerErr: any) => {
    console.error(`Unhandled error in processReportJob ${createdJob._id}:`, workerErr.message);
  });

  return ReS(
    res,
    {
      jobId: createdJob._id,
      message:
        "Report job queued. You will receive an email and push notification when your report is ready.",
    },
    httpStatus.OK,
  );
};

// ─── Get Job Status ───────────────────────────────────────────────────────────

export const getReportJobStatus = async (req: CustomRequest, res: Response) => {
  const user = req.user as IUser;

  if (!user) {
    return ReE(res, { message: "Unauthorized" }, httpStatus.UNAUTHORIZED);
  }

  const { jobId } = req.params;

  if (!mongoose.isValidObjectId(jobId)) {
    return ReE(res, { message: "Invalid job id" }, httpStatus.BAD_REQUEST);
  }

  let err: any, job: any;
  [err, job] = await toAwait(ReportJob.findById(jobId).lean());
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!job) {
    return ReE(res, { message: "Job not found" }, httpStatus.NOT_FOUND);
  }

  if (!user.isAdmin && job.userId.toString() !== (user._id ?? "").toString()) {
    return ReE(res, { message: "Access denied" }, httpStatus.FORBIDDEN);
  }

  return ReS(
    res,
    {
      jobId: job._id,
      status: job.status,
      fileUrl: job.fileUrl ?? null,
      errorMessage: job.errorMessage ?? null,
      createdAt: job.createdAt,
    },
    httpStatus.OK,
  );
};
