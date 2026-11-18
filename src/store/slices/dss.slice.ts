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
import { error } from 'src/utils/common';
const DSS = 'dss';
const dssAdapter = createEntityAdapter();
const numberOrZero = (value: any) => {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return 0;
  }
  return value;
};
/* ===============================
   GET PROJECT LIST API
================================ */
export const getProjectListOfTypeByNameApi = createAsyncThunk(
  `${DSS}/getProjectListOfTypeByName`,
  async (params: any, thunkAPI) => {
    try {
      const empId = await Preferences.getData('EMPLOYEE_ID');
      const res = await APIs.postRequestWithJsonWithBody({
        path: URLs.getDSSProjectListAPI,
        query: {
          projectName: 'Road Project',
          empId: empId,
        },
        body: {
          page: params?.page ?? 0,
          size: params?.size ?? 20,
          search: params?.search ?? '',
          latLong: params?.latLong ?? '',
          range: params?.range ?? 0,
          serviceIds: params?.serviceIds,
        },
        isAuth: true,
      });
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong',
      );
    }
  },
);
export const getProjectListOfTypeByNameApi2 = createAsyncThunk(
  `${DSS}/getProjectListOfTypeByName2`,
  async (params: any, thunkAPI) => {
    try {
      const empId = await Preferences.getData('EMPLOYEE_ID');
      const res = await APIs.postRequestWithJsonWithBody({
        path: URLs.getDSSProjectListAPI2,
        query: {
          projectName: 'Road Project',
          empId: empId,
        },
        body: {
          page: params?.page ?? 0,
          size: params?.size ?? 20,
          search: params?.search ?? '',
          latLong: params?.latLong ?? '',
          range: params?.range ?? 0,
        },
        isAuth: true,
      });
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong',
      );
    }
  },
);
export const getVendorListForShot = createAsyncThunk(
  `${DSS}/getVendorListForShot`,
  async (params: any, thunkAPI) => {
    try {
      const empId = await Preferences.getData('EMPLOYEE_ID');
      const res = await APIs.postRequestWithJsonWithBody({
        path: URLs.vendorListForShotAPI,
        body: {
          employeeID: empId,
          projectId: params?.projectId ?? 0,
        },
        isAuth: true,
      });
      console.log("Vendor API RESPONSE", res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];   // 👈 IMPORTANT
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(error?.message ?? 'Something went wrong');
    }
  },
);
//get_Machine_List
export const getMachineListForShot = createAsyncThunk(
  `${DSS}/getMachineListForShot`,
  async (params: any, thunkAPI) => {
    try {
      const empId = await Preferences.getData('EMPLOYEE_ID');
      const res = await APIs.postRequestWithJsonWithBody({
        path: URLs.machineListForShotAPI,
        body: {
          employeeID: empId,
          vendorId: params?.vendorId,
        },
        isAuth: true,
      });
      console.log("Vendor API RESPONSE", res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];   // 👈 IMPORTANT
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(error?.message ?? 'Something went wrong');
    }
  },
);
export const getVendorLocatorListAPI = createAsyncThunk(
  `${DSS}/getvendorLocatorlistapi`,
  async (params: any, thunkAPI) => {
    try {
      const apiUrl = `${URLs.vendorLocatorName}?vendorId=${params.vendorId}`;
      console.log('apiUrl:==>', { apiUrl })
      const res = await APIs.getRequestWithQuery({
        path: apiUrl,
        isAuth: true,
      });
      console.log("Vendor Locator API RESPONSE", res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];   // 👈 IMPORTANT
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(error?.message ?? 'Something went wrong');
    }
  },
);
export const getMasterListAPI = createAsyncThunk(
  `${DSS}/getmasterlistapi`,
  async (params: any, thunkAPI) => {
    try {
      const apiUrl = `${URLs.gerMasterDD}`;
      console.log('apiUrl:==>', { apiUrl })
      const res = await APIs.getRequestWithQuery({
        path: apiUrl,
        isAuth: true,
      });
      console.log("master list API RESPONSE", res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];   // 👈 IMPORTANT
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(error?.message ?? 'Something went wrong');
    }
  },
);
//getProjectStoreItemList
export const getProjectStoreItemListAPI = createAsyncThunk(
  `${DSS}/getProjectStoreItemList`,
  async (params: any, thunkAPI) => {
    try {
      const apiUrl = `${URLs.getProjectStoreItemTypeDD}?projectId=${params.projectId}&storeId=${params.storeId}&itemId=${params.itemId}`;
      console.log('apiUrl:==>', { apiUrl })
      const res = await APIs.getRequestWithQuery({
        path: apiUrl,
        isAuth: true,
      });
      console.log("project store item. Type list API RESPONSE", res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];   // 👈 IMPORTANT
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(error?.message ?? 'Something went wrong');
    }
  },
);
//getDrumNumberList
export const getDrumNumberListAPI = createAsyncThunk(
  `${DSS}/getDrumNumberListAPI`,
  async (params: any, thunkAPI) => {
    try {
      const apiUrl = `${URLs.getDrumNumberList}?projectId=${params.projectId}&storeId=${params.storeId}&itemTypeId=${params.itemId}`;
      console.log('apiUrl:==>', { apiUrl })
      const res = await APIs.getRequestWithQuery({
        path: apiUrl,
        isAuth: true,
      });
      console.log("project store item. Type list API RESPONSE", res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];   // 👈 IMPORTANT
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(error?.message ?? 'Something went wrong');
    }
  },
);
//getVendorStoreItemList
export const getVendorStoreItemListAPI = createAsyncThunk(
  `${DSS}/VendorMaster/GetVendorStoreDD2`,
  async (params: any, thunkAPI) => {
    try {
      console.log('venodrDataParams:', params);

      const apiUrl = `${URLs.getVendorStoreDD2}?vendorId=${params}`;
      console.log('apiUrl:==>', { apiUrl })
      const res = await APIs.getRequestWithQuery({
        path: apiUrl,
        isAuth: true,
      });
      console.log("vendor store item list. Type list API RESPONSE", res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];   // 👈 IMPORTANT
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(error?.message ?? 'Something went wrong');
    }
  },
);
//getVendorStoreItemList
export const getCompanyStoreListAPI = createAsyncThunk(
  `${DSS}/Store/GetStoreDD`,
  async (params: any, thunkAPI) => {
    try {
      const apiUrl = `${URLs.getCompanyStoreDD}`;
      console.log('apiUrl:==>', { apiUrl })
      const res = await APIs.getRequestWithQuery({
        path: apiUrl,
        isAuth: true,
      });
      console.log("company store item list. Type list API RESPONSE", res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];   // 👈 IMPORTANT
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(error?.message ?? 'Something went wrong');
    }
  },
);
export const getCutVendorsAPI = createAsyncThunk(
  `${DSS}/getCutVendors`,
  async (_: void, thunkAPI) => {
    try {
      const res = await APIs.getRequestWithQuery({
        path: URLs.getCutVendors,
        isAuth: true,
      });

      console.log('Get Cut Vendors RESPONSE =>', res);

      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];
      }

      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong',
      );
    }
  },
);
//getEmployeelistDetails
export const getEmployeeDetailsApi = createAsyncThunk(
  `${DSS}/getProjectStoreItemList`,
  async (_: void, thunkAPI) => {   // 👈 FIX HERE
    try {
      const apiUrl = `${URLs.getEmployeeDetailsDD}`;
      const res = await APIs.getRequestWithQuery({
        path: apiUrl,
        isAuth: true,
      });
      console.log("employee details api response::", res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];   // 👈 already correct
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(error?.message ?? 'Something went wrong');
    }
  },
);
export const getProjectItemByStoreAPI = createAsyncThunk(
  `${DSS}/getProjectStoreItemList`,
  async (params: any, thunkAPI) => {
    try {
      const apiUrl = `${URLs.getProjectItems}?id=${params.projectId}`;
      console.log('apiUrl:==>', { apiUrl })
      const res = await APIs.getRequestWithQuery({
        path: apiUrl,
        isAuth: true,
      });
      console.log("project store item. Type list API RESPONSE", res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];   // 👈 IMPORTANT
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(error?.message ?? 'Something went wrong');
    }
  },
);
export const insertUpdateStockRequestAPI = createAsyncThunk(
  `${DSS}/insertUpdateStockRequest`,
  async (params: any, thunkAPI) => {
    try {
      const apiUrl = `${URLs.insertUpdateStockRequest}`; // 👈 URL add करना

      console.log('STOCK REQUEST PAYLOAD =>', params);

      const res = await APIs.postRequestWithJsonWithBody({
        path: apiUrl,
        body: params,
        isAuth: true,
      });

      console.log('STOCK REQUEST RESPONSE =>', res);

      if (res?.status === 200 && res?.success) {
        return res?.data ?? {};
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong',
      );
    }
  },
);
export const insertUpdateStockReturnAPI = createAsyncThunk(
  `${DSS}/insertUpdateStockReturn`,
  async (params: any, thunkAPI) => {
    try {
      const apiUrl = `${URLs.insertUpdateStockReturn}`; // 👈 URL add करना
      console.log('STOCK REQUEST PAYLOAD =>', params);
      const res = await APIs.postRequestWithJsonWithBody({
        path: apiUrl,
        body: params,
        isAuth: true,
      });
      console.log('STOCK RETURN RESPONSE =>', res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? {};
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong',
      );
    }
  },
);
export const getSLDEReportAPI = createAsyncThunk(
  `${DSS}/getSLDEReport`,
  async (params: { projectId: number, ductNo: number }, thunkAPI) => {
    try {
      const apiUrl = `${URLs.getPitListBySLDId}?RoadPrjectId=${params.projectId}&DuctNo=${params.ductNo}`;
      const res = await APIs.getRequestWithQuery({
        path: apiUrl,
        isAuth: true,
      });
      console.log("getSLDEReportAPI RESPONSE", res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong',
      );
    }
  },
);
export const VendorStoreListAPI = createAsyncThunk(
  `${DSS}/getvendorStorelistapi`,
  async (params: any, thunkAPI) => {
    try {
      const apiUrl = `${URLs.getVendorStoreForShot}?vendorId=${params.vendorId}&projectId=${params.projectId}`;
      console.log('Vendor Store API URL =>', apiUrl);
      const res = await APIs.getRequestWithQuery({
        path: apiUrl,
        isAuth: true,
      });
      console.log("Vendor Store API RESPONSE", res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong'
      );
    }
  },
);
export const insertUpdateShotFromAPI = createAsyncThunk(
  `${DSS}/insertUpdateShotFrom`,
  async (params: any, thunkAPI) => {
    try {
      const empId = await Preferences.getData('EMPLOYEE_ID');

      const formData = new FormData();

      formData.append('Id', String(params?.id ?? 0));
      formData.append('ProjectId', String(params?.projectId ?? 0));
      formData.append('EmployeeId', String(empId ?? ''));
      formData.append('VendorId', String(params?.vendorId ?? ''));
      formData.append('MachineId', String(params?.machineId ?? ''));
      formData.append('LocatorId', String(params?.locatorId ?? ''));
      formData.append('OperatorId', String(params?.operatorId ?? ''));
      formData.append(
        'FromPitLocationId',
        String(params?.pitLocationId ?? 0),
      );

      formData.append('ShotTypeId', String(params?.shotTypeId ?? 0));

      formData.append(
        'FromLandmark',
        String(params?.fromLandmark ?? ''),
      );

      formData.append(
        'FromShotGPSAddress',
        String(params?.gpsAddress ?? ''),
      );

      formData.append('Lat', String(params?.lat ?? ''));
      formData.append('Lng', String(params?.lng ?? ''));

      formData.append('FromLat', String(params?.fromLat ?? ''));
      formData.append('FromLng', String(params?.fromLng ?? ''));

      formData.append(
        'ChamberName',
        String(params?.chamberName ?? ''),
      );

      formData.append(
        'NumberOfDucts',
        String(params?.numberOfDucts ?? 0),
      );

      formData.append('Address', String(params?.address ?? ''));
      formData.append('Remarks', String(params?.remarks ?? ''));
      formData.append('SendId', String(params?.sendId ?? 0));

      // =========================
      // IMAGE 1
      // =========================

      if (params?.pic1) {
        const imageUri =
          params?.pic1?.path ||
          params?.pic1?.uri ||
          params?.pic1?.imagePath;

        if (imageUri) {
          const fileName =
            imageUri.split('/').pop() ||
            `from_pic1_${Date.now()}.jpg`;

          const fileType =
            fileName.endsWith('.png')
              ? 'image/png'
              : 'image/jpeg';

          formData.append('FromPic1', {
            uri:
              Platform.OS === 'ios'
                ? imageUri.replace('file://', '')
                : imageUri,
            type: fileType,
            name: fileName,
          } as any);
        }
      }

      // =========================
      // IMAGE 2
      // =========================

      if (params?.pic2) {
        const imageUri =
          params?.pic2?.path ||
          params?.pic2?.uri ||
          params?.pic2?.imagePath;

        if (imageUri) {
          const fileName =
            imageUri.split('/').pop() ||
            `from_pic2_${Date.now()}.jpg`;

          const fileType =
            fileName.endsWith('.png')
              ? 'image/png'
              : 'image/jpeg';

          formData.append('FromPic2', {
            uri:
              Platform.OS === 'ios'
                ? imageUri.replace('file://', '')
                : imageUri,
            type: fileType,
            name: fileName,
          } as any);
        }
      }
      console.log(
        'UPLOAD STARTED => ',
        JSON.stringify(formData, null, 2),
      );
      const response = await APIs.postRequestWithFormData({
        path: URLs.insertUpdateShotFrom,
        body: formData,
        timeout: 120000,
      });
      return response?.data;
    } catch (error: any) {
      console.log('UPLOAD ERROR => ', error);

      return thunkAPI.rejectWithValue(
        error?.response?.data?.message ||
        error?.message ||
        'Upload failed',
      );
    }
  },
);
export const insertFiberBlowingDetails = createAsyncThunk(
  `${DSS}/insertFiberBlowingDetails`,
  async (params: any, thunkAPI) => {
    try {
      console.log('insertFiberBlowingDetails');
      // =========================
      // HELPER — base64 → temp file → returns local file URI
      // =========================
      const base64ToTempFile = async (
        imageData: string,
        imageExtention: string,
        prefix: string,
      ): Promise<string> => {
        const ext = imageExtention ?? 'jpg';
        const fileName = `${prefix}_${Date.now()}.${ext}`;
        const filePath = `${RNFS.TemporaryDirectoryPath}/${fileName}`;
        await RNFS.writeFile(filePath, imageData, 'base64');
        return Platform.OS === 'ios' ? filePath : `file://${filePath}`;
      };
      const formData = new FormData();
      // =========================
      // NORMAL FIELDS
      // =========================
      formData.append('Id', String(params?.id ?? 0));
      formData.append('ProjectId', String(params?.projectId ?? 0));
      formData.append('VendorId', String(params?.vendorId ?? 0));
      formData.append('VendorStoreId', String(params?.vendorStoreId ?? 0));
      formData.append('FibreType', String(params?.fibreType ?? 0));
      formData.append('FibreDrumNo', String(params?.fibreDrumNo ?? 0));
      formData.append('FromChamberInstallId', String(params?.fromChamberInstallId ?? 0));
      formData.append('ToChamberInstallId', String(params?.toChamberInstallId ?? 0));
      formData.append('ColorId', String(numberOrZero(params?.colorId)));
      formData.append('ShotMapDuctColorId', String(params?.shotMapDuctColorId ?? 0));
      formData.append('FibreLength', String(params?.fibreLength ?? 0));
      formData.append('FibreLoopLength', String(params?.fibreLoopLength ?? 0));
      formData.append('Remark', String(params?.remark ?? ''));
      formData.append('ChamberInstallId', String(params?.ChamberInstallId ?? 0));
      formData.append('DuctNo', String(params?.DuctNo ?? 0));
      formData.append('PitId', String(params?.PitId ?? 0));
      // =========================
      // DRUM IMAGE — base64 → temp file → file URI
      // =========================
      if (params?.drumPic?.imageData) {
        const fileUri = await base64ToTempFile(
          params.drumPic.imageData,
          params.drumPic.imageExtention ?? 'jpg',
          'drum',
        );

        const fileName = fileUri.split('/').pop() || `drum_${Date.now()}.jpg`;
        const fileType = fileName.endsWith('.png') ? 'image/png' : 'image/jpeg';

        formData.append('DrumPic', {
          uri: Platform.OS === 'ios' ? fileUri.replace('file://', '') : fileUri,
          type: fileType,
          name: fileName,
        } as any);
      }
      // =========================
      // CHAMBER IMAGE — base64 → temp file → file URI
      // =========================
      if (params?.chamberPic?.imageData) {
        const fileUri = await base64ToTempFile(
          params.chamberPic.imageData,
          params.chamberPic.imageExtention ?? 'jpg',
          'chamber',
        );
        const fileName = fileUri.split('/').pop() || `chamber_${Date.now()}.jpg`;
        const fileType = fileName.endsWith('.png') ? 'image/png' : 'image/jpeg';
        formData.append('ChamberPic', {
          uri: Platform.OS === 'ios' ? fileUri.replace('file://', '') : fileUri,
          type: fileType,
          name: fileName,
        } as any);
      }
      console.log('FIBER FORM DATA READY =>', JSON.stringify(formData, null, 2));
      const res = await APIs.postRequestWithFormData({
        path: URLs.insertFiberBlowingDetails,
        body: formData,
        params: {},
        isAuth: true,
        timeout: 120000,
        onUploadProgress: progressEvent => {
          const percent = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1),
          );
          console.log('UPLOAD PROGRESS =>', percent + '%');
        },
      });
      console.log('FIBER RESPONSE =>', res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? {};
      }

      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      console.log('FIBER API ERROR =>', error);
      return thunkAPI.rejectWithValue(
        error?.response?.data?.message ||
        error?.message ||
        'Something went wrong',
      );
    }
  },
);
export const insertUpdateABDMaster = createAsyncThunk(
  `${DSS}/insertupadteabdmaster`,
  async (params: any, thunkAPI) => {
    try {
      console.log('insertUpdateABDMaster params =>', params);
      // ── Helper: base64 string → temp file URI ──
      const base64ToTempFile = async (
        imageData: string,
        imageExtension: string,
        prefix: string,
      ): Promise<string> => {
        const ext = imageExtension ?? 'jpg';
        const fileName = `${prefix}_${Date.now()}.${ext}`;
        const filePath = `${RNFS.TemporaryDirectoryPath}/${fileName}`;
        await RNFS.writeFile(filePath, imageData, 'base64');
        return Platform.OS === 'ios' ? filePath : `file://${filePath}`;
      };

      const formData = new FormData();
      // =============================================================
      formData.append('Id', String(params?.id ?? 0));
      formData.append('ProjectId', String(params?.projectId ?? 0));
      formData.append('VendorId', String(params?.vendorId ?? 0));
      formData.append('FromPitLocationID', String(params?.fromPitLocationID ?? 0));
      formData.append('ToPitLocationID', String(params?.toPitLocationID ?? 0));
      formData.append('OrderNo', String(params?.orderNo ?? 0));
      formData.append('Depth', String(params?.depth ?? 0));
      formData.append('Offset', String(params?.offset ?? 0));
      formData.append('Address', String(params?.address ?? ''));
      formData.append('Landmark', String(params?.landmark ?? ''));
      formData.append('Lat', String(params?.lat ?? ''));
      formData.append('Lng', String(params?.lng ?? ''));
      formData.append('Remarks', String(params?.remarks ?? ''));
      formData.append('distance', String(params?.distance ?? ''));

      // =============================================================
      // PIC 1 — base64 BurnResult → temp file → multipart file
      // =============================================================
      if (params?.pic1?.imageData) {
        const fileUri = await base64ToTempFile(
          params.pic1.imageData,
          params.pic1.imageExtention ?? 'jpg',
          'pic1',
        );
        const fileName = fileUri.split('/').pop() || `pic1_${Date.now()}.jpg`;
        const fileType = fileName.endsWith('.png') ? 'image/png' : 'image/jpeg';

        formData.append('Pic1', {
          uri: Platform.OS === 'ios' ? fileUri.replace('file://', '') : fileUri,
          type: fileType,
          name: fileName,
        } as any);
      } else {
        // Send empty string when no image so the field is still present
        formData.append('Pic1', '');
      }

      // =============================================================
      // PIC 2 — base64 BurnResult → temp file → multipart file
      // =============================================================
      if (params?.pic2?.imageData) {
        const fileUri = await base64ToTempFile(
          params.pic2.imageData,
          params.pic2.imageExtention ?? 'jpg',
          'pic2',
        );
        const fileName = fileUri.split('/').pop() || `pic2_${Date.now()}.jpg`;
        const fileType = fileName.endsWith('.png') ? 'image/png' : 'image/jpeg';

        formData.append('Pic2', {
          uri: Platform.OS === 'ios' ? fileUri.replace('file://', '') : fileUri,
          type: fileType,
          name: fileName,
        } as any);
      } else {
        formData.append('Pic2', '');
      }

      console.log('ABD FORM DATA READY =>', JSON.stringify(formData, null, 2));

      const res = await APIs.postRequestWithFormData({
        path: URLs.insertUpdateAbdMaster,
        body: formData,
        params: {},
        isAuth: true,
        timeout: 120000,

        onUploadProgress: (progressEvent: any) => {
          const percent = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1),
          );
          console.log('UPLOAD PROGRESS =>', percent + '%');
        },
      });

      console.log('ABD MASTER RESPONSE =>', res);

      if (res?.status === 200 && res?.success) {
        return res?.data ?? {};
      }

      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      console.log('ABD MASTER API ERROR =>', error);
      return thunkAPI.rejectWithValue(
        error?.response?.data?.message ||
        error?.message ||
        'Something went wrong',
      );
    }
  },
);

