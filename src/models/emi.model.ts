import mongoose, { model, Schema } from "mongoose";
import { IEmi } from "../type/emi";

const EmiSchema = new Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
    },
    general: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "General",
    },
    emiNo: { type: Number },
    date: { type: Date },
    emiAmt: { type: Number },
    paidDate: { type: Date },
    paidAmt: { type: Number },
    jpd: { type: String },

    oldData: {type:Boolean,default:false},
    payRef: { type: String },
    supplierCode: { type: String },
    customerName: { type: String },
    sSalesNo: { type: String },
    createdDate: { type: Date },
    modifyDate: { type: Date },
},{ timestamps: true });

export const Emi = model("Emi", EmiSchema);