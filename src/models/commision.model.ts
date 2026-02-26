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

/** EMI embedded object */
export interface IEmiInfo {
  _id: string;
  push: boolean;
  general: string;
  customer: string;
  emiNo: number;
  date: Date;
  paidDate?: Date;
  paidAmt?: number;
  payRef?: string;
  oldData: boolean;
  oldDate: boolean;
  emiAmt: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Main document */
export interface IAllianceCommission {
  customer: Schema.Types.ObjectId;
  name: string;          // customer name
  customerCode: string;
  bill: Schema.Types.ObjectId;
  emiId:Schema.Types.ObjectId;
  emi: IEmiInfo;
  marketer: IMarketerCommission[];
}

/* ================================
   Sub Schemas
================================ */

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

/** EMI sub-schema */
const emiSchema = new Schema<IEmiInfo>(
  {
    _id: {
      type: String,
      required: true,
    },
    push: {
      type: Boolean,
      required: true,
    },
    general: {
      type: String,
      required: true,
    },
    customer: {
      type: String,
      required: true,
    },
    emiNo: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    paidDate: {
      type: Date,
    },
    paidAmt: {
      type: Number,
    },
    payRef: {
      type: String,
    },
    oldData: {
      type: Boolean,
      default: false,
    },
    oldDate: {
      type: Boolean,
      default: false,
    },
    emiAmt: {
      type: Number,
      required: true,
    },
    createdAt: {
      type: Date,
    },
    updatedAt: {
      type: Date,
    },
  },
  {
    _id: false,
  }
);

/* ================================
   Main Schema
================================ */

const allianceCommissionSchema = new Schema<IAllianceCommission>(
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
    emi: {
      type: emiSchema,
      // required: true,
    },
    emiId: {
      type: Schema.Types.ObjectId,
      ref: "Emi"
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
   Model Export
================================ */

export const CustomerEmiModel = model<IAllianceCommission>(
  "AllianceCommission",
  allianceCommissionSchema
);
