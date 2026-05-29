import express from "express";
import customerRoutes from "./routes/customer.routes";
import projectRoutes from "./routes/project.routes";
import modRoutes from "./routes/mod.routes";
import lfcRoutes from "./routes/lfc.routes";
import marketHead from './routes/marketingHead.routes'
import marketDetail from './routes/marketDetail.routes'
import mod from './routes/mod.routes'
import nvt from './routes/nvt.routes'
import role from './routes/role.routes'
import menu from './routes/menu.routes'
import roleMenu from './routes/roleMenu.routes'
import percentage from './routes/percentage.routes'
import common from './routes/common.routes'
import user from './routes/user.routes'
import logRoutes from './routes/log.routes'
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import plotBookingFormRoutes from "./routes/plotBookingForm.routes";
import lifeSacingRoutes from "./routes/lifeSaving.routes";
import billingRequestRoutes from "./routes/billingRequest.routes"
import editRequestRoutes from "./routes/editRequest.routes"
import { Emi } from "./models/emi.model";
import { General } from "./models/general.model";
import cron from "node-cron";
import { initializeFirebase } from './util/firebaseConfig';
import commissionRoutes from "./routes/commission.routes";
import customerDetailRoutes from "./routes/customerDetail.routes";
import reportJobRoutes from "./routes/reportJob.routes";
import { ReportJob } from "./models/reportJob.model";
import { processReportJob } from "./services/reportWorker.service";
import { Billing } from "./models/billing.model";
import { excelDateToJSDate, ReE, ReS, toAwait } from "./services/util.service";
import { Commission } from "./models/commision.model";
// import { convertCommissionToMarketer } from "./controllers/common.controller";
import httpStatus from "http-status";
import { Percentage } from "./models/percentage.model";
import { Customer } from "./models/customer.model";
import { ICustomer } from "./type/customer";
import { MarketDetail } from "./models/marketDetail.model";
import activityLogErrorModel from "./models/activityLogError.model";
import fs from "fs"
import cornRunModel from "./models/cornRun.model";

import Excel from "exceljs";
import { processBulkWrite } from "./controllers/common";
import { MarketingHead } from "./models/marketingHead.model";

const app = express();
app.use(express.json());
dotenv.config();
app.use(cors());

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

const port = process.env.PORT || 5005
const db = process.env.DBURL || "mongodb://localhost:27017/customer"
mongoose.connect(db).then(() => {
  console.log("Connected to MongoDB")
}).catch((error: any) => {
  console.log("Error connecting to MongoDB", error)
})

initializeFirebase();

app.use("/api/customer", customerRoutes);
app.use("/api/project", projectRoutes);
app.use("/api/mod", modRoutes);
app.use("/api/lfc", lfcRoutes);
app.use("/api/market/head", marketHead);
app.use("/api/market/detail", marketDetail);
app.use("/api/mod", mod);
app.use("/api/nvt", nvt);
app.use("/api/percentage", percentage);
app.use("/api/role", role);
app.use("/api/menu", menu);
app.use("/api/role/menu", roleMenu);
app.use("/api/user", user);
app.use("/api/common", common);
app.use("/api/housing/customer/form", plotBookingFormRoutes);
app.use("/api/alliance/customer/form", lifeSacingRoutes);
app.use("/api/billing/request", billingRequestRoutes);
app.use("/api/edit/request", editRequestRoutes);
app.use("/api/logs", logRoutes)
app.use("/api/commission", commissionRoutes)
app.use("/api/billing/report/job", reportJobRoutes)
app.use("/api/customer", customerDetailRoutes)

