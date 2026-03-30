// import { app } from "firebase-admin";
// import { Billing } from "./models/billing.model";
// import httpStatus from "http-status";
// import { ReE } from "./services/util.service";

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

//bill emi
// app.get("/emi/bill/merge", async (req: Request, res: Response) => {
//   try {
//     const countPipeline: any[] = [
//       {
//         $match: {
//           paidDate: false,
//           paymentDate: { $ne: null }
//         }
//       },
//       {
//         $lookup: {
//           from: "emis",
//           let: {
//             billCustomer: "$customer",
//             billEmiNo: "$emiNo"
//           },
//           pipeline: [
//             {
//               $match: {
//                 $expr: {
//                   $and: [
//                     { $eq: ["$customer", "$$billCustomer"] },
//                     { $eq: ["$emiNo", "$$billEmiNo"] },
//                     {
//                       $or: [
//                         { $eq: ["$paidDate", null] },
//                         { $not: ["$paidDate"] }
//                       ]
//                     }
//                   ]
//                 }
//               }
//             }
//           ],
//           as: "emi"
//         }
//       },
//       { $unwind: "$emi" },
//       { $count: "modifiedCount" }
//     ];

//     const countResult = await Billing.aggregate(countPipeline);
//     const modifiedCount = countResult[0]?.modifiedCount || 0;


//     // STEP 2: UPDATE
//     const mergePipeline: any[] = [
//       {
//         $match: {
//           paidDate:null
//         }
//       },
//       {
//         $lookup: {
//           from: "emis",
//           let: {
//             billCustomer: "$customer",
//             billEmiNo: "$emiNo"
//           },
//           pipeline: [
//             {
//               $match: {
//                 $expr: {
//                   $and: [
//                     { $eq: ["$customer", "$$billCustomer"] },
//                     { $eq: ["$emiNo", "$$billEmiNo"] }
//                   ]
//                 }
//               }
//             }
//           ],
//           as: "emi"
//         }
//       },
//       { $unwind: "$emi" },
//       {
//         $project: {
//           _id: "$emi._id",
//           paidDate: "$paymentDate",
//           oldDate: true
//         }
//       },
//       {
//         $merge: {
//           into: "emis",
//           on: "_id",
//           whenMatched: "merge",
//           whenNotMatched: "discard"
//         }
//       }
//     ];

//     await Billing.aggregate(mergePipeline);


//     res.json({
//       success: true,
//       message: "EMI paidDate updated using aggregation + merge",
//       modifiedCount
//     });

//   } catch (error) {
//     console.error(error);
//     res.status(500).json({
//       success: false,
//       message: "Aggregation merge failed",
//       error
//     });
//   }
// });

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


// app.get("/customer-count", async (req: Request, res: Response) => {
//   try {
//     const excelPath = "./src/uploads/estimateHousing.xlsx";

//     console.log("🚀 Starting Excel Processing...");

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

//     const BATCH_SIZE = 500;
//     let bulkOperations: any[] = [];
//     let processedCount = 0;
//     let updatedCount = 0;
//     let matchedCount = 0;
//     let miss=[]

//     // ✅ THIS IS THE CORRECT WAY
//     for await (const worksheet of workbook) {
//       for await (const row of worksheet) {
//         if (row.number === 1) continue;

//         let id = row.getCell(2).value;
//         let total = row.getCell(3).value;

//         bulkOperations.push({
//           updateOne: {
//             filter: { supplierCode: id },
//             update: {
//               $set: {
//                 totalAmount:total,
//                 update: true
//               },
//             },
//           },
//         });

//         processedCount++;

//         if (bulkOperations.length >= BATCH_SIZE) {
//           const result = await General.bulkWrite(bulkOperations);
//           updatedCount += result.modifiedCount;
//           matchedCount += result.matchedCount
//           bulkOperations = [];

//           console.log(
//             `⚡ Batch Updated -- | Processed: ${processedCount} | Matched count: ${matchedCount} | Updated: ${updatedCount}`
//           );
//         }
//       }
//     }

//     // Final remaining updates
//     if (bulkOperations.length > 0) {
//       const result = await General.bulkWrite(bulkOperations);
//       updatedCount += result.modifiedCount;
//       console.log(`⚡ Final Batch Updated -- | Processed: ${processedCount} | Matched count: ${matchedCount} | Updated: ${updatedCount}`);
//     }

//     console.log("🎉 Excel Processing Completed");

//     return res.status(200).json({
//       success: true,
//       // miss,
//       bulkOperations,
//       processed: processedCount,
//       updated: updatedCount,
//     });
//   } catch (error) {
//     console.error("❌ Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//     });
//   }
// });

// import excelPath from "./uploads/newCustomer.json";
// console.log(excelPath)
// app.get("/json/cus", async (req: Request, res: Response) => {
//   try {
//     console.log("🚀 Starting Excel Processing...");
//     let data = excelPath as any[];
//     let result=[];
//     let getAllMarketHeads = await MarketingHead.find({})
//     let marketHeadMap = new Map<string, any>();
//     for (const item of getAllMarketHeads) {
//       if (item._id) {
//         marketHeadMap.set(item._id.toString(), item);
//       }
//     }
//     let markerDetail = await MarketDetail.find({})
//     let markerDetailMap = new Map<string, any>();
//     for (const item of markerDetail) {
//       if (item.id) {
//         markerDetailMap.set(item._id.toString(), item);
//       }
//     }

//     for (let index = 0; index < data.length; index++) {
//       const element = data[index] as any;
//       // for (const item of data) {
//         let ddId = element?.ddId?.toString()
//         let cedId = element?.cedId?.toString()
//         let ddObj;
//         let cedObj;

//         if (ddId) {
//           let getDdId = marketHeadMap.get(ddId.toString())
//           ddObj = getDdId
//         }
//         if (cedId) {
//           let getCedId = markerDetailMap.get(cedId.toString())
//           cedObj = getCedId
//         }
//         result.push({...element,ddObj, cedObj})
//         // console.log("🚀 ~ file: index.ts:429 ~ app.get ~ element:", index+1);
//     }

//     return res.status(200).json({
//       success: true,
//       data: result,
//     });
//   } catch (error) {
//     console.error("❌ Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//     });
//   }
// })

// app.get("/cus/get", async (req: Request, res: Response) => {
//   try {
//     const data = await Customer.find({oldData:false}).lean();
//     let ddId:any[]=[]
//     for (const item of data) {
//       if(ddId.includes(item.ddId?.toString())) continue
//       console.log(item.ddId, ddId.includes(item.ddId?.toString()))
//       ddId.push(item.ddId?.toString())
//     }
//     return res.status(200).json({
//       success: true,
//       data:ddId,
//     });
//   } catch (error) {
//     console.error("❌ Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//     });
//   }
// })

// app.get("/general-count", async (req: Request, res: Response) => {
//   try {
//     const excelPath = "./src/uploads/CustomerAlliance.xlsx";

//     if (!fs.existsSync(excelPath)) {
//       return res.status(400).json({
//         success: false,
//         message: "Excel file not found",
//       });
//     }

//     console.log("🚀 Starting Excel Processing...");

//     // ✅ Load only required fields
//     // const marketDetails = await MarketDetail.find(
//     //   {},
//     //   { _id: 1, id: 1, overAllHeadBy: 1 }
//     // ).lean();

//     // const marketDetailMap = new Map<string, any>();
//     // for (const item of marketDetails) {
//     //   if (item.id) {
//     //     marketDetailMap.set(item.id.toString(), item);
//     //   }
//     // }

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

//     const BATCH_SIZE = 500;
//     let bulkOperations: any[] = [];
//     let processedCount = 0;
//     let updatedCount = 0;
//     let isProcessing = false;
//     let worksheetFinished = false;

//     workbook.on("worksheet",async (worksheet: any) => {
//       worksheet.on("row", async (row: any) => {
//         if (row.number === 1) return;

//         let id = row.getCell(1).value;
//         let noOfInstallments = row.getCell(6).value;
//         let emiAmount = row.getCell(7).value;

