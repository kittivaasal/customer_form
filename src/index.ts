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
import { IEmi } from "./type/emi";
import { Emi } from "./models/emi.model";
import { General } from "./models/general.model";
import cron from "node-cron";
import { initializeFirebase } from './util/firebaseConfig';
import { Counter } from "./models/counter.model";
import { readExcel, transformRow } from "./controllers/common";
import { Customer } from "./models/customer.model";
import { Billing } from "./models/billing.model";

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

//add counter
app.post("/api/counter/auto/increment/create", async (req, res) => {
  let body = req.body;
  let { name } = body;
  if (!name) {
    return res.status(400).json({ message: "name is required" });
  }
  try {
    name = name.toLowerCase().trim();
    const counter = await Counter.findOne(
      { name: name },
    );
    if (counter) {
      return res.status(400).json({ message: "Counter with this name already exists" });
    }
    let newCounter = new Counter({
      name: name,
      seq: 0
    });
    await newCounter.save();
    return res.status(201).json({ message: "Counter created successfully", counter: newCounter });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error", error });
  }
});

cron.schedule("02 00 * * *", async () => {
  console.log("Running cron job");
  try {
    // Find all unpaid EMIs
    const today = new Date();
    today.setHours(0, 0, 0, 0); // normalize date

    // Calculate the cutoff date: EMIs whose date + 2 months <= today
    const cutoffDate = new Date(today);
    cutoffDate.setMonth(cutoffDate.getMonth() - 2); // subtract 2 months

    // Find unpaid EMIs where emi.date <= cutoffDate
    const unpaidEmis: IEmi[] = await Emi.find({
      paidDate: null,
      date: { $lte: cutoffDate }, // MongoDB comparison
    });
    for (const emi of unpaidEmis) {
      const emiDate = new Date(emi.date);
      const duePlus2Months = new Date(emiDate);
      duePlus2Months.setMonth(duePlus2Months.getMonth() + 2);
      duePlus2Months.setHours(0, 0, 0, 0);
      if (duePlus2Months <= today) {
        await General.findByIdAndUpdate(
          emi.general,
          { status: "blocked" },
          { new: true }
        );
      }
    }

  } catch (err) {
    console.error("Error in cron job:", err);
  }
});



// const rows = readExcel("./src/upload/alliance-billing.xlsx");

// app.get("/upload",async(req,res)=>{
//   // return res.send("mass")
//   const documents = rows.map(transformRow);
//   console.log(documents[0])
//   let inset = await Billing.insertMany(documents,
//     { ordered: false }
//   )
//   console.log(inset)
//   res.send(inset)

// })

// app.get("/upload", async (req, res) => {
//   try {
//     const BATCH_SIZE = 500;
//     let totalInserted = 0;

//     for (let i = 0; i < rows.length; i += BATCH_SIZE) {
//       const batch = rows.slice(i, i + BATCH_SIZE).map(transformRow);

//       await Billing.insertMany(batch );

//       totalInserted += batch.length;
//       console.log(`Inserted: ${totalInserted}`);
//     }

//     res.send({
//       success: true,
//       message: `Inserted ${totalInserted} records`
//     });
//   } catch (err:any) {
//     console.error(err);
//     res.status(500).send({ success: false, error: err  });
//   }
// });


// console.log(documents)

app.listen(port, () => console.log("Server running on port " + port));