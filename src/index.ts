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
import { ReE, ReS, toAwait } from "./services/util.service";
import { Commission } from "./models/commision.model";
import { convertCommissionToMarketer } from "./controllers/common.controller";
import httpStatus from "http-status";
import { Percentage } from "./models/percentage.model";
import { Customer } from "./models/customer.model";
import { ICustomer } from "./type/customer";
import { MarketDetail } from "./models/marketDetail.model";
import activityLogErrorModel from "./models/activityLogError.model";
import fs from "fs"
import cornRunModel from "./models/cornRun.model";

import Excel from "exceljs";

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


// app.get("/emi/test", async (req, res) => {
//   try {
//     const today = new Date();
//     let err;

//     let todayMonth = today.getMonth();
//     let todayYear = today.getFullYear();

//     let db = process.env.DBURL

//     if (db?.includes("/housing")) {
//       todayMonth = todayMonth - 1
//     }

//     let startOfMonth = new Date(Date.UTC(todayYear, todayMonth, 1));
//     startOfMonth.setUTCHours(0, 0, 0, 0);

//     let no = 1;

//     let startPreviousMonth = new Date(Date.UTC(todayYear, todayMonth - no, 1));
//     startPreviousMonth.setUTCHours(0, 0, 0, 0);

//     let endPreviousMonth = new Date(Date.UTC(todayYear, todayMonth - (no - 1), 0));
//     endPreviousMonth.setUTCHours(23, 59, 59, 999);

//     const generalIds: any[] = await Emi.aggregate([
//       {
//         $match: {
//           paidDate: null,
//           date: {
//             $gte: startPreviousMonth,
//             $lte: endPreviousMonth
//           },
//           status: { $ne: "Blocked" }
//         }
//       },
//       {
//         $lookup: {
//           from: "generals",
//           localField: "general",
//           foreignField: "_id",
//           as: "general",
//         }
//       },
//       {
//         $unwind: "$general"
//       },
//       {
//         $group: {
//           _id: "$general._id",
//           emiIds: { $push: "$_id" }
//         }
//       }
//     ])

//     let emiId: any[] = []
//     let ids : any[] = []

//     console.log("Generals to block:", generalIds.length,generalIds);
//     generalIds.map((item: any) => {
//       emiId.push(...item.emiIds);
//       ids.push(item._id);
//     });

//     let batchSize = 1000;

//     // console.log(new Date("2026-05-01"))

//     for (let i = 0; i < ids.length; i += batchSize) {
//       const batch = ids.slice(i, i + batchSize);
//       let update = await General.updateMany(
//         {
//           _id: { $in: batch },
//           status: { $ne: "Blocked"}
//         },
//         {
//           $set: { status: "Blocked", blockedDate: new Date("2026-05-01") }
//         }
//       );
//       console.log(`Processed batch ${i + batchSize}, matched ${update.matchedCount}, modified ${update.modifiedCount}`);
//     }

//     for (let i = 0; i < emiId.length; i += batchSize) {
//       const batch = emiId.slice(i, i + batchSize);
//       let update = await Emi.updateMany(
//         {
//           _id: { $in: batch },
//           status: { $ne: "Blocked"}
//         },
//         {
//           $set: { status: "Blocked", blockedDate: new Date("2026-05-01") }
//         }
//       );
//       console.log({
//           paidDate: null,
//           date: {
//             $gte: startPreviousMonth,
//             $lte: endPreviousMonth
//           },
//           status: { $ne: "Blocked" }
//         });
//     }
//     console.log({
//           paidDate: null,
//           date: {
//             $gte: startPreviousMonth,
//             $lte: endPreviousMonth
//           },
//           status: { $ne: "Blocked" }
//         })
// // console.log(`Would block ${emiId.length} EMIs and ${ids.length} generals based on criteria, startPreviousMonth: ${startPreviousMonth.toISOString()}, endPreviousMonth: ${endPreviousMonth.toISOString()}`);
//     res.json({
//       success: true,
//       message: `Blocked ${emiId.length} EMIs and ${ids.length} generals`
//     })

//   } catch (err: any) {

