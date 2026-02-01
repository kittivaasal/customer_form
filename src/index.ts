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
//     let up = await Emi.updateMany(
//       { oldData: true, paidDate: { $type: "string" } },
//       [{ $set: { paidDate: { $toDate: "$paidDate" } } }]
//     );

//     if (up.modifiedCount > 0) {
//       console.log(`Updated ${up.modifiedCount} EMI paidDate fields from string to Date.`);
//     }

//   } catch (error) {
//     console.error("Error updating bills:", error);
//     res.status(500).json({ success: false, message: "Error updating bills", error });
//   }
// });

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



// const rows = readExcel("./src/uploads/EmiAlliance.xlsx");

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

//project detail upload
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
//     const excelPath = "./src/uploads/EmiAlliance.xlsx";



//     // Output JSON path
//     const outputDir = "./src/uploads/generated";
//     if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

//     const jsonPath = path.join(outputDir, `emi-count-${Date.now()}.json`);

//     // Use `as any` to bypass missing TS types
//     const workbook = new (Excel.stream.xlsx as any).WorkbookReader(excelPath, {
//       entries: "emit",
//       worksheets: "emit",
//       sharedStrings: "cache",
//       styles: "ignore",
//       hyperlinks: "ignore",
//     });

//     let getAllCustomers = await Customer.find({});

//     workbook.on("worksheet", (worksheet: any) => {
//       worksheet.on("row", (row: any) => {
//         if (row.number === 1) return;

//         console.log("Processing row:", row.number);

//         const supplier = row.getCell(1).text?.trim();
//         const salesNo = row.getCell(3).value;
//         const emiAmt = row.getCell(6).value;

//         if (!supplier || salesNo == null) return;

//         let findCustomer = getAllCustomers.find(cust => cust.id.toString() === supplier.toString());

//         const key = `${supplier}|${salesNo}`;
//         if (!emiMap[key]) {
//           emiMap[key] = {
//             supplierCode: supplier,
//             sSalesNo: salesNo,
//             noOfInstallments: 0,
//             emiAmt: emiAmt,
//             customer: findCustomer ? findCustomer._id : null,
//             project: findCustomer ? findCustomer.projectId : null,
//             marketer: findCustomer ? (findCustomer.ddId ? findCustomer.ddId : findCustomer.cedId ? findCustomer.cedId : null) : null,
//             oldData: true,
//             loan:"no",
//             createdAt: new Date(),
//             updatedAt: new Date(),
//             status: "Enquiry",
//           };
//         }

//         emiMap[key].noOfInstallments++;
//       });
//     });

//     workbook.on("end", () => {
//       // Write JSON file
//       fs.writeFileSync(jsonPath, JSON.stringify(Object.values(emiMap), null, 2));

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

// general count upload
// app.get("/general-count", async (req: Request, res: Response) => {
//   try {
//     const emiMap: Record<
//       string,
//       {
//         oldData: boolean; createdAt: Date; updatedAt: Date; loan: string; status: string;
//         noOfInstallments: number; supplierCode: string; sSalesNo: any; emiAmt: any; customer: any; project: any; marketer: any;
// }
//     > = {};

//     // Path to Excel
//     const excelPath = "./src/uploads/EmiAlliance.xlsx";



//     // Output JSON path
//     const outputDir = "./src/uploads/generated";
//     if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

//     const jsonPath = path.join(outputDir, `emi-count-${Date.now()}.json`);

//     // Use `as any` to bypass missing TS types
//     const workbook = new (Excel.stream.xlsx as any).WorkbookReader(excelPath, {
//       entries: "emit",
//       worksheets: "emit",
//       sharedStrings: "cache",
//       styles: "ignore",
//       hyperlinks: "ignore",
//     });

//     let getAllCustomers = await Customer.find({});

//     workbook.on("worksheet", (worksheet: any) => {
//       worksheet.on("row", (row: any) => {
//         if (row.number === 1) return;

//         console.log("Processing row:", row.number);

//         const supplier = row.getCell(1).text?.trim();
//         const salesNo = row.getCell(3).value;
//         const emiAmt = row.getCell(6).value;

//         if (!supplier || salesNo == null) return;

//         let findCustomer = getAllCustomers.find(cust => cust.id.toString() === supplier.toString());

//         const key = `${supplier}|${salesNo}`;
//         if (!emiMap[key]) {
//           emiMap[key] = {
//             supplierCode: supplier,
//             sSalesNo: salesNo,
//             noOfInstallments: 0,
//             emiAmt: emiAmt,
//             customer: findCustomer ? findCustomer._id : null,
//             project: findCustomer ? findCustomer.projectId : null,
//             marketer: findCustomer ? (findCustomer.ddId ? findCustomer.ddId : findCustomer.cedId ? findCustomer.cedId : null) : null,
//             oldData: true,
//             loan:"no",
//             createdAt: new Date(),
//             updatedAt: new Date(),
//             status: "Enquiry",
//           };
//         }

//         emiMap[key].noOfInstallments++;
//       });
//     });

//     workbook.on("end", () => {
//       // Write JSON file
//       fs.writeFileSync(jsonPath, JSON.stringify(Object.values(emiMap), null, 2));

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
//     const excelPath = "./src/uploads/EmiAlliance.xlsx";

//     // Output JSON path
//     const outputDir = "./src/uploads/generated";
//     if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

//     const jsonPath = path.join(outputDir, `emi-count-${Date.now()}.json`);

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

// const generalsPath = path.join(__dirname, "./data/generalAlliance.json");
// const generals: any[] = JSON.parse(fs.readFileSync(generalsPath, "utf-8"));

// const emisPath = path.join(__dirname, "./data/emiAlliance.json");
// const emis: any[] = JSON.parse(fs.readFileSync(emisPath, "utf-8"));

// cosnt bill

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
//     const emis = await Emi.find({paidDate:{$ne:null}}).lean();

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

//     console.log("Maps prepared. Starting to read Excel...");

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

//         //  console.log({emis });
//         //  console.log({ message: `Processing row ${row.number}: CustomerCode=${customerCode}, SalesNo=${salesNo}`, emiNo: row.getCell(14).value.toString()});


//         const emiKey = `${row.getCell(14).value.toString()}|${customer._id.toString()}`;
//         const emi = emiMap.get(emiKey) || null;
        
//         if(row.number === 5){
//           console.log({emiKey, emi });
//         }
//         // console.log({ message: `Matched EMI for row ${row.number}:`, emi });
//         bills.push({
//           general: emi?.general || null,
//           customer: customer._id,
//           introducer: customer?.ddId || null,
//           introducerByModel: "MarketDetail",
//           customerCode: customerCode,
//           phone: row.getCell(5).value,
//           sSalesNo: salesNo,
//           paymentDate: row.getCell(10).value ? excelDateToJSDate(row.getCell(10).value) : null,
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