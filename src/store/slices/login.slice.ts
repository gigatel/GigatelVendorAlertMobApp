import { APIs, URLs } from '@apis';
import { navigate, reset } from '@navigation/services';
import { createAsyncThunk, createEntityAdapter, createSlice } from '@reduxjs/toolkit';
import { CONSTANT, STRINGS } from '@res';
import { Common, Preferences, Security } from '@utils';

const LOGIN = 'login';
const otpAdapter = createEntityAdapter();
export const getOtpApi = createAsyncThunk(
  `${LOGIN}/getPublicKey`,
  async (params: any, thunkAPI) => {
    try {
      const { mobileNumber, hashKey } = params;
      console.log('getOtpApi');
      const keyResponse = await APIs.postRequestWithJson({
        path: URLs.getPwdEncription,
        params: { userId: mobileNumber },
        isAuth: false,
      });
      if (keyResponse == null) {
        Common.showToast(STRINGS.server_not_responding);
        thunkAPI.rejectWithValue(STRINGS.server_not_responding);
      } else {
        if (keyResponse?.status === 200 && keyResponse?.success === true) {
          if (keyResponse?.key !== null || keyResponse?.key !== '') {
            Preferences.setData('PUBLIC_KEY', keyResponse?.key);
            const pemKey = await Security.convertKeyToPem(keyResponse?.key);
            Preferences.setData('PEM_KEY', pemKey);
            const encPass = await Security.encrypt(pemKey, CONSTANT.AUTH_PASSWORD_DEFAULT);
            if (!encPass.success) {
              return;
            }
            const otpPrams = {
              userId: mobileNumber + '',
              password: encPass?.data ?? '',
              appType: 'app',
              hashKey: hashKey + '',
            };
            const otpRes = await APIs.postRequestWithJson({
              path: URLs.getOtp,
              params: otpPrams,
              isAuth: false,
            });
            console.log('otpParamsData:', { otpPrams });

            if (otpRes?.status === 200 && otpRes?.message === 'success') {
              navigate('OtpVerification', {
                userId: mobileNumber + '',
                password: encPass?.data ?? '',
                appType: 'app',
              });
            }
          } else {
            thunkAPI.rejectWithValue(keyResponse);
          }
        } else if (keyResponse?.status === 401) {
          Common.showToast(keyResponse?.message);
          thunkAPI.rejectWithValue(keyResponse);
        } else {
          // Common.showToast('Mobile Number Not Registered!');
          Common.showToast(keyResponse?.message);
          thunkAPI.rejectWithValue(keyResponse);
        }
      }
    } catch (error) {
      return thunkAPI.rejectWithValue(error);
    }
  },
);

export const getVendorOtpApi = createAsyncThunk(
  `${LOGIN}/vendorotp`,
  async (params: any, thunkAPI) => {
    try {
      const {mobileNumber,hashKey} = params;
      console.log('getVendorOtpApi');
      const queryParams = `?phoneNumber=${mobileNumber}&hashKey=${hashKey}`;
      const otpRes = await APIs.getRequestWithQuery({
        path: URLs.getVendorOtp,
        params: queryParams,
        isAuth: false,
      });
    console.log(
     'FULL OTP RESPONSE:',
     JSON.stringify(otpRes, null, 2),
    );
    console.log('vendorOtpParams:', queryParams);
    console.log(
        'FULL VENDOR OTP RESPONSE:',
        JSON.stringify(otpRes, null, 2),
    );
      if (otpRes?.status === 200 && otpRes?.success === true) {
        // ─────────────────────────────────────────────
        // SAVE ENCRYPTION KEY
        // ─────────────────────────────────────────────
const encryptionKey =
  typeof otpRes?.data === 'string'
    ? otpRes.data
    : otpRes?.data?.encryptionKey ||
      otpRes?.encryptionKey ||
      otpRes?.data?.EncryptionKey ||
      otpRes?.EncryptionKey ||
      '';

        console.log(
          'VENDOR ENCRYPTION KEY:',
          encryptionKey,
        );

        if (
          encryptionKey &&
          encryptionKey !== 'undefined' &&
          encryptionKey !== 'null'
        ) {
          await Preferences.setData(
            'ENCRYPTION_KEY',
            encryptionKey,
          );

          console.log(
            'ENCRYPTION_KEY SAVED SUCCESSFULLY',
          );
        } else {
          console.warn(
            'ENCRYPTION_KEY NOT FOUND IN RESPONSE',
          );
        }
        // ─────────────────────────────────────────────
        // SAVE USER TYPE
        // ─────────────────────────────────────────────
        await Preferences.setData(
          'USER_TYPE',
          'vendor',
        );
        console.log('USER_TYPE SAVED: vendor');
        // ─────────────────────────────────────────────
        // SMALL DELAY FOR ASYNC STORAGE
        // ─────────────────────────────────────────────
        setTimeout(() => {
          navigate('OtpVerification', {
            userId: mobileNumber + '',
            appType: 'App',
          });
        }, 500);

        return otpRes;
      } else if (otpRes?.status === 401) {
        Common.showToast(otpRes?.message);
        return thunkAPI.rejectWithValue(otpRes);
      } else {
        Common.showToast(otpRes?.message);
        return thunkAPI.rejectWithValue(otpRes);
      }
    } catch (error) {
      console.log(
        'getVendorOtpApi ERROR:',
        error,
      );

      return thunkAPI.rejectWithValue(error);
    }
  },
);



