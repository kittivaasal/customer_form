export interface IProject {
  _id?: string; // MongoDB ID, optional when creating
  projectName: string;
  description: string;
  shortName: string;
  duration: string;
  emiAmount: number;
  marketer: string;
  schema: string;
  returns: number;
  intrest: string;
  totalInvestimate?: number;
  totalReturnAmount?: number;
  createdAt?: Date;
  updatedAt?: Date;
  oldData?: boolean
}

