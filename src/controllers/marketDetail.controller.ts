import { Request, Response } from "express";
import httpStatus from "http-status";
import mongoose from "mongoose";
import { Counter } from "../models/counter.model";
import EditRequest from "../models/editRequest.model";
import { MarketDetail } from "../models/marketDetail.model";
import { MarketingHead } from "../models/marketingHead.model";
import { Percentage } from "../models/percentage.model";
import { isNull, isPhone, ReE, ReS, toAwait } from "../services/util.service";
import CustomRequest from "../type/customRequest";
import { IEditRequest } from "../type/editRequest";
import { IMarketDetail } from "../type/marketDetail";
import { IPercentage } from "../type/percentage";
import { IUser } from "../type/user";
import { sendPushNotificationToSuperAdmin } from "./common";

export const createMarketDetail = async (req: Request, res: Response) => {
  let body = req.body, err, getFrom;
  let { headBy, phone, address, status, name, percentageId } = body;
  let fields = ["headBy", "phone", "address", "status", "name", "percentageId"];
  let inVaildFields = fields.filter(x => isNull(body[x]));

  if (inVaildFields.length > 0) {
    return ReE(res, { message: `Please enter required fields ${inVaildFields}!.` }, httpStatus.BAD_REQUEST);
  }

  if (phone) {
    if (!isPhone(phone)) {
      return ReE(res, { message: `Invalid phone number!.` }, httpStatus.BAD_REQUEST)
    }
    // let findPhone;
    // [err, findPhone] = await toAwait(MarketDetail.findOne({ phone: phone }))
    // if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    // if (findPhone) {
    //   return ReE(res, { message: `Phone already exists!.` }, httpStatus.BAD_REQUEST)
    // }
  }

  let checkPer;
  [err, checkPer] = await toAwait(Percentage.findOne({ _id: percentageId }));
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!checkPer) return ReE(res, { message: "Percentage is not found for given id" }, httpStatus.NOT_FOUND)

  checkPer = checkPer as IPercentage;
  if (checkPer.name.toUpperCase() === "DIAMOND DIRECTOR") {
    return ReE(res, { message: `MarkerDetail not be a 'DIAMOND DIRECTOR'!.` }, httpStatus.BAD_REQUEST);
  }

  if (!mongoose.isValidObjectId(headBy)) {
    return ReE(res, { message: 'Invalid headBy id!' }, httpStatus.BAD_REQUEST);
  }

  let findExist;
  [err, findExist] = await toAwait(MarketingHead.findById({ _id: headBy }));
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  let checkMarketDetail;
  if (!findExist) {
    [err, checkMarketDetail] = await toAwait(MarketDetail.findOne({ _id: headBy }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!checkMarketDetail) {
      return ReE(res, { message: `headBy is not found inside in marketDetail and marketingHead given id: ${headBy}!.` }, httpStatus.NOT_FOUND);
    } else {
      getFrom = "MarketDetail";
    }
  } else {
    getFrom = "MarketingHead";
  }

  let getSequence, count = 0;
  [err, getSequence] = await toAwait(Counter.findOne({ name: "Marketdetail" }));
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!getSequence) {
    let newCounter = new Counter({
      name: "Marketdetail",
      seq: 1
    });
    await newCounter.save();
    count = 1;
  } else {
    getSequence = getSequence as any;
    count = getSequence.seq + 1;
    let updateCustomerCounter;
    [err, updateCustomerCounter] = await toAwait(
      Counter.updateOne({ _id: getSequence._id }, { $set: { seq: count } })
    )
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  }

  body.id = count.toString().padStart(4, '0');

  if (getFrom === "MarketingHead") {
    body.overAllHeadBy = [
      {
        headBy: headBy,
        headByModel: "MarketingHead",
        level: 1
      }
    ]
  } else {
    checkMarketDetail = checkMarketDetail as IMarketDetail;
    body.overAllHeadBy = [
      ...checkMarketDetail.overAllHeadBy,
      {
        headBy: headBy,
        headByModel: "MarketDetail",
        level: checkMarketDetail.overAllHeadBy.length + 1
      }
    ]
  }

  let marketDetail;
  [err, marketDetail] = await toAwait(MarketDetail.create(body));
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!marketDetail) {
    return ReE(res, { message: `Failed to create marketDetail!.` }, httpStatus.INTERNAL_SERVER_ERROR)
  }
  ReS(res, { message: `marketDetail added successfull` }, httpStatus.CREATED);
};

