import { APIs, URLs } from '@apis';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs'
import {
  createAsyncThunk,
  createEntityAdapter,
  createSlice,

  
} from '@reduxjs/toolkit';
import { DataType } from '@types';
import { Common, Preferences } from '@utils';
import { error } from '../../../src/utils/common';
const MAINTENANCE = 'maintenance';
const maintenanceAdapter = createEntityAdapter();
interface MaintenanceState {
  maintenanceActivityDD: any[];
  maintenanceActivityDDLoading: boolean;
  nearestChamber: any;  
  nearestChamberLoading: boolean;
  nearestChamberByVendor: any;
  nearestChamberByVendorLoading: boolean;
  insertMaintenanceActivityData: any;
  insertMaintenanceActivityLoading: boolean;
  maintenanceActivityVendorDD: any[];
  maintenanceActivityVendorDDLoading: boolean;
  maintenanceActivityDetails: any[];
  maintenanceActivityDetailsLoading: boolean;
  maintenanceActivityById: any;
  maintenanceActivityByIdLoading: boolean;
  zonewiseEmpForActivity: any[];  
  zonewiseEmpForActivityLoading: boolean;
  insertActivityStatusData: any;
  insertActivityStatusLoading: boolean;
  nearestRoute: any;
  nearestRouteLoading: boolean;
  assignedChamberComplaints: any[];
  assignedChamberComplaintsLoading: boolean;
  listOfItemsChamberComplaint: any[];
  listOfItemsChamberComplaintLoading: boolean;
  insertUpdateAssignedChamberComplaintData: any;
  insertUpdateAssignedChamberComplaintLoading: boolean;
  assignedChamberComplaintById: any;
  assignedChamberComplaintByIdLoading: boolean;
  employeeTask: any[];
  employeeTaskLoading: boolean;
  error: string | null;

}
const initialState: MaintenanceState = maintenanceAdapter.getInitialState({
  maintenanceActivityDD: [],
  maintenanceActivityDDLoading: false,
  nearestChamber: null,
  nearestChamberLoading: false,
  nearestChamberByVendor: null,
  nearestChamberByVendorLoading: false,
  insertMaintenanceActivityData: null,
  insertMaintenanceActivityLoading: false,
  maintenanceActivityVendorDD: [],
  maintenanceActivityVendorDDLoading: false,
  maintenanceActivityDetails: [],
  maintenanceActivityDetailsLoading: false,
  maintenanceActivityById: null,
  maintenanceActivityByIdLoading: false,
  zonewiseEmpForActivity: [],
  zonewiseEmpForActivityLoading: false,
  insertActivityStatusData: null,
  insertActivityStatusLoading: false,
  nearestRoute: null,
  nearestRouteLoading: false,
  assignedChamberComplaints: [],
  assignedChamberComplaintsLoading: false,
  listOfItemsChamberComplaint: [],
  listOfItemsChamberComplaintLoading: false,
  insertUpdateAssignedChamberComplaintData: null,
  insertUpdateAssignedChamberComplaintLoading: false,
  assignedChamberComplaintById: null,
  assignedChamberComplaintByIdLoading: false,
// Employee Tracking
  // Employee Tracking
  employeeTask: [],
  employeeTaskLoading: false,
  error: null,
});
type MaintenanceMediaFile = {
  uri?: string;
  path?: string;
  imagePath?: string;
  type?: string;
  name?: string;
  fileName?: string;
};

export type InsertMaintenanceActivityParams = {
  Id?: number | string;
  id?: number | string;
  Remark?: string;
  remark?: string;
  WorkById?: number | string;
  workById?: number | string;
  RouteId?: number | string;
  routeId?: number | string;
  ActivityTypeId?: number | string;
  activityTypeId?: number | string;
  CutTypeId?: number | string;
  cutTypeId?: number | string;
  CutAlertLocatingTypeId?: number | string;
  AlertTypeId?: number | string;
  alertTypeId?: number | string;
  LocatingTypeId?: number | string;
  locatingTypeId?: number | string;
  LatLng?: string;
  latLng?: string;
  VendorMobileNo?: string;
  vendorMobileNo?: string;
  DistanceToChamber1?: number | string;
  DistanceToChamber2?: number | string;
  MediaJson?: string | any[];
  mediaJson?: string | any[];
  Chamber1Id?: number | string;
  chamber1Id?: number | string;
  Chamber2Id?: number | string | null;
  chamber2Id?: number | string | null;
  DistanceBetweenChambers?: number | string;
  CompanyTypeId?: number | string;
  companyTypeId?: number | string;
  ActivityVendorId?: number | string;
  activityVendorId?: number | string;
  VendorName?: string;
  vendorName?: string;
  MediaFiles?: MaintenanceMediaFile[];
  mediaFiles?: MaintenanceMediaFile[];
  WorkForId?: number | string;
  workForId?: number | string;
  Address?: string;
  address?: string;
  Landmark?: string;
  landmark?: string;
  PriorityTypeId?: number | string;
  priorityTypeId?: number | string;
  WorkOnRoute?: number | string;
  workOnRoute?: number | string;
};
export type AssignedChamberComplaintItem = {
  itemId: number | string;
  itemName: string;
  type: string;
  description: string;
  receivedQty: number | string;
  returnQty: number | string;
  isSelected: boolean;
};

export type AssignedChamberComplaintImage = {
  imageType: string;
  imageUrl: string;
};