export const shotTypeListAPI = createAsyncThunk(
  `${DSS}/getshottype`,
  async (params: any, thunkAPI) => {
    try {
      const apiUrl = `${URLs.getShotTypeDD}`;
      const res = await APIs.getRequestWithQuery({
        path: apiUrl,
        isAuth: true,
      });
      console.log("Vendor API RESPONSE", res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];   // 👈 IMPORTANT
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(error?.message ?? 'Something went wrong');
    }
  },
);
export const checkPitLocationNoAPI = createAsyncThunk(
  `${DSS}/checkPitLocationNo`,
  async (params: any, thunkAPI) => {
    try {
      const res = await APIs.postRequestWithJsonWithBody({
        path: URLs.checkPitLocation,
        body: {
          projectId: params?.projectId ?? 0,
          employeeId: params?.employeeId,
          pitLocationNo: params?.pitLocationNo ?? 0,
        },
        isAuth: true,
      });
      if (res?.status === 200) {
        return res?.data ?? {};
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong',
      );
    }
  },
);
export const insertUpdateShotToAPI = createAsyncThunk(
  `${DSS}/insertUpdateShotTo`,
  async (params: any, thunkAPI) => {
    try {
      console.log('insertUpdateShotToAPI');
      const formData = new FormData();
      formData.append('Id', String(params?.id ?? 0));
      formData.append('ProjectId', String(params?.projectId ?? 0));
      formData.append(
        'ToPitLocationId',
        String(params?.toPitLocationId ?? 0),
      );
      formData.append(
        'ToLandmark',
        String(params?.toLandmark ?? ''),
      );
      formData.append(
        'ToRemarks',
        String(params?.toRemarks ?? ''),
      );
      formData.append(
        'ToShotGPSAddress',
        String(params?.toShotGPSAddress ?? ''),
      );
      formData.append(
        'ToLat',
        String(params?.toLat ?? ''),
      );
      formData.append(
        'ToLng',
        String(params?.toLng ?? ''),
      );
      formData.append(
        'Distance',
        String(params?.Distance ?? params?.distance ?? 0),
      );
      formData.append(
        'Distance2',
        String(params?.Distance2 ?? 0),
      );
      formData.append(
        'ShotItemList',
        typeof params?.ShotItemList === 'string'
          ? params.ShotItemList
          : JSON.stringify(params?.ShotItemList ?? []),
      );
      if (params?.pic1) {
        const imageUri =
          params?.pic1?.path ||
          params?.pic1?.uri ||
          params?.pic1?.imagePath;
        if (imageUri) {
          const fileName =
            imageUri.split('/').pop() ||
            `to_pic1_${Date.now()}.jpg`;
          const fileType =
            fileName.endsWith('.png')
              ? 'image/png'
              : 'image/jpeg';
          formData.append('ToPic1', {
            uri:
              Platform.OS === 'ios'
                ? imageUri.replace('file://', '')
                : imageUri, 
            type: fileType,
            name: fileName,
          } as any);
        }
      }
      if (params?.pic2) {
        const imageUri =
          params?.pic2?.path ||
          params?.pic2?.uri ||
          params?.pic2?.imagePath;
        if (imageUri) {
          const fileName =
            imageUri.split('/').pop() ||
            `to_pic2_${Date.now()}.jpg`;
          const fileType =
            fileName.endsWith('.png')
              ? 'image/png'
              : 'image/jpeg';
          formData.append('ToPic2', {
            uri:
              Platform.OS === 'ios'
                ? imageUri.replace('file://', '')
                : imageUri,
            type: fileType,
            name: fileName,
          } as any);
        }
      }

      console.log('📦 FINAL FORM DATA READY');

      const res = await APIs.postRequestWithFormData({
        path: URLs.insertUpdateShotTo,
        body: formData,
        isAuth: true,
        timeout: 120000,
      });

      console.log('SHOT TO RESPONSE =>', res);

      if (res?.status === 200 && res?.success) {
        return res?.data ?? {};
      }

      return thunkAPI.rejectWithValue(
        res?.message ?? 'API Failed',
      );
    } catch (error: any) {
      console.log('SHOT TO ERROR => ', error);

      return thunkAPI.rejectWithValue(
        error?.response?.data?.message ||
        error?.message ||
        'Something went wrong',
      );
    }
  },
);
export const getOpenShotDetailsByIdAPI = createAsyncThunk(
  `${DSS}/getOpenShotDetailsById`,
  async (params: any, thunkAPI) => {
    try {
      const apiUrl =
        `${URLs.GetOpenShotDetailsById}?id=${params?.pitLocationId ?? 0}`;
      console.log('OPEN SHOT API URL =>', apiUrl);
      const res = await APIs.postRequestWithQuery({
        path: apiUrl,
        isAuth: true,
      });
      console.log('OPEN SHOT API RESPONSE =>', res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? {};
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong'
      );
    }
  }
);
//
export const getNearestPitLatLng = createAsyncThunk(
  `${DSS}/getNearestPitLatLng`,
  async (params: any, thunkAPI) => {
    try {
      console.info('getNearestPitLatLng', params);
      const apiUrl =
        `${URLs.getLastPitDetails}?id=${params?.pitLocationId ?? 0}`;
      console.log('Nearest Pit Lat Lng API URL =>', apiUrl);
      const res = await APIs.postRequestWithQuery({
        path: apiUrl,
        isAuth: true,
      });
      console.log('Nearest Pit lat long RESPONSE =>', res);
      if (res?.status === 200 && res?.success) {  
        return res?.data ?? {};
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong'
      );
    }
  }
);
export interface PitImagePayload {
  path?: string;
  uri?: string;
  imagePath?: string;

