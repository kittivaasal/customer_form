import fs from "fs";
import os from "os";
import path from "path";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import ExcelJS from "exceljs";
import mongoose from "mongoose";

import { Billing } from "../models/billing.model";
import { Emi } from "../models/emi.model";
import { General } from "../models/general.model";
import { IReportJob, ReportJob } from "../models/reportJob.model";
import { User } from "../models/user.model";
import { s3 } from "./digitalOceanConfig";
import { sendReportReadyEmail } from "./email.service";
import { sendNotificationsToMultipleDevices } from "../util/firebaseNotificationService";

// ─── Column definitions ───────────────────────────────────────────────────────

const PAID_HEADERS = [
  "Project ID", "Project Name", "Project EMI Amt",
  "Customer Name", "Customer ID", "Customer Phone",
  "DD Name", "CED Name",
  "Payment Amount", "Booking ID", "Plot No", "EMI No",
  "Payment Date", "Pay Mode", "Reference ID", "Card Holder Name",
  "Sale Type", "Status", "Remarks", "Created By",
  "Total Amount", "Total Paid", "Total Balance",
];

const UNPAID_HEADERS = [
  "Project ID", "Project Name",
  "Customer Name", "Customer ID", "Phone",
  "CED Name", "CED ID", "DD Name", "DD ID",
  "EMI Amount", "EMI No", "Due Date",
  "Total Scheme Amount", "No. of Installments", "Sale Type",
  "Customer Status", "Supplier Code", "Overdue", "Status",
];

const BLOCKED_HEADERS = [
  "Project ID", "Project Name",
  "EMI Amount", "No. of Installments",
  "Customer Name", "Customer ID", "Customer Phone",
  "DD Name", "DD ID", "CED Name", "CED ID",
  "Sale Type", "Payment Terms", "Sale Booked Date",
  "Sales No", "Status", "Total Amount", "Created On",
];

// ─── Row mappers ──────────────────────────────────────────────────────────────

function mapBillingToRow(r: any, createdByName: string = ""): any[] {
  const project = r.general?.project ?? {};
  const customer = r.customer ?? {};
  const ddId = customer.ddId ?? {};
  const cedId = customer.cedId ?? {};

  return [
    project.id ?? "",
    project.projectName ?? "",
    r.general?.emiAmount ?? "",
    customer.name ?? r.customerName ?? "",
    r.customerCode ?? customer.id ?? "",
    r.mobileNo ?? customer.phone ?? "",
    ddId.name ?? "",
    cedId.name ?? "",
    r.enteredAmount ?? "",
    r.billingId ?? "",
    r.plotNo ?? "",
    r.emiNo ?? "",
    r.paymentDate ? new Date(r.paymentDate).toLocaleDateString("en-IN") : "",
    r.modeOfPayment ?? r.payMode ?? "",
    r.referenceId ?? "",
    r.cardHolderName ?? "",
    r.saleType ?? "",
    r.status ?? "",
    r.remarks ?? "",
    createdByName,
    r.totalAmount ?? "",
    r.totalPaid ?? "",
    r.totalBalance ?? "",
  ];
}

function mapEmiToRow(r: any): any[] {
  const project = r.general?.project ?? {};
  const customer = r.customer ?? {};
  const cedId = customer.cedId ?? {};
  const ddId = customer.ddId ?? {};
  const general = r.general ?? {};
  const dueDate = r.date ? new Date(r.date) : null;
  const overdue = dueDate ? (dueDate < new Date() ? "Overdue" : "Upcoming") : "";

  return [
    project.id ?? "",
    project.projectName ?? "",
    customer.name ?? r.customerName ?? "",
    r.customerCode ?? customer.id ?? "",
    customer.phone ?? "",
    cedId.name ?? "",
    cedId.id ?? cedId._id?.toString() ?? "",
    ddId.name ?? "",
    ddId.id ?? ddId._id?.toString() ?? "",
    r.emiAmt ?? "",
    r.emiNo ?? "",
    dueDate ? dueDate.toLocaleDateString("en-IN") : "",
    general.totalAmount ?? "",
    general.noOfInstallments ?? "",
    general.saleType ?? "",
    general.status ?? "",
    r.supplierCode ?? "",
    overdue,
    "Unpaid",
  ];
}