cron.schedule("00 01 * * *", async () => {
  console.log("Running cron job - EMI Block Check");

  try {
    const today = new Date();
    let err;

    let todayMonth = today.getMonth();
    let todayYear = today.getFullYear();

    let db = process.env.DBURL

    if (db?.includes("/housing")) {
      todayMonth = todayMonth - 1
    }

    let startOfMonth = new Date(Date.UTC(todayYear, todayMonth, 1));
    startOfMonth.setUTCHours(0, 0, 0, 0);

    let no = 1;

    let startPreviousMonth = new Date(Date.UTC(todayYear, todayMonth - no, 1));
    startPreviousMonth.setUTCHours(0, 0, 0, 0);

    let endPreviousMonth = new Date(Date.UTC(todayYear, todayMonth - (no - 1), 0));
    endPreviousMonth.setUTCHours(23, 59, 59, 999);

    const generalIds: any[] = await Emi.aggregate([
      {
        $match: {
          paidDate: null,
          date: {
            $gte: startPreviousMonth,
            $lte: endPreviousMonth
          },
          status: { $ne: "Blocked" }
        }
      },
      {
        $lookup: {
          from: "generals",
          localField: "general",
          foreignField: "_id",
          as: "general",
        }
      },
      {
        $unwind: "$general"
      },
      // {
      //   $match: {
      //     "general.status": { $ne: "Blocked" }
      //   }
      // },
      {
        $group: {
          _id: "$general._id",
          emiIds: { $push: "$_id" }
        }
      }
    ])

    let emiId: any[] = []
    let ids : any[] = []


    generalIds.map((item: any) => {
      if(item.emiIds && item.emiIds.length) {
        emiId.push(...item.emiIds);
      }
      ids.push(item._id);
    });

    let batchSize = 1000;

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      let update = await General.updateMany(
        {
          _id: { $in: batch },
          status: { $ne: "Blocked"}
        },
        {
          $set: { status: "Blocked", blockedDate: new Date() }
        }
      );
      console.log(`Processed batch ${i + batchSize}, matched ${update.matchedCount}, modified ${update.modifiedCount}`);
    }

    for (let i = 0; i < emiId.length; i += batchSize) {
      const batch = emiId.slice(i, i + batchSize);
      let update = await Emi.updateMany(
        {
          _id: { $in: batch },
          status: { $ne: "Blocked"}
        },
        {
          $set: { status: "Blocked", blockedDate: new Date() }
        }
      );
      console.log(`Processed EMI batch ${i + batchSize}, matched ${update.matchedCount}, modified ${update.modifiedCount}`);
    }

    let createCornRun;
    [err, createCornRun] = await toAwait(
      cornRunModel.create({
        runDate: new Date(),
        monthstart: startOfMonth,
        startDate: startPreviousMonth,
        endDate: endPreviousMonth,
        for: "ESTIMATE_BLOCK",
        generalIds: ids,
        emiIds: emiId,
        message: `Blocked ${emiId.length} EMIs and ${ids.length} generals`
      })
    );

  } catch (err: any) {
    const today = new Date();

    let todayMonth = today.getMonth();
    let todayYear = today.getFullYear();

    let db = process.env.DBURL

    if (db?.includes("/housing")) {
      todayMonth = todayMonth - 1
    }

    let no = 1;

    let startPreviousMonth = new Date(Date.UTC(todayYear, todayMonth - no, 1));
    startPreviousMonth.setUTCHours(0, 0, 0, 0);

    let endPreviousMonth = new Date(Date.UTC(todayYear, todayMonth - (no - 1), 0));
    endPreviousMonth.setUTCHours(23, 59, 59, 999);
    console.error("Error in cron job:", err.message);
    let createErrorLog, error;
    [error, createErrorLog] = await toAwait(
      activityLogErrorModel.create({
        data: null,
        date: new Date(),
        errorFor: "CRON_EMI_BLOCK",
        errorMsg: err.message,
        stack: err.stack,
      })
    );
    let createCornRun;
    [error, createCornRun] = await toAwait(
      cornRunModel.create({
        runDate: new Date(),
        for: "ESTIMATE_BLOCK",
        startDate: startPreviousMonth,
        endDate: endPreviousMonth,
        error: err.message,
        stack: err.stack,
        message: `Cron job failed with error: ${err.message}`
      })
    );
  }
});

// Recovery cron: every 5 minutes, pick up any report jobs that are stuck
// (queued or processing but older than 10 minutes — e.g. server restarted mid-run)
cron.schedule("*/5 * * * *", async () => {
  try {
    const stuckJobs = await ReportJob.find({
      status: { $in: ["queued", "processing"] },
      createdAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) },
    }).lean();

    for (const job of stuckJobs) {
      console.log(`Recovering stuck report job: ${job._id}`);
      processReportJob((job._id as any).toString()).catch((err: any) => {
        console.error(`Recovery failed for job ${job._id}:`, err.message);
      });
    }
  } catch (err: any) {
    console.error("Report job recovery cron error:", err.message);
  }
});