export const updateMarketDetail = async (req: CustomRequest, res: Response) => {
  let body = req.body, user = req.user as IUser, getFrom;
  let err: any;
  let { _id, headBy, phone, address, status, name, percentageId } = body;
  let fields = ["headBy", "phone", "address", "status", 'name', 'percentageId'];
  let inVaildFields = fields.filter(x => !isNull(body[x]));
  if (inVaildFields.length === 0) {
    return ReE(res, { message: `Please enter any one field to update ${fields}!.` }, httpStatus.BAD_REQUEST);
  }
  if (!_id) {
    return ReE(res, { message: `_id is required!` }, httpStatus.BAD_REQUEST);
  }

  let getMarketDetail;
  [err, getMarketDetail] = await toAwait(MarketDetail.findOne({ _id: _id }));

  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!getMarketDetail) {
    return ReE(res, { message: `marketDetail not found for given id!.` }, httpStatus.NOT_FOUND)
  }

  getMarketDetail = getMarketDetail as IMarketDetail;

  const updateFields: Record<string, any> = {};
  for (const key of fields) {
    if (!isNull(body[key])) {
      updateFields[key] = body[key];
    }
  }

  if (headBy) {
    if (getMarketDetail.headBy.toString() !== headBy.toString()) {
      if (!user.isAdmin) {
        return ReE(res, { message: `You are authorized to update headBy of marketDetail!` }, httpStatus.BAD_REQUEST);
      }
      if (!mongoose.isValidObjectId(headBy)) {
        return ReE(res, { message: 'Invalid headBy id!' }, httpStatus.BAD_REQUEST);
      }
      let findExist;
      [err, findExist] = await toAwait(MarketingHead.findById({ _id: headBy }));
      if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
      let checkMarketDetail;
      if (!findExist) {
        [err, checkMarketDetail] = await toAwait(MarketDetail.findOne({ _id: headBy }));
        if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
        if (!checkMarketDetail) {
          return ReE(res, { message: `headBy is not found inside in marketDetail and marketingHead given id: ${headBy}!.` }, httpStatus.NOT_FOUND);
        } else {
          getFrom = "MarketDetail";
        }
      } else {
        getFrom = "MarketingHead";
        let level = getMarketDetail.overAllHeadBy.length;
        if (level !== 1) {
          return ReE(res, { message: `headBy already map with marketDetail table so cannot map with marketingHead given id: ${headBy}!.` }, httpStatus.NOT_FOUND);
        }
      }

      // let findPrevHeadBy = getMarketDetail.overAllHeadBy.find(x => x.headBy.toString() === getMarketDetail.headBy.toString());
      // if (findPrevHeadBy) {
      //     findPrevHeadBy = findPrevHeadBy as { headBy: mongoose.Types.ObjectId; headByModel: string; level: Number; };
      //     updateFields
      //     updateFields.overAllHeadBy[Number(findPrevHeadBy.level) - 1].headBy = headBy;
      // }

      // let updatedOverAllHeadBy = [];
      // let find = getMarketDetail.overAllHeadBy.find(x => x.headBy.toString() === headBy.toString());

      // for (let index = 0; index < getMarketDetail.overAllHeadBy.length; index++) {
      //     let element = getMarketDetail.overAllHeadBy[index];

      //     if(element.headBy.toString() === getMarketDetail.headBy.toString()){
      //         updateFields.overAllHeadBy[index].headBy = headBy;
      //         updatedOverAllHeadBy.push({
      //             ...element,
      //             headBy: getMarketDetail.headBy
      //         });
      //     }else{
      //         updatedOverAllHeadBy.push(element);
      //     }

      // }
      Object.assign(getMarketDetail.overAllHeadBy.find(x => x.headBy.toString() === getMarketDetail.headBy.toString()) || {},
        {
          headBy: headBy
        }
      );
      updateFields.overAllHeadBy = getMarketDetail.overAllHeadBy
    }

  }

  if (updateFields.percentageId) {
    if (!mongoose.isValidObjectId(updateFields.percentageId)) {
      return ReE(res, { message: "Invalid percentage id" }, httpStatus.BAD_REQUEST);
    }
    let checkPer;
    [err, checkPer] = await toAwait(Percentage.findOne({ _id: updateFields.percentageId }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!checkPer) return ReE(res, { message: "Percentage is not found for given id" }, httpStatus.NOT_FOUND)
    checkPer = checkPer as IPercentage;
    if (checkPer.name.toUpperCase() === "DIAMOND DIRECTOR") {
      return ReE(res, { message: `MarkerDetail not be a 'DIAMOND DIRECTOR'!.` }, httpStatus.BAD_REQUEST);
    }
  }

  if (updateFields.phone) {
    if (!isPhone(updateFields.phone)) {
      return ReE(res, { message: `Invalid phone number!.` }, httpStatus.BAD_REQUEST)
    }
    let findPhone;
    // [err, findPhone] = await toAwait(MarketDetail.findOne({ phone: updateFields.phone, _id: { $ne: _id } }));
    // if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    // if (findPhone) {
    //   return ReE(res, { message: `Phone already exists!.` }, httpStatus.BAD_REQUEST)
    // }
  }

  if (user.isAdmin === false) {

    const changes: { field: string; oldValue: any; newValue: any }[] = [];
    fields.forEach((key: any) => {
      const newValue = body[key];
      const oldValue = (getMarketDetail as any)[key];
      if (isNull(newValue)) return
      if (newValue.toString() !== oldValue.toString()) {
        changes.push({ field: key, oldValue, newValue });
      }
    });

    if (changes.length === 0) {
      return ReE(res, { message: "No changes found to update." }, httpStatus.BAD_REQUEST);
    }

    let checkEditRequest;
    [err, checkEditRequest] = await toAwait(
      EditRequest.findOne({ targetId: _id, editedBy: user._id })
    )

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (checkEditRequest) {
      checkEditRequest = checkEditRequest as IEditRequest;
      let get = []
      checkEditRequest.changes.forEach((change) => {
        if (changes.some((c) => c.field.toString() === change.field.toString())) {
          get.push(change)
        }
      })
      if (checkEditRequest.changes.length === get.length && checkEditRequest.status === "pending") {
        return ReE(res, { message: "You already have a pending edit request for this marketDetail." }, httpStatus.BAD_REQUEST);
      }
    }

    let createReq;
    [err, createReq] = await toAwait(
      EditRequest.create({
        targetModel: "MarketDetail",
        targetId: _id,
        editedBy: user._id,
        changes,
        status: "pending",
      })
    );

    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    createReq = createReq as IEditRequest;

    ReS(res, { message: "Edit request created successfully, Awaiting for approval." }, httpStatus.OK);

    let send = await sendPushNotificationToSuperAdmin("Edit request for MarketDetail", `A new edit request for marketDetail has been created by ${user.name}`, createReq._id.toString())

    if (!send.success) {
      return console.log(send.message);
    }

    return console.log("Edit request push notification sent.");

  } else {

    let updateResult;

    [err, updateResult] = await toAwait(
      MarketDetail.updateOne({ _id }, { $set: updateFields })
    );
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR)
    return ReS(res, { message: "MarketDetail updated successfully." }, httpStatus.OK);

  }

};