//       res.json({
//         success: false,
//         message: err.message
//       });
    
//   }
// })

// app.get("/emi/update", async (req, res) => {
//   try {

//     const today = new Date();
//     let err;

//     let todayMonth = today.getMonth();
//     let todayYear = today.getFullYear();

//     let db = process.env.DBURL

//     if (db?.includes("/housing")) {
//       todayMonth = todayMonth - 1
//     }

//     let no = 1;
//     if(db?.includes("/housing")) {
//       no = 2;
//     }

//     let startOfMonth = new Date(Date.UTC(todayYear, todayMonth, 1));
//     startOfMonth.setUTCHours(0, 0, 0, 0);
//     console.log("Start of month for EMI check:", startOfMonth.toISOString());
//     // let getAllUnpaidEmis1 = await Emi.find({ paidDate: null, date: { $lt: startOfMonth } }).populate("general").lean();

//     let getAllUnpaidEmis = await Emi.aggregate([
//       { $match: { paidDate: null, date: { $lt: startOfMonth } } }, 
//       { $sort: { emiNo: 1 } },
//       // { $lookup: { from: "generals", localField: "general", foreignField: "_id", as: "general" } },
//       // { $unwind: "$general" },
//       // { $match: { "general.status": { $ne: "Blocked" } } },
//       // { $group : { _id: "$general", emiIds: { $push: {_id:"$general._id", emiNo:"$emiNo", date:"$date"} } } },
//       { $group : { _id: "$general", emiIds: { $push: {_id:"$_id", emiNo:"$emiNo", date:"$date"} } } },
//     ]);

//     let bulkUpdateEmis:any = []
//     let bulkUpdateGenerals:any = []
//     for (let emi of getAllUnpaidEmis) {
//       if (emi.emiIds) {
//         for (let emiId of emi.emiIds) {
//           let date = emiId.date;
//           if (!date) continue;
//           let nextMonthStart = new Date(date);
//           let nextMonthStartDate = new Date(Date.UTC(nextMonthStart.getUTCFullYear(), nextMonthStart.getUTCMonth() + no, 1));
//           nextMonthStart.setUTCHours(0, 0, 0, 0);
//            bulkUpdateEmis.push({
//             updateOne: {
//               filter: { _id: emiId._id },
//               update: { $set: { status: "Blocked", blockedDate: nextMonthStartDate, date : date, blockedByScript: true } }
//             }
//           });
//         }
//         let emimin =  Math.min(...emi.emiIds.map((e: any) => e.emiNo));
//         let emiDate = emi.emiIds.find((e: any) => e.emiNo === emimin)?.date;
//         if (emiDate) {
//           let nextMonthStart = new Date(emiDate);
//           let nextMonthStartDate = new Date(Date.UTC(nextMonthStart.getUTCFullYear(), nextMonthStart.getUTCMonth() + no, 1));
//           nextMonthStart.setUTCHours(0, 0, 0, 0);
//            bulkUpdateGenerals.push({
//             updateOne: {
//               filter: { _id: emi._id },
//               update: { $set: { status: "Blocked", blockedDate: nextMonthStartDate, date : emiDate, emiNo : emimin, blockedByScript: true } }
//             }
//           });
//         }    
//       }
//     }

//     // let outDirectory = path.join(__dirname, "../cronOutput");
//     // if (!fs.existsSync(outDirectory)) {
//     //   fs.mkdirSync(outDirectory);
//     // }
//     // fs.writeFileSync(path.join(outDirectory, `blocked_emis_${Date.now()}.json`), JSON.stringify(bulkUpdateEmis, null, 2))
//     // fs.writeFileSync(path.join(outDirectory, `blocked_generals_${Date.now()}.json`), JSON.stringify(bulkUpdateGenerals, null, 2))
//     // fs.writeFileSync(path.join(outDirectory, `unpaid_emis_${Date.now()}.json`), JSON.stringify(getAllUnpaidEmis, null, 2))

