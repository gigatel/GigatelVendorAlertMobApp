import { APIs, URLs } from '@apis';
import { createAsyncThunk, createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { DataType } from '@types';
import { Common, Preferences } from '@utils';
import { Platform } from 'react-native';
import { BASE_URL } from 'src/apis/urls';

const DASHBOARD = 'dashboard';
const dashboardAdapter = createEntityAdapter();
export const getProjectServiceKeyApi = createAsyncThunk(
  `${DASHBOARD}/getProjectServiceKeyApi`,
  async (
    {
      projectId,
      serviceProviderCode = 'OLA_MAP',
      pageUrl = '',
    }: {
      projectId: number;
      serviceProviderCode?: string;
      pageUrl?: string;
    },
    thunkAPI,
  ) => {
    try {
      const res = await APIs.getRequestWithQuery({
        path: `${URLs.getProjectServiceKeyAPI}?ProjectId=${projectId}&ServiceProviderCode=${encodeURIComponent(serviceProviderCode)}&PageUrl=${encodeURIComponent(pageUrl)}`,
        isAuth: true,
      });

      if (res?.status === 200 && res?.success) {
        return res;
      }
      return thunkAPI.rejectWithValue(res);
    } catch (error) {
      return thunkAPI.rejectWithValue(error);
    }
  },
);

export const dashboardListApi = createAsyncThunk(
  `${DASHBOARD}/dashboardListApi`,
  async ({ isRefresh }: any, thunkAPI) => {
    try {
      const offRes = Preferences.getData('OFFLINE_DASHBOARD_LIST');
      const now = Date.now();
      const isValidCache =  
        offRes &&
        typeof offRes === 'object' &&
        offRes?.lastCalled &&
        now - offRes?.lastCalled < offRes?.interval;
      if (isValidCache && !isRefresh) {
        return offRes?.res;
      }
      const res = await APIs.postRequestWithJson({
        path: `${URLs.DashboardList}?platformType=${Platform.OS}`,
        params: {},
        isAuth: true,
      });
      console.log('dashboardListApi', res);
     if (res?.status === 200 && res?.success) {
        if (res.isLogoutRequired) {
          APIs.logout();
          return undefined;
      }
      Preferences.setData('OFFLINE_DASHBOARD_LIST', {
          res,
          interval: 8 * 60 * 60 * 1000,
          lastCalled: now,
        }); 
         return res;
      } else {
        return thunkAPI.rejectWithValue(res);
      }
      } catch (error) {
      return thunkAPI.rejectWithValue(error);
    }
  },
);
export const updateEmployeePhotoApi = createAsyncThunk(
  `${DASHBOARD}/updateEmployeePhotoApi`,
  async (
    {
      employeePhoto,
      employeePhotoName,
    }: {
      employeePhoto: any;
      employeePhotoName: string;
    },
    thunkAPI,
  ) => {
    try {
      const employeeId = await Preferences.getData('EMPLOYEE_ID');

      if (!employeeId) {
        return thunkAPI.rejectWithValue({ 
          message: 'Employee ID not found. Please re-login.',
        });
      }

      const formData = new FormData();
      formData.append('EmployeeId', employeeId);
      formData.append('EmployeePhoto', employeePhoto);
      formData.append('EmployeePhotoName', employeePhotoName);

      const res = await APIs.postRequestWithFormData({
        path: URLs.UpdateProfileImage,
        params: formData,
        isAuth: true,
      });

      console.log('updateEmployeePhotoApi ===>', res);
      if (res?.status === 200 && res?.success) {
        return res;
      }
      return thunkAPI.rejectWithValue(res);
    } catch (error) {
      console.log('updateEmployeePhotoApi ERROR ===>', error);
      return thunkAPI.rejectWithValue(error);
    }
  },
);

export const updateEmployeeGpsAddressApi = createAsyncThunk(
  `${DASHBOARD}/updateEmployeeGpsAddressApi`,
  async (
    {
      gpsAddress,
    }: {
      gpsAddress: string;
    },
    thunkAPI,
  ) => {
    try {
      const employeeId = await Preferences.getData('EMPLOYEE_ID');

      if (!employeeId) {
        return thunkAPI.rejectWithValue({
          message: 'Employee ID not found. Please re-login.',
        });
      }

      const params = {
        employeeId,
        gpsAddress,
      };

      const res = await APIs.postRequestWithJson({
        path: URLs.upadteGpsAddress,
        params,
        isAuth: true,
      });

      console.log('updateEmployeeGpsAddressApi ===>', res);
      if (res?.status === 200 && res?.success) {
        return res;
      }
      return thunkAPI.rejectWithValue(res);
    } catch (error) {
      console.log('updateEmployeeGpsAddressApi ERROR ===>', error);
      return thunkAPI.rejectWithValue(error);
    }
  },
);

export const getNearestChamberLatLongApi = createAsyncThunk(
  `${DASHBOARD}/getNearestChamberLatLongApi`,
  async (
    params: {
      lat: number;
      lng: number;
      rangeInMeters?: number;
    },
    thunkAPI,
  ) => {
    try {
      const rangeInMeters = params.rangeInMeters ?? 200;
      const res = await APIs.getRequestWithQuery({
        path: `${URLs.getNearestChamberByLatLong}?lat=${params.lat}&lng=${params.lng}&rangeInMeters=${rangeInMeters}`,
        isAuth: true,
      });

      console.log('getNearestChamberLatLongApi ===>', res);
      if (res?.status === 200 && res?.success) {
        return res?.data ?? [];
      }
      return thunkAPI.rejectWithValue(
        res?.message ?? 'Unable to fetch nearest chamber',
      );
    } catch (error: any) {
      console.log('getNearestChamberLatLongApi ERROR ===>', error);
      return thunkAPI.rejectWithValue(
        error?.message ?? 'Unable to fetch nearest chamber',
      );
    }
  },
);

export const addUserDeviceDetailsApi = createAsyncThunk(
  `${DASHBOARD}/addUserDeviceDetailsApi`,
  async (params: any, thunkAPI) => {
    try {
      const res = await APIs.postRequestWithJson({
        path: `${URLs.addDeviceListDetails}`,
        params,
        isAuth: true,
      });
      console.log('addUserDeviceDetailsApi ===>', res)
      if (res?.status === 200 || res?.success) {
        return res;
      }
      return thunkAPI.rejectWithValue(res);
    } catch (error) {
      return thunkAPI.rejectWithValue(error);
    }
  },
);
export const getUserModulePolicyMappingApi = createAsyncThunk(
  `${DASHBOARD}/getUserModulePolicyMappingApi`,
  async ({ userId, companyId }: any, thunkAPI) => {
    try {
      const url =
        `${URLs.VendorModulesAccess}?userId=${userId}&companyId=${companyId}`;

      console.log('VendorModulesAccess ===>', URLs.VendorModulesAccess);
      console.log('FINAL URL ===>', url);

      const res = await APIs.getRequestWithQuery({
        path: url,
        isAuth: true,
      });

      console.log('getUserModulePolicyMappingApi RESPONSE ===>', res);

      if (res?.status === 200 && res?.success) {
        return res;
      }

      return thunkAPI.rejectWithValue(res);
    } catch (error) {
      console.log('getUserModulePolicyMappingApi ERROR ===>', error);
      return thunkAPI.rejectWithValue(error);
    }
  },
);
export const mobileAppVersionVendorList = createAsyncThunk(
  `${DASHBOARD}/versionvendorListApi`,
  async ({ isRefresh }: any, thunkAPI) => {
    try {
const offRes = Preferences.getData('OFFLINE_VENDOR_VERSION');
      const now = Date.now();
      const isValidCache =  
        offRes &&
        typeof offRes === 'object' &&
        offRes?.lastCalled &&
        now - offRes?.lastCalled < offRes?.interval;
      if (isValidCache && !isRefresh) {
        return offRes?.res;
      }
    const res = await APIs.getRequestWithQuery({
      path: `${URLs.getMobileAppVersionForVendor}?platformType=${Platform.OS}`,
      isAuth: true,
    });
      console.log('mobileAppVersionforvendorApi::', res);
     if (res?.status === 200 && res?.success) {
        if (res.isLogoutRequired) {
          APIs.logout();
          return undefined;
        }
      Preferences.setData('OFFLINE_VENDOR_VERSION', {
          res,
          interval: 8 * 60 * 60 * 1000,
          lastCalled: now,
        }); 
         return res;
      } else {
        return thunkAPI.rejectWithValue(res);
      }
      } catch (error) {
      return thunkAPI.rejectWithValue(error);
    }
  },
);
export const getLoginTokenApi = createAsyncThunk(
  `${DASHBOARD}/getLoginTokenApi`,
  async (_, thunkAPI) => {
    try {
      const isBgAllow = Preferences.getData('ALLOWED_ACCESS_FOR_LOCATION_BACKGROUND') === 'yes';
      const token = Preferences.getData('API_AUTH_TOKEN') ?? null;
      return {
        isBgAllow,
        token,
      };
    } catch (error) {
      return thunkAPI.rejectWithValue(error);
    }
  },
);
interface DashboardStateTypes extends DataType.Loading {
  dashboardList: DataType.DasboardResponse | null,
  loginToken: null
  isBgAllow: boolean
  error: null | string,
  addUserDeviceDetailsResponse: any | null;
  userModulePolicyMapping: any | null;
  vendorProjects: any[];
  mobileAppVersionVendor: any | null;
  updateEmployeePhotoResponse: any | null;
  updateEmployeeGpsAddressResponse: any | null;
  nearestChamberLatLongData: any;
  nearestChamberLatLongLoading: DataType.LoadingType;
}
const intialState: DashboardStateTypes = dashboardAdapter.getInitialState({
  loading: 'idel',
  loginToken: null,
  isBgAllow: false,
  dashboardList: null,
  error: null,
  addUserDeviceDetailsResponse: null,
  userModulePolicyMapping: null,
  vendorProjects: [],
  mobileAppVersionVendor: null,
  updateEmployeePhotoResponse: null,
  updateEmployeeGpsAddressResponse: null,
  nearestChamberLatLongData: [],
  nearestChamberLatLongLoading: 'idel',
});
export const dashboardSlice = createSlice({
  name: DASHBOARD,
  initialState: intialState,
  reducers: {},
  extraReducers: builder => {
    builder.addCase(dashboardListApi.pending, (state,) => {
      state.loading = 'pending';
    });
    builder.addCase(dashboardListApi.fulfilled, (state, action) => {
      state.loading = 'fulfilled';
      state.dashboardList = action.payload ?? null;
      if (state.dashboardList?.projectListAll == null) {
        Common.showToast('No modules found..Please contact admin to get modules access.');
      } else if (state.dashboardList?.projectListAll?.length <= 0) {
        Common.showToast('No modules found..Please contact admin to get modules access.');
      }
    });
    builder.addCase(dashboardListApi.rejected, (state,) => {
      state.loading = 'rejected';
    });
    builder.addCase(getLoginTokenApi.fulfilled, (state, action) => {
      state.loginToken = action.payload.token ?? null;
      state.isBgAllow = action.payload?.isBgAllow ?? false;
    });
    builder.addCase(addUserDeviceDetailsApi.pending, state => {
     state.loading = 'pending';
    });
    builder.addCase(
      addUserDeviceDetailsApi.fulfilled,
      (state, action) => {
        state.loading = 'fulfilled';
        state.addUserDeviceDetailsResponse = action.payload ?? null;
      },
    );
    builder.addCase(addUserDeviceDetailsApi.rejected, state => {
      state.loading = 'rejected';
    });
    builder.addCase(
          getUserModulePolicyMappingApi.fulfilled,
          (state, action) => {
            state.loading = 'fulfilled';
            state.userModulePolicyMapping = action.payload ?? null;
    
            const vendorProjects = action.payload?.data?.[0]?.projects ?? [];
    
            state.vendorProjects = vendorProjects;
    
            console.log(
              'vendorProjects ===>',
              JSON.stringify(vendorProjects, null, 2),
            );
          },
        );
builder.addCase(getUserModulePolicyMappingApi.pending, state => {
    state.loading = 'pending';
      });
builder.addCase(mobileAppVersionVendorList.fulfilled, (state, action) => {
    console.log('VENDOR VERSION FULFILLED ====', action.payload);
    state.mobileAppVersionVendor = action.payload;
  });
builder.addCase(getUserModulePolicyMappingApi.rejected, state => {
    state.loading = 'rejected';
  });
builder.addCase(updateEmployeePhotoApi.pending, state => {
  state.loading = 'pending';
});

builder.addCase(updateEmployeePhotoApi.fulfilled, (state, action) => {
  state.loading = 'fulfilled';
  state.updateEmployeePhotoResponse = action.payload ?? null;
});

builder.addCase(updateEmployeePhotoApi.rejected, state => {
  state.loading = 'rejected';
});
builder.addCase(updateEmployeeGpsAddressApi.pending, state => {
  state.loading = 'pending';
});

builder.addCase(updateEmployeeGpsAddressApi.fulfilled, (state, action) => {
  state.loading = 'fulfilled';
  state.updateEmployeeGpsAddressResponse = action.payload ?? null;
});

builder.addCase(updateEmployeeGpsAddressApi.rejected, state => {
  state.loading = 'rejected';
});
builder.addCase(getNearestChamberLatLongApi.pending, state => {
  state.nearestChamberLatLongLoading = 'pending';
});

builder.addCase(getNearestChamberLatLongApi.fulfilled, (state, action) => {
  state.nearestChamberLatLongLoading = 'fulfilled';
  state.nearestChamberLatLongData = action.payload ?? [];
});

builder.addCase(getNearestChamberLatLongApi.rejected, state => {
  state.nearestChamberLatLongLoading = 'rejected';
  state.nearestChamberLatLongData = [];
});
},
});

export const dashboardReducer = dashboardSlice.reducer;
