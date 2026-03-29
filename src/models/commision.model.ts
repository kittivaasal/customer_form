import { Schema, model } from "mongoose";

/* ================================
   TypeScript Interfaces
================================ */

/** Marketer commission entry */
export interface IMarketerCommission {
  name: string;
  marketerId: Schema.Types.ObjectId;
  marketerModel: "MarketingHead" | "MarketDetail";
  percentage: string;   // "1%"
  emiAmount: string;    // "1000"
  commAmount: string;   // "10"
}

/** Main document */
export interface ICommission {
  _id: Schema.Types.ObjectId;
  customer: Schema.Types.ObjectId;
  name: string;          // customer name
  customerCode: string;
  bill: Schema.Types.ObjectId;
  emiId: Schema.Types.ObjectId;
  emiNo: Number;
  paymentDate: Date;
  marketer: IMarketerCommission[];
}

/** Marketer sub-schema */
const marketerSchema = new Schema<IMarketerCommission>(
  {
    name: {
      type: String,
      // required: true,
      trim: true,
    },
    marketerId: {
      type: Schema.Types.ObjectId,
      refPath: "marketer.marketerModel",
      required: true,
    },
    marketerModel: {
      type: String,
      required: true,
      enum: ["MarketingHead", "MarketDetail"],
    },
    percentage: {
      type: String,
      required: true,
    },
    emiAmount: {
      type: String,
      // required: true,
    },
    commAmount: {
      type: String,
      // required: true,
    },
  },
  {
    _id: false,
  }
);

const allianceCommissionSchema = new Schema<ICommission>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    name: {
      type: String,
      // required: true,
      trim: true,
    },
    customerCode: {
      type: String,
      // required: true,
      // trim: true,
    },
    bill: {
      type: Schema.Types.ObjectId,
      ref: "Billing",
      required: true,
    },
    emiId: {
      type: Schema.Types.ObjectId,
      ref: "Emi"
    },
    emiNo: {
      type: Number,
    },
    paymentDate: {
      type: Date
    },
    marketer: {
      type: [marketerSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "alliancecommission",
  }
);

/* ================================
   Indexes
================================ */

allianceCommissionSchema.index({ "marketer.marketerId": 1 })

/* ================================
   Model Export
================================ */

export const Commission = model<ICommission>(
  "Commission",
  allianceCommissionSchema
);