export const getByIdMarketDetail = async (req: Request, res: Response) => {
  let err, { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return ReE(res, { message: `Invalid marketDetail id!` }, httpStatus.BAD_REQUEST);
  }

  let getMarketDetail;
  [err, getMarketDetail] = await toAwait(MarketDetail.findOne({ _id: id }).populate("headBy"));

  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!getMarketDetail) {
    return ReE(res, { message: `marketDetail not found for given id!.` }, httpStatus.NOT_FOUND)
  }

  ReS(res, { message: "marketDetail found", data: getMarketDetail }, httpStatus.OK)
}

export const getAllMarketDetail = async (req: Request, res: Response) => {
  let err, getMarketDetail, query = req.query;

  let { head } = query
  let option: any = {};

  if (head) {
    if (!mongoose.isValidObjectId(head)) {
      return ReE(res, { message: `Invalid head id!` }, httpStatus.BAD_REQUEST);
    }
    let getHead;
    [err, getHead] = await toAwait(MarketingHead.findOne({ _id: head }));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getHead) {
      return ReE(res, { message: `head not found for given id!.` }, httpStatus.NOT_FOUND)
    }
    option.headBy = head
  }

  const page = req.query.page ? parseInt(req.query.page as string) : null;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : null;
  const search = (req.query.search as string) || "";
  const searchConditions: any[] = [];

  if (search) {
    searchConditions.push(
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { address: { $regex: search, $options: "i" } },
      { id: { $regex: search, $options: "i" } }
    );

    if (mongoose.Types.ObjectId.isValid(search)) {
      searchConditions.push({ _id: new mongoose.Types.ObjectId(search) });
    }
  }

  if (searchConditions.length > 0) {
    option.$or = searchConditions;
  }

  let queryTo = MarketDetail.find(option)
    // .populate({
    //   path: "headBy",
    //   populate: [
    //     { path: "percentageId" }
    //   ]
    // })
    .populate({
        path: "headBy",
        populate: {
          path: "percentageId",
        },
      })
      .populate({
        path: "percentageId",
      })
    .populate("headBy")
      .populate({
        path: "overAllHeadBy.headBy", 
      })
    .sort({ createdAt: -1 });

  if (page && limit) {
    const skip = (page - 1) * limit;
    queryTo = queryTo.skip(skip).limit(limit);
  }

  let total;
  let totalPages = 1;

  if (page && limit) {
    let count;
    [err, count] = await toAwait(MarketDetail.countDocuments(option));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    total = count as number;
    totalPages = Math.ceil(total / limit);

    if (page > totalPages) {
      return ReE(
        res,
        { message: `Page no ${page} not available. The last page no is ${totalPages}.` },
        httpStatus.NOT_FOUND
      );
    }
  }

  [err, getMarketDetail] = await toAwait(queryTo);

  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  getMarketDetail = getMarketDetail as IMarketDetail[]
  // if (getMarketDetail.length === 0) {
  //     return ReE(res, { message: `marketDetail not found!.` }, httpStatus.NOT_FOUND)
  // }

  return ReS(res, {
    message: "marketDetail found",
    data: getMarketDetail,
    ...(page && limit && {
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    })
  }, httpStatus.OK)
}

export const getBothMarketerMarketerHead = async (req: Request, res: Response) => {
  let err, getMarketDetail: any, getMarketerHead: any;
  let { search, page, limit } = req.query;

  let baseQuery: any = {};
  if (search) {
    baseQuery = {
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ]
    };
  }

  // Separate queries because 'head' filters differently for each collection
  let queryMD = { ...baseQuery };
  let queryMH = { ...baseQuery };


  const pageNum = page ? parseInt(page as string) : null;
  const limitNum = limit ? parseInt(limit as string) : null;

  if (pageNum && limitNum) {
    let countMarketDetail: any = 0;
    let countMarketingHead: any = 0;

    let countRes: any[] = await toAwait(MarketDetail.countDocuments(queryMD));
    err = countRes[0];
    countMarketDetail = countRes[1];
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    let countHeadRes: any[] = await toAwait(MarketingHead.countDocuments(queryMH));
    err = countHeadRes[0];
    countMarketingHead = countHeadRes[1];
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    const total = countMarketDetail + countMarketingHead;
    const totalPages = Math.ceil(total / limitNum);

    const skip = (pageNum - 1) * limitNum;

    let marketDetailsPromise: Promise<any> = Promise.resolve([]);
    let marketingHeadsPromise: Promise<any> = Promise.resolve([]);

    if (skip < countMarketDetail) {
      marketDetailsPromise = MarketDetail.find(queryMD)
        .populate({
          path: "headBy",
          populate: { path: "percentageId" }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);
    }

    let fetchedFromDetailCount = 0;
    if (skip < countMarketDetail) {
      fetchedFromDetailCount = Math.min(limitNum, countMarketDetail - skip);
    }

    let remainingLimit = limitNum - fetchedFromDetailCount;

    if (remainingLimit > 0) {
      let headSkip = Math.max(0, skip - countMarketDetail);
      marketingHeadsPromise = MarketingHead.find(queryMH)
        .populate("percentageId")
        .sort({ createdAt: -1 })
        .skip(headSkip)
        .limit(remainingLimit);
    }

    let marketDetailRes: any[] = await toAwait(marketDetailsPromise);
    err = marketDetailRes[0];
    getMarketDetail = marketDetailRes[1];
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    let marketerHeadRes: any[] = await toAwait(marketingHeadsPromise);
    err = marketerHeadRes[0];
    getMarketerHead = marketerHeadRes[1];
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    const combinedData = [
      ...(getMarketDetail || []),
      ...(getMarketerHead || [])
    ];

    ReS(res, {
      message: "Data found",
      data: combinedData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1
      }
    }, httpStatus.OK);

  } else {
    let marketDetailRes: any[] = await toAwait(MarketDetail.find(queryMD)
      .populate({
        path: "headBy",
        populate: { path: "percentageId" }
      })
      .sort({ createdAt: -1 }));
    err = marketDetailRes[0];
    getMarketDetail = marketDetailRes[1];
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    let marketerHeadRes: any[] = await toAwait(MarketingHead.find(queryMH)
      .populate("percentageId")
      .sort({ createdAt: -1 }));
    err = marketerHeadRes[0];
    getMarketerHead = marketerHeadRes[1];
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);

    const combinedData = [
      ...(getMarketDetail || []),
      ...(getMarketerHead || [])
    ];

    ReS(res, { message: "Data found", data: combinedData }, httpStatus.OK);
  }
}

