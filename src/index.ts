import express, { Request, Response } from "express";
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
import { MarketingHead } from "./models/marketingHead.model";
import { MarketDetail } from "./models/marketDetail.model";
import { Project } from "./models/project.model";
import fs from "fs";
import Excel from "exceljs";
import { excelDateToJSDate } from "./services/util.service";

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

// app.get("/", async (req: Request, res: Response) => {
//   try {
//     // 1️⃣ Convert string dates to real Date objects

//     let up = await  Billing.updateMany(
//       { paymentDate: { $type: "string" } },
//       [
//         {
//           $set: {
//             paymentDate: {
//               $cond: [
//                 { $regexMatch: { input: "$paymentDate", regex: "^[0-9]{2}/[0-9]{2}/[0-9]{4}$" } },
//                 { $dateFromString: { dateString: "$paymentDate", format: "%d/%m/%Y" } },
//                 { $toDate: "$paymentDate" } // fallback for ISO strings
//               ]
//             }
//           }
//         }
//       ]
//     )
  
//     // let up = await Emi.updateMany(
//     //   {emiAmt:null},
//     //   { $rename: { "emiAmount": "emiAmt" } }
//     // );

//     if (up.modifiedCount > 0) {
//       console.log(`Updated ${up.modifiedCount} EMI customer field rename.`);
//     }

//     res.json({ success: true, message: "Update operation completed", modifiedCount: up.modifiedCount });

//   } catch (error) {
//     console.error("Error updating bills:", error);
//     res.status(500).json({ success: false, message: "Error updating bills", error });
//   }
// });

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

// app.get("/emi/bill",async(req,res)=>{
//   try {
//     const emis = await Emi.find({oldData:true, paidDate: null}).lean();
  
//     const emiMap = new Map<string, any>();
//     for (const e of emis) {
//       if (e.emiNo && e.customer) {
//         emiMap.set(`${e.emiNo.toString()}|${e.customer.toString()}`, e);
//       }
//     }

//     let billing = await Billing.find({oldData:})


    
//   } catch (error) {
    
//   }
// })

//mass
// db.emis.updateMany(
//   { paidDate: null },  // only EMIs that are unpaid
//   [
//     // Lookup bills for each EMI
//     {
//       $lookup: {
//         from: "bills",
//         localField: "_id",
//         foreignField: "emi_id",
//         as: "bills"
//       }
//     },
//     // Calculate total paid and last payment date
//     {
//       $set: {
//         totalPaid: { $sum: "$bills.amount" },
//         lastPaymentDate: { $max: "$bills.paymentDate" }
//       }
//     },
//     // Only set paidDate if EMI is fully paid
//     {
//       $set: {
//         paidDate: {
//           $cond: [
//             { $gte: ["$totalPaid", "$amount"] },
//             "$lastPaymentDate",
//             "$paidDate"
//           ]
//         }
//       }
//     },
//     // Clean up temporary fields
//     {
//       $unset: ["bills", "totalPaid", "lastPaymentDate"]
//     }
//   ]
// )


// //market detail upload
// app.get("/upload", async (req, res) => {
//   try {
//     const BATCH_SIZE = 500;
//     let totalInserted = 0;

//     let getAllMarketHeads;
//     getAllMarketHeads = await MarketingHead.find({});

//     // let a=[]

//     for (let i = 0; i < rows.length; i += BATCH_SIZE) {
//       const batch = rows.slice(i, i + BATCH_SIZE).map(transformRow);
//       for (let record of batch) {
//         if(record?.leaderId){
//           const matchedHead = getAllMarketHeads.find(head => head.id.toString() === record.leaderId.toString());
//           if(matchedHead){
//             record.headBy = matchedHead._id;
//             record.oldData = true;
//             delete record.leaderId;
//             delete record.leaderName;
//           }
//         }
//       }
//       // a.push(batch)
//       await MarketDetail.insertMany(batch );

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

// app.get("/markerHead-count", async (req: Request, res: Response) => {
//   try {
//     const emiMap: Record<
//       string,
//       {
//         oldData: boolean; createdAt: Date; updatedAt: Date; loan: string; status: string;
//         noOfInstallments: number; supplierCode: string; sSalesNo: any; emiAmt: any; customer: any; project: any; marketer: any;
// }
//     > = {};

//     // Path to Excel
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
//     let pro = await Project.find({});
//     let markerter:any=[]