export type InsertUpdateAssignedChamberComplaintParams = {
  complaintId: number | string;
  employeeId: number | string;
  workStatus: string;
  reasonOfPending: string;
  remark: string;
  returnItems: string;
  assignTaskId: number | string;
  items: AssignedChamberComplaintItem[];
  images: AssignedChamberComplaintImage[];
};
export type InsertActivityStatusParams = {
  activityId: number | string;
  activityTypeId: number | string;
  latLng: string;
  address: string;
  landmark: string;
  routeId: number | string;
  chamber1Id: number | string;
  chamber2Id: number | string;
  distanceToChamber1: number | string;
  distanceToChamber2: number | string;
  distanceBetweenChamber: number | string;
  statusOfActivity: string;
  handOverTo: number | string;
  reason: string;
  remark: string;
  // Image/file
  mediaFiles?: {
    uri: string;
    name?: string;
    type?: string;
  }[];
};
export interface GetEmployeeTaskParams {
  departmentId: string;
  designationId: string;
  employeeId: string;
  zoneId: string;
  shiftId: string;
  search: string;
  page: number;
  size: number;
}
export const insertActivityStatusAPI = createAsyncThunk(
  `${MAINTENANCE}/insertActivityStatus`,
  async (params: InsertActivityStatusParams, thunkAPI) => {
    try {
      const formData = new FormData();

      // Append only when value actually exists
      const appendIfValue = (key: string, value: any) => {
        if (
          value !== undefined &&
          value !== null &&
          String(value).trim() !== ''
        ) {
          formData.append(key, String(value));
        }
      };

      // Normal fields
      appendIfValue('ActivityId', params?.activityId);
      appendIfValue('ActivityTypeId', params?.activityTypeId);
      appendIfValue('LatLng', params?.latLng);
      appendIfValue('Address', params?.address);
      appendIfValue('Landmark', params?.landmark);
      appendIfValue('RouteId', params?.routeId);
      appendIfValue('Chamber1Id', params?.chamber1Id);
      appendIfValue('Chamber2Id', params?.chamber2Id);
      appendIfValue('DistanceToChamber1', params?.distanceToChamber1);
      appendIfValue('DistanceToChamber2', params?.distanceToChamber2);
      appendIfValue(
        'DistanceBetweenChamber',
        params?.distanceBetweenChamber,
      );
      appendIfValue('StatusOfActivity', params?.statusOfActivity);
      appendIfValue('HandOverTo', params?.handOverTo);
      appendIfValue('Reason', params?.reason);
      appendIfValue('Remark', params?.remark);
      appendIfValue(
        'WorkCompletedOnRoute',
        params?.workCompletedOnRoute,
      );

      // MediaJson
      if (
        params?.mediaJson !== undefined &&
        params?.mediaJson !== null &&
        String(params.mediaJson).trim() !== ''
      ) {
        formData.append(
          'MediaJson',
          typeof params.mediaJson === 'string'
            ? params.mediaJson
            : JSON.stringify(params.mediaJson),
        );
      }

      // Media files
      if (Array.isArray(params?.mediaFiles)) {
        params.mediaFiles.forEach((file, index) => {
          if (!file?.uri) {
            return;
          }

          formData.append(
            'MediaFiles',
            {
              uri: file.uri,
              name:
                file.name ??
                `activity_media_${Date.now()}_${index}.jpg`,
              type: file.type ?? 'image/jpeg',
            } as any,
          );
        });
      }

      console.log('Insert Activity Status FormData =>', {
        ActivityId: params?.activityId,
        ActivityTypeId: params?.activityTypeId,
        LatLng: params?.latLng,
        Address: params?.address,
        Landmark: params?.landmark,
        RouteId: params?.routeId,
        Chamber1Id: params?.chamber1Id,
        Chamber2Id: params?.chamber2Id,
        DistanceToChamber1: params?.distanceToChamber1,
        DistanceToChamber2: params?.distanceToChamber2,
        DistanceBetweenChamber: params?.distanceBetweenChamber,
        StatusOfActivity: params?.statusOfActivity,
        HandOverTo: params?.handOverTo,
        Reason: params?.reason,
        Remark: params?.remark,
        WorkCompletedOnRoute: params?.workCompletedOnRoute,
        MediaJson: params?.mediaJson,
        MediaFilesCount: params?.mediaFiles?.filter(
          file => !!file?.uri,
        ).length ?? 0,
      });

      const res = await APIs.postRequestWithFormData({
        path: URLs.getMaintenanceInsertActivityStatus,
        body: formData,
        isAuth: true,
      });

      console.log(
        'Insert Activity Status Response =>',
        res,
      );

      if (
        typeof res === 'string' ||
        res?.status === 200 ||
        res?.success
      ) {
        return res?.data ?? res;
      }

      return thunkAPI.rejectWithValue(
        res?.message ?? 'Unable to insert activity status',
      );
    } catch (err: any) {
      console.log(
        'Insert Activity Status Error =>',
        err,
      );

      return thunkAPI.rejectWithValue(
        err?.message ??
        String(err) ??
        'Something went wrong while inserting activity status',
      );
    }
  },
);
const appendMaintenanceField = (
  formData: FormData,
  key: string,
  value: any,
  defaultValue: any = undefined,
) => {
  const isEmpty = value === undefined || value === null || value === '';
  const resolved = isEmpty ? defaultValue : value;
  if (resolved === undefined) return;
  formData.append(key, String(resolved));
};
export const getEmployeeTaskAPI = createAsyncThunk(
  `${MAINTENANCE}/getEmployeeTask`,
  async (params: GetEmployeeTaskParams, thunkAPI) => {
    try {
      const payload = {
        departmentId: params?.departmentId ?? '',
        designationId: params?.designationId ?? '',
        employeeId: params?.employeeId ?? '',
        zoneId: params?.zoneId ?? '',
        shiftId: params?.shiftId ?? '',
        search: params?.search ?? '',
        page: params?.page ?? 2147483647,
        size: params?.size ?? 100,
      };
      console.log('Get Employee Tracking Request =>', payload);
      const res = await APIs.postRequestWithJsonWithBody({
        path: URLs.getEmployeeTrackingAPI,
        body: payload,
        isAuth: true,
      });

      console.log('Get Employee Tracking Response =>', res);

      if (res?.status === 200 || res?.success) {
        return res?.data ?? [];
      }

      return thunkAPI.rejectWithValue(
        res?.message ?? 'Unable to fetch employee tracking',
      );
    } catch (err: any) {
      console.log('Get Employee Tracking Error =>', err);

      return thunkAPI.rejectWithValue(
        err?.message ?? error(err) ?? 'Something went wrong',
      );
    }
  },
);
// Same as appendMaintenanceField, but with NO default-value fallback:
// if the value is empty, the key is skipped from FormData entirely instead
// of being sent as 0. Use this for fields that are genuinely optional on
// the backend (only relevant conditionally) — e.g. CutTypeId/LocatingTypeId
// (only one applies depending on Activity Type) and ActivityVendorId
// (only present when a vendor was actually picked/passed in route params).
const appendMaintenanceFieldOptional = (
  formData: FormData,
  key: string,
  value: any,
) => {
  const isEmpty = value === undefined || value === null || value === '';
  if (isEmpty) return;
  formData.append(key, String(value));
};
// Infers a mime type from a file name's extension. Used as a last-resort
// fallback when the caller didn't supply `type` — previously everything
// defaulted to 'image/jpeg' even for videos/pngs, which some backends
// reject or mis-decode.
const inferMimeType = (fileName?: string, fallback = 'image/jpeg'): string => {
  if (!fileName) return fallback;
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'heic':
      return 'image/heic';
    case 'mp4':
      return 'video/mp4';
    case 'mov':
      return 'video/quicktime';
    default:
      return fallback;
  }
};

