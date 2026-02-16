import mongoose, { model, Schema } from "mongoose";

const GeneralSchema = new Schema(
  {
    customer: {
      type:Schema.Types.ObjectId,
      ref: "Customer",
    },
    marketer: {
      type: Schema.Types.ObjectId,
      refPath: 'marketerByModel'
    },
    marketerByModel: {
      type: String,
      required: true,
      default: "MarketDetail",
      enum: ["MarketDetail", "MarketingHead"]
    },
    project: {
      type:Schema.Types.ObjectId,
      ref: "Project",
    },
    saleDeedDoc: {
      type: String,
    },
    paymentTerms: {
      type: String,
    },
    percentage: {
      type: Number,
      // required: true,
      min: 0,
      max: 100,
    },
    emiAmount: {
      type: Number,
    },
    noOfInstallments: {
      type: Number,
    },
    motherDoc: {
      type: String,
    },
    status: {
      type: String,
      // enum: ["Enquired", "Blocked", "Vacant","Enquiry"],
      // required: true,
    },
    loan: {
      type: String,
    },
    offered: {
      type: String,
    },
    editDeleteReason: {
      type: String,
    },

    oldData: {
      type: Boolean,
      default: false
    },
    sSalesNo: {
      type: String,
    },
    supplierCode: {
      type: String,
    },
    customerName: {
      type: String,
    },
    sMarketerId: {
      type: String,
    },
    sBookedDate: {
      type: String,
    },
    createdOn: {
      type: String,
    },
    modifiedOn: {
      type: String,
    },
    push:{
      type:Boolean,
      default:true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    totalAmount: {
      type: Number,
    },
  },

  { timestamps: true }
);

export const General = model("General", GeneralSchema);