//     const MarketDetailMap = new Map<string, any>();
//     for (const cust of getAllMarketer) {
//       if (cust.id) {
//         MarketDetailMap.set(cust.id.toString(), cust);
//       }
//     }
//     const proMap = new Map<string, any>();
//     for (const cust of pro) {
//       if (cust.id) {
//         proMap.set(cust.id.toString(), cust);
//       }
//     }

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
//           email: row.getCell(9).value,
//           // phone: row.getCell(4).value,
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
// });

// app.get("/marker-count", async (req: Request, res: Response) => {
//   try {
//     const emiMap: Record<
//       string,
//       {
//         oldData: boolean; createdAt: Date; updatedAt: Date; loan: string; status: string;
//         noOfInstallments: number; supplierCode: string; sSalesNo: any; emiAmt: any; customer: any; project: any; marketer: any;
// }
//     > = {};

//     // Path to Excel
//     const excelPath = "./src/uploads/markerDetailHosing.xlsx";

//     // Output JSON path
//     const outputDir = "./src/uploads/generated";
//     if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

//     const jsonPath = path.join(outputDir, `markerDetail-count-${Date.now()}Housing.json`);

//     // Use `as any` to bypass missing TS types
//     const workbook = new (Excel.stream.xlsx as any).WorkbookReader(excelPath, {
//       entries: "emit",
//       worksheets: "emit",
//       sharedStrings: "cache",
//       styles: "ignore",
//       hyperlinks: "ignore",
//     });

//     let getAllMarketer = await MarketDetail.find({});
//     let pro = await Project.find({});
//     let markerter:any=[]

//     const MarketDetailMap = new Map<string, any>();
//     for (const cust of getAllMarketer) {
//       if (cust.id) {
//         MarketDetailMap.set(cust.id.toString(), cust);
//       }
//     }
//     const proMap = new Map<string, any>();
//     for (const cust of pro) {
//       if (cust.id) {
//         proMap.set(cust.id.toString(), cust);
//       }
//     }

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
//           email: row.getCell(9).value,
//           // phone: row.getCell(4).value,
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
// });


// project detail upload
// app.get("/upload", async (req, res) => {
//   try {
//     const BATCH_SIZE = 500;
//     let totalInserted = 0;

//     // let getAllMarketHeads;
//     // getAllMarketHeads = await MarketingHead.find({});

//     let a=[]

//     for (let i = 0; i < rows.length; i += BATCH_SIZE) {
//       const batch = rows.slice(i, i + BATCH_SIZE).map(transformRow);
//       // console.log(batch[0], rows.length );
//       for (let record of batch) {
//         if(record){
//           a.push(record)
//         }
//       }
//       console.log(a.length,a)
//       // a.push(batch)
//       await Project.insertMany( a );


//       totalInserted += batch.length;
//       console.log(`Inserted: ${totalInserted}`);
//     }

//     res.send({
//       success: true,
//       message: `Inserted ${totalInserted} records`
//     });
//   } catch (err:any) {
//     // console.error(err);
//     res.status(500).send({ success: false, error: err  });
//   }
// });

//customer upload
// app.get("/customer-count", async (req: Request, res: Response) => {
//   try {
//     const emiMap: Record<
//       string,
//       {
//         oldData: boolean; createdAt: Date; updatedAt: Date; loan: string; status: string;
//         noOfInstallments: number; supplierCode: string; sSalesNo: any; emiAmt: any; customer: any; project: any; marketer: any;
// }
//     > = {};

//     // Path to Excel
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
//     let pro = await Project.find({});
//     let markerter:any=[]

//     const MarketDetailMap = new Map<string, any>();
//     for (const cust of getAllMarketer) {
//       if (cust.id) {
//         MarketDetailMap.set(cust.id.toString(), cust);
//       }
//     }
//     const proMap = new Map<string, any>();
//     for (const cust of pro) {
//       if (cust.id) {
//         proMap.set(cust.id.toString(), cust);
//       }
//     }

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
//           email: row.getCell(9).value,
//           // phone: row.getCell(4).value,
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
// });

// general count upload
// app.get("/general-count", async (req: Request, res: Response) => {
//   try {
//     console.log("Starting general count upload...");
//     const emiMap: Record<string, any> = {};

//     const excelPath = "./src/uploads/emiHouseing.xlsx";

//     const outputDir = "./src/uploads/generated";
//     if (!fs.existsSync(outputDir)) {
//       fs.mkdirSync(outputDir, { recursive: true });
//     }

//     const jsonPath = path.join(
//       outputDir,
//       `general-count-${Date.now()}Hosing.json`
//     );

//     /* -------------------- LOAD CUSTOMERS ONCE -------------------- */
//     const customers = await Customer.find({}).lean();

