import mongoose from "mongoose";

const projectSchema = new mongoose.Schema({
  projectName: {
    type: String,
    // required: true,
  },
  description: {
    type: String,
    // required: true,
  },
  shortName: {
    type: String,
    // required: true,
  },
  duration: {
    type: String,
    // required: true,
  },
  emiAmount: {
    type: Number,
    // required: true,
  },
  marketer: {
    type: String,
    // required: true,
  },
  schema: {
    type: String,
    // required: true,
  },
  returns: {
    type: Number,
    // required: true,
  },
  intrest : {
    type: String,
    // required: true,
  },
  totalInvestimate: {
    type: Number,
    default: 0,
  },
  totalReturnAmount: {
    type: Number,
    default: 0,
  },
  oldData:{
    type:Boolean,
    default:false
  }
}, { timestamps: true });

export const Project = mongoose.model("Project", projectSchema);