function mapGeneralToRow(r: any): any[] {
  const project = r.project ?? {};
  const customer = r.customer ?? {};
  const ddId = customer.ddId ?? {};
  const cedId = customer.cedId ?? {};

  return [
    project.id ?? "",
    project.projectName ?? "",
    r.emiAmount ?? "",
    r.noOfInstallments ?? "",
    customer.name ?? r.customerName ?? "",
    customer.id ?? r.sPartyCode ?? "",
    customer.phone ?? "",
    ddId.name ?? "",
    ddId.id ?? ddId._id?.toString() ?? "",
    cedId.name ?? "",
    cedId.id ?? cedId._id?.toString() ?? "",
    r.saleType ?? "",
    r.paymentTerms ?? "",
    r.sBookedDate ?? "",
    r.sSalesNo ?? "",
    r.status ?? "",
    r.totalAmount ?? "",
    r.createdOn ?? "",
  ];
}

// ─── Batch fetchers ───────────────────────────────────────────────────────────

async function fetchBillingBatched(
  option: Record<string, any>,
  sheet: any,
): Promise<void> {
  let lastId: mongoose.Types.ObjectId | null = null;

  while (true) {
    const filter = lastId ? { ...option, _id: { $gt: lastId } } : { ...option };

    // Do NOT populate createdBy inline — some records store a plain string name
    // (e.g. "PREETHIKHA") instead of an ObjectId, which causes a Mongoose CastError.
    // We resolve names separately below using only valid ObjectIds.
    const batch: any[] = await Billing.find(filter)
      .populate({ path: "general", populate: [{ path: "project" }] })
      .populate({ path: "customer", populate: [{ path: "cedId" }, { path: "ddId" }] })
      .sort({ _id: 1 })
      .limit(500)
      .lean();

    if (!batch.length) break;

    // Resolve createdBy names — only for records where createdBy is a valid ObjectId
    const validCreatedByIds = batch
      .map((r) => r.createdBy)
      .filter((id) => id && mongoose.isValidObjectId(id));

    const createdByUsers: any[] = validCreatedByIds.length
      ? await User.find({ _id: { $in: validCreatedByIds } }).select("_id name").lean()
      : [];

    const createdByMap: Record<string, string> = Object.fromEntries(
      createdByUsers.map((u: any) => [u._id.toString(), u.name ?? ""]),
    );

    for (const record of batch) {
      const createdByRaw = record.createdBy;
      // If it's a valid ObjectId → look up the name; otherwise use the raw string as-is
      const createdByName = mongoose.isValidObjectId(createdByRaw)
        ? (createdByMap[createdByRaw.toString()] ?? "")
        : (createdByRaw?.toString() ?? "");

      sheet.addRow(mapBillingToRow(record, createdByName)).commit();
    }

    lastId = batch[batch.length - 1]._id;
  }
}

async function fetchEmiBatched(
  emiOption: Record<string, any>,
  sheet: any,
): Promise<void> {
  let lastId: mongoose.Types.ObjectId | null = null;

  while (true) {
    const filter = lastId ? { ...emiOption, _id: { $gt: lastId } } : { ...emiOption };

    const batch: any[] = await Emi.find(filter)
      .populate({ path: "customer", populate: [{ path: "cedId" }, { path: "ddId" }] })
      .populate({ path: "general", populate: [{ path: "project" }] })
      .sort({ _id: 1 })
      .limit(500)
      .lean();

    if (!batch.length) break;

    for (const record of batch) {
      sheet.addRow(mapEmiToRow(record)).commit();
    }

    lastId = batch[batch.length - 1]._id;
  }
}

async function fetchGeneralBatched(
  generalOption: Record<string, any>,
  sheet: any,
): Promise<void> {
  let lastId: mongoose.Types.ObjectId | null = null;

  while (true) {
    const filter = lastId
      ? { ...generalOption, _id: { $gt: lastId } }
      : { ...generalOption };

    const batch: any[] = await General.find(filter)
      .populate("project")
      .populate({ path: "customer", populate: [{ path: "cedId" }, { path: "ddId" }] })
      .sort({ _id: 1 })
      .limit(500)
      .lean();

    if (!batch.length) break;

    for (const record of batch) {
      sheet.addRow(mapGeneralToRow(record)).commit();
    }

    lastId = batch[batch.length - 1]._id;
  }
}

// ─── Upload helper ────────────────────────────────────────────────────────────

async function uploadExcelToSpaces(filePath: string, key: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const BUCKET = process.env.DO_SPACES_BUCKET!;
  const CDN_URL = process.env.DO_SPACES_CDN!;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ACL: "public-read",
      ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );

  return `${CDN_URL}/${key}`;
}

// ─── Build filter objects (mirrors getAllBillingReport logic) ─────────────────