//         bulkOperations.push({
//           updateOne: {
//             filter: { sSalesNo: id },
//             update: {
//               $set: {
//                 noOfInstallments: noOfInstallments,
//                 emiAmount: emiAmount,
//                 update: true
//               },
//             },
//           },
//         });

//         processedCount++;

//         // if (bulkOperations.length >= BATCH_SIZE && !isProcessing) {
//         //   // worksheet.pause(); // ⏸ pause reading
//         //   isProcessing = true;

//         //   try {
//         //     const result = await Customer.bulkWrite(bulkOperations);
//         //     updatedCount += result.modifiedCount;
//         //     bulkOperations = [];

//         //     console.log(
//         //       `⚡ Batch Updated | Processed: ${processedCount} | Updated: ${updatedCount}`
//         //     );
//         //   } catch (err) {
//         //     console.error("Bulk write error:", err);
//         //   }

//         //   isProcessing = false;
//         //   worksheet.resume(); // ▶ resume reading
//         // }
//         if (bulkOperations.length >= BATCH_SIZE) {
//           const result = await General.bulkWrite(bulkOperations);
//           updatedCount += result.modifiedCount;
//           bulkOperations = [];

//           console.log(
//             `⚡ Batch Updated -- | Processed: ${processedCount} | Updated: ${updatedCount}`
//           );
//         }
//       });

//       if (bulkOperations.length > 0) {
//         const result = await Customer.bulkWrite(bulkOperations);
//         updatedCount += result.modifiedCount;
//       }

//     console.log("🎉 Excel Processing Completed");

//       // worksheet.on("finished", async () => {
//       //   worksheetFinished = true;

//       //   // Final remaining updates
//       //   if (bulkOperations.length > 0) {
//       //     try {
//       //       const result = await Customer.bulkWrite(bulkOperations);
//       //       updatedCount += result.modifiedCount;
//       //     } catch (err) {
//       //       console.error("Final bulk write error:", err);
//       //     }
//       //   }

//       //   console.log("🎉 Excel Processing Completed");

//       //   return res.status(200).json({
//       //     success: true,
//       //     processed: processedCount,
//       //     updated: updatedCount,
//       //     message: "Customer cedId & ddId updated successfully",
//       //   });
//       // });
//     });

//     workbook.on("error", (err: any) => {
//       console.error("Excel read error:", err);
//       return res.status(500).json({
//         success: false,
//         message: "Failed to read Excel file",
//       });
//     });

//     await workbook.read();
//   } catch (error) {
//     console.error("❌ Server Error:", error);
//     return res.status(500).json({
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
// app.get("/marker", async (req: Request, res: Response) => {
//   try {
//     console.log("Starting bill count upload...");

//     let { levelNo } = req.query

//     if(!levelNo) throw new Error("Level not found")

//     const excelPath = "./src/uploads/MarketerDetailHousing.xlsx";
//     const outputDir = "./src/uploads/generated";
//     if(!excelPath) throw new Error("Excel file path not found")
//     if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
//     const jsonPath = path.join(outputDir, `marketerdetailalliance-${Date.now()}.json`);

//     const marketHead = await MarketingHead.find()
//     const market = await MarketDetail.find()

//     const marketHeadMap = new Map<string, any>()
//     for(let m of marketHead){
//       if(m.id){
//         marketHeadMap.set(m.id.toString(), m)
//       }
//     }

//     const marketdMap = new Map<string, any>()
//     for(let m of market){
//       if(m.id){
//         marketdMap.set(m.id.toString(), m)
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
//       worksheet.on("row", async (row: any) => {
//         if (row.number === 1) return;

//         // console.log("Processing row:", row.number, row.getCell(2).value);

//         let level = row.getCell(1).value;
//         let id = row.getCell(2).value;
//         let name = row.getCell(3).value;
//         // let phone = row.getCell(4).value;
//         let leaderID = row.getCell(4).value;
//         let leaderName = row.getCell(5).value;
//         let status = "active";
//         // if(leaderID === 1) return;
//         // if(leaderID !== 3) return;

//         let headyBy: any = undefined;
//         let overAllHeadBy: any[] = [];
//         // console.log("mass", {id:leaderID}, row.number)
//         // if(level === 2 ){
//         //   // console.log("mass2", {id:leaderID}, row.number)
//         //   headyBy= marketHeadMap.get(leaderID.toString()) || null
//         //   // console.log(headyBy)
//         //   if(!headyBy) {
//         //     console.log("mass2", {leaderId:leaderID, name, leaderName,id}, row.number)
//         //   }
//         //   overAllHeadBy = [
//         //     {
//         //       headBy:headyBy?._id,
//         //       level:1,
//         //       headByModel:"MarketingHead"
//         //     }
//         //   ]
//         //   // console.log("mass")
//         // }
//         console.log(level , Number(levelNo))
//         if(level === Number(levelNo)){
//           let get = marketdMap.get(leaderID?.toString())
//           // console.log(get,"mass", {id:leaderID}, row.number)
//           get = get as any
//           if(!get){
//             let get2 = marketHeadMap.get(leaderID?.toString())
//             get2 = get2 as any
//             headyBy = get2?._id;
//             overAllHeadBy = [
//               {
//                 headBy:get2?._id,
//                 level:1,
//                 headByModel:"MarketingHead"
//               }
//             ]
//             // return ;
//           }else if(get){
//             headyBy = get._id;
//             overAllHeadBy =[ 
//               ...get.overAllHeadBy, 
//                 {
//                 headBy:get._id,
//                 level:get.overAllHeadBy.length+1,
//                 headByModel:"MarketDetail"
//               }
//             ]
//           }
//           console.log(overAllHeadBy)
//         }else{
//           return;
//         }

//         let p:any ={
//           id: id.toString(),
//           name,
//           // phone: phone.toString(),
//           level,
//           leaderID,
//           leaderName,
//           status,
//           oldData:true,
//           headBy: headyBy?._id,
//           overAllHeadBy,
//           mass:true
//         }
//         if(overAllHeadBy.length !== Number(levelNo) - 1){
//           p.levelSkip = true
//         }

//         bills.push(p);



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

// app.get("/marker", async (req: Request, res: Response) => {
//   try {
//     console.log("Starting bill count upload...");

//     let { levelNo } = req.query

//     if(!levelNo) throw new Error("Level not found")

//     const excelPath = "./src/uploads/MarketerDetailHousing.xlsx";
//     const outputDir = "./src/uploads/generated";
//     if(!excelPath) throw new Error("Excel file path not found")
//     if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
//     const jsonPath = path.join(outputDir, `marketerdetailalliance-${Date.now()}.json`);

//     // const marketHead = await MarketingHead.find()
//     // const market = await MarketDetail.find()

//     // const marketHeadMap = new Map<string, any>()
//     // for(let m of marketHead){
//     //   if(m.id){
//     //     marketHeadMap.set(m.id.toString(), m)
//     //   }
//     // }

//     // const marketdMap = new Map<string, any>()
//     // for(let m of market){
//     //   if(m.id){
//     //     marketdMap.set(m.id.toString(), m)
//     //   }
//     // }

//     const bills: any[] = [];
//     const workbook = new (Excel.stream.xlsx as any).WorkbookReader(excelPath, {
//       entries: "emit",
//       worksheets: "emit",
//       sharedStrings: "cache",
//       styles: "ignore",
//       hyperlinks: "ignore",
//     });

//     workbook.on("worksheet", (worksheet: any) => {
//       worksheet.on("row", async (row: any) => {
//         if (row.number === 1) return;

//         // console.log("Processing row:", row.number, row.getCell(2).value);

//         let id = row.getCell(1).value;
//         let noOfInstallments = row.getCell(6).value;
//         let emiAmount = row.getCell(7).value;