//     let batchSize = 1000;
//     if (bulkUpdateEmis.length) {
//       for (let i = 0; i < bulkUpdateEmis.length; i += batchSize) {
//         const batch = bulkUpdateEmis.slice(i, i + batchSize);
//         let update = await Emi.bulkWrite(batch);
//         console.log(`Processed batch ${i + batchSize}, matched ${update.matchedCount}, modified ${update.modifiedCount}`);
//       }
//     }

//     if (bulkUpdateGenerals.length) {
//       for (let i = 0; i < bulkUpdateGenerals.length; i += batchSize) {
//         const batch = bulkUpdateGenerals.slice(i, i + batchSize);
//         let update = await General.bulkWrite(batch);
//         console.log(`Processed General batch ${i + batchSize}, matched ${update.matchedCount}, modified ${update.modifiedCount}`);
//       }
//     }

//     res.json({
//       success: true,// show sample of blocked generals
//       data: getAllUnpaidEmis.length,
//       emis: getAllUnpaidEmis.slice(0, 10) // show sample of blocked generals
//     })
//   } catch (err: any) {
//     console.error("Error in cron job:", err.message);
//     res.json({
//       success: false,
//       message: err.message
//     });
//   }
  
// })

// app.get("/emi/update", async (req, res) => {
//   try {