  fileName?: string;
  type?: string;

  imageData?: string;
  imageExtention?: string;

}
export interface InsertUpdatePitLocationPayload {
  id: number;
  employeeID: number;
  projectID: number;
  pitNo: number;
  pitLandmark: string;
  pitGPSLocation: string;
  lat: string;
  lng: string;
  vendorId: number;

  pic1: any;
  pic2: any;

  distance: number;

  nextPitId?: number;
  nextPitDistance?: number;
}
export const getPitList = createAsyncThunk(
  `${DSS}/getPitList`,
  async (params: any, thunkAPI) => {
    try {
      const res = await APIs.postRequestWithJsonWithBody({
        path: URLs.getPitListAPI,
        body: {
          projectId: params?.projectId ?? 0,
        },
        isAuth: true,
      });
      console.log('PIT LIST API RESPONSE =>', res);
      if (res?.status === 200 && res?.success) {
        return {
          data: res?.data ?? [],
          path: res?.path ?? null,   // CHANGED — keep path alongside data
        };
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong',
      );
    }
  },
);
export const getPitListwithLiveShotStatus = createAsyncThunk(
  `${DSS}/getPitListwithShotStatus`,
  async (params: any, thunkAPI) => {
    console.log('getPitListwithShotStatus', { params })
    try {
      const res = await APIs.postRequestWithJsonWithBody({
        path: URLs.getPitListAPIWithShotStatus,
        body: {
          projectId: params?.projectId ?? 0,
        },
        isAuth: true,
      });
      console.log('PIT LIST With SHot Status API RESPONSE =>', res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong',
      );
    }
  },
);
export const getPitListwithABDShotStatus = createAsyncThunk(
  `${DSS}/getPitListwithAbdShotStatus`,
  async (params: any, thunkAPI) => {
    console.log('getPitListwithShotStatus', { params })
    try {
      const res = await APIs.postRequestWithJsonWithBody({
        path: URLs.PitLocationListWithABDShotStatus,
        body: {
          projectId: params?.projectId ?? 0,
        },
        isAuth: true,
      });
      console.log('PIT LIST With ABD SHot Status Status API RESPONSE =>', res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong',
      );
    }
  },
);