//         let headyBy: any = undefined;
//         let overAllHeadBy: any[] = [];
//         // console.log("mass", {id:leaderID}, row.number)
//         // if(level === 2 ){
//         //   // console.log("mass2", {id:leaderID}, row.number)
//         //   headyBy= marketHeadMap.get(leaderID.toString()) || null
//         //   // console.log(headyBy)
//         //   if(!headyBy) {
//         //     console.log("mass2", {leaderId:leaderID, name, leaderName,id}, row.number)
//         //   }
//         //   overAllHeadBy = [
//         //     {
//         //       headBy:headyBy?._id,
//         //       level:1,
//         //       headByModel:"MarketingHead"
//         //     }
//         //   ]
//         //   // console.log("mass")
//         // }
//         console.log(level , Number(levelNo))
//         if(level === Number(levelNo)){
//           let get = marketdMap.get(leaderID?.toString())
//           // console.log(get,"mass", {id:leaderID}, row.number)
//           get = get as any
//           if(!get){
//             let get2 = marketHeadMap.get(leaderID?.toString())
//             get2 = get2 as any
//             headyBy = get2?._id;
//             overAllHeadBy = [
//               {
//                 headBy:get2?._id,
//                 level:1,
//                 headByModel:"MarketingHead"
//               }
//             ]
//             // return ;
//           }else if(get){
//             headyBy = get._id;
//             overAllHeadBy =[ 
//               ...get.overAllHeadBy, 
//                 {
//                 headBy:get._id,
//                 level:get.overAllHeadBy.length+1,
//                 headByModel:"MarketDetail"
//               }
//             ]
//           }
//           console.log(overAllHeadBy)
//         }else{
//           return;
//         }

//         let p:any ={
//           id: id.toString(),
//           name,
//           // phone: phone.toString(),
//           level,
//           leaderID,
//           leaderName,
//           status,
//           oldData:true,
//           headBy: headyBy?._id,
//           overAllHeadBy,
//           mass:true
//         }
//         if(overAllHeadBy.length !== Number(levelNo) - 1){
//           p.levelSkip = true
//         }

//         bills.push(p);



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

// bill count upload
// app.get("/bill-count", async (req: Request, res: Response) => {
//   try {
//     console.log("🚀 Starting bill processing...");

//     const excelPath = "./src/uploads/HosuingBillingMass.xlsx";
//     const outputDir = "./src/uploads/generated";

//     if (!fs.existsSync(outputDir)) {
//       fs.mkdirSync(outputDir, { recursive: true });
//     }

//     const jsonPath = path.join(
//       outputDir,
//       `bill-count-${Date.now()}.json`
//     );

//     const emiPath = path.join(
//       outputDir,
//       `emi-update-${Date.now()}.json`
//     );

//     console.log("Loading customers & EMIs...");

//     const customers = await Customer.find({}).lean();
//     const emis = await Emi.find({}).lean();

//     const customerMap = new Map<string, any>();

//     for (const c of customers) {
//       if (c.id) {
//         customerMap.set(c.id.toString(), c);
//       }
//     }

//     const emiMap = new Map<string, any>();

//     for (const e of emis) {
//       if (e.emiNo && e.customer) {
//         emiMap.set(`${e.emiNo}|${e.customer}`, e);
//       }
//     }

//     console.log("Customers:", customerMap.size);
//     console.log("EMIs:", emiMap.size);

//     const workbook = XLSX.readFile(excelPath);

//     const sheetName = workbook.SheetNames[0];

//     const sheet = workbook.Sheets[sheetName];

//     const rows: any[] = XLSX.utils.sheet_to_json(sheet, {
//       defval: null
//     });

//     const bills: any[] = [];
//     const bulkOperations: any[] = [];

//     console.log("Total Excel rows:", rows.length);

//     for (let i = 0; i < rows.length; i++) {

//       const row = rows[i];

//       const customerCode = row["CustomerCode"] || row["customerCode"];

//       if (!customerCode) continue;

//       const customer = customerMap.get(customerCode.toString());

//       if (!customer) {
//         console.log("Customer not found:", customerCode);
//         continue;
//       }

//       const emiNo = row["SE_EMI_No"] || row["emiNo"];

//       const emiKey = `${emiNo}|${customer._id}`;

//       const emi = emiMap.get(emiKey);

//       const payDateF = row["PaidDate"];

//       function parseDDMMYYYY(dateString: string) {
//         const [day, month, year] = dateString.split("-").map(Number);
//         return new Date(year, month - 1, day);
//       }

//       let payDate = typeof payDateF === "string" ? parseDDMMYYYY(payDateF) : excelDateToJSDate(payDateF)

//       bills.push({
//         general: emi?.general || null,
//         customer: customer._id,
//         introducer: customer?.ddId || null,
//         introducerByModel: "MarketDetail",
//         customerCode: customerCode,
//         phone: row["Phone"],
//         paymentDate: payDate,
//         amountPaid: row["SE_EMI_Paid_Amt"],
//         bookingId: row["Booking_Id"],
//         emiNo: emiNo,
//         modeOfPayment: row["PayMode"],
//         remarks: row["Remarks"],
//         createdBy: row["CreatedBy"],
//         totalAmount: row["Total_Amount"],
//         balanceAmount: row["Total_Balance"],
//         emi: emi?._id || null,
//         oldData: true,
//         projectId: customer.projectId,
//         createdAt: new Date(),
//         updatedAt: new Date()
//       });

//       if (emi?._id) {
//         bulkOperations.push({
//           updateOne: {
//             filter: { _id: emi._id },
//             update: {
//               $set: {
//                 paidDate: payDate ? new Date(payDate) : null,
//                 paidAmt: row["SE_EMI_Paid_Amt"],
//                 update: true
//               }
//             }
//           }
//         });
//       }

//       if (i % 1000 === 0) {
//         console.log(`Processed ${i} rows`);
//       }
//     }

//     let batchSize = 1000;

//     for (let i = 0; i < bills.length; i += batchSize) {
//       const batch = bulkOperations.slice(i, i + batchSize);
//       let update = await Emi.bulkWrite(batch, { ordered: false });
//       console.log(`Processed batch ${i + batchSize}, matchecd ${update.matchedCount}, modified ${update.modifiedCount}`);
//     }

//     fs.writeFileSync(jsonPath, JSON.stringify(bills, null, 2));
//     fs.writeFileSync(emiPath, JSON.stringify(bulkOperations, null, 2));

//     console.log("🎉 Completed Successfully");

//     res.json({
//       success: true,
//       totalRows: rows.length,
//       bills: bills.length,
//       updates: bulkOperations.length,
//       billFile: jsonPath,
//       emiFile: emiPath
//     });

//   } catch (error) {

//     console.error(error);

//     res.status(500).json({
//       success: false,
//       message: "Internal server error"
//     });

//   }
// });

// bill count upload
// app.get("/emi-count", async (req: Request, res: Response) => {
//   try {
//     console.log("starting")
//     let getAllBill = await Billing.find({}).lean();
//     let billMap = new Map();

//     const outputDir = "./src/uploads/generated";

//     if (!fs.existsSync(outputDir)) {
//       fs.mkdirSync(outputDir, { recursive: true });
//     }

//     const jsonPath = path.join(
//       outputDir,
//       `bill-count-${Date.now()}.json`
//     );
//     for (let i = 0; i < getAllBill.length; i++) {
//       const element = getAllBill[i];
//       if(element.emi){
//         billMap.set(element.emi.toString(), element);
//       }
//     }
//     console.log(billMap.size, " size of emi " , getAllBill.length)

//     let bulkUpdate:any = []

//     let getAllEmi = await Emi.find({
//   $or: [
//     { paidDate: { $type: "number" } },


//     { paidDate: null }

//   ]
// }).lean();

//     for (let index = 0; index < getAllEmi.length; index++) {
//       const element = getAllEmi[index];

//       let getBill = billMap.get(element._id.toString());

//       if(getBill){
//         bulkUpdate.push({
//           updateOne: {
//             filter: { _id: element._id },
//             update: {
//               $set: {
//                 paidDate: getBill.paymentDate ? new Date(getBill.paymentDate) : null,
//                 paidAmt: getBill.amountPaid,
//                 update: true
//               }
//             }
//           }
//         })
//       }
//     }

//     let batchSize = 1000;