//   let id =[
//     "LSS-16-1426", "LSS-16-1427", "LSS-16-1428", "LSS-16-1429", "LSS-16-1430", "LSS-16-1431", "LSS-16-1432", "LSS-16-1433", "LSS-16-1434", "LSS-16-1435", "LSS-16-1436", "LSS-16-1437", "LSS-16-1438", "LSS-16-1439", "LSS-16-1440", "LSS-16-1441", "LSS-16-1442", "LSS-16-1443", "LSS-16-1444", "LSS-16-1445", "LSS-16-1759", "LSS-16-1760", "LSS-16-1762", "LSS-16-1357", "LSS-16-1358", "LSS-16-1359", "LSS-16-1360", "LSS-16-1458", "LSS-16-44780", "LSS-16-44779", "LSS-16-44778", "LSS-16-1836", "LSS-16-1837", "LSS-16-1839", "LSS-16-1840", "LSS-16-1841", "LSS-16-1842", "LSS-16-1843", "LSS-16-1844", "LSS-16-1845", "LSS-16-1846", "LSS-16-1847", "LSS-16-1848", "LSS-16-0593", "LSS-16-0594", "LSS-16-0595", "LSS-16-0596", "LSS-16-0597", "LSS-16-0598", "LSS-16-0599", "LSS-16-0600", "LSS-16-0601", "LSS-16-0602", "LSS-16-1779", "LSS-16-0429", "LSS-16-0430", "LSS-16-0431", "LSS-16-0432", "LSS-16-0433", "LSS-16-0434", "LSS-16-0435", "LSS-16-0436", "LSS-16-0437", "LSS-16-0438", "LSS-16-0439", "LSS-16-0440", "LSS-16-0441", "LSS-16-0442", "LSS-16-0443", "LSS-16-0444", "LSS-16-0445", "LSS-16-0446", "LSS-16-0447", "LSS-16-0448", "LSS-16-0730", "LSS-16-0731", "LSS-16-1356", "LSS-16-1361", "LSS-16-1265", "LSS-16-1266", "LSS-16-1267", "LSS-16-1268", "LSS-16-1698", "LSS-16-1700", "LSS-16-1747", "LSS-16-1748", "LSS-16-1749", "LSS-16-1750", "LSS-16-1751", "LSS-16-1702", "LSS-16-1704", "LSS-16-1709", "LSS-16-0155", "LSS-16-0020", "LSS-16-0021", "LSS-16-0582", "LSS-16-1393", "LSS-16-1394", "LSS-16-0580", "LSS-16-0581", "LSS-16-1669", "LSS-16-1670", "LSS-16-1797", "LSS-16-1798", "LSS-16-0055", "LSS-16-0491", "LSS-16-0508", "LSS-16-0006", "LSS-16-0007", "LSS-16-0008", "LSS-16-0009", "LSS-16-0010", "LSS-16-0011", "LSS-16-0012", "LSS-16-0013", "LSS-16-0014", "LSS-16-0015", "LSS-16-0016", "LSS-16-0017", "LSS-16-0018", "LSS-16-0022", "LSS-16-0023", "LSS-16-0024", "LSS-16-0025", "LSS-16-0026", "LSS-16-0027", "LSS-16-0028", "LSS-16-0029", "LSS-16-0030", "LSS-16-34122", "LSS-16-34121", "LSS-16-0622", "LSS-16-0793", "LSS-16-0965", "LSS-16-0966", "LSS-16-0970", "LSS-16-0972", "LSS-16-0973", "LSS-16-0974", "LSS-16-0975", "LSS-16-0976", "LSS-16-0977", "LSS-16-0978", "LSS-16-0979", "LSS-16-0980", "LSS-16-0981", "LSS-16-0982", "LSS-16-0983", "LSS-16-0984", "LSS-16-0985", "LSS-16-0986", "LSS-16-0987", "LSS-16-0988", "LSS-16-1082", "LSS-16-1084", "LSS-16-1085", "LSS-16-1087", "LSS-16-1088", "LSS-16-1160", "LSS-16-1162", "LSS-16-1164", "LSS-16-1166", "LSS-16-1167", "LSS-16-1169", "LSS-16-1171", "LSS-16-1172", "LSS-16-1174", "LSS-16-1175", "LSS-16-1176", "LSS-16-1177", "LSS-16-1178", "LSS-16-1179", "LSS-16-1180", "LSS-16-1181", "LSS-16-1182", "LSS-16-0937", "LSS-16-0938", "LSS-16-0939", "LSS-16-1774", "LSS-16-1775", "LSS-16-1776", "LSS-16-1777", "LSS-16-1778", "LSS-16-0225", "LSS-16-0671", "LSS-16-0672", "LSS-16-0673", "LSS-16-0674", "LSS-16-1221", "LSS-16-1223", "LSS-16-0235", "LSS-16-0236", "LSS-16-0237", "LSS-16-0578", "LSS-16-1494", "LSS-16-1495", "LSS-16-1496", "LSS-16-1656", "LSS-16-1657", "LSS-16-1658", "LSS-16-1659", "LSS-16-1660", "LSS-16-1678", "LSS-16-1679", "LSS-16-1680", "LSS-16-1681", "LSS-16-1682", "LSS-16-1871", "LSS-16-1873", "LSS-16-1874", "LSS-16-1875", "LSS-16-0659", "LSS-16-0660", "LSS-16-0661", "LSS-16-0662", "LSS-16-1466", "LSS-16-0045", "LSS-16-0046", "LSS-16-0047", "LSS-16-1325", "LSS-16-1550", "LSS-16-1597", "LSS-16-1611", "LSS-16-1612", "LSS-16-1613", "LSS-16-1477", "LSS-16-1478", "LSS-16-0663", "LSS-16-1457", "LSS-16-0064", "LSS-16-34255", "LSS-16-44207", "LSS-16-44224", "LSS-16-44225", "LSS-16-44211", "LSS-16-44231", "LSS-16-44213", "LSS-16-44214", "LSS-16-44215", "LSS-16-44216", "LSS-16-44217", "LSS-16-44229", "LSS-16-44219", "LSS-16-1340", "LSS-16-1341", "LSS-16-1343", "LSS-16-1344", "LSS-16-1345", "LSS-16-1346", "LSS-16-1347", "LSS-16-1348", "LSS-16-1349", "LSS-16-1342", "LSS-16-0640", "LSS-16-0683", "LSS-16-1598", "LSS-16-1599", "LSS-16-1601", "LSS-16-1602", "LSS-16-1603", "LSS-16-1604", "LSS-16-1605", "LSS-16-1606", "LSS-16-1607", "LSS-16-1608", "LSS-16-1609", "LSS-16-1610", "LSS-16-1769", "LSS-16-1046", "LSS-16-1048", "LSS-16-1055", "LSS-16-1056", "LSS-16-1058", "LSS-16-1059", "LSS-16-1600", "LSS-16-0657", "LSS-16-0861", "LSS-16-0862", "LSS-16-0863", "LSS-16-0864", "LSS-16-0865", "LSS-16-0866", "LSS-16-0872", "LSS-16-1117", "LSS-16-1118", "LSS-16-1120", "LSS-16-1121", "LSS-16-1132", "LSS-16-1661", "LSS-16-1808", "LSS-16-1809", "LSS-16-1810", "LSS-16-1811", "LSS-16-1812", "LSS-16-1813", "LSS-16-1814", "LSS-16-1815", "LSS-16-1816", "LSS-16-1817", "LSS-16-1818", "LSS-16-1819", "LSS-16-1820", "LSS-16-1821", "LSS-16-1823", "LSS-16-1824", "LSS-16-1825", "LSS-16-1826", "LSS-16-0817", "LSS-16-1806", "LSS-16-1736", "LSS-16-1737", "LSS-16-1142", "LSS-16-1147", "LSS-16-1150", "LSS-16-1152", "LSS-16-1194", "LSS-16-0291", "LSS-16-0292", "LSS-16-0293", "LSS-16-0294", "LSS-16-0295", "LSS-16-0296", "LSS-16-0297", "LSS-16-0298", "LSS-16-0299", "LSS-16-0300", "LSS-16-0161", "LSS-16-0310", "LSS-16-0311", "LSS-16-0312", "LSS-16-0313", "LSS-16-0314", "LSS-16-0315", "LSS-16-0316", "LSS-16-0317", "LSS-16-0318", "LSS-16-0319", "LSS-16-0320", "LSS-16-0321", "LSS-16-0322", "LSS-16-0323", "LSS-16-0324", "LSS-16-0325", "LSS-16-0326", "LSS-16-0327", "LSS-16-0328", "LSS-16-0329", "LSS-16-0330", "LSS-16-0331", "LSS-16-0332", "LSS-16-0333", "LSS-16-0334", "LSS-16-0335", "LSS-16-0336", "LSS-16-0337", "LSS-16-0338", "LSS-16-0340", "LSS-16-0341", "LSS-16-0342", "LSS-16-0343", "LSS-16-0344", "LSS-16-0345", "LSS-16-0346", "LSS-16-0348", "LSS-16-0349", "LSS-16-0350", "LSS-16-0250", "LSS-16-0795", "LSS-16-0796", "LSS-16-0797", "LSS-16-0798", "LSS-16-0799", "LSS-16-0800", "LSS-16-1755", "LSS-16-1756", "LSS-16-0494", "LSS-16-0495", "LSS-16-0497", "LSS-16-0498", "LSS-16-0499", "LSS-16-0500", "LSS-16-0501", "LSS-16-0502", "LSS-16-0503", "LSS-16-0505", "LSS-16-0506", "LSS-16-0509", "LSS-16-0511", "LSS-16-0512", "LSS-16-0513", "LSS-16-0514", "LSS-16-0515", "LSS-16-0516", "LSS-16-0517", "LSS-16-0518", "LSS-16-0061", "LSS-16-1803", "LSS-16-0059", "LSS-16-0060", "LSS-16-1800", "LSS-16-1467", "LSS-16-1505", "LSS-16-1506", "LSS-16-1507", "LSS-16-1508", "LSS-16-1557", "LSS-16-1558", "LSS-16-1560", "LSS-16-1685", "LSS-16-1688", "LSS-16-1752", "LSS-16-1767", "LSS-16-1802", "LSS-16-1691", "LSS-16-1588", "LSS-16-1614", "LSS-16-1615", "LSS-16-1616", "LSS-16-1617", "LSS-16-1618", "LSS-16-1619", "LSS-16-1620", "LSS-16-1621", "LSS-16-1622", "LSS-16-1623", "LSS-16-1624", "LSS-16-1625", "LSS-16-1626", "LSS-16-1627", "LSS-16-1628", "LSS-16-1629", "LSS-16-1630", "LSS-16-1631", "LSS-16-1632", "LSS-16-1633", "LSS-16-1634", "LSS-16-1635", "LSS-16-1636", "LSS-16-1637", "LSS-16-1253", "LSS-16-1254", "LSS-16-0921", "LSS-16-0922", "LSS-16-0923", "LSS-16-0924", "LSS-16-0925", "LSS-16-0926", "LSS-16-1195", "LSS-16-1206", "LSS-16-1207", "LSS-16-1255", "LSS-16-1256", "LSS-16-1257", "LSS-16-1258", "LSS-16-1259", "LSS-16-1004", "LSS-16-1005", "LSS-16-1006", "LSS-16-1007", "LSS-16-1008", "LSS-16-1009", "LSS-16-1010", "LSS-16-0246", "LSS-16-1288", "LSS-16-1643", "LSS-16-1644", "LSS-16-1642", "LSS-16-0092", "LSS-16-0908", "LSS-16-0619", "LSS-16-0413", "LSS-16-0618", "LSS-16-0401", "LSS-16-0467", "LSS-16-1638", "LSS-16-1780", "LSS-16-1781", "LSS-16-1782", "LSS-16-1783", "LSS-16-1784", "LSS-16-1785", "LSS-16-1786", "LSS-16-1787", "LSS-16-1788", "LSS-16-1796", "LSS-16-34134", "LSS-16-1249", "LSS-16-0510", "LSS-16-1562", "LSS-16-0153", "LSS-16-0154", "LSS-16-0048", "LSS-16-0049", "LSS-16-0087", "LSS-16-0995", "LSS-16-0996", "LSS-16-0997", "LSS-16-0998", "LSS-16-0999", "LSS-16-1000", "LSS-16-1459", "LSS-16-1460", "LSS-16-1462", "LSS-16-1463", "LSS-16-1464", "LSS-16-1491", "LSS-16-1486", "LSS-16-1488", "LSS-16-1489", "LSS-16-1490", "LSS-16-1492", "LSS-16-1867", "LSS-16-1868", "LSS-16-1869", "LSS-16-0404", "LSS-16-0405", "LSS-16-0406", "LSS-16-0407", "LSS-16-0409", "LSS-16-0411"
//   ]
    // let getUnPaid = await Emi.aggregate([
    //   {
    //     $match: {
    //       $or: [
    //         {paidDate: null},
    //         {paidDate: { $lte: new Date("2026-04-22T23:59:59.999Z")} }
    //       ],
    //       date: { $gte : new Date("2026-04-01T00:00:00.000Z"), $lte: new Date("2026-04-22T23:59:59.999Z") },
    //     }
    //   },
    //   {
    //     $lookup: {
    //       from: "generals",
    //       localField: "general",
    //       foreignField: "_id",
    //       as: "general"
    //     }
    //   },
    //   {
    //     $unwind: "$general"
    //   },
    //   {
    //     $match: {
    //       "general.percentage": "69733babf18754a9dfab1ba3"
    //     }
    //   },
    // ]);

    // console.log("Unpaid EMIs count:", getUnPaid.length);  

    // let getAllEmi = await Emi.find({customerCode:null}).populate("general").populate("customer").lean();

    // const emiMap = new Map<string, any>();
    // for (const e of getAllEmi) {
    //   if (e.emiNo && e.customer) {
    //     emiMap.set(`${e.customer._id.toString()}`, e);
    //   }
    // }

    // let bulkUpdateEmis:any = []
    // let bulkUpdateEmisNo:any = []

    // for (const e of getAllEmi) {
    //   let get = emiMap.get(`${e.customer?._id.toString()}`);
    //   let pro;
    //   if((e.general as any)?.project){
    //       pro = (e.general as any).project.toString();
    //   }else if((e.customer as any)?.projectId){
    //       pro = (e.customer as any).projectId.toString();
    //   }
    //   if(!pro){
    //     console.log("No project found for EMI:", e._id.toString());
    //   }
    //   if(!get){
    //     bulkUpdateEmisNo.push({
    //       e
    //     })
    //   }else{
    //     // console.log("Updating EMI:", e._id.toString(), "with customer code:", get.customer?.code, "and projectId:", pro);
    //     bulkUpdateEmis.push({
    //       updateOne: {
    //         filter: { _id: e._id },
    //         update: { $set: { customerCode: get.customer?.id , supplierCode: get.customer?.id , projectId: pro } }
    //       }
    //     });
    //   }
    // }

    // let batchSize = 1000;

    // if (bulkUpdateEmis.length) {
    //   for (let i = 0; i < bulkUpdateEmis.length; i += batchSize) {
    //     const batch = bulkUpdateEmis.slice(i, i + batchSize);
    //     let update = await Emi.bulkWrite(batch);
    //     console.log(`Processed batch ${i + batchSize}, matched ${update.matchedCount}, modified ${update.modifiedCount}`);
    //   }
    // }

    // let outDirectory = path.join(__dirname, "../cronOutput");
    // if (!fs.existsSync(outDirectory)) {
    //   fs.mkdirSync(outDirectory);
    // }
    // fs.writeFileSync(path.join(outDirectory, `all_emis_${Date.now()}.json`), JSON.stringify(getAllEmi, null, 2))
    // fs.writeFileSync(path.join(outDirectory, `bulk_update_emis_${Date.now()}.json`), JSON.stringify(bulkUpdateEmis, null, 2))
    // fs.writeFileSync(path.join(outDirectory, `bulk_update_emis_no_${Date.now()}.json`), JSON.stringify(bulkUpdateEmisNo, null, 2))