const appendMaintenanceMediaFiles = (
  formData: FormData,
  files?: MaintenanceMediaFile[],
) => {
  if (!files || !files.length) return;
  files.forEach((file, index) => {
    const rawUri = file?.uri ?? file?.path ?? file?.imagePath;
    if (!rawUri) return;
    const uri =
      Platform.OS === 'ios' && !rawUri.startsWith('file://')
        ? `file://${rawUri}`
        : rawUri;
    const name =
      file?.name || file?.fileName || `file_${Date.now()}_${index + 1}.jpg`;
    const type = file?.type || inferMimeType(name);
    formData.append('MediaFiles', {
      uri,
      type,
      name,
    });
  });
};
export const getMaintenanceActivityDDAPI = createAsyncThunk(
  `${MAINTENANCE}/getMaintenanceActivityDD`,
  async (_, thunkAPI) => {
    try {
      const res = await APIs.getRequestWithQuery({
        path: URLs.getMaintenanceList,
        isAuth: true,
      });
      console.log('Maintenance Activity DD =>', res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (err: any) {
      return thunkAPI.rejectWithValue(
        err?.message ?? error(err) ?? 'Something went wrong',
      );
    }
  },
);
export const getListOfItemsChamberComplaintAPI = createAsyncThunk(
  `${MAINTENANCE}/getListOfItemsChamberComplaint`,
  async (
    complaintId: number | string,
    thunkAPI,
  ) => {
    try {
      const res = await APIs.getRequestWithQuery({
        path:
          `${URLs.getListOfItemChamberComplaint}` +
          `?complaintId=${encodeURIComponent(String(complaintId))}`,
        isAuth: true,
      });
      console.log(
        'List Of Items Chamber Complaint =>',
        res,
      );

      if (res?.status === 200 || res?.success) {
        return res?.data ?? [];
      }

      return thunkAPI.rejectWithValue(
        res?.message ??
        'Unable to fetch list of items for chamber complaint',
      );  
    } catch (err: any) {
      console.log(
        'List Of Items Chamber Complaint Error =>',
        err,
      );

      return thunkAPI.rejectWithValue(
        err?.message ??
        error(err) ??
        'Something went wrong while fetching list of items',
      );
    }
  },
);
export const getAssignedChamberComplaintByIdAPI = createAsyncThunk(
  `${MAINTENANCE}/getAssignedChamberComplaintById`,
  async (
    complaintId: number | string,
    thunkAPI,
  ) => {
    try {
      const res = await APIs.getRequestWithQuery({
        path:
          `${URLs.getAssignedChamberComplaintsById}` +
          `?complaintId=${encodeURIComponent(String(complaintId))}`,
        isAuth: true,
      });
      console.log(
        'Get Assigned Chamber Complaint By Id =>',
        res,
      );
      if (res?.status === 200 || res?.success) {
        return res?.data ?? null;
      }
      return thunkAPI.rejectWithValue(
        res?.message ??
        'Unable to fetch assigned chamber complaint by id',
      );
    } catch (err: any) {
      console.log(
        'Get Assigned Chamber Complaint By Id Error =>',
        err,
      );
      return thunkAPI.rejectWithValue(
        err?.message ??
        error(err) ??
        'Something went wrong while fetching assigned chamber complaint',
      );
    }
  },
);
export const insertUpdateAssignedChamberComplaintAPI = createAsyncThunk(
  `${MAINTENANCE}/insertUpdateAssignedChamberComplaint`,
  async (
    params: InsertUpdateAssignedChamberComplaintParams | any,
    thunkAPI,
  ) => {
    try {
      console.log(
        '========== INSERT UPDATE ASSIGNED CHAMBER COMPLAINT =========='
      );
      console.log('THUNK PARAMS =>', params);
      const payload = params?.body ?? params ?? {};
      console.log('FINAL PAYLOAD =>', payload);
      const EmployeeId = await Preferences.getData('EMPLOYEE_ID');
      console.log('EMPLOYEE_ID FROM PREFERENCES =>', EmployeeId);
      const cf = payload?.complaintFollowUp ?? {};
      const us = payload?.updateStatus ?? {};
      const items = Array.isArray(payload?.items)
        ? payload.items
        : [];
      console.log('COMPLAINT FOLLOW UP =>', cf);
      console.log('UPDATE STATUS =>', us);
      console.log('ITEMS =>', items);
      const formData = new FormData();
      formData.append(
        'AssignedComplaintFollowUp.ComplaintId',
        String(cf?.complaintId ?? 0),
      );
      formData.append(
        'AssignedComplaintFollowUp.ChamberId',
        cf?.chamberId,
      );
      formData.append(
        'AssignedComplaintFollowUp.ChamberIdStr',
        String(cf?.chamberIdStr ?? cf?.chamberId ?? ''),
      );
      formData.append(
        'AssignedComplaintFollowUp.IsIssueFound',
        String(Boolean(cf?.isIssueFound)),
      );
      formData.append(
        'AssignedComplaintFollowUp.IssueCategory',
        String(cf?.issueCategory ?? 0),
      );
      formData.append(
        'AssignedComplaintFollowUp.IssueId',
        String(cf?.issueId ?? 0),
      );
      formData.append(
        'AssignedComplaintFollowUp.Lat',
        String(cf?.lat ?? ''),
      );
      formData.append(
        'AssignedComplaintFollowUp.Lng',
        String(cf?.lng ?? ''),
      );
      formData.append(
        'AssignedComplaintFollowUp.GpsLocation',
        String(cf?.gpsLocation ?? ''),
      );
      formData.append(
        'AssignedComplaintFollowUp.Remark',
        String(cf?.remark ?? ''),
      );
      formData.append(
        'AssignedComplaintFollowUp.EmployeeId',
        String(EmployeeId),
      );
      formData.append(
        'AssignedComplaintFollowUp.CompanyCode',
        String(cf?.companyCode ?? 'GTPL'),
      );
      formData.append(
        'AssignedComplaintFollowUp.CreatedOn',
        String(
          cf?.createdOn ??
          new Date().toISOString(),
        ),
      );
      formData.append(
        'AssignedComplaintFollowUp.IsOffline',
        String(Boolean(cf?.isOffline)),
      );
      // =========================================================
      // IMAGES
      // =========================================================
      const imageBySlot: Record<string, any> = {};

      if (Array.isArray(cf?.complaintFollowImage)) {
        cf.complaintFollowImage.forEach((img: any) => {
          if (img?.slot) {
            imageBySlot[img.slot] = img;
          }
        });
      }

      // ---------------------------------------------------------
      // Also support direct image properties if your screen sends
      // them separately.
      // ---------------------------------------------------------

      const appendImageFile = (
        fieldName: string,
        img: any,
      ) => {
        if (!img) {
          console.log(`NO IMAGE FOR ${fieldName}`);
          return;
        }

        if (!img?.uri) {
          console.log(
            `IMAGE URI MISSING FOR ${fieldName}`,
            img,
          );
          return;
        }

        const extension = String(
          img?.imageExtention ??
          img?.extension ??
          'jpg',
        ).replace('.', '');

        const mimeType =
          img?.mimeType ??
          img?.type ??
          `image/${extension}`;

        const fileName =
          img?.fileName ??
          img?.name ??
          `${fieldName
            .split('.')
            .pop()}.${extension}`;

        console.log(
          `APPENDING IMAGE => ${fieldName}`,
          {
            uri: img.uri,
            type: mimeType,
            name: fileName,
          },
        );

        formData.append(
          fieldName,
          {
            uri: img.uri,
            type: mimeType,
            name: fileName,
          } as any,
        );
      };

      appendImageFile(
        'AssignedComplaintFollowUp.InSide',
        imageBySlot['inSide'],
      );

      appendImageFile(
        'AssignedComplaintFollowUp.OutSide',
        imageBySlot['outSide'],
      );

      appendImageFile(
        'AssignedComplaintFollowUp.LeftSide',
        imageBySlot['left'],
      );

      appendImageFile(
        'AssignedComplaintFollowUp.RightSide',
        imageBySlot['right'],
      );

      // =========================================================
      // UpdateStatus.*
      // =========================================================

      formData.append(
        'UpdateStatus.ComplaintId',
        String(
          us?.complaintId ??
          cf?.complaintId ??
          0,
        ),
      );

      formData.append(
        'UpdateStatus.EmployeeId',
        String(EmployeeId),
      );

      formData.append(
        'UpdateStatus.WorkStatus',
        String(us?.workStatus ?? ''),
      );

      formData.append(
        'UpdateStatus.ReasonOfPending',
        String(us?.reasonOfPending ?? ''),
      );

      formData.append(
        'UpdateStatus.Remark',
        String(us?.remark ?? ''),
      );

      formData.append(
        'UpdateStatus.ReturnItemStatus',
        String(us?.returnItems ?? ''),
      );

      formData.append(
        'UpdateStatus.AssignTaskId',
        String(us?.assignTaskId ?? 0),
      );

      // =========================================================
      // Items
      // =========================================================

      formData.append(
        'Items',
        JSON.stringify(items),
      );

      // =========================================================
      // DEBUG FORMDATA
      // =========================================================

      console.log(
        '========== FINAL FORMDATA =========='
      );

      if (Array.isArray((formData as any)?._parts)) {
        (formData as any)._parts.forEach(
          ([key, value]: any, index: number) => {
            if (
              value &&
              typeof value === 'object' &&
              value.uri
            ) {
              console.log(
                `${index}:`,
                key,
                {
                  uri: value.uri,
                  type: value.type,
                  name: value.name,
                },
              );
            } else {
              console.log(
                `${index}:`,
                key,
                value,
              );
            }
          },
        );
      }

      console.log(
        'FORMDATA PART COUNT =>',
        (formData as any)?._parts?.length,
      );

      console.log(
        '==================================='
      );

      // =========================================================
      // API CALL
      // =========================================================

      const res =
        await APIs.postRequestWithFormData({
          path: URLs.insertUpdateChamberComplaint,
          body: formData,
          isAuth: true,
        });

      console.log(
        'Insert Update Assigned Chamber Complaint Response =>',
        res,
      );

      // =========================================================
      // RESPONSE
      // =========================================================

      if (
        typeof res === 'string' ||
        res?.status === 200 ||
        res?.success
      ) {
        return res?.data ?? res;
      }

      return thunkAPI.rejectWithValue(
        res?.message ??
        'Unable to insert/update assigned chamber complaint',
      );
    } catch (err: any) {
      console.log(
        'Insert Update Assigned Chamber Complaint Error =>',
        err,
      );

      return thunkAPI.rejectWithValue(
        err?.message ??
        'Something went wrong while inserting/updating assigned chamber complaint',
      );
    }
  },
);
export const getAssignedChamberComplaintsAPI = createAsyncThunk(
  `${MAINTENANCE}/getAssignedChamberComplaints`,
  async (_, thunkAPI) => {
    try {
      const res = await APIs.getRequestWithQuery({
        path: `${URLs.getAssignedChamberComplaints}`,
        isAuth: true,
      });
      console.log('Assigned Chamber Complaints =>', res);
      if (res?.status === 200 || res?.success) {
        return res?.data ?? [];
      }
      return thunkAPI.rejectWithValue(
        res?.message ?? 'Unable to fetch assigned chamber complaints',
      );
    } catch (err: any) {
      return thunkAPI.rejectWithValue(
        err?.message ??
        error(err) ??
        'Something went wrong while fetching assigned chamber complaints',
      );
    }
  },
);
export const getNearestRouteByLatlngAPI = createAsyncThunk(
  `${MAINTENANCE}/getNearestRouteByLatlng`,
  async (
    params: {
      lat: number;
      lng: number;
      routeType: string;
    },
    thunkAPI,
  ) => {
    try {
      const res = await APIs.getRequestWithQuery({
        path:
          `${URLs.getNearestRouteByLatLong}` +
          `?lat=${encodeURIComponent(String(params?.lat ?? 0))}` +
          `&lng=${encodeURIComponent(String(params?.lng ?? 0))}` +
          `&routeType=${encodeURIComponent(params?.routeType ?? '')}`,
        isAuth: true,
      });
      console.log('Nearest Route By LatLng =>', res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];
      }
      return thunkAPI.rejectWithValue(
        res?.message ?? 'Unable to fetch nearest route',
      );
    } catch (err: any) {
      return thunkAPI.rejectWithValue(
        err?.message ??
        error(err) ??
        'Something went wrong while fetching nearest route',
      );
    }
  },
);
export const getMaintenanceActivityVendorDDAPI = createAsyncThunk(
  `${MAINTENANCE}/getMaintenanceActivityVendorDD`,
  async (search: string, thunkAPI) => {
    try {
      const res = await APIs.getRequestWithQuery({
        path: `${URLs.GetMaintenanceActivityVendors}?search=${search}`,
        isAuth: true,
      });
      console.log('Maintenance Vendor DD =>', res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];
      }
      return thunkAPI.rejectWithValue(
        res?.message ?? 'Unable to fetch maintenance vendors',
      );
    } catch (err: any) {
      return thunkAPI.rejectWithValue(
        err?.message ?? error(err) ?? 'Something went wrong',
      );
    }
  },
);
export const getMaintenanceActivityListByIdAPI = createAsyncThunk(
  `${MAINTENANCE}/getMaintenanceActivityListById`,
  async (id: number | string, thunkAPI) => {
    try {
      const res = await APIs.getRequestWithQuery({
        path: `${URLs.getMaintenanceActivityDetailsById}?activityStatusId=${encodeURIComponent(
          String(id),
        )}`,
        isAuth: true,
      });
      console.log('Maintenance Activity By Id =>', res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? null;
      }
      return thunkAPI.rejectWithValue(
        res?.message ?? 'Unable to fetch maintenance activity by id',
      );
    } catch (err: any) {
      return thunkAPI.rejectWithValue(
        err?.message ?? 'Something went wrong',
      );
    }
  },
);
export const getMaintenanceActivityDetailsAPI = createAsyncThunk(
  `${MAINTENANCE}/getMaintenanceActivityDetails`,
  async (
    params: {
      search?: string;
      activityTypeId: number;
      rangeInMeter: number;
      lat: number;
      lng: number;
    },
    thunkAPI,
  ) => {
    try {
      const res = await APIs.getRequestWithQuery({
        path:
          `${URLs.getMaintenanceActivityDetails}` +
          `?search=${encodeURIComponent(params?.search ?? '')}` +
          `&activityTypeId=${params?.activityTypeId ?? 0}` +
          `&rangeInMeter=${params?.rangeInMeter ?? 0}` +
          `&lat=${params?.lat ?? 0}` +
          `&lng=${params?.lng ?? 0}`,
        isAuth: true,
      });

      console.log('Maintenance Activity Details =>', res);

      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];
      }

      return thunkAPI.rejectWithValue(
        res?.message ?? 'Unable to fetch maintenance activity details',
      );
    } catch (err: any) {
      return thunkAPI.rejectWithValue(
        err?.message ??
        error(err) ??
        'Something went wrong',
      );
    }
  },
);
export const getZonewiseEmpForActivityAPI = createAsyncThunk(
  `${MAINTENANCE}/getZonewiseEmpForActivity`,
  async (
    params: {
      chamber1Id: number | string;
      chamber2Id: number | string;
    },
    thunkAPI,
  ) => {
    try {
      const res = await APIs.getRequestWithQuery({
        path:
          `${URLs.getMaintenanceZonewiseActivity}` +
          `?chamber1Id=${encodeURIComponent(String(params?.chamber1Id ?? 0))}` +
          `&chamber2Id=${encodeURIComponent(String(params?.chamber2Id ?? 0))}`,
        isAuth: true,
      });
      console.log(
        'Zone Wise Employee For Activity =>',
        res,
      );
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];
      }
      return thunkAPI.rejectWithValue(
        res?.message ??
        'Unable to fetch zone wise employees for activity',
      );
    } catch (err: any) {
      return thunkAPI.rejectWithValue(
        err?.message ??
        error(err) ??
        'Something went wrong',
      );
    }
  },
);
export type GetNearestChamberByLatlngParams = {
  lat: number;
  lng: number;
  rangeInMeters: number;
  routeType?: string;
};

