import mongoose, { Schema } from 'mongoose';
import { IMarketDetail } from '../type/marketDetail';

const MarketDetailSchema: Schema = new Schema(
    {
        name:{type:String},
        id:{type:String},
        headBy: { type: Schema.Types.ObjectId, refPath: 'headByModel'},
        headByModel: { 
            type: String,
            required: true,
            default: "MarketingHead",
            enum: ["MarketingHead", "MarketDetail"]
        },
        phone: { type: String },
        address: { type: String },
        status: { type: String, default: 'active' },
        oldData:{type:Boolean,default:false},   
        levelId:{type:Number},
        autoId:{type:Number},
        leader: {type:String},
        percentageId: {type: Schema.Types.ObjectId, ref: 'Percentage' },
        overAllHeadBy: [
            {
                headBy: { type: Schema.Types.ObjectId, ref: 'MarketingHead'},
                headByModel: { 
                    type: String,
                    default: "MarketingHead",
                    enum: ["MarketingHead", "MarketDetail"]
                },
                level:Number
            }
        ],
        push:{
            type:Boolean,
            default:true
        }
    },
    {
        timestamps: true
    }
);

export const MarketDetail = mongoose.model<IMarketDetail>('MarketDetail', MarketDetailSchema);
