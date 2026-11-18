import {useNavigation} from '@react-navigation/native';
import {reset} from '@navigation/services';
import {Screen} from '@organisms';
import {resetStore, RootState, StoreDispatch} from '@reducers';
import {
  updateEmployeePhotoApi,
  updateEmployeeGpsAddressApi,
  dashboardListApi,
} from '../../store/slices/dashboard.slice';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {COLORS, FONTS, IMAGES, SIZE, STYLES} from '@res';
import {DataType, ScreenProps} from '@types';
import {Common, Location, Preferences} from '@utils';
import LinearGradient from 'react-native-linear-gradient';
import React, {FC, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  Image,
  StyleSheet,
  Text,
  View,
  Alert,
  Pressable,
  TouchableOpacity,
  Platform,
  Modal,
  Animated,
} from 'react-native';
import {connect, useDispatch} from 'react-redux';
import {RootStackParamList} from '@navigation/navigator';
import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
  Asset,
} from 'react-native-image-picker';
import {
  FontFamily,
  Height,
  Width,
  MinWidth,
  LineHeight,
  FontSize,
  Padding,
  Gap,
} from '../../res/globalStyle';

type NavigationProps = NativeStackNavigationProp<
  RootStackParamList,
  'ProfileScreen'
>;

const ProfileScreen: FC<ScreenProps.ProfileScreen> = ({
  employeeDetails,
  loading,
}) => {
  const {t} = useTranslation();
  const navigation = useNavigation<NavigationProps>();
  const dispatch = useDispatch<StoreDispatch>();
  const loginInfo = Preferences.getData('LOGIN_RESPONSE') ?? {};
  const userId = loginInfo?.userId;
  const companyId = loginInfo?.companyId;
  const role = loginInfo?.role;
  const designationName = loginInfo?.designaionName;
  const userName = loginInfo?.userName;

  const [address, setAddress] = useState('');
  const [gpsAddress, setGpsAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [isAddressUpdating, setIsAddressUpdating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [showFullPhoto, setShowFullPhoto] = useState(false);

  const [profileImageUri, setProfileImageUri] = useState<string | null>(
    employeeDetails?.employeePhotoUrl || null,
  );

  const isUploadingRef = useRef(false);
  const isAddressUpdatingRef = useRef(false);

  const photoOpacity = useRef(new Animated.Value(0)).current;
  const photoScale = useRef(new Animated.Value(0.85)).current;

  const currentPhotoUri =
    employeeDetails?.employeePhotoUrl || profileImageUri || null;

  const loadLastAddress = async () => {
    const lastAddress = await Preferences.getData('LAST_FULL_ADDRESS');
    if (lastAddress?.address) setAddress(lastAddress.address);
  };

  useEffect(() => {
    loadLastAddress();
  }, []);

  useEffect(() => {
    if (employeeDetails?.employeePhotoUrl) {
      setProfileImageUri(employeeDetails.employeePhotoUrl);
    }
  }, [employeeDetails?.employeePhotoUrl]);

  useEffect(() => {
    if (showFullPhoto) {
      photoOpacity.setValue(0);
      photoScale.setValue(0.85);
      Animated.parallel([
        Animated.timing(photoOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(photoScale, {
          toValue: 1,
          friction: 7,
          tension: 70,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showFullPhoto]);

  const closeFullPhoto = () => {
    Animated.parallel([
      Animated.timing(photoOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(photoScale, {
        toValue: 0.85,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowFullPhoto(false);
    });
  };

  // ---------------------------------------------------------------------
  // FIX (iOS upload bug — already fixed earlier):
  // Do NOT strip `file://` from the URI on iOS. RN's FormData/fetch
  // multipart uploader needs the FULL `file://...` URI on iOS (same as
  // Android) to correctly read the file.
  // ---------------------------------------------------------------------
  const uploadProfilePhoto = async (asset: Asset) => {
    if (isUploadingRef.current) {
      return;
    }
    if (!asset?.uri) {
      Common.showToast('Invalid image selected');
      return;
    }

    isUploadingRef.current = true;
    setIsPhotoUploading(true);

    try {
      const mimeType = asset.type || 'image/jpeg';
      const extFromType = mimeType.split('/')[1] || 'jpg';
      const fileName = asset.fileName || `profile_${Date.now()}.${extFromType}`;

      const employeePhoto = {
        uri: asset.uri,
        type: mimeType,
        name: fileName,
      };

      const result = await dispatch(
        updateEmployeePhotoApi({
          employeePhoto,
          employeePhotoName: fileName,
        }),
      ).unwrap();

      const updatedUrl =
        result?.data?.employeePhotoUrl || result?.employeePhotoUrl || asset.uri;
      setProfileImageUri(updatedUrl);

      await dispatch(dashboardListApi({isRefresh: true})).unwrap();

      Common.showToast(result?.message || 'Profile photo updated!');
    } catch (error: any) {
      console.log('uploadProfilePhoto ERROR ===>', error);
      Common.showToast(
        error?.message || 'Failed to update profile photo. Please try again.',
      );
    } finally {
      setIsPhotoUploading(false);
      isUploadingRef.current = false;
    }
  };

  const handlePickerResponse = (response: ImagePickerResponse) => {
    if (response.didCancel) {
      return;
    }
    if (response.errorCode) {
      console.log(
        'ImagePicker error ===>',
        response.errorCode,
        response.errorMessage,
      );
      Common.showToast(response.errorMessage || 'Something went wrong');
      return;
    }
    const asset = response.assets && response.assets[0];
    if (asset?.uri) {
      uploadProfilePhoto(asset);
    }
  };

  // ---------------------------------------------------------------------
  // ✅ FIX (iOS camera crash — "opens and closes instantly, app stops"):
  //
  // Root cause: `setShowPhotoSheet(false)` starts the bottom-sheet Modal's
  // DISMISS animation (iOS modals animate closed over ~300ms). Immediately
  // calling `launchCamera()` right after tries to present a NEW native
  // view controller (the camera) while the previous one (the sheet Modal)
  // is still mid-transition.
  //
  // iOS's UIKit is strict about this and treats it as an invalid/
  // overlapping view controller transition — this is exactly what causes
  // the camera to flash open and then instantly close, sometimes
  // crashing the app. Android's activity/fragment transition model is
  // more forgiving, which is why this never showed up on Android.
  //
  // FIX: On iOS only, wait for the sheet's dismiss animation to actually
  // finish (small delay) before presenting the camera/gallery picker.
  // Android behavior is completely unchanged (delay = 0, fires
  // immediately exactly like before).
  // ---------------------------------------------------------------------
  const IOS_MODAL_DISMISS_DELAY = 500; // ms — matches/exceeds default iOS modal dismiss animation

  const openCamera = () => {
    setShowPhotoSheet(false);

    const launch = async () => {
      if (isUploadingRef.current) return;
      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.7,
        saveToPhotos: true,
        includeBase64: false,
      });
      handlePickerResponse(result);
    };

    if (Platform.OS === 'ios') {
      setTimeout(launch, IOS_MODAL_DISMISS_DELAY);
    } else {
      launch();
    }
  };

  const openGallery = () => {
    setShowPhotoSheet(false);

    const launch = async () => {
      if (isUploadingRef.current) return;
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.7,
        includeBase64: false,
      });
      handlePickerResponse(result);
    };

    if (Platform.OS === 'ios') {
      setTimeout(launch, IOS_MODAL_DISMISS_DELAY);
    } else {
      launch();
    }
  };

  const viewFullPhoto = () => {
    if (!currentPhotoUri) {
      Common.showToast('No profile photo to show yet');
      return;
    }
    setShowPhotoSheet(false);
    setShowFullPhoto(true);
  };

  const handleImagePress = () => {
    if (isUploadingRef.current) {
      Common.showToast('Please wait, photo is updating...');
      return;
    }
    setShowPhotoSheet(true);
  };

  const getAddressLocation = async (forceRefresh = false) => {
    if (isAddressUpdatingRef.current) {
      return;
    }

    try {
      setIsLoading(true);
      setLocationError('');
      const permissionStatus = await Location.checkPermission();
      if (permissionStatus !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is required to fetch address.',
          [{text: 'OK'}],
        );
        return;
      }
      const data = (await Location.getAddressFromLatLong(
        forceRefresh,
      )) as DataType.GeoAddress;

      if (!data?.address) {
        setLocationError('Unable to fetch address');
        Common.showToast('Unable to fetch address');
        return;
      }

      setGpsAddress(data.address);

      isAddressUpdatingRef.current = true;
      setIsAddressUpdating(true);

      const result = await dispatch(
        updateEmployeeGpsAddressApi({
          gpsAddress: data.address,
        }),
      ).unwrap();

      await dispatch(dashboardListApi({isRefresh: true})).unwrap();

      Common.showToast(result?.message || 'Address updated successfully!');
    } catch (e: any) {
      console.log('getAddressLocation ERROR ===>', e);
      setLocationError(e?.message || 'Location error');
      Common.showToast(
        e?.message || 'Failed to update address. Please try again.',
      );
    } finally {
      setIsLoading(false);
      setIsAddressUpdating(false);
      isAddressUpdatingRef.current = false;
    }
  };

  const logout = async () => {
    Common.yesNoAlert('Logout', 'Are you sure?', async () => {
      await Preferences.logout();
      reset('Login');
      dispatch(resetStore());
    });
  };

  return (
    <Screen
      statusBgColor={COLORS.BACKGROUND_DEFAULT}
      loading={isLoading || loading || isPhotoUploading || isAddressUpdating}
      preset={'fixed'}
      statusBarStyle={'dark'}>
      <View style={styles.view}>
        <View style={styles.frameParent}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.arrowBack24dp434343Fill0WParent}>
            <Image
              source={IMAGES.arrowBack}
              style={styles.arrowBack24dp434343Fill0WIcon}
              resizeMode="cover"
            />
            <Text style={[styles.profile, styles.profileTypo]}>Profile</Text>
          </Pressable>
          <Text style={[styles.basicDetailsLinked, styles.profileTypo]}>
            Basic details linked to your account
          </Text>
          <View style={styles.frameGroup}>
            <View style={styles.frameWrapper}>
              <TouchableOpacity
                style={styles.frameContainer}
                onPress={handleImagePress}
                activeOpacity={0.7}
                disabled={isPhotoUploading}>
                <View style={styles.imageCircleWrapper}>
                  <Image
                    source={
                      currentPhotoUri
                        ? {uri: currentPhotoUri}
                        : IMAGES.profileImage
                    }
                    style={styles.edit38dp1f1f1fFill1Wght200Icon}
                    resizeMode="cover"
                  />
                  <View style={styles.cameraBadge}>
                    <Image
                      source={IMAGES.editImg || IMAGES.camera}
                      style={styles.cameraBadgeIcon}
                      resizeMode="contain"
                    />
                  </View>
                </View>
              </TouchableOpacity>
            </View>
            <View style={styles.frameView}>
              <View
                style={[styles.userRegularFull1Parent, styles.parentLayout]}>
                <Image
                  source={IMAGES.accountNew}
                  style={[styles.userRegularFull1Icon, styles.iconLayout]}
                  resizeMode="contain"
                />
                <Text style={[styles.name, styles.nameTypo]}>Name</Text>
              </View>
              <Text style={[styles.text, styles.nameTypo]}>:</Text>
              <View style={styles.frameContainer}>
                <View style={styles.frameContainer}>
                  {designationName === 'VendorEmployee' ? (
                    <Text style={[styles.shubhamDobriyal, styles.nameTypo]}>
                      {userName}
                    </Text>
                  ) : (
                    <Text style={[styles.shubhamDobriyal, styles.nameTypo]}>
                      {employeeDetails?.firstName} {employeeDetails?.lastName}
                    </Text>
                  )}
                </View>
              </View>
            </View>
            <View style={styles.frameChild} />
            <View style={styles.frameView}>
              <View
                style={[
                  styles.mobile24dp1f1f1fFill0Wght3Parent,
                  styles.parentLayout,
                ]}>
                <Image
                  source={IMAGES.mobile}
                  style={styles.mobile24dp1f1f1fFill0Wght3Icon}
                  resizeMode="contain"
                />
                <Text style={[styles.name, styles.nameTypo]}>Phone no.</Text>
              </View>
              <Text style={[styles.text, styles.nameTypo]}>:</Text>
              <View style={styles.frameContainer}>
                <Text style={[styles.shubhamDobriyal, styles.nameTypo]}>
                  {employeeDetails?.officeMobileNo}
                </Text>
              </View>
            </View>
            <View style={styles.frameChild} />
            <View style={styles.frameView}>
              <View
                style={[
                  styles.mobile24dp1f1f1fFill0Wght3Parent,
                  styles.parentLayout,
                ]}>
                <Image
                  source={IMAGES.mailImage}
                  style={styles.mail24dp1f1f1fFill0Wght300Icon}
                  resizeMode="cover"
                />
                <Text style={[styles.name, styles.nameTypo]}>Email</Text>
              </View>
              <Text style={[styles.text, styles.nameTypo]}>:</Text>
              <View style={styles.frameContainer}>
                <Text style={[styles.shubhamDobriyal, styles.nameTypo]}>
                  {employeeDetails?.officeEmailId}
                </Text>
              </View>
            </View>
            <View style={styles.frameChild} />
            <View style={styles.frameView}>
              <View
                style={[
                  styles.mobile24dp1f1f1fFill0Wght3Parent,
                  styles.parentLayout,
                ]}>
                <Image
                  source={IMAGES.distance1}
                  style={styles.distance24dp1f1f1fFill0WghIcon}
                  resizeMode="cover"
                />
                <Text style={[styles.name, styles.nameTypo]}>Zone</Text>
              </View>
              <Text style={[styles.text, styles.nameTypo]}>:</Text>
              <View style={styles.frameContainer}>
                <Text style={[styles.shubhamDobriyal, styles.nameTypo]}>
                  {employeeDetails?.zoneName}
                </Text>
              </View>
            </View>
            <View style={styles.frameChild} />
            <View style={styles.frameView}>
              <View
                style={[
                  styles.homePin24dp1f1f1fFill0WghParent,
                  styles.parentLayout,
                ]}>
                <Image
                  source={IMAGES.HomePin}
                  style={styles.homePin24dp1f1f1fFill0WghIcon}
                  resizeMode="cover"
                />
                <Text style={[styles.name, styles.nameTypo]}>Address</Text>
              </View>
              <Text style={[styles.text, styles.nameTypo]}>:</Text>
              <View style={styles.frameContainer}>
                <Text style={[styles.shubhamDobriyal, styles.nameTypo]}>
                  {employeeDetails?.gpsAddress
                    ? employeeDetails?.gpsAddress
                    : gpsAddress
                    ? gpsAddress
                    : address}
                </Text>
              </View>
            </View>
          </View>
          <Pressable
            onPress={() => getAddressLocation(true)}
            disabled={isAddressUpdating}
            style={styles.buttonWrapper}>
            <LinearGradient
              style={[styles.button, styles.buttonBorder]}
              locations={[0, 1]}
              colors={['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0)']}
              useAngle={true}
              angle={180}>
              <Text style={[styles.updateAddress]}>Update Address</Text>
            </LinearGradient>
          </Pressable>
          <Text style={[styles.allChangesTake, styles.updateAddressTypo]}>
            All changes take effect immediately
          </Text>{' '}
        </View>
      </View>

      <Modal
        visible={showPhotoSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoSheet(false)}>
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setShowPhotoSheet(false)}>
          <Pressable style={styles.sheetContainer} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Update Profile Photo</Text>

            <TouchableOpacity
              style={styles.sheetOption}
              activeOpacity={0.6}
              onPress={openCamera}>
              <View style={styles.sheetOptionIconWrap}>
                <Image
                  source={IMAGES.camera || IMAGES.HeaderBkg}
                  style={styles.sheetOptionIcon}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.sheetOptionText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetOption}
              activeOpacity={0.6}
              onPress={openGallery}>
              <View style={styles.sheetOptionIconWrap}>
                <Image
                  source={IMAGES.galleryIcon}
                  style={styles.sheetOptionIcon}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.sheetOptionText}>Choose from Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetOption}
              activeOpacity={0.6}
              onPress={viewFullPhoto}>
              <View style={styles.sheetOptionIconWrap}>
                <Image
                  source={IMAGES.eyeIcon || IMAGES.profileImage}
                  style={styles.sheetOptionIcon}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.sheetOptionText}>View Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetCancelBtn}
              activeOpacity={0.7}
              onPress={() => setShowPhotoSheet(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showFullPhoto}
        transparent
        animationType="none"
        onRequestClose={closeFullPhoto}>
        <Animated.View
          style={[styles.fullPhotoOverlay, {opacity: photoOpacity}]}>
          <Pressable style={styles.fullPhotoPressArea} onPress={closeFullPhoto}>
            <TouchableOpacity
              style={styles.fullPhotoCloseBtn}
              activeOpacity={0.7}
              onPress={closeFullPhoto}>
              <Text style={styles.fullPhotoCloseText}>✕</Text>
            </TouchableOpacity>
            {currentPhotoUri ? (
              <Animated.Image
                source={{uri: currentPhotoUri}}
                style={[
                  styles.fullPhotoImage,
                  {transform: [{scale: photoScale}]},
                ]}
                resizeMode="contain"
              />
            ) : null}
          </Pressable>
        </Animated.View>
      </Modal>
    </Screen>
  );
};