// //convert string DD-MM-YYYY to date
// function excelDateStrToJSDate(excelDate: any): any | null {
//   // already Date object
//   if (excelDate instanceof Date) {
//     return excelDate;
//   }

//   // Excel serial number
//   if (typeof excelDate === "number") {
//     const utc_days = Math.floor(excelDate - 25569);
//     const utc_value = utc_days * 86400;
//     return new Date(utc_value * 1000);
//   }

//   // String date
//   if (typeof excelDate === "string") {

//     const cleaned = excelDate.trim();

//     // dd-mm-yyyy OR dd/mm/yyyy
//     const parts = cleaned.split(/[-/]/);

//     if (parts.length === 3) {
//       const [day, month, year] = parts.map(Number);

//       if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
//         return new Date(Date.UTC(year, month - 1, day));
//       }
//     }

//     // fallback
//     const parsed = new Date(cleaned);

//     if (!isNaN(parsed.getTime())) {
//       return parsed;
//     }
//   }

//   if(typeof excelDate === "object"){
//     if(excelDate.result){
//       const cleaned = excelDate.result.trim();
//       // dd-mm-yyyy OR dd/mm/yyyy
//       const parts = cleaned.split(/[-/]/);

//       if (parts.length === 3) {
//         const [day, month, year] = parts.map(Number);

//         if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
//           return new Date(Date.UTC(year, month - 1, day));
//         }
//       }

//       // fallback
//       const parsed = new Date(cleaned);

//       console.log("Parsed date from object result:", parsed, "Original value:", excelDate);
//       if (!isNaN(parsed.getTime())) {
//         return parsed;
//       }
//     }
//   }

//   return null;
// }

// app.get("/markerHead-count", async (req, res) => {
//   try {
//     console.log("Starting marker head count process...");
//     // Path to Excel
//     const excelPath = "./src/uploads/housingbillold.xlsx";

//     let getAllBill = await Billing.find({}).lean();

//     console.log("Billing records loaded:", getAllBill.length);

//     const BillingMap = new Map<string, any>();
//     let count = 0;
//     for (const cust of getAllBill) {
//       if (cust.customerCode ) {
//         BillingMap.set(`${cust.customerCode}-${cust.emiNo}`, cust);
//       }else{
//         console.log("Billing record with missing customerCode or emiNo:", getAllBill);
//       }
//       count++;
//     }

//     console.log("Billing records loaded:", BillingMap.size, "Total records processed for map:", count);


//     // Output JSON path
//     const outputDir = "./src/uploads/generated";
//     if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });


//     // Use `as any` to bypass missing TS types
//     const workbook = new (Excel.stream.xlsx as any).WorkbookReader(excelPath, {
//       entries: "emit",
//       worksheets: "emit",
//       sharedStrings: "cache",
//       styles: "ignore",
//       hyperlinks: "ignore",
//     });

//     let bulkUpdateEmis:any = []
//     let bulkUpdateBill:any = []
//     let bulkUpdateComm:any = []
//     let strCount = 0;
//     let numCount = 0;

//     workbook.on("worksheet", (worksheet: any) => {
//       worksheet.on("row", (row: any) => {
//         if (row.number === 1) return;

//         // console.log("Processing row:", row.number);
       

//         const cus = row.getCell(1).value;
//         let emiNo = row.getCell(4).value;
//         let paidDate = row.getCell(3).value;

//         if (!cus || emiNo == null) return;

//         let findBill = BillingMap.get(`${cus.toString()}-${emiNo.toString()}`);

//         // console.log(`Looking for billing record with customerCode: ${cus.toString()} and emiNo: ${emiNo.toString()}`);

//         if(!findBill){
//           console.log(`No billing record found for customerCode: ${cus.toString()} and emiNo: ${emiNo.toString()}`);
//           return;
//         }

//         // console.log(paidDate, typeof paidDate);
//         if( typeof paidDate === "string" ){
//           strCount++;
//         }
//         if( typeof paidDate === "number" ){
//           numCount++;
//         }
//         paidDate = excelDateStrToJSDate(paidDate);

