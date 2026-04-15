import mongoose, { Schema } from "mongoose";

export interface IReportJob {
  _id?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  billingRequestId?: mongoose.Types.ObjectId;
  params: {
    dateFrom?: string;
    dateTo?: string;
    date?: string;
    status?: string;
    blocked?: string;
    projectId?: string;
    customerId?: string;
  };
  status: "queued" | "processing" | "done" | "failed";
  fileUrl?: string;
  errorMessage?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const ReportJobSchema: Schema = new Schema<IReportJob>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    billingRequestId: { type: Schema.Types.ObjectId, ref: "BillingRequest" },
    params: {
      dateFrom: String,
      dateTo: String,
      date: String,
      status: String,
      blocked: String,
      projectId: String,
      customerId: String,
    },
    status: {
      type: String,
      enum: ["queued", "processing", "done", "failed"],
      default: "queued",
    },
    fileUrl: String,
    errorMessage: String,
  },
  { timestamps: true },
);

export const ReportJob = mongoose.model<IReportJob>("ReportJob", ReportJobSchema);