function buildFilters(params: IReportJob["params"]): {
  option: Record<string, any>;
  emiOption: Record<string, any>;
  generalOption: Record<string, any>;
} {
  const option: Record<string, any> = {};
  const emiOption: Record<string, any> = {};
  const generalOption: Record<string, any> = {};

  if (params.projectId) {
    option.projectId = params.projectId;
    emiOption.projectId = params.projectId;
  }

  if (params.customerId) {
    option.customer = params.customerId;
    emiOption.customer = params.customerId;
  }

  if (params.status === "paid") {
    option.paidDate = { $ne: null };
  } else if (params.status === "blocked") {
    generalOption.status = "blocked";
  }

  if (params.blocked === "true") {
    generalOption.status = "blocked";
  }

  if (params.dateFrom && params.dateTo) {
    const start = new Date(params.dateFrom);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(params.dateTo);
    end.setUTCHours(23, 59, 59, 999);

    option.paymentDate = { $gte: start, $lte: end };
    emiOption.date = { $gte: start, $lte: end };
  } else if (params.date) {
    const start = new Date(params.date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(params.date);
    end.setUTCHours(23, 59, 59, 999);

    option.paymentDate = { $gte: start, $lte: end };
    emiOption.date = { $gte: start, $lte: end };
  }

  if (params.status === "unpaid") {
    emiOption.paidDate = null;
  }

  return { option, emiOption, generalOption };
}

// ─── Main worker ──────────────────────────────────────────────────────────────

export const processReportJob = async (jobId: string): Promise<void> => {
  const tmpPath = path.join(os.tmpdir(), `report-${jobId}.xlsx`);

  try {
    const job = await ReportJob.findByIdAndUpdate(
      jobId,
      { status: "processing" },
      { new: true },
    ).lean();

    if (!job) {
      console.error(`ReportJob ${jobId} not found`);
      return;
    }

    const { option, emiOption, generalOption } = buildFilters(job.params);
    const status = job.params.status ?? "paid";

    // ExcelJS streaming writer — writes directly to disk row-by-row
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: tmpPath });

    // ── Paid sheet ──
    if (status !== "unpaid") {
      const paidSheet = workbook.addWorksheet("Paid");
      paidSheet.addRow(PAID_HEADERS).commit();
      await fetchBillingBatched(option, paidSheet);
      paidSheet.commit();
    }

    // ── Unpaid sheet ──
    if (status === "unpaid" || status === "all") {
      if (status === "unpaid") {
        emiOption.paidDate = null;
      }
      const unpaidSheet = workbook.addWorksheet("Unpaid");
      unpaidSheet.addRow(UNPAID_HEADERS).commit();
      await fetchEmiBatched(emiOption, unpaidSheet);
      unpaidSheet.commit();
    }

    // ── Blocked sheet ──
    if (status === "blocked" || status === "all") {
      if (status === "all") {
        generalOption.status = "blocked";
      }
      const blockedSheet = workbook.addWorksheet("Blocked");
      blockedSheet.addRow(BLOCKED_HEADERS).commit();
      await fetchGeneralBatched(generalOption, blockedSheet);
      blockedSheet.commit();
    }

    await workbook.commit();

    // Upload to DO Spaces
    const key = `reports/${job.userId}/${jobId}.xlsx`;
    const fileUrl = await uploadExcelToSpaces(tmpPath, key);

    // Notify user — guard against non-ObjectId userId values
    let user: any = null;
    if (mongoose.isValidObjectId(job.userId)) {
      user = await User.findById(job.userId).lean();
    } else {
      console.warn(`ReportJob ${jobId}: userId "${job.userId}" is not a valid ObjectId — skipping notification`);
    }
    if (user) {
      if (user.email) {
        try {
          await sendReportReadyEmail(user.email, user.name ?? "User", fileUrl, job.params);
        } catch (emailErr: any) {
          console.error("Report email failed:", emailErr.message);
        }
      }

      if (user.fcmToken?.length) {
        try {
          await sendNotificationsToMultipleDevices(
            user.fcmToken,
            "Billing Report Ready",
            `Your billing report is ready. Tap to download.`,
            jobId,
          );
        } catch (fcmErr: any) {
          console.error("Report FCM push failed:", fcmErr.message);
        }
      }
    }

    await ReportJob.findByIdAndUpdate(jobId, { status: "done", fileUrl });
    console.log(`ReportJob ${jobId} completed: ${fileUrl}`);
  } catch (err: any) {
    console.error(`ReportJob ${jobId} failed:`, err.message);
    await ReportJob.findByIdAndUpdate(jobId, {
      status: "failed",
      errorMessage: err.message,
    });
  } finally {
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  }
};