export const getNearestChamberByLatlngAPI = createAsyncThunk(
  `${MAINTENANCE}/getNearestChamberByLatlng`,
  async (
    params: GetNearestChamberByLatlngParams,
    thunkAPI,
  ) => {
    try {
      const res = await APIs.getRequestWithQuery({
        path: `${URLs.getMaintenanceNearestChamberByLatLong}?lat=${params.lat}&lng=${params.lng}&rangeInMeters=${params.rangeInMeters}&routeType=${params.routeType}`,
        isAuth: true,
      });
      console.log('Nearest Chamber =>', res);
      if (res?.status === 200 && res?.success) {
        return res.data;
      }
      return thunkAPI.rejectWithValue(
        res?.message ?? 'Unable to fetch nearest chamber',
      );
    } catch (err: any) {
      return thunkAPI.rejectWithValue(
        err?.message ?? error(err) ?? 'Something went wrong',
      );
    }
  },
);
export const getNearestChamberByLatlngAPIByVendor = createAsyncThunk(
  `${MAINTENANCE}/getNearestChamberByLatlngByVendor`,
  async (params: GetNearestChamberByLatlngParams, thunkAPI) => {
    try {
      const res = await APIs.getRequestWithQuery({
        path: `${URLs.getNearestChamberByLatlngForVendor}?lat=${params.lat}&lng=${params.lng}&rangeInMeters=${params.rangeInMeters}`,
        isAuth: true,
      });
      console.log('Nearest Chamber By Vendor =>', res);
      if (res?.status === 200 && res?.success) {
        return res.data;
      }
      return thunkAPI.rejectWithValue(
        res?.message ?? 'Unable to fetch nearest chamber',
      );
    } catch (err: any) {
      return thunkAPI.rejectWithValue(
        err?.message ?? error(err) ?? 'Something went wrong',
      );
    }
  },
);

