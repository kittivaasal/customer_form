// types/plotBookingForm.interface.ts
import mongoose from "mongoose";
import { Document } from "mongoose";

export interface IPlotBookingForm extends Document {
    plotNo?: string;
    date?: Date;
    gender?: "male" | "female" | "other" | string;
    projectArea?: string;
    nameOfCustomer?: string;
    nationality?: string;
    dob?: Date;
    occupation?: string;
    qualification?: string;
    planNo?: string;
    communicationAddress?: string;
    pincode?: string;
    mobileNo?: string;
    landLineNo?: string;
    email?: string;
    fatherOrHusbandName?: string;
    motherName?: string;
    nomineeName?: string;
    nomineeAge?: number;
    nomineeRelationship?: string;
    nameOfGuardian?: string;
    so_wf_do?: string; // S/O, W/O, F/O, D/O (prefix like "S/O")
    relationshipWithCustomer?: string;
    address?: string;
    cedId?: mongoose.Types.ObjectId;
    ddId?: mongoose.Types.ObjectId;
    immSupervisorName?: string;
    cedName?: string;
    modeOfPayment: String;
    paymentRefNo: String;
    createdAt?: Date;
    updatedAt?: Date;
}
