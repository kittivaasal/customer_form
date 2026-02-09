import mongoose, { Mongoose, Schema } from "mongoose";

const marketingHeadSchema = new mongoose.Schema({
    name: { type: String, required: true },
    id: { type: String  },
    email: { type: String },
    gender: { type: String},
    age: { type: Number },
    phone: { type: String },
    address: { type: String },
    status: { type: String, default: 'active' },
    percentageId: {type: Schema.Types.ObjectId, ref: 'Percentage' },
    level:{
        type: String
    },
    oldData:{type:Boolean,default:false},
    push:{
      type:Boolean,
      default:true
    }
}, { timestamps: true });

export const MarketingHead = mongoose.model("MarketingHead", marketingHeadSchema);
