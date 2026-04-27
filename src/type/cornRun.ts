import mongoose from "mongoose";

export interface ICornRun extends Document {
  _id: mongoose.Types.ObjectId;
  runDate: Date;
  monthstart: Date;
  message?: string;
  startDate: Date;
  endDate: Date;
  for: string;
  error?: string;
  stack?: string;
  generalIds: mongoose.Types.ObjectId[];
  emiIds: mongoose.Types.ObjectId[];
}