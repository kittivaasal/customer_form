import { model, Schema } from "mongoose";
import { Types } from "mongoose";
import { Percentage } from "./percentage.model";

const MarketerSchema = new Schema(
  {
    customer: { type: Types.ObjectId, ref: "Customer"},
    emi: { type: Types.ObjectId, ref: "EMI" },
    bill: { type: Types.ObjectId, ref: "Billing" },
    marketer:[
      {
        marketerId: { type: Types.ObjectId, refPath : "marketer.marketerModel" },
        marketerModel:{
          type: String,
          default: "MarketDetail",
          enum: [ "MarketDetail", "MarketingHead" ]
        },
        Percentage: { type: String },
        emiAmount: { type: String },
        commAmount: { type: String },
      }
    ],
  },
  { timestamps: true } // adds createdAt and updatedAt
);

export const Marketer = model("Marketer", MarketerSchema);