//     res.json({
//       success: true,// show sample of blocked generals
//       data: getAllEmi.length,
//       le:bulkUpdateEmis.length,
//       emis: bulkUpdateEmis.slice(0, 10) // show sample of blocked generals
//     })
//   } catch (err: any) {
//     console.error("Error in cron job:", err.message);
//     res.json({
//       success: false,
//       message: err.message
//     });
//   }
  
// })

// app.get("/test", async (req, res) => {
//   try {
//     const excelPath = "./src/uploads/customerHosing.xlsx";

//     // Output JSON path
//     const outputDir = "./src/uploads/generated";
//     if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

//     const jsonPath = path.join(outputDir, `customer-count-${Date.now()}Housing.json`);

//     // Use `as any` to bypass missing TS types
//     const workbook = new (Excel.stream.xlsx as any).WorkbookReader(excelPath, {
//       entries: "emit",
//       worksheets: "emit",
//       sharedStrings: "cache",
//       styles: "ignore",
//       hyperlinks: "ignore",
//     });

//     let getAllMarketer = await MarketDetail.find({});
//     // let pro = await Project.find({});
//     let markerter:any=[]

//     const MarketDetailMap = new Map<string, any>();
//     for (const cust of getAllMarketer) {
//       if (cust.id) {
//         MarketDetailMap.set(cust.id.toString(), cust);
//       }
//     }
//     // const proMap = new Map<string, any>();
//     // for (const cust of pro) {
//     //   if (cust.id) {
//     //     proMap.set(cust.id.toString(), cust);
//     //   }
//     // }

