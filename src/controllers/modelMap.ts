import ActivityLog from "../models/activityLog.model";
import ActivityLogError from "../models/activityLogError.model";
import { Billing } from "../models/billing.model";
import { BillingRequest } from "../models/billingRequest.model";
import { Commission } from "../models/commision.model";
import { Customer } from "../models/customer.model";
import EditRequest from "../models/editRequest.model";
import { Emi } from "../models/emi.model";
import { General } from "../models/general.model";
import { Lfc } from "../models/lfc.model";
import { MarketDetail } from "../models/marketDetail.model";
import { MarketingHead } from "../models/marketingHead.model";
import { Mod } from "../models/mod.model";
import { Nvt } from "../models/nvt.model";
import { Percentage } from "../models/percentage.model";
import { Project } from "../models/project.model";

export const modelMap: any = {
  Customer,
  Emi,
  General,
  Billing,
  Lfc,
  MarketDetail,
  MarketingHead,
  Mod,
  Nvt,
  Percentage,
  BillingRequest,
  Commission,
  EditRequest,
  ActivityLog,
  ActivityLogError,
  Project
};