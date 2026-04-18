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

    let todayMonth = today.getMonth();
    let todayYear = today.getFullYear();

    let db = process.env.DBURL

    if (db?.includes("/housing")) {
      todayMonth = todayMonth - 1
    }

    let startOfMonth = new Date(Date.UTC(todayYear, todayMonth, 1));
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const generalIds: any[] = await Emi.aggregate([
      {
        $match: {
          paidDate: null,
          date: { $lt: startOfMonth },
        },
      },
      {
        $lookup: {
          from: "generals", // collection name (check exact name)
          localField: "general",
          foreignField: "_id",
          as: "general",
        }
      },
      {
        $unwind: "$general"
      },
      {
        $match: {
          "general.status": { $ne: "Blocked" }
        }
      },
      {
        $group: {
          _id: "$general._id"
        }
      }
    ])

    let ids = generalIds.map((item: any) => item?._id);

    if (!ids.length) {
      return console.log("No generals to block");
    }

    let batchSize = 1000;

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      let update = await General.updateMany(
        {
          _id: { $in: batch },
          status: { $ne: "Blocked" }
        },
        {
          $set: { status: "Blocked" }
        }
      );
      console.log(`Processed batch ${i + batchSize}, matched ${update.matchedCount}, modified ${update.modifiedCount}`);
    }

    console.log(`Blocked generals count: ${generalIds.length}`);


  } catch (err: any) {
    console.error("Error in cron job:", err.message);
    let createErrorLog;
    [err, createErrorLog] = await toAwait(
      activityLogErrorModel.create({
        data: null,
        date: new Date(),
        errorFor: "CRON_EMI_BLOCK",
        errorMsg: err.message,
        stack: err.stack,
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

//     let todayMonth = today.getMonth();
//     let todayYear = today.getFullYear();

//     let dbU = process.env.DBURL

//     if (dbU?.includes("/housing")) {
//       todayMonth = todayMonth - 1
//     }

//     let startOfMonth = new Date(Date.UTC(todayYear, todayMonth, 1));
//     startOfMonth.setUTCHours(0, 0, 0, 0);

//     console.log(startOfMonth)

//     let db = process.env.DBURL

//     if (db?.includes("housing")) {
//       db = db.replace("housing", "customerform")
//     }

//     console.log(db)

//     const generalIds: any[] = await Emi.aggregate([
//       {
//         $match: {
//           date: { $lt: startOfMonth },
//           paidDate: null
//         },
//       },
//       {
//         $lookup: {
//           from: "generals", // collection name (check exact name)
//           localField: "general",
//           foreignField: "_id",
//           as: "general",
//         }
//       },
//       {
//         $unwind: "$general"
//       },
//       {
//         $match: {
//           "general.status": { $ne: "Blocked" }
//         }
//       },
//       {
//         $group: {
//           _id: "$general._id"
//         }
//       }
//     ])

//     let ids = generalIds.map((item: any) => item?._id);

//     // 🚀 Step 2: Block those generals (skip already blocked)
//     if (!ids.length) {
//       return console.log("No generals to block");
//     }

//     let batchSize = 1000;

//     for (let i = 0; i < ids.length; i += batchSize) {
//       const batch = ids.slice(i, i + batchSize);
//       let update = await General.updateMany(
//         {
//           _id: { $in: batch },
//           status: { $ne: "Blocked" }
//         },
//         {
//           $set: { status: "Blocked" }
//         }
//       );
//       console.log(`Processed batch ${i + batchSize}, matchecd ${update.matchedCount}, modified ${update.modifiedCount}`);
//     }

//     console.log(`Blocked generals count: ${generalIds.length}`);

//     res.json({
//       success: true,
//       blockedGenerals: generalIds
//     });

//   } catch (err: any) {
//     console.error("Error in cron job:", err.message);
//     res.json({
//       success: false,
//       message: err.message
//     });
//   }
// })



app.listen(port, () => console.log("Server running on port " + port));