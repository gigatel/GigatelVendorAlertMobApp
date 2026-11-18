import React, {useState, FC, useRef, useEffect, useMemo} from 'react';
import {
  Text,
  StyleSheet,
  View,
  Alert,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {ScreenProps} from '@types';
import {Screen} from '@organisms';
import {useDispatch} from 'react-redux';
import {
  getItemMasterTypeAPi,
  getNearestPitLatLng,
  insertUpdateChamberInstallationAPI,
} from '../../store/slices/dss.slice';
import {Location, Common} from '@utils';
import DssCustomPicker from '../../components/molecules/DsscustomPicker';
import {CaptureImageWatermark} from '@molecules';
import type {BurnResult} from '../../components/molecules/capture-image-watermark/index';
import {
  BoxShadow,
  LetterSpacing,
  Padding,
  Border,
  Height,
  Gap,
  FontSize,
} from '../../res/globalStyle';

// ── Yes / No picker data ─────────────────────────────────────────────────────
const DUCT_STAND_OPTIONS = [
  {label: 'Yes', value: 'Yes'},
  {label: 'No', value: 'No'},
];
const PCC_DONE_OPTIONS = [
  {label: 'Yes', value: 'Yes'},
  {label: 'No', value: 'No'},
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type ItemMasterType = {id: number; itemName: string};
type VendorItem = {vendorId: string; vendorCode: string; vendorName: string};

// ─────────────────────────────────────────────────────────────────────────────
// parseVendors
// ─────────────────────────────────────────────────────────────────────────────
const parseVendors = (
  vendorID?: string,
  vendorCode?: string,
  vendorName?: string,
): VendorItem[] => {
  const ids = (vendorID ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const codes = (vendorCode ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const names = (vendorName ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const count = Math.max(ids.length, codes.length, names.length);
  if (count === 0) return [];
  return Array.from({length: count}, (_, i) => ({
    vendorId: ids[i] ?? '',
    vendorCode: codes[i] ?? '',
    vendorName: names[i] ?? '',
  }));
};

// ─────────────────────────────────────────────────────────────────────────────
// VendorPicker — inline modal dropdown
// ─────────────────────────────────────────────────────────────────────────────
type VendorPickerProps = {
  data: VendorItem[];
  value: VendorItem | null;
  placeholder: string;
  onSelect: (item: VendorItem) => void;
  hasError: boolean;
};
const VendorPicker: FC<VendorPickerProps> = ({
  data,
  value,
  placeholder,
  onSelect,
  hasError,
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        style={[vStyles.box, hasError && vStyles.boxError]}
        onPress={() => setVisible(true)}>
        <Text
          style={[vStyles.text, !value && vStyles.placeholder]}
          numberOfLines={1}>
          {value ? value.vendorName : placeholder}
        </Text>
        <Text style={vStyles.arrow}>▾</Text>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity
          style={vStyles.overlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}>
          <View style={vStyles.dropdown}>
            {data.map((item, index) => (
              <TouchableOpacity
                key={`${item.vendorId}-${index}`}
                style={[
                  vStyles.item,
                  index < data.length - 1 && vStyles.itemBorder,
                  value?.vendorId === item.vendorId && vStyles.itemSelected,
                ]}
                onPress={() => {
                  onSelect(item);
                  setVisible(false);
                }}>
                <Text style={vStyles.itemName}>{item.vendorName}</Text>
                {!!item.vendorCode && (
                  <Text style={vStyles.itemCode}>{item.vendorCode}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};
const vStyles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E6EEF6',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    backgroundColor: COLORS.colorWhite,
    justifyContent: 'space-between',
  },
  boxError: {borderColor: COLORS.ERROR ?? '#f44', borderWidth: 1.5},
  text: {
    flex: 1,
    fontSize: FontSize.fs_13 ?? 13,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
  },
  placeholder: {color: '#aaa'},
  arrow: {fontSize: 13, color: '#888', marginLeft: 6},
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  item: {paddingHorizontal: 16, paddingVertical: 14},
  itemBorder: {borderBottomWidth: 1, borderBottomColor: '#f0f0f0'},
  itemSelected: {backgroundColor: '#EEF2FF'},
  itemName: {fontSize: 14, fontFamily: FONTS.MEDIUM, color: '#1a1a1a'},
  itemCode: {
    fontSize: 11,
    fontFamily: FONTS.REGULAR,
    color: '#5C6BC0',
    marginTop: 2,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Fresh GPS — zero cache
// ─────────────────────────────────────────────────────────────────────────────
const getFreshPosition = (): Promise<GeolocationPosition> =>
  new Promise((resolve, reject) => {
    const RNGeolocation =
      require('@react-native-community/geolocation').default;
    RNGeolocation.getCurrentPosition(
      (pos: GeolocationPosition) => resolve(pos),
      (err: GeolocationPositionError) => reject(err),
      {enableHighAccuracy: true, timeout: 20000, maximumAge: 0},
    );
  });

// ─────────────────────────────────────────────────────────────────────────────
// Small reusable row: Label | Value (read-only)
// ─────────────────────────────────────────────────────────────────────────────
const InfoRow: FC<{label: string; value: string; loading?: boolean}> = ({
  label,
  value,
  loading,
}) => (
  <View style={iStyles.row}>
    <Text style={iStyles.label}>{label}</Text>
    {loading ? (
      <ActivityIndicator
        size="small"
        color={COLORS.PRIMARY}
        style={{marginLeft: 4}}
      />
    ) : (
      <Text style={iStyles.val} numberOfLines={3}>
        {value || '—'}
      </Text>
    )}
  </View>
);
const iStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    alignSelf: 'stretch',
  },
  label: {
    width: 96,
    fontSize: FontSize.fs_13 ?? 13,
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray,
    letterSpacing: 0.2,
    paddingTop: 2,
  },
  val: {
    flex: 1,
    fontSize: FontSize.fs_13 ?? 13,
    fontFamily: FONTS.REGULAR,
    color: '#444',
    lineHeight: 19,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Divider
// ─────────────────────────────────────────────────────────────────────────────
const Divider = () => (
  <View style={{height: 1, backgroundColor: '#F0F4F8', marginVertical: 2}} />
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
const AddChamberandCouplerInstallation: React.FC<
  ScreenProps.AddChamberCouplerInstallation
> = ({navigation, route}) => {
  const dispatch = useDispatch<any>();

  const {
    projectId,
    projectCode,
    projectName,
    pitLocationId,
    pitNo,
    vendorId,
    vendorCode,
    vendorName,
    shotId,
  } = route.params;

  // ── Vendors ───────────────────────────────────────────────────────────────
  const vendorList: VendorItem[] = useMemo(
    () =>
      parseVendors(
        String(vendorId ?? ''),
        String(vendorCode ?? ''),
        String(vendorName ?? ''),
      ),
    [vendorId, vendorCode, vendorName],
  );
  const isMultiVendor = vendorList.length > 1;
  const [selectedVendor, setSelectedVendor] = useState<VendorItem | null>(() =>
    vendorList.length === 1 ? vendorList[0] : null,
  );
  useEffect(() => {
    if (vendorList.length === 1) setSelectedVendor(vendorList[0]);
    else if (vendorList.length > 1) setSelectedVendor(null);
  }, [vendorList.length]);
  const [nearestPitId, setNearestPitId] = useState<number>(0);

  // ── Collapsible card ──────────────────────────────────────────────────────
  const [isExpanded, setIsExpanded] = useState(false);

  // ── GPS ───────────────────────────────────────────────────────────────────
  const [gpsLat, setGpsLat] = useState<string>('');
  const [gpsLong, setGpsLong] = useState<string>('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [locationError, setLocationError] = useState('');
  const [isLoadingGps, setIsLoadingGps] = useState(false);
  const [isInitialGpsFetch, setIsInitialGpsFetch] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Item Master Types ─────────────────────────────────────────────────────
  const [itemMasterTypes, setItemMasterTypes] = useState<ItemMasterType[]>([]);
  const [isLoadingItemTypes, setIsLoadingItemTypes] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState<{
    id: number;
    itemName: string;
  } | null>(null);

  // ── Images ────────────────────────────────────────────────────────────────
  const [pic1, setPic1] = useState<BurnResult | null>(null);
  const [pic2, setPic2] = useState<BurnResult | null>(null);

  // ── Form fields ───────────────────────────────────────────────────────────
  const [remarks, setRemarks] = useState('');
  const [ductStand, setDuctStand] = useState<{
    label: string;
    value: string;
  } | null>(null);
  // const [pccDone, setPccDone] = useState<{label: string; value: string} | null>(
  //   null,
  // );
  const [errors, setErrors] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCountingDown = countdown !== null;
  const gpsReady = !!(gpsLat && gpsLong);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchItemMasterTypes();
    // Auto-fetch GPS on mount (background, non-blocking)
    setTimeout(() => {
      fetchGPS(true);
    }, 500);
  }, []);
  useEffect(
    () => () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    },
    [],
  );

  // ── Fetch item types ──────────────────────────────────────────────────────
  const fetchItemMasterTypes = async () => {
    try {
      setIsLoadingItemTypes(true);
      const result = await dispatch(getItemMasterTypeAPi(undefined));
      if (getItemMasterTypeAPi.fulfilled.match(result)) {
        const data = result.payload as ItemMasterType[];
        if (Array.isArray(data) && data.length > 0) setItemMasterTypes(data);
        else Common.showToast('No item types found.');
      } else {
        Common.showToast(
          typeof result.payload === 'string'
            ? result.payload
            : 'Failed to load item types.',
        );
      }
    } catch {
      Common.showToast('Error fetching item types.');
    } finally {
      setIsLoadingItemTypes(false);
    }
  };

  const itemTypePickerData = itemMasterTypes.map(item => ({
    label: item.itemName,
    value: item.id,
    id: item.id,
    itemName: item.itemName,
  }));

  // ── GPS fetch ─────────────────────────────────────────────────────────────
  const fetchGPS = async (isAutoFetch = false) => {
    try {
      setIsLoadingGps(true);
      setLocationError('');
      const perm = await Location.checkPermission();
      if (perm !== 'granted') {
        if (!isAutoFetch)
          Alert.alert(
            'Permission Required',
            'Location permission is required.',
          );
        return;
      }
      let freshLat: number, freshLong: number;
      try {
        if (isAutoFetch) {
          // Faster, cached-ok fetch for auto
          const pos = await new Promise<GeolocationPosition>(
            (resolve, reject) => {
              const RNGeolocation =
                require('@react-native-community/geolocation').default;
              RNGeolocation.getCurrentPosition(
                (p: GeolocationPosition) => resolve(p),
                (e: GeolocationPositionError) => reject(e),
                {enableHighAccuracy: false, timeout: 5000, maximumAge: 60000},
              );
            },
          );
          freshLat = pos.coords.latitude;
          freshLong = pos.coords.longitude;
        } else {
          const pos = await getFreshPosition();
          if (pos.coords.accuracy > 50) {
            Alert.alert('Weak GPS', 'Please try again');
            return;
          }
          freshLat = pos.coords.latitude;
          freshLong = pos.coords.longitude;
        }
      } catch (posErr: any) {
        if (isAutoFetch) return;
        const msg =
          posErr?.code === 3
            ? 'GPS timed out. Move to an open area and try again.'
            : posErr?.code === 2
            ? 'GPS unavailable. Please enable location services.'
            : 'Could not get a fresh GPS fix. Please try again.';
        setLocationError(msg);
        Alert.alert('GPS Error', msg);
        return;
      }
      let resolvedAddress = '';
      try {
        const data = (await Location.getAddressFromLatLong(
          false,
          freshLat,
          freshLong,
        )) as any;
        if (data?.address) resolvedAddress = data.address;
      } catch {}
      setGpsLat(String(freshLat));
      setGpsLong(String(freshLong));
      if (resolvedAddress) {
        setAddress(resolvedAddress);
        if (!isAutoFetch) {
          Common.showToast('GPS updated! Now capture your photos.');
        }
      } else {
        setAddress('');
        setLocationError(
          'Address could not be resolved. Please type manually.',
        );
        Common.showToast('GPS captured. Enter address manually.');
      }
      if (!isAutoFetch && (pic1 || pic2)) {
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
      setIsLoadingGps(false);
      if (isAutoFetch) setIsInitialGpsFetch(false);
    }
  };

  const handleGetGPS = async () => {
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
        fetchGPS(false);
      }
    }, 1000);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errs: any = {};
    if (!gpsLat || !gpsLong) errs.gps = true;
    if (!address?.trim()) errs.address = true;
    if (!landmark?.trim()) errs.landmark = true;
    if (!remarks?.trim()) errs.remarks = true;
    if (!pic1) errs.image1 = true;
    if (!pic2) errs.image2 = true;
    if (!ductStand) errs.ductStand = true;
    // if (!pccDone) errs.pccDone = true;
    if (!selectedItemType) errs.itemType = true;
    if (!selectedVendor) errs.vendor = true;
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      Alert.alert('Missing Fields', 'Please fill all required fields.');
      return;
    }
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      const apiPayload = {
        id: 0,
        projectId: Number(projectId) ?? 0,
        shotId: Number(shotId) ?? 0,
        vendorId: Number(selectedVendor?.vendorId) ?? 0,
        vendorStoreId: 0,
        insidePic: pic1,
        outsidePic: pic2,
        itemId: selectedItemType?.id ?? 0,
        itemTypeId: 0,
        gpsLocation: address ?? '',
        landmark: landmark ?? '',
        lat: gpsLat ?? '',
        lon: gpsLong ?? '',
        ductStand: ductStand?.value ?? 'No',
        pccDone: 'No',
        pitLocationId: Number(pitLocationId) ?? 0,
        remark: remarks ?? '',
        ...(nearestPitId ? {existingPitId: nearestPitId} : {}),
      };

      const result = await dispatch(
        insertUpdateChamberInstallationAPI(apiPayload),
      );
      if (insertUpdateChamberInstallationAPI.fulfilled.match(result)) {
        Common.showToast('Chamber installation saved successfully!');
        navigation.goBack();
      } else {
        Alert.alert(
          'Error',
          typeof result.payload === 'string'
            ? result.payload
            : 'Failed to save. Please try again.',
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const displayVendorName =
    selectedVendor?.vendorName || vendorList[0]?.vendorName || vendorName || '';

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Screen statusBarStyle="dark" statusBgColor={COLORS.BACKGROUND_DEFAULT}>
      <View style={S.body}>
        <View style={S.main}>
          {/* ── Header ── */}
          <View style={S.header}>
            <TouchableOpacity
              style={S.headerSide}
              activeOpacity={0.7}
              onPress={() => navigation.goBack()}>
              <Image
                style={S.backIcon}
                resizeMode="contain"
                source={IMAGES.back}
              />
            </TouchableOpacity>
            <Text style={S.title}>Chamber / Coupler Installation</Text>
            <View style={S.headerSide} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={S.scrollContent}>
            {/* ═══════════════════════════════════════════════
                COLLAPSIBLE CARD — Pit No, Vendor, Landmark
            ═══════════════════════════════════════════════ */}
            <View style={C.card}>
              {/* Toggle header */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setIsExpanded(p => !p)}
                style={C.header}>
                <View style={C.headerLeft}>
                  <Text style={C.headerTitle}>Installation Details</Text>
                  {/* collapsed pills */}
                  {!isExpanded && (
                    <View style={C.pillRow}>
                      {pitNo ? (
                        <View style={C.pill}>
                          <Text style={C.pillText} numberOfLines={1}>
                            📍 Pit {pitNo}
                          </Text>
                        </View>
                      ) : null}
                      {displayVendorName ? (
                        <View style={C.pill}>
                          <Text style={C.pillText} numberOfLines={1}>
                            🏢 {displayVendorName}
                          </Text>
                        </View>
                      ) : null}
                      {gpsReady && (
                        <View style={[C.pill, C.pillGreen]}>
                          <Text style={[C.pillText, C.pillTextGreen]}>
                            ✓ GPS
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
                <View style={C.toggleBtn}>
                  <Text style={C.toggleIcon}>{isExpanded ? '▲' : '▼'}</Text>
                  <Text style={C.toggleLabel}>
                    {isExpanded ? 'Collapse' : 'Expand'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Expanded body */}
              {isExpanded && (
                <View style={C.body}>
                  {/* ── Pit No ── */}
                  <InfoRow label="Pit No." value={String(pitNo ?? '—')} />
                  <Divider />

                  {/* ── Vendor Name ── */}
                  <View style={C.fieldBlock}>
                    <Text style={C.fieldLabel}>
                      Vendor Name <Text style={C.req}>*</Text>
                    </Text>
                    {isMultiVendor ? (
                      <>
                        <VendorPicker
                          data={vendorList}
                          value={selectedVendor}
                          placeholder="Select Vendor"
                          onSelect={item => {
                            setSelectedVendor(item);
                            if (errors.vendor)
                              setErrors((e: any) => ({...e, vendor: false}));
                          }}
                          hasError={!!errors.vendor}
                        />
                        {errors.vendor && (
                          <Text style={C.errText}>
                            ⚠ Please select a vendor
                          </Text>
                        )}
                      </>
                    ) : (
                      <View style={C.readonlyBox}>
                        <Text style={C.readonlyText}>
                          {displayVendorName || '—'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* ═══════════════════════════════════════════════
                MAIN FORM CARD
                — Lat/Long row + Get GPS button (always visible)
                — Address (always visible, below GPS row)
                — Landmark
                — Item Type
                — Duct Stand & PCC Done
                — Images
                — Remarks
                — Submit
            ═══════════════════════════════════════════════ */}
            <View style={[S.formCard, {marginTop: 12}]}>
              {/* ── Lat/Long row + Get GPS button ── */}
              <View style={S.gpsRow}>
                {/* Left: lat/long display */}
                <View style={{flex: 1}}>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <Text style={S.gpsLatLngLabel}>Lat Long: </Text>
                    {isLoadingGps && isInitialGpsFetch ? (
                      <ActivityIndicator size="small" color={COLORS.PRIMARY} />
                    ) : (
                      <Text style={S.gpsLatLngValue} numberOfLines={1}>
                        {gpsReady
                          ? `${Number(gpsLat).toFixed(8)}°, ${Number(
                              gpsLong,
                            ).toFixed(8)}°`
                          : '—'}
                      </Text>
                    )}
                  </View>
                  {/* hint below */}
                  <Text style={S.gpsHint}>Tap Get GPS to update address</Text>
                </View>

                {/* Right: Get GPS button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    S.gpsBtn,
                    (isCountingDown || isLoadingGps) && S.gpsBtnDisabled,
                  ]}
                  onPress={handleGetGPS}
                  disabled={isCountingDown || isLoadingGps}>
                  {isLoadingGps && !isInitialGpsFetch ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={S.gpsBtnText}>
                      {countdown !== null ? `${countdown}s` : 'Get GPS'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Countdown bar */}
              {isCountingDown && (
                <View style={S.countdownWrap}>
                  <View style={S.countdownBg}>
                    <View
                      style={[
                        S.countdownFill,
                        {width: `${((10 - (countdown ?? 0)) / 10) * 100}%`},
                      ]}
                    />
                  </View>
                  <Text
                    style={
                      S.countdownText
                    }>{`Getting GPS in ${countdown}s…`}</Text>
                </View>
              )}

              {locationError ? (
                <Text style={S.errText}>{locationError}</Text>
              ) : null}

              {/* ── Address ── */}
              <View style={S.fieldGroup}>
                <View style={S.labelRow}>
                  <Text style={S.label}>Address</Text>
                  <Text style={S.req}> *</Text>
                </View>
                {isLoadingGps && isInitialGpsFetch ? (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.PRIMARY}
                    style={{marginTop: 4}}
                  />
                ) : (
                  <TextInput
                    style={[
                      S.textArea,
                      {minHeight: 60},
                      errors.address && S.inputErr,
                    ]}
                    value={address}
                    onChangeText={v => {
                      setAddress(v);
                      if (errors.address)
                        setErrors((e: any) => ({...e, address: false}));
                    }}
                    placeholder="Address will auto-fill after GPS fetch"
                    placeholderTextColor="#aaa"
                    multiline
                    textAlignVertical="top"
                  />
                )}
                {errors.address && (
                  <Text style={S.errText}>⚠ Address is required</Text>
                )}
              </View>

              {/* ── Landmark ── */}
              <View style={S.fieldGroup}>
                <View style={S.labelRow}>
                  <Text style={S.label}>Landmark</Text>
                  <Text style={S.req}> *</Text>
                </View>
                <TextInput
                  style={[S.inputSingle, errors.landmark && S.inputErr]}
                  value={landmark}
                  onChangeText={v => {
                    setLandmark(v);
                    if (errors.landmark)
                      setErrors((e: any) => ({...e, landmark: false}));
                  }}
                  placeholder="Enter Landmark"
                  placeholderTextColor="#aaa"
                />
                {errors.landmark && (
                  <Text style={S.errText}>⚠ Landmark is required</Text>
                )}
              </View>

              {/* ── Item Type ── */}
              <View style={S.fieldGroup}>
                <View style={S.labelRow}>
                  <Text style={S.label}>Item Type</Text>
                  <Text style={S.req}> *</Text>
                </View>
                {isLoadingItemTypes ? (
                  <View style={S.loaderRow}>
                    <ActivityIndicator size="small" color={COLORS.PRIMARY} />
                    <Text style={S.loaderText}>Loading item types…</Text>
                  </View>
                ) : (
                  <View style={errors.itemType ? S.pickerErrWrap : undefined}>
                    <DssCustomPicker
                      data={itemTypePickerData}
                      value={
                        selectedItemType
                          ? {
                              label: selectedItemType.itemName,
                              value: selectedItemType.id,
                            }
                          : null
                      }
                      placeholder="Select Item Type"
                      labelKey="label"
                      onSelect={(item: any) => {
                        const name = item.itemName?.toLowerCase().trim();
                        setSelectedItemType({
                          id: item.id,
                          itemName: item.itemName,
                        });
                        if (errors.itemType)
                          setErrors((e: any) => ({...e, itemType: false}));
                        if (name === 'existing hh' || name === 'existing mh') {
                          dispatch(getNearestPitLatLng({pitLocationId})).then(
                            (res: any) => {
                              if (getNearestPitLatLng.fulfilled.match(res)) {
                                setNearestPitId(Number(res.payload?.id) || 0);
                              }
                            },
                          );
                        } else setNearestPitId(0);
                      }}
                    />
                  </View>
                )}
                {errors.itemType && (
                  <Text style={S.errText}>⚠ Please select Item Type</Text>
                )}
              </View>

              {/* ── Duct Stand & PCC Done — side by side ── */}
              <View style={S.halfRow}>
                <View style={S.half}>
                  <View style={S.labelRow}>
                    <Text style={S.label}>Duct Stand</Text>
                    <Text style={S.req}> *</Text>
                  </View>
                  <View style={errors.ductStand ? S.pickerErrWrap : undefined}>
                    <DssCustomPicker
                      data={DUCT_STAND_OPTIONS}
                      value={ductStand}
                      placeholder="Select"
                      labelKey="label"
                      onSelect={(item: any) => {
                        setDuctStand(item);
                        if (errors.ductStand)
                          setErrors((e: any) => ({...e, ductStand: false}));
                      }}
                    />
                  </View>
                  {errors.ductStand && (
                    <Text style={S.errText}>⚠ Required</Text>
                  )}
                </View>

                {/* <View style={S.half}>
                  <View style={S.labelRow}>
                    <Text style={S.label}>PCC Done</Text>
                    <Text style={S.req}> *</Text>
                  </View>
                  <View style={errors.pccDone ? S.pickerErrWrap : undefined}>
                    <DssCustomPicker
                      data={PCC_DONE_OPTIONS}
                      value={pccDone}
                      placeholder="Select"
                      labelKey="label"
                      onSelect={(item: any) => {
                        setPccDone(item);
                        if (errors.pccDone)
                          setErrors((e: any) => ({...e, pccDone: false}));
                      }}
                    />
                  </View>
                  {errors.pccDone && <Text style={S.errText}>⚠ Required</Text>}
                </View> */}
              </View>

              {/* ── Chamber / Coupler Images ── */}
              <View style={S.fieldGroup}>
                <View style={S.labelRow}>
                  <Text style={S.label}>Chamber / Coupler Images</Text>
                  <Text style={S.req}> *</Text>
                </View>
                {(!gpsLat || !gpsLong) && (
                  <View style={S.gpsWarnSmall}>
                    <Text style={S.gpsWarnSmallText}>
                      ⚠ Get GPS first — coordinates are burned into photos.
                    </Text>
                  </View>
                )}
                <View style={S.imgRow}>
                  <View style={S.imgCol}>
                    <CaptureImageWatermark
                      title="Image 1"
                      pic={pic1}
                      setPic={result => {
                        setPic1(result);
                        if (result && errors.image1)
                          setErrors((e: any) => ({...e, image1: false}));
                      }}
                      lat={gpsLat || ''}
                      long={gpsLong || ''}
                      address={address}
                      hasError={!!errors.image1}
                    />
                    {errors.image1 && <Text style={S.errText}>⚠ Required</Text>}
                  </View>
                  <View style={S.imgCol}>
                    <CaptureImageWatermark
                      title="Image 2"
                      pic={pic2}
                      setPic={result => {
                        setPic2(result);
                        if (result && errors.image2)
                          setErrors((e: any) => ({...e, image2: false}));
                      }}
                      lat={gpsLat || ''}
                      long={gpsLong || ''}
                      address={address}
                      hasError={!!errors.image2}
                    />
                    {errors.image2 && <Text style={S.errText}>⚠ Required</Text>}
                  </View>
                </View>
              </View>

              {/* ── Remarks ── */}
              <View style={S.fieldGroup}>
                <View style={S.labelRow}>
                  <Text style={S.label}>Remarks</Text>
                  <Text style={S.req}> *</Text>
                </View>
                <TextInput
                  style={[S.textArea, errors.remarks && S.inputErr]}
                  value={remarks}
                  onChangeText={v => {
                    setRemarks(v);
                    if (errors.remarks)
                      setErrors((e: any) => ({...e, remarks: false}));
                  }}
                  placeholder="Enter Remarks"
                  placeholderTextColor="#aaa"
                  multiline
                  textAlignVertical="top"
                />
                {errors.remarks && (
                  <Text style={S.errText}>⚠ Remarks is required</Text>
                )}
              </View>

              {/* ── Submit ── */}
              <TouchableOpacity
                onPress={handleSubmit}
                activeOpacity={0.85}
                disabled={isSubmitting}
                style={[S.submitBtn, isSubmitting && S.submitBtnDisabled]}>
                {isSubmitting ? (
                  <View style={S.submitRow}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={[S.submitText, {marginLeft: 8}]}>
                      Submitting…
                    </Text>
                  </View>
                ) : (
                  <Text style={S.submitText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Screen>
  );
};

export default AddChamberandCouplerInstallation;

// ─────────────────────────────────────────────────────────────────────────────
// Collapsible card styles  (C)
// ─────────────────────────────────────────────────────────────────────────────
const C = StyleSheet.create({
  card: {
    backgroundColor: COLORS.colorWhite,
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  headerLeft: {flex: 1, gap: 6},
  headerTitle: {
    fontSize: FontSize.fs_14 ?? 14,
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray,
    letterSpacing: 0.2,
  },
  pillRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  pill: {
    backgroundColor: '#F0F4FF',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#C7D7F5',
    maxWidth: 150,
  },
  pillGreen: {backgroundColor: '#E8F5E9', borderColor: '#B2DFBB'},
  pillText: {fontSize: 10, fontFamily: FONTS.MEDIUM, color: '#3A5BA0'},
  pillTextGreen: {color: '#2E7D32'},
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexShrink: 0,
  },
  toggleIcon: {fontSize: 11, color: '#fff', fontFamily: FONTS.SEMI_BOLD},
  toggleLabel: {fontSize: 12, fontFamily: FONTS.SEMI_BOLD, color: '#fff'},
  body: {
    paddingHorizontal: 14,
    paddingBottom: 16,
    gap: 12,
  },
  errText: {
    fontSize: 12,
    color: COLORS.ERROR ?? '#f44',
    fontFamily: FONTS.REGULAR,
    marginTop: 2,
  },
  fieldBlock: {gap: 6},
  fieldLabel: {
    fontSize: FontSize.fs_13 ?? 13,
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray,
  },
  req: {color: COLORS.colorRed ?? '#f44'},
  readonlyBox: {
    borderWidth: 1,
    borderColor: '#DDE4EE',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F7F9FB',
    minHeight: 40,
    justifyContent: 'center',
  },
  readonlyText: {
    fontSize: FontSize.fs_13 ?? 13,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main form card styles  (S)
// ─────────────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: Padding.padding_16,
    paddingTop: SIZE.MS(18),
    width: '100%',
  },
  main: {flex: 1, gap: 16, alignSelf: 'stretch'},
  scrollContent: {paddingBottom: 40, gap: 0},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    height: Height.height_24 ?? 24,
  },
  headerSide: {width: 32, alignItems: 'flex-start', justifyContent: 'center'},
  backIcon: {
    width: 24,
    height: 24,
    tintColor: COLORS.colorDarkslategray ?? '#2f4f4f',
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
  // ── form card ──
  formCard: {
    backgroundColor: COLORS.colorWhite,
    borderRadius: 14,
    padding: 14,
    gap: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  // ── GPS row (lat/lng + button) ──
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gpsLatLngLabel: {
    fontSize: 13,
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray,
  },
  gpsLatLngValue: {
    fontSize: 13,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
    flexShrink: 1,
  },
  gpsHint: {
    fontSize: 10,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.PRIMARY,
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  gpsBtn: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignSelf: 'flex-end',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  gpsBtnText: {
    fontSize: 13,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#fff',
    letterSpacing: 0.3,
  },
  gpsBtnDisabled: {opacity: 0.6},
  // ── countdown ──
  countdownWrap: {gap: 4},
  countdownBg: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  countdownFill: {height: 4, backgroundColor: COLORS.PRIMARY, borderRadius: 4},
  countdownText: {
    fontSize: 11,
    color: COLORS.PRIMARY,
    fontFamily: FONTS.REGULAR,
    textAlign: 'center',
  },
  // ── GPS warn banner ──
  gpsWarnSmall: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  gpsWarnSmallText: {
    fontSize: 11,
    color: '#E65100',
    fontFamily: FONTS.REGULAR,
    lineHeight: 16,
  },
  // ── field group ──
  fieldGroup: {gap: 8},
  labelRow: {flexDirection: 'row', alignItems: 'center'},
  label: {
    fontSize: FontSize.fs_14 ?? 14,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
  },
  req: {
    color: COLORS.colorRed ?? '#f44',
    fontSize: FontSize.fs_14 ?? 14,
    fontFamily: FONTS.MEDIUM,
  },
  errText: {
    fontSize: 12,
    color: COLORS.ERROR ?? '#f44',
    fontFamily: FONTS.REGULAR,
    marginTop: 2,
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  loaderText: {fontSize: 13, color: COLORS.PRIMARY, fontFamily: FONTS.REGULAR},
  pickerErrWrap: {
    borderWidth: 1,
    borderColor: COLORS.ERROR ?? '#f44',
    borderRadius: 6,
  },
  // ── half row (duct stand + pcc done) ──
  halfRow: {flexDirection: 'row', justifyContent: 'space-between', gap: 12},
  half: {flex: 1, gap: 8},
  // ── images ──
  imgRow: {flexDirection: 'row', gap: 12},
  imgCol: {flex: 1, gap: 4},
  // ── text inputs ──
  inputSingle: {
    borderWidth: 1,
    borderColor: '#DDE4EE',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: FontSize.fs_13 ?? 13,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
    backgroundColor: COLORS.colorWhite,
    minHeight: 40,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#DDE4EE',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: FontSize.fs_14 ?? 14,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
    backgroundColor: '#FAFBFC',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputErr: {borderColor: COLORS.ERROR ?? '#f44'},
  // ── submit ──
  submitBtn: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 10,
    paddingVertical: SIZE.MS(14),
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: COLORS.PRIMARY,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  submitBtnDisabled: {opacity: 0.6},
  submitRow: {flexDirection: 'row', alignItems: 'center'},
  submitText: {
    fontSize: FontSize.fs_14 ?? 14,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#fff',
    textAlign: 'center',
  },
});
