import { to } from 'await-to-js';
import { Response } from "express";
import { format, toZonedTime } from 'date-fns-tz';
import { isValidUUIDV4 } from 'is-valid-uuid-v4';

export const IsValidUUIDV4 = (val: string): boolean => {
  return isValidUUIDV4(val);
};


export const isEmail = (email_id: string) => {
  const reg = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if (reg.test(email_id)) {
    return true
  }
  else {
    return false
  }
}

export function toAutoIncrCode(name: string): string {
const words = name.replace(/-/g, " ").split(" ").filter(Boolean);

  let letters = "";
  let suffix = "";

  for (const w of words) {
    // Match alphanumeric ending like 1A, 2B, 2DD
    const alphaNumMatch = w.match(/(\d+[A-Za-z]+)$/);
    const numberMatch = w.match(/(\d+)$/);

    if (alphaNumMatch) {
      suffix = alphaNumMatch[1].toUpperCase();
      letters += w[0];
    } else if (numberMatch) {
      suffix = numberMatch[1];
      letters += w[0];
    } else {
      letters += w[0];
    }
  }

  // ✅ REMOVE numbers from letters part (IMPORTANT FIX)
  letters = letters.replace(/\d+/g, "");

  // If no number found → default -1
  if (!suffix) suffix = "1";

  return `${letters.toUpperCase()}-${suffix}`;
}

export function isBase64String(data: string): boolean {
  const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  return base64Regex.test(data);
}

export const ReE = function (res: Response, err: any, code: number) {
  if (typeof err == 'object' && typeof err?.message != 'undefined') {
    err = err.message;
  }

  if (typeof code !== 'undefined') res.statusCode = code;

  return res.json({ success: false, error: err });
};

export const ReS = function (res: Response, data: any, code: number) {
  let send_data = { success: true };

  if (typeof data == 'object') {
    send_data = Object.assign(data, send_data);//merge the objects
  }

  if (typeof code !== 'undefined') res.statusCode = code;

  return res.json(send_data)
};

export const TE = function (err_message: string, log: boolean) {
  if (log === true) {
    console.error(err_message);
  }
  throw new Error(err_message);
};


export const toAwait = async (promise: Promise<unknown>) => {
  let err, res;

  [err, res] = await to(promise);
  if (err) {
    return [err, null]
  };
  return [null, res];
};

export function isNull(field: string | null) {
  return typeof field === 'undefined' || field === '' || field === null
}

export function isEmpty(obj: Object) {
  if(obj === undefined){
    return true
  }
  return Object.entries(obj).length === 0 && obj.constructor === Object;//688263a82de1943da23aff47
}

export const  isValidDate = (dateString: string) => {
  const regex = /^\d{4}-\d{2}-\d{2}$/; 
  if (regex.test(dateString)) {
    return true
  }else{
    return false
  }
}

export const isPhone = (phone: string) => {
  const reg = /^[1-9]\d{9}$/
  if (reg.test(phone)) {
    return true
  }
  else {
    return false
  }
}

export const isValidUUID = (id: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};


export const createCurrentDate = (): string => {
  const currentDate = new Date(); // Current UTC time
  const istTimeZone = 'Asia/Kolkata'; // IST timezone

  // Convert UTC to IST using toZonedTime
  const istDate = toZonedTime(currentDate, istTimeZone);

  // Format as 'YYYY-MM-DD HH:mm'
  return format(istDate, 'yyyy-MM-dd', { timeZone: istTimeZone });
};

export const createCurrentDateTime = (): string => {
  const currentDate = new Date(); // Current UTC time
  const istTimeZone = 'Asia/Kolkata'; // IST timezone

  // Convert UTC to IST using toZonedTime
  const istDate = toZonedTime(currentDate, istTimeZone);

  // Format as 'YYYY-MM-DD HH:mm'
  return format(istDate, 'yyyy-MM-dd HH:mm', { timeZone: istTimeZone });
};