//         if(!paidDate){
//           console.log(`Invalid date for row ${row.number}:`, row.getCell(3).value)
//           // return;
//         }
//         // console.log(`Row ${row.number}: CustomerCode: ${cus.toString()}, EMI No: ${emiNo.toString()}, Paid Date: `, paidDate);

//         bulkUpdateBill.push({
//           updateOne: {
//             filter: { _id: findBill._id },
//             update: { $set: { 
//             paymentDate: paidDate , paymentDateUpdate: new Date()
//             } }
//           }
//         })

//         bulkUpdateComm.push({
//           updateOne: {
//             filter: { bill : findBill._id },
//             update: { $set: { paymentDate: paidDate , paymentDateUpdate: new Date() } }
//           }
//         })

//         bulkUpdateEmis.push({
//           updateOne: {
//             filter: { _id: findBill.emi },
//             update: { $set: { paidDate: paidDate , paidDateUpdate: new Date() } }
//           }
//         })

//         if(row.number % 50000 === 0){
//           console.log(`Processed ${row.number} rows... ${paidDate}`);
//         }

//       });
//     });

//     workbook.on("end", async () => {

//       console.log(`Excel processing completed. Total rows processed: ${strCount + numCount}, String dates: ${strCount}, Numeric dates: ${numCount}`);
//       console.log(`Bulk update completed. Bill updates: ${bulkUpdateBill.length}, EMI updates: ${bulkUpdateEmis.length}, Commission updates: ${bulkUpdateComm.length}`);
      
//       // const jsonPath = path.join(outputDir, `customer-count-old-${Date.now()}Housing.json`);
//       // // fs.writeFileSync(jsonPath, JSON.stringify(bulkUpdateEmis, null, 2));
//       // let jsonPath2 = path.join(outputDir, `customer-count-old-${Date.now()}bill.json`);
//       // fs.writeFileSync(jsonPath2, JSON.stringify(bulkUpdateBill, null, 2));
//       // let jsonPath3 = path.join(outputDir, `customer-count-old-${Date.now()}comm.json`);
//       // fs.writeFileSync(jsonPath3, JSON.stringify(bulkUpdateComm, null, 2));

//       // console.log("✅ EMI JSON generated at:", jsonPath);

//       // let batchSize = 1000;
//       try {
//         await Promise.all([
//           bulkUpdateBill.length && processBulkWrite(Billing, bulkUpdateBill, "Billing"),
//           bulkUpdateEmis.length && processBulkWrite(Emi, bulkUpdateEmis, "EMI"),
//           bulkUpdateComm.length && processBulkWrite(Commission, bulkUpdateComm, "Commission")
//         ]);
//       } catch (err) {
//         return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
//       }
//       // if (bulkUpdateBill.length) {
//       //   for (let i = 0; i < bulkUpdateBill.length; i += batchSize) {
//       //     const batch = bulkUpdateBill.slice(i, i + batchSize);
//       //     let update = await Billing.bulkWrite(batch);
//       //     console.log(`Processed batch ${i + batchSize}, matched ${update.matchedCount}, modified ${update.modifiedCount}`);
//       //   }
//       // }

//       //   if (bulkUpdateComm.length) {
//       //     for (let i = 0; i < bulkUpdateComm.length; i += batchSize) {
//       //       const batch = bulkUpdateComm.slice(i, i + batchSize);
//       //       let update = await Commission.bulkWrite(batch);
//       //       console.log(`Processed batch ${i + batchSize}, matched ${update.matchedCount}, modified ${update.modifiedCount}`);
//       //     }
//       //   }
        
//       // if (bulkUpdateEmis.length) {
//       //   for (let i = 0; i < bulkUpdateEmis.length; i += batchSize) {
//       //     const batch = bulkUpdateEmis.slice(i, i + batchSize);
//       //     let update = await Emi.bulkWrite(batch);
//       //     console.log(`Processed batch ${i + batchSize}, matched ${update.matchedCount}, modified ${update.modifiedCount}`);
//       //   }
//       // }
//       // Send response with path
//       res.status(200).json({
//         success: true,
//         // file: jsonPath,
//         bulkUpdateComm:bulkUpdateComm.length,
//         bulkUpdateEmis:bulkUpdateEmis.length,
//         bulkUpdateBill:bulkUpdateBill.length
//       });
//     });