export const getStockRequestsAPI = createAsyncThunk(
  `${DSS}/GetStockRequestsIdsDD`,
  async (params: any, thunkAPI) => {
    try {
      const apiUrl = `${URLs.getStockRequests}?fromDate=${params.fromDate}&toDate=${params.toDate}`;
      console.log('ApiUrl:==>', { apiUrl })
      const res = await APIs.getRequestWithQuery({
        path: apiUrl,
        isAuth: true,
      })
      console.log("getStockRequestsAPI")
      if (res?.status === 200 && res?.success) {
        return res?.data ?? []; //Important  
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong',
      );
    }
  }
)
export const getStockRequestbyIdAPI = createAsyncThunk(
  `${DSS}/GetStockRequestById`,
  async (params: any, thunkAPI) => {
    try {
      const apiUrl = `${URLs.getRequestById}?id=${params.id}`;
      console.log('ApiUrl:==>', { apiUrl })
      const res = await APIs.getRequestWithQuery({
        path: apiUrl,
        isAuth: true,
      })
      console.log("getStockRequestbyIdAPI")
      if (res?.status === 200 && res?.success) {
        return res?.data ?? []; //Important  
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong',
      );
    }
  }
)
export const getPitListWithChamberStatus = createAsyncThunk(
  `${DSS}/getPitListwithChamberStatus`,
  async (params: any, thunkAPI) => {
    try {
      console.log('getPitListwithChamberStatus', { params })
      const apiUrl = `${URLs.getPitListWithChamberStatus}?projectId=${params.projectId}`;
      console.log('ApiUrl:==>', { apiUrl })
      const res = await APIs.getRequestWithQuery({
        path: apiUrl,
        isAuth: true,
      })
      console.log("pitlistwithChamberstatus")
      if (res?.status === 200 && res?.success) {
        return res?.data ?? []; //Important  
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong',
      );
    }
  }
)
//get HotoChecjkList By Id
export const getHotoCheckListById = createAsyncThunk(
  `${DSS}/getHotoCheckListById`,
  async (params: any, thunkAPI) => {
    try {
      const apiUrl = `${URLs.getHotoDatagetbyId}?projectId=${params.projectId}&chamberId=${params.chamberId}`;
      console.log('Get HOTO Checklist By Id URL =>', apiUrl);
      const res = await APIs.getRequestWithQuery({
        path: apiUrl,
        isAuth: true,
      });
      console.log('Get HOTO Checklist By Id RESPONSE =>', res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? {};
      }
      return thunkAPI.rejectWithValue(
        res?.message ?? 'API Failed',
      );
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong',
      );
    }
  },
);
export const getAddCutDropdownMasterAPI = createAsyncThunk(
  `${DSS}/getAddCutDropdownMaster`,
  async (_: void, thunkAPI) => {
    try {
      const res = await APIs.getRequestWithQuery({
        path: URLs.getAddCutDownMaster,
        isAuth: true,
      });

      console.log('Get Add Cut Dropdown Master RESPONSE =>', res);

      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];
      }

      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong',
      );
    }
  },
);
export const getPitListWithHotoStatus = createAsyncThunk(
  `${DSS}/getPitListwithHotoStatus`,
  async (params: any, thunkAPI) => {
    try {
      console.log('getPitListwithHotoStatus', { params })
      const apiUrl = `${URLs.HotoListAPI}?projectId=${params.projectId}`;
      console.log('ApiUrl:==>', { apiUrl })
      const res = await APIs.getRequestWithQuery({
        path: apiUrl,
        isAuth: true,
      })
      console.log("pitlistwithHotostatus")
      if (res?.status === 200 && res?.success) {
        return res?.data ?? []; //Important  
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong',
      );
    }
  }
)
export const insertUpdateHotoCheckListAPI = createAsyncThunk(
  `${DSS}/insertUpdateHotoCheckList`,
  async (params: any, thunkAPI) => {
    try {
      console.log('HOTO CHECKLIST PARAMS =>', params);
      const formData = new FormData();
      // =========================
      // NORMAL FIELDS
      // =========================
      formData.append('Id', String(params?.id ?? 0));
      formData.append('ProjectId', String(params?.projectId ?? 0));
      //formData.append('VendorId', String(params?.vendorId ?? 0));
      formData.append('ChamberId', String(params?.chamberId ?? 0));
      formData.append(
        'ABDWithGraph',
        String(params?.abdWithGraph ?? ''),
      );
      formData.append(
        'FiberType',
        String(params?.fiberType ?? ''),
      );
      formData.append(
        'FiberReading',
        params?.fiberReading?.toString() ?? '',
      );
      formData.append(
        'ChamberCCInside',
        String(params?.chamberCCInside ?? ''),
      );
      formData.append(
        'ChamberCCOutside',
        String(params?.chamberCCOutside ?? ''),
      );
      formData.append(
        'Simplex',
        String(params?.simplex ?? ''),
      );
      formData.append(
        'CableTie',
        String(params?.cableTie ?? ''),
      );

      // =========================
      // JC / LOOP (Only One)
      // =========================

      const hasLoop = !!String(params?.loop ?? '').trim();
      const hasJc = !!String(params?.jc ?? '').trim();

      if (hasLoop) {
        formData.append('Loop', String(params.loop));
      } else if (hasJc) {
        formData.append('Jc', String(params.jc));
      }

      formData.append(
        'RowPermission',
        String(params?.rowPermission ?? ''),
      );

      formData.append(
        'Remarks',
        String(params?.remarks ?? ''),
      );

      formData.append(
        'Lat',
        String(params?.lat ?? ''),
      );

      formData.append(
        'Lon',
        String(params?.lon ?? ''),
      );

      formData.append(
        'GPSLocation',
        String(params?.gpsLocation ?? ''),
      );

      // =========================
      // IMAGE HELPER
      // =========================

      const appendImage = (key: string, image: any) => {
        if (!image) return;

        const imageUri =
          image?.path ||
          image?.uri ||
          image?.imagePath;

        if (!imageUri) return;

        const fileName =
          imageUri.split('/').pop() ||
          `${key}_${Date.now()}.jpg`;

        const fileType = fileName.endsWith('.png')
          ? 'image/png'
          : 'image/jpeg';

        formData.append(key, {
          uri:
            Platform.OS === 'ios'
              ? imageUri.replace('file://', '')
              : imageUri,
          type: fileType,
          name: fileName,
        } as any);
      };

      // =========================
      // COMMON IMAGES
      // =========================

      appendImage(
        'ChamberCCInsideImage1',
        params?.chamberCCInsideImage1,
      );

      appendImage(
        'ChamberCCInsideImage2',
        params?.chamberCCInsideImage2,
      );

      appendImage(
        'ChamberCCOutsideImage1',
        params?.chamberCCOutsideImage1,
      );

      appendImage(
        'ChamberCCOutsideImage2',
        params?.chamberCCOutsideImage2,
      );

      appendImage(
        'SimplexImage1',
        params?.simplexImage1,
      );

      appendImage(
        'SimplexImage2',
        params?.simplexImage2,
      );

      appendImage(
        'CableTieImage1',
        params?.cableTieImage1,
      );

      appendImage(
        'CableTieImage2',
        params?.cableTieImage2,
      );

      // =========================
      // JC / LOOP IMAGES (Only One)
      // =========================

      if (hasLoop) {
        appendImage(
          'LoopImage1',
          params?.loopImage1,
        );

        appendImage(
          'LoopImage2',
          params?.loopImage2,
        );
      } else if (hasJc) {
        appendImage(
          'JcImage1',
          params?.jcImage1,
        );

        appendImage(
          'JcImage2',
          params?.jcImage2,
        );
      }
      console.log('HOTO FORM DATA READY',{formData});
      console.log(formData);
      const res = await APIs.postRequestWithFormData({
        path: URLs.insertUpdateHotoMaster,
        body: formData,
        isAuth: true,
        timeout: 120000,
      });
      console.log('HOTO RESPONSE =>', res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? {};
      }
      return thunkAPI.rejectWithValue(
        res?.message ?? 'API Failed',
      );
    } catch (error: any) {
      console.log('HOTO ERROR =>', error);

      return thunkAPI.rejectWithValue(
        error?.response?.data?.message ||
        error?.message ||
        'Something went wrong',
      );
    }
  },
);
export const getProjectDuctColorDDAPI = createAsyncThunk(
  `${DSS}/getProjectDuctColorDD`,
  async (payload: any, thunkAPI) => {
    try {
      const projectId = payload?.RoadProjectIds;

      const res = await APIs.getRequestWithQuery({
        path: `${URLs.getProjectDuctNumber}?RoadProjectIds=${projectId}`,
        isAuth: true,
      });

      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];
      }

      return thunkAPI.rejectWithValue(
        res?.message ?? 'API Failed',
      );
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong',
      );
    }
  },
);
export const insertUpdatePitLocationV2 = createAsyncThunk(
  `${DSS}/insertUpdatePitLocationV2`,
  async (
    payload: InsertUpdatePitLocationPayload,
    thunkAPI,
  ) => {
    console.log(
      'insertUpdatePitLocationV2 Payload =>',
      payload,
    );

    try {
      const formData = new FormData();

      // =========================
      // NORMAL FIELDS
      // =========================

      formData.append(
        'Id',
        String(payload?.id ?? 0),
      );

      formData.append(
        'ProjectID',
        String(payload?.projectID ?? 0),
      );

      formData.append(
        'VendorId',
        String(payload?.vendorId ?? 0),
      );

      formData.append(
        'EmployeeID',
        String(payload?.employeeID ?? 0),
      );

      formData.append(
        'PitNo',
        String(payload?.pitNo ?? 0),
      );

      formData.append(
        'NextPitId',
        String(payload?.nextPitId ?? 0),
      );

      formData.append(
        'NextPitDistance',
        String(payload?.nextPitDistance ?? 0),
      );

      formData.append(
        'Distance',
        String(payload?.distance ?? 0),
      );

      formData.append(
        'PitGPSLocation',
        String(payload?.pitGPSLocation ?? ''),
      );

      formData.append(
        'Lat',
        String(payload?.lat ?? ''),
      );

      formData.append(
        'Lng',
        String(payload?.lng ?? ''),
      );

      formData.append(
        'PitLandmark',
        String(payload?.pitLandmark ?? ''),
      );

      // =========================
      // IMAGE 1
      // =========================

      if (payload?.pic1) {
        const imageUri =
          payload?.pic1?.path ||
          payload?.pic1?.uri ||
          payload?.pic1?.imagePath;

        if (imageUri) {
          const fileName =
            imageUri.split('/').pop() ||
            `pit_pic1_${Date.now()}.jpg`;

          const fileType =
            fileName.endsWith('.png')
              ? 'image/png'
              : 'image/jpeg';

          formData.append('Pic1', {
            uri:
              Platform.OS === 'ios'
                ? imageUri.replace('file://', '')
                : imageUri,
            type: fileType,
            name: fileName,
          } as any);
        }
      }
      // =========================
      // IMAGE 2
      // =========================
      if (payload?.pic2) {
        const imageUri =
          payload?.pic2?.path ||
          payload?.pic2?.uri ||
          payload?.pic2?.imagePath;

        if (imageUri) {
          const fileName =
            imageUri.split('/').pop() ||
            `pit_pic2_${Date.now()}.jpg`;

          const fileType =
            fileName.endsWith('.png')
              ? 'image/png'
              : 'image/jpeg';

          formData.append('Pic2', {
            uri:
              Platform.OS === 'ios'
                ? imageUri.replace('file://', '')
                : imageUri,
            type: fileType,
            name: fileName,
          } as any);
        }
      }

      console.log(
        'PIT LOCATION FORM DATA READY',
      );

      const res = await APIs.postRequestWithFormData({
        path: URLs.insertupdatePitLocationMaster,
        body: formData,
        isAuth: true,
        timeout: 120000,
      });

      console.log(
        'insertUpdatePitLocationV2 Response =>',
        res,
      );

      if (res?.status === 200 && res?.success) {
        return res?.data ?? {};
      }

      return thunkAPI.rejectWithValue(
        res?.message ?? 'API Failed',
      );
    } catch (error: any) {
      console.log(
        'InsertUpdatePitLocationV2 Error =>',
        error?.response || error,
      );

      return thunkAPI.rejectWithValue(
        error?.response?.data?.message ||
        error?.message ||
        'Something went wrong',
      );
    }
  },
);
export const getItemTypeByProjectVendorAPI = createAsyncThunk(
  `${DSS}/getItemTypeByProjectVendor`,
  async (params: any, thunkAPI) => {
    try {
      const apiUrl =
        `${URLs.ductSizeDD}` +
        `?itemId=${params?.itemId ?? 0}` +
        `&projectId=${params?.projectId ?? 0}` +
        `&vendorId=${params?.vendorId ?? 0}` +
        `&vendorStoreId=${params?.vendorStoreId ?? 0}`;
      console.log('Item Type API URL =>', apiUrl);
      const res = await APIs.getRequestWithQuery({
        path: apiUrl,
        isAuth: true,
      });
      console.log('Item Type API RESPONSE =>', res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong'
      );
    }
  },
);
//_insertUpdateChamberInstallation_
export const insertUpdateChamberInstallationAPI = createAsyncThunk(
  `${DSS}/insertUpdateChamberInstallation`,
  async (params: any, thunkAPI) => {
    try {
      console.log('insertUpdateChamberInstallationAPI');
      const formData = new FormData();
      // =========================
      // NORMAL FIELDS
      // =========================
      formData.append('Id', String(params?.id ?? 0));
      formData.append(
        'ProjectId',
        String(params?.projectId ?? 0),
      );
      formData.append('ShotId', String(params?.shotId ?? 0));
      formData.append(
        'VendorId',
        String(params?.vendorId ?? 0),
      );
      formData.append(
        'VendorStoreId',
        String(params?.vendorStoreId ?? 0),
      );

      formData.append('ItemId', String(params?.itemId ?? 0));

      formData.append(
        'ExistingPitId',
        String(params?.existingPitId ?? 0),
      );
      formData.append(
        'ItemTypeId',
        String(params?.itemTypeId ?? 0),
      );

      formData.append(
        'GPSLocation',
        String(params?.gpsLocation ?? ''),
      );

      formData.append(
        'Landmark',
        String(params?.landmark ?? ''),
      );

      formData.append('Lat', String(params?.lat ?? ''));

      formData.append('Lon', String(params?.lon ?? ''));

      formData.append(
        'DuctStand',
        String(params?.ductStand ?? 'Yes'),
      );

      formData.append(
        'PCCDone',
        String(params?.pccDone ?? 'Yes'),
      );

      formData.append(
        'PitLocationId',
        String(params?.pitLocationId ?? 0),
      );

      formData.append(
        'Remark',
        String(params?.remark ?? ''),
      );

      // =========================
      // INSIDE IMAGE
      // =========================

      if (params?.insidePic) {
        const imageUri =
          params?.insidePic?.path ||
          params?.insidePic?.uri ||
          params?.insidePic?.imagePath;

        if (imageUri) {
          const fileName =
            imageUri.split('/').pop() ||
            `inside_${Date.now()}.jpg`;

          const fileType =
            fileName.endsWith('.png')
              ? 'image/png'
              : 'image/jpeg';

          formData.append('InsidePic', {
            uri:
              Platform.OS === 'ios'
                ? imageUri.replace('file://', '')
                : imageUri,
            type: fileType,
            name: fileName,
          } as any);
        }
      }

      // =========================
      // OUTSIDE IMAGE
      // =========================

      if (params?.outsidePic) {
        const imageUri =
          params?.outsidePic?.path ||
          params?.outsidePic?.uri ||
          params?.outsidePic?.imagePath;

        if (imageUri) {
          const fileName =
            imageUri.split('/').pop() ||
            `outside_${Date.now()}.jpg`;

          const fileType =
            fileName.endsWith('.png')
              ? 'image/png'
              : 'image/jpeg';

          formData.append('OutsidePic', {
            uri:
              Platform.OS === 'ios'
                ? imageUri.replace('file://', '')
                : imageUri,
            type: fileType,
            name: fileName,
          } as any);
        }
      }
      console.log(
        'CHAMBER INSTALL FORM DATA => ',
        JSON.stringify(formData, null, 2),
      );
      const res = await APIs.postRequestWithFormData({
        path: URLs.insertUpdateChamberInstallation,
        body: formData,
        isAuth: true,
        timeout: 120000,
        onUploadProgress: progressEvent => {
          const percent = Math.round(
            (progressEvent.loaded * 100) /
            (progressEvent.total || 1),
          );
        },
      });
      console.log('CHAMBER INSTALL RESPONSE =>', res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? {};
      }

      return thunkAPI.rejectWithValue(
        res?.message ?? 'API Failed',
      );
    } catch (error: any) {
      console.log(
        'CHAMBER INSTALL API ERROR =>',
        error,
      );

      return thunkAPI.rejectWithValue(
        error?.response?.data?.message ||
        error?.message ||
        'Something went wrong',
      );
    }
  },
);
export const getItemMasterTypeAPi = createAsyncThunk(
  `${DSS}/getItemTypeDD`,
  async (params: any, thunkAPI) => {
    try {
      const apiUrl = `${URLs.getMasterItemType}`
      const res = await APIs.getRequestWithQuery({
        path: apiUrl,
        isAuth: true
      });
      console.log('item Type APIs Response==>', res)
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong'
      )
    }
  }
)
export const getColorSpecificationDDAPI = createAsyncThunk(
  `${DSS}/getColorSpecificationDD`,
  async (params: any, thunkAPI) => {
    try {
      const apiUrl =
        `${URLs.colorSpecificationDD}` +
        `?itemId=${params?.itemId ?? 0}` +
        `&projectId=0` +
        `&vendorId=${params?.vendorId ?? 0}` +
        `&itemIdInt=${params?.itemIdInt ?? 2}` +
        `&itemType=${params?.itemType ?? 2}` +
        `&vendorStoreId=${params?.vendorStoreId ?? 0}`;
      console.log('Color Specification API URL =>', apiUrl);
      const res = await APIs.getRequestWithQuery({
        path: apiUrl,
        isAuth: true,
      });
      console.log('Color Specification API RESPONSE =>', res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong'
      );
    }
  },
);
export const insertUpdateStockReceiveAPI = createAsyncThunk(
  `${DSS}/InsertUpdateStockReceive`,
  async (params: any, thunkAPI) => {
    try {
      const res = await APIs.postRequestWithJsonWithBody({
        path: URLs.insertUpdateStockReceive, // 👈 URL add karna
        body: {
          receivedItemList: params?.receivedItemList ?? [],
        },
        isAuth: true,
      });

      console.log('STOCK RECEIVE RESPONSE =>', res);

      if (res?.status === 200 && res?.success) {
        return res?.data ?? {};
      }

      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong',
      );
    }
  },
);

