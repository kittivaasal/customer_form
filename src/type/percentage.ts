import { Types } from 'mongoose';

export interface IPercentage {
  _id: Types.ObjectId;
  headBy: Types.ObjectId; // Reference to MarketingHead
  name: string;
  rate: string;
  level: number;
}