//     workbook.on("error", (err: any) => {
//       console.error("Excel read error:", err);
//       res.status(500).json({
//         success: false,
//         message: "Failed to read Excel file",
//       });
//     });

//     await workbook.read();
//   } catch (err) {
//     console.error("Server error:", err);
//     res.status(500).json({
//       success: false,
//       message: "Internal server error",
//     });
//   }
// });

// app.get("/test", async (req, res) => {
//   try {
//     let getAllBill = await MarketDetail.find({_id:"6987381f501d2fd4dd18b0f2"}) .populate("overAllHeadBy")
//         .populate({
//           path: "overAllHeadBy",
//           populate: [
//             {
//               path: "headBy",
//               populate: { path: "percentageId" },
//             },
//           ],
//         })
//         .populate("percentageId");
//     // console.log("Billing records loaded:", getAllBill);
//     res.json({
//       success: true,
//       data: getAllBill
//     });
    
//   } catch (err) {
//     console.error("Server error:", err);
//     res.status(500).json({
//       success: false,
//       message: "Internal server error",
//     });
//   }
// })

// export const convertCommissionToMarketer = (
//   customer: any,
//   emiAmount: number,
//   headMap: Map<string, any>,
//   detailMap: Map<string, any>
// ) => {

//   try {

//     let commission: any[] = [];

//     // =========================
//     // CUSTOMER VALIDATION
//     // =========================

//     if (!customer) {
//       return {
//         success: false,
//         message: "Customer not found",
//         data: null,
//       };
//     }

//     if (!customer.ddId) {
//       return {
//         success: false,
//         message: "Customer ddId not found",
//         data: null,
//       };
//     }

//     // =========================
//     // DD COMMISSION
//     // =========================

//     const getHead = headMap.get(customer.ddId.toString());

//     if (!getHead) {
//       return {
//         success: false,
//         message: "DD not found",
//         data: null,
//       };
//     }

//     let ddCommission: any = {
//       marketerId: getHead._id,
//       marketerModel: "MarketingHead",
//       emiAmount: emiAmount,
//     };

//     // SAME DD + CED

//     if (
//       !customer.cedId ||
//       customer.cedId?.toString() === customer.ddId?.toString()
//     ) {

//       const rate =
//         Number(
//           getHead?.percentageId?.rate?.split("%")[0]
//         ) || 0;

//       ddCommission.commAmount = Math.round(
//         emiAmount * (rate / 100)
//       );

//       ddCommission.percentage =
//         getHead?.percentageId?.rate || "0%";

//       commission.push(ddCommission);

//       return {
//         success: true,
//         message: "success",
//         data: commission,
//       };
//     }

//     // DIFFERENT DD + CED

//     ddCommission.commAmount = Math.round(
//       emiAmount * (1 / 100)
//     );

//     ddCommission.percentage = "1%";

//     commission.push(ddCommission);

//     // =========================
//     // LOAD CED
//     // =========================

//     const getMarketer = detailMap.get(
//       customer.cedId.toString()
//     );

//     if (!getMarketer) {
//       return {
//         success: false,
//         message: "CED not found",
//         data: null,
//       };
//     }

//     // =========================
//     // OVERALL HEAD COMMISSION
//     // =========================

//     if (
//       Array.isArray(getMarketer.overAllHeadBy)
//     ) {

//       for (
//         let index = 1;
//         index < getMarketer.overAllHeadBy.length;
//         index++
//       ) {

//         const element =
//           getMarketer.overAllHeadBy[index];

//         if (!element?.headBy?._id) {
//           continue;
//         }

//         commission.push({
//           marketerId: element.headBy._id,
//           marketerModel: "MarketDetail",
//           emiAmount: emiAmount,
//           commAmount: Math.round(
//             emiAmount * (1 / 100)
//           ),
//           percentage: "1%",
//         });
//       }
//     }

//     // =========================
//     // FINAL CED COMMISSION
//     // =========================

//     let cedCommission: any = {
//       marketerId: getMarketer._id,
//       marketerModel: "MarketDetail",
//       emiAmount: emiAmount,
//     };

//     const cedRate =
//       Number(
//         getMarketer?.percentageId?.rate?.split("%")[0]
//       ) || 0;

//     cedCommission.commAmount = Math.round(
//       emiAmount * (cedRate / 100)
//     );