export const getVendorSpecificationDDAPI = createAsyncThunk(
  `${DSS}/Stock/GetVendorStoreItemSpecificationDD`,
  async (params: any, thunkAPI) => {
    try {
      const apiUrl =
        `${URLs.getVendorStoreItemSpecificationDD}` +
        `?itemId=${params?.itemId ?? 0}` +
        `&itemIdInt=${params?.itemIdInt ?? 2}` +
        `&itemType=${params?.itemType ?? 2}` +
        `&vendorStoreId=${params?.vendorStoreId ?? 0}`;
      console.log('Color Specification API URL =>', apiUrl);
      const res = await APIs.getRequestWithQuery({
        path: apiUrl,
        isAuth: true,
      });
      console.log('Color Specification API RESPONSE =>', res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];
      }
      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong'
      );
    }
  },
);
/* ===============================
   GET PROJECT DUCT COUNT API
================================ */
export const getProjectIDuctCountAPI = createAsyncThunk(
  `${DSS}/getProjectIDuctCount`,
  async (params: { projectId: number }, thunkAPI) => {
    try {

      const apiUrl = `${URLs.GetProjectIDuctCount}?id=${params.projectId}`;

      console.log('DUCT COUNT API URL =>', apiUrl);

      const res = await APIs.getRequestWithQuery({
        path: apiUrl,
        isAuth: true,
      });

      console.log('DUCT COUNT API RESPONSE =>', res);

      if (res?.status === 200 && res?.success) {
        return res?.data ?? {};
      }

      return thunkAPI.rejectWithValue(res?.message ?? 'API Failed');

    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Something went wrong'
      );
    }
  },
);
/* ===============================
   STATE TYPE
================================ */
interface DssState {
  projectListLoading: DataType.LoadingType;
  projectListData: any[];
  vendorListLoading: DataType.LoadingType;

