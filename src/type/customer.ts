import mongoose from "mongoose";

export interface ICustomer {
  id?: string; // UUID
  duration: string;
  emiAmount: number;
  paymentTerms: string;
  marketerName: string;
  email: string;
  pincode: string;
  state: string;
  city: string;
  phone: string;
  address: string;
  name: string;
  marketatName: string;
  projectId?:  mongoose.Types.ObjectId;

  oldData?: boolean
  marketerPercent?: string
  marketerId?: string
}


