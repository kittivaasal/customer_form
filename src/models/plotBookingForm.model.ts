// models/plotBookingForm.model.ts
import mongoose, { Schema } from "mongoose";
import { IPlotBookingForm } from "../type/plotBookingForm";
import { ref } from "process";

const PlotBookingFormSchema: Schema = new Schema(
    {
        plotNo: { type: String, trim: true },
        date: { type: String, trim: true },

        gender: { type: String, trim: true },
        projectArea: { type: String, trim: true },
        nameOfCustomer: { type: String, trim: true, required: true },
        nationality: { type: String, trim: true },
        dob: { type: Date },
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
        nomineeRelationship: { type: String, trim: true },

        nameOfGuardian: { type: String, trim: true },
        so_wf_do: { type: String, trim: true },
        relationshipWithCustomer: { type: String, trim: true },

        address: { type: String, trim: true },

        introducerName: { type: String, trim: true },
        introducerMobileNo: { type: String, trim: true },

        immSupervisorName: { type: String, trim: true },
        cedName: { type: String, trim: true },

        diamountDirectorName: { type: String, trim: true },
        diamountDirectorPhone: { type: String, trim: true },

        modeOfPayment: { type: String, trim: true },
        paymentRefNo: { type: String, trim: true },

        photo: { type: String, trim: true },
        referenceId: { type: String, trim: true },
        scheme: { type: String, trim: true },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<IPlotBookingForm>(
    "PlotBookingForm",
    PlotBookingFormSchema
);
