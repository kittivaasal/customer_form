import mongoose, { Schema, Document } from "mongoose";
import { IActivityLog } from "../type/activityLog";

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    action: {
      type: String,
      enum: ["CREATE", "UPDATE", "DELETE", "BILLING REQUEST"],
      required: true,
    },
    billingRequestAction: {
      type: String,
      enum: ["CREATE", "UPDATE", "DOWNLOAD", "DELETE"],
    },
    collectionName: {
      type: String,
    },
    documentId: {
      type: Schema.Types.Mixed,
    },
    oldData: {
      type: Schema.Types.Mixed,
    },
    newData: {
      type: Schema.Types.Mixed,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    requestBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    date: {
      type: Date,
      default: Date.now()
    },
    message: {
      type: String
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export default mongoose.model<IActivityLog>(
  "ActivityLog",
  ActivityLogSchema
);