//     cedCommission.percentage =
//       getMarketer?.percentageId?.rate || "0%";

//     commission.push(cedCommission);

//     return {
//       success: true,
//       message: "Commission found",
//       data: commission,
//     };

//   } catch (error: any) {

//     return {
//       success: false,
//       message: error?.message || "Unknown error",
//       data: null,
//     };

//   }
// };

// app.get("/test1", async (req, res) => {
//   try {

//     console.log("Starting commission conversion process...");

//     // =========================
//     // LOAD BILLINGS
//     // =========================

//     let getAllBill = await Billing.find({
//       paymentDate: {
//         $gte: new Date("2026-01-01T00:00:00.000Z"),
//         $lte: new Date("2026-01-31T23:59:59.999Z"),
//       },
//       // _id:"69cca344f35f6fc381b034b6"
//     })
//       .select("customer amountPaid emi paymentDate")
//       .populate({
//         path: "customer",
//         select: "id ddId cedId",
//       })
//       .lean();

//     console.log("Billing records loaded:", getAllBill.length);

//     // =========================
//     // LOAD ALL MARKETING HEADS
//     // =========================

//     const allHeads = await MarketingHead.find({})
//       .select("_id percentageId")
//       .populate({
//         path: "percentageId",
//         select: "rate",
//       })
//       .lean();

//     const headMap = new Map<string, any>();

//     for (const item of allHeads) {
//       headMap.set(item._id.toString(), item);
//     }

//     console.log("Marketing heads loaded:", headMap.size);
//     let get = headMap.get("6986e3ec501d2fd4dd18b07a");
//     console.log("Sample head:", get);

//     // =========================
//     // LOAD ALL MARKET DETAILS
//     // =========================

//     const allMarketDetails = await MarketDetail.find({})
//       .select("_id percentageId overAllHeadBy")
//       .populate({
//         path: "percentageId",
//         select: "rate",
//       })
//       .populate({
//         path: "overAllHeadBy.headBy",
//         populate: {
//           path: "percentageId",
//           select: "rate",
//         },
//       })
//       .lean();

//     const detailMap = new Map<string, any>();

//     for (const item of allMarketDetails) {
//       detailMap.set(item._id.toString(), item);
//     }

//     console.log("Market details loaded:", detailMap.size, "with overall heads populated");

//     // =========================
//     // PROCESS COMMISSIONS
//     // =========================

//     let getCommissionArr: any[] = [];

//     let index = 0;

//     for (const bill of getAllBill) {

//       const getCommission = convertCommissionToMarketer(
//         bill.customer,
//         bill.amountPaid,
//         headMap,
//         detailMap
//       );
//       if (!getCommission.success) {
//         const customerInfo = bill.customer as any;
//         console.log(
//           "Failed bill:",
//           customerInfo?.ddId,
//           customerInfo?._id,
//           bill._id,
//           bill?.customerCode,
//           getCommission.message
//         );
//       } else {
//         getCommissionArr.push({
//           customer: bill.customer._id,
//           customerCode: bill.customer?.id,
//           bill: bill._id,
//           emiId: bill.emi._id,
//           paymentDate: bill.paymentDate,
//           amount: bill.amountPaid,
//           marketer: getCommission.data,
//         });
//       }

//       index++;

//       if (index % 1000 === 0) {
//         console.log(`Processed ${index} bills...`);
//       }
//     }

//     // =========================
//     // SAVE OUTPUT
//     // =========================

//     let outDirectory = path.join(__dirname, "../cronOutput");

//     if (!fs.existsSync(outDirectory)) {
//       fs.mkdirSync(outDirectory, { recursive: true });
//     }

//     const fileName = `commission_conversion_${Date.now()}.json`;

//     // fs.writeFileSync(
//     //   path.join(outDirectory, fileName),
//     //   JSON.stringify(getCommissionArr, null, 2)
//     // );

//     // let batchSize = 1000;
//     // for (let i = 0; i < getCommissionArr.length; i += batchSize) {
//     //   const batch = getCommissionArr.slice(i, i + batchSize);
//     //   let inserted = await Commission.insertMany(batch, { ordered: false });
//     //   console.log(`Inserted batch ${i + batchSize}, records: ${inserted.length}`);
//     // }

//     console.log("Completed successfully");