//     for (let i = 0; i < bulkUpdate.length; i += batchSize) {
//       const batch = bulkUpdate.slice(i, i + batchSize);
//       let update = await Emi.bulkWrite(batch, { ordered: false });
//       console.log(`Processed batch ${i + batchSize}, matched ${update.matchedCount}, modified ${update.modifiedCount}`);
//     }


//     // fs.writeFileSync(jsonPath, JSON.stringify(not, null, 2));

//     res.json({
//       success: true,
//       // totalRows: getAllEmi.length,
//       // updates: bulkUpdate.length,
//       emiFile: jsonPath
//     })

//   } catch (error) {

//     console.error(error);

//     res.status(500).json({
//       success: false,
//       message: "Internal server error"
//     });

//   }
// });

// app.get("/bulk/emi/paid",async(req,res)=>{
//   try{
//     let data=  [

// ]
//   let update = await Emi.bulkWrite(data)

//   console.log(update)

//   res.json("update")

// }catch(err){
//     res.json(err)

//   }
// })

// app.get("/bill-count", async (req: Request, res: Response) => {
//   try {
//     console.log("Starting EMI paidDate update...");

//     const BATCH_SIZE = 1000;
//     let bulkOps: any[] = [];
//     let totalProcessed = 0;
//     let totalUpdated = 0;

//     const cursor = Billing.find({

//     })
//       .select("emi paymentDate amountPaid")
//       .lean()
//       .cursor();

//     for await (const bill of cursor) {
//       totalProcessed++;

//       bulkOps.push({
//         updateOne: {
//           filter: { _id: bill.emi },
//           update: {
//             $set: { paidDate: bill.paymentDate, paidAmt: bill.amountPaid },
//           }
//         }
//       });

//       // console.log(`Prepared update for EMI: ${bill.emi} | Payment Date: ${bill.paymentDate}, Total Processed: ${totalProcessed}, ${bill.amountPaid}`);

//       // Execute batch
//       if (bulkOps.length === BATCH_SIZE) {
//         const result = await Emi.bulkWrite(bulkOps);
//         totalUpdated += result.modifiedCount;
//         bulkOps = [];
//         console.log(`Processed: ${totalProcessed} | matched: ${result.matchedCount} | Total Updated: ${result.modifiedCount}`); // Log batch results
//       }
//     }

//     // Run remaining updates
//     if (bulkOps.length > 0) {
//       const result = await Emi.bulkWrite(bulkOps);
//       totalUpdated += result.modifiedCount;
//       console.log(`Final Batch Processed: ${totalProcessed} | matched: ${result.matchedCount} | Total Updated: ${result.modifiedCount}`); 
//     }

//     console.log("EMI paidDate updated successfully");

//     return res.status(200).json({
//       success: true,
//       message: "EMI paidDate updated successfully",
//       totalProcessed,
//       totalUpdated
//     });

//   } catch (error) {
//     console.error("Error updating EMI paidDate:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error"
//     });
//   }
// })

// app.get("/update/id/:id", async (req: Request, res: Response) => {
//   try {
//     console.log("🚀 Starting General Update...");
//     let id = req.params.id;
//     let getCustomer;
//     let err;
//     [err, getCustomer] = await toAwait(Customer.find({ id: id }));
//     if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
//     if (!getCustomer) {
//       return ReE(res, { message: "customer not found given id" }, httpStatus.NOT_FOUND);
//     }
//     let customerNoBill:any[]=[]
//     let customerNoGen:any[]=[]
//     let customerNoEmi:any[]=[]
//     getCustomer = getCustomer as ICustomer[];
//     console.log(getCustomer.length, getCustomer)
//     for (let index = 0; index < getCustomer.length; index++) {
//       const element = getCustomer[index];

//       let getAllBilling;
//       [err, getAllBilling] = await toAwait(Billing.find({ customer: element._id }));
//       if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
//       if (!getAllBilling) {
//         return ReE(res, { message: "billing not found given id" }, httpStatus.NOT_FOUND);
//       }
//       getAllBilling = getAllBilling as IBilling[];

//       if(getAllBilling.length === 0){
//         customerNoBill.push(element._id)
//       }

//       let getAllGeneral;
//       [err, getAllGeneral] = await toAwait(General.find({ customer: element._id }));
//       if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
//       if (!getAllGeneral) {
//         return ReE(res, { message: "general not found given id" }, httpStatus.NOT_FOUND);
//       }
//       getAllGeneral = getAllGeneral as IGeneral[];

//       if(getAllGeneral.length === 0){
//         customerNoGen.push(element._id)
//       }

//       let getAllEmi;
//       [err, getAllEmi] = await toAwait(Emi.find({ customer: element._id }));
//       if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
//       if (!getAllEmi) {
//         return ReE(res, { message: "emi not found given id" }, httpStatus.NOT_FOUND);
//       }
//       getAllEmi = getAllEmi as IEmi[];

//       if(getAllEmi.length === 0){
//         customerNoEmi.push(element._id)
//       }

//     }

//     // let deleteBulk;
//     // [err,deleteBulk] = await toAwait(Billing.deleteMany({customer: {$in: customerNoBill}}))

//     let deleteCus;
//     [err,deleteCus] = await toAwait(Customer.deleteMany({_id: {$in: customerNoBill}}))


//     if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

//     ReS(res, { message: "customer updated successfully", data: {   customerNoBill, customerNoGen, customerNoEmi } }, httpStatus.OK);
//   } catch (error) {

//   }
// })

// app.get("/mass",  async (req: Request, res: Response) => {

//   try {
//     console.log("🚀 Starting General Update...");
//     let bulkUpdate:any[] = []
//     let notFound :any[] = []
//     let getAllCustomer = await Customer.find({}).lean();
//     let customerMap = new Map();
//     for (let index = 0; index < getAllCustomer.length; index++) {
//       const element = getAllCustomer[index];
//       customerMap.set(element._id.toString(), element)
//     }
//     let getAllEmi = await Emi.find().lean();
//     console.log(getAllEmi.length," getAllEmi length")
//     for (let index = 0; index < getAllEmi.length; index++) {
//       const element = getAllEmi[index];

//       let findCustomer = customerMap.get(element.customer?.toString())
//       if(findCustomer){
//         bulkUpdate.push({
//           updateOne: {
//             filter: { _id: element._id },
//             update: {
//               $set: {
//                 customerCode: findCustomer.id,
//                 supplierCode: findCustomer.id
//               }
//             }
//           }
//         })
//       }else{
//         notFound.push(element._id)
//       }

//       if(index % 1000 === 0){
//         console.log("🚀 ~ file: index.ts:429 ~ app.get ~ element:", index);
//       }

//     }

//     let BATCH_SIZE = 1000;
//     let totalProcessed = 0;
//     let totalUpdated = 0;
//     console.log(bulkUpdate.length)
//     for (let i = 0; i < bulkUpdate.length; i += BATCH_SIZE) {
//       let batch = bulkUpdate.slice(i, i + BATCH_SIZE);
//       let result = await Emi.bulkWrite(batch);
//       totalProcessed += batch.length;
//       totalUpdated += result.modifiedCount;
//       console.log(`✅ Updated ${i + batch.length} maches record of ${result.matchedCount} | Updated: ${result.modifiedCount}`);
//     }

//     const outputDir = "./src/uploads/generated";
//     const jsonPath = path.join(outputDir, `bill-count-hou${Date.now()}.json`);
//     fs.writeFileSync(jsonPath, JSON.stringify(bulkUpdate))

//     ReS(res, { message: "customer updated successfully", data: {data:bulkUpdate.length, emi: getAllEmi.length  } }, httpStatus.OK);
//   } catch (error:any) {
//     ReE(res, { message: error.message }, httpStatus.INTERNAL_SERVER_ERROR);
//   }

// })

