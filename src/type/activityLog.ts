import mongoose from "mongoose";

export interface IActivityLog extends Document {
  action: "CREATE" | "UPDATE" | "DELETE" | "BILLING REQUEST" ;
  billingRequestAction?: "CREATE" | "UPDATE" | "DOWNLOAD";
  collectionName: string;
  documentId: mongoose.Types.ObjectId;
  oldData?: any;
  newData?: any;
  userId?: mongoose.Types.ObjectId;
  createdAt: Date;
  message?: string;
  date: Date;
}