const MapStateToProps = (state: RootState) => ({
  loading: state.account.loading === 'pending',
  employeeDetails: state.dashboard.dashboardList?.employeeDetails,
});

export default connect(MapStateToProps)(ProfileScreen);

/* -------------------- Styles -------------------- */

const styles = StyleSheet.create({
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SIZE.MS(15),
    backgroundColor: COLORS.WHITE,
    ...STYLES.SHADOW_PRIMARY_3,
  },
  parent: {
    flex: 1,
  },
  profileTypo: {
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
  },
  buttonBorder: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderStyle: 'solid',
    alignItems: 'center',
    flexDirection: 'row',
  },
  iconLayout: {
    height: 18,
    width: 18,
  },
  parentLayout: {
    minWidth: MinWidth.min_w_96,
    flexDirection: 'row',
  },
  nameTypo: {
    lineHeight: LineHeight.lh_24,
    textAlign: 'left',
    fontFamily: FONTS.REGULAR,
  },
  updateAddressTypo: {
    textAlign: 'center',
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.MEDIUM,
  },
  view: {
    width: '100%',
    paddingHorizontal: Padding.padding_20,
    paddingTop: 38,
    paddingBottom: Padding.padding_20,
    gap: 24,
    flex: 1,
  },
  frameParent: {
    gap: Gap.gap_10,
    alignSelf: 'stretch',
  },
  arrowBack24dp434343Fill0WParent: {
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  arrowBack24dp434343Fill0WIcon: {
    width: Width.width_24,
    height: Height.height_24,
    resizeMode: 'contain',
  },
  profile: {
    fontSize: 18,
    letterSpacing: -0.4,
    lineHeight: 23,
    color: COLORS.colorDarkslategray,
    flex: 1,
  },
  basicDetailsLinked: {
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.colorDimgray,
  },
  frameGroup: {
    gap: 14,
    alignSelf: 'stretch',
  },
  frameWrapper: {
    paddingBottom: 8,
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  frameContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
  },
  imageCircleWrapper: {
    padding: 4,
    borderRadius: 54,
    backgroundColor: COLORS.WHITE,
    position: 'relative',
  },
  edit38dp1f1f1fFill1Wght200Icon: {
    height: 100,
    width: 100,
    borderRadius: 50,
    zIndex: 1,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.WHITE,
    zIndex: 2,
  },
  cameraBadgeIcon: {
    width: 14,
    height: 14,
    tintColor: COLORS.WHITE,
  },

  image5Parent: {
    borderRadius: 500,
    padding: 3,
    gap: Gap.gap_10,
  },
  image5Icon: {
    height: 100,
    width: 100,
    borderRadius: 50,
    zIndex: 0,
  },
  frameView: {
    gap: Gap.gap_6,
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  userRegularFull1Parent: {
    gap: Gap.gap_2,
    minWidth: MinWidth.min_w_96,
    alignItems: 'center',
  },
  userRegularFull1Icon: {
    width: Width.width_20,
  },
  name: {
    fontSize: FontSize.fs_14,
    lineHeight: LineHeight.lh_24,
    color: COLORS.colorDimgray,
    flex: 1,
  },
  text: {
    fontSize: FontSize.fs_16,
    color: COLORS.colorDimgray,
  },
  shubhamDobriyal: {
    fontSize: FontSize.fs_15,
    color: COLORS.colorDarkslategray,
    flex: 1,
  },
  frameChild: {
    height: Height.height_1,
    backgroundColor: COLORS.colorGainsboro,
    alignSelf: 'stretch',
  },
  mobile24dp1f1f1fFill0Wght3Parent: {
    gap: Gap.gap_6,
  },
  mobile24dp1f1f1fFill0Wght3Icon: {
    width: 15,
    height: Height.height_24,
  },
  mail24dp1f1f1fFill0Wght300Icon: {
    width: Width.width_20,
    height: Height.height_24,
  },
  distance24dp1f1f1fFill0WghIcon: {
    width: 17,
    height: Height.height_24,
  },
  homePin24dp1f1f1fFill0WghParent: {
    gap: Gap.gap_2,
    minWidth: MinWidth.min_w_96,
  },
  homePin24dp1f1f1fFill0WghIcon: {
    width: 18,
    height: Height.height_24,
  },
  buttonWrapper: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 10,
    alignSelf: 'stretch',
  },
  button: {
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  updateAddress: {
    fontSize: SIZE.MS(14),
    letterSpacing: -0.1,
    lineHeight: SIZE.MS(20),
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorWhite,
    textAlign: 'center',
  },
  allChangesTake: {
    width: '100%',
    fontSize: SIZE.MS(10),
    lineHeight: SIZE.MS(12),
    fontFamily: FontFamily.switzer,
    color: COLORS.colorDarkgray,
    textAlign: 'center',
  },

  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.colorGainsboro,
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: SIZE.MS(15),
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray,
    marginBottom: 14,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingVertical: 12,
    gap: 12,
  },
  sheetOptionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.PRIMARY_LIGHT || '#F0F4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetOptionIcon: {
    width: 18,
    height: 18,
  },
  sheetOptionText: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
  },
  sheetCancelBtn: {
    alignSelf: 'stretch',
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  sheetCancelText: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDimgray,
  },

  fullPhotoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  fullPhotoPressArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullPhotoImage: {
    width: '100%',
    height: '80%',
  },
  fullPhotoCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 24,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  fullPhotoCloseText: {
    color: COLORS.WHITE,
    fontSize: 18,
    fontFamily: FONTS.SEMI_BOLD,
  },
});