//step 1
// app.get("/update/customer", async (req: Request, res: Response) => {
//   try {
//     let id = [
//       "LSSP(2)1744",
//       "LIP-4C-0008",
//       "LSSP(2)2858",
//       "LSSP(5)0035",
//       "NVT0313",
//       "LSG0041",
//       "NVT1340",
//       "LSSP(6)0004"
//     ]
//     let getAllCustomer = await Customer.find({ id: { $in: id } }).lean();
//     let customerMap = new Map();
//     let dupCus = []
//     for (let index = 0; index < getAllCustomer.length; index++) {
//       const element = getAllCustomer[index];
//       if (element.id && !customerMap.has(element.id.toString())) {
//         customerMap.set(element.id.toString(), element);
//       } else if (element.id && customerMap.has(element.id.toString())) {
//         dupCus.push(element._id)
//       }
//     }

//     // let bulk = await Customer.deleteMany({ _id: { $in: dupCus } });

//     // console.log(`update ${bulk.deletedCount}`)
//     res.json({ dupCus, getAllCustomer: customerMap.size, get: getAllCustomer.length })
//   } catch (err) {
//     ReE(res, { message: "Error fetching data" }, httpStatus.INTERNAL_SERVER_ERROR);
//   }
// })

//step 3 skip for alliance
// app.get("/update/general1",  async (req: Request, res: Response) => {
//   try {
//     const outputDir = "./src/uploads/General.json";
//     // let id= ["LJBN0013","LLD0016","LLD0022","LMC0022","LSN0005","LSN0021","LSN0034","LSN0066","LSN0071","LSSP(2)0017","LSSP(2)0071","LSSP(2)0383","LSSP(2)0518","LSSP(2)0672","LSSP(2)0738","LSSP(2)0947","LSSP(2)1252","LSSP(2)1333","LSSP(2)1336","LSSP(2)1344","LSSP(2)1395","LSSP(2)1472","LSSP(2)1481","LSSP(2)1486","LSSP(2)1709","LSSP(2)1906","LSSP(2)2130","LSSP(2)2132","LSSP(2)2150","LSSP(2)2207","LSSP(2)2487","LSSP(2)2536","LSSP(2)2538","LSSP(2)2543","LSSP(2)2558","LSSP(2)2561","LSSP(2)2625","LSSP(2)2662","LSSP(2)2833","LSSP(3)0032","LSSP(3)0367","LSSP(3)0799","LSSP(3)0807","LSSP(3)0828","LSSP(3)1136","LSSP(5)0033","NVT0007","NVT0020","NVT0023","NVT0032","NVT0103","NVT0106","NVT0117","NVT0121","NVT0125","NVT0157","NVT0166","NVT0174","NVT0227","NVT0252","NVT0273","NVT0282","NVT0291","NVT0295","NVT0312","NVT0378","NVT0487","NVT0488","NVT0502","NVT0566","NVT0768","NVT0851","NVT0856","NVT0885","NVT0921","NVT0928","NVT1012","NVT1227"]
//     let readJson = JSON.parse(fs.readFileSync(outputDir, "utf8"));
//     // let getAllCustomer = await Customer.find({id:{$in:readJson.map((element: any) => element.supplierCode)}}).lean();
//     let genMap = new Map();

//     let dupCus = []
//     let getAllGeneral = await General.find({supplierCode: {$in:readJson.map((element: any) => element.supplierCode)}}).lean();
//     for (let index = 0; index < getAllGeneral.length; index++) {
//       const element = getAllGeneral[index];
//       if (element.supplierCode && !genMap.has(element.supplierCode.toString()+"|"+element.noOfInstallments?.toString())) {
//         genMap.set(element.supplierCode.toString()+"|"+element.noOfInstallments?.toString(), element);
//       }else if(element.supplierCode && genMap.has(element.supplierCode.toString()+"|"+element.noOfInstallments?.toString())){
//         dupCus.push(element._id)
//       }
//       console.log("🚀 ~ file: index.ts:429 ~ app.get ~ element:"+ index + " " +genMap.has(element?.supplierCode?.toString()+"|"+element.noOfInstallments?.toString()))
//     }

//     // let bulk = await General.deleteMany({ _id: { $in: dupCus } });

//     // console.log(`update ${bulk.deletedCount}`)
//     // let getAllEmi = await Emi.find({customerCode: {$in:id }}).lean();
//     // for(let emi of getAllEmi){
//     //   let findCustomer = customerMap.get(emi.customerCode?.toString);
//     //   if(findCustomer){
//     //     await Emi.updateOne({ _id: emi._id }, {
//     //       $set: {
//     //         customerCode: findCustomer.id,
//     //         supplierCode: findCustomer.id
//     //       }
//     //     })
//     //   }
//     // }
//     res.json({dupCus,genmap:genMap.size, gen:getAllGeneral.length })
//   } catch (err) {
//     console.log(err)
//     ReE(res, { message: "Error fetching data" }, httpStatus.INTERNAL_SERVER_ERROR);
//   }
// })

//step 4
// app.get("/update/general2",  async (req: Request, res: Response) => {
//   try {
//     const outputDir = "./src/uploads/General.json";
//     let id= [
//       "LSSP(2)1744",
//       "LIP-4C-0008",
//       "LSSP(2)2858",
//       "LSSP(5)0035",
//       "NVT0313",
//       "LSG0041",
//       "NVT1340",
//       "LSSP(6)0004"
//     ]
//     // let readJson = JSON.parse(fs.readFileSync(outputDir, "utf8"));
//     let genMap = new Map();

//     let dupCus = []
//     let getAllGeneral = await General.find({supplierCode: {$in: id}}).lean();
//     for (let index = 0; index < getAllGeneral.length; index++) {
//       const element = getAllGeneral[index];
//       if (element.supplierCode && !genMap.has(element.supplierCode.toString())) {
//         genMap.set(element.supplierCode.toString(), element);
//       }else if(element.supplierCode && genMap.has(element.supplierCode.toString())){
//         dupCus.push(element._id)
//       }
//       console.log("🚀 ~ file: index.ts:429 ~ app.get ~ element:"+ index + " " +genMap.has(element?.supplierCode?.toString()+"|"+element.noOfInstallments?.toString()))
//     }

//     let bulk = await General.deleteMany({ _id: { $in: dupCus } });

//     console.log(`update ${bulk.deletedCount}`)
//     // let getAllEmi = await Emi.find({customerCode: {$in:id }}).lean();
//     // for(let emi of getAllEmi){
//     //   let findCustomer = customerMap.get(emi.customerCode?.toString);
//     //   if(findCustomer){
//     //     await Emi.updateOne({ _id: emi._id }, {
//     //       $set: {
//     //         customerCode: findCustomer.id,
//     //         supplierCode: findCustomer.id
//     //       }
//     //     })
//     //   }
//     // }
//     res.json({dupCus,genmap:genMap.size, gen:getAllGeneral.length })
//   } catch (err) {
//     console.log(err)
//     ReE(res, { message: "Error fetching data" }, httpStatus.INTERNAL_SERVER_ERROR);
//   }
// })

// app.get("/update/gen/code", async (req: Request, res: Response) => {
//   try {
//     let getAll = await Customer.find({}).lean();
//     let customerMap = new Map();
//     for (let index = 0; index < getAll.length; index++) {
//       const element = getAll[index];
//       if (element._id && !customerMap.has(element._id.toString())) {
//         customerMap.set(element._id.toString(), element);
//       }
//     }
//     let bulk :any[] =[]
//     let not :any[] =[]
//     let getAllGeneral = await General.find({supplierCode:null}).lean();
//     for (let index = 0; index < getAllGeneral.length; index++) {
//       const element = getAllGeneral[index];
//       let findCustomer = customerMap.get(element.customer?.toString());
//       if(findCustomer){
//         bulk.push({
//           updateOne: {
//             filter: { _id: element._id },
//             update: {
//               $set: {
//                 supplierCode: findCustomer.id
//               }
//             }
//           }
//         })
//       }else{
//         not.push(element._id)
//       }
//     }
//     let bulkRes = await General.bulkWrite(bulk);
//     console.log(bulkRes)
//     return res.json({not,bulk, gen:getAllGeneral.length })
//   } catch (error) {
//     res.json(error)
//   }
// })

