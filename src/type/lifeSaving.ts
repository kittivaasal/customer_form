export interface ILifeSaving {
  idNo?: string;
  date?: Date;
  dob?: Date;

  schema1?: boolean;
  schema2?: boolean;

  schemeNo?: string;

  nameOfCustomer?: string;
  gender?: "male" | "female" | "other" | string;
  nationality?: string;
  occupation?: string;
  qualification?: string;
  planNo?: string;

  communicationAddress?: string;
  pincode?: string;
  mobileNo?: string;
  landLineNo?: string;
  email?: string;

  fatherOrHusbandName?: string;
  motherName?: string;

  nomineeName?: string;
  nomineeAge?: number;

  introducerName?: string;
  introducerMobileNo?: string;

  cedName?: string;
  cedMobile?: string;

  ddName?: string;
  ddMobile?: string;

  createdAt?: Date;
  updatedAt?: Date;

  projectId?: string;
  noOfTime?: number;

}
