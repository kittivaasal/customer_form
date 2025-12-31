import { isValidObjectId } from "mongoose";
import { toAwait } from "../services/util.service";
import { User } from "../models/user.model";
import { IUser } from "../type/user";
import { sendNotificationsToMultipleDevices } from "../util/firebaseNotificationService";

export const checkFormatOfMultiMenuInBody = async (body: any) => {

  if (!Array.isArray(body)) {
    return false; // Not an array
  }

  for (const menu of body) {
    if (
      !menu.menuId ||
      !isValidObjectId(menu.menuId) ||
      !(typeof menu.create === "boolean") ||
      !(typeof menu.read === "boolean") ||
      !(typeof menu.update === "boolean") ||
      !(typeof menu.delete === "boolean")
    ) {
      return false;
    }
  }

  return true;

}



export const toLowerCaseObj = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(toLowerCaseObj);
  } else if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, toLowerCaseObj(v)])
    );
  } else if (typeof obj === "string") {
    return obj.toLowerCase();
  }
  return obj;
};

export const sendPushNotificationToSuperAdmin = async (title: string, body: string,id:string) => {

  if (!title || !body) {
    return {
      success: false,
      date: {},
      message: "Please enter title or body"
    }
  }

  let getAllSuper, err;
  [err, getAllSuper] = await toAwait(User.find({ isAdmin: true }));

  if (err) {
    return {
      success: false,
      date: {},
      message: err
    }
  }

  getAllSuper = getAllSuper as IUser[];

  if (getAllSuper.length === 0) {
    return {
      success: false,
      date: {},
      message: "No super admin user not found"
    }
  }

  let fcmToken: any = [];

  for (let index = 0; index < getAllSuper.length; index++) {
    const element = getAllSuper[index];
    let arr = element.fcmToken;
    if (!arr || arr.length === 0) {
      continue;
    }
    fcmToken = [...fcmToken, ...arr]
  }

  // let sendNoti;
  // [err, sendNoti] = await toAwait(
  //   sendNotificationsToMultipleDevices(fcmToken, title, body)
  // );

  // if(err){
  //   return {
  //     success:false,
  //     date:{},
  //     message: err
  //   }
  // }

  // return {
  //   success:true,
  //   date:sendNoti,
  //   message:"Notification send successfully"
  // }

  let sendPushNotification = await sendNotificationsToMultipleDevices(fcmToken, title, body, id);

  if (!sendPushNotification.success) {
    return {
      data: sendPushNotification.data,
      success: false,
      message: sendPushNotification.message
    };
  }

  return {
    data: sendPushNotification.data,
    success: true,
    message: sendPushNotification.message
  };

}
