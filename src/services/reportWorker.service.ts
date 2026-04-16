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

// ─── Column definitions (must match frontend Excel generation exactly) ────────

const PAID_HEADERS = [
  "Project ID", "Project Name",
  "Customer Name", "Customer ID", "Phone",
  "CED Name", "CED ID", "DD Name", "DD ID",
  "Status", "Payment Date", "Amount Paid",
  "Booking ID", "Billing Id", "Plot No", "EMI No",
  "Pay Mode", "Remarks", "Created By",
  "Total Amount", "Total Paid", "Total Balance",
];

const UNPAID_HEADERS = [
  "Project ID", "Project Name",
  "Customer Name", "Customer ID", "Phone",
  "CED Name", "CED ID", "DD Name", "DD ID",
  "EMI Amount", "EMI No", "Date", "Status",
];

const BLOCKED_HEADERS = [
  "Project ID", "Project Name", "Project EMI Amount",
  "Customer ID", "Customer Name", "Customer Phone",
  "DD Name", "CED Name",
];

// ─── Row mappers ──────────────────────────────────────────────────────────────

function mapBillingToRow(r: any, createdByName: string = ""): any[] {
  const project   = r.general?.project ?? {};
  const general   = r.general ?? {};
  const customer  = r.customer ?? {};
  const cedId     = customer.cedId ?? {};
  const ddId      = customer.ddId ?? {};

  // Project ID: shortName preferred (matches frontend)
  const projectId = project.shortName || project._id || "N/A";

  // Status: check general.paidStauts first, then billing status (matches frontend)
  const status = general.paidStauts || r.status || "Paid";

  // Payment date formatted YYYY-MM-DD (matches frontend formatDate)
  const paymentDate = r.paymentDate
    ? new Date(r.paymentDate).toISOString().split("T")[0]
    : "";

  // Total Amount from general (matches frontend: general.totalAmount || plotCost || calculated)
  const emiAmount = Number(general.emiAmount) || 0;
  const noOfInstallments = Number(general.noOfInstallments) || 0;
  const calculatedTotal = emiAmount * noOfInstallments;
  const totalAmount =
    general.totalAmount ||
    general.plotCost ||
    (calculatedTotal > 0 ? calculatedTotal : "");

  // Total Paid calculated (matches frontend: totalAmount - balanceAmount)
  const balanceAmount = Number(r.balanceAmount) || 0;
  const totalPaid = totalAmount ? Number(totalAmount) - balanceAmount : "";

  return [
    projectId,
    project.projectName ?? "",
    customer.name ?? r.customerName ?? "",
    r.customerCode ?? "",
    r.mobileNo ?? customer.phone ?? "",
    cedId.name ?? "",
    cedId.id ?? cedId._id?.toString() ?? "",
    ddId.name ?? "",
    ddId.id ?? ddId._id?.toString() ?? "",
    status,
    paymentDate,
    r.amountPaid ?? "",
    general._id?.toString() ?? "",        // Booking ID = general._id
    r._id?.toString() ?? "",              // Billing Id  = billing._id
    customer.plotNo ?? r.plotNo ?? "",    // Plot No from customer first
    r.emiNo ?? "",
    r.modeOfPayment ?? "",
    r.remarks ?? "",
    createdByName,
    totalAmount,
    totalPaid,
    r.balanceAmount ?? "",
  ];
}

function mapEmiToRow(r: any): any[] {
  const general  = r.general ?? {};
  const project  = general.project ?? {};
  const customer = r.customer ?? {};
  const cedId    = customer.cedId ?? {};
  const ddId     = customer.ddId ?? {};

  // Project ID: shortName preferred (matches frontend)
  const projectId =
    project.shortName || project._id || customer.projectId || "N/A";

  // Date formatted en-GB (matches frontend formatDate for unpaid)
  const date = r.date
    ? new Date(r.date).toLocaleDateString("en-GB")
    : "";

  return [
    projectId,
    project.projectName ?? "",
    customer.name ?? "",
    customer.id ?? "",                           // customer.id (string field, matches frontend)
    customer.phone ?? "",
    cedId.name ?? "",
    cedId.id ?? cedId._id?.toString() ?? "",
    ddId.name ?? "",
    ddId.id ?? ddId._id?.toString() ?? "",
    r.emiAmt ?? "",
    r.emiNo ?? "",
    date,
    "Unpaid",
  ];
}

function mapGeneralToRow(r: any): any[] {
  const project  = r.project ?? {};
  const customer = r.customer ?? {};
  const ddId     = customer.ddId ?? {};
  const cedId    = customer.cedId ?? {};

  // Project ID: project.id string field, fallback to _id (matches frontend)
  const projectId = project.id || project._id?.toString() || "";

  // Project EMI Amount from project (matches frontend: project.emiAmount)
  const projectEmiAmount = project.emiAmount ?? "";

  return [
    projectId,
    project.projectName ?? "",
    projectEmiAmount,
    customer.id ?? "",          // Customer ID before Customer Name (matches frontend)
    customer.name ?? "",
    customer.phone ?? "",
    ddId.name ?? "",
    cedId.name ?? "",
  ];
}

// ─── Batch fetchers ───────────────────────────────────────────────────────────

async function fetchBillingBatched(
  option: Record<string, any>,
  sheet: any,
): Promise<void> {
  let lastPaymentDate: Date | null = null;
  let lastId: mongoose.Types.ObjectId | null = null;

  while (true) {
    // Cursor pagination for descending paymentDate order:
    // After first batch, fetch records with an earlier paymentDate,
    // or same paymentDate but smaller _id (tie-break).
    const cursorFilter = lastPaymentDate
      ? {
          ...option,
          $or: [
            { paymentDate: { $lt: lastPaymentDate } },
            { paymentDate: lastPaymentDate, _id: { $lt: lastId } },
          ],
        }
      : { ...option };

    // Do NOT populate createdBy inline — some records store a plain string name
    // (e.g. "PREETHIKHA") instead of an ObjectId, which causes a Mongoose CastError.
    // We resolve names separately below using only valid ObjectIds.
    const batch: any[] = await Billing.find(cursorFilter)
      .populate({ path: "general", populate: [{ path: "project" }] })
      .populate({ path: "customer", populate: [{ path: "cedId" }, { path: "ddId" }] })
      .sort({ paymentDate: -1, _id: -1 })
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

    const last = batch[batch.length - 1];
    lastPaymentDate = last.paymentDate ? new Date(last.paymentDate) : null;
    lastId = last._id;

    // If the last record has no paymentDate, we can't paginate further safely — stop
    if (!lastPaymentDate) break;
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

  if (params.status === "blocked") {
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

  if (params.status === "paid") {
    emiOption.paidDate = { $ne: null };
  } else if (params.status === "unpaid") {
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
      try {
        await sendReportReadyEmail(user?.name ?? "User", fileUrl, job.params);
      } catch (emailErr: any) {
        console.error("Report email failed:", emailErr.message);
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
