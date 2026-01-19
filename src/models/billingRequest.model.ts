import mongoose, { Schema } from "mongoose";
import { IBilling } from "../type/billing";
import { IBillingRequest } from "../type/billingRequest";

const BillingRequestSchema: Schema = new Schema<IBillingRequest>(
    {
        approvedValidity: {
            type: Date
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        customerId: {
            type: Schema.Types.ObjectId,
            ref: "Customer", 
        },
        message: {
            type: String
        },
        requestFor: {
            type: String
        },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending"
        },
        approvedBy: {
            type: String
        },
        createBill: [],
        emi: [
            {
                type: Schema.Types.ObjectId,
                ref: "Emi"
            }
        ],
        billingDetails: {
            saleType: {
                type: String
            },
            modeOfPayment: {
                type: String
            },
            paymentDate: {
                type: Date
            },
            cardHolderName: {
                type: String
            },
            remarks: {
                type: String
            },
            cardNo: {
                type: String
            },
            referenceId:{
                type: String
            }
        },
        reason: {
            type: String
        },
        approvedTime: {
            type: Date
        },
        approvedDate: {
            type: Date
        },
        excelFromDate: {
            type: Date
        },
        excelToDate: {
            type: Date
        },
    },
    { timestamps: true }
);

export const BillingRequest = mongoose.model<IBillingRequest>("BillingRequest", BillingRequestSchema);