//     const customerMap = new Map<string, any>();
//     for (const cust of customers) {
//       if (cust.id) {
//         customerMap.set(cust.id.toString(), cust);
//       }
//     }

//     const now = new Date();

//     /* -------------------- STREAM EXCEL -------------------- */
//     const workbook = new (Excel.stream.xlsx as any).WorkbookReader(
//       excelPath,
//       {
//         entries: "emit",
//         worksheets: "emit",
//         sharedStrings: "cache",
//         styles: "ignore",
//         hyperlinks: "ignore",
//       }
//     );

//     workbook.on("worksheet", (worksheet: any) => {
//       worksheet.on("row", (row: any) => {
//         if (row.number === 1) return; // skip header
//         console.log("Processing row:", row.number);
//         const supplier = row.getCell(1).value?.toString().trim();
//         const salesNo = row.getCell(3).value;
//         const emiAmt = row.getCell(6).value;
//         const status = row.getCell(10).value

//         if (!supplier || salesNo == null) return;

//         const customer = customerMap.get(supplier);

//         const key = `${supplier}|${salesNo}`;

//         if (!emiMap[key]) {
//           emiMap[key] = {
//             supplierCode: supplier,
//             sSalesNo: salesNo,
//             noOfInstallments: 0,
//             customer: customer?._id || null,
//             project: customer?.project || null,
//             marketer:
//               customer?.ddId ??
//               customer?.cedId ??
//               null,
//             oldData: true,
//             loan: "no",
//             createdAt: now,
//             updatedAt: now,
//             paidStauts: status,
//             emiAmt,
//             status: "Enquiry",
//           };
//         }

//         if(emiMap[key].paidStauts.toString()?.toLowerCase() === "unpaid"){
//           if(!emiMap[key]?.emiAmt){
//             emiAmt[key].emiAmt = emiAmt
//           }
//         }

//         emiMap[key].noOfInstallments++;
//       });
//     });

//     workbook.on("end", () => {
//       const data = Object.values(emiMap);

//       fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));

//       res.status(200).json({
//         success: true,
//         count: data.length,
//         file: jsonPath,
//         data,
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



// data get all emi upload

// app.get("/emi-count", async (req: Request, res: Response) => {
//   try {
//     const emiMap: Record<
//       string,
//       {
//         oldData: boolean; createdAt: Date; updatedAt: Date; general: any; emiNo: any; date: Date | null; paidDate: Date | null; paidAmt: any; payRef: any;
//         emiAmt: any; customer: any;
//       }
//     > = {};
//     const excelPath = "./src/uploads/emiHouseing.xlsx";

//     // Output JSON path
//     const outputDir = "./src/uploads/generated";
//     if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

//     const jsonPath = path.join(outputDir, `emi-count-${Date.now()}housing.json`);

//     // Use `as any` to bypass missing TS types
//     const workbook = new (Excel.stream.xlsx as any).WorkbookReader(excelPath, {
//       entries: "emit",
//       worksheets: "emit",
//       sharedStrings: "cache",
//       styles: "ignore",
//       hyperlinks: "ignore",
//     });

//     let getAllCustomers = await Customer.find({});
//     let getAllGenerals = await General.find({});

//     let generalMap = new Map<string, any>();
//     for (const g of getAllGenerals) {
//       if (g.sSalesNo) {
//         generalMap.set(g.sSalesNo.toString(), g);
//       }
//     }

//     let customerMap: Map<string, any> = new Map();
//     for (const c of getAllCustomers) {
//       if (c.id) {
//         customerMap.set(c.id.toString(), c);
//       }
//     }

//     let bills: any[] = [];


//     workbook.on("worksheet", (worksheet: any) => {
//       worksheet.on("row", (row: any) => {
//         if (row.number === 1) return;

//         const supplier = row.getCell(1).text?.trim();
//         const salesNo = row.getCell(3).value;
//         const emiNo = row.getCell(4).value;
//         const date = row.getCell(5).value;
//         const emiAmt = row.getCell(6).value;
//         const paidDate = row.getCell(7).value;
//         const paidAmt = row.getCell(8).value;
//         const payRef = row.getCell(11).value;

//         if (!supplier || salesNo == null) return;

//         let findCustomer = customerMap.get(supplier.toString()) || null;
//         let findGeneral = generalMap.get(salesNo.toString()) || null;

