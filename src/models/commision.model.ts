import { model, Schema } from "mongoose";

/* ================================
   TypeScript Interfaces
================================ */

/** Marketer commission entry */
export interface IMarketerCommission {
  marketerId: string;
  marketerModel: "MarketingHead" | "MarketDetail";
  percentage: string;   // "1%"
  emiAmount: string;    // "1300"
  commAmount: string;   // "13"
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
export interface ICustomerEmi {
  customer: string;
  bill: string;
  emi: IEmiInfo;
  marketer: IMarketerCommission[];
}

/* ================================
   Sub Schemas
================================ */

/** Marketer sub-schema */
const marketerSchema = new Schema<IMarketerCommission>(
  {
    marketerId: {
      type: String,
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
      required: true,
    },
    commAmount: {
      type: String,
      required: true,
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

const customerEmiSchema = new Schema<ICustomerEmi>(
  {
    customer: {
      type: String,
      required: true,
    },
    bill: {
      type: String,
      required: true,
    },
    emi: {
      type: emiSchema,
      required: true,
    },
    marketer: {
      type: [marketerSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "alliancecommission", // 👈 explicit collection name
  }
);

/* ================================
   Model Export
================================ */

export const CustomerEmiModel = model<ICustomerEmi>(
  "AllianceCommission",
  customerEmiSchema
);
