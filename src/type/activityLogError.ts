import mongoose from "mongoose";

export interface IActivityLogError extends Document {
  data: any;
  errorMsg: string;
  date: Date;
}