//     workbook.on("worksheet", (worksheet: any) => {
//       worksheet.on("row", (row: any) => {
//         if (row.number === 1) return;

//         console.log("Processing row:", row.number);

//         const ddid = row.getCell(16).value;

//         const salesNo = row.getCell(3).value;
//         const projectId = row.getCell(10).value;

//         if (!ddid || salesNo == null) return;

//         // let findMarket = getAllMarketer.find(cust => cust.id.toString() === ddid.toString());
//         let findMarket = MarketDetailMap.get(ddid.toString());
//         let findPro = proMap.get(projectId.toString());


//         let o = {
//           id: row.getCell(1).value,
//           name: row.getCell(2).value,
//           phone: row.getCell(3).value?.toString(),
//           address: row.getCell(5).value,
//           city: row.getCell(6).value,
//           state: row.getCell(7).value,
//           pincode: row.getCell(8).value,
//           email: row.getCell(9).value,]
//           project: findPro?._id,
//           ddId: findMarket?._id,
//           cedId: findMarket?.headBy,
//           createdBy: row.getCell(18).value
//         }

//         markerter.push(o)
//       });
//     });

//     workbook.on("end", () => {
//       // Write JSON file
//       fs.writeFileSync(jsonPath, JSON.stringify(markerter, null, 2));

