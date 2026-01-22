import mongoose, { Mongoose, Schema } from "mongoose";

const marketingHeadSchema = new mongoose.Schema({
    name: { type: String, required: true },
    id: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    gender: { type: String,  required: true },
    age: { type: Number, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    status: { type: String, default: 'active' },
    percentageId: {type: Schema.Types.ObjectId, ref: 'Percentage', required: true }
}, { timestamps: true });

export const MarketingHead = mongoose.model("MarketingHead", marketingHeadSchema);