//step 2
// app.get("/update/mass",  async (req: Request, res: Response) => {
//   try {
//     let id= [
//       "LSSP(2)1744",
//       "LIP-4C-0008",
//       "LSSP(2)2858",
//       "LSSP(5)0035",
//       "NVT0313",
//       "LSG0041",
//       "NVT1340",
//       "LSSP(6)0004"
//     ]
//     let getAllCustomer = await Customer.find({id:{$in:id}}).lean();
//     let customerMap = new Map();
//     let dupCus = []
//     for (let index = 0; index < getAllCustomer.length; index++) {
//       const element = getAllCustomer[index];
//       if (element.id && !customerMap.has(element.id.toString())) {
//         customerMap.set(element.id.toString(), element);
//       }
//     }

//     let emiBulk :any[] = []
//     let emiNot: any[] =[]
//     let genBulk :any[] = []
//     let genNot: any[] =[]
//     let billBulk :any[] = []
//     let billNot: any[] =[]

//     let getAllEmi = await Emi.find({customerCode: {$in:id }}).lean();
//     for(let emi of getAllEmi){
//       let findCustomer = customerMap.get(emi.customerCode?.toString());
//       if(findCustomer){
//         emiBulk.push({
//           updateOne: {
//             filter: { _id: emi._id },
//             update: {
//               $set: {
//                 customer: findCustomer._id
//               }
//             }
//           }
//         })
//       }else{
//         emiNot.push(emi.customerCode)
//       }
//     }
//     let getAllBill = await Billing.find({customerCode: {$in:id }}).lean();
//     for(let bill of getAllBill){
//       let findCustomer = customerMap.get(bill.customerCode?.toString());
//       if(findCustomer){
//         billBulk.push({
//           updateOne: {
//             filter: { _id: bill._id },
//             update: {
//               $set: {
//                 customer: findCustomer._id
//               }
//             }
//           }
//         })
//       }else{
//         billNot.push(bill.customerCode)
//       }
//     }

//     let getAllgen = await General.find({supplierCode: {$in:id }}).lean();
//     for(let gen of getAllgen){
//       let findCustomer = customerMap.get(gen.supplierCode?.toString());
//       console.log(gen.supplierCode,findCustomer, customerMap.size)
//       if(findCustomer){
//         genBulk.push({
//           updateOne: {
//             filter: { _id: gen._id },
//             update: {
//               $set: {
//                 customer: findCustomer._id
//               }
//             }
//           }
//         })
//       }else{
//         genNot.push(gen.supplierCode)
//       }
//     }

//     console.log(getAllBill.length," emi ",getAllEmi.length, " egn " , getAllgen.length)

//     const BATCH_SIZE = 1000;

//     for (let i = 0; i < emiBulk.length; i += BATCH_SIZE) {
//       const batch = emiBulk.slice(i, i + BATCH_SIZE);
//       let update = await Emi.bulkWrite(batch, { ordered: false });
//       console.log(`✅ Updated emi ${i + batch.length} maches record of ${update.matchedCount} | Updated: ${update.modifiedCount}`);
//     }
//     for (let i = 0; i < billBulk.length; i += BATCH_SIZE) {
//       const batch = billBulk.slice(i, i + BATCH_SIZE);
//       let update = await Billing.bulkWrite(batch, { ordered: false });
//       console.log(`✅ Updated bill ${i + batch.length} maches record of ${update.matchedCount} | Updated: ${update.modifiedCount}`);
//     }
//     for (let i = 0; i < genBulk.length; i += BATCH_SIZE) {
//       const batch = genBulk.slice(i, i + BATCH_SIZE);
//       let update = await General.bulkWrite(batch, { ordered: false });
//       console.log(`✅ Updated general ${i + batch.length} maches record of ${update.matchedCount} | Updated: ${update.modifiedCount}`);
//     }

//     const outputDir = "./src/uploads/generated";
//     const jsonPath = path.join(outputDir, `emi${Date.now()}.json`);
//     fs.writeFileSync(jsonPath, JSON.stringify(emiBulk))
//     const jsonPath1 = path.join(outputDir, `emiNot${Date.now()}.json`);
//     fs.writeFileSync(jsonPath1, JSON.stringify(emiNot))
//     const jsonPath2 = path.join(outputDir, `gen${Date.now()}.json`);
//     fs.writeFileSync(jsonPath2, JSON.stringify(genBulk))
//     const jsonPath3= path.join(outputDir, `gen${Date.now()}.json`);
//     fs.writeFileSync(jsonPath3, JSON.stringify(genNot))
//     const jsonPath4 = path.join(outputDir, `bill${Date.now()}.json`);
//     fs.writeFileSync(jsonPath4, JSON.stringify(billBulk))
//     const jsonPath5 = path.join(outputDir, `bill${Date.now()}.json`);
//     fs.writeFileSync(jsonPath5, JSON.stringify(billNot))

//     res.json({emi:emiBulk.length,emiNot:emiNot.length,gen:genBulk.length,genNot:genNot.length,bill:billBulk.length,billNot:billNot.length})
//   } catch (err) {
//     ReE(res, { message: "Error fetching data" }, httpStatus.INTERNAL_SERVER_ERROR);
//   }
// })

// app.get("/update/general",  async (req: Request, res: Response) => {
//   try {
//     let id= ["LASS-2-0329","LASS-2-0399","LASS-2-0405","LASS-2-0633","LASS-2-0700","LASS-2-1049","LASS-2-1164","LASS-2-1234","LASS-2-1477","LASS-2-1520","LASS-2-1736","LASS-2-1738","LASS-2-1821","LASS-2-1953","LASS-2-2034","LASS-2-2074","LASS-2-2112","LASS-2-2159","LASS-2-2372","LASS-2-2597","LASS-2-2642","LASS-2-2643","LASS-2-2645","LASS-2-2646","LASS-2-2647","LASS-2-2811","LASS-2-2812","LASS-2-2829","LASS-2-2917","LASS-2-2977","LASS-2-3014","LASS-2-3037","LASS-2-3286","LASS-2-3480","LASS-2-3567","LASS-2-3575","LASS-2-3576","LASS-2-3676","LASS-2-3688","LASS-2-4051","LASS-2-4667","LASS-2-4846","LASS-2-4856","LASS-2-5122","LASS-2-5333","LASS-2-5374","LASS-2-5379","LASS-2-5395","LASS-2-5532","LASS-2-5885","LASS-2-5977","LASS-3-0249","LASS-3-0264","LASS-3-0326","LASS-3-0943","LASS-3-0969","LASS-3-0977","LASS-3-1024","LASS-3-1109","LASS-3-1113","LASS-3-1258","LASS-3-1377","LASS-3-1496","LASS-3-1525","LASS-3-1598","LASS-3-1651","LASS-3-1838","LASS-3-1886","LASS-3-1918","LASS-3-1973","LASS-3-2069","LASS-3-2343","LASS-3-2561","LASS-3-2567","LASS-3-2973","LASS-3-2977","LASS-3-2987","LASS-4-0102","LASS-4-0319","LASS-5-0017","LASS-5-0043","LASS-5-0138","LASS-5-0336","LASS-9-0100","LASS-9-0542","LSS-1-0046","LSS-16-0480","LSS-16-0680","LSS-16-0690","LSS-16-1232","LSS-16-1661","LSS-16-1691","LSS-16-1715","LSS-16-1802","LSS-18-0103","LSS-18-0238","LSS-18-1104","LSS-18-1155","LSS-21-0161","LSS-22-0352","LSS-24-0007","LSS-24-0018","LSS-26-0250","LSS-26-0277","LSS-26-0356","LSS-26-0739","LSS-26-0865","LSS-26-0964","LSS-26-0967","LSS-26-0978","LSS-26-0988","LSS-26-1020","LSS-26-1054","LSS-26-1069","LSS-26-1152","LSS-26-1468","LSS-26-1541","LSS-26-1564","LSS-26-1633","LSS-26-1641","LSS-26-1642","LSS-26-1643","LSS-26-1644","LSS-26-1645","LSS-26-1646","LSS-26-1647","LSS-26-1648","LSS-26-1716","LSS-26-1725","LSS-26-1768","LSS-26-2025","LSS-26-2082","LSS-26-2087","LSS-26-2135","LSS-26-2521","LSS-26-2539","LSS-26-2797","LSS-26-3486","LSS-26-3682","LSS-26-4012","LSS-26-4036","LSS-26-4285","LSS-26-4776","LSS-26-4858","LSS-26-4883","LSS-26-5032","LSS-26-5046","LSS-26-5052","LSS-26-5277","LSS-26-5285","LSS-26-5540","LSS-26-5568","LSS-26-5814","LSS-26-5815","LSS-26-5822","LSS-26-5899","LSS-26-5922","LSS-26-6051","LSS-26-6321","LSS-26-6430","LSS-26-6444","LSS-26-6644","LSS-26-6655","LSS-26-6796","LSS-26-6978","LSS-26-7017","LSS-26-7104","LSS-26-7739","LSS-26-7808","LSS-26-7992","LSS-26-8072","LSS-26-8239","LSS-26-8265","LSS-26-8546","LSS-26-8661","LSS-26-8710","LSS-26-8741","LSS-26-8774","LSS-26-8775","LSS-26-8834","LSS-26-8837","LSS-26-8854","LSS-26-8856","LSS-26-8997","LSS-26-9024","LSS-26-9028","LSS-26-9043","LSS-26-9164","LSS-26-9187","LSS-26-9189","LSS-26-9262","LSS-29-0096","LSS-30-0028","LSS-5-0018","LSS-5-0128","LSS-5-0236","LSS-6-0152","LSS-6-0327","LSS-6-0452","LSS-6-0909","LSS-6-1252","LSS-6-1361","LSS-6-1372","LSS-6-1472","LSS-6-1476","LSS-6-1655","LSS-6-1759","LSS-6-1808","LSS-6-1945","LSS-6-1952","LSS-6-2228","LSS-6-2232","LSS-6-2281","LSS-6-2525","LSS-6-2823","LSS-6-2824","LSS-6-3169","LSS-6-3374","LSS-6-3447","LSS-6-3491","LSS-8-0419","LSS-8-0438","LSS-9-0087","LSS-9-0950","LSS-9-1103","LSS-9-1190"]
//     let getAllCustomer = await Customer.find({id:{$in:id}}).lean();
//     let customerMap = new Map();
//     let dupCus = []
//     for (let index = 0; index < getAllCustomer.length; index++) {
//       const element = getAllCustomer[index];
//       if (element.id && !customerMap.has(element.id.toString())) {
//         customerMap.set(element.id.toString(), element);
//       }
//     }

