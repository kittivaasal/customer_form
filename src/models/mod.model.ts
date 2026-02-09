import mongoose, { Schema } from "mongoose";

const modSchema = new mongoose.Schema({
  paidDate: {
    type: String
  },
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  plotNo: {
    type: String
  },
  landCost: {
    type: Number,
    default: 0
  },
  ratePerSqft: {
    type: Number,
    default: 0
  },
  referenceId: {
    type: String
  },
  customerId: {
    type: Schema.Types.ObjectId,
    ref: 'ModCustomer',
    required: true
  },
  introducerName: {
    type: String
  },
  introducerPhone: {
    type: String
  },
  directorName: {
    type: String
  },
  directorPhone: {
    type: String
  },
  EDName: {
    type: String
  },
  EDPhone: {
    type: String
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  paidAmount: {
    type: Number,
    default: 0
  },
}, { timestamps: true });

export const Mod =  mongoose.model('Mod', modSchema); 