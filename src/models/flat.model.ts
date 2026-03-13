import mongoose, { Schema } from "mongoose";
import { IFlat } from "../type/flat";

const FlatSchema: Schema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "Customer" },
    general: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "General",
    },
    flat: { type: String, required: true, trim: true },
    block: { type: String, required: true, trim: true },
    floor: { type: String, required: true, trim: true },
    bedRoom: { type: Number, required: true },

    udsSqft: { type: Number, required: true },
    guideRateSqft: { type: Number, required: true },
    propertyTax: { type: Number, default: 0 },
    carPark: { type: String, default: "" },

    onBookingPercent: { type: Number, default: 0 },
    lintelPercent: { type: Number, default: 0 },
    roofPercent: { type: Number, default: 0 },
    plasterPercent: { type: Number, default: 0 },
    flooringPercent: { type: Number, default: 0 },

    landValue: { type: Number, default: 0 },
    landRegValue: { type: Number, default: 0 },
    constCost: { type: Number, default: 0 },
    constRegValue: { type: Number, default: 0 },
    carParkCost: { type: Number, default: 0 },
    ebDeposit: { type: Number, default: 0 },
    paymentTerm: { type: String, default: "" },
    sewageWaterTax: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },
    corpusFund: { type: Number, default: 0 },
    additionalCharges: { type: Number, default: 0 },
    totalValue: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Flat = mongoose.model("Flat", FlatSchema);
