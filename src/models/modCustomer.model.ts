import mongoose, { Schema } from "mongoose";
import { toAutoIncrCode } from "../services/util.service";
import { Counter } from "./counter.model";
import { Project } from "./project.model";

const modCustomerSchema = new mongoose.Schema({
  customId: {
    type: String,
    unique: true
  },
  name: {
    type: String,
  },
  phone: {
    type: String,
  },
  address: {
    type: String,
  },
  email: {
    type: String,
  },
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
}, { timestamps: true });

modCustomerSchema.pre("save", async function (next) {
  if (!this.isNew || this.customId) {
    return next();
  }

  try {
    let projectData: any = {};
    if (this.projectId) {
      const findProject = await Project.findOne({ _id: this.projectId });
      if (!findProject) return next(new Error("Project not found"));
      projectData = findProject;
    } 
    if (projectData?.projectName) {
      let id = toAutoIncrCode(projectData.projectName);
      let getCustomerCounter = await Counter.findOne({ name: "modcustomerid" });

      let count = 0;
      if (!getCustomerCounter) {
        let newCounter = new Counter({
          name: "modcustomerid",
          seq: 0
        });
        await newCounter.save();
        count = 1; // Start from 1 if new
      } else {
        const counter: any = getCustomerCounter;
        count = counter.seq + 1;
      }

      await Counter.updateOne({ name: "modcustomerid" }, { $set: { seq: count } });
      this.customId = id + "-" + count.toString().padStart(4, '0');
    }
    next();
  } catch (error) {
    next(error as any);
  }
});

export const ModCustomer = mongoose.model("ModCustomer", modCustomerSchema);