  vendorListData: any[];

  machineListLoading: DataType.LoadingType;
  machineListData: any[];

  vendorLocatorListLoading: DataType.LoadingType;
  vendorLocatorListData: any[];
  hotoCheckListInsertLoading: DataType.LoadingType;
  hotoCheckListInsertSuccess: boolean;
  hotoCheckListInsertData: any;
  shotTypeListLoading: DataType.LoadingType;
  shotTypeListData: any[];


  vendorStoreListLoading: DataType.LoadingType;
  vendorStoreListData: any[];

  hotoPitListLoading: DataType.LoadingType;
  hotoPitListData: any[];

  hotoCheckListByIdLoading: DataType.LoadingType;
  hotoCheckListByIdData: any;


  stockReceiveLoading: DataType.LoadingType;
  stockReceiveSuccess: boolean;

  stockRequestListLoading: DataType.LoadingType;
  stockRequestListData: any[];

  stockRequestByIdLoading: DataType.LoadingType;
  stockRequestByIdData: any;

  sldReportLoading: DataType.LoadingType;
  sldReportData: any[];

  projectDuctColorLoading: DataType.LoadingType;
  projectDuctColorData: any[];

  openShotId: number | null;   // ✅ ADD THIS

  nearestPitLoading: DataType.LoadingType;
  nearestPitData: any;
  //
  chamberInsertLoading: DataType.LoadingType;
  chamberInsertSuccess: boolean;
  //
  pitListWithChamberStatusLoading: DataType.LoadingType;
  pitListWithChamberStatusData: any[];

  openShotDetailsLoading: DataType.LoadingType;
  openShotDetailsData: any;
  shotToInsertLoading: DataType.LoadingType;
  shotToInsertSuccess: boolean;

  ductCountLoading: DataType.LoadingType;
  ductCountData: any;

  colorSpecificationLoading: DataType.LoadingType;
  colorSpecificationData: any[];

  shotInsertLoading: DataType.LoadingType;
  shotInsertSuccess: boolean;

  pitListLoading: DataType.LoadingType;
  pitListData: any[];
  pitListPath: string | null;   // ADD THIS LINE


  addCutDropdownLoading: DataType.LoadingType;
  addCutDropdownData: any[];

  pitInsertLoading: DataType.LoadingType;
  pitInsertSuccess: boolean;

