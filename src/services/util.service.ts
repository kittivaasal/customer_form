import { to } from 'await-to-js';
import { Response } from "express";
import { format, toZonedTime } from 'date-fns-tz';
import { isValidUUIDV4 } from 'is-valid-uuid-v4';

export const IsValidUUIDV4 = (val: string): boolean => {
  return isValidUUIDV4(val);
};


export function getMonthStartEndDate(): { start: Date; end: Date } {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  let daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // leap year logic INSIDE function
  if (
    month === 2 &&
    ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)
  ) {
    daysInMonth[1] = 29;
  }

  return {
    start: new Date(`${year}-${String(month).padStart(2, "0")}-01`),
    end:new Date(`${year}-${String(month).padStart(2, "0")}-${daysInMonth[month - 1]}T23:59:59.999Z`)
  };
}

export function excelDateToJSDate(serial: number): Date | null {
  if (!serial) return null;

  const utc_days = Math.floor(serial - 25569); // 25569 = days between 1900-01-01 and 1970-01-01
  const utc_value = utc_days * 86400; // seconds in a day
  const date_info = new Date(utc_value * 1000);

  // Add fractional day (time)
  const fractional_day = serial - Math.floor(serial);
  const total_seconds = Math.round(86400 * fractional_day);

  const seconds = total_seconds % 60;
  const minutes = Math.floor(total_seconds / 60) % 60;
  const hours = Math.floor(total_seconds / 3600);

  date_info.setUTCHours(hours, minutes, seconds, 0);

  return date_info;
}


export function getEmiSchedule(numberOfEmis: number) {
  const startDate = new Date()
  const emis = [];
  const start = new Date(startDate);

  const startDay = start.getDate();
  let year = start.getFullYear();
  let month = start.getMonth(); // 0-based

  for (let i = 0; i < numberOfEmis; i++) {
    let m =  new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + i))
    console.log(m)
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const emiDay = Math.min(startDay, daysInMonth);
    const emiDate = new Date(year, month, emiDay);

    emis.push(emiDate);

    // move to next month
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  return emis;
}

export function getEmiDate(index: number, startDateFrom?: Date): Date {
  let startDate;
  if(startDateFrom){
    startDate = new Date(startDateFrom)
  }else{
    startDate = new Date()
  }
  let baseDate = new Date(startDate);
  
  const startDay = baseDate.getDate();
  let year = baseDate.getFullYear();
  let month = baseDate.getMonth() + index;

  // normalize year & month
  year += Math.floor(month / 12);
  month = month % 12;
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const emiDay = Math.min(startDay, daysInMonth);

  return new Date(year, month, emiDay);
}

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

export const isValidDate = (dateString: string): boolean => {
  // 1. Format check
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;

  const [yearStr, monthStr, dayStr] = dateString.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  // 2. Month validation
  if (month < 1 || month > 12) return false;

  // 3. Days per month
  const daysInMonth = new Date(year, month, 0).getDate();

  // 4. Day validation
  if (day < 1 || day > daysInMonth) return false;

  return true;
};


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
