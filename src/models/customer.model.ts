import mongoose from "mongoose";

const customerSchema = new mongoose.Schema({
  id: String,
  duration: String,
  emiAmount: Number,
  paymentTerms: String,
  marketerName: String,
  email: String,
  pincode: String,
  state: String,
  city: String,
  phone: String,
  address: String,
  name: String,
  marketatName: String,
  referenceId: String,
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },

  oldData: {type:Boolean, default:false},
  marketerPercent: String,
  marketerId: String,
}, { timestamps: true });

export const Customer = mongoose.model("Customer", customerSchema);
