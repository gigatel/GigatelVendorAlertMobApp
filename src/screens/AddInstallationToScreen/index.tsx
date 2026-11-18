// AddInstallationToScreen — image sending matches Java exactly (same fix as AddInstallationFrom):
// Java: bitmap → resize → watermark overlay → encodeToBase64 (plain base64 string, no prefix)
//       → addMultipartParameter("ToPic1.ImageData", base64String)  ← text param, NOT file
//       → addMultipartParameter("ToPic1.ImageExtention", "png")
//
// React Native fix: CaptureImageWatermark handles capture → watermark → BurnResult
//       → strip "data:image/png;base64," prefix → send as plain string in FormData text field
//       → NO convertImageToBase64, NO file URI upload, NO network errors from large payloads
import React, {useState, useRef, useEffect} from 'react';
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
} from 'react-native';
import {Preferences} from '@utils';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {ScreenProps, DataType} from '@types';
import {Screen} from '@organisms';
import {Location, Common} from '@utils';
import {useDispatch, useSelector} from 'react-redux';
import DssCustomPicker from '../../components/molecules/DsscustomPicker';
import {CaptureImageWatermark} from '@molecules';
import {
  getVendorListForShot,
  VendorStoreListAPI,
  insertUpdateShotToAPI,
  getColorSpecificationDDAPI,
  getItemTypeByProjectVendorAPI,
} from '@slices/dss.slice';
import {
  BoxShadow,
  LetterSpacing,
  Padding,
  Border,
  Height,
  Gap,
  LineHeight,
  FontSize,
  Width,
} from '../../res/globalStyle';
import type {BurnResult} from '../../components/molecules/capture-image-watermark/index';
// ─────────────────────────────────────────────────────────────────────────────
// Fresh GPS helper — NEVER uses cached position (maximumAge: 0)
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
// Types
// ─────────────────────────────────────────────────────────────────────────────
type DuctRow = {
  rowId: number;
  vendorStoreId: any;
  vendorStoreName: string;
  selectedStore: any;
  ductSizeList: any[];
  isLoadingDuctSize: boolean;
  selectedDuctSize: any;
  ductSizeId: string | null;
  ductSizeName: string;
  ductSizeVendorStoreId: number | null;
  ductSizeVendorStoreName: string;
  ductColorList: any[];
  isLoadingDuctColor: boolean;
  selectedDuctColor: any;
  ductColorId: number | null;
  ductColorName: string;
  ductColorQty: number | null;
  qty: number | null;
  itemTypeId: number | null;
};

const makeDuctRow = (rowId: number, store: any): DuctRow => ({
  rowId,
  vendorStoreId: store?.vendorStoreId ?? store?.storeId ?? store?.id ?? null,
  vendorStoreName:
    store?.storeName ?? store?.vendorStoreName ?? store?.name ?? '',
  selectedStore: store,
  ductSizeList: [],
  isLoadingDuctSize: false,
  selectedDuctSize: null,
  ductSizeId: null,
  ductSizeName: '',
  ductSizeVendorStoreId: null,
  ductSizeVendorStoreName: '',
  ductColorList: [],
  isLoadingDuctColor: false,
  selectedDuctColor: null,
  ductColorId: null,
  ductColorName: '',
  ductColorQty: null,
  qty: null,
  itemTypeId: null,
});

