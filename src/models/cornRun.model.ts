import mongoose, { Schema, Document } from "mongoose";
import { ICornRun } from "../type/cornRun";

const CornRunSchema = new Schema<ICornRun>(
  {
    runDate: {
        type: Date,
    },
    monthstart: {
        type: Date,
    },
    startDate: {
        type: Date,
    },
    endDate: {
        type: Date,
    },
    for:{
        type: String,
    },
    error: {
        type: String,
    },
    stack: {
        type: String,
    },
    generalIds: [
        {
            type: Schema.Types.ObjectId,
            ref: "General",
        }
    ],
    emiIds: [
        {
            type: Schema.Types.ObjectId,
            ref: "Emi",
        }
    ],
    message: {
      type: String
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export default mongoose.model<ICornRun>(
  "CornRun",
  CornRunSchema
);