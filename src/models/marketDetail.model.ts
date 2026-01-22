import mongoose, { Schema, Document } from 'mongoose';
import { IMarketDetail } from '../type/marketDetail';

const MarketDetailSchema: Schema = new Schema(
    {
        name:{type:String},
        id:{type:String},
        headBy: { type: Schema.Types.ObjectId, ref: 'MarketingHead'},
        phone: { type: String, required: true },
        address: { type: String, required: true },
        status: { type: String, default: 'active' },
        oldData:{type:Boolean,default:false},   
        levelId:{type:Number},
        autoId:{type:Number},
        leader: {type:String},
    },
    {
        timestamps: true
    }
);

export const MarketDetail = mongoose.model<IMarketDetail>('MarketDetail', MarketDetailSchema);