export const deleteMarketDetail = async (req: Request, res: Response) => {
  let err, { _id } = req.body;
  if (!_id) {
    return ReE(res, { message: `MarketDetail _id is required!` }, httpStatus.BAD_REQUEST);
  }
  if (!mongoose.isValidObjectId(_id)) {
    return ReE(res, { message: `Invalid marketDetail id!` }, httpStatus.BAD_REQUEST);
  }

  let checkUser;
  [err, checkUser] = await toAwait(MarketDetail.findOne({ _id: _id }));
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
  if (!checkUser) {
    return ReE(res, { message: `marketDetail not found for given id!.` }, httpStatus.NOT_FOUND)
  }

  let deleteUser;
  [err, deleteUser] = await toAwait(MarketDetail.deleteOne({ _id: _id }));
  if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR)
  ReS(res, { message: "marketDetail deleted" }, httpStatus.OK)

}

// export const getFullHierarchy = async (req: Request, res: Response) => {
//     try {
//         const { id } = req.params;
//         let err, objectId;
//         if (!mongoose.isValidObjectId(id)) {
//             return ReE(res, { message: `Invalid marketDetail id!` }, httpStatus.BAD_REQUEST);
//         }
//         [err, objectId] = await toAwait(MarketDetail.findOne({ _id: id }));
//         if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
//         if (!objectId) {
//             return ReE(res, { message: `marketDetail not found for given id!.` }, httpStatus.NOT_FOUND)
//         }

//         const data = await MarketDetail.aggregate([
//             {
//                 $match: { _id: new mongoose.Types.ObjectId(id) }
//             },
//             {
//                 $graphLookup: {
//                     from: "marketdetails",
//                     startWith: "$_id",
//                     connectFromField: "_id",
//                     connectToField: "headBy",
//                     as: "downline",
//                     depthField: "downLevel"
//                 }
//             },
//             {
//                 $graphLookup: {
//                     from: "marketdetails",
//                     startWith: "$headBy",
//                     connectFromField: "headBy",
//                     connectToField: "_id",
//                     as: "upline",
//                     depthField: "upLevel"
//                 }
//             },

//             // ✅ SORT DOWNLINE LEVEL-WISE
//             {
//                 $addFields: {
//                     downline: {
//                         $sortArray: {
//                             input: "$downline",
//                             sortBy: { downLevel: 1 } 
//                         }
//                     }
//                 }
//             },

//             // ✅ SORT UPLINE REVERSE (TOP → BOTTOM)
//             {
//                 $addFields: {
//                     upline: {
//                         $sortArray: {
//                             input: "$upline",
//                             sortBy: { upLevel: -1 }
//                         }
//                     }
//                 }
//             }
//         ]);

//         let getMarketerHead;
//         [err, getMarketerHead] = await toAwait(MarketingHead.findOne({ _id: objectId.headBy }));
//         if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
//         data.unshift(getMarketerHead);


//         return res.json({ success: true, data });
//     } catch (err) {
//         return res.status(500).json({ success: false, err });
//     }
// };

// export const getFullHierarchy = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;
//     const objectId = new mongoose.Types.ObjectId(id);

//     /* ---------------------------------------------------
//        STEP 1: CHECK IF ID IS MARKETING HEAD (LEVEL 1)
//     --------------------------------------------------- */
//     const marketingHead = await MarketingHead.findById(objectId).lean();

//     if (marketingHead) {
//       // ✅ LEVEL 1 → ONLY DOWNLINE
//       const data = await MarketingHead.aggregate([
//         { $match: { _id: objectId } },
//         {
//           $graphLookup: {
//             from: "marketdetails",
//             startWith: "$_id",
//             connectFromField: "_id",
//             connectToField: "headBy",
//             as: "downline",
//             depthField: "level"
//           }
//         }
//       ]);

//       return res.json({
//         success: true,
//         type: "MarketingHead",
//         data
//       });
//     }

//     /* ---------------------------------------------------
//        STEP 2: OTHERWISE IT IS MARKET DETAIL (LEVEL 2+)
//     --------------------------------------------------- */
//     const marketDetail = await MarketDetail.findById(objectId).lean();

//     if (!marketDetail) {
//       return res.status(404).json({
//         success: false,
//         message: "Invalid ID"
//       });
//     }

//     const data = await MarketDetail.aggregate([
//       { $match: { _id: objectId } },
//       {
//         $graphLookup: {
//           from: "marketdetails",
//           startWith: "$_id",
//           connectFromField: "_id",
//           connectToField: "headBy",
//           as: "downline",
//           depthField: "downLevel"
//         }
//       },
//       {
//         $graphLookup: {
//           from: "marketdetails",
//           startWith: "$headBy",
//           connectFromField: "headBy",
//           connectToField: "_id",
//           as: "upline",
//           depthField: "upLevel"
//         }
//       }
//     ]);

