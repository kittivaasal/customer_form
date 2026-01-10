import mongoose from "mongoose"

export interface IBillingRequest {
    id?: string,
    approvedValidity?: Date,
    userId: mongoose.Types.ObjectId,
    message: string,
    status: "pending" | "approved" | "rejected",
    approvedBy?:  mongoose.Types.ObjectId,
    approvedDate?: Date
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
    },
}