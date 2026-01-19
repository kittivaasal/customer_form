import mongoose from "mongoose";

export interface IEmi {
    _id:  mongoose.Types.ObjectId;
    customer:  mongoose.Types.ObjectId;
    general:  mongoose.Types.ObjectId;
    emiNo: number;
    date: Date;
    emiAmt: number;
    paidDate?: Date;
    paidAmt?: number;
    jpd?: string;
    createdAt?: Date;
    updatedAt?: Date;

    oldData?: boolean
    payRef?: string;
    supplierCode?: string;
    customerName?: string;
    sSalesNo?: string;
    createdDate?: string;
    modifyDate?: string;
}