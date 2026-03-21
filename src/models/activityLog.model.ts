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
      enum: ["CREATE", "UPDATE", "DOWNLOAD"]
    },
    collectionName: {
      type: String,
      required: true,
    },
    documentId: {
      type: String,
      required: true,
    },
    oldData: {
      type: Schema.Types.Mixed,
    },
    newData: {
      type: Schema.Types.Mixed,
    },
    userId: {
      type: String,
    },
    date: {
      type: Date,
      default: Date.now
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