//         const key = `${supplier}|${salesNo}`;
//         let emi = {
//           general: findGeneral ? findGeneral._id : null,
//           customer: findCustomer ? findCustomer._id : null,
//           emiAmt: emiAmt,
//           emiNo: emiNo,
//           date: date ? excelDateToJSDate(date) : null,
//           paidDate: paidDate ? excelDateToJSDate(paidDate) : null,
//           paidAmt: paidAmt,
//           payRef: payRef,
//           oldData: true,
//           createdAt: new Date(),
//           updatedAt: new Date(),
//         };
//         bills.push(emi);
//       });
//     });


//     workbook.on("end", () => {
//       // Write JSON file
//       fs.writeFileSync(jsonPath, JSON.stringify(bills, null, 2));

//       console.log("✅ EMI JSON generated at:", jsonPath);

//       // Send response with path
//       res.status(200).json({
//         success: true,
//         file: jsonPath,
//         count: Object.keys(emiMap).length,
//         data: Object.values(emiMap),
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

// bill count upload
// app.get("/bill-count", async (req: Request, res: Response) => {
//   try {
//     console.log("Starting bill count upload...");

//     const excelPath = "./src/uploads/billingAlliance.xlsx";
//     const outputDir = "./src/uploads/generated";
//     if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
//     const jsonPath = path.join(outputDir, `bill-count-${Date.now()}.json`);

//     // Fetch EMIs and customers once
//     const customers = await Customer.find({}).lean();
//     const emis = await Emi.find({oldData:true}).lean();

//     // Maps for fast lookup
//     const customerMap = new Map<string, any>();
//     for (const c of customers) {
//       if (c.id) customerMap.set(c.id.toString(), c);
//     }

//     const emiMap = new Map<string, any>();
//     for (const e of emis) {
//       if (e.emiNo && e.customer) {
//         emiMap.set(`${e.emiNo.toString()}|${e.customer.toString()}`, e);
//       }
//     }

//     const bills: any[] = [];
//     const workbook = new (Excel.stream.xlsx as any).WorkbookReader(excelPath, {
//       entries: "emit",
//       worksheets: "emit",
//       sharedStrings: "cache",
//       styles: "ignore",
//       hyperlinks: "ignore",
//     });

//     workbook.on("worksheet", (worksheet: any) => {
//       worksheet.on("row", (row: any) => {
//         if (row.number === 1) return;

//         const customerCode = row.getCell(4).text?.trim();
//         const salesNo = row.getCell(2).value;

//         if (!customerCode || !salesNo) return;

//         const customer = customerMap.get(customerCode.toString()) || null;
//         if (!customer) return;

//         const emiKey = `${row.getCell(14).value.toString()}|${customer._id.toString()}`;
//         const emi = emiMap.get(emiKey) || null;
        
//         if(row.number === 5){
//           console.log({emiKey, emi });
//         }

//         // console.log(excelDateToJSDate(row.getCell(10).value), row.getCell(10).value, new Date(row.getCell(10).value) === null );

//         bills.push({
//           general: emi?.general || null,
//           customer: customer._id,
//           introducer: customer?.ddId || null,
//           introducerByModel: "MarketDetail",
//           customerCode: customerCode,
//           phone: row.getCell(5).value,
//           sSalesNo: salesNo,
//           paymentDate: excelDateToJSDate(row.getCell(10).value),
//           amountPaid: row.getCell(11).value,
//           bookingId: row.getCell(12).value,
//           emiNo: row.getCell(14).value,
//           modeOfPayment: row.getCell(15).value,
//           remarks: row.getCell(16).value,
//           createdBy: row.getCell(17).value,
//           totalAmount: row.getCell(18).value,
//           balanceAmount: row.getCell(19).value,
//           emi: emi?._id || null,
//           oldData: true,
//           createdAt: new Date(),
//           updatedAt: new Date(),
//         });

//         if (row.number % 1000 === 0) console.log(`Processed ${row.number} rows`);
//       });
//     });

//     workbook.on("end", () => {
//       fs.writeFileSync(jsonPath, JSON.stringify(bills, null, 2));
//       console.log("✅ Bill JSON generated:", jsonPath);

//       res.status(200).json({
//         success: true,
//         file: jsonPath,
//         count: bills.length,
//         data: bills,
//       });
//     });

//     workbook.on("error", (err: any) => {
//       console.error("Excel read error:", err);
//       res.status(500).json({ success: false, message: "Failed to read Excel file" });
//     });

//     await workbook.read();
//   } catch (err) {
//     console.error("Server error:", err);
//     res.status(500).json({ success: false, message: "Internal server error" });
//   }
// });

app.listen(port, () => console.log("Server running on port " + port));