// ── AutoChip ──────────────────────────────────────────────────────────────────
type AutoChipProps = {label: string; value: string};
const AutoChip: React.FC<AutoChipProps> = ({label, value}) => (
  <View style={autoChipStyles.row}>
    <Text style={autoChipStyles.label}>{label}</Text>
    <View style={autoChipStyles.chip}>
      <Text style={autoChipStyles.chipIcon}>✓</Text>
      <Text style={autoChipStyles.chipText} numberOfLines={1}>
        {value}
      </Text>
      <View style={autoChipStyles.autoBadge}>
        <Text style={autoChipStyles.autoText}>Auto</Text>
      </View>
    </View>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
const AddInstallationToScreen: React.FC<ScreenProps.AddInstallationTo> = ({
  navigation,
  route,
}) => {
  const dispatch = useDispatch<any>();
  const {
    projectId,
    toPitLocationId,
    openShotId,
    toPitNo,
    ductCountData,
    distanceFromToPit,
    distanceFromToPitLabel,
  } = route.params;
  const {vendorListData} = useSelector((state: any) => state.dss);
  const [distanceInput, setDistanceInput] = useState('');
  // ── GPS state ─────────────────────────────────────────────────────────────
  const [gpsLat, setGpsLat] = useState<string | null>('');
  const [gpsLong, setGpsLong] = useState<string | null>('');
  const [address, setAddress] = useState<string>('');
  const [landmark, setLandmark] = useState<string>('');
  const [locationError, setLocationError] = useState('');
  const [isLoadingGps, setIsLoadingGps] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // ── Vendor / store / duct state ───────────────────────────────────────────
  const isSingleVendor = (vendorListData ?? []).length === 1;
  const [isLoadingStore, setIsLoadingStore] = useState(false);
  const [ductRows, setDuctRows] = useState<DuctRow[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [vendorStoreList, setVendorStoreList] = useState<any[]>([]);
  const [savedVendorId, setSavedVendorId] = useState<string | null>(null);
  const [savedVendorCode, setSavedVendorCode] = useState<string | null>(null);
  // ── Image state — BurnResult (plain base64 + uri for preview) ────────────
  // Matches AddInstallationFrom exactly: pic1/pic2 are BurnResult | null
  const [pic1, setPic1] = useState<BurnResult | null>(null);
  const [pic2, setPic2] = useState<BurnResult | null>(null);
  // ── Form state ────────────────────────────────────────────────────────────
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const wLat = gpsLat ?? '';
  const wLong = gpsLong ?? '';
  const isCountingDown = countdown !== null;
  // ── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(
    () => () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    },
    [],
  );
  useEffect(() => {
    const load = async () => {
      const empId = await Preferences.getData('EMPLOYEE_ID');
      dispatch(getVendorListForShot({employeeID: empId, projectId}));
    };
    load();
  }, [projectId]);
  useEffect(() => {
    if (isSingleVendor && vendorListData?.length === 1 && !selectedVendor) {
      const item = vendorListData[0];
      setSelectedVendor(item);
      setSavedVendorId(item?.vendorId ?? null);
      setSavedVendorCode(item?.vendorCode ?? null);
      fetchVendorStoreList(item?.vendorId);
    }
  }, [vendorListData]);
  // ── GPS ───────────────────────────────────────────────────────────────────
  const fetchGPS = async () => {
    try {
      setIsLoadingGps(true);
      setLocationError('');
      const perm = await Location.checkPermission();
      if (perm !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required.');
        return;
      }
      let freshLat: number;
      let freshLong: number;
      try {
        const position = await getFreshPosition();
        if (position.coords.accuracy > 50) {
          Alert.alert('Weak GPS', 'GPS is weak, Please try again');
          return;
        }
        freshLat = position.coords.latitude;
        freshLong = position.coords.longitude;
      } catch (posErr: any) {
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
        )) as DataType.GeoAddress;
        if (data?.address) resolvedAddress = data.address;
      } catch {
        resolvedAddress = '';
      }
      setGpsLat(String(freshLat));
      setGpsLong(String(freshLong));
      if (resolvedAddress) {
        setAddress(resolvedAddress);
        await Preferences.setData('LAST_GEO_ADDRESS', {
          address: resolvedAddress,
        });
        Common.showToast('GPS fetched! Now capture your PIT photos.');
      } else {
        setAddress('');
        setLocationError(
          'Address could not be resolved. Please type manually.',
        );
        Common.showToast(
          'GPS coordinates captured. Please enter address manually.',
        );
      }
      // If photos already taken, clear them so user retakes with new watermark
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
      setIsLoadingGps(false);
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
        fetchGPS();
      }
    }, 1000);
  };

  // ── API helpers ───────────────────────────────────────────────────────────
  const fetchVendorStoreList = async (vendorId: string | number) => {
    try {
      setIsLoadingStore(true);
      setVendorStoreList([]);
      setDuctRows([]);

      const result = await dispatch(
        VendorStoreListAPI({
          vendorId,
          projectId,
        }),
      );

      if (VendorStoreListAPI.fulfilled.match(result)) {
        const data: any[] = Array.isArray(result.payload) ? result.payload : [];

        setVendorStoreList(data);

        // ✅ FIXED DUCT COUNT
        let ductCount = 0;

        if (Array.isArray(ductCountData)) {
          ductCount = ductCountData.length;
        } else {
          ductCount = Number(
            ductCountData?.ductCount ??
              ductCountData?.count ??
              ductCountData ??
              0,
          );
        }

        console.log('DUCT COUNT =>', ductCount);

        // ❌ agar 0 hai toh rows mat dikhao
        if (ductCount <= 0) {
          setDuctRows([]);
          return;
        }

        // ✅ SINGLE STORE
        if (data.length === 1) {
          const store = data[0];

          const rows: DuctRow[] = [];

          for (let i = 0; i < ductCount; i++) {
            rows.push(makeDuctRow(i, store));
          }

          setDuctRows(rows);

          // ✅ har row ka size load karo
          rows.forEach(row => {
            fetchDuctSizeForRow(row.rowId, row.vendorStoreId, vendorId);
          });
        }

        // ✅ MULTIPLE STORE
        else if (data.length > 1) {
          const rows: DuctRow[] = [];

          for (let i = 0; i < ductCount; i++) {
            rows.push({
              ...makeDuctRow(i, {}),
              vendorStoreId: null,
              vendorStoreName: '',
              selectedStore: null,
            });
          }

          setDuctRows(rows);
        }
      }
    } catch (e) {
      console.log('STORE ERROR', e);
      setVendorStoreList([]);
      setDuctRows([]);
    } finally {
      setIsLoadingStore(false);
    }
  };
  const handleVendorSelect = (item: any) => {
    setSelectedVendor(item);
    setSavedVendorId(item?.vendorId ?? null);
    setSavedVendorCode(item?.vendorCode ?? null);
    if (errors.vendor) setErrors((e: any) => ({...e, vendor: false}));
    if (item?.vendorId) fetchVendorStoreList(item.vendorId);
  };
  const handleVendorStoreSelect = (rowId: number, store: any) => {
    const vendorStoreId =
      store?.vendorStoreId ?? store?.storeId ?? store?.id ?? null;

    const vendorStoreName =
      store?.storeName ?? store?.vendorStoreName ?? store?.name ?? '';

    setDuctRows(prev =>
      prev.map(r =>
        r.rowId === rowId
          ? {
              ...r,
              selectedStore: store,
              vendorStoreId,
              vendorStoreName,
              // reset dependent dropdowns
              ductSizeList: [],
              selectedDuctSize: null,
              ductSizeId: null,
              ductSizeName: '',
              ductColorList: [],
              selectedDuctColor: null,
              ductColorId: null,
              ductColorName: '',
            }
          : r,
      ),
    );
    // ✅ LOAD DUCT SIZE ON STORE SELECT
    if (vendorStoreId) {
      fetchDuctSizeForRow(rowId, vendorStoreId);
    }
  };
  const fetchDuctSizeForRow = async (
    rowId: number,
    vendorStoreId: any,
    vendorIdOverride?: any,
    storeListOverride?: any[],
  ) => {
    const vId = vendorIdOverride ?? savedVendorId;
    setDuctRows(prev =>
      prev.map(r =>
        r.rowId === rowId
          ? {...r, isLoadingDuctSize: true, ductSizeList: []}
          : r,
      ),
    );
    try {
      const result = await dispatch(
        getItemTypeByProjectVendorAPI({
          itemId: 2,
          projectId,
          vendorId: vId,
          vendorStoreId,
        }),
      );
      if (getItemTypeByProjectVendorAPI.fulfilled.match(result)) {
        const data: any[] = Array.isArray(result.payload) ? result.payload : [];
        setDuctRows(prev =>
          prev.map(r => {
            if (r.rowId !== rowId) return r;
            let updated: DuctRow = {
              ...r,
              ductSizeList: data,
              isLoadingDuctSize: false,
            };
            if (data.length === 1) {
              const item = data[0];
              updated = {
                ...updated,
                selectedDuctSize: item,
                ductSizeId: item?.id ?? null,
                ductSizeName: item?.name ?? '',
                ductSizeVendorStoreId: item?.vendorStoreId ?? null,
                ductSizeVendorStoreName: item?.vendoreStoreName ?? '',
                itemTypeId: item?.itemTypeId ?? item?.id ?? null,
              };
            }
            return updated;
          }),
        );
        if (data.length === 1) {
          const item = data[0];
          const ductSizeVsId = item?.vendorStoreId ?? vendorStoreId;
          fetchDuctColorForRow(rowId, item?.id, ductSizeVsId, item?.name, vId);
        }
      } else {
        setDuctRows(prev =>
          prev.map(r =>
            r.rowId === rowId
              ? {...r, isLoadingDuctSize: false, ductSizeList: []}
              : r,
          ),
        );
      }
    } catch {
      setDuctRows(prev =>
        prev.map(r =>
          r.rowId === rowId
            ? {...r, isLoadingDuctSize: false, ductSizeList: []}
            : r,
        ),
      );
    }
  };

  const fetchDuctColorForRow = async (
    rowId: number,
    ductSizeId: any,
    ductSizeVendorStoreId: any,
    ductSizeName: string,
    vendorIdOverride?: any,
  ) => {
    const vId = vendorIdOverride ?? savedVendorId;
    setDuctRows(prev =>
      prev.map(r =>
        r.rowId === rowId
          ? {
              ...r,
              isLoadingDuctColor: true,
              ductColorList: [],
              selectedDuctColor: null,
              ductColorId: null,
              ductColorName: '',
              ductColorQty: null,
            }
          : r,
      ),
    );
    try {
      const result = await dispatch(
        getColorSpecificationDDAPI({
          itemIdInt: 2,
          itemId: ductSizeId,
          vendorId: vId,
          vendorStoreId: ductSizeVendorStoreId,
          projectId,
          itemType: ductSizeName,
        }),
      );
      if (getColorSpecificationDDAPI.fulfilled.match(result)) {
        const data: any[] = Array.isArray(result.payload) ? result.payload : [];
        setDuctRows(prev =>
          prev.map(r => {
            if (r.rowId !== rowId) return r;
            let updated: DuctRow = {
              ...r,
              ductColorList: data,
              isLoadingDuctColor: false,
            };
            if (data.length === 1) {
              const item = data[0];
              updated = {
                ...updated,
                selectedDuctColor: item,
                ductColorId: item?.id ?? null,
                ductColorName: item?.name ?? '',
                ductColorQty: item?.qty ?? null,
                itemTypeId: item?.id ?? null,
              };
            }
            return updated;
          }),
        );
      } else {
        setDuctRows(prev =>
          prev.map(r =>
            r.rowId === rowId
              ? {...r, isLoadingDuctColor: false, ductColorList: []}
              : r,
          ),
        );
      }
    } catch {
      setDuctRows(prev =>
        prev.map(r =>
          r.rowId === rowId
            ? {...r, isLoadingDuctColor: false, ductColorList: []}
            : r,
        ),
      );
    }
  };

  const handleDuctSizeSelectForRow = (rowId: number, item: any) => {
    const ductSizeVsId = item?.vendorStoreId ?? null;
    setDuctRows(prev =>
      prev.map(r => {
        if (r.rowId !== rowId) return r;
        return {
          ...r,
          selectedDuctSize: item,
          ductSizeId: item?.id ?? null,
          ductSizeName: item?.name ?? '',
          ductSizeVendorStoreId: ductSizeVsId,
          ductSizeVendorStoreName: item?.vendoreStoreName ?? '',
          itemTypeId: item?.itemTypeId ?? item?.id ?? null,
          ductColorList: [],
          selectedDuctColor: null,
          ductColorId: null,
          ductColorName: '',
          ductColorQty: null,
        };
      }),
    );
    fetchDuctColorForRow(
      rowId,
      item?.id,
      ductSizeVsId ?? ductRows.find(r => r.rowId === rowId)?.vendorStoreId,
      item?.name ?? '',
    );
    setErrors((e: any) => ({...e, ductRows: false}));
  };

  const handleDuctColorSelectForRow = (rowId: number, item: any) => {
    setDuctRows(prev =>
      prev.map(r =>
        r.rowId === rowId
          ? {
              ...r,
              selectedDuctColor: item,
              ductColorId: item?.id ?? null,
              ductColorName: item?.name ?? '',
              ductColorQty: item?.qty ?? null,
              itemTypeId: item?.id ?? null,
            }
          : r,
      ),
    );
    setErrors((e: any) => ({...e, ductRows: false}));
  };

  const handleDistanceChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    if (/^\d*\.?\d{0,2}$/.test(cleaned)) {
      setDistanceInput(cleaned);
    }
  };

  const buildShotItemList = (): string => {
    const validRows = ductRows.filter(
      r => r.ductSizeId && r.ductColorId && r.ductColorQty && r.itemTypeId,
    );
    return JSON.stringify(
      validRows.map(r => ({
        ItemTypeId: Number(r.itemTypeId),
        Qty: Number(distanceInput),
        VendorStoreId: Number(r.ductSizeVendorStoreId ?? r.vendorStoreId ?? 0),
      })),
    );
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  // pic1 / pic2 are BurnResult: { imageData: plainBase64, imageExtention: 'png' }
  // Passed directly to insertUpdateShotToAPI FormData as text params — exactly like Java's
  // addMultipartParameter("ToPic1.ImageData", base64String)
  const handleSubmit = async () => {
    if (isSubmitting) return;
    const errs: any = {};
    if (!openShotId) errs.openShot = true;
    if (!projectId) errs.project = true;
    if (!toPitLocationId) errs.pit = true;
    if (!gpsLat || !gpsLong) errs.gps = true;
    if (!address?.trim()) errs.address = true;
    if (!selectedVendor) errs.vendor = true;
    if (!distanceInput || Number(distanceInput) <= 0) errs.distance = true;
    if (!landmark?.trim()) errs.landmark = true;
    if (!remarks?.trim()) errs.remarks = true;
    if (!pic1) errs.image1 = true;
    if (!pic2) errs.image2 = true;
    const hasIncompleteDuctRows = ductRows.some(
      r => !r.ductSizeId || !r.ductColorId,
    );
    if (ductRows.length === 0 || hasIncompleteDuctRows) errs.ductRows = true;
    const shotList = buildShotItemList();
    if (!shotList || shotList === '[]') errs.ductRows = true;

    if (!gpsLat || !gpsLong) {
      Common.showToast('Please fetch GPS first');
      return;
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      Alert.alert(
        'Missing Required Fields',
        'Please fill all mandatory fields before submitting.',
      );
      return;
    }

    const payload = {
      id: openShotId,
      projectId,
      toPitLocationId,
      toLandmark: landmark,
      Distance: Number(distanceInput),
      Distance2: Number(distanceFromToPit),
      ShotItemList: buildShotItemList(),
      toRemarks: remarks,
      toShotGPSAddress: address,
      toLat: gpsLat,
      toLng: gpsLong,
      pic1, // { imageData: plainBase64, imageExtention: 'png' }
      pic2, // { imageData: plainBase64, imageExtention: 'png' }
    };

    try {
      setIsSubmitting(true);
      const result = await dispatch(insertUpdateShotToAPI(payload));
      if (insertUpdateShotToAPI.fulfilled.match(result)) {
        Common.showToast('Shot To saved successfully!');
        navigation.goBack();
      } else {
        Alert.alert(
          'Error',
          (result.payload as string) ?? 'Failed to save. Please try again.',
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };
  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <Screen statusBarStyle="dark" statusBgColor={COLORS.BACKGROUND_DEFAULT}>
      <View style={styles.body}>
        <View style={styles.main}>
          {/* ── Header ── */}
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
            <Text style={styles.title}>
              Shot Installation — To{ductCountData}
            </Text>
            <View style={styles.headerSide} />
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            <View style={styles.card2}>
              <View style={[styles.cardBody, styles.ul4Layout]}>
                <View style={styles.li9}>
                  <View style={styles.ul3}>
                    <View style={styles.span11}>
                      <Text style={[styles.projectName, styles.shotTypo]}>
                        Shot To
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.ul4, styles.ul4Layout]}>
                    {/* ── Vendor ── */}
                    <View style={xStyles.sectionBlock}>
                      {!isSingleVendor ? (
                        <View style={styles.li}>
                          <View style={styles.span}>
                            <Text style={[styles.projectName, styles.shotTypo]}>
                              Vendor Name
                            </Text>
                            <Text style={styles.requiredTypo}> *</Text>
                          </View>
                          <DssCustomPicker
                            data={vendorListData ?? []}
                            value={selectedVendor}
                            placeholder="Select Vendor"
                            labelKey="vendorName"
                            onSelect={handleVendorSelect}
                            hasError={!!errors.vendor}
                          />
                        </View>
                      ) : (
                        selectedVendor && (
                          <AutoChip
                            label="Vendor Name"
                            value={selectedVendor?.vendorName ?? ''}
                          />
                        )
                      )}

                      {!isSingleVendor && savedVendorCode ? (
                        <View style={styles.li}>
                          <View style={styles.span}>
                            <Text style={[styles.projectName, styles.shotTypo]}>
                              Vendor Code
                            </Text>
                          </View>
                          <View style={[styles.add, styles.inputSpaceBlock]}>
                            <TextInput
                              style={styles.textInput}
                              placeholder="Auto-filled on vendor select"
                              placeholderTextColor={
                                COLORS.colorSlategray ?? '#999'
                              }
                              value={savedVendorCode ?? ''}
                              editable={false}
                            />
                          </View>
                        </View>
                      ) : isSingleVendor && savedVendorCode ? (
                        <AutoChip label="Vendor Code" value={savedVendorCode} />
                      ) : null}

                      {errors.vendor && (
                        <Text style={xStyles.errorText}>
                          ⚠ Please select a vendor
                        </Text>
                      )}
                    </View>

                    {/* ── Pit label + Get GPS button ── */}
                    <View style={styles.span12}>
                      <Text style={[styles.shotFromPit, styles.shotTypo]}>
                        Shot To Pit No.
                      </Text>
                      <Text
                        style={[
                          styles.requiredIndicator11,
                          styles.requiredTypo,
                        ]}>
                        {' '}
                        *
                      </Text>
                      <View style={[styles.liParent, styles.row2Position]}>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          style={[
                            styles.li10,
                            styles.getPitBtn,
                            isCountingDown && xStyles.btnDisabled,
                          ]}
                          onPress={handleGetGPS}
                          disabled={isCountingDown || isLoadingGps}>
                          <Text style={[styles.getGps, styles.okTypo]}>
                            {isLoadingGps
                              ? 'Fetching...'
                              : countdown !== null
                              ? `GPS... ${countdown}s`
                              : 'Get GPS'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* ── Countdown bar ── */}
                    {isCountingDown && (
                      <View style={xStyles.countdownWrap}>
                        <View style={xStyles.countdownBarBg}>
                          <View
                            style={[
                              xStyles.countdownBarFill,
                              {
                                width: `${
                                  ((10 - (countdown ?? 0)) / 10) * 100
                                }%`,
                              },
                            ]}
                          />
                        </View>
                        <Text style={xStyles.countdownText}>
                          {`Getting GPS in ${countdown}s…`}
                        </Text>
                      </View>
                    )}

                    {/* ── GPS status banner ── */}
                    {!gpsLat || !gpsLong ? (
                      <View style={xStyles.gpsWarningBanner}>
                        <Text style={xStyles.gpsWarningText}>
                          ⚠ Tap "Get GPS" first — Lat, Long & Address will be
                          permanently burned onto both photos as a watermark.
                        </Text>
                      </View>
                    ) : (
                      <View style={xStyles.gpsReadyBanner}>
                        <Text style={xStyles.gpsReadyText}>
                          ✓ GPS ready — watermark will be burned into both
                          photos
                        </Text>
                      </View>
                    )}

                    {/* ── Pit display ── */}
                    <View style={[styles.add19, styles.addBorder]}>
                      <Text
                        style={[styles.selectEntryPit, styles.addressTextTypo]}>
                        {toPitNo ? `PIT - ${toPitNo}` : '—'}
                      </Text>
                    </View>

                    {/* ── Lat / Long ── */}
                    <View style={styles.row3}>
                      <View style={styles.control}>
                        <Text style={[styles.projectName, styles.shotTypo]}>
                          Lat:
                        </Text>
                        <View style={[styles.span13, styles.li10FlexBox]}>
                          <Text style={[styles.projectName, styles.shotTypo]}>
                            {gpsLat ? `${gpsLat}°` : '—'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.control}>
                        <Text style={[styles.projectName, styles.shotTypo]}>
                          Lng:
                        </Text>
                        <View style={[styles.span13, styles.li10FlexBox]}>
                          <Text style={[styles.projectName, styles.shotTypo]}>
                            {gpsLong ? `${gpsLong}°` : '—'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* ── Address ── */}
                    <View style={styles.span15}>
                      <Text style={[styles.projectName, styles.shotTypo]}>
                        Address
                      </Text>
                      <Text style={styles.requiredTypo}> *</Text>
                    </View>
                    <View style={styles.card2}>
                      <View style={[styles.add19, styles.addBorder]}>
                        <TextInput
                          style={[
                            styles.addressTextInput,
                            styles.addressTextTypo,
                          ]}
                          value={address}
                          onChangeText={setAddress}
                          placeholder="Address will auto-fill after GPS fetch"
                          placeholderTextColor={COLORS.colorSlategray ?? '#999'}
                          multiline
                        />
                      </View>
                    </View>
                    {locationError ? (
                      <Text style={xStyles.errorText}>{locationError}</Text>
                    ) : null}

                    {/* ── Landmark ── */}
                    <View style={styles.span15}>
                      <Text style={[styles.projectName, styles.shotTypo]}>
                        Landmark
                      </Text>
                      <Text style={styles.requiredTypo}> *</Text>
                    </View>
                    <View style={[styles.add21, styles.addBorder]}>
                      <TextInput
                        style={[styles.enterLandmark, styles.addressTextTypo]}
                        value={landmark}
                        onChangeText={setLandmark}
                        placeholder="Enter Landmark"
                        placeholderTextColor={COLORS.colorSlategray ?? '#999'}
                      />
                    </View>
                    {/* ══════════════════════════════════════════════════════
                        PIT Images — CaptureImageWatermark (same as AddInstallationFrom)
                        camera button + watermark burn + preview all inside the component
                    ══════════════════════════════════════════════════════ */}
                    <View style={styles.li11}>
                      <View style={styles.span15}>
                        <Text style={[styles.projectName, styles.shotTypo]}>
                          PIT Images
                        </Text>
                        <Text style={styles.requiredTypo}> *</Text>
                      </View>

                      <View style={pitImgStyles.row}>
                        {/* ── Image 1 column ── */}
                        <View style={pitImgStyles.col}>
                          <CaptureImageWatermark
                            title="Image 1"
                            pic={pic1}
                            setPic={result => {
                              setPic1(result);
                              if (result && errors.image1)
                                setErrors((e: any) => ({
                                  ...e,
                                  image1: false,
                                }));
                            }}
                            lat={gpsLat || ''} // ✅ DIRECT
                            long={gpsLong || ''} // ✅ DIRECT
                            address={address} // already fixed
                            hasError={!!errors.image1}
                          />
                          {errors.image1 && !pic1 && (
                            <Text style={pitImgStyles.errorLabel}>
                              Image 1 is required
                            </Text>
                          )}
                        </View>

                        {/* ── Image 2 column ── */}
                        <View style={pitImgStyles.col}>
                          <CaptureImageWatermark
                            title="Image 2"
                            pic={pic2}
                            setPic={result => {
                              setPic2(result);
                              if (result && errors.image2)
                                setErrors((e: any) => ({
                                  ...e,
                                  image2: false,
                                }));
                            }}
                            lat={gpsLat || ''} // ✅ DIRECT
                            long={gpsLong || ''} // ✅ DIRECT
                            address={address} // already fixed                            hasError={!!errors.image2}
                          />
                          {errors.image2 && !pic2 && (
                            <Text style={pitImgStyles.errorLabel}>
                              Image 2 is required
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* ── Dynamic Duct Rows ── */}

                    {Number(ductCountData) > 0 && (
                      <>
                        {isLoadingStore ? (
                          <View style={xStyles.miniLoader}>
                            <ActivityIndicator
                              size="small"
                              color={COLORS.PRIMARY}
                            />
                            <Text style={xStyles.loadingRowText}>
                              Loading stores…
                            </Text>
                          </View>
                        ) : ductRows.length === 0 ? (
                          <View style={xStyles.noStoreHint}>
                            <Text style={xStyles.noStoreText}>
                              {selectedVendor
                                ? 'No vendor stores found'
                                : 'Select a vendor to load stores'}
                            </Text>
                          </View>
                        ) : (
                          <View style={{gap: 10}}>
                            {ductRows.map((row, idx) => (
                              <View
                                key={row.rowId}
                                style={[
                                  newStyles.rowCard,
                                  idx % 2 === 0
                                    ? newStyles.cardLight
                                    : newStyles.cardDark,
                                ]}>
                                {/* ── Vendor Store ── */}
                                <View style={{flex: 1.4}}>
                                  <Text style={newStyles.label}>
                                    Vendor Store {idx + 1}
                                  </Text>

                                  {vendorStoreList.length === 1 ? (
                                    <View style={newStyles.box}>
                                      <Text
                                        numberOfLines={1}
                                        style={newStyles.valueText}>
                                        {row.vendorStoreName || '—'}
                                      </Text>
                                    </View>
                                  ) : (
                                    <DssCustomPicker
                                      data={vendorStoreList}
                                      value={row.selectedStore}
                                      placeholder="Select Store"
                                      labelKey="storeName"
                                      onSelect={(item: any) =>
                                        handleVendorStoreSelect(row.rowId, item)
                                      }
                                    />
                                  )}
                                </View>

                                {/* ── Duct Size ── */}
                                <View style={{flex: 1}}>
                                  <Text style={newStyles.label}>
                                    Duct Size {idx + 1}
                                  </Text>

                                  <DssCustomPicker
                                    data={row.ductSizeList}
                                    value={row.selectedDuctSize}
                                    placeholder="Size"
                                    labelKey="name"
                                    onSelect={(item: any) =>
                                      handleDuctSizeSelectForRow(
                                        row.rowId,
                                        item,
                                      )
                                    }
                                  />
                                </View>

                                {/* ── Duct Color ── */}
                                <View style={{flex: 1}}>
                                  <Text style={newStyles.label}>
                                    Duct Color {idx + 1}
                                  </Text>

                                  <DssCustomPicker
                                    data={row.ductColorList}
                                    value={row.selectedDuctColor}
                                    placeholder="Color"
                                    labelKey="name"
                                    onSelect={(item: any) =>
                                      handleDuctColorSelectForRow(
                                        row.rowId,
                                        item,
                                      )
                                    }
                                  />
                                </View>
                              </View>
                            ))}
                          </View>
                        )}
                      </>
                    )}
                    {/* ── Distance ── */}
                    <View style={styles.ul}>
                      <View style={styles.span15}>
                        <Text style={[styles.projectName, styles.shotTypo]}>
                          Distance
                        </Text>
                        <Text style={styles.requiredTypo}> *</Text>
                      </View>
                      <View
                        style={[
                          styles.add19,
                          styles.addBorder,
                          errors.distance && xStyles.errorBorder,
                        ]}>
                        <TextInput
                          style={[styles.enterLandmark, styles.addressTextTypo]}
                          value={distanceInput}
                          onChangeText={handleDistanceChange}
                          placeholder="Enter Distance"
                          keyboardType="numeric"
                          placeholderTextColor={COLORS.colorSlategray ?? '#999'}
                        />
                      </View>
                    </View>

                    {/* ── Remarks ── */}
                    <View style={styles.ul}>
                      <View style={styles.span15}>
                        <Text style={[styles.projectName, styles.shotTypo]}>
                          Remarks
                        </Text>
                        <Text style={styles.requiredTypo}> *</Text>
                      </View>
                      <View
                        style={[
                          styles.add19,
                          styles.addBorder,
                          errors.remarks && xStyles.errorBorder,
                        ]}>
                        <TextInput
                          style={[styles.enterLandmark, styles.addressTextTypo]}
                          value={remarks}
                          onChangeText={v => {
                            setRemarks(v);
                            if (errors.remarks)
                              setErrors((e: any) => ({...e, remarks: false}));
                          }}
                          placeholder="Enter Remarks"
                          placeholderTextColor={COLORS.colorSlategray ?? '#999'}
                          multiline
                        />
                      </View>
                    </View>

                    {/* ── Submit ── */}
                    <TouchableOpacity
                      onPress={handleSubmit}
                      activeOpacity={0.85}
                      disabled={isSubmitting}
                      style={[
                        styles.li12,
                        styles.li12FlexBox,
                        isSubmitting && xStyles.btnDisabled,
                      ]}>
                      {isSubmitting ? (
                        <ActivityIndicator
                          size="small"
                          color={COLORS.colorWhite}
                        />
                      ) : (
                        <Text style={[styles.submit, styles.okTypo]}>
                          Submit
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Screen>
  );
};

export default AddInstallationToScreen;

// ─────────────────────────────────────────────────────────────────────────────
// PIT image section styles
// ─────────────────────────────────────────────────────────────────────────────
const pitImgStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Gap.gap_12,
    alignSelf: 'stretch',
  },
  col: {
    flex: 1,
    flexDirection: 'column',
    gap: Gap.gap_8,
  },
  errorLabel: {
    fontSize: FontSize.fs_11 ?? 11,
    color: COLORS.colorRed ?? '#f44336',
    fontFamily: FONTS.REGULAR,
    marginTop: 2,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// AutoChip styles
// ─────────────────────────────────────────────────────────────────────────────
const autoChipStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: Gap.gap_12,
  },
  label: {
    width: Width.width_107,
    fontSize: FontSize.fs_14,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
    letterSpacing: LetterSpacing.ls_0_2,
    textAlign: 'left',
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF6EE',
    borderRadius: Border.br_6,
    borderWidth: 1,
    borderColor: '#B2DFBB',
    paddingHorizontal: Padding.padding_8,
    paddingVertical: 5,
    minHeight: Height.height_26 ?? 26,
  },
  chipIcon: {fontSize: 11, color: '#2E7D32', fontFamily: FONTS.SEMI_BOLD},
  chipText: {
    flex: 1,
    fontSize: FontSize.fs_13,
    fontFamily: FONTS.MEDIUM,
    color: '#1B5E20',
    letterSpacing: LetterSpacing.ls_0_2,
  },
  autoBadge: {
    backgroundColor: '#C8E6C9',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  autoText: {
    fontSize: 9,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#2E7D32',
    letterSpacing: 0.3,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// xStyles (GPS / countdown / error / duct rows)
// ─────────────────────────────────────────────────────────────────────────────
const xStyles = StyleSheet.create({
  sectionBlock: {gap: Gap.gap_8 ?? 8, alignSelf: 'stretch'},
  btnDisabled: {opacity: 0.6},
  miniLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  loadingRowText: {
    fontSize: 12,
    color: COLORS.PRIMARY,
    fontFamily: FONTS.REGULAR,
  },
  noStoreHint: {paddingVertical: 10, alignItems: 'center'},
  noStoreText: {
    fontSize: 12,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
    opacity: 0.6,
  },
  countdownWrap: {marginTop: 4, marginBottom: 2, gap: 4},
  countdownBarBg: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  countdownBarFill: {
    height: 4,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 4,
  },
  countdownText: {
    fontSize: 11,
    color: COLORS.PRIMARY,
    fontFamily: FONTS.REGULAR,
    textAlign: 'center',
    marginTop: 2,
  },
  gpsWarningBanner: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  gpsReadyText: {fontSize: 12, color: '#2E7D32', fontFamily: FONTS.MEDIUM},
  errorText: {
    fontSize: 12,
    color: COLORS.ERROR ?? '#f44',
    marginTop: 2,
    fontFamily: FONTS.REGULAR,
  },
  errorBorder: {borderColor: COLORS.ERROR ?? '#f44'},
});

// ─────────────────────────────────────────────────────────────────────────────
// Main styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  shotTypo: {
    letterSpacing: LetterSpacing.ls_0_2,
    textAlign: 'left',
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
  },
  inputSpaceBlock: {
    paddingRight: Padding.padding_8,
    paddingLeft: Padding.padding_6,
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderStyle: 'solid',
    borderRadius: Border.br_6,
    minHeight: Height.height_26 ?? 26,
    alignItems: 'center',
    flexDirection: 'row',
  },
  textInput: {
    flex: 1,
    fontSize: FontSize.fs_13 ?? 13,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
    textAlign: 'left',
    paddingVertical: 0,
    paddingHorizontal: 0,
    includeFontPadding: false,
    letterSpacing: LetterSpacing.ls_0_2 ?? 0.2,
  },
  addressTextInput: {
    flex: 1,
    fontSize: FontSize.fs_14 ?? 14,
    color: COLORS.colorDarkslategray,
    paddingVertical: 4,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  row2Position: {zIndex: 2, flexDirection: 'row'},
  li12FlexBox: {
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  okTypo: {color: COLORS.colorWhite, fontFamily: FONTS.SEMI_BOLD},
  addressTextTypo: {
    lineHeight: LineHeight.lh_22,
    textAlign: 'left',
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
  },
  ul4Layout: {borderRadius: 13, backgroundColor: COLORS.colorWhite},
  requiredTypo: {
    color: COLORS.colorRed,
    textAlign: 'left',
    fontSize: FontSize.fs_14,
    fontFamily: FONTS.MEDIUM,
  },
  li10FlexBox: {
    borderRadius: Border.br_5,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  getPitBtn: {
    borderRadius: Border.br_5,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  addBorder: {
    paddingVertical: Padding.padding_8,
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderStyle: 'solid',
    borderRadius: Border.br_8,
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  body: {
    flex: 1,
    paddingHorizontal: Padding.padding_16,
    paddingTop: SIZE.MS(18),
    width: '100%',
  },
  main: {flex: 1, gap: 22, alignSelf: 'stretch'},
  scrollContent: {paddingBottom: 40},
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
  li: {
    justifyContent: 'center',
    gap: Gap.gap_12,
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  span: {width: Width.width_107, alignItems: 'center', flexDirection: 'row'},
  projectName: {textAlign: 'left', fontSize: FontSize.fs_14},
  add: {backgroundColor: COLORS.colorWhitesmoke, flex: 1},
  card2: {alignSelf: 'stretch'},
  cardBody: {
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    flexDirection: 'row',
  },
  li9: {
    borderRadius: 14,
    backgroundColor: COLORS.colorAliceblue,
    overflow: 'hidden',
    flex: 1,
  },
  ul3: {
    paddingVertical: 10,
    paddingHorizontal: Padding.padding_12,
    alignSelf: 'stretch',
  },
  span11: {width: 93, justifyContent: 'center', alignItems: 'center'},
  ul4: {padding: Padding.padding_12, alignSelf: 'stretch', gap: Gap.gap_12},
  span12: {alignItems: 'center', flexDirection: 'row', alignSelf: 'stretch'},
  shotFromPit: {textAlign: 'left', fontSize: FontSize.fs_14, zIndex: 0},
  requiredIndicator11: {zIndex: 1},
  liParent: {
    marginTop: -13,
    top: '50%',
    right: 0,
    gap: Gap.gap_10,
    position: 'absolute',
  },
  li10: {
    paddingHorizontal: Padding.padding_6,
    paddingVertical: 5,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    zIndex: 0,
  },
  getGps: {fontSize: FontSize.fs_14, textAlign: 'left'},
  add19: {
    paddingHorizontal: Padding.padding_12,
    backgroundColor: COLORS.colorWhite,
    alignItems: 'center',
  },
  selectEntryPit: {fontSize: FontSize.fs_14, flex: 1},
  row3: {width: 324, flexDirection: 'column'},
  control: {
    gap: Gap.gap_5,
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
  },
  span13: {
    height: Height.height_18,
    paddingHorizontal: Padding.padding_4,
    borderStyle: 'solid',
    borderRadius: Border.br_5,
  },
  span15: {alignItems: 'center', flexDirection: 'row', alignSelf: 'stretch'},
  add21: {
    paddingHorizontal: Padding.padding_12,
    backgroundColor: COLORS.colorWhite,
  },
  enterLandmark: {opacity: 1, fontSize: FontSize.fs_14, flex: 1},
  li11: {gap: Gap.gap_8, alignSelf: 'stretch'},
  ul: {gap: Gap.gap_12, alignSelf: 'stretch'},
  li12FlexBox: {
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  li12: {
    paddingHorizontal: SIZE.MS(20),
    paddingVertical: SIZE.MS(13),
    borderRadius: Border.br_8,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    alignSelf: 'stretch',
  },
  submit: {textAlign: 'center', fontSize: FontSize.fs_14},
});

// ─────────────────────────────────────────────────────────────────────────────
// Duct row styles
// ─────────────────────────────────────────────────────────────────────────────
const newStyles = StyleSheet.create({
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
  },
  cardLight: {backgroundColor: '#E3F2FD'},
  cardDark: {backgroundColor: '#E0F2F1'},
  label: {
    fontSize: 11,
    color: '#555',
    marginBottom: 3,
    fontFamily: FONTS.MEDIUM,
  },
  box: {
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  valueText: {fontSize: 12, fontFamily: FONTS.MEDIUM, color: '#333'},
});