//     let emiBulk :any[] = []
//     let emiNot: any[] =[]
//     let genBulk :any[] = []
//     let genNot: any[] =[]
//     let billBulk :any[] = []
//     let billNot: any[] =[]

//     let getAllEmi = await Emi.find({customerCode: {$in:id }}).lean();
//     for(let emi of getAllEmi){
//       let findCustomer = customerMap.get(emi.customerCode?.toString());
//       if(findCustomer){
//         emiBulk.push({
//           updateOne: {
//             filter: { _id: emi._id },
//             update: {
//               $set: {
//                 customer: findCustomer._id
//               }
//             }
//           }
//         })
//       }else{
//         emiNot.push(emi.customerCode)
//       }
//     }
//     let getAllBill = await Billing.find({customerCode: {$in:id }}).lean();
//     for(let bill of getAllBill){
//       let findCustomer = customerMap.get(bill.customerCode?.toString());
//       if(findCustomer){
//         billBulk.push({
//           updateOne: {
//             filter: { _id: bill._id },
//             update: {
//               $set: {
//                 customer: findCustomer._id
//               }
//             }
//           }
//         })
//       }else{
//         billNot.push(bill.customerCode)
//       }
//     }

//     let getAllgen = await General.find({supplierCode: {$in:id }}).lean();
//     for(let gen of getAllgen){
//       let findCustomer = customerMap.get(gen.supplierCode?.toString());
//       console.log(gen.supplierCode,findCustomer, customerMap.size)
//       if(findCustomer){
//         genBulk.push({
//           updateOne: {
//             filter: { _id: gen._id },
//             update: {
//               $set: {
//                 customer: findCustomer._id
//               }
//             }
//           }
//         })
//       }else{
//         genNot.push(gen.supplierCode)
//       }
//     }

//     console.log(getAllBill.length," emi ",getAllEmi.length, " egn " , getAllgen.length)

//     const BATCH_SIZE = 1000;

//     for (let i = 0; i < emiBulk.length; i += BATCH_SIZE) {
//       const batch = emiBulk.slice(i, i + BATCH_SIZE);
//       let update = await Emi.bulkWrite(batch, { ordered: false });
//       console.log(`✅ Updated emi ${i + batch.length} maches record of ${update.matchedCount} | Updated: ${update.modifiedCount}`);
//     }
//     for (let i = 0; i < billBulk.length; i += BATCH_SIZE) {
//       const batch = billBulk.slice(i, i + BATCH_SIZE);
//       let update = await Billing.bulkWrite(batch, { ordered: false });
//       console.log(`✅ Updated bill ${i + batch.length} maches record of ${update.matchedCount} | Updated: ${update.modifiedCount}`);
//     }
//     for (let i = 0; i < genBulk.length; i += BATCH_SIZE) {
//       const batch = genBulk.slice(i, i + BATCH_SIZE);
//       let update = await General.bulkWrite(batch, { ordered: false });
//       console.log(`✅ Updated general ${i + batch.length} maches record of ${update.matchedCount} | Updated: ${update.modifiedCount}`);
//     }

//     const outputDir = "./src/uploads/generated";
//     const jsonPath = path.join(outputDir, `emi${Date.now()}.json`);
//     fs.writeFileSync(jsonPath, JSON.stringify(emiBulk))
//     const jsonPath1 = path.join(outputDir, `emiNot${Date.now()}.json`);
//     fs.writeFileSync(jsonPath1, JSON.stringify(emiNot))
//     const jsonPath2 = path.join(outputDir, `gen${Date.now()}.json`);
//     fs.writeFileSync(jsonPath2, JSON.stringify(genBulk))
//     const jsonPath3= path.join(outputDir, `gen${Date.now()}.json`);
//     fs.writeFileSync(jsonPath3, JSON.stringify(genNot))
//     const jsonPath4 = path.join(outputDir, `bill${Date.now()}.json`);
//     fs.writeFileSync(jsonPath4, JSON.stringify(billBulk))
//     const jsonPath5 = path.join(outputDir, `bill${Date.now()}.json`);
//     fs.writeFileSync(jsonPath5, JSON.stringify(billNot))

//     res.json({emi:emiBulk.length,emiNot:emiNot.length,gen:genBulk.length,genNot:genNot.length,bill:billBulk.length,billNot:billNot.length})
//   } catch (err) {
//     ReE(res, { message: "Error fetching data" }, httpStatus.INTERNAL_SERVER_ERROR);
//   }
// })

//step 5
// app.get("/update/bill",  async (req: Request, res: Response) => {
//   try {
//     let id= [
//       "LSSP(2)1744",
//       "LIP-4C-0008",
//       "LSSP(2)2858",
//       "LSSP(5)0035",
//       "NVT0313",
//       "LSG0041",
//       "NVT1340",
//       "LSSP(6)0004"
//     ]
//     let getAllCustomer = await General.find({supplierCode:{$in:id}}).lean();
//     let genMap = new Map();
//     let dupCus = []
//     for (let index = 0; index < getAllCustomer.length; index++) {
//       const element = getAllCustomer[index];
//       if (element.supplierCode && !genMap.has(element.supplierCode.toString())) {
//         genMap.set(element.supplierCode.toString(), element);
//       }
//     }

//     let billBulk :any[] = []
//     let billNot: any[] =[]

//     let getAllBill = await Billing.find({customerCode: {$in:id }}).lean();
//     for(let bill of getAllBill){
//       let findgen = genMap.get(bill.customerCode?.toString());
//       if(findgen){
//         billBulk.push({
//           updateOne: {
//             filter: { _id: bill._id },
//             update: {
//               $set: {
//                 general: findgen._id
//               }
//             }
//           }
//         })
//       }else{
//         billNot.push(bill.customerCode)
//       }
//     }

