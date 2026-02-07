import mongoose, { Schema, Document } from 'mongoose';
import { IPercentage } from '../type/percentage';

const PercentageSchema: Schema = new Schema(
    {
        name: { type: String, required: true },
        rate: { type: String, required: true },
        push:{
            type:Boolean,
            default:true
        }
    },
    {
        timestamps: true
    }
);

export const Percentage = mongoose.model<IPercentage>('Percentage', PercentageSchema);
