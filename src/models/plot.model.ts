import mongoose, { model, Schema } from "mongoose";
import { IPlot } from "../type/plot";

const PlotSchema = new Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
    },
    general: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "General",
    },
    guideRatePerSqFt: {
        type: Number
    },
    guideLandValue: {
        type: Number
    },
    landValue: {
        type: Number
    },
    regValue: {
        type: Number
    },
    additionalCharges: {
        type: Number
    },
    totalValue: {
        type: Number
    },
}, { timestamps: true });

export const Plot = model("Plot", PlotSchema);