  cutVendorsLoading: DataType.LoadingType;
  cutVendorsData: any[];

  error: string | null;
}

/* ===============================
   INITIAL STATE
================================ */
const initialState: DssState = dssAdapter.getInitialState({
  projectListLoading: 'idel',
  projectListData: [],
  pitListLoading: 'idel',
  pitListData: [],
  vendorListLoading: 'idel',
  vendorListData: [],
  vendorLocatorListLoading: 'idel',   // ✅ ADD
  vendorLocatorListData: [],          // ✅ ADD
  machineListLoading: 'idel',   // ✅ ADD
  machineListData: [],          // ✅ ADD
  shotTypeListLoading: 'idel',   // ✅ ADD
  shotTypeListData: [],          // ✅ ADD
  vendorStoreListLoading: 'idel',   // ✅ ADD
  vendorStoreListData: [],          // ✅ ADD
  openShotDetailsLoading: 'idel',   // ✅ NEW
  openShotDetailsData: {},          // ✅ NEW
  cutVendorsLoading: 'idel',
  cutVendorsData: [],

  pitListPath: null,   // ADD THIS LINE


  hotoPitListLoading: 'idel',
  hotoPitListData: [],
  addCutDropdownLoading: 'idel',
  addCutDropdownData: [],
  hotoCheckListInsertLoading: 'idel',
  hotoCheckListInsertSuccess: false,
  hotoCheckListInsertData: {},

  sldReportLoading: 'idel',
  sldReportData: [],
  stockReceiveLoading: 'idel',
  stockReceiveSuccess: false,
  stockRequestByIdLoading: 'idel',
  stockRequestByIdData: {},

  stockRequestListLoading: 'idel',
  stockRequestListData: [],

  nearestPitLoading: 'idel',
  nearestPitData: {},

  projectDuctColorLoading: 'idel',
  projectDuctColorData: [],

  chamberInsertLoading: 'idel',
  chamberInsertSuccess: false,

  pitListWithChamberStatusLoading: 'idel',
  pitListWithChamberStatusData: [],

  hotoCheckListByIdLoading: 'idel',
  hotoCheckListByIdData: {},

  openShotId: null,
  shotToInsertLoading: 'idel',
  shotToInsertSuccess: false,
  ductCountLoading: 'idel',
  ductCountData: {},
  colorSpecificationLoading: 'idel',
  colorSpecificationData: [],
  shotInsertLoading: 'idel',
  shotInsertSuccess: false,
  pitInsertLoading: 'idel',
  pitInsertSuccess: false,
  error: null,
});