//     return res.json({
//       success: true,
//       type: "MarketDetail",
//       data
//     });
//   } catch (err) {
//     return res.status(500).json({
//       success: false,
//       error: err
//     });
//   }
// };


// export const getFullHierarchy = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;
//     const objectId = new mongoose.Types.ObjectId(id);

//     /* ----------------------------------------
//        1️⃣ CHECK MARKETING HEAD
//     ---------------------------------------- */
//     const marketingHead = await MarketingHead.findById(objectId).lean();

//     if (marketingHead) {
//       // MarketingHead itself is LEVEL 1
//       const downline = await MarketDetail.aggregate([
//         {
//           $match: {
//             headBy: objectId,
//             headByModel: "MarketingHead"
//           }
//         },
//         {
//           $graphLookup: {
//             from: "marketdetails",
//             startWith: "$_id",
//             connectFromField: "_id",
//             connectToField: "headBy",
//             as: "children",
//             depthField: "downLevel"
//           }
//         },
//         {
//           $addFields: {
//             all: {
//               $concatArrays: [["$$ROOT"], "$children"]
//             }
//           }
//         },
//         { $unwind: "$all" },
//         { $replaceRoot: { newRoot: "$all" } },
//         { $sort: { downLevel: 1 } }
//       ]);

//       return res.json({
//         success: true,
//         hierarchy: [
//           { ...marketingHead, level: 1 },
//           ...downline.map(d => ({ ...d, level: d.downLevel + 2 }))
//         ]
//       });
//     }

//     /* ----------------------------------------
//        2️⃣ MARKET DETAIL FLOW
//     ---------------------------------------- */
//     let marketDetail = await MarketDetail.findById(objectId).lean();
//     if (!marketDetail) {
//       return res.status(404).json({ success: false, message: "Invalid ID" });
//     }

//     const hierarchy = await MarketDetail.aggregate([
//       { $match: { _id: objectId } },

//       // 🔽 DOWNLINE
//       {
//         $graphLookup: {
//           from: "marketdetails",
//           startWith: "$_id",
//           connectFromField: "_id",
//           connectToField: "headBy",
//           as: "downline",
//           depthField: "downLevel"
//         }
//       },

//       // 🔼 UPLINE (MarketDetail only)
//       {
//         $graphLookup: {
//           from: "marketdetails",
//           startWith: "$headBy",
//           connectFromField: "headBy",
//           connectToField: "_id",
//           as: "upline",
//           depthField: "upLevel"
//         }
//       }
//     ]);

//     if(hierarchy.length === 0){
//         return res.json({
//             success: true,
//             hierarchy: []
//           });
//     }

//     if(hierarchy.length !== 1){
//         return ReE(res, {message:"Something went wrong!"}, httpStatus.INTERNAL_SERVER_ERROR);
//     }

//     let hierarchyData  = hierarchy[0];
//     /* ----------------------------------------
//        3️⃣ GET MARKETING HEAD (LEVEL 1)
//     ---------------------------------------- */
//     let Marking_head = hierarchyData.overAllHeadBy.find((h:any) => h?.headByModel === "MarketingHead");
//     console.log(Marking_head);
//     if(Marking_head){
//         let getHead = await MarketingHead.findById(Marking_head?.headBy).lean();
//         if(getHead){
//             hierarchyData.upline.unshift(getHead);
//         }
//     }

//     return res.json({
//       success: true,
//       hierarchy: hierarchyData
//     });
//   } catch (err) {
//     return res.status(500).json({ success: false, err });
//   }
// };



/* ======================================================
   FULL HIERARCHY (UPLINE + DOWNLINE) – FINAL VERSION
====================================================== */
export const getFullHierarchy = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const objectId = new mongoose.Types.ObjectId(id);

    /* ======================================================
       1️⃣ CHECK MARKETING HEAD
    ====================================================== */
    const marketingHead = await MarketingHead.findById(objectId).lean();

    if (marketingHead) {
      // 🔽 All MarketDetails under this MarketingHead
      const downline = await MarketDetail.find({
        "overAllHeadBy.headBy": objectId
      }).lean();

      // Sort strictly by level from overAllHeadBy
      const sortedDownline = downline.sort((a: any, b: any) => {
        const la = a.overAllHeadBy.find((h: any) => h.headBy.equals(objectId))?.level || 0;
        const lb = b.overAllHeadBy.find((h: any) => h.headBy.equals(objectId))?.level || 0;
        return la - lb;
      });

      return res.json({
        success: true,
        type: "MarketingHead",
        upline: [],
        downline: [
          { ...marketingHead, level: 1 },
          ...sortedDownline
        ]
      });
    }

    /* ======================================================
       2️⃣ CHECK MARKET DETAIL
    ====================================================== */
    const self = await MarketDetail.findById(objectId).lean();
    if (!self) {
      return res.status(404).json({
        success: false,
        message: "Invalid ID"
      });
    }

    /* ======================================================
       3️⃣ BUILD UPLINE (ORDERED)
       (USING overAllHeadBy)
    ====================================================== */
    const upline: any[] = [];

    for (const h of self.overAllHeadBy.sort((a: any, b: any) => a.level - b.level)) {
      if (h.headByModel === "MarketingHead") {
        const head = await MarketingHead.findById(h.headBy).lean();
        if (head) upline.push({ ...head, level: h.level });
      }

      if (h.headByModel === "MarketDetail") {
        const md = await MarketDetail.findById(h.headBy).lean();
        if (md) upline.push({ ...md, level: h.level });
      }
    }

    /* ======================================================
       4️⃣ BUILD DOWNLINE (ORDERED)
       (ANY DOC WHERE overAllHeadBy CONTAINS SELF)
    ====================================================== */
    const downline = await MarketDetail.find({
      "overAllHeadBy.headBy": objectId
    }).lean();

    const sortedDownline = downline
      .map((d: any) => {
        const levelInfo = d.overAllHeadBy.find((h: any) =>
          h.headBy.equals(objectId)
        );
        return {
          ...d,
          level: levelInfo ? levelInfo.level + self.overAllHeadBy.length : null
        };
      })
      .sort((a: any, b: any) => a.level - b.level);

    /* ======================================================
       5️⃣ FINAL RESPONSE
    ====================================================== */
    return res.json({
      success: true,
      type: "MarketDetail",
      upline,
      self,
      downline: sortedDownline
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err
    });
  }
};



