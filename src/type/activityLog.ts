export interface IActivityLog extends Document {
  action: "CREATE" | "UPDATE" | "DELETE" | "BILLING REQUEST" ;
  billingRequestAction?: "CREATE" | "UPDATE" | "DOWNLOAD";
  collectionName: string;
  documentId: string;
  oldData?: any;
  newData?: any;
  userId?: string;
  createdAt: Date;
  message?: string;
  date: Date;
}