/* ===============================
   SLICE
================================ */
const dssSlice = createSlice({
  name: DSS,
  initialState,
  reducers: {
    clearProjectListData: state => {
      state.projectListData = [];
    },
    clearPitListData: state => {
      state.pitListData = [];
    },
    clearHotoPitListData: state => {
      state.hotoPitListData = [];
    },
    resetPitInsertState: state => {
      state.pitInsertLoading = 'idel';
      state.pitInsertSuccess = false;
    },
  },
  extraReducers: builder => {
    /* ===== Project List ===== */
    builder.addCase(getProjectListOfTypeByNameApi.pending, state => {
      state.projectListLoading = 'pending';
      state.error = null;
    });
    builder.addCase(getProjectListOfTypeByNameApi.fulfilled, (state, action) => {
      state.projectListLoading = 'fulfilled';
      state.projectListData = action.payload;
    });
    builder.addCase(getProjectListOfTypeByNameApi.rejected, (state, action) => {
      state.projectListLoading = 'rejected';
      state.error = action.payload as string;
    });
    builder.addCase(getPitList.pending, state => {
      state.pitListLoading = 'pending';
      state.error = null;
    });
    builder.addCase(getPitList.fulfilled, (state, action) => {
      state.pitListLoading = 'fulfilled';
      state.pitListData = action.payload.data;   // CHANGED
      state.pitListPath = action.payload.path;   // ADD THIS LINE
    });    
    builder.addCase(getPitList.rejected, (state, action) => {
      state.pitListLoading = 'rejected';
      state.error = action.payload as string;
    });
    builder.addCase(insertUpdatePitLocationV2.pending, state => {
      state.pitInsertLoading = 'pending';
      state.pitInsertSuccess = false;
      state.error = null;
    });
    builder.addCase(insertUpdatePitLocationV2.fulfilled, state => {
      state.pitInsertLoading = 'fulfilled';
      state.pitInsertSuccess = true;
    });
    builder.addCase(insertUpdatePitLocationV2.rejected, (state, action) => {
      state.pitInsertLoading = 'rejected';
      state.pitInsertSuccess = false;
      state.error = action.payload as string;
    });
    /* ===== Vendor List For Shot ===== */
    builder.addCase(getVendorListForShot.pending, state => {
      state.vendorListLoading = 'pending';
      state.error = null;
    });
    builder.addCase(getVendorListForShot.fulfilled, (state, action) => {
      state.vendorListData = action.payload;   // 👈 array store
    });
    builder.addCase(getVendorListForShot.rejected, (state, action) => {
      state.vendorListLoading = 'rejected';
      state.error = action.payload as string;
    });
    /* ===== Machine List For Shot ===== */
    builder.addCase(getMachineListForShot.pending, state => {
      state.machineListLoading = 'pending';
      state.error = null;
    });
    builder.addCase(getMachineListForShot.fulfilled, (state, action) => {
      state.machineListLoading = 'fulfilled';
      state.machineListData = action.payload;
    });
    builder.addCase(getMachineListForShot.rejected, (state, action) => {
      state.machineListLoading = 'rejected';
      state.error = action.payload as string;
    });
    /* ===== Vendor Locator List ===== */
    builder.addCase(getVendorLocatorListAPI.pending, state => {
      state.vendorLocatorListLoading = 'pending';
      state.error = null;
    });

    builder.addCase(getVendorLocatorListAPI.fulfilled, (state, action) => {
      state.vendorLocatorListLoading = 'fulfilled';
      state.vendorLocatorListData = action.payload;   // 👈 array store
    });

    builder.addCase(getVendorLocatorListAPI.rejected, (state, action) => {
      state.vendorLocatorListLoading = 'rejected';
      state.error = action.payload as string;
    });
    /* ===== Shot Type List ===== */
    builder.addCase(shotTypeListAPI.pending, state => {
      state.shotTypeListLoading = 'pending';
      state.error = null;
    });
    //
    builder.addCase(shotTypeListAPI.fulfilled, (state, action) => {
      state.shotTypeListLoading = 'fulfilled';
      state.shotTypeListData = action.payload;   // 👈 array store
    });
    //    
    builder.addCase(shotTypeListAPI.rejected, (state, action) => {
      state.shotTypeListLoading = 'rejected';
      state.error = action.payload as string;
    });
    /* ===== Vendor Store List ===== */

    builder.addCase(VendorStoreListAPI.pending, state => {
      state.vendorStoreListLoading = 'pending';
      state.error = null;
    });

    builder.addCase(VendorStoreListAPI.fulfilled, (state, action) => {
      state.vendorStoreListLoading = 'fulfilled';
      state.vendorStoreListData = action.payload;
    });

    builder.addCase(VendorStoreListAPI.rejected, (state, action) => {
      state.vendorStoreListLoading = 'rejected';
      state.error = action.payload as string;
    });
    /* ===== Insert Shot ===== */
    builder.addCase(insertUpdateShotFromAPI.pending, state => {
      state.shotInsertLoading = 'pending';
      state.shotInsertSuccess = false;
      state.error = null;
    });

    builder.addCase(insertUpdateShotFromAPI.fulfilled, state => {
      state.shotInsertLoading = 'fulfilled';
      state.shotInsertSuccess = true;
    });

    builder.addCase(insertUpdateShotFromAPI.rejected, (state, action) => {
      state.shotInsertLoading = 'rejected';
      state.shotInsertSuccess = false;
      state.error = action.payload as string;
    });
    /* ===== Color Specification List ===== */
    builder.addCase(getColorSpecificationDDAPI.pending, state => {
      state.colorSpecificationLoading = 'pending';
      state.error = null;
    });
    builder.addCase(getColorSpecificationDDAPI.fulfilled, (state, action) => {
      state.colorSpecificationLoading = 'fulfilled';
      state.colorSpecificationData = action.payload;
    });
    builder.addCase(getColorSpecificationDDAPI.rejected, (state, action) => {
      state.colorSpecificationLoading = 'rejected';
      state.error = action.payload as string;
    });
    /* ===== Insert Shot To ===== */
    builder.addCase(insertUpdateShotToAPI.pending, state => {
      state.shotToInsertLoading = 'pending';
      state.shotToInsertSuccess = false;
      state.error = null;
    });
    builder.addCase(insertUpdateShotToAPI.fulfilled, state => {
      state.shotToInsertLoading = 'fulfilled';
      state.shotToInsertSuccess = true;
    });
    builder.addCase(insertUpdateShotToAPI.rejected, (state, action) => {
      state.shotToInsertLoading = 'rejected';
      state.shotToInsertSuccess = false;
      state.error = action.payload as string;
    });
    builder.addCase(getOpenShotDetailsByIdAPI.pending, state => {
      state.openShotDetailsLoading = 'pending';
      state.error = null;
    });
    builder.addCase(getOpenShotDetailsByIdAPI.rejected, (state, action) => {
      state.openShotDetailsLoading = 'rejected';
      state.error = action.payload as string;
    });
    builder.addCase(getOpenShotDetailsByIdAPI.fulfilled, (state, action) => {
      state.openShotDetailsLoading = 'fulfilled';
      state.openShotDetailsData = action.payload;
      state.openShotId = action.payload?.id ?? null;
    });
    /* ===== Pit List With Chamber Status ===== */
    builder.addCase(getPitListWithChamberStatus.pending, state => {
      state.pitListWithChamberStatusLoading = 'pending';
      state.error = null;
    });
    builder.addCase(getPitListWithChamberStatus.fulfilled, (state, action) => {
      state.pitListWithChamberStatusLoading = 'fulfilled';
      state.pitListWithChamberStatusData = action.payload;
    });
    builder.addCase(getPitListWithChamberStatus.rejected, (state, action) => {
      state.pitListWithChamberStatusLoading = 'rejected';
      state.error = action.payload as string;
    });
    /* ===== Insert Chamber Installation ===== */
    builder.addCase(insertUpdateChamberInstallationAPI.pending, state => {
      state.chamberInsertLoading = 'pending';
      state.chamberInsertSuccess = false;
      state.error = null;
    });
    builder.addCase(insertUpdateChamberInstallationAPI.fulfilled, state => {
      state.chamberInsertLoading = 'fulfilled';
      state.chamberInsertSuccess = true;
    });
    builder.addCase(insertUpdateChamberInstallationAPI.rejected, (state, action) => {
      state.chamberInsertLoading = 'rejected';
      state.chamberInsertSuccess = false;
      state.error = action.payload as string;
    });
    /* ===== Nearest Pit Lat Lng ===== */
    builder.addCase(getNearestPitLatLng.pending, state => {
      state.nearestPitLoading = 'pending';
      state.error = null;
    });
    builder.addCase(getNearestPitLatLng.fulfilled, (state, action) => {
      state.nearestPitLoading = 'fulfilled';
      state.nearestPitData = action.payload;
    });
    builder.addCase(getNearestPitLatLng.rejected, (state, action) => {
      state.nearestPitLoading = 'rejected';
      state.error = action.payload as string;
    });
    builder.addCase(getSLDEReportAPI.pending, state => {
      state.sldReportLoading = 'pending';
      state.error = null;
    });
    builder.addCase(getSLDEReportAPI.fulfilled, (state, action) => {
      state.sldReportLoading = 'fulfilled';
      state.sldReportData = action.payload;
    });
    builder.addCase(getSLDEReportAPI.rejected, (state, action) => {
      state.sldReportLoading = 'rejected';
      state.error = action.payload as string;
    });

    builder.addCase(getProjectDuctColorDDAPI.pending, state => {
      state.projectDuctColorLoading = 'pending';
      state.error = null;
    });

    builder.addCase(getProjectDuctColorDDAPI.fulfilled, (state, action) => {
      state.projectDuctColorLoading = 'fulfilled';
      state.projectDuctColorData = action.payload;
    });

    builder.addCase(getProjectDuctColorDDAPI.rejected, (state, action) => {
      state.projectDuctColorLoading = 'rejected';
      state.error = action.payload as string;
    });

    builder.addCase(getStockRequestsAPI.pending, state => {
      state.stockRequestListLoading = 'pending';
      state.error = null;
    });

    builder.addCase(getStockRequestsAPI.fulfilled, (state, action) => {
      state.stockRequestListLoading = 'fulfilled';
      state.stockRequestListData = action.payload; // 🔥 main data
    });

    builder.addCase(getStockRequestsAPI.rejected, (state, action) => {
      state.stockRequestListLoading = 'rejected';
      state.error = action.payload as string;
    });
    /* ===== Stock Request By ID ===== */
    builder.addCase(getStockRequestbyIdAPI.pending, state => {
      state.stockRequestByIdLoading = 'pending';
      state.error = null;
    });

    builder.addCase(getStockRequestbyIdAPI.fulfilled, (state, action) => {
      state.stockRequestByIdLoading = 'fulfilled';
      state.stockRequestByIdData = action.payload; // 🔥 main data
    });

    builder.addCase(getStockRequestbyIdAPI.rejected, (state, action) => {
      state.stockRequestByIdLoading = 'rejected';
      state.error = action.payload as string;
    });
    /* ===== Stock Receive ===== */
    builder.addCase(insertUpdateStockReceiveAPI.pending, state => {
      state.stockReceiveLoading = 'pending';
      state.stockReceiveSuccess = false;
      state.error = null;
    });
    builder.addCase(insertUpdateStockReceiveAPI.fulfilled, state => {
      state.stockReceiveLoading = 'fulfilled';
      state.stockReceiveSuccess = true;
    });
    builder.addCase(insertUpdateStockReceiveAPI.rejected, (state, action) => {
      state.stockReceiveLoading = 'rejected';
      state.stockReceiveSuccess = false;
      state.error = action.payload as string;
    });
    /* ===== HOTO Pit List ===== */
    builder.addCase(getPitListWithHotoStatus.pending, state => {
      state.hotoPitListLoading = 'pending';
      state.error = null;
    });
    builder.addCase(
      getPitListWithHotoStatus.fulfilled,
      (state, action) => {
        state.hotoPitListLoading = 'fulfilled';
        state.hotoPitListData = action.payload;
      },
    );
    /* ===== Add Cut Dropdown Master ===== */

    builder.addCase(getAddCutDropdownMasterAPI.pending, state => {
      state.addCutDropdownLoading = 'pending';
      state.error = null;
    });

    builder.addCase(
      getAddCutDropdownMasterAPI.fulfilled,
      (state, action) => {
        state.addCutDropdownLoading = 'fulfilled';
        state.addCutDropdownData = action.payload;
      },
    );

    builder.addCase(
      getAddCutDropdownMasterAPI.rejected,
      (state, action) => {
        state.addCutDropdownLoading = 'rejected';
        state.error = action.payload as string;
      },
    );
    builder.addCase(
      getPitListWithHotoStatus.rejected,
      (state, action) => {
        state.hotoPitListLoading = 'rejected';
        state.error = action.payload as string;
      },
    );
    /* ===== Insert Update HOTO Checklist ===== */
    builder.addCase(insertUpdateHotoCheckListAPI.pending, state => {
      state.hotoCheckListInsertLoading = 'pending';
      state.hotoCheckListInsertSuccess = false;
      state.error = null;
    });
    builder.addCase(
      insertUpdateHotoCheckListAPI.fulfilled,
      (state, action) => {
        state.hotoCheckListInsertLoading = 'fulfilled';
        state.hotoCheckListInsertSuccess = true;
        state.hotoCheckListInsertData = action.payload;
      },
    );

    builder.addCase(
      insertUpdateHotoCheckListAPI.rejected,
      (state, action) => {
        state.hotoCheckListInsertLoading = 'rejected';
        state.hotoCheckListInsertSuccess = false;
        state.error = action.payload as string;
      },
    );

    builder.addCase(getHotoCheckListById.pending, state => {
      state.hotoCheckListByIdLoading = 'pending';
      state.error = null;
    });

    builder.addCase(
      getHotoCheckListById.fulfilled,
      (state, action) => {
        state.hotoCheckListByIdLoading = 'fulfilled';
        state.hotoCheckListByIdData = action.payload;
      },
    );

    builder.addCase(
      getHotoCheckListById.rejected,
      (state, action) => {
        state.hotoCheckListByIdLoading = 'rejected';
        state.error = action.payload as string;
      },
    );
    /* ===== Get Cut Vendors ===== */

    builder.addCase(getCutVendorsAPI.pending, state => {
      state.cutVendorsLoading = 'pending';
      state.error = null;
    });

    builder.addCase(getCutVendorsAPI.fulfilled, (state, action) => {
      state.cutVendorsLoading = 'fulfilled';
      state.cutVendorsData = action.payload;
    });

    builder.addCase(getCutVendorsAPI.rejected, (state, action) => {
      state.cutVendorsLoading = 'rejected';
      state.error = action.payload as string;
    });
  },
});
/* ===============================
   EXPORTS
================================ */
export const dssReducer = dssSlice.reducer;

export const {
  clearProjectListData,
  clearHotoPitListData,
  clearPitListData,
  resetPitInsertState,
} = dssSlice.actions;