export const insertMaintenanceActivityAPI = createAsyncThunk(
  `${MAINTENANCE}/insertMaintenanceActivity`,
  async (params: InsertMaintenanceActivityParams, thunkAPI) => {
    try {
      console.log('========== INSERT MAINTENANCE ACTIVITY START ==========');
      console.log('PARAMS (without files) =>', {
        ...params,
        MediaFiles: undefined,
        mediaFiles: undefined,
      });

      const formData = new FormData();
      const mediaJson = params?.MediaJson ?? params?.mediaJson ?? '';
      const cutAlertLocatingTypeId =
        params?.CutAlertLocatingTypeId ??
        params?.CutTypeId ??
        params?.cutTypeId ??
        params?.AlertTypeId ??
        params?.alertTypeId ??
        params?.LocatingTypeId ??
        params?.locatingTypeId;

      appendMaintenanceField(formData, 'Id', params?.Id ?? params?.id, 0);
      appendMaintenanceField(formData, 'Remark', params?.Remark ?? params?.remark);
      appendMaintenanceField(formData, 'WorkById', params?.WorkById ?? params?.workById, 0);
      appendMaintenanceField(formData, 'RouteId', params?.RouteId ?? params?.routeId, 0);
      appendMaintenanceField(formData, 'ActivityTypeId', params?.ActivityTypeId ?? params?.activityTypeId, 0);
      appendMaintenanceField(formData, 'LatLng', params?.LatLng ?? params?.latLng);
      appendMaintenanceField(formData, 'VendorMobileNo', params?.VendorMobileNo ?? params?.vendorMobileNo);
      appendMaintenanceField(
        formData,
        'MediaJson',
        typeof mediaJson === 'string' ? mediaJson : JSON.stringify(mediaJson),
      );
      appendMaintenanceField(formData, 'Chamber1Id', params?.Chamber1Id ?? params?.chamber1Id, 0);
      appendMaintenanceField(formData, 'Chamber2Id', params?.Chamber2Id ?? params?.chamber2Id, 0);
      appendMaintenanceField(formData, 'DistanceBetweenChamber', params?.DistanceBetweenChambers, 0);
      appendMaintenanceField(formData, 'DistanceToChamber1', params?.DistanceToChamber1);
      appendMaintenanceField(formData, 'DistanceToChamber2', params?.DistanceToChamber2);
      appendMaintenanceField(
        formData,
        'CutAlertLocatingTypeId',
        cutAlertLocatingTypeId,
        0,
      );
      appendMaintenanceField(formData, 'PriorityTypeId', params?.PriorityTypeId ?? params?.priorityTypeId, 0);
      formData.append(
        'CompanyTypeId',
        String(params?.CompanyTypeId ?? params?.companyTypeId ?? 0),
      );
      appendMaintenanceField(formData, 'ActivityVendorId', params?.ActivityVendorId ?? params?.activityVendorId, 0);
      appendMaintenanceField(formData, 'VendorName', params?.VendorName ?? params?.vendorName);

      // ---------- MEDIA FILES + SIZE LOGS ----------
      const selectedMedia = params?.MediaFiles ?? params?.mediaFiles ?? [];
      console.log('MEDIA FILES COUNT =>', selectedMedia.length);

      let totalBytes = 0;
      for (let index = 0; index < selectedMedia.length; index++) {
        const item = selectedMedia[index];
        if (!item?.uri) {
          console.log(`MEDIA[${index}] SKIPPED (no uri)`);
          continue;
        }
        const fallbackName = item?.type?.startsWith('video/')
          ? `file_${Date.now()}_${index + 1}.mp4`
          : `file_${Date.now()}_${index + 1}.jpg`;
        const fileName = item.name || item.fileName || fallbackName;
        const fileObj = {
          uri:
            Platform.OS === 'ios' && !item.uri.startsWith('file://')
              ? `file://${item.uri}`
              : item.uri,
          type: item.type || inferMimeType(fileName),
          name: fileName,
        };
        try {
          const exists = await RNFS.exists(item.uri.replace('file://', ''));
          const st = exists
            ? await RNFS.stat(item.uri.replace('file://', ''))
            : null;
          const size = Number(st?.size ?? 0);
          totalBytes += size;
          console.log(
            `MEDIA[${index}] ${fileObj.name} | ${fileObj.type} | exists=${exists} | ${(size / 1048576).toFixed(2)} MB`,
          );
        } catch (e: any) {
          console.log(`MEDIA[${index}] STAT ERROR =>`, e?.message);
        }
        // @ts-ignore - RN FormData file shape
        formData.append('MediaFiles', fileObj);
      }
      console.log('TOTAL UPLOAD MB =>', (totalBytes / 1048576).toFixed(2));

      appendMaintenanceField(formData, 'WorkForId', params?.WorkForId ?? params?.workForId, 0);
      appendMaintenanceField(formData, 'Address', params?.Address ?? params?.address);
      appendMaintenanceField(formData, 'Landmark', params?.Landmark ?? params?.landmark);
      appendMaintenanceField(formData, 'WorkOnRoute', params?.WorkOnRoute ?? params?.workOnRoute, 0);

      // ---------- FORMDATA PARTS LOG ----------
      const parts: any[] = (formData as any)?._parts ?? [];
      console.log('FORMDATA PART COUNT =>', parts.length);
      parts.forEach(([key, value]: any, i: number) => {
        if (value && typeof value === 'object' && value.uri) {
          console.log(`PART ${i}: ${key} => FILE`, value.name, value.type);
        } else {
          console.log(`PART ${i}: ${key} =>`, value);
        }
      });

      const startedAt = Date.now();
      const res = await APIs.postRequestWithFormData({
        path: URLs.insertUpdateMaintenance,
        body: formData,
        params: {},
        isAuth: true,
        timeout: 15 * 60 * 1000,
      });
      console.log('TIME TAKEN (sec) =>', ((Date.now() - startedAt) / 1000).toFixed(1));
      console.log('Insert Maintenance Activity =>', res);

      if (typeof res === 'string' || res?.status === 200 || res?.success) {
        return res?.data ?? res;
      }
      return thunkAPI.rejectWithValue(
        res?.message ?? 'Unable to insert maintenance activity',
      );
    } catch (err: any) {
      console.log('INSERT MAINTENANCE ERROR message =>', err?.message);
      console.log('INSERT MAINTENANCE ERROR code =>', err?.code);
      console.log('INSERT MAINTENANCE ERROR status =>', err?.response?.status);
      console.log('INSERT MAINTENANCE ERROR body =>', JSON.stringify(err?.response?.data));
      return thunkAPI.rejectWithValue(
        err?.message ?? error(err) ?? 'Something went wrong',
      );
    }
  },
);


