import mongoose, { Schema, Document } from "mongoose";

export interface IBilling extends Document {
    _id: mongoose.Types.ObjectId;
    mobileNo: string;
    customer: mongoose.Types.ObjectId;
    general: mongoose.Types.ObjectId;
    transactionType: "EMI Receipt" | "Other";
    referenceId: string;
    customerName: string;
    id: string;
    billingId: string; // e.g., 6735:2-Sep
    balanceAmount: number;
    modeOfPayment: "cash" | "card" | "online";
    cardNo?: string;
    cardHolderName?: string;
    paymentDate: Date;
    emiNo: number;
    emi : mongoose.Types.ObjectId;
    amountPaid: number;
    saleType: "plot" | "flat" | "villa";
    introducer: mongoose.Types.ObjectId;
    status: "enquiry" | "blocked" | "active";
    remarks?: string;
    billFor?: string;
    editDeleteReason?: string;
    introducerByModel: "MarketDetail" | "MarketingHead" ;

    oldData?: boolean
    project?: string;	
    SPartycode?: string;
    customerCode?: string;
    phone?: string;
    marketerName?: string;
    matketerID?: string;
    leader?: string;
    leaderID?: string;
    paidDate?: string;
    SEEMIPaidAmt?: string;
    bookingId?: string;
    plotNo?: string;
    SEEMINo?: string;
    payMode?: string;
    createdBy?: mongoose.Types.ObjectId;
    totalAmount?: string;
    totalPaid?: string;
    totalBalance?: string;

    TType?: string;
    product?: string;
    EMIDate?: string;
    SEEMIAmt?: string;
    SEBalanceAmt?: string;
    push?: boolean;
}