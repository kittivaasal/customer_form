// models/lifeSaving.model.ts
import mongoose, { Schema } from "mongoose";
import { ILifeSaving } from "../type/lifeSaving";

const LifeSavingSchema: Schema = new Schema(
  {
    idNo: { type: String, trim: true },
    date: { type: Date, default: Date.now },
    dob: { type: Date },

    schema1: { type: Boolean, default: false },
    schema2: { type: Boolean, default: false },

    schemeNo: { type: String, trim: true },

    nameOfCustomer: { type: String, trim: true, required: true },
    gender: { type: String, trim: true },
    nationality: { type: String, trim: true },
    occupation: { type: String, trim: true },
    qualification: { type: String, trim: true },
    planNo: { type: String, trim: true },

    communicationAddress: { type: String, trim: true },
    pincode: { type: String, trim: true },
    mobileNo: { type: String, trim: true },
    landLineNo: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },

    fatherOrHusbandName: { type: String, trim: true },
    motherName: { type: String, trim: true },

    nomineeName: { type: String, trim: true },
    nomineeAge: { type: Number },

    introducerName: { type: String, trim: true },
    introducerMobileNo: { type: String, trim: true },

    cedName: { type: String, trim: true },
    cedMobile: { type: String, trim: true },

    ddName: { type: String, trim: true },

    
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    noOfTime: { type: String, trim: true },
    ddMobile: { type: String, trim: true },
  },
  {
    timestamps: true,
    collection: "lifeSaving",
  }
);

export default mongoose.model<ILifeSaving>("LifeSaving", LifeSavingSchema);
