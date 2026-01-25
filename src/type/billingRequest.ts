import mongoose from "mongoose"

export interface IBillingRequest {
    _id?: mongoose.Types.ObjectId,
    id?: string,
    approvedValidity?: Date,
    userId: mongoose.Types.ObjectId,
    message: string,
    status: "pending" | "approved" | "rejected",
    approvedBy?:  mongoose.Types.ObjectId,
    customerId?:  mongoose.Types.ObjectId,
    approvedDate?: Date
    approvedTime?: Date
    excelFromDate?: Date    
    excelToDate?: Date
    requestFor?: string,
    emi: [],
    createBill:[],
    reason?: string,
    billingDetails?: {
        saleType?: string
        modeOfPayment?: string
        paymentDate?: Date
        cardHolderName?: string
        remarks?: string
        cardNo?: string
        referenceId?: String
        billFor?: string
    },
}