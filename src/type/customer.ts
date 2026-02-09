import mongoose from "mongoose";

export interface ICustomer {
  _id: mongoose.Types.ObjectId;
  id?: string;
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

  cedId?: mongoose.Types.ObjectId;
  ddId?: mongoose.Types.ObjectId;
  introducerId?: mongoose.Types.ObjectId;
  marketerDetailId?: mongoose.Types.ObjectId;
  generalId?: mongoose.Types.ObjectId;
  
  dob?: String,
  gender?: String,
  nomineeName: String,
  nomineeAge: String,
  nomineeRelationship:String ,
  nameOfGuardian:String ,
  so_wf_do:String ,
  relationshipWithCustomer:String ,
  guardianAddress: String,

  plotNo: string;
  projectArea: string;
  nationality: string;
  occupation: string;
  qualification: string;
  planNo: string;
  communicationAddress: string;
  fatherOrHusbandName: string;
  motherName: string;
  immSupervisorName: string;
  photoUrl: string;
  landLineNo: string;

  oldData?: boolean
  marketerPercent?: string
  marketerId?: string
  balanceAmount?: number
}


