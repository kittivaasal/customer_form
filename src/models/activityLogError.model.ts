import mongoose, { Schema, Document } from "mongoose";
import { IActivityLogError } from "../type/activityLogError";

const ActivityLogErrorSchema = new Schema<IActivityLogError>(
  {
    data: {
      type: Schema.Types.Mixed,
    },
    date: {
      type: Date,
      default: Date.now()
    },
    errorMsg: {
      type: String
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export default mongoose.model<IActivityLogError>(
  "ActivityLogError",
  ActivityLogErrorSchema
);