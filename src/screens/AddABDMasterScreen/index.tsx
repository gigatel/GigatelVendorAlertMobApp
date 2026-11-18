import React, {FC, useState, useRef} from 'react';
import {
  StyleSheet,
  Text,
  Alert,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import {ScreenProps} from '@types';
import {Screen} from '@organisms';
import {useDispatch, useSelector} from 'react-redux';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {Location, Preferences, Common} from '@utils';
import {DataType} from '@types';
import type {BurnResult} from 'src/components/molecules/capture-image-watermark';
import Geolocation, {
  GeolocationResponse,
} from '@react-native-community/geolocation';
import {
  FontFamily,
  Border,
  Padding,
  LineHeight,
  FontSize,
  BoxShadow,
  Gap,
  Height,
  LetterSpacing,
  Width,
} from '../../res/globalStyle';
import {CaptureImageWatermark} from '@molecules';
import {insertUpdateABDMaster} from '@slices/dss.slice';
type SmartLocationCallbacks = {
  onBetterLocation?: (pos: GeolocationResponse) => void;
};
export const getSmartLocation = (
  callbacks: SmartLocationCallbacks = {},
): Promise<GeolocationResponse> & {stop?: () => void} => {
  const {onBetterLocation} = callbacks;
  let watchId: number | null = null;
  const promise: any = new Promise((resolve, reject) => {
    let isResolved = false;
    Geolocation.getCurrentPosition(
      (pos: GeolocationResponse) => {
        if (!isResolved) {
          isResolved = true;
          resolve(pos);
        }
      },
      () => {
        Geolocation.getCurrentPosition(
          (pos: GeolocationResponse) => {
            if (!isResolved) {
              isResolved = true;
              resolve(pos);
            }
          },
          reject,
          {enableHighAccuracy: false, timeout: 7000, maximumAge: 60000},
        );
      },
      {enableHighAccuracy: true, timeout: 8000, maximumAge: 0},
    );

    watchId = Geolocation.watchPosition(
      (pos: GeolocationResponse) => {
        if (pos.coords.accuracy <= 50) {
          onBetterLocation?.(pos);
          if (watchId !== null) {
            Geolocation.clearWatch(watchId);
            watchId = null;
          }
        }
      },
      () => {},
      {enableHighAccuracy: true, distanceFilter: 0},
    );
  });

  promise.stop = () => {
    if (watchId !== null) {
      Geolocation.clearWatch(watchId);
      watchId = null;
    }
  };
  return promise;
};
const AddABDMasterScreen: FC<ScreenProps.AddABDMasterScreen> = ({
  navigation,
  route,
}) => {
  const dispatch = useDispatch<any>();
  const [isLoading, setIsLoading] = useState(false);
  const {
    vendorID,
    projectId,
    fromPitLocationID,
    toPitLocationID,
    orderNumber,
    abdLat,
    abdLng,
    openShotId,
    distanceFromLastABD,
  } = route?.params ?? {};
  // ── GPS / Location ──
  const [currentPosition, setCurrentPosition] =
    useState<DataType.Coords | null>(null);
  const [gpsLat, setGpsLat] = useState<string>('');
  const [gpsLong, setGpsLong] = useState<string>('');
  const [locationError, setLocationError] = useState('');

  // ── Form Fields (matching exact API curl params) ──
  const [depth, setDepth] = useState('');
  const [offset, setOffset] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [remarks, setRemarks] = useState('');

  // ── Images ──
  const [pic1, setPic1] = useState<BurnResult | null>(null);
  const [pic2, setPic2] = useState<BurnResult | null>(null);

  // ── Validation ──
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // ── Countdown ──
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCountingDown = countdown !== null;

  // ─────────────────────────────────────────────
  // GPS fetch
  // ─────────────────────────────────────────────
  const fetchGPS = async () => {
    try {
      setIsLoading(true);
      setLocationError('');
      const perm = await Location.checkPermission();
      if (perm !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required.');
        return;
      }

      let freshLat = 0;
      let freshLong = 0;

      try {
        const position = await getSmartLocation({
          onBetterLocation: betterPos => {
            if (betterPos.coords.accuracy <= 25) {
              const lat = betterPos.coords.latitude;
              const lng = betterPos.coords.longitude;
              setGpsLat(String(lat));
              setGpsLong(String(lng));
              setCurrentPosition({latitude: lat, longitude: lng});
              Common.showToast('GPS improved automatically 🎯');
            }
          },
        });

        const accuracy = position.coords.accuracy;
        if (accuracy > 100) {
          Common.showToast('Low accuracy (indoor), using approximate location');
        } else if (accuracy > 50) {
          Common.showToast('Moderate GPS accuracy');
        } else {
          Common.showToast('High GPS accuracy 🎯');
        }
        freshLat = position.coords.latitude;
        freshLong = position.coords.longitude;
      } catch (posErr: any) {
        const msg =
          posErr?.code === 3
            ? 'GPS timed out. Move to open area and try again.'
            : posErr?.code === 2
            ? 'GPS unavailable. Please enable location services.'
            : 'Unable to fetch accurate GPS location.';
        setLocationError(msg);
        Alert.alert('GPS Error', msg);
        return;
      }

      let resolvedAddress = '';
      try {
        const data = (await Location.getAddressFromLatLong({
          lat: freshLat,
          lng: freshLong,
          isOla: false,
        })) as DataType.GeoAddress;
        if (data?.address) resolvedAddress = data.address;
      } catch {
        resolvedAddress = '';
      }

      setGpsLat(String(freshLat));
      setGpsLong(String(freshLong));
      setCurrentPosition({latitude: freshLat, longitude: freshLong});

      if (resolvedAddress) {
        setAddress(resolvedAddress);
        await Preferences.setData('LAST_GEO_ADDRESS', {
          address: resolvedAddress,
        });
        Common.showToast('GPS fetched successfully 🎯');
      } else {
        setAddress('');
        setLocationError('Address not found. Please enter manually.');
        Common.showToast('Coordinates captured. Enter address manually.');
      }

      if (pic1 || pic2) {
        Alert.alert(
          'GPS Updated',
          'Please retake photos to update the watermark.',
          [{text: 'OK'}],
        );
        setPic1(null);
        setPic2(null);
      }
    } catch (e: any) {
      setLocationError(e?.message || 'Location error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetPitGPS = async () => {
    const perm = await Location.checkPermission();
    if (perm !== 'granted') {
      Alert.alert('Permission Required', 'Location permission is required.');
      return;
    }
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(10);
    let remaining = 10;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
        countdownRef.current = null;
        setCountdown(null);
        fetchGPS();
      }
    }, 1000);
  };

  // ─────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────
  const validate = (): boolean => {
    const newErrors: Record<string, boolean> = {};
    if (!depth.trim()) newErrors.depth = true;
    if (!offset.trim()) newErrors.offset = true;
    const finalLat = gpsLat || abdLat;
    const finalLng = gpsLong || abdLng;
    if (!finalLat || !finalLng) {
      newErrors.gps = true;
    }
    if (!address.trim()) newErrors.address = true;
    if (!landmark.trim()) newErrors.landmark = true;
    if (!pic1) newErrors.image1 = true;
    if (!pic2) newErrors.image2 = true;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─────────────────────────────────────────────
  // Submit
  // ─────────────────────────────────────────────
  const handleSubmit = () => {
    if (!validate()) {
      Common.showToast('Please fill all required fields');
      return;
    }
    setIsLoading(true);
    // Dispatch your thunk here, e.g.:
    dispatch(
      insertUpdateABDMaster({
        id: 0,
        projectId: projectId ?? 0,
        vendorId: vendorID,
        fromPitLocationID: fromPitLocationID ?? 0,
        toPitLocationID: toPitLocationID ?? 0,
        orderNo: orderNumber,
        depth,
        offset,
        address,
        landmark,
        remarks,
        lat: gpsLat || abdLat || '',
        lng: gpsLong || abdLng || '',
        pic1,
        pic2,
        distance: distanceFromLastABD,
      }),
    )
      .unwrap()
      .then(() => {
        Alert.alert('Success', 'ABD Added Successfully', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      })
      .catch(err => {
        Alert.alert('Error', err?.message || 'Unable to save ABD');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };
  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <Screen statusBar="dark-content" statusBgColor={COLORS.BACKGROUND_DEFAULT}>
      <View style={styles.body}>
        {/* ── Fixed Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerSide}
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}>
            <Image
              style={styles.backIcon}
              resizeMode="contain"
              source={IMAGES.back}
            />
          </TouchableOpacity>
          <Text style={styles.title}>ABD Master</Text>
          <View style={styles.headerSide} />
        </View>
        {/* ── Scrollable Content ── */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.holidayitem}>
            <View style={styles.ul}>
              {/* ── Depth + Offset ── */}
              <View style={styles.row}>
                {/* Depth */}
                <View style={styles.fields}>
                  <View style={styles.span}>
                    <Text style={[styles.depth, styles.depthTypo]}>Depth</Text>
                    <Text style={[styles.requiredIndicator, styles.depthTypo]}>
                      {' *'}
                    </Text>
                  </View>
                  <TextInput
                    style={[styles.add, styles.addBorder]}
                    onChangeText={v => {
                      setDepth(v.replace(/[^0-9.]/g, ''));
                    }}
                    placeholder="0"
                    placeholderTextColor={COLORS.colorLightgray}
                    keyboardType="decimal-pad"
                  />
                  {errors.depth && (
                    <Text style={styles.errorText}>Required</Text>
                  )}
                </View>
                {/* Offset */}
                <View style={styles.fields}>
                  <View style={styles.span}>
                    <Text style={[styles.depth, styles.depthTypo]}>Offset</Text>
                    <Text style={[styles.requiredIndicator, styles.depthTypo]}>
                      {' *'}
                    </Text>
                  </View>
                  <TextInput
                    style={[styles.add, styles.addBorder]}
                    onChangeText={v => {
                      setOffset(v.replace(/[^0-9.]/g, ''));
                    }}
                    placeholder="0"
                    placeholderTextColor={COLORS.colorLightgray}
                    keyboardType="decimal-pad"
                  />
                  {errors.offset && (
                    <Text style={styles.errorText}>Required</Text>
                  )}
                </View>
              </View>
              {/* ── Lat / Long (read-only display) ── */}
              <View style={styles.fields3}>
                <View style={styles.span3}>
                  <Text style={[styles.depth, styles.depthTypo]}>
                    Latitude / Longitude
                  </Text>
                  <Text style={[styles.requiredIndicator, styles.depthTypo]}>
                    {' *'}
                  </Text>
                </View>
                <View style={styles.addressDetails}>
                  <View style={[styles.add3, styles.btnBorder]}>
                    <Text style={styles.addressTextTypo}>
                      {gpsLat && gpsLong
                        ? `${Number(gpsLat).toFixed(5)}°   ${Number(
                            gpsLong,
                          ).toFixed(5)}°`
                        : abdLat && abdLng
                        ? `${Number(abdLat).toFixed(5)}°   ${Number(
                            abdLng,
                          ).toFixed(5)}°`
                        : 'Tap "Get PIT GPS" to fetch'}
                    </Text>
                  </View>
                </View>
                {errors.gps && (
                  <Text style={styles.errorText}>GPS location is required</Text>
                )}
              </View>

              {/* ── PIT GPS Button ── */}
              <View style={styles.span4}>
                <Text style={[styles.pitLocationGps, styles.projectNameTypo]}>
                  PIT (GPS)
                </Text>
                <Text style={[styles.text4, styles.textTypo]}> *</Text>
                {gpsLat && gpsLong && (
                  <Text style={styles.gpsCoords}>
                    {`Lat: ${gpsLat}°\nLong: ${gpsLong}°`}
                  </Text>
                )}
                <TouchableOpacity
                  style={[
                    styles.li2,
                    styles.liFlexBox,
                    isCountingDown && styles.btnDisabled,
                  ]}
                  onPress={handleGetPitGPS}
                  disabled={isCountingDown}>
                  <Text style={[styles.checkAvailability, styles.submitClr]}>
                    {countdown !== null
                      ? `Fetching GPS… ${countdown}s`
                      : 'Get PIT GPS'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ── Address ── */}
              <View style={styles.ul}>
                <View style={styles.span}>
                  <Text style={[styles.depth, styles.depthTypo]}>Address</Text>
                  <Text style={[styles.requiredIndicator, styles.depthTypo]}>
                    {' *'}
                  </Text>
                </View>
                <View style={styles.addressDetails2}>
                  <View style={[styles.add4, styles.addSpaceBlock]}>
                    <TextInput
                      multiline
                      numberOfLines={3}
                      value={address}
                      onChangeText={v => {
                        setAddress(v);
                        if (v) setErrors(e => ({...e, address: false}));
                      }}
                      style={[styles.landmarkValue, styles.addressTextTypo]}
                      placeholder="Enter address"
                      placeholderTextColor={COLORS.colorLightgray}
                    />
                  </View>
                </View>
                {errors.address && (
                  <Text style={styles.errorText}>Address is required</Text>
                )}
              </View>

              {/* ── Landmark ── */}
              <View style={styles.ul}>
                <View style={styles.span5}>
                  <Text style={[styles.depth, styles.depthTypo]}>Landmark</Text>
                  <Text style={[styles.requiredIndicator, styles.depthTypo]}>
                    {' *'}
                  </Text>
                </View>
                <View style={[styles.add5, styles.addSpaceBlock]}>
                  <TextInput
                    multiline={false}
                    onChangeText={v => {
                      setLandmark(v);
                      if (v) setErrors(e => ({...e, landmark: false}));
                    }}
                    style={[styles.landmarkValue, styles.addressTextTypo]}
                    placeholder="Enter Landmark"
                    placeholderTextColor={COLORS.colorLightgray}
                  />
                </View>
                {errors.landmark && (
                  <Text style={styles.errorText}>Landmark is required</Text>
                )}
              </View>

              {/* ── Remarks ── */}
              <View style={styles.ul}>
                <View style={styles.span5}>
                  <Text style={[styles.depth, styles.depthTypo]}>Remarks</Text>
                </View>
                <View style={[styles.add4, styles.addSpaceBlock]}>
                  <TextInput
                    multiline
                    numberOfLines={3}
                    onChangeText={setRemarks}
                    style={[styles.landmarkValue, styles.addressTextTypo]}
                    placeholder="Enter Remarks"
                    placeholderTextColor={COLORS.colorLightgray}
                  />
                </View>
              </View>

              {/* ── PIT Images ── */}
              <View style={styles.fields6}>
                <View style={styles.ul}>
                  <View style={styles.label}>
                    <View style={styles.span}>
                      <Text
                        style={[styles.projectName, styles.projectNameTypo]}>
                        PIT Images
                      </Text>
                      <Text style={styles.textTypo}> *</Text>
                    </View>
                  </View>

                  {!gpsLat || !gpsLong ? (
                    <View style={styles.gpsWarningBanner}>
                      <Text style={styles.gpsWarningText}>
                        ⚠ Tap "Get PIT GPS" first — Lat, Long & Address will be
                        permanently burned onto both photos as a watermark.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.gpsReadyBanner}>
                      <Text style={styles.gpsReadyText}>
                        ✓ GPS ready — watermark will be burned into both photos
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.row2}>
                  {/* Image 1 */}
                  <View style={styles.col}>
                    <CaptureImageWatermark
                      title="Image 1"
                      pic={pic1}
                      setPic={result => {
                        setPic1(result);
                        if (result) setErrors(e => ({...e, image1: false}));
                      }}
                      lat={gpsLat}
                      long={gpsLong}
                      address={address}
                      hasError={!!errors.image1}
                    />
                    {errors.image1 && !pic1 && (
                      <Text style={styles.errorText}>Required</Text>
                    )}
                  </View>

                  {/* Image 2 */}
                  <View style={styles.col}>
                    <CaptureImageWatermark
                      title="Image 2"
                      pic={pic2}
                      setPic={result => {
                        setPic2(result);
                        if (result) setErrors(e => ({...e, image2: false}));
                      }}
                      lat={gpsLat}
                      long={gpsLong}
                      address={address}
                      hasError={!!errors.image2}
                    />
                    {errors.image2 && !pic2 && (
                      <Text style={styles.errorText}>Required</Text>
                    )}
                  </View>
                </View>
              </View>

              {/* ── Submit ── */}
              <TouchableOpacity
                style={[styles.btn3, styles.liShadowBox]}
                onPress={handleSubmit}
                disabled={isLoading}
                activeOpacity={0.8}>
                <Text style={[styles.submit, styles.getGpsTypo]}>
                  {isLoading ? 'Submitting…' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* ── FULL SCREEN GPS LOADER (Modal-based, always covers entire screen) ── */}
      <Modal
        visible={isCountingDown || isLoading}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {}}>
        <View style={styles.fullScreenOverlay}>
          <View style={styles.loaderCard}>
            {isCountingDown ? (
              <>
                <View style={styles.countdownBarBg}>
                  <View
                    style={[
                      styles.countdownBarFill,
                      {width: `${((10 - (countdown ?? 0)) / 10) * 100}%`},
                    ]}
                  />
                </View>
                <Text style={styles.countdownText}>
                  {`Getting GPS in ${countdown}s…`}
                </Text>
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color={COLORS.PRIMARY} />
                <Text style={styles.countdownText}>Fetching GPS location…</Text>
              </>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

export default AddABDMasterScreen;

const styles = StyleSheet.create({
  depthTypo: {
    textAlign: 'left',
    fontFamily: FontFamily.switzer,
  },
  addBorder: {
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderStyle: 'solid',
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
    alignSelf: 'stretch',
  },
  col: {
    gap: Gap.gap_12,
    flex: 1,
  },
  btnBorder: {
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderStyle: 'solid',
    borderRadius: Border.br_8,
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  addSpaceBlock: {
    paddingVertical: Padding.padding_5,
    flexDirection: 'row',
  },
  getGpsTypo: {
    color: COLORS.colorWhite,
    textAlign: 'left',
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
  },
  addressTextTypo: {
    lineHeight: LineHeight.lh_22,
    textAlign: 'left',
    fontSize: FontSize.fs_14,
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
  },
  gpsCoords: {
    fontSize: 12,
    color: COLORS.PRIMARY,
    fontFamily: FONTS.REGULAR,
    marginHorizontal: 6,
    flexShrink: 1,
  },
  projectName: {
    letterSpacing: LetterSpacing.ls_0_2,
    fontSize: FontSize.fs_14,
  },
  textTypo: {
    color: COLORS.colorRed,
    textAlign: 'left',
    fontSize: FontSize.fs_14,
    fontFamily: FontFamily.switzer,
  },
  pitLocationGps: {
    letterSpacing: LetterSpacing.ls_0_2,
    fontSize: FontSize.fs_14,
    zIndex: 0,
  },
  text4: {
    zIndex: 1,
  },
  liShadowBox: {
    backgroundColor: COLORS.colorDeepskyblue,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownWrap: {marginTop: 6, marginBottom: 2, gap: 4},
  countdownBarBg: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%',
  },
  errorText: {
    fontSize: 12,
    color: COLORS.ERROR,
    marginTop: 2,
    marginBottom: 4,
    fontFamily: FONTS.REGULAR,
  },
  btnDisabled: {opacity: 0.6},
  body: {
    flex: 1,
    paddingHorizontal: Padding.padding_16,
    paddingTop: SIZE.MS(18),
    width: '100%',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  headerSide: {width: 32, alignItems: 'flex-start', justifyContent: 'center'},
  scrollContent: {
    paddingBottom: 32,
  },
  span4: {
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  checkAvailability: {
    fontSize: FontSize.fs_12,
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
  },
  header: {
    gap: Gap.gap_12,
    alignItems: 'center',
    flexDirection: 'row',
    height: Height.height_24,
    alignSelf: 'stretch',
    marginBottom: 22,
  },
  submitClr: {
    color: COLORS.colorWhite,
    textAlign: 'left',
  },
  title: {
    flex: 1,
    fontSize: 18,
    lineHeight: 23,
    textAlign: 'center',
    fontWeight: '500',
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
  },
  projectNameTypo: {
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
  },
  backIcon: {
    width: 24,
    top: 0,
    left: 0,
    zIndex: 1,
    position: 'absolute',
    height: Height.height_24,
  },
  holidayitem: {
    paddingVertical: Padding.padding_16,
    maxWidth: 430,
    paddingHorizontal: Padding.padding_12,
    overflow: 'hidden',
    backgroundColor: COLORS.colorWhite,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    borderRadius: Border.br_8,
    alignItems: 'flex-start',
    width: '100%',
  },
  ul: {
    gap: Gap.gap_12,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  row: {
    gap: Gap.gap_10,
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  fields: {
    gap: Gap.gap_12,
    alignItems: 'flex-start',
    flex: 1,
  },
  span: {
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  liFlexBox: {
    paddingVertical: Padding.padding_5,
    paddingHorizontal: Padding.padding_6,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: Border.br_5,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  depth: {
    letterSpacing: LetterSpacing.ls_0_2,
    fontSize: FontSize.fs_14,
    color: COLORS.colorDarkslategray,
  },
  requiredIndicator: {
    color: COLORS.colorRed,
    fontSize: FontSize.fs_14,
  },
  add: {
    height: 42,
    alignItems: 'center',
    paddingHorizontal: Padding.padding_12,
  },
  fields3: {
    gap: Gap.gap_12,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  gpsWarningBanner: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  gpsWarningText: {
    fontSize: 12,
    color: '#E65100',
    fontFamily: FONTS.REGULAR,
    lineHeight: 17,
  },
  gpsReadyBanner: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  gpsReadyText: {fontSize: 12, color: '#2E7D32', fontFamily: FONTS.MEDIUM},
  span3: {
    zIndex: 0,
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  addressDetails: {
    zIndex: 1,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  add3: {
    backgroundColor: COLORS.colorWhitesmoke,
    paddingHorizontal: Padding.padding_12,
  },
  addressDetails2: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  add4: {
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderStyle: 'solid',
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
    alignSelf: 'stretch',
    paddingHorizontal: Padding.padding_12,
    minHeight: 60,
    alignItems: 'flex-start',
  },
  span5: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  add5: {
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderStyle: 'solid',
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
    alignSelf: 'stretch',
    paddingHorizontal: Padding.padding_12,
    paddingVertical: 0,
    minHeight: 40,
    alignItems: 'center',
  },
  landmarkValue: {
    flex: 1,
    minHeight: 40,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
  fields6: {
    gap: Gap.gap_12,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  label: {
    justifyContent: 'center',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  row2: {
    gap: Gap.gap_12,
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    flex: 1,
  },
  countdownBarFill: {
    height: 4,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 4,
  },
  countdownText: {
    fontSize: 13,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
    textAlign: 'center',
    marginTop: 10,
  },
  btn3: {
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: Border.br_8,
    alignSelf: 'stretch',
    flexDirection: 'row',
  },
  submit: {
    fontSize: FontSize.fs_14,
  },
  li2: {
    marginTop: -13,
    top: '50%',
    right: 0,
    zIndex: 2,
    position: 'absolute',
  },
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderCard: {
    backgroundColor: COLORS.colorWhite,
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 28,
    width: '75%',
    alignItems: 'center',
    elevation: 5,
    boxShadow: BoxShadow.shadow_drop,
  },
});