//       console.log("✅ EMI JSON generated at:", jsonPath);

//       // Send response with path
//       res.status(200).json({
//         success: true,
//         file: jsonPath,
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
// })

// app.get("/markerHead-count", async (req, res) => {
//   try {

//     // Path to Excel
//     const excelPath = "./src/uploads/0404.xlsx";

//     let getAllBill = await Billing.find({}).lean();

//     const BillingMap = new Map<string, any>();
//     for (const cust of getAllBill) {
//       if (cust.customerCode ) {
//         BillingMap.set(`${cust.customerCode}-${cust.emiNo}`, cust);
//       }
//     }

//     console.log("Billing records loaded:", BillingMap.size);


//     // Output JSON path
//     const outputDir = "./src/uploads/generated";
//     if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

//     const jsonPath = path.join(outputDir, `customer-count-${Date.now()}Housing.json`);

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

//     workbook.on("worksheet", (worksheet: any) => {
//       worksheet.on("row", (row: any) => {
//         if (row.number === 1) return;

//         // console.log("Processing row:", row.number);

//         const cus = row.getCell(4).value;
//         let emiNo = row.getCell(14).value;

//         if (!cus || emiNo == null) return;

//         let findBill = BillingMap.get(`${cus.toString()}-${emiNo.toString()}`);

