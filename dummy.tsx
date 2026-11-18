//LoginScreen
import {Buttons, InputField} from '@atoms';
import {Screen} from '@organisms';
import {RootState, StoreDispatch} from '@reducers';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {getOtpApi, getVendorOtpApi} from '@slices/login.slice';
import {ScreenProps} from '@types';
import {Common, Location, Preferences} from '@utils';
import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Keyboard, Platform, StyleSheet, Image, Text, View} from 'react-native';
import * as Animatable from 'react-native-animatable';
import OTPVerify from 'react-native-otp-verify';
import {connect, useDispatch} from 'react-redux';
import {FontFamily, Padding, Border, FontSize} from '../../res/globalStyle';
const Login: React.FC<ScreenProps.Login> = ({loading}) => {
  const {t} = useTranslation();
  const [mobileNumber, setMobileNumber] = useState('');
  const [userType] = useState<'employee' | 'vendor'>('employee');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const dispatch = useDispatch<StoreDispatch>();

  useEffect(() => {
    const init = async () => {
      await Location.checkPermission();
    };
    init();
    return () => {};
  }, []);

  const getPwdKey = async () => {
    // Save userType and mobile to Preferences
    await Preferences.setData('USER_TYPE', userType);
    await Preferences.setData('MOB_NO_USED', mobileNumber);
    let hashKey = [''];

    try {
      if (userType === 'vendor') {
        // ── VENDOR: dispatch getVendorOtpApi ──────────────────────────────
        if (Platform.OS === 'android') {
          try {
            hashKey = await OTPVerify.getHash();
            if (hashKey && hashKey[0]) {
              const safeHashKey = encodeURIComponent(hashKey[0]);
              Common.log('Android Original Hash Key::', hashKey[0]);
              Common.log('Android Safe Hash Key (encoded)::', safeHashKey);
              await dispatch(
                getVendorOtpApi({
                  mobileNumber,
                  hashKey: safeHashKey,
                  userType,
                }),
              );
              return;
            }
          } catch (err) {
            Common.warn('Error getting hash key for vendor', err);
          }
        }
        await dispatch(
          getVendorOtpApi({mobileNumber, hashKey: hashKey[0], userType}),
        );
      } else {
        // ── EMPLOYEE: dispatch getOtpApi ──────────────────────────────────
        if (Platform.OS === 'android') {
          try {
            hashKey = await OTPVerify.getHash();
            if (hashKey && hashKey[0]) {
              const safeHashKey = encodeURIComponent(hashKey[0]);
              Common.log('Android Original Hash Key::', hashKey[0]);
              Common.log('Android Safe Hash Key (encoded)::', safeHashKey);
              await dispatch(
                getOtpApi({mobileNumber, hashKey: safeHashKey, userType}),
              );
              return;
            }
          } catch (err) {
            Common.warn('Error getting hash key for employee', err);
          }
        }
        await dispatch(
          getOtpApi({mobileNumber, hashKey: hashKey[0], userType}),
        );
      }
    } finally {
      // Always release the guard, regardless of success/failure, so the
      // user can retry if something went wrong.
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const checkValidation = () => {
    // Block any tap that comes in while a request is already in flight.
    // This is a synchronous check (ref), so it blocks even the very next
    // tap-tick before React state/redux has had a chance to re-render.
    if (isSubmittingRef.current) {
      return;
    }

    Keyboard.dismiss();
    if (mobileNumber.trim() === '') {
      Common.showToast(t('validation.empty_mobile'));
    } else if (mobileNumber.trim().length < 10) {
      Common.showToast(t('validation.invalid_mobile'));
    } else if (!Common.isValidMobile(mobileNumber)) {
      Common.showToast(t('validation.invalid_mobile'));
    } else {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      getPwdKey();
    }
  };

  return (
    <Screen
      preset={'scroll'}
      loading={loading || isSubmitting}
      statusBgColor={COLORS.BACKGROUND_DEFAULT}
      statusBarStyle={'dark'}>
      <View>
        <View style={[styles.view, styles.viewFlexBox]}>
          <View style={[styles.headline, styles.viewFlexBox]}>
            <Image
              source={IMAGES.appLogo}
              style={styles.logoSm1Icon}
              resizeMode="cover"
            />
            <View style={[styles.text, styles.viewFlexBox]}>
              <Text style={styles.signInTo}>Sign in to your Account</Text>
              <Text
                style={
                  styles.enterYourPhone
                }>{`Enter your phone number to log in `}</Text>
            </View>
          </View>
        </View>

        <View style={styles.fieldParent}>
          <View style={styles.field}>
            <View style={styles.inputField}>
              <InputField
                title={'Phone'}
                type={'loginMobile'}
                value={mobileNumber}
                placeholder={'Enter phone no.'}
                maxLength={10}
                isRequired
                keyboardType={'number-pad'}
                onChangeText={setMobileNumber}
                textContentType={'oneTimeCode'}
                inputStyle={{height: SIZE.MVS(45)}}
                onEndEditing={() => Keyboard.dismiss()}
              />
            </View>
          </View>
        </View>

        {/* User type selection is hidden; login defaults to Employee.
        <View style={styles.checkboxContainer}>
          <TouchableOpacity
            style={styles.checkboxRow}
            activeOpacity={0.7}
            disabled={isSubmitting}
            onPress={() => setUserType('employee')}>
            <View
              style={[
                styles.checkbox,
                userType === 'employee' && styles.checkboxSelected,
              ]}>
              {userType === 'employee' && <View style={styles.checkboxInner} />}
            </View>
            <Text
              style={[
                styles.checkboxLabel,
                userType === 'employee' && styles.checkboxLabelSelected,
              ]}>
              Employee
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxRow}
            activeOpacity={0.7}
            disabled={isSubmitting}
            onPress={() => setUserType('vendor')}>
            <View
              style={[
                styles.checkbox,
                userType === 'vendor' && styles.checkboxSelected,
              ]}>
              {userType === 'vendor' && <View style={styles.checkboxInner} />}
            </View>
            <Text
              style={[
                styles.checkboxLabel,
                userType === 'vendor' && styles.checkboxLabelSelected,
              ]}>
              Vendor
            </Text>
          </TouchableOpacity>
        </View>
        */}

        <View style={styles.buttonWrapper}>
          <Buttons
            type={'primary'}
            title={'SEND OTP'}
            viewStyle={styles.loginButton}
            onPress={checkValidation}
            disabled={isSubmitting}
          />
        </View>
      </View>

      <Text style={styles.gigatelTechnosoftPvt}>
        Gigatel Technosoft Pvt Ltd
      </Text>
    </Screen>
  );
};

const MapStateToProps = (state: RootState) => ({
  loading: state.login.loading === 'pending' ? true : false,
});
export default connect(MapStateToProps)(Login);

const styles = StyleSheet.create({
  inputContainer: {
    marginHorizontal: SIZE.MS(15),
  },
  spacer: {flex: 1},
  loginButton: {
    marginHorizontal: SIZE.MS(20),
    marginVertical: SIZE.MS(20),
  },
  descText: {
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MVS(14),
    color: COLORS.TEXT_DARK,
    alignSelf: 'center',
    marginTop: SIZE.MS(20),
    marginHorizontal: SIZE.MS(15),
    marginBottom: SIZE.MS(30),
  },
  loginText: {
    marginTop: SIZE.MS(30),
    fontFamily: FONTS.BOLD,
    fontSize: SIZE.MVS(16),
    color: COLORS.PRIMARY,
    marginHorizontal: SIZE.MS(15),
  },
  appNameText: {
    fontFamily: FONTS.BOLD,
    fontSize: SIZE.MVS(25),
    color: COLORS.PRIMARY,
    alignSelf: 'center',
    marginVertical: SIZE.MS(10),
  },
  logoImge: {
    width: SIZE.MS(150),
    height: SIZE.MS(150),
    alignSelf: 'center',
    marginVertical: SIZE.MS(25),
  },
  head: {
    flex: 1,
  },
  viewFlexBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneClr: {
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
  },
  inputSpaceBlock: {
    paddingHorizontal: Padding.padding_24,
    borderRadius: Border.br_10,
    alignSelf: 'stretch',
  },
  frameParentFlexBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text2Typo: {
    lineHeight: 20,
    fontSize: FontSize.fs_14,
    letterSpacing: -0.1,
    fontFamily: FontFamily.switzer,
  },
  view: {
    width: '100%',
    paddingTop: SIZE.MS(65),
    gap: 30,
    justifyContent: 'center',
    overflow: 'hidden',
    flex: 1,
  },
  headline: {
    gap: 24,
    justifyContent: 'center',
  },
  logoSm1Icon: {
    width: 41,
    height: 41,
  },
  text: {
    width: 341,
    gap: 12,
    justifyContent: 'center',
  },
  signInTo: {
    fontSize: SIZE.MS(30),
    letterSpacing: -0.8,
    fontFamily: FONTS.SEMI_BOLD,
    lineHeight: 42,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  enterYourPhone: {
    fontSize: SIZE.MS(12),
    lineHeight: 17,
    textAlign: 'left',
    fontWeight: '500',
    letterSpacing: -0.1,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
  },
  // ── Checkbox / Radio Styles ──
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SIZE.MS(24),
    marginHorizontal: SIZE.MS(20),
    gap: SIZE.MS(24),
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginHorizontal: SIZE.MS(10),
    gap: SIZE.MS(12),
  },
  checkbox: {
    width: SIZE.MS(20),
    height: SIZE.MS(20),
    borderRadius: SIZE.MS(10),
    borderWidth: 2,
    borderColor: COLORS.colorDarkslategray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: COLORS.PRIMARY,
  },
  checkboxInner: {
    width: SIZE.MS(10),
    height: SIZE.MS(10),
    borderRadius: SIZE.MS(5),
    backgroundColor: COLORS.PRIMARY,
  },
  checkboxLabel: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
  },
  checkboxLabelSelected: {
    color: COLORS.PRIMARY,
    fontFamily: FONTS.SEMI_BOLD,
  },
  inputWrapper: {
    width: 430,
    padding: 20,
  },
  input: {
    paddingVertical: 0,
  },
  fieldParent: {
    marginTop: SIZE.MS(20),
    alignSelf: 'stretch',
  },
  field: {
    alignItems: 'flex-end',
    alignSelf: 'stretch',
  },
  inputField: {
    gap: 10,
    alignSelf: 'stretch',
  },
  title: {
    height: 21,
    borderRadius: 100,
    zIndex: 1,
    justifyContent: 'center',
  },
  phone: {
    fontSize: 15,
    letterSpacing: -0.3,
    lineHeight: 24,
    textAlign: 'left',
    fontWeight: '500',
  },
  inputArea: {
    height: 46,
    elevation: 3,
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: 14,
    paddingVertical: 27,
    zIndex: 0,
    borderRadius: Border.br_10,
    flexDirection: 'row',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  frameParent: {
    justifyContent: 'space-between',
    gap: 0,
    flex: 1,
  },
  frameGroup: {
    gap: 5,
    flex: 1,
  },
  image1Parent: {
    gap: 6,
  },
  image1Icon: {
    height: 12,
    width: 19,
  },
  text2: {
    color: COLORS.colorDimgray100,
    textAlign: 'left',
    fontWeight: '500',
    overflow: 'hidden',
  },
  enterPhoneNo: {
    width: 207,
    color: COLORS.colorDimgray200,
    textAlign: 'left',
    overflow: 'hidden',
  },
  phoneSolidFull1: {
    height: 15,
    width: 15,
    overflow: 'hidden',
  },
  buttonWrapper: {
    alignSelf: 'stretch',
  },
  button: {
    height: 48,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderColor: COLORS.colorGray,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: Padding.padding_24,
    borderRadius: Border.br_10,
    alignSelf: 'stretch',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sendOtp: {
    color: COLORS.WHITE,
    fontWeight: '500',
    textAlign: 'center',
  },
  gigatelTechnosoftPvt: {
    bottom: 10,
    alignSelf: 'center',
    position: 'absolute',
    fontSize: SIZE.MS(13),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
    textAlign: 'center',
  },
});