//     return res.json({
//       success: true,
//       totalBills: getAllBill.length,
//       totalCommission: getCommissionArr.length,
//       fileName,
//     });

//   } catch (err) {
//     console.error("Server error:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//     });

//   }
// });

// app.get("/test2", async (req, res) => {
//   try {

//     const cedIds = [
// "6987658d501d2fd4dd18b290",
// "69875f25501d2fd4dd18b209",
// "698765b2501d2fd4dd18b296",
// "69876483501d2fd4dd18b261",
// "69876483501d2fd4dd18b262",
// "69876483501d2fd4dd18b263",
// "6987658d501d2fd4dd18b291",
// "69875f25501d2fd4dd18b20b",
// "6989858815a20a131f0a1ce6",
// "69876483501d2fd4dd18b264",
// "6996a4b507b91ce8a2932d96",
// "69875937501d2fd4dd18b1b1",
// "69875f25501d2fd4dd18b20c",
// "6987650e501d2fd4dd18b282",
// "6987658d501d2fd4dd18b292",
// "69875f25501d2fd4dd18b20d",
// "69876483501d2fd4dd18b265",
// "69876483501d2fd4dd18b266",
// "6987650e501d2fd4dd18b284",
// "69875937501d2fd4dd18b1b3",
// "69875937501d2fd4dd18b1b5",
// "6987650e501d2fd4dd18b286",
// "69876483501d2fd4dd18b267",
// "69875937501d2fd4dd18b1b6",
// "69b692e5382e1ab1c2c037d2",
// "69875f25501d2fd4dd18b20e",
// "69875937501d2fd4dd18b1b7",
// "6987658d501d2fd4dd18b293"
// ].map(id => new mongoose.Types.ObjectId(id));

//     let getAllBill = await Billing.aggregate([
//       {
//         $match: {
//           paymentDate: {
//             $gte: new Date("2026-04-01T00:00:00.000Z"),
//             $lte: new Date("2026-04-30T23:59:59.999Z")
//           },
//         }
//       },
//       {
//         $lookup: {
//           from: "customers",
//           localField: "customer",
//           foreignField: "_id",
//           as: "customer"
//         }
//       },
//       {
//         $unwind: "$customer"
//       },
//       // {
//       //   $lookup: {
//       //     from: "marketingheads",
//       //     localField: "customer.ddId",
//       //     foreignField: "_id",
//       //     as: "customer.ddId"
//       //   }
//       // },
//       // {
//       //   $unwind: {
//       //     path: "$customer.ddId",
//       //     preserveNullAndEmptyArrays: true
//       //   }
//       // },
//       // {
//       //   $lookup: {
//       //     from: "marketingheads",
//       //     localField: "customer.cedId",
//       //     foreignField: "_id",
//       //     as: "customer.cedId"
//       //   }
//       // },
//       // {
//       //   $unwind: {
//       //     path: "$customer.cedId",
//       //     preserveNullAndEmptyArrays: true
//       //   }
//       // },
//       {
//         $match: {
//           "customer.ddId": new mongoose.Types.ObjectId("6986e3ec501d2fd4dd18b089"),
//           $or: [
//             { "customer.cedId": new mongoose.Types.ObjectId("6986e3ec501d2fd4dd18b089") },
//             { "customer.cedId": null }
//           ]
//           // "customer.cedId": { $in: cedIds }
//         }
//       },
//       // {
//       //   $group: {
//       //     _id: "$customer.ddId.name",
//       //     totalBills: { $sum: 1 },
//       //     totalAmount: { $sum: "$amount" }, // optional
//       //     // bills: { $push: "$$ROOT" } 
//       //   }
//       // },
//       // {
//       //   $sort: {
//       //     _id: 1
//       //   }
//       // }
//     ]);
//     let total = 0
//     getAllBill.forEach(item => {
//       total += item.amountPaid;
//     })
//     let id = getAllBill.map((c)=>c.customer?.id);
//     res.json({
//       success: true,
//       count: getAllBill.length,
//       total: total,
//       data: id
//     });

//   } catch (err) {
//     console.error("Server error:", err);

//     res.status(500).json({
//       success: false,
//       message: "Internal server error",
//     });
//   }
// });



app.listen(port, () => console.log("Server running on port " + port));