//         // console.log(`Looking for billing record with customerCode: ${cus.toString()} and emiNo: ${emiNo.toString()}`);

//         if(!findBill){
//           // console.log(`No billing record found for customerCode: ${cus.toString()} and emiNo: ${emiNo.toString()}`);
//           return;
//         }

//         bulkUpdateBill.push({
//           updateOne: {
//             filter: { _id: findBill._id },
//             update: { $set: { paymentDate: new Date("2026-02-04") } }
//           }
//         })

//         bulkUpdateComm.push({
//           updateOne: {
//             filter: { bill : findBill._id },
//             update: { $set: { paymentDate: new Date("2026-02-04") } }
//           }
//         })

//         bulkUpdateEmis.push({
//           updateOne: {
//             filter: { _id: findBill.emi },
//             update: { $set: { paidDate: new Date("2026-02-04") } }
//           }
//         })

//       });
//     });

//     workbook.on("end", async () => {
//       // fs.writeFileSync(jsonPath, JSON.stringify(bulkUpdateEmis, null, 2));
//       // let jsonPath2 = path.join(outputDir, `customer-count-${Date.now()}bill.json`);
//       // fs.writeFileSync(jsonPath2, JSON.stringify(bulkUpdateBill, null, 2));
//       // let jsonPath3 = path.join(outputDir, `customer-count-${Date.now()}comm.json`);
//       // fs.writeFileSync(jsonPath3, JSON.stringify(bulkUpdateComm, null, 2));

//       // console.log("✅ EMI JSON generated at:", jsonPath);

//       let batchSize = 1000;
//       if (bulkUpdateBill.length) {
//         for (let i = 0; i < bulkUpdateBill.length; i += batchSize) {
//           const batch = bulkUpdateBill.slice(i, i + batchSize);
//           let update = await Billing.bulkWrite(batch);
//           console.log(`Processed batch ${i + batchSize}, matched ${update.matchedCount}, modified ${update.modifiedCount}`);
//         }
//       }

//         if (bulkUpdateComm.length) {
//           for (let i = 0; i < bulkUpdateComm.length; i += batchSize) {
//             const batch = bulkUpdateComm.slice(i, i + batchSize);
//             let update = await Commission.bulkWrite(batch);
//             console.log(`Processed batch ${i + batchSize}, matched ${update.matchedCount}, modified ${update.modifiedCount}`);
//           }
//         }
        
//       if (bulkUpdateEmis.length) {
//         for (let i = 0; i < bulkUpdateEmis.length; i += batchSize) {
//           const batch = bulkUpdateEmis.slice(i, i + batchSize);
//           let update = await Emi.bulkWrite(batch);
//           console.log(`Processed batch ${i + batchSize}, matched ${update.matchedCount}, modified ${update.modifiedCount}`);
//         }
//       }

//       // Send response with path
//       res.status(200).json({
//         success: true,
//         file: jsonPath,
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


app.listen(port, () => console.log("Server running on port " + port));