//     const BATCH_SIZE = 1000;

//     for (let i = 0; i < billBulk.length; i += BATCH_SIZE) {
//       const batch = billBulk.slice(i, i + BATCH_SIZE);
//       let update = await Billing.bulkWrite(batch, { ordered: false });
//       console.log(`✅ Updated bill ${i + batch.length} maches record of ${update.matchedCount} | Updated: ${update.modifiedCount}`);
//     }

//     const outputDir = "./src/uploads/generated";
//     const jsonPath4 = path.join(outputDir, `bill${Date.now()}.json`);
//     fs.writeFileSync(jsonPath4, JSON.stringify(billBulk))
//     const jsonPath5 = path.join(outputDir, `bill${Date.now()}.json`);
//     fs.writeFileSync(jsonPath5, JSON.stringify(billNot))

//     res.json({bill:billBulk.length,billNot:billNot.length})
//   } catch (err) {
//     ReE(res, { message: "Error fetching data" }, httpStatus.INTERNAL_SERVER_ERROR);
//   }
// })


//step 6
// app.get("/get/emi/null", async (req, res) => {
//   try {
//     console.log("start")
//     let getAllEmi = await General.aggregate([
//   {
//     $lookup: {
//       from: "emis",
//       localField: "_id",
//       foreignField: "general",
//       as: "emiData"
//     }
//   },
//   {
//     $match: {
//       emiData: { $eq: [] }
//     }
//   },
//   {
//     $project: {
//       _id: 1
//     }
//   }
// ])

// let deleteEmi = await Emi.deleteMany({
//   _id: {
//     $in: getAllEmi.map((emi) => emi._id)
//   }
// })

// console.log(getAllEmi.length,"getAllEmi")

// let getAllEmis = await Emi.find({}).lean();

// let emiMap = new Map();
// for (let index = 0; index < getAllEmis.length; index++) {
//   const element = getAllEmis[index];
//   if(element.customer && element.emiNo){
//     emiMap.set(element.customer.toString()+"|"+element.emiNo.toString(), element);
//   }
// }

// console.log(`process starting emi ${getAllEmi.length} , emiMap ${emiMap.size}`)
// let bulkOperations: any[] = [];
// let notFound: any[] = [];
// for (let index = 0; index < getAllEmi.length; index++) {
//   const element = getAllEmi[index];

//   let findEmi = emiMap.get(element.customer?.toString()+"|"+element.emiNo?.toString());
//   if(findEmi){
//     bulkOperations.push({
//       updateOne: {
//         filter: { _id: element._id },
//         update: {
//           $set: {
//             emi: findEmi._id
//           }
//         }
//       }
//     })
//   }else{
//     notFound.push({customer:element.customer,emiNo:element.emi, customerCode:element.customerCode})
//   }
// }

// let batchSize = 1000;
// for (let i = 0; i < bulkOperations.length; i += batchSize) {
//   const batch = bulkOperations.slice(i, i + batchSize);
//   let update = await Billing.bulkWrite(batch, { ordered: false });
//   console.log(`Processed batch ${i + batchSize}, matched ${update.matchedCount}, modified ${update.modifiedCount}`);
// }

// let outputDir = "./src/uploads/generated";
// let jsonPath4 = path.join(outputDir, `emi-found${Date.now()}.json`);
// fs.writeFileSync(jsonPath4, JSON.stringify(bulkOperations))
// let jsonPath5 = path.join(outputDir, `emi-not-found${Date.now()}.json`);
// fs.writeFileSync(jsonPath5, JSON.stringify(notFound))

//   res.json(getAllEmi.map(ele=>ele._id))
// } catch (err) {
//   ReE(res, { message: "Error fetching data" }, httpStatus.INTERNAL_SERVER_ERROR);
// }
// })

// app.get("/cus/dup", async (req: Request, res: Response) => {
//   try {
//     let getAllCustomer = await Billing.aggregate([
//   {
//     $lookup: {
//       from: "emis",
//       localField: "emi",
//       foreignField: "_id",
//       as: "emiData"
//     }
//   },
//   {
//     $unwind: {
//       path: "$emiData",
//       preserveNullAndEmptyArrays: true
//     }
//   },
//   {
//     $match: {
//       $or: [
//         { "emiData.paidDate": { $exists: false } },
//         { "emiData.paidDate": null }
//       ]
//     }
//   }
// ]);


//     // let deletedBill:any = []

//     // for (let index = 0; index < getAllCustomer.length; index++) {
//     //   const element = getAllCustomer[index];

//     //   let billCount1 = element.billingDocs[0]
//     //   let billCount2 = element.billingDocs[1]
//     //   if(billCount1.customer.toString() === billCount2.customer.toString() && billCount1.emiNo.toString() === billCount2.emiNo.toString() && billCount1.paymentDate.toString().split("T")[0] === billCount2.paymentDate.toString().split("T")[0] && billCount1.amountPaid === billCount2.amountPaid ){
//     //     console.log(billCount1.customer.toString() , billCount2.customer.toString(), billCount1.customer.toString() === billCount2.customer.toString() ,"mass", billCount1.emiNo , billCount2.emiNo , billCount1.emiNo === billCount2.emiNo ,"mass", billCount1.paymentDate.toString().split("T")[0] , billCount2.paymentDate.toString().split("T")[0] , billCount1.paymentDate.toString().split("T")[0] === billCount2.paymentDate.toString().split("T")[0],"mass", billCount1.amountPaid , billCount2.amountPaid ,billCount1.amountPaid === billCount2.amountPaid ,"mass")
//     //     deletedBill.push(billCount1)
//     //   }else{
//     //     console.log(billCount1.customer.toString() , billCount2.customer.toString(), billCount1.customer.toString() === billCount2.customer.toString() ,"mass", billCount1.emiNo , billCount2.emiNo , billCount1.emiNo === billCount2.emiNo ,"mass", billCount1.paymentDate.toString().split("T")[0] , billCount2.paymentDate.toString().split("T")[0] , billCount1.paymentDate.toString().split("T")[0] === billCount2.paymentDate.toString().split("T")[0],"mass", billCount1.amountPaid , billCount2.amountPaid ,billCount1.amountPaid === billCount2.amountPaid ,"mass")

//     //   }     
//     // }

//     let outputDir = "./src/uploads/generated";
//     let jsonPath4 = path.join(outputDir, `emi-found${Date.now()}.json`);
//     fs.writeFileSync(jsonPath4, JSON.stringify(getAllCustomer))

//     console.log(getAllCustomer.length)

//     res.json({ dup: getAllCustomer })
//   } catch (err) {
//     console.log(err)
//     ReE(res, { message: "Error fetching data" }, httpStatus.INTERNAL_SERVER_ERROR);
//   }
// })


// app.get("/emi/test", async (req, res) => {
//   try {
//     const emis = await Billing.find({ customerCode: "LAC-P2-0030" }).populate("customer");
//     let err, app = [];
//     for (let index = 0; index < emis.length; index++) {
//       const element = emis[index];

//       let getCommission = await convertCommissionToMarketer(
//         element.customer,
//         element.amountPaid,
//       );

//       if (!getCommission.success) {

//         // return ReE(
//         //   res,
//         //   { message: getCommission.message },
//         //   httpStatus.INTERNAL_SERVER_ERROR,
//         // );
//       }

//       app.push({
//         bill: element?._id,
//         customer: element.customer?._id,
//         emiId: element.emi,
//         paymentDate: element?.paymentDate,
//         customerCode: element.customerCode,
//         amount: element.amountPaid,
//         marketer: getCommission.data,
//       })

//       // res.json(app);
//     }


//     let bulk = await Commission.insertMany(app);
//     return res.json({ success: true, data: app });
//   } catch (err) {
//     console.error("EMI test error:", err);
//     return res.status(500).json({ success: false, message: "Internal server error" });
//   }
// })
