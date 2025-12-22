import { Types } from 'mongoose';

export interface IMarketDetail {
  name: string;
  headBy: Types.ObjectId;
  phone: string;
  address: string;
  status: string;
  oldData?:boolean    
  levelId:Number;
  autoId:Number;
  leader: String;
}
