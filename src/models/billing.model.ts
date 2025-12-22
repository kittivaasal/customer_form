import mongoose, { Schema } from "mongoose";
import { IBilling } from "../type/billing";

const BillingSchema: Schema = new Schema<IBilling>(
  {
    mobileNo: {
      type: String,
    //   required: true,
    //   trim: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
    //   required: true,
    },
    general: {
      type: Schema.Types.ObjectId,
      ref: "General",
    //   required: true,
    },
    transactionType: {
      type: String,
      enum: ["EMI Receipt", "Other"],
    //   required: true,
    },
    customerName: {
      type: String,
    //   required: true,
    //   trim: true,
    },
    billingId: {
      type: String,
    //   required: true,
    //   unique: true, // e.g., 6735:2-Sep
    },
    balanceAmount: {
      type: Number,
    //   required: true,
    },
    modeOfPayment: {
      type: String,
      enum: ["Cash", "Card", "Online"],
    //   required: true,
    },
    cardNo: {
      type: String,
    //   required: function (this: IBilling) {
    //     return this.modeOfPayment === "card";
    //   },
    },
    cardHolderName: {
      type: String,
    //   required: function (this: IBilling) {
    //     return this.modeOfPayment === "card";
    //   },
    },
    paymentDate: {
      type: Date,
      required: true,
    },
    emiNo: {
      type: Number,
    //   required: true,
    },
    emi:{
      type: Schema.Types.ObjectId,
      ref: 'Emi'
    },
    amountPaid: {
      type: Number,
    //   required: true,
    },
    saleType: {
      type: String,
      enum: ["Plot", "Flat", "Villa"],
    //   required: true,
    },
    introducer: {
      type: Schema.Types.ObjectId,
      ref: "MarketingHead",
    },
    status: {
      type: String,
      enum: ["Enquiry", "Blocked"],
    },
    remarks: {
      type: String,
    },
    editDeleteReason: {
      type: String,
    },
    oldData:{
      type:Boolean,
      default:false
    },
    
    project: {
      type: String,
    },
    SPartycode: {
      type: String,
    },
    customerCode: {
      type: String,
    },
    phone: {
      type: String,
    },
    marketerName: {
      type: String,
    },
    matketerID: {
      type: String,
    },
    leader: {
      type: String,
    },
    leaderID: {
      type: String,
    },
    paidDate: {
      type: String,
    },
    SEEMIPaidAmt: {
      type: String,
    },
    bookingId: {
      type: String,
    },
    plotNo: {
      type: String,
    },
    SEEMINo: {
      type: String,
    },
    payMode: {
      type: String,
    },
    createdBy: {
      type: String,
    },
    totalAmount: {
      type: String,
    },
    totalPaid: {
      type: String,
    },
    totalBalance: {
      type: String,
    },
  },
  { timestamps: true }
);

export const Billing = mongoose.model<IBilling>("Billing", BillingSchema);