const maintenanceSlice = createSlice({
  name: MAINTENANCE,
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      // ================= Maintenance Activity =================
      .addCase(getMaintenanceActivityDDAPI.pending, state => {
        state.maintenanceActivityDDLoading = true;
        state.error = null;
      })
      .addCase(getMaintenanceActivityDDAPI.fulfilled, (state, action) => {
        state.maintenanceActivityDDLoading = false;
        state.maintenanceActivityDD = action.payload;
        state.error = null;
      })
      .addCase(getMaintenanceActivityDDAPI.rejected, (state, action) => {
        state.maintenanceActivityDDLoading = false;
        state.error = action.payload as string;
      })
      // ================= Nearest Chamber =================
      .addCase(getNearestChamberByLatlngAPI.pending, state => {
        state.nearestChamberLoading = true;
        state.error = null;
      })
      .addCase(getNearestChamberByLatlngAPI.fulfilled, (state, action) => {
        state.nearestChamberLoading = false;
        state.nearestChamber = action.payload;
        state.error = null;
      })
      .addCase(getNearestChamberByLatlngAPI.rejected, (state, action) => {
        state.nearestChamberLoading = false;
        state.nearestChamber = null;
        state.error = action.payload as string;
      })
      // ================= Nearest Chamber By Vendor =================
      .addCase(getNearestChamberByLatlngAPIByVendor.pending, state => {
        state.nearestChamberByVendorLoading = true;
        state.error = null;
      })
      .addCase(getNearestChamberByLatlngAPIByVendor.fulfilled, (state, action) => {
        state.nearestChamberByVendorLoading = false;
        state.nearestChamberByVendor = action.payload;
        state.error = null;
      })
      .addCase(getNearestChamberByLatlngAPIByVendor.rejected, (state, action) => {
        state.nearestChamberByVendorLoading = false;
        state.nearestChamberByVendor = null;
        state.error = action.payload as string;
      })
      // ================= Insert Maintenance Activity =================
      .addCase(insertMaintenanceActivityAPI.pending, state => {
        state.insertMaintenanceActivityLoading = true;
        state.insertMaintenanceActivityData = null;
        state.error = null;
      })
      .addCase(insertMaintenanceActivityAPI.fulfilled, (state, action) => {
        state.insertMaintenanceActivityLoading = false;
        state.insertMaintenanceActivityData = action.payload;
        state.error = null;
      })
      .addCase(insertMaintenanceActivityAPI.rejected, (state, action) => {
        state.insertMaintenanceActivityLoading = false;
        state.insertMaintenanceActivityData = null;
        state.error = action.payload as string;
      })
      .addCase(
        getMaintenanceActivityDetailsAPI.pending,
        state => {
          state.maintenanceActivityDetailsLoading = true;
          state.error = null;
        },
      )
      .addCase(
        getMaintenanceActivityDetailsAPI.fulfilled,
        (state, action) => {
          state.maintenanceActivityDetailsLoading = false;
          state.maintenanceActivityDetails = action.payload ?? [];
          state.error = null;
        },
      )
      .addCase(
        getMaintenanceActivityDetailsAPI.rejected,
        (state, action) => {
          state.maintenanceActivityDetailsLoading = false;
          state.maintenanceActivityDetails = [];
          state.error = action.payload as string;
        },
      )
      .addCase(
        getMaintenanceActivityListByIdAPI.pending,
        state => {
          state.maintenanceActivityByIdLoading = true;
          state.maintenanceActivityById = null;
          state.error = null;
        },
      )
      .addCase(
        getMaintenanceActivityListByIdAPI.fulfilled,
        (state, action) => {
          state.maintenanceActivityByIdLoading = false;
          state.maintenanceActivityById = action.payload;
          state.error = null;
        },
      )
      .addCase(
        getMaintenanceActivityListByIdAPI.rejected,
        (state, action) => {
          state.maintenanceActivityByIdLoading = false;
          state.maintenanceActivityById = null;
          state.error = action.payload as string;
        },
      )
      // ================= Zone Wise Employee For Activity =================
      .addCase(
        getZonewiseEmpForActivityAPI.pending,
        state => {
          state.zonewiseEmpForActivityLoading = true;
          state.zonewiseEmpForActivity = [];
          state.error = null;
        },
      )
      .addCase(
        getZonewiseEmpForActivityAPI.fulfilled,
        (state, action) => {
          state.zonewiseEmpForActivityLoading = false;
          state.zonewiseEmpForActivity = action.payload ?? [];
          state.error = null;
        },
      )
      .addCase(
        getZonewiseEmpForActivityAPI.rejected,
        (state, action) => {
          state.zonewiseEmpForActivityLoading = false;
          state.zonewiseEmpForActivity = [];
          state.error = action.payload as string;
        },
      )
      .addCase(
        insertActivityStatusAPI.pending,
        state => {
          state.insertActivityStatusLoading = true;
          state.insertActivityStatusData = null;
          state.error = null;
        },
      )
      .addCase(
        insertActivityStatusAPI.fulfilled,
        (state, action) => {
          state.insertActivityStatusLoading = false;
          state.insertActivityStatusData = action.payload;
          state.error = null;
        },
      )
      .addCase(
        insertActivityStatusAPI.rejected,
        (state, action) => {
          state.insertActivityStatusLoading = false;
          state.insertActivityStatusData = null;
          state.error = action.payload as string;
        },
      )
      // ================= Nearest Route By LatLng =================
      .addCase(getNearestRouteByLatlngAPI.pending, state => {
        state.nearestRouteLoading = true;
        state.nearestRoute = null;
        state.error = null;
      })
      .addCase(getNearestRouteByLatlngAPI.fulfilled, (state, action) => {
        state.nearestRouteLoading = false;
        state.nearestRoute = action.payload;
        state.error = null;
      })
      .addCase(getNearestRouteByLatlngAPI.rejected, (state, action) => {
        state.nearestRouteLoading = false;
        state.nearestRoute = null;
        state.error = action.payload as string;
      })
      .addCase(getAssignedChamberComplaintsAPI.pending, state => {
        state.assignedChamberComplaintsLoading = true;
        state.error = null;
      })
      .addCase(getAssignedChamberComplaintsAPI.fulfilled, (state, action) => {
        state.assignedChamberComplaintsLoading = false;
        state.assignedChamberComplaints = action.payload ?? [];
        state.error = null;
      })
      .addCase(getAssignedChamberComplaintsAPI.rejected, (state, action) => {
        state.assignedChamberComplaintsLoading = false;
        state.assignedChamberComplaints = [];
        state.error = action.payload as string;
      })
      .addCase(
        getAssignedChamberComplaintByIdAPI.pending,
        state => {
          state.assignedChamberComplaintByIdLoading = true;
          state.assignedChamberComplaintById = null;
          state.error = null;
        },
      )
      .addCase(
        getAssignedChamberComplaintByIdAPI.fulfilled,
        (state, action) => {
          state.assignedChamberComplaintByIdLoading = false;
          state.assignedChamberComplaintById = action.payload;
          state.error = null;
        },
      )
      .addCase(
        getAssignedChamberComplaintByIdAPI.rejected,
        (state, action) => {
          state.assignedChamberComplaintByIdLoading = false;
          state.assignedChamberComplaintById = null;
          state.error = action.payload as string;
        },
      )
      .addCase(getListOfItemsChamberComplaintAPI.pending, state => {
        state.listOfItemsChamberComplaintLoading = true;
        state.listOfItemsChamberComplaint = [];
        state.error = null;
      },
      )
      .addCase(getListOfItemsChamberComplaintAPI.fulfilled, (state, action) => {
        state.listOfItemsChamberComplaintLoading = false;
        state.listOfItemsChamberComplaint =
          action.payload ?? [];
        state.error = null;
      },
      )
      .addCase(getEmployeeTaskAPI.pending, state => {
      state.employeeTaskLoading = true;
      state.error = null;
    })
      .addCase(getEmployeeTaskAPI.fulfilled, (state, action) => {
        state.employeeTaskLoading = false;
        state.employeeTask = action.payload ?? [];
        state.error = null;
      })
      .addCase(getEmployeeTaskAPI.rejected, (state, action) => {
        state.employeeTaskLoading = false;
        state.error = action.payload as string;
      })
      .addCase(getListOfItemsChamberComplaintAPI.rejected, (state, action) => {
        state.listOfItemsChamberComplaintLoading = false;
        state.listOfItemsChamberComplaint = [];
        state.error = action.payload as string;
      },
      );
      
  },
});

export const maintenanceReducer = maintenanceSlice.reducer;
