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
import { Billing } from "./models/billing.model";
import { ReE, toAwait } from "./services/util.service";
import { Commission } from "./models/commision.model";
import { convertCommissionToMarketer } from "./controllers/common.controller";
import httpStatus from "http-status";

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

cron.schedule("02 00 * * *", async () => {
  console.log("Running cron job - EMI Block Check");

  try {
    const today = new Date();

    const startOfMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );

    // 🚀 Step 1: Get all GENERAL IDs where
    // unpaid EMI (paidDate = null) AND EMI date < start of current month
    const generalIds: any[] = await Emi.aggregate([
      {
        $match: {
          paidDate: null,
          date: { $lte: startOfMonth },
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
      }
    ])

    let ids = generalIds.map((item: any) => item?.general?._id);

    // 🚀 Step 2: Block those generals (skip already blocked)
    if (!ids.length) {
      return console.log("No generals to block");
    }

    const updateResult = await General.updateMany(
      {
        _id: { $in: ids },
        status: { $ne: "Blocked" }
      },
      {
        $set: { status: "Blocked" }
      }
    );

    console.log(`Blocked generals count: ${updateResult.modifiedCount}`);

  } catch (err: any) {
    console.error("Error in cron job:", err.message);
  }
});


app.listen(port, () => console.log("Server running on port " + port));