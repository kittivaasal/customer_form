import mongoose from "mongoose";

const customerSchema = new mongoose.Schema({
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
}, { timestamps: true });

export const Customer = mongoose.model("Customer", customerSchema);