export const getUplineDownline = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const objectId = new mongoose.Types.ObjectId(id);
    let err;

    if (!objectId) {
      return ReE(res, { message: "Invalid ID" }, httpStatus.BAD_REQUEST);
    }

    if (!mongoose.isValidObjectId(objectId)) {
      return ReE(res, { message: "Invalid ID" }, httpStatus.BAD_REQUEST);
    }

    const marketDetail = await MarketDetail.findById(objectId);
    if (!marketDetail) {
      return ReE(res, { message: "MarketDetail not found for given ID" }, httpStatus.NOT_FOUND);
    }

    const data = await MarketDetail.aggregate([
      /* -------------------------------------------------- */
      /* 1️⃣ MATCH SELF */
      /* -------------------------------------------------- */
      { $match: { _id: objectId } },

      /* -------------------------------------------------- */
      /* 2️⃣ PREPARE UPLINE IDS */
      /* -------------------------------------------------- */
      {
        $addFields: {
          uplineIds: {
            $map: {
              input: {
                $filter: {
                  input: "$overAllHeadBy",
                  as: "h",
                  cond: { $eq: ["$$h.headByModel", "MarketDetail"] }
                }
              },
              as: "m",
              in: "$$m.headBy"
            }
          }
        }
      },

      /* -------------------------------------------------- */
      /* 3️⃣ FETCH UPLINE WITH FULL POPULATION */
      /* -------------------------------------------------- */
      {
        $lookup: {
          from: "marketdetails",
          let: { ids: "$uplineIds" },
          pipeline: [
            { $match: { $expr: { $in: ["$_id", "$$ids"] } } },

            /* percentage */
            {
              $lookup: {
                from: "percentages",
                localField: "percentageId",
                foreignField: "_id",
                as: "percentageId"
              }
            },
            { $unwind: { path: "$percentageId", preserveNullAndEmptyArrays: true } },

            /* headBy both models */
            {
              $lookup: {
                from: "marketdetails",
                localField: "headBy",
                foreignField: "_id",
                as: "mdHead"
              }
            },
            {
              $lookup: {
                from: "marketingheads",
                localField: "headBy",
                foreignField: "_id",
                as: "mhHead"
              }
            },
            {
              $addFields: {
                headBy: {
                  $cond: [
                    { $eq: ["$headByModel", "MarketDetail"] },
                    { $arrayElemAt: ["$mdHead", 0] },
                    { $arrayElemAt: ["$mhHead", 0] }
                  ]
                }
              }
            },

            /* overAllHeadBy populate */
            {
              $lookup: {
                from: "marketdetails",
                localField: "overAllHeadBy.headBy",
                foreignField: "_id",
                as: "mdOver"
              }
            },
            {
              $lookup: {
                from: "marketingheads",
                localField: "overAllHeadBy.headBy",
                foreignField: "_id",
                as: "mhOver"
              }
            },
            {
              $addFields: {
                overAllHeadBy: {
                  $map: {
                    input: "$overAllHeadBy",
                    as: "o",
                    in: {
                      $mergeObjects: [
                        "$$o",
                        {
                          headBy: {
                            $cond: [
                              { $eq: ["$$o.headByModel", "MarketDetail"] },
                              {
                                $arrayElemAt: [
                                  {
                                    $filter: {
                                      input: "$mdOver",
                                      as: "m",
                                      cond: { $eq: ["$$m._id", "$$o.headBy"] }
                                    }
                                  },
                                  0
                                ]
                              },
                              {
                                $arrayElemAt: [
                                  {
                                    $filter: {
                                      input: "$mhOver",
                                      as: "mh",
                                      cond: { $eq: ["$$mh._id", "$$o.headBy"] }
                                    }
                                  },
                                  0
                                ]
                              }
                            ]
                          }
                        }
                      ]
                    }
                  }
                }
              }
            },

            /* remove temp inside pipeline */
            {
              $project: {
                mdHead: 0,
                mhHead: 0,
                mdOver: 0,
                mhOver: 0
              }
            }
          ],
          as: "upline"
        }
      },

      /* -------------------------------------------------- */
      /* 4️⃣ FIX UPLINE LEVEL */
      /* -------------------------------------------------- */
      {
        $addFields: {
          upline: {
            $map: {
              input: "$upline",
              as: "u",
              in: {
                $mergeObjects: [
                  "$$u",
                  {
                    level: {
                      $add: [
                        { $indexOfArray: ["$uplineIds", "$$u._id"] },
                        2
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      },

      /* -------------------------------------------------- */
      /* 5️⃣ ADD SELF WITH LEVEL */
      /* -------------------------------------------------- */
      {
        $addFields: {
          self: {
            $mergeObjects: [
              "$$ROOT",
              { level: { $add: [{ $size: "$uplineIds" }, 2] } }
            ]
          }
        }
      },

      /* -------------------------------------------------- */
      /* 6️⃣ POPULATE SELF overAllHeadBy */
      /* -------------------------------------------------- */
      {
        $lookup: {
          from: "marketdetails",
          localField: "self.overAllHeadBy.headBy",
          foreignField: "_id",
          as: "selfMdOver"
        }
      },
      {
        $lookup: {
          from: "marketingheads",
          localField: "self.overAllHeadBy.headBy",
          foreignField: "_id",
          as: "selfMhOver"
        }
      },
      {
        $addFields: {
          "self.overAllHeadBy": {
            $map: {
              input: "$self.overAllHeadBy",
              as: "o",
              in: {
                $mergeObjects: [
                  "$$o",
                  {
                    headBy: {
                      $cond: [
                        { $eq: ["$$o.headByModel", "MarketDetail"] },
                        {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$selfMdOver",
                                as: "m",
                                cond: { $eq: ["$$m._id", "$$o.headBy"] }
                              }
                            },
                            0
                          ]
                        },
                        {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$selfMhOver",
                                as: "mh",
                                cond: { $eq: ["$$mh._id", "$$o.headBy"] }
                              }
                            },
                            0
                          ]
                        }
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      },

      /* -------------------------------------------------- */
      /* 7️⃣ DOWNLINE */
      /* -------------------------------------------------- */
      {
        $graphLookup: {
          from: "marketdetails",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "headBy",
          as: "downline",
          depthField: "depth"
        }
      },

      {
        $addFields: {
          downline: {
            $map: {
              input: "$downline",
              as: "d",
              in: {
                $mergeObjects: [
                  "$$d",
                  {
                    level: {
                      $add: ["$$d.depth", "$self.level", 1]
                    }
                  }
                ]
              }
            }
          }
        }
      },


      /* ---------------- 6️⃣ POPULATE DOWNLINE ---------------- */
      { $unwind: { path: "$downline", preserveNullAndEmptyArrays: true } },

      /* Populate downline percentage */
      {
        $lookup: {
          from: "percentages",
          localField: "downline.percentageId",
          foreignField: "_id",
          as: "downline.percentageId"
        }
      },
      { $unwind: { path: "$downline.percentageId", preserveNullAndEmptyArrays: true } },

      /* Populate downline headBy (dual model) */
      {
        $lookup: {
          from: "marketdetails",
          localField: "downline.headBy",
          foreignField: "_id",
          as: "dlMdHead"
        }
      },
      {
        $lookup: {
          from: "marketingheads",
          localField: "downline.headBy",
          foreignField: "_id",
          as: "dlMhHead"
        }
      },
      {
        $addFields: {
          "downline.headBy": {
            $cond: [
              { $eq: ["$downline.headByModel", "MarketDetail"] },
              { $arrayElemAt: ["$dlMdHead", 0] },
              { $arrayElemAt: ["$dlMhHead", 0] }
            ]
          }
        }
      },

      /* Populate downline.overAllHeadBy.headBy */
      {
        $lookup: {
          from: "marketdetails",
          localField: "downline.overAllHeadBy.headBy",
          foreignField: "_id",
          as: "dlMdOver"
        }
      },

      {
        $lookup: {
          from: "marketingheads",
          localField: "downline.overAllHeadBy.headBy",
          foreignField: "_id",
          as: "dlMhOver"
        }
      },
      {
        $addFields: {
          "downline.overAllHeadBy": {
            $map: {
              input: "$downline.overAllHeadBy",
              as: "o",
              in: {
                $mergeObjects: [
                  "$$o",
                  {
                    headBy: {
                      $cond: [
                        { $eq: ["$$o.headByModel", "MarketDetail"] },
                        {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$dlMdOver",
                                as: "m",
                                cond: { $eq: ["$$m._id", "$$o.headBy"] }
                              }
                            },
                            0
                          ]
                        },
                        {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$dlMhOver",
                                as: "mh",
                                cond: { $eq: ["$$mh._id", "$$o.headBy"] }
                              }
                            },
                            0
                          ]
                        }
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      },


      /* ---------------- 7️⃣ GROUP BACK ---------------- */
      {
        $group: {
          _id: "$_id",
          doc: { $first: "$$ROOT" },
          downline: { $push: "$downline" }
        }
      },
      {
        $addFields: { "doc.downline": "$downline" }
      },
      { $replaceRoot: { newRoot: "$doc" } },

      /* -------------------------------------------------- */
      /* 8️⃣ FINAL CLEANUP */
      /* -------------------------------------------------- */
      {
        $project: {
          uplineIds: 0,
          depth: 0,
          selfMdOver: 0,
          selfMhOver: 0,
          dlMhOver: 0,
        }
      }
    ]);

    // const data = await MarketDetail.aggregate([
    //   { $match: { _id: objectId } },

    //   /* ---------------- UPLINE IDS ---------------- */
    //   {
    //     $addFields: {
    //       uplineIds: {
    //         $map: {
    //           input: {
    //             $filter: {
    //               input: "$overAllHeadBy",
    //               as: "h",
    //               cond: { $eq: ["$$h.headByModel", "MarketDetail"] }
    //             }
    //           },
    //           as: "m",
    //           in: "$$m.headBy"
    //         }
    //       }
    //     }
    //   },

    //   /* ---------------- SELF LEVEL ---------------- */
    //   {
    //     $addFields: {
    //       self: {
    //         $mergeObjects: [
    //           "$$ROOT",
    //           { level: { $add: [{ $size: "$uplineIds" }, 2] } }
    //         ]
    //       }
    //     }
    //   },

    //   /* ---------------- DOWNLINE ---------------- */
    //   {
    //     $graphLookup: {
    //       from: "marketdetails",
    //       startWith: "$_id",
    //       connectFromField: "_id",
    //       connectToField: "headBy",
    //       as: "downline",
    //       depthField: "depth"
    //     }
    //   },

    //   /* ---------------- DOWNLINE LEVEL FIX ---------------- */
    //   {
    //     $addFields: {
    //       downline: {
    //         $map: {
    //           input: "$downline",
    //           as: "d",
    //           in: {
    //             $mergeObjects: [
    //               "$$d",
    //               {
    //                 level: {
    //                   $add: ["$$d.depth", "$self.level", 1]
    //                 }
    //               }
    //             ]
    //           }
    //         }
    //       }
    //     }
    //   },

    //   /* ===================================================== */
    //   /* 🔥 FULL DOWNLINE POPULATION STARTS HERE 🔥 */
    //   /* ===================================================== */

    //   { $unwind: { path: "$downline", preserveNullAndEmptyArrays: true } },

    //   /* Populate percentage */
    //   {
    //     $lookup: {
    //       from: "percentages",
    //       localField: "downline.percentageId",
    //       foreignField: "_id",
    //       as: "downline.percentageId"
    //     }
    //   },
    //   { $unwind: { path: "$downline.percentageId", preserveNullAndEmptyArrays: true } },

    //   /* Populate headBy (dual model) */
    //   {
    //     $lookup: {
    //       from: "marketdetails",
    //       localField: "downline.headBy",
    //       foreignField: "_id",
    //       as: "dlMdHead"
    //     }
    //   },
    //   {
    //     $lookup: {
    //       from: "marketingheads",
    //       localField: "downline.headBy",
    //       foreignField: "_id",
    //       as: "dlMhHead"
    //     }
    //   },
    //   {
    //     $addFields: {
    //       "downline.headBy": {
    //         $cond: [
    //           { $eq: ["$downline.headByModel", "MarketDetail"] },
    //           { $arrayElemAt: ["$dlMdHead", 0] },
    //           { $arrayElemAt: ["$dlMhHead", 0] }
    //         ]
    //       }
    //     }
    //   },

    //   /* Populate downline.overAllHeadBy.headBy */
    //   {
    //     $lookup: {
    //       from: "marketdetails",
    //       localField: "downline.overAllHeadBy.headBy",
    //       foreignField: "_id",
    //       as: "dlMdOver"
    //     }
    //   },
    //   {
    //     $lookup: {
    //       from: "marketingheads",
    //       localField: "downline.overAllHeadBy.headBy",
    //       foreignField: "_id",
    //       as: "dlMhOver"
    //     }
    //   },
    //   {
    //     $addFields: {
    //       "downline.overAllHeadBy": {
    //         $map: {
    //           input: "$downline.overAllHeadBy",
    //           as: "o",
    //           in: {
    //             $mergeObjects: [
    //               "$$o",
    //               {
    //                 headBy: {
    //                   $cond: [
    //                     { $eq: ["$$o.headByModel", "MarketDetail"] },
    //                     {
    //                       $arrayElemAt: [
    //                         {
    //                           $filter: {
    //                             input: "$dlMdOver",
    //                             as: "m",
    //                             cond: { $eq: ["$$m._id", "$$o.headBy"] }
    //                           }
    //                         },
    //                         0
    //                       ]
    //                     },
    //                     {
    //                       $arrayElemAt: [
    //                         {
    //                           $filter: {
    //                             input: "$dlMhOver",
    //                             as: "mh",
    //                             cond: { $eq: ["$$mh._id", "$$o.headBy"] }
    //                           }
    //                         },
    //                         0
    //                       ]
    //                     }
    //                   ]
    //                 }
    //               }
    //             ]
    //           }
    //         }
    //       }
    //     }
    //   },

    //   /* ---------------- GROUP BACK ---------------- */
    //   {
    //     $group: {
    //       _id: "$_id",
    //       doc: { $first: "$$ROOT" },
    //       downline: { $push: "$downline" }
    //     }
    //   },

    //   {
    //     $addFields: {
    //       "doc.downline": "$downline"
    //     }
    //   },

    //   { $replaceRoot: { newRoot: "$doc" } },

    //   /* ---------------- FINAL CLEAN ---------------- */
    //   {
    //     $project: {
    //       uplineIds: 0,
    //       depth: 0,
    //       dlMdHead: 0,
    //       dlMhHead: 0,
    //       dlMdOver: 0,
    //       dlMhOver: 0
    //     }
    //   }
    // ]);

    if (data.length === 0) {
      return ReS(res, { message: `marketDetail not found for given id!.`, data: [] }, httpStatus.NOT_FOUND)
    }

    if (data.length !== 1) {
      return ReE(res, { message: `something went wrong` }, httpStatus.INTERNAL_SERVER_ERROR)
    }

    let dataObj = data[0];
    let getMarkingHead;
    // if(dataObj.self.headByModel === "MarketingHead") {
    let markerHeadId = dataObj.self.overAllHeadBy.find((m: any) => m.headByModel === "MarketingHead");
    [err, getMarkingHead] = await toAwait(MarketingHead.findOne({ _id: markerHeadId.headBy }).populate("percentageId"));
    if (err) return ReE(res, err, httpStatus.INTERNAL_SERVER_ERROR);
    if (!getMarkingHead) return ReE(res, { message: `MarketingHead not found for given id!.` }, httpStatus.NOT_FOUND);
    getMarkingHead = getMarkingHead as any;
    getMarkingHead.level = 1;
    dataObj.upline?.unshift(getMarkingHead);
    // }

    return res.json({
      success: true,
      // count: dataObj,
      data: dataObj
    });

  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};