//! Verify OTP API
export const verifyOtpApi = createAsyncThunk(
  `${LOGIN}/verifyOtpApi`,
  async (params: any, thunkAPI) => {
    try {
      const encOtp = await Security.encrypt(
        Preferences.getData('PEM_KEY'),
        params.otp,
      );
      const loginRes = await APIs.postRequestWithJson({
        path: URLs.verifyOtp,
        params: {
          ...params,
          otp: encOtp.data,
        },
        isAuth: false,
      });
      if (loginRes?.status === 200 && loginRes?.success) {
        Preferences.setData('API_AUTH_TOKEN', loginRes?.token ?? '');
        Preferences.setData('LOGIN_RESPONSE', loginRes?.loginUserInfo);
        // Preferences.setData('LOGIN_POLICIES', loginRes.loginUserInfo.policies);
        thunkAPI.dispatch(selectCompanyApi({
          selectedCompanyId: loginRes?.loginUserInfo?.companyId,
        }));
      } else
        if (loginRes?.status === 401) {
          Common.showToast(loginRes.message);
          thunkAPI.rejectWithValue(loginRes);
        } else {

        }
    } catch (error) {
      thunkAPI.rejectWithValue(error);
    }

  }
);
//! VerifyVendor Login
//! VerifyVendor Login
export const verifyVendorOtpApi = createAsyncThunk(
  `${LOGIN}/verifyVendorOtpApi`,
  async (params: any, thunkAPI) => {
    try {
      console.log('VERIFY API PARAMS::', params);

      const loginRes = await APIs.postRequestWithJson({
        path: URLs.verifyVendorOtp,
        params: {
          ...params,
          otp: params.otp,
        },
        isAuth: false,
      });

      console.log(
        'VERIFY VENDOR OTP RESPONSE ====',
        JSON.stringify(loginRes, null, 2),
      );

      if (loginRes?.status === 200 && loginRes?.success) {
        // Token
        Preferences.setData(
          'API_AUTH_TOKEN',
          loginRes?.token ?? '',
        );
        // Complete Login Response
        Preferences.setData(
          'LOGIN_RESPONSE',
          loginRes?.loginUserInfo,
        );

        // User Details
        Preferences.setData(
          'USER_ID',
          loginRes?.loginUserInfo?.userId ?? 0,
        );

        Preferences.setData(
          'EMPLOYEE_ID',
          loginRes?.loginUserInfo?.employeeId ?? 0,
        );

        Preferences.setData(
          'COMPANY_ID',
          loginRes?.loginUserInfo?.companyId ?? 0,
        );

        Preferences.setData(
          'VENDOR_ID',
          loginRes?.loginUserInfo?.vendorId ?? 0,
        );

        // Save Role
        Preferences.setData(
          'USER_ROLE',
          loginRes?.loginUserInfo?.role ?? '',
        );

        // Save Designation
        Preferences.setData(
          'DESIGNATION_NAME',
          loginRes?.loginUserInfo?.designaionName ?? '',
        );


        console.log(
          'USER_ROLE ====',
          loginRes?.loginUserInfo?.role,
        );

        console.log(
          'USER_ID ====',
          loginRes?.loginUserInfo?.userId,
        );

        console.log(
          'COMPANY_ID ====',
          loginRes?.loginUserInfo?.companyId,
        );

        console.log(
          'POLICIES ====',
          loginRes?.loginUserInfo?.policies,
        );

        thunkAPI.dispatch(
          selectCompanyApi({
            selectedCompanyId:
              loginRes?.loginUserInfo?.companyId,
          }),
        );

        return loginRes;
      } else if (loginRes?.status === 401) {
        Common.showToast(
          loginRes?.message ?? 'Invalid OTP',
        );

        return thunkAPI.rejectWithValue(loginRes);
      } else {
        return thunkAPI.rejectWithValue(loginRes);
      }
    } catch (error) {
      console.log(
        'VERIFY OTP API ERROR::',
        error,
      );

      return thunkAPI.rejectWithValue(error);
    }
  },
);

//! Select Comapny API
export const selectCompanyApi = createAsyncThunk(
  `${LOGIN}/selectCompanyApi`,
  async (params: any, thunkAPI) => {
    try {
      const selectRes = await APIs.postRequestWithJson({
        path: URLs.selectCompany,
        params,
        isAuth: true,
      });
      if (selectRes?.status === 200 && selectRes?.success) {
        Preferences.setData('API_AUTH_TOKEN', selectRes?.data ?? '');
        // Preferences.setData('LOGIN_POLICIES', selectRes.policies);
        Common.showToast('Login Successfully');
        reset('BottomTab');
      } else
        if (selectRes?.status === 401) {
          Common.showToast(selectRes.message);
          thunkAPI.rejectWithValue(selectRes);
        } else {

        }
    } catch (error) {
      thunkAPI.rejectWithValue(error);
    }

  }
);

const intialState = otpAdapter.getInitialState({
  loading: 'idel',
  error: null,
  data: null,
  loginData: null,
});

const loginSlice = createSlice({
  name: LOGIN,
  initialState: intialState,
  reducers: {},
  extraReducers: builder => {
    //! Get OTP
    builder.addCase(getOtpApi.pending, (state,) => {
      state.loading = 'pending';
    });
    builder.addCase(getOtpApi.fulfilled, (state, action) => {
      state.loading = 'fulfilled';
      state.data = action.payload ?? null;
    });
    builder.addCase(getOtpApi.rejected, (state,) => {
      state.loading = 'rejected';
    });
    //! Verify OTP | Login
    builder.addCase(verifyOtpApi.pending, (state,) => {
      state.loading = 'pending';
    });
    builder.addCase(verifyOtpApi.fulfilled, (state, action) => {
      state.loading = 'fulfilled';
      state.loginData = action.payload ?? null;
    });
    builder.addCase(verifyOtpApi.rejected, (state,) => {
      state.loading = 'rejected';
    });

  },
});


export const loginReducer = loginSlice.reducer;
