import {useState, useEffect, useRef} from 'react';
import {
  Text,
  ScrollView,
  StyleSheet,
  View,
  Image,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {BackHeader, CaptureImageWatermark} from '@molecules';
import {ScreenProps} from '@types';
import {Preferences, Location, Common} from '@utils';
import DssCustomPicker from '../../components/molecules/DsscustomPicker';
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
import {
  getVendorListForShot,
  getMachineListForShot,
  getVendorLocatorListAPI,
  shotTypeListAPI,
  VendorStoreListAPI,
  insertUpdateShotFromAPI,
  getItemTypeByProjectVendorAPI,
  getColorSpecificationDDAPI,
  getProjectIDuctCountAPI,
} from '@slices/dss.slice';
import {Screen} from '@organisms';
import {useDispatch, useSelector} from 'react-redux';
import {DataType} from '@types';
import React from 'react';
import type {BurnResult} from '../../components/molecules/capture-image-watermark/index';
// ── BurnResult is imported from CaptureImageWatermark ─────────────────────────
// { imageData: string (plain base64, no prefix), imageExtention: 'png' }

const CHAMBER_OPTIONS = [
  {id: 1, name: 'Chamber'},
  {id: 2, name: 'Coupler'},
];

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

// ── Main Screen ───────────────────────────────────────────────────────────────
const AddInstallationFrom: React.FC<ScreenProps.AddInstallationFrom> = ({
  navigation,
  route,
}) => {
  const dispatch = useDispatch<any>();
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [selectedMachine, setSelectedMachine] = useState<any>(null);
  const [selectedOperator, setSelectedOperator] = useState<any>(null);
  const [selectedLocator, setSelectedLocator] = useState<any>(null);
  const [savedShotTypeId, setSavedShotTypeId] = useState<number | null>(null);
  const [savedShotTypeName, setSavedShotTypeName] = useState<string>('');
  const [isTopCardExpanded, setIsTopCardExpanded] = useState(false);

  const [selectedChamber, setSelectedChamber] = useState<any>(
    CHAMBER_OPTIONS[0],
  );
  const [savedChamberId, setSavedChamberId] = useState<number>(
    CHAMBER_OPTIONS[0].id,
  );
  const [savedChamberName, setSavedChamberName] = useState<string>(
    CHAMBER_OPTIONS[0].name,
  );
  const [savedVendorId, setSavedVendorId] = useState<string | null>(null);
  const [savedVendorCode, setSavedVendorCode] = useState<string | null>(null);
  const [savedMachineId, setSavedMachineId] = useState<string | null>(null);
  const [savedOperatorId, setSavedOperatorId] = useState<string | null>(null);
  const [savedLocatorId, setSavedLocatorId] = useState<string | null>(null);
  const [vendorStoreList, setVendorStoreList] = useState<any[]>([]);
  const [isLoadingStore, setIsLoadingStore] = useState(false);
  const [ductRows, setDuctRows] = useState<DuctRow[]>([]);
  const [ductCountData, setDuctCountData] = useState<any>(null);
  const [isLoadingDuctCount, setIsLoadingDuctCount] = useState(false);
  // const [gpsLat, setGpsLat] = useState<string | null>('');
  // const [gpsLong, setGpsLong] = useState<string | null>('');
  // const [address, setAddress] = useState('');
  // const [landmark, setLandmark] = useState('');
  //only for testing
  const [gpsLat, setGpsLat] = useState<string | null>('');
  const [gpsLong, setGpsLong] = useState<string | null>('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [isLoadingGps, setIsLoadingGps] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [locationError, setLocationError] = useState('');
  // ── Image state — BurnResult (plain base64) from CaptureImageWatermark ────
  const [pic1, setPic1] = useState<BurnResult | null>(null);
  const [pic2, setPic2] = useState<BurnResult | null>(null);
  //
  const [distanceMeters, setDistanceMeters] = useState('');
  const [noOfDucts, setNoOfDucts] = useState('');
  const [remarks, setRemarks] = useState('');
  const debounceRef = useRef<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<any>({});

  const {
    vendorListData,
    machineListData,
    vendorLocatorListData,
    shotTypeListData,
  } = useSelector((state: any) => state.dss);

  const {
    projectName,
    projectCode,
    pitLocationId,
    pitNo,
    projectId,
    vendorName,
    vendorCode,
    userLat,
    userLng,
    spRoute,
    epRoute,
    startPitId,
    startPitNo,
    startPitLat,
    startPitLng,
    endPitId,
    endPitNo,
    endPitLat,
    endPitLng,
    distanceFromPrevPit,
    distanceFromPrevPitLabel,
    distanceFromStartPit,
    distanceFromEndPit,
    distanceBetweenPits,
    distanceBetweenPitsLabel,
    operatorId,
    locatorId,
    machineId,
  } = route.params;

  const prevPitNo = startPitNo;
  const prevPitLat = startPitLat;
  const prevPitLng = startPitLng;
  const nextPitNo = endPitNo;
  const nextPitId = endPitId;
  const nextPitLat = endPitLat;
  const nextPitLng = endPitLng;

  const distanceFromStartPitLabel =
    distanceFromStartPit != null
      ? `${Math.round(Number(distanceFromStartPit))} m`
      : '';
  const distanceFromEndPitLabel: string =
    distanceFromEndPit != null && !isNaN(Number(distanceFromEndPit))
      ? `${Math.round(Number(distanceFromEndPit))} m`
      : '';

  const displayFromPitNo: string = String(prevPitNo || pitNo || '—');

  // const wLat = gpsLat ?? '';
  // const wLong = gpsLong ?? '';

  const isSingleVendor = (vendorListData ?? []).length === 1;
  const isSingleMachine = (machineListData ?? []).length === 1;
  const isShotTypeAutoSelected = !!(
    shotTypeListData?.length > 0 && savedShotTypeId
  );

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(
    () => () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    },
    [],
  );
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);
  useEffect(() => {
    if (vendorLocatorListData?.length > 0 && !selectedOperator) {
      // agar route.params se operator id aa rhi hai
      const incomingOperatorId = route?.params?.operatorId;

      if (incomingOperatorId) {
        const matchedOperator = vendorLocatorListData.find(
          (item: any) => String(item?.id) === String(incomingOperatorId),
        );

        if (matchedOperator) {
          setSelectedOperator(matchedOperator);
          setSavedOperatorId(matchedOperator?.id ?? null);
        }
      }

      // agar sirf ek hi operator hai toh auto select
      else if (vendorLocatorListData.length === 1) {
        const item = vendorLocatorListData[0];

        setSelectedOperator(item);
        setSavedOperatorId(item?.id ?? null);
      }
    }
  }, [vendorLocatorListData]);
  useEffect(() => {
    if (vendorLocatorListData?.length > 0 && !selectedLocator) {
      const incomingLocatorId = route?.params?.locatorId;

      if (incomingLocatorId) {
        const matchedLocator = vendorLocatorListData.find(
          (item: any) => String(item?.id) === String(incomingLocatorId),
        );

        if (matchedLocator) {
          setSelectedLocator(matchedLocator);
          setSavedLocatorId(matchedLocator?.id ?? null);
        }
      }
    }
  }, [vendorLocatorListData]);

  useEffect(() => {
    if (projectId) fetchDuctCount();
  }, [projectId]);

  useEffect(() => {
    const load = async () => {
      const empId = await Preferences.getData('EMPLOYEE_ID');
      dispatch(getVendorListForShot({employeeID: empId, projectId}));
      dispatch(shotTypeListAPI({}));
    };
    load();
  }, [projectId]);

  useEffect(() => {
    if (machineListData?.length > 0 && !selectedMachine) {
      // route.params se machine id
      const incomingMachineId = route?.params?.machineId;
      // incoming machine id match karo
      if (incomingMachineId) {
        const matchedMachine = machineListData.find(
          (item: any) => String(item?.machineId) === String(incomingMachineId),
        );
        if (matchedMachine) {
          setSelectedMachine(matchedMachine);
          setSavedMachineId(matchedMachine?.machineId ?? null);
        }
      }
      // agar ek hi machine hai toh auto select
      else if (machineListData.length === 1) {
        const item = machineListData[0];
        setSelectedMachine(item);
        setSavedMachineId(item?.machineId ?? null);
      }
    }
  }, [machineListData]);

  useEffect(() => {
    if (distanceFromPrevPit != null && Number(distanceFromPrevPit) > 0) {
      setDistanceMeters(String(Math.round(Number(distanceFromPrevPit))));
    } else {
      const d = Number(distanceFromStartPit ?? distanceBetweenPits ?? 0);
      if (d > 0) setDistanceMeters(String(Math.round(d)));
    }
  }, []);

  useEffect(() => {
    if (isSingleVendor && vendorListData?.length === 1 && !selectedVendor) {
      const item = vendorListData[0];
      setSelectedVendor(item);
      setSavedVendorId(item?.vendorId ?? null);
      setSavedVendorCode(item?.vendorCode ?? null);
    }
  }, [vendorListData]);
  useEffect(() => {
    if (isSingleMachine && machineListData?.length === 1) {
      const item = machineListData[0];
      setSelectedMachine(item);
      setSavedMachineId(item?.machineId ?? null);
    }
  }, [machineListData]);
  useEffect(() => {
    if (shotTypeListData && shotTypeListData.length > 0) {
      const defaultIdx = shotTypeListData.length > 1 ? 1 : 0;
      const item = shotTypeListData[defaultIdx];
      setSavedShotTypeId(item?.id ?? null);
      setSavedShotTypeName(item?.name ?? '');
    }
  }, [shotTypeListData]);

  useEffect(() => {
    if (!selectedVendor?.vendorId) return;
    setSelectedMachine(null);
    setSavedMachineId(null);
    setSelectedOperator(null);
    setSavedOperatorId(null);
    setSelectedLocator(null);
    setSavedLocatorId(null);
    setVendorStoreList([]);
    setDuctRows([]);
    setDuctCountData(null);
    dispatch(getMachineListForShot({vendorId: selectedVendor.vendorId}));
    dispatch(getVendorLocatorListAPI({vendorId: selectedVendor.vendorId}));
    fetchVendorStoreList(selectedVendor.vendorId);
  }, [selectedVendor]);
  // ── API helpers ───────────────────────────────────────────────────────────
  const fetchVendorStoreList = async (vendorId: string | number) => {
    try {
      setIsLoadingStore(true);
      setVendorStoreList([]);
      setDuctRows([]);
      const result = await dispatch(VendorStoreListAPI({vendorId, projectId}));
      if (VendorStoreListAPI.fulfilled.match(result)) {
        const data: any[] = Array.isArray(result.payload) ? result.payload : [];
        setVendorStoreList(data);
        const initialRows: DuctRow[] = data.map((store, idx) =>
          makeDuctRow(idx, store),
        );
        setDuctRows(initialRows);
        initialRows.forEach(row => {
          if (row.vendorStoreId != null) {
            fetchDuctSizeForRow(row.rowId, row.vendorStoreId, vendorId, data);
          }
        });
      }
    } catch {
      setVendorStoreList([]);
      setDuctRows([]);
    } finally {
      setIsLoadingStore(false);
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
            }
          : r,
      ),
    );
    setErrors((e: any) => ({...e, ductRows: false}));
  };

  const fetchDuctCount = async (ductValue?: number) => {
    if (!projectId) return;
    try {
      setIsLoadingDuctCount(true);
      const result = await dispatch(
        getProjectIDuctCountAPI({
          projectId,
          numberOfDucts: ductValue ?? Number(noOfDucts) ?? 0,
        }),
      );
      if (getProjectIDuctCountAPI.fulfilled.match(result)) {
        const response = result.payload ?? [];
        const countValue = Array.isArray(response) ? response[0] : response;
        setDuctCountData(countValue);
        if (!noOfDucts && countValue !== undefined) {
          setNoOfDucts(String(countValue));
        }
      }
    } finally {
      setIsLoadingDuctCount(false);
    }
  };

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

  // ── Dropdown handlers ─────────────────────────────────────────────────────
  const handleVendorSelect = (item: any) => {
    setSelectedVendor(item);
    setSavedVendorId(item?.vendorId ?? null);
    setSavedVendorCode(item?.vendorCode ?? null);
    if (errors.vendor) setErrors((e: any) => ({...e, vendor: false}));
  };
  const handleMachineSelect = (item: any) => {
    setSelectedMachine(item);
    setSavedMachineId(item?.machineId ?? null);
    if (errors.machine) setErrors((e: any) => ({...e, machine: false}));
  };
  const handleOperatorSelect = (item: any) => {
    setSelectedOperator(item);
    setSavedOperatorId(item?.id ?? null);
    if (errors.operator) setErrors((e: any) => ({...e, operator: false}));
  };
  const handleLocatorSelect = (item: any) => {
    setSelectedLocator(item);
    setSavedLocatorId(item?.id ?? null);
    if (errors.locator) setErrors((e: any) => ({...e, locator: false}));
  };
  const handleChamberSelect = (item: any) => {
    setSelectedChamber(item);
    setSavedChamberId(item?.id ?? null);
    setSavedChamberName(item?.name ?? '');
    if (errors.chamber) setErrors((e: any) => ({...e, chamber: false}));
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (isSubmitting) return;

    const errs: any = {};

    if (!savedVendorId) errs.vendor = true;
    if (!savedMachineId) errs.machine = true;
    if (!savedOperatorId) errs.operator = true;
    if (!savedLocatorId) errs.locator = true;
    if (!savedShotTypeId) errs.shotType = true;
    if (!savedChamberId) errs.chamber = true;

    if (!pic1) errs.image1 = true;
    if (!pic2) errs.image2 = true;

    // ✅ No. of ducts validation
    if (!noOfDucts || Number(noOfDucts) <= 0) {
      errs.noOfDucts = true;
    }

    if (!gpsLat || !gpsLong) {
      Common.showToast('Please fetch GPS first');
      return;
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);

      // ✅ Separate toast for no of ducts
      if (errs.noOfDucts) {
        Common.showToast('Number of ducts must be greater than 0');
      } else {
        Common.showToast('Please fill all required fields');
      }

      return;
    }

    const primaryRow = ductRows[0];

    const payload = {
      id: 0,
      projectId,
      vendorId: savedVendorId,
      machineId: savedMachineId,
      locatorId: savedLocatorId,
      operatorId: savedOperatorId,
      pitLocationId,
      pitNo,
      shotTypeId: savedShotTypeId,
      shotTypeName: savedShotTypeName,
      chamberType: savedChamberName,
      chamberName: savedChamberName,
      fromUserLat: userLat ?? null,
      fromUserLng: userLng ?? null,
      lat: gpsLat,
      lng: gpsLong,
      fromLat: gpsLat,
      fromLng: gpsLong,
      prevPitNo,
      prevPitLat,
      prevPitLng,

      nextPitNo,
      nextPitId,
      nextPitLat,
      nextPitLng,

      startPitId,
      startPitNo,
      startPitLat,
      startPitLng,

      endPitId,
      endPitNo,
      endPitLat,
      endPitLng,

      distanceFromPrevPit,
      distanceFromPrevPitLabel,

      distanceFromStartPit,
      distanceFromStartPitLabel,

      distanceFromEndPit,
      distanceFromEndPitLabel,

      distanceBetweenPits,
      distanceBetweenPitsLabel,

      distanceInMeters: distanceMeters ? Number(distanceMeters) : 0,

      // ✅ never send 0 or empty
      numberOfDucts: Number(noOfDucts),

      fromLandmark: landmark,
      landmark,

      gpsAddress: address,
      address,

      remarks,

      vendorStoreId: primaryRow?.vendorStoreId ?? null,

      vendorStoreName: primaryRow?.vendorStoreName ?? '',

      ductSizeId: primaryRow?.ductSizeId ?? null,

      ductSizeName: primaryRow?.ductSizeName ?? '',

      ductSizeVendorStoreId: primaryRow?.ductSizeVendorStoreId ?? null,

      ductSizeVendorStoreName: primaryRow?.ductSizeVendorStoreName ?? '',

      ductColorId: primaryRow?.ductColorId ?? null,

      ductColorName: primaryRow?.ductColorName ?? '',

      ductColorQty: primaryRow?.ductColorQty ?? null,

      sendId: 0,

      // Images
      pic1,
      pic2,
    };

    try {
      setIsSubmitting(true);

      const result = await dispatch(insertUpdateShotFromAPI(payload));

      if (insertUpdateShotFromAPI.fulfilled.match(result)) {
        Common.showToast('Shot From saved successfully!');

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

  const isCountingDown = countdown !== null;

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
            <Text style={styles.title}>Shot Installation — From</Text>
            <View style={styles.headerSide} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            <View style={styles.holidaybody}>
              <View style={styles.holiday}>
                {/* ═══ TOP CARD (EXPANDABLE) ═══ */}
                <View style={[styles.holidayitem, styles.li10ShadowBox]}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => setIsTopCardExpanded(prev => !prev)}
                    style={topCardStyles.toggleRow}>
                    <View style={topCardStyles.toggleTitleWrap}>
                      <Text style={topCardStyles.toggleTitle}>
                        Shot Setup Details
                      </Text>
                      {!isTopCardExpanded && (
                        <View style={topCardStyles.summaryRow}>
                          {projectName && (
                            <View style={topCardStyles.summaryChip}>
                              <Text style={topCardStyles.summaryChipText}>
                                Project Name: {projectName}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                    <View style={topCardStyles.toggleBadge}>
                      <Text style={topCardStyles.toggleIcon}>
                        {isTopCardExpanded ? '▲' : '▼'}
                      </Text>
                      <Text style={topCardStyles.toggleLabel}>
                        {isTopCardExpanded ? 'Collapse' : 'Expand'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {isTopCardExpanded && (
                    <View style={[styles.ul, {marginTop: Gap.gap_12}]}>
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
                            <Text style={styles.requiredTypo}> *</Text>
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

                      {!isSingleMachine ? (
                        <View style={styles.li}>
                          <View style={styles.span}>
                            <Text style={[styles.projectName, styles.shotTypo]}>
                              Machine ID
                            </Text>
                            <Text style={styles.requiredTypo}> *</Text>
                          </View>
                          <DssCustomPicker
                            data={machineListData ?? []}
                            value={selectedMachine}
                            placeholder={
                              selectedVendor
                                ? 'Select Machine'
                                : 'Select Vendor First'
                            }
                            labelKey="machineName"
                            onSelect={handleMachineSelect}
                            hasError={!!errors.machine}
                            disabled={!selectedVendor}
                          />
                        </View>
                      ) : (
                        selectedMachine && (
                          <AutoChip
                            label="Machine ID"
                            value={selectedMachine?.machineName ?? ''}
                          />
                        )
                      )}

                      <View style={styles.li}>
                        <View style={styles.span}>
                          <Text style={[styles.projectName, styles.shotTypo]}>
                            Operator Name
                          </Text>
                          <Text style={styles.requiredTypo}> *</Text>
                        </View>
                        <DssCustomPicker
                          data={vendorLocatorListData ?? []}
                          value={selectedOperator}
                          placeholder={
                            selectedVendor
                              ? 'Select Operator'
                              : 'Select Vendor First'
                          }
                          labelKey="name"
                          onSelect={handleOperatorSelect}
                          hasError={!!errors.operator}
                          disabled={!selectedVendor}
                        />
                      </View>

                      <View style={styles.li}>
                        <View style={styles.span}>
                          <Text style={[styles.projectName, styles.shotTypo]}>
                            Locator Name
                          </Text>
                          <Text style={styles.requiredTypo}> *</Text>
                        </View>
                        <DssCustomPicker
                          data={vendorLocatorListData ?? []}
                          value={selectedLocator}
                          placeholder={
                            selectedVendor
                              ? 'Select Locator'
                              : 'Select Vendor First'
                          }
                          labelKey="name"
                          onSelect={handleLocatorSelect}
                          hasError={!!errors.locator}
                          disabled={!selectedVendor}
                        />
                      </View>

                      <View style={styles.card}>
                        <View style={[styles.add7, styles.ul4SpaceBlock]}>
                          <View style={styles.float}>
                            <Text style={[styles.shotDetails, styles.shotTypo]}>
                              Shot Details
                            </Text>
                          </View>

                          <View style={styles.row}>
                            <View style={styles.col}>
                              <View style={styles.span7}>
                                <Text
                                  style={[
                                    styles.shotTypeLabel,
                                    styles.shotTypo,
                                  ]}>
                                  Shot Type
                                </Text>
                                <Text style={styles.requiredTypo}> *</Text>
                              </View>
                              {isShotTypeAutoSelected &&
                              (shotTypeListData ?? []).length <= 1 ? (
                                <View style={autoChipStyles.inlineChip}>
                                  <Text style={autoChipStyles.inlineChipIcon}>
                                    ✓
                                  </Text>
                                  <Text
                                    style={autoChipStyles.inlineChipText}
                                    numberOfLines={1}>
                                    {savedShotTypeName}
                                  </Text>
                                  <View style={autoChipStyles.autoBadge}>
                                    <Text style={autoChipStyles.autoText}>
                                      Auto
                                    </Text>
                                  </View>
                                </View>
                              ) : (
                                <View style={styles.reducedPickerWrap}>
                                  <DssCustomPicker
                                    data={shotTypeListData ?? []}
                                    value={
                                      shotTypeListData?.find(
                                        (x: any) => x.id === savedShotTypeId,
                                      ) || null
                                    }
                                    placeholder="Select Shot Type"
                                    labelKey="name"
                                    onSelect={(item: any) => {
                                      setSavedShotTypeId(item?.id ?? null);
                                      setSavedShotTypeName(item?.name ?? '');
                                      if (errors.shotType)
                                        setErrors((e: any) => ({
                                          ...e,
                                          shotType: false,
                                        }));
                                    }}
                                    hasError={!!errors.shotType}
                                  />
                                </View>
                              )}
                            </View>

                            <View style={styles.col}>
                              <View style={styles.span7}>
                                <Text
                                  style={[
                                    styles.shotTypeLabel,
                                    styles.shotTypo,
                                  ]}>
                                  Chamber/Coupler
                                </Text>
                                <Text style={styles.requiredTypo}> *</Text>
                              </View>
                              <View style={styles.reducedPickerWrap}>
                                <DssCustomPicker
                                  data={CHAMBER_OPTIONS}
                                  value={selectedChamber}
                                  placeholder="Select"
                                  labelKey="name"
                                  onSelect={handleChamberSelect}
                                  hasError={!!errors.chamber}
                                />
                              </View>
                            </View>
                          </View>

                          <View style={[styles.row2, styles.row2Position]}>
                            <View style={styles.col}>
                              <View style={styles.span7}>
                                <Text
                                  style={[
                                    styles.shotTypeLabel,
                                    styles.shotTypo,
                                  ]}>
                                  No. of Ducts
                                </Text>
                                <Text style={styles.requiredTypo}> *</Text>
                              </View>
                              <View style={[styles.group, styles.groupFlexBox]}>
                                <View style={[styles.add11, styles.addBorder1]}>
                                  <TextInput
                                    style={styles.textInput}
                                    placeholder="0"
                                    keyboardType="numeric"
                                    value={
                                      ductCountData !== null
                                        ? String(ductCountData)
                                        : ''
                                    }
                                    onChangeText={v => {
                                      const clean = v.replace(/[^0-9]/g, '');
                                      setDuctCountData(
                                        clean ? Number(clean) : null,
                                      );
                                      setNoOfDucts(clean);
                                    }}
                                  />
                                </View>
                              </View>
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>
                  )}
                </View>

                {/* ═══ SHOT FROM CARD ═══ */}
                <View style={styles.card2}>
                  <View style={[styles.cardBody, styles.ul4Layout]}>
                    <View style={styles.li9}>
                      <View style={styles.ul3}>
                        <View style={[styles.span11, styles.groupFlexBox]}>
                          <Text style={[styles.projectName, styles.shotTypo]}>
                            Shot From
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.ul4, styles.ul4Layout]}>
                        <View style={styles.span12}>
                          <Text style={[styles.shotFromPit, styles.shotTypo]}>
                            Shot From Pit No.
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

                        {!gpsLat || !gpsLong ? (
                          <View style={xStyles.gpsWarningBanner}>
                            <Text style={xStyles.gpsWarningText}>
                              ⚠ Tap "Get GPS" first — Lat, Long & Address will
                              be permanently burned onto both photos as a
                              watermark.
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

                        <View style={[styles.add19, styles.addBorder]}>
                          <Text
                            style={[
                              styles.selectEntryPit,
                              styles.addressTextTypo,
                            ]}>
                            {displayFromPitNo
                              ? `PIT - ${displayFromPitNo}`
                              : '—'}
                          </Text>
                        </View>

                        <View style={styles.row3}>
                          <View style={styles.control}>
                            <Text style={[styles.projectName, styles.shotTypo]}>
                              Lat:
                            </Text>
                            <View style={[styles.span13, styles.li10FlexBox]}>
                              <Text
                                style={[styles.projectName, styles.shotTypo]}>
                                {gpsLat ? `${gpsLat}°` : '—'}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.control}>
                            <Text style={[styles.projectName, styles.shotTypo]}>
                              Lng:
                            </Text>
                            <View style={[styles.span13, styles.li10FlexBox]}>
                              <Text
                                style={[styles.projectName, styles.shotTypo]}>
                                {gpsLong ? `${gpsLong}°` : '—'}
                              </Text>
                            </View>
                          </View>
                        </View>

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
                              placeholderTextColor={
                                COLORS.colorSlategray ?? '#999'
                              }
                              multiline
                            />
                          </View>
                        </View>
                        {locationError ? (
                          <Text style={xStyles.errorText}>{locationError}</Text>
                        ) : null}
                        <View style={styles.span15}>
                          <Text style={[styles.projectName, styles.shotTypo]}>
                            Landmark
                          </Text>
                          <Text style={styles.requiredTypo}> *</Text>
                        </View>
                        <View style={[styles.add21, styles.addBorder]}>
                          <TextInput
                            style={[
                              styles.enterLandmark,
                              styles.addressTextTypo,
                            ]}
                            value={landmark}
                            onChangeText={setLandmark}
                            placeholder="Enter Landmark"
                            placeholderTextColor={
                              COLORS.colorSlategray ?? '#999'
                            }
                          />
                        </View>

                        {/* ── PIT Images — using CaptureImageWatermark ── */}
                        <View style={styles.li11}>
                          <View style={styles.label}>
                            <View style={styles.span15}>
                              <Text
                                style={[styles.projectName, styles.shotTypo]}>
                                PIT Images
                              </Text>
                              <Text style={styles.requiredTypo}> *</Text>
                            </View>
                          </View>
                          <View style={styles.row4}>
                            <View style={styles.col11}>
                              {/* CaptureImageWatermark handles camera + burn + preview */}
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
                            </View>
                            <View style={styles.col11}>
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
                                address={address} // already fixed
                                hasError={!!errors.image2}
                              />
                            </View>
                          </View>
                        </View>

                        <View style={styles.ul}>
                          <View style={styles.span15}>
                            <Text style={[styles.projectName, styles.shotTypo]}>
                              Remarks
                            </Text>
                            <Text style={styles.requiredTypo}> *</Text>
                          </View>
                          <View style={[styles.add19, styles.addBorder]}>
                            <TextInput
                              style={[
                                styles.enterLandmark,
                                styles.addressTextTypo,
                              ]}
                              value={remarks}
                              onChangeText={setRemarks}
                              placeholder="Enter Remarks"
                              placeholderTextColor={
                                COLORS.colorSlategray ?? '#999'
                              }
                              multiline
                            />
                          </View>
                        </View>

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
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Screen>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
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
  inlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EEF6EE',
    borderRadius: Border.br_6,
    borderWidth: 1,
    borderColor: '#B2DFBB',
    paddingHorizontal: Padding.padding_8,
    paddingVertical: 5,
    minHeight: Height.height_26 ?? 26,
    width: '100%',
  },
  inlineChipIcon: {fontSize: 11, color: '#2E7D32', fontFamily: FONTS.SEMI_BOLD},
  inlineChipText: {
    flex: 1,
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.MEDIUM,
    color: '#1B5E20',
    letterSpacing: LetterSpacing.ls_0_2,
  },
});

const xStyles = StyleSheet.create({
  btnDisabled: {opacity: 0.6},
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
});

const topCardStyles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  toggleTitleWrap: {flex: 1, gap: 6},
  toggleTitle: {
    fontSize: FontSize.fs_14,
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray,
    letterSpacing: LetterSpacing.ls_0_2 ?? 0.2,
  },
  summaryRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2},
  summaryChip: {
    backgroundColor: '#EEF6EE',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#B2DFBB',
  },
  summaryChipText: {fontSize: 10, fontFamily: FONTS.MEDIUM, color: '#2E7D32'},
  toggleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    flexShrink: 0,
  },
  toggleIcon: {
    fontSize: FontSize.fs_14,
    color: '#fff',
    fontFamily: FONTS.SEMI_BOLD,
  },
  toggleLabel: {
    fontSize: FontSize.fs_14,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#fff',
  },
});

const styles = StyleSheet.create({
  titleClr: {color: COLORS.colorDarkslategray, fontFamily: FONTS.MEDIUM},
  li10ShadowBox: {elevation: 3, boxShadow: BoxShadow.shadow_drop},
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
  ul4SpaceBlock: {padding: Padding.padding_12, alignSelf: 'stretch'},
  row2Position: {zIndex: 2, flexDirection: 'row'},
  addBorder1: {
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderStyle: 'solid',
    backgroundColor: COLORS.colorWhite,
  },
  groupFlexBox: {gap: Gap.gap_6, flexDirection: 'row'},
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
  holidaybody: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignSelf: 'stretch',
    backgroundColor: COLORS.BACKGROUND_DEFAULT,
  },
  holiday: {gap: 16, flex: 1},
  holidayitem: {
    paddingVertical: Padding.padding_16,
    maxWidth: 430,
    paddingHorizontal: Padding.padding_12,
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
    overflow: 'hidden',
    width: '100%',
  },
  ul: {gap: Gap.gap_12, alignSelf: 'stretch'},
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
  card: {paddingTop: 11, alignSelf: 'stretch'},
  add7: {
    gap: Gap.gap_8,
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderStyle: 'solid',
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
  },
  float: {
    top: -11,
    left: SIZE.MS(12),
    borderRadius: SIZE.MS(15),
    paddingHorizontal: 0,
    paddingVertical: SIZE.MS(3),
    backgroundColor: COLORS.colorWhite,
    position: 'absolute',
    zIndex: 0,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  shotDetails: {fontSize: FontSize.fs_12, textAlign: 'left'},
  row: {
    gap: Gap.gap_8,
    zIndex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  col: {gap: Gap.gap_8, flex: 1},
  span7: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
    flexDirection: 'row',
  },
  shotTypeLabel: {fontSize: FontSize.fs_13, textAlign: 'left'},
  reducedPickerWrap: {width: '100%', alignSelf: 'flex-start'},
  row2: {gap: Gap.gap_8, alignItems: 'flex-start', alignSelf: 'stretch'},
  group: {alignSelf: 'stretch'},
  add11: {
    paddingVertical: Padding.padding_2,
    borderRadius: Border.br_6,
    height: Height.height_26,
    paddingHorizontal: Padding.padding_12,
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
  },
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
  li11: {gap: Gap.gap_12, alignSelf: 'stretch'},
  label: {justifyContent: 'center', alignSelf: 'stretch'},
  row4: {gap: Gap.gap_12, flexDirection: 'row', alignSelf: 'stretch', flex: 1},
  col11: {gap: Gap.gap_12, flex: 1},
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

export default AddInstallationFrom;
// #Latest addinstallionfromscreen code
// import {useState, useEffect, useRef} from 'react';
// import {
//   Text,
//   ScrollView,
//   StyleSheet,
//   View,
//   Image,
//   TouchableOpacity,
//   TextInput,
//   Alert,
//   ActivityIndicator,
// } from 'react-native';
// import {COLORS, FONTS, IMAGES, SIZE} from '@res';
// import {CaptureImageWatermark} from '@molecules';
// import {ScreenProps} from '@types';
// import {Preferences, Location, Common} from '@utils';
// import DssCustomPicker from '../../components/molecules/DsscustomPicker';
// import NetInfo from '@react-native-community/netinfo';
// import {
//   BoxShadow,
//   LetterSpacing,
//   Padding,
//   Border,
//   Height,
//   Gap,
//   LineHeight,
//   FontSize,
//   Width,
// } from '../../res/globalStyle';
// import {
//   getVendorListForShot,
//   getMachineListForShot,
//   getVendorLocatorListAPI,
//   shotTypeListAPI,
//   VendorStoreListAPI,
//   insertUpdateShotFromAPI,
//   getItemTypeByProjectVendorAPI,
//   getColorSpecificationDDAPI,
//   getProjectIDuctCountAPI,
// } from '@slices/dss.slice';
// import {Screen} from '@organisms';
// import {useDispatch, useSelector} from 'react-redux';
// import {DataType} from '@types';
// import React from 'react';
// import type {BurnResult} from '../../components/molecules/capture-image-watermark/index';

// const CHAMBER_OPTIONS = [
//   {id: 1, name: 'Chamber'},
//   {id: 2, name: 'Coupler'},
// ];

// const OFFLINE_SHOT_FROM_DATA = 'OFFLINE_SHOT_FROM_DATA';
// const SUBMIT_TIMEOUT_MS = 15000;

// const getFreshPosition = (): Promise<GeolocationPosition> =>
//   new Promise((resolve, reject) => {
//     const RNGeolocation =
//       require('@react-native-community/geolocation').default;
//     RNGeolocation.getCurrentPosition(
//       (pos: GeolocationPosition) => resolve(pos),
//       (err: GeolocationPositionError) => reject(err),
//       {enableHighAccuracy: true, timeout: 20000, maximumAge: 0},
//     );
//   });

// type DuctRow = {
//   rowId: number;
//   vendorStoreId: any;
//   vendorStoreName: string;
//   selectedStore: any;
//   ductSizeList: any[];
//   isLoadingDuctSize: boolean;
//   selectedDuctSize: any;
//   ductSizeId: string | null;
//   ductSizeName: string;
//   ductSizeVendorStoreId: number | null;
//   ductSizeVendorStoreName: string;
//   ductColorList: any[];
//   isLoadingDuctColor: boolean;
//   selectedDuctColor: any;
//   ductColorId: number | null;
//   ductColorName: string;
//   ductColorQty: number | null;
// };

// const makeDuctRow = (rowId: number, store: any): DuctRow => ({
//   rowId,
//   vendorStoreId: store?.vendorStoreId ?? store?.storeId ?? store?.id ?? null,
//   vendorStoreName:
//     store?.storeName ?? store?.vendorStoreName ?? store?.name ?? '',
//   selectedStore: store,
//   ductSizeList: [],
//   isLoadingDuctSize: false,
//   selectedDuctSize: null,
//   ductSizeId: null,
//   ductSizeName: '',
//   ductSizeVendorStoreId: null,
//   ductSizeVendorStoreName: '',
//   ductColorList: [],
//   isLoadingDuctColor: false,
//   selectedDuctColor: null,
//   ductColorId: null,
//   ductColorName: '',
//   ductColorQty: null,
// });

// // ── AutoChip ──────────────────────────────────────────────────────────────────
// type AutoChipProps = {label: string; value: string};
// const AutoChip: React.FC<AutoChipProps> = ({label, value}) => (
//   <View style={autoChipStyles.row}>
//     <Text style={autoChipStyles.label}>{label}</Text>
//     <View style={autoChipStyles.chip}>
//       <Text style={autoChipStyles.chipIcon}>✓</Text>
//       <Text style={autoChipStyles.chipText} numberOfLines={1}>
//         {value}
//       </Text>
//       <View style={autoChipStyles.autoBadge}>
//         <Text style={autoChipStyles.autoText}>Auto</Text>
//       </View>
//     </View>
//   </View>
// );

// // ── Main Screen ───────────────────────────────────────────────────────────────
// const AddInstallationFrom: React.FC<ScreenProps.AddInstallationFrom> = ({
//   navigation,
//   route,
// }) => {
//   const dispatch = useDispatch<any>();

//   const [selectedVendor, setSelectedVendor] = useState<any>(null);
//   const [selectedMachine, setSelectedMachine] = useState<any>(null);
//   const [selectedOperator, setSelectedOperator] = useState<any>(null);
//   const [selectedLocator, setSelectedLocator] = useState<any>(null);

//   const [savedShotTypeId, setSavedShotTypeId] = useState<number | null>(null);
//   const [savedShotTypeName, setSavedShotTypeName] = useState<string>('');

//   // ── FIX: saveShotFromOffline — Preferences.getData is async, must be awaited
//   const saveShotFromOffline = async (payload: any) => {
//     try {
//       const oldData = (await Preferences.getData(OFFLINE_SHOT_FROM_DATA)) ?? [];
//       const list = Array.isArray(oldData) ? oldData : [];
//       await Preferences.setData(OFFLINE_SHOT_FROM_DATA, [
//         ...list,
//         {
//           params: payload,
//           createdAt: new Date().toISOString(),
//         },
//       ]);
//     } catch (err) {
//       Common.error('saveShotFromOffline failed', err);
//     }
//   };
//   const checkOfflineData = async () => {
//     const data = await Preferences.getData(OFFLINE_SHOT_FROM_DATA);
//     console.log('📦 [SCREEN] Offline Stored Data:', data);
//   };
//   const submitShotOnlineWithTimeout = (payload: any) =>
//     Promise.race([
//       dispatch(insertUpdateShotFromAPI(payload)),
//       new Promise((_, reject) =>
//         setTimeout(
//           () => reject(new Error('Request timeout')),
//           SUBMIT_TIMEOUT_MS,
//         ),
//       ),
//     ]);

//   const [isTopCardExpanded, setIsTopCardExpanded] = useState(false);

//   const [selectedChamber, setSelectedChamber] = useState<any>(
//     CHAMBER_OPTIONS[0],
//   );
//   const [savedChamberId, setSavedChamberId] = useState<number>(
//     CHAMBER_OPTIONS[0].id,
//   );
//   const [savedChamberName, setSavedChamberName] = useState<string>(
//     CHAMBER_OPTIONS[0].name,
//   );
//   const [savedVendorId, setSavedVendorId] = useState<string | null>(null);
//   const [savedVendorCode, setSavedVendorCode] = useState<string | null>(null);
//   const [savedMachineId, setSavedMachineId] = useState<string | null>(null);
//   const [savedOperatorId, setSavedOperatorId] = useState<string | null>(null);
//   const [savedLocatorId, setSavedLocatorId] = useState<string | null>(null);
//   const [vendorStoreList, setVendorStoreList] = useState<any[]>([]);
//   const [isLoadingStore, setIsLoadingStore] = useState(false);
//   const [ductRows, setDuctRows] = useState<DuctRow[]>([]);
//   const [ductCountData, setDuctCountData] = useState<any>(null);
//   const [isLoadingDuctCount, setIsLoadingDuctCount] = useState(false);
//   const [gpsLat, setGpsLat] = useState<string | null>('28.541720900191947');
//   const [gpsLong, setGpsLong] = useState<string | null>('77.25467633917383');
//   const [address, setAddress] = useState('Gigatel Solutions');
//   const [landmark, setLandmark] = useState('yes bank');
//   const [isLoadingGps, setIsLoadingGps] = useState(false);
//   const [countdown, setCountdown] = useState<number | null>(null);
//   const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
//   const [locationError, setLocationError] = useState('');

//   // ── Image state — BurnResult (plain base64 + uri for preview) ────────────
//   const [pic1, setPic1] = useState<BurnResult | null>(null);
//   const [pic2, setPic2] = useState<BurnResult | null>(null);

//   const [distanceMeters, setDistanceMeters] = useState('');
//   const [noOfDucts, setNoOfDucts] = useState('');
//   const [remarks, setRemarks] = useState('');
//   const debounceRef = useRef<any>(null);
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [errors, setErrors] = useState<any>({});

//   const {
//     vendorListData,
//     machineListData,
//     vendorLocatorListData,
//     shotTypeListData,
//   } = useSelector((state: any) => state.dss);

//   const {
//     projectName,
//     projectCode,
//     pitLocationId,
//     pitNo,
//     projectId,
//     vendorName,
//     vendorCode,
//     userLat,
//     userLng,
//     spRoute,
//     epRoute,
//     startPitId,
//     startPitNo,
//     startPitLat,
//     startPitLng,
//     endPitId,
//     endPitNo,
//     endPitLat,
//     endPitLng,
//     distanceFromPrevPit,
//     distanceFromPrevPitLabel,
//     distanceFromStartPit,
//     distanceFromEndPit,
//     distanceBetweenPits,
//     distanceBetweenPitsLabel,
//   } = route.params;

//   const prevPitNo = startPitNo;
//   const prevPitLat = startPitLat;
//   const prevPitLng = startPitLng;
//   const nextPitNo = endPitNo;
//   const nextPitId = endPitId;
//   const nextPitLat = endPitLat;
//   const nextPitLng = endPitLng;

//   const distanceFromStartPitLabel =
//     distanceFromStartPit != null
//       ? `${Math.round(Number(distanceFromStartPit))} m`
//       : '';
//   const distanceFromEndPitLabel: string =
//     distanceFromEndPit != null && !isNaN(Number(distanceFromEndPit))
//       ? `${Math.round(Number(distanceFromEndPit))} m`
//       : '';

//   const displayFromPitNo: string = String(prevPitNo || pitNo || '—');

//   const wLat = gpsLat ?? '';
//   const wLong = gpsLong ?? '';

//   const isSingleVendor = (vendorListData ?? []).length === 1;
//   const isSingleMachine = (machineListData ?? []).length === 1;
//   const isShotTypeAutoSelected = !!(
//     shotTypeListData?.length > 0 && savedShotTypeId
//   );

//   // ── Lifecycle ─────────────────────────────────────────────────────────────
//   useEffect(
//     () => () => {
//       if (countdownRef.current) clearInterval(countdownRef.current);
//     },
//     [],
//   );
//   useEffect(() => {
//     return () => {
//       if (debounceRef.current) clearTimeout(debounceRef.current);
//     };
//   }, []);
//   useEffect(() => {
//     checkOfflineData();
//   }, []);
//   useEffect(() => {
//     if (projectId) fetchDuctCount();
//   }, [projectId]);

//   useEffect(() => {
//     const load = async () => {
//       const empId = await Preferences.getData('EMPLOYEE_ID');
//       dispatch(getVendorListForShot({employeeID: empId, projectId}));
//       dispatch(shotTypeListAPI({}));
//     };
//     load();
//   }, [projectId]);

//   useEffect(() => {
//     if (distanceFromPrevPit != null && Number(distanceFromPrevPit) > 0) {
//       setDistanceMeters(String(Math.round(Number(distanceFromPrevPit))));
//     } else {
//       const d = Number(distanceFromStartPit ?? distanceBetweenPits ?? 0);
//       if (d > 0) setDistanceMeters(String(Math.round(d)));
//     }
//   }, []);

//   useEffect(() => {
//     if (isSingleVendor && vendorListData?.length === 1 && !selectedVendor) {
//       const item = vendorListData[0];
//       setSelectedVendor(item);
//       setSavedVendorId(item?.vendorId ?? null);
//       setSavedVendorCode(item?.vendorCode ?? null);
//     }
//   }, [vendorListData]);

//   useEffect(() => {
//     if (isSingleMachine && machineListData?.length === 1) {
//       const item = machineListData[0];
//       setSelectedMachine(item);
//       setSavedMachineId(item?.machineId ?? null);
//     }
//   }, [machineListData]);

//   useEffect(() => {
//     if (shotTypeListData && shotTypeListData.length > 0) {
//       const defaultIdx = shotTypeListData.length > 1 ? 1 : 0;
//       const item = shotTypeListData[defaultIdx];
//       setSavedShotTypeId(item?.id ?? null);
//       setSavedShotTypeName(item?.name ?? '');
//     }
//   }, [shotTypeListData]);

//   useEffect(() => {
//     if (!selectedVendor?.vendorId) return;
//     setSelectedMachine(null);
//     setSavedMachineId(null);
//     setSelectedOperator(null);
//     setSavedOperatorId(null);
//     setSelectedLocator(null);
//     setSavedLocatorId(null);
//     setVendorStoreList([]);
//     setDuctRows([]);
//     setDuctCountData(null);
//     dispatch(getMachineListForShot({vendorId: selectedVendor.vendorId}));
//     dispatch(getVendorLocatorListAPI({vendorId: selectedVendor.vendorId}));
//     fetchVendorStoreList(selectedVendor.vendorId);
//   }, [selectedVendor]);

//   // ── API helpers ───────────────────────────────────────────────────────────
//   const fetchVendorStoreList = async (vendorId: string | number) => {
//     try {
//       setIsLoadingStore(true);
//       setVendorStoreList([]);
//       setDuctRows([]);
//       const result = await dispatch(VendorStoreListAPI({vendorId, projectId}));
//       if (VendorStoreListAPI.fulfilled.match(result)) {
//         const data: any[] = Array.isArray(result.payload) ? result.payload : [];
//         setVendorStoreList(data);
//         const initialRows: DuctRow[] = data.map((store, idx) =>
//           makeDuctRow(idx, store),
//         );
//         setDuctRows(initialRows);
//         initialRows.forEach(row => {
//           if (row.vendorStoreId != null) {
//             fetchDuctSizeForRow(row.rowId, row.vendorStoreId, vendorId, data);
//           }
//         });
//       }
//     } catch {
//       setVendorStoreList([]);
//       setDuctRows([]);
//     } finally {
//       setIsLoadingStore(false);
//     }
//   };

//   const fetchDuctSizeForRow = async (
//     rowId: number,
//     vendorStoreId: any,
//     vendorIdOverride?: any,
//     storeListOverride?: any[],
//   ) => {
//     const vId = vendorIdOverride ?? savedVendorId;
//     setDuctRows(prev =>
//       prev.map(r =>
//         r.rowId === rowId
//           ? {...r, isLoadingDuctSize: true, ductSizeList: []}
//           : r,
//       ),
//     );
//     try {
//       const result = await dispatch(
//         getItemTypeByProjectVendorAPI({
//           itemId: 2,
//           projectId,
//           vendorId: vId,
//           vendorStoreId,
//         }),
//       );
//       if (getItemTypeByProjectVendorAPI.fulfilled.match(result)) {
//         const data: any[] = Array.isArray(result.payload) ? result.payload : [];
//         setDuctRows(prev =>
//           prev.map(r => {
//             if (r.rowId !== rowId) return r;
//             let updated: DuctRow = {
//               ...r,
//               ductSizeList: data,
//               isLoadingDuctSize: false,
//             };
//             if (data.length === 1) {
//               const item = data[0];
//               updated = {
//                 ...updated,
//                 selectedDuctSize: item,
//                 ductSizeId: item?.id ?? null,
//                 ductSizeName: item?.name ?? '',
//                 ductSizeVendorStoreId: item?.vendorStoreId ?? null,
//                 ductSizeVendorStoreName: item?.vendoreStoreName ?? '',
//               };
//             }
//             return updated;
//           }),
//         );
//         if (data.length === 1) {
//           const item = data[0];
//           const ductSizeVsId = item?.vendorStoreId ?? vendorStoreId;
//           fetchDuctColorForRow(rowId, item?.id, ductSizeVsId, item?.name, vId);
//         }
//       } else {
//         setDuctRows(prev =>
//           prev.map(r =>
//             r.rowId === rowId
//               ? {...r, isLoadingDuctSize: false, ductSizeList: []}
//               : r,
//           ),
//         );
//       }
//     } catch {
//       setDuctRows(prev =>
//         prev.map(r =>
//           r.rowId === rowId
//             ? {...r, isLoadingDuctSize: false, ductSizeList: []}
//             : r,
//         ),
//       );
//     }
//   };

//   const fetchDuctColorForRow = async (
//     rowId: number,
//     ductSizeId: any,
//     ductSizeVendorStoreId: any,
//     ductSizeName: string,
//     vendorIdOverride?: any,
//   ) => {
//     const vId = vendorIdOverride ?? savedVendorId;
//     setDuctRows(prev =>
//       prev.map(r =>
//         r.rowId === rowId
//           ? {
//               ...r,
//               isLoadingDuctColor: true,
//               ductColorList: [],
//               selectedDuctColor: null,
//               ductColorId: null,
//               ductColorName: '',
//               ductColorQty: null,
//             }
//           : r,
//       ),
//     );
//     try {
//       const result = await dispatch(
//         getColorSpecificationDDAPI({
//           itemIdInt: 2,
//           itemId: ductSizeId,
//           vendorId: vId,
//           vendorStoreId: ductSizeVendorStoreId,
//           projectId,
//           itemType: ductSizeName,
//         }),
//       );
//       if (getColorSpecificationDDAPI.fulfilled.match(result)) {
//         const data: any[] = Array.isArray(result.payload) ? result.payload : [];
//         setDuctRows(prev =>
//           prev.map(r => {
//             if (r.rowId !== rowId) return r;
//             let updated: DuctRow = {
//               ...r,
//               ductColorList: data,
//               isLoadingDuctColor: false,
//             };
//             if (data.length === 1) {
//               const item = data[0];
//               updated = {
//                 ...updated,
//                 selectedDuctColor: item,
//                 ductColorId: item?.id ?? null,
//                 ductColorName: item?.name ?? '',
//                 ductColorQty: item?.qty ?? null,
//               };
//             }
//             return updated;
//           }),
//         );
//       } else {
//         setDuctRows(prev =>
//           prev.map(r =>
//             r.rowId === rowId
//               ? {...r, isLoadingDuctColor: false, ductColorList: []}
//               : r,
//           ),
//         );
//       }
//     } catch {
//       setDuctRows(prev =>
//         prev.map(r =>
//           r.rowId === rowId
//             ? {...r, isLoadingDuctColor: false, ductColorList: []}
//             : r,
//         ),
//       );
//     }
//   };

//   const handleDuctSizeSelectForRow = (rowId: number, item: any) => {
//     const ductSizeVsId = item?.vendorStoreId ?? null;
//     setDuctRows(prev =>
//       prev.map(r => {
//         if (r.rowId !== rowId) return r;
//         return {
//           ...r,
//           selectedDuctSize: item,
//           ductSizeId: item?.id ?? null,
//           ductSizeName: item?.name ?? '',
//           ductSizeVendorStoreId: ductSizeVsId,
//           ductSizeVendorStoreName: item?.vendoreStoreName ?? '',
//           ductColorList: [],
//           selectedDuctColor: null,
//           ductColorId: null,
//           ductColorName: '',
//           ductColorQty: null,
//         };
//       }),
//     );
//     fetchDuctColorForRow(
//       rowId,
//       item?.id,
//       ductSizeVsId ?? ductRows.find(r => r.rowId === rowId)?.vendorStoreId,
//       item?.name ?? '',
//     );
//     setErrors((e: any) => ({...e, ductRows: false}));
//   };

//   const handleDuctColorSelectForRow = (rowId: number, item: any) => {
//     setDuctRows(prev =>
//       prev.map(r =>
//         r.rowId === rowId
//           ? {
//               ...r,
//               selectedDuctColor: item,
//               ductColorId: item?.id ?? null,
//               ductColorName: item?.name ?? '',
//               ductColorQty: item?.qty ?? null,
//             }
//           : r,
//       ),
//     );
//     setErrors((e: any) => ({...e, ductRows: false}));
//   };

//   const fetchDuctCount = async (ductValue?: number) => {
//     if (!projectId) return;
//     try {
//       setIsLoadingDuctCount(true);
//       const result = await dispatch(
//         getProjectIDuctCountAPI({
//           projectId,
//           numberOfDucts: ductValue ?? Number(noOfDucts) ?? 0,
//         }),
//       );
//       if (getProjectIDuctCountAPI.fulfilled.match(result)) {
//         const response = result.payload ?? [];
//         const countValue = Array.isArray(response) ? response[0] : response;
//         setDuctCountData(countValue);
//         if (!noOfDucts && countValue !== undefined) {
//           setNoOfDucts(String(countValue));
//         }
//       }
//     } finally {
//       setIsLoadingDuctCount(false);
//     }
//   };

//   // ── GPS ───────────────────────────────────────────────────────────────────
//   const fetchGPS = async () => {
//     try {
//       setIsLoadingGps(true);
//       setLocationError('');
//       const perm = await Location.checkPermission();
//       if (perm !== 'granted') {
//         Alert.alert('Permission Required', 'Location permission is required.');
//         return;
//       }
//       let freshLat: number;
//       let freshLong: number;
//       try {
//         const position = await getFreshPosition();
//         if (position.coords.accuracy > 50) {
//           Alert.alert('Weak GPS', 'GPS is weak, Please try again');
//           return;
//         }
//         freshLat = position.coords.latitude;
//         freshLong = position.coords.longitude;
//       } catch (posErr: any) {
//         const msg =
//           posErr?.code === 3
//             ? 'GPS timed out. Move to an open area and try again.'
//             : posErr?.code === 2
//             ? 'GPS unavailable. Please enable location services.'
//             : 'Could not get a fresh GPS fix. Please try again.';
//         setLocationError(msg);
//         Alert.alert('GPS Error', msg);
//         return;
//       }

//       let resolvedAddress = '';
//       try {
//         const data = (await Location.getAddressFromLatLong(
//           false,
//           freshLat,
//           freshLong,
//         )) as DataType.GeoAddress;
//         if (data?.address) resolvedAddress = data.address;
//       } catch {
//         resolvedAddress = '';
//       }

//       setGpsLat(String(freshLat));
//       setGpsLong(String(freshLong));

//       if (resolvedAddress) {
//         setAddress(resolvedAddress);
//         await Preferences.setData('LAST_GEO_ADDRESS', {
//           address: resolvedAddress,
//         });

//         Common.showToast('GPS fetched! Now capture your PIT photos.');
//       } else {
//         setAddress('');
//         setLocationError(
//           'Address could not be resolved. Please type manually.',
//         );
//         Common.showToast(
//           'GPS coordinates captured. Please enter address manually.',
//         );
//       }

//       if (pic1 || pic2) {
//         Alert.alert(
//           'GPS Updated',
//           'Please retake photos to update the watermark.',
//           [{text: 'OK'}],
//         );
//         setPic1(null);
//         setPic2(null);
//       }
//     } catch (e: any) {
//       setLocationError(e?.message || 'Location error');
//     } finally {
//       setIsLoadingGps(false);
//     }
//   };

//   const handleGetGPS = async () => {
//     const perm = await Location.checkPermission();
//     if (perm !== 'granted') {
//       Alert.alert('Permission Required', 'Location permission is required.');
//       return;
//     }
//     if (countdownRef.current) clearInterval(countdownRef.current);
//     setCountdown(10);
//     let remaining = 10;
//     countdownRef.current = setInterval(() => {
//       remaining -= 1;
//       setCountdown(remaining);
//       if (remaining <= 0) {
//         clearInterval(countdownRef.current!);
//         countdownRef.current = null;
//         setCountdown(null);
//         fetchGPS();
//       }
//     }, 1000);
//   };

//   // ── Dropdown handlers ─────────────────────────────────────────────────────
//   const handleVendorSelect = (item: any) => {
//     setSelectedVendor(item);
//     setSavedVendorId(item?.vendorId ?? null);
//     setSavedVendorCode(item?.vendorCode ?? null);
//     if (errors.vendor) setErrors((e: any) => ({...e, vendor: false}));
//   };
//   const handleMachineSelect = (item: any) => {
//     setSelectedMachine(item);
//     setSavedMachineId(item?.machineId ?? null);
//     if (errors.machine) setErrors((e: any) => ({...e, machine: false}));
//   };
//   const handleOperatorSelect = (item: any) => {
//     setSelectedOperator(item);
//     setSavedOperatorId(item?.id ?? null);
//     if (errors.operator) setErrors((e: any) => ({...e, operator: false}));
//   };
//   const handleLocatorSelect = (item: any) => {
//     setSelectedLocator(item);
//     setSavedLocatorId(item?.id ?? null);
//     if (errors.locator) setErrors((e: any) => ({...e, locator: false}));
//   };
//   const handleChamberSelect = (item: any) => {
//     setSelectedChamber(item);
//     setSavedChamberId(item?.id ?? null);
//     setSavedChamberName(item?.name ?? '');
//     if (errors.chamber) setErrors((e: any) => ({...e, chamber: false}));
//   };

//   // ── Submit ────────────────────────────────────────────────────────────────
//   const handleSubmit = async () => {
//     if (isSubmitting) return;
//     const errs: any = {};
//     if (!savedVendorId) errs.vendor = true;
//     if (!savedMachineId) errs.machine = true;
//     if (!savedOperatorId) errs.operator = true;
//     if (!savedLocatorId) errs.locator = true;
//     if (!savedShotTypeId) errs.shotType = true;
//     if (!savedChamberId) errs.chamber = true;
//     if (ductRows.length === 0) errs.ductRows = true;
//     if (!pic1) errs.image1 = true;
//     if (!pic2) errs.image2 = true;
//     if (!gpsLat || !gpsLong) {
//       Common.showToast('Please fetch GPS first');
//       return;
//     }
//     if (Object.keys(errs).length > 0) {
//       setErrors(errs);
//       Common.showToast('Please fill all required fields');
//       return;
//     }

//     const primaryRow = ductRows[0];

//     const payload = {
//       id: 0,
//       projectId,
//       vendorId: savedVendorId,
//       machineId: savedMachineId,
//       locatorId: savedLocatorId,
//       operatorId: savedOperatorId,
//       pitLocationId,
//       pitNo,
//       shotTypeId: savedShotTypeId,
//       shotTypeName: savedShotTypeName,
//       chamberType: savedChamberName,
//       chamberName: savedChamberName,
//       fromUserLat: userLat ?? null,
//       fromUserLng: userLng ?? null,
//       lat: gpsLat,
//       lng: gpsLong,
//       fromLat: gpsLat,
//       fromLng: gpsLong,
//       prevPitNo,
//       prevPitLat,
//       prevPitLng,
//       nextPitNo,
//       nextPitId,
//       nextPitLat,
//       nextPitLng,
//       startPitId,
//       startPitNo,
//       startPitLat,
//       startPitLng,
//       endPitId,
//       endPitNo,
//       endPitLat,
//       endPitLng,
//       distanceFromPrevPit,
//       distanceFromPrevPitLabel,
//       distanceFromStartPit,
//       distanceFromStartPitLabel,
//       distanceFromEndPit,
//       distanceFromEndPitLabel,
//       distanceBetweenPits,
//       distanceBetweenPitsLabel,
//       distanceInMeters: distanceMeters ? Number(distanceMeters) : 0,
//       numberOfDucts: noOfDucts ? Number(noOfDucts) : 0,
//       fromLandmark: landmark,
//       landmark,
//       gpsAddress: address,
//       address,
//       remarks,
//       vendorStoreId: primaryRow?.vendorStoreId ?? null,
//       vendorStoreName: primaryRow?.vendorStoreName ?? '',
//       ductSizeId: primaryRow?.ductSizeId ?? null,
//       ductSizeName: primaryRow?.ductSizeName ?? '',
//       ductSizeVendorStoreId: primaryRow?.ductSizeVendorStoreId ?? null,
//       ductSizeVendorStoreName: primaryRow?.ductSizeVendorStoreName ?? '',
//       ductColorId: primaryRow?.ductColorId ?? null,
//       ductColorName: primaryRow?.ductColorName ?? '',
//       ductColorQty: primaryRow?.ductColorQty ?? null,
//       sendId: 0,
//       pic1, // { imageData: plainBase64, imageExtention: 'png', uri }
//       pic2, // { imageData: plainBase64, imageExtention: 'png', uri }
//     };

//     try {
//       setIsSubmitting(true);
//       const netState = await NetInfo.fetch();
//       console.log('[SHOT_SUBMIT] isConnected:', netState.isConnected);

//       //── Offline path ─────────────────────────────────────────
//       if (!netState.isConnected) {
//         await saveShotFromOffline(payload);

//         // 🔥 ADD THIS DEBUG
//         const data = await Preferences.getData(OFFLINE_SHOT_FROM_DATA);
//         console.log('📦 After Save Offline:', data);

//         Common.showToast(
//           'Internet issue. Data saved offline and will sync later.',
//         );
//         navigation.goBack();
//         return;
//       }

//       // ── Online path ──────────────────────────────────────────
//       try {
//         const result: any = await submitShotOnlineWithTimeout(payload);

//         if (insertUpdateShotFromAPI.fulfilled.match(result)) {
//           Common.showToast('Shot From saved successfully!');
//           navigation.goBack();
//         } else {
//           // Server returned an error response — save offline for retry
//           await saveShotFromOffline(payload);
//           Common.showToast(
//             'Server issue. Data saved offline and will sync later.',
//           );
//           navigation.goBack();
//         }
//       } catch (error) {
//         // Timeout or network drop mid-request — save offline for retry
//         await saveShotFromOffline(payload);
//         Common.showToast(
//           'Slow internet. Data saved offline and will sync later.',
//         );
//         navigation.goBack();
//       }
//     } catch (e: any) {
//       Alert.alert('Error', e?.message ?? 'Something went wrong');
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const isCountingDown = countdown !== null;

//   // ── RENDER ────────────────────────────────────────────────────────────────
//   return (
//     <Screen statusBarStyle="dark" statusBgColor={COLORS.BACKGROUND_DEFAULT}>
//       <View style={styles.body}>
//         <View style={styles.main}>
//           {/* ── Header ── */}
//           <View style={styles.header}>
//             <TouchableOpacity
//               style={styles.headerSide}
//               activeOpacity={0.7}
//               onPress={() => navigation.goBack()}>
//               <Image
//                 style={styles.backIcon}
//                 resizeMode="contain"
//                 source={IMAGES.back}
//               />
//             </TouchableOpacity>
//             <Text style={styles.title}>Shot Installation — From</Text>
//             <View style={styles.headerSide} />
//           </View>

//           <ScrollView
//             showsVerticalScrollIndicator={false}
//             contentContainerStyle={styles.scrollContent}>
//             <View style={styles.holidaybody}>
//               <View style={styles.holiday}>
//                 {/* ═══ TOP CARD (EXPANDABLE) ═══ */}
//                 <View style={[styles.holidayitem, styles.li10ShadowBox]}>
//                   <TouchableOpacity
//                     activeOpacity={0.75}
//                     onPress={() => setIsTopCardExpanded(prev => !prev)}
//                     style={topCardStyles.toggleRow}>
//                     <View style={topCardStyles.toggleTitleWrap}>
//                       <Text style={topCardStyles.toggleTitle}>
//                         Shot Setup Details
//                       </Text>
//                       {!isTopCardExpanded && (
//                         <View style={topCardStyles.summaryRow}>
//                           {projectName && (
//                             <View style={topCardStyles.summaryChip}>
//                               <Text style={topCardStyles.summaryChipText}>
//                                 Project Name: {projectName}
//                               </Text>
//                             </View>
//                           )}
//                         </View>
//                       )}
//                     </View>
//                     <View style={topCardStyles.toggleBadge}>
//                       <Text style={topCardStyles.toggleIcon}>
//                         {isTopCardExpanded ? '▲' : '▼'}
//                       </Text>
//                       <Text style={topCardStyles.toggleLabel}>
//                         {isTopCardExpanded ? 'Collapse' : 'Expand'}
//                       </Text>
//                     </View>
//                   </TouchableOpacity>

//                   {isTopCardExpanded && (
//                     <View style={[styles.ul, {marginTop: Gap.gap_12}]}>
//                       {!isSingleVendor ? (
//                         <View style={styles.li}>
//                           <View style={styles.span}>
//                             <Text style={[styles.projectName, styles.shotTypo]}>
//                               Vendor Name
//                             </Text>
//                             <Text style={styles.requiredTypo}> *</Text>
//                           </View>
//                           <DssCustomPicker
//                             data={vendorListData ?? []}
//                             value={selectedVendor}
//                             placeholder="Select Vendor"
//                             labelKey="vendorName"
//                             onSelect={handleVendorSelect}
//                             hasError={!!errors.vendor}
//                           />
//                         </View>
//                       ) : (
//                         selectedVendor && (
//                           <AutoChip
//                             label="Vendor Name"
//                             value={selectedVendor?.vendorName ?? ''}
//                           />
//                         )
//                       )}

//                       {!isSingleVendor && savedVendorCode ? (
//                         <View style={styles.li}>
//                           <View style={styles.span}>
//                             <Text style={[styles.projectName, styles.shotTypo]}>
//                               Vendor Code
//                             </Text>
//                             <Text style={styles.requiredTypo}> *</Text>
//                           </View>
//                           <View style={[styles.add, styles.inputSpaceBlock]}>
//                             <TextInput
//                               style={styles.textInput}
//                               placeholder="Auto-filled on vendor select"
//                               placeholderTextColor={
//                                 COLORS.colorSlategray ?? '#999'
//                               }
//                               value={savedVendorCode ?? ''}
//                               editable={false}
//                             />
//                           </View>
//                         </View>
//                       ) : isSingleVendor && savedVendorCode ? (
//                         <AutoChip label="Vendor Code" value={savedVendorCode} />
//                       ) : null}

//                       {!isSingleMachine ? (
//                         <View style={styles.li}>
//                           <View style={styles.span}>
//                             <Text style={[styles.projectName, styles.shotTypo]}>
//                               Machine ID
//                             </Text>
//                             <Text style={styles.requiredTypo}> *</Text>
//                           </View>
//                           <DssCustomPicker
//                             data={machineListData ?? []}
//                             value={selectedMachine}
//                             placeholder={
//                               selectedVendor
//                                 ? 'Select Machine'
//                                 : 'Select Vendor First'
//                             }
//                             labelKey="machineName"
//                             onSelect={handleMachineSelect}
//                             hasError={!!errors.machine}
//                             disabled={!selectedVendor}
//                           />
//                         </View>
//                       ) : (
//                         selectedMachine && (
//                           <AutoChip
//                             label="Machine ID"
//                             value={selectedMachine?.machineName ?? ''}
//                           />
//                         )
//                       )}

//                       <View style={styles.li}>
//                         <View style={styles.span}>
//                           <Text style={[styles.projectName, styles.shotTypo]}>
//                             Operator Name
//                           </Text>
//                           <Text style={styles.requiredTypo}> *</Text>
//                         </View>
//                         <DssCustomPicker
//                           data={vendorLocatorListData ?? []}
//                           value={selectedOperator}
//                           placeholder={
//                             selectedVendor
//                               ? 'Select Operator'
//                               : 'Select Vendor First'
//                           }
//                           labelKey="name"
//                           onSelect={handleOperatorSelect}
//                           hasError={!!errors.operator}
//                           disabled={!selectedVendor}
//                         />
//                       </View>
//                       <View style={styles.li}>
//                         <View style={styles.span}>
//                           <Text style={[styles.projectName, styles.shotTypo]}>
//                             Locator Name
//                           </Text>
//                           <Text style={styles.requiredTypo}> *</Text>
//                         </View>
//                         <DssCustomPicker
//                           data={vendorLocatorListData ?? []}
//                           value={selectedLocator}
//                           placeholder={
//                             selectedVendor
//                               ? 'Select Locator'
//                               : 'Select Vendor First'
//                           }
//                           labelKey="name"
//                           onSelect={handleLocatorSelect}
//                           hasError={!!errors.locator}
//                           disabled={!selectedVendor}
//                         />
//                       </View>

//                       <View style={styles.card}>
//                         <View style={[styles.add7, styles.ul4SpaceBlock]}>
//                           <View style={styles.float}>
//                             <Text style={[styles.shotDetails, styles.shotTypo]}>
//                               Shot Details
//                             </Text>
//                           </View>

//                           <View style={styles.row}>
//                             <View style={styles.col}>
//                               <View style={styles.span7}>
//                                 <Text
//                                   style={[
//                                     styles.shotTypeLabel,
//                                     styles.shotTypo,
//                                   ]}>
//                                   Shot Type
//                                 </Text>
//                                 <Text style={styles.requiredTypo}> *</Text>
//                               </View>
//                               {isShotTypeAutoSelected &&
//                               (shotTypeListData ?? []).length <= 1 ? (
//                                 <View style={autoChipStyles.inlineChip}>
//                                   <Text style={autoChipStyles.inlineChipIcon}>
//                                     ✓
//                                   </Text>
//                                   <Text
//                                     style={autoChipStyles.inlineChipText}
//                                     numberOfLines={1}>
//                                     {savedShotTypeName}
//                                   </Text>
//                                   <View style={autoChipStyles.autoBadge}>
//                                     <Text style={autoChipStyles.autoText}>
//                                       Auto
//                                     </Text>
//                                   </View>
//                                 </View>
//                               ) : (
//                                 <View style={styles.reducedPickerWrap}>
//                                   <DssCustomPicker
//                                     data={shotTypeListData ?? []}
//                                     value={
//                                       shotTypeListData?.find(
//                                         (x: any) => x.id === savedShotTypeId,
//                                       ) || null
//                                     }
//                                     placeholder="Select Shot Type"
//                                     labelKey="name"
//                                     onSelect={(item: any) => {
//                                       setSavedShotTypeId(item?.id ?? null);
//                                       setSavedShotTypeName(item?.name ?? '');
//                                       if (errors.shotType)
//                                         setErrors((e: any) => ({
//                                           ...e,
//                                           shotType: false,
//                                         }));
//                                     }}
//                                     hasError={!!errors.shotType}
//                                   />
//                                 </View>
//                               )}
//                             </View>

//                             <View style={styles.col}>
//                               <View style={styles.span7}>
//                                 <Text
//                                   style={[
//                                     styles.shotTypeLabel,
//                                     styles.shotTypo,
//                                   ]}>
//                                   Chamber/Coupler
//                                 </Text>
//                                 <Text style={styles.requiredTypo}> *</Text>
//                               </View>
//                               <View style={styles.reducedPickerWrap}>
//                                 <DssCustomPicker
//                                   data={CHAMBER_OPTIONS}
//                                   value={selectedChamber}
//                                   placeholder="Select"
//                                   labelKey="name"
//                                   onSelect={handleChamberSelect}
//                                   hasError={!!errors.chamber}
//                                 />
//                               </View>
//                             </View>
//                           </View>

//                           <View style={[styles.row2, styles.row2Position]}>
//                             <View style={styles.col}>
//                               <View style={styles.span7}>
//                                 <Text
//                                   style={[
//                                     styles.shotTypeLabel,
//                                     styles.shotTypo,
//                                   ]}>
//                                   No. of Ducts
//                                 </Text>
//                                 <Text style={styles.requiredTypo}> *</Text>
//                               </View>
//                               <View style={[styles.group, styles.groupFlexBox]}>
//                                 <View style={[styles.add11, styles.addBorder1]}>
//                                   <TextInput
//                                     style={styles.textInput}
//                                     placeholder="0"
//                                     keyboardType="numeric"
//                                     value={
//                                       ductCountData !== null
//                                         ? String(ductCountData)
//                                         : ''
//                                     }
//                                     onChangeText={v => {
//                                       const clean = v.replace(/[^0-9]/g, '');
//                                       setDuctCountData(
//                                         clean ? Number(clean) : null,
//                                       );
//                                       setNoOfDucts(clean);
//                                     }}
//                                   />
//                                 </View>
//                               </View>
//                             </View>
//                           </View>
//                         </View>
//                       </View>
//                     </View>
//                   )}
//                 </View>

//                 {/* ═══ SHOT FROM CARD ═══ */}
//                 <View style={styles.card2}>
//                   <View style={[styles.cardBody, styles.ul4Layout]}>
//                     <View style={styles.li9}>
//                       <View style={styles.ul3}>
//                         <View style={[styles.span11, styles.groupFlexBox]}>
//                           <Text style={[styles.projectName, styles.shotTypo]}>
//                             Shot From
//                           </Text>
//                         </View>
//                       </View>
//                       <View style={[styles.ul4, styles.ul4Layout]}>
//                         <View style={styles.span12}>
//                           <Text style={[styles.shotFromPit, styles.shotTypo]}>
//                             Shot From Pit No.
//                           </Text>
//                           <Text
//                             style={[
//                               styles.requiredIndicator11,
//                               styles.requiredTypo,
//                             ]}>
//                             {' '}
//                             *
//                           </Text>
//                           <View style={[styles.liParent, styles.row2Position]}>
//                             <TouchableOpacity
//                               activeOpacity={0.8}
//                               style={[
//                                 styles.li10,
//                                 styles.getPitBtn,
//                                 isCountingDown && xStyles.btnDisabled,
//                               ]}
//                               onPress={handleGetGPS}
//                               disabled={isCountingDown || isLoadingGps}>
//                               <Text style={[styles.getGps, styles.okTypo]}>
//                                 {isLoadingGps
//                                   ? 'Fetching...'
//                                   : countdown !== null
//                                   ? `GPS... ${countdown}s`
//                                   : 'Get GPS'}
//                               </Text>
//                             </TouchableOpacity>
//                           </View>
//                         </View>

//                         {isCountingDown && (
//                           <View style={xStyles.countdownWrap}>
//                             <View style={xStyles.countdownBarBg}>
//                               <View
//                                 style={[
//                                   xStyles.countdownBarFill,
//                                   {
//                                     width: `${
//                                       ((10 - (countdown ?? 0)) / 10) * 100
//                                     }%`,
//                                   },
//                                 ]}
//                               />
//                             </View>
//                             <Text style={xStyles.countdownText}>
//                               {`Getting GPS in ${countdown}s…`}
//                             </Text>
//                           </View>
//                         )}

//                         {!gpsLat || !gpsLong ? (
//                           <View style={xStyles.gpsWarningBanner}>
//                             <Text style={xStyles.gpsWarningText}>
//                               ⚠ Tap "Get GPS" first — Lat, Long & Address will
//                               be permanently burned onto both photos as a
//                               watermark.
//                             </Text>
//                           </View>
//                         ) : (
//                           <View style={xStyles.gpsReadyBanner}>
//                             <Text style={xStyles.gpsReadyText}>
//                               ✓ GPS ready — watermark will be burned into both
//                               photos
//                             </Text>
//                           </View>
//                         )}

//                         <View style={[styles.add19, styles.addBorder]}>
//                           <Text
//                             style={[
//                               styles.selectEntryPit,
//                               styles.addressTextTypo,
//                             ]}>
//                             {displayFromPitNo
//                               ? `PIT - ${displayFromPitNo}`
//                               : '—'}
//                           </Text>
//                         </View>

//                         <View style={styles.row3}>
//                           <View style={styles.control}>
//                             <Text style={[styles.projectName, styles.shotTypo]}>
//                               Lat:
//                             </Text>
//                             <View style={[styles.span13, styles.li10FlexBox]}>
//                               <Text
//                                 style={[styles.projectName, styles.shotTypo]}>
//                                 {gpsLat ? `${gpsLat}°` : '—'}
//                               </Text>
//                             </View>
//                           </View>
//                           <View style={styles.control}>
//                             <Text style={[styles.projectName, styles.shotTypo]}>
//                               Lng:
//                             </Text>
//                             <View style={[styles.span13, styles.li10FlexBox]}>
//                               <Text
//                                 style={[styles.projectName, styles.shotTypo]}>
//                                 {gpsLong ? `${gpsLong}°` : '—'}
//                               </Text>
//                             </View>
//                           </View>
//                         </View>

//                         <View style={styles.span15}>
//                           <Text style={[styles.projectName, styles.shotTypo]}>
//                             Address
//                           </Text>
//                           <Text style={styles.requiredTypo}> *</Text>
//                         </View>
//                         <View style={styles.card2}>
//                           <View style={[styles.add19, styles.addBorder]}>
//                             <TextInput
//                               style={[
//                                 styles.addressTextInput,
//                                 styles.addressTextTypo,
//                               ]}
//                               value={address}
//                               onChangeText={setAddress}
//                               placeholder="Address will auto-fill after GPS fetch"
//                               placeholderTextColor={
//                                 COLORS.colorSlategray ?? '#999'
//                               }
//                               multiline
//                             />
//                           </View>
//                         </View>
//                         {locationError ? (
//                           <Text style={xStyles.errorText}>{locationError}</Text>
//                         ) : null}

//                         <View style={styles.span15}>
//                           <Text style={[styles.projectName, styles.shotTypo]}>
//                             Landmark
//                           </Text>
//                           <Text style={styles.requiredTypo}> *</Text>
//                         </View>
//                         <View style={[styles.add21, styles.addBorder]}>
//                           <TextInput
//                             style={[
//                               styles.enterLandmark,
//                               styles.addressTextTypo,
//                             ]}
//                             value={landmark}
//                             onChangeText={setLandmark}
//                             placeholder="Enter Landmark"
//                             placeholderTextColor={
//                               COLORS.colorSlategray ?? '#999'
//                             }
//                           />
//                         </View>

//                         {/* ══════════════════════════════════════════════════
//                             PIT Images
//                         ══════════════════════════════════════════════════ */}
//                         <View style={styles.li11}>
//                           <View style={styles.span15}>
//                             <Text style={[styles.projectName, styles.shotTypo]}>
//                               PIT Images
//                             </Text>
//                             <Text style={styles.requiredTypo}> *</Text>
//                           </View>

//                           <View style={pitImgStyles.row}>
//                             <View style={pitImgStyles.col}>
//                               <CaptureImageWatermark
//                                 title="Image 1"
//                                 pic={pic1}
//                                 setPic={result => {
//                                   setPic1(result);
//                                   if (result && errors.image1)
//                                     setErrors((e: any) => ({
//                                       ...e,
//                                       image1: false,
//                                     }));
//                                 }}
//                                 lat={gpsLat || ''} // ✅ DIRECT
//                                 long={gpsLong || ''} // ✅ DIRECT
//                                 address={address} // already fixed                                hasError={!!errors.image1}
//                               />
//                               {errors.image1 && !pic1 && (
//                                 <Text style={pitImgStyles.errorLabel}>
//                                   Image 1 is required
//                                 </Text>
//                               )}
//                             </View>

//                             <View style={pitImgStyles.col}>
//                               <CaptureImageWatermark
//                                 title="Image 2"
//                                 pic={pic2}
//                                 setPic={result => {
//                                   setPic2(result);
//                                   if (result && errors.image2)
//                                     setErrors((e: any) => ({
//                                       ...e,
//                                       image2: false,
//                                     }));
//                                 }}
//                                 lat={gpsLat || ''} // ✅ DIRECT
//                                 long={gpsLong || ''} // ✅ DIRECT
//                                 address={address} // already fixed
//                                 hasError={!!errors.image2}
//                               />
//                               {errors.image2 && !pic2 && (
//                                 <Text style={pitImgStyles.errorLabel}>
//                                   Image 2 is required
//                                 </Text>
//                               )}
//                             </View>
//                           </View>
//                         </View>

//                         <View style={styles.ul}>
//                           <View style={styles.span15}>
//                             <Text style={[styles.projectName, styles.shotTypo]}>
//                               Remarks
//                             </Text>
//                             <Text style={styles.requiredTypo}> *</Text>
//                           </View>
//                           <View style={[styles.add19, styles.addBorder]}>
//                             <TextInput
//                               style={[
//                                 styles.enterLandmark,
//                                 styles.addressTextTypo,
//                               ]}
//                               value={remarks}
//                               onChangeText={setRemarks}
//                               placeholder="Enter Remarks"
//                               placeholderTextColor={
//                                 COLORS.colorSlategray ?? '#999'
//                               }
//                               multiline
//                             />
//                           </View>
//                         </View>

//                         <TouchableOpacity
//                           onPress={handleSubmit}
//                           activeOpacity={0.85}
//                           disabled={isSubmitting}
//                           style={[
//                             styles.li12,
//                             styles.li12FlexBox,
//                             isSubmitting && xStyles.btnDisabled,
//                           ]}>
//                           {isSubmitting ? (
//                             <ActivityIndicator
//                               size="small"
//                               color={COLORS.colorWhite}
//                             />
//                           ) : (
//                             <Text style={[styles.submit, styles.okTypo]}>
//                               Submit
//                             </Text>
//                           )}
//                         </TouchableOpacity>
//                       </View>
//                     </View>
//                   </View>
//                 </View>
//               </View>
//             </View>
//           </ScrollView>
//         </View>
//       </View>
//     </Screen>
//   );
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // PIT image section styles
// // ─────────────────────────────────────────────────────────────────────────────
// const pitImgStyles = StyleSheet.create({
//   row: {
//     flexDirection: 'row',
//     gap: Gap.gap_12,
//     alignSelf: 'stretch',
//   },
//   col: {
//     flex: 1,
//     flexDirection: 'column',
//     gap: Gap.gap_8,
//   },
//   errorLabel: {
//     fontSize: FontSize.fs_11 ?? 11,
//     color: COLORS.colorRed ?? '#f44336',
//     fontFamily: FONTS.REGULAR,
//     marginTop: 2,
//   },
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // AutoChip styles
// // ─────────────────────────────────────────────────────────────────────────────
// const autoChipStyles = StyleSheet.create({
//   row: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     alignSelf: 'stretch',
//     gap: Gap.gap_12,
//   },
//   label: {
//     width: Width.width_107,
//     fontSize: FontSize.fs_14,
//     fontFamily: FONTS.MEDIUM,
//     color: COLORS.colorDarkslategray,
//     letterSpacing: LetterSpacing.ls_0_2,
//     textAlign: 'left',
//   },
//   chip: {
//     flex: 1,
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 6,
//     backgroundColor: '#EEF6EE',
//     borderRadius: Border.br_6,
//     borderWidth: 1,
//     borderColor: '#B2DFBB',
//     paddingHorizontal: Padding.padding_8,
//     paddingVertical: 5,
//     minHeight: Height.height_26 ?? 26,
//   },
//   chipIcon: {fontSize: 11, color: '#2E7D32', fontFamily: FONTS.SEMI_BOLD},
//   chipText: {
//     flex: 1,
//     fontSize: FontSize.fs_13,
//     fontFamily: FONTS.MEDIUM,
//     color: '#1B5E20',
//     letterSpacing: LetterSpacing.ls_0_2,
//   },
//   autoBadge: {
//     backgroundColor: '#C8E6C9',
//     borderRadius: 10,
//     paddingHorizontal: 6,
//     paddingVertical: 1,
//   },
//   autoText: {
//     fontSize: 9,
//     fontFamily: FONTS.SEMI_BOLD,
//     color: '#2E7D32',
//     letterSpacing: 0.3,
//   },
//   inlineChip: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 5,
//     backgroundColor: '#EEF6EE',
//     borderRadius: Border.br_6,
//     borderWidth: 1,
//     borderColor: '#B2DFBB',
//     paddingHorizontal: Padding.padding_8,
//     paddingVertical: 5,
//     minHeight: Height.height_26 ?? 26,
//     width: '100%',
//   },
//   inlineChipIcon: {fontSize: 11, color: '#2E7D32', fontFamily: FONTS.SEMI_BOLD},
//   inlineChipText: {
//     flex: 1,
//     fontSize: FontSize.fs_12,
//     fontFamily: FONTS.MEDIUM,
//     color: '#1B5E20',
//     letterSpacing: LetterSpacing.ls_0_2,
//   },
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // xStyles (GPS / countdown / error)
// // ─────────────────────────────────────────────────────────────────────────────
// const xStyles = StyleSheet.create({
//   btnDisabled: {opacity: 0.6},
//   countdownWrap: {marginTop: 4, marginBottom: 2, gap: 4},
//   countdownBarBg: {
//     height: 4,
//     backgroundColor: '#E0E0E0',
//     borderRadius: 4,
//     overflow: 'hidden',
//   },
//   countdownBarFill: {
//     height: 4,
//     backgroundColor: COLORS.PRIMARY,
//     borderRadius: 4,
//   },
//   countdownText: {
//     fontSize: 11,
//     color: COLORS.PRIMARY,
//     fontFamily: FONTS.REGULAR,
//     textAlign: 'center',
//     marginTop: 2,
//   },
//   gpsWarningBanner: {
//     backgroundColor: '#FFF3E0',
//     borderRadius: 8,
//     marginTop: 4,
//     paddingHorizontal: 10,
//     paddingVertical: 8,
//     borderLeftWidth: 3,
//     borderLeftColor: '#FF9800',
//   },
//   gpsWarningText: {
//     fontSize: 12,
//     color: '#E65100',
//     fontFamily: FONTS.REGULAR,
//     lineHeight: 17,
//   },
//   gpsReadyBanner: {
//     backgroundColor: '#E8F5E9',
//     borderRadius: 8,
//     paddingHorizontal: 10,
//     paddingVertical: 6,
//     borderLeftWidth: 3,
//     borderLeftColor: '#4CAF50',
//   },
//   gpsReadyText: {fontSize: 12, color: '#2E7D32', fontFamily: FONTS.MEDIUM},
//   errorText: {
//     fontSize: 12,
//     color: COLORS.ERROR ?? '#f44',
//     marginTop: 2,
//     fontFamily: FONTS.REGULAR,
//   },
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // topCardStyles
// // ─────────────────────────────────────────────────────────────────────────────
// const topCardStyles = StyleSheet.create({
//   toggleRow: {
//     flexDirection: 'row',
//     alignItems: 'flex-start',
//     justifyContent: 'space-between',
//     gap: 8,
//   },
//   toggleTitleWrap: {flex: 1, gap: 6},
//   toggleTitle: {
//     fontSize: FontSize.fs_14,
//     fontFamily: FONTS.SEMI_BOLD,
//     color: COLORS.colorDarkslategray,
//     letterSpacing: LetterSpacing.ls_0_2 ?? 0.2,
//   },
//   summaryRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2},
//   summaryChip: {
//     backgroundColor: '#EEF6EE',
//     borderRadius: 20,
//     paddingHorizontal: 8,
//     paddingVertical: 3,
//     borderWidth: 1,
//     borderColor: '#B2DFBB',
//   },
//   summaryChipText: {fontSize: 10, fontFamily: FONTS.MEDIUM, color: '#2E7D32'},
//   toggleBadge: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 5,
//     backgroundColor: COLORS.PRIMARY,
//     borderRadius: 20,
//     paddingHorizontal: 12,
//     paddingVertical: 5,
//     flexShrink: 0,
//   },
//   toggleIcon: {
//     fontSize: FontSize.fs_14,
//     color: '#fff',
//     fontFamily: FONTS.SEMI_BOLD,
//   },
//   toggleLabel: {
//     fontSize: FontSize.fs_14,
//     fontFamily: FONTS.SEMI_BOLD,
//     color: '#fff',
//   },
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // Main styles
// // ─────────────────────────────────────────────────────────────────────────────
// const styles = StyleSheet.create({
//   titleClr: {color: COLORS.colorDarkslategray, fontFamily: FONTS.MEDIUM},
//   li10ShadowBox: {elevation: 3, boxShadow: BoxShadow.shadow_drop},
//   shotTypo: {
//     letterSpacing: LetterSpacing.ls_0_2,
//     textAlign: 'left',
//     color: COLORS.colorDarkslategray,
//     fontFamily: FONTS.MEDIUM,
//   },
//   inputSpaceBlock: {
//     paddingRight: Padding.padding_8,
//     paddingLeft: Padding.padding_6,
//     borderWidth: 1,
//     borderColor: COLORS.colorAliceblue,
//     borderStyle: 'solid',
//     borderRadius: Border.br_6,
//     minHeight: Height.height_26 ?? 26,
//     alignItems: 'center',
//     flexDirection: 'row',
//   },
//   textInput: {
//     flex: 1,
//     fontSize: FontSize.fs_13 ?? 13,
//     color: COLORS.colorDarkslategray,
//     fontFamily: FONTS.MEDIUM,
//     textAlign: 'left',
//     paddingVertical: 0,
//     paddingHorizontal: 0,
//     includeFontPadding: false,
//     letterSpacing: LetterSpacing.ls_0_2 ?? 0.2,
//   },
//   addressTextInput: {
//     flex: 1,
//     fontSize: FontSize.fs_14 ?? 14,
//     color: COLORS.colorDarkslategray,
//     paddingVertical: 4,
//     minHeight: 40,
//     textAlignVertical: 'top',
//   },
//   ul4SpaceBlock: {padding: Padding.padding_12, alignSelf: 'stretch'},
//   row2Position: {zIndex: 2, flexDirection: 'row'},
//   addBorder1: {
//     borderWidth: 1,
//     borderColor: COLORS.colorAliceblue,
//     borderStyle: 'solid',
//     backgroundColor: COLORS.colorWhite,
//   },
//   groupFlexBox: {gap: Gap.gap_6, flexDirection: 'row'},
//   li12FlexBox: {
//     backgroundColor: COLORS.PRIMARY,
//     justifyContent: 'center',
//     alignItems: 'center',
//     flexDirection: 'row',
//   },
//   okTypo: {color: COLORS.colorWhite, fontFamily: FONTS.SEMI_BOLD},
//   addressTextTypo: {
//     lineHeight: LineHeight.lh_22,
//     textAlign: 'left',
//     color: COLORS.colorDarkslategray,
//     fontFamily: FONTS.MEDIUM,
//   },
//   ul4Layout: {borderRadius: 13, backgroundColor: COLORS.colorWhite},
//   requiredTypo: {
//     color: COLORS.colorRed,
//     textAlign: 'left',
//     fontSize: FontSize.fs_14,
//     fontFamily: FONTS.MEDIUM,
//   },
//   li10FlexBox: {
//     borderRadius: Border.br_5,
//     backgroundColor: 'transparent',
//     justifyContent: 'center',
//     alignItems: 'center',
//     flexDirection: 'row',
//   },
//   getPitBtn: {
//     borderRadius: Border.br_5,
//     backgroundColor: COLORS.PRIMARY,
//     justifyContent: 'center',
//     alignItems: 'center',
//     flexDirection: 'row',
//   },
//   addBorder: {
//     paddingVertical: Padding.padding_8,
//     borderWidth: 1,
//     borderColor: COLORS.colorAliceblue,
//     borderStyle: 'solid',
//     borderRadius: Border.br_8,
//     flexDirection: 'row',
//     alignSelf: 'stretch',
//   },
//   body: {
//     flex: 1,
//     paddingHorizontal: Padding.padding_16,
//     paddingTop: SIZE.MS(18),
//     width: '100%',
//   },
//   main: {flex: 1, gap: 22, alignSelf: 'stretch'},
//   scrollContent: {paddingBottom: 40},
//   header: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     alignSelf: 'stretch',
//     height: Height.height_24 ?? 24,
//   },
//   headerSide: {width: 32, alignItems: 'flex-start', justifyContent: 'center'},
//   backIcon: {
//     width: 24,
//     height: 24,
//     tintColor: COLORS.colorDarkslategray ?? '#2f4f4f',
//   },
//   title: {
//     flex: 1,
//     fontSize: 18,
//     lineHeight: 23,
//     textAlign: 'center',
//     fontWeight: '500',
//     fontFamily: FONTS.MEDIUM,
//     color: COLORS.colorDarkslategray,
//   },
//   holidaybody: {
//     overflow: 'hidden',
//     flexDirection: 'row',
//     alignSelf: 'stretch',
//     backgroundColor: COLORS.BACKGROUND_DEFAULT,
//   },
//   holiday: {gap: 16, flex: 1},
//   holidayitem: {
//     paddingVertical: Padding.padding_16,
//     maxWidth: 430,
//     paddingHorizontal: Padding.padding_12,
//     backgroundColor: COLORS.colorWhite,
//     borderRadius: Border.br_8,
//     overflow: 'hidden',
//     width: '100%',
//   },
//   ul: {gap: Gap.gap_12, alignSelf: 'stretch'},
//   li: {
//     justifyContent: 'center',
//     gap: Gap.gap_12,
//     alignItems: 'center',
//     flexDirection: 'row',
//     alignSelf: 'stretch',
//   },
//   span: {width: Width.width_107, alignItems: 'center', flexDirection: 'row'},
//   projectName: {textAlign: 'left', fontSize: FontSize.fs_14},
//   add: {backgroundColor: COLORS.colorWhitesmoke, flex: 1},
//   card: {paddingTop: 11, alignSelf: 'stretch'},
//   add7: {
//     gap: Gap.gap_8,
//     borderWidth: 1,
//     borderColor: COLORS.colorAliceblue,
//     borderStyle: 'solid',
//     backgroundColor: COLORS.colorWhite,
//     borderRadius: Border.br_8,
//   },
//   float: {
//     top: -11,
//     left: SIZE.MS(12),
//     borderRadius: SIZE.MS(15),
//     paddingHorizontal: 0,
//     paddingVertical: SIZE.MS(3),
//     backgroundColor: COLORS.colorWhite,
//     position: 'absolute',
//     zIndex: 0,
//     justifyContent: 'center',
//     alignItems: 'center',
//     flexDirection: 'row',
//   },
//   shotDetails: {fontSize: FontSize.fs_12, textAlign: 'left'},
//   row: {
//     gap: Gap.gap_8,
//     zIndex: 1,
//     alignItems: 'center',
//     flexDirection: 'row',
//     alignSelf: 'stretch',
//   },
//   col: {gap: Gap.gap_8, flex: 1},
//   span7: {
//     justifyContent: 'flex-start',
//     alignItems: 'flex-start',
//     backgroundColor: 'transparent',
//     flexDirection: 'row',
//   },
//   shotTypeLabel: {fontSize: FontSize.fs_13, textAlign: 'left'},
//   reducedPickerWrap: {width: '100%', alignSelf: 'flex-start'},
//   row2: {gap: Gap.gap_8, alignItems: 'flex-start', alignSelf: 'stretch'},
//   group: {alignSelf: 'stretch'},
//   add11: {
//     paddingVertical: Padding.padding_2,
//     borderRadius: Border.br_6,
//     height: Height.height_26,
//     paddingHorizontal: Padding.padding_12,
//     alignItems: 'center',
//     flexDirection: 'row',
//     flex: 1,
//   },
//   card2: {alignSelf: 'stretch'},
//   cardBody: {
//     elevation: 3,
//     boxShadow: BoxShadow.shadow_drop,
//     flexDirection: 'row',
//   },
//   li9: {
//     borderRadius: 14,
//     backgroundColor: COLORS.colorAliceblue,
//     overflow: 'hidden',
//     flex: 1,
//   },
//   ul3: {
//     paddingVertical: 10,
//     paddingHorizontal: Padding.padding_12,
//     alignSelf: 'stretch',
//   },
//   span11: {width: 93, justifyContent: 'center', alignItems: 'center'},
//   ul4: {padding: Padding.padding_12, alignSelf: 'stretch', gap: Gap.gap_12},
//   span12: {alignItems: 'center', flexDirection: 'row', alignSelf: 'stretch'},
//   shotFromPit: {textAlign: 'left', fontSize: FontSize.fs_14, zIndex: 0},
//   requiredIndicator11: {zIndex: 1},
//   liParent: {
//     marginTop: -13,
//     top: '50%',
//     right: 0,
//     gap: Gap.gap_10,
//     position: 'absolute',
//   },
//   li10: {
//     paddingHorizontal: Padding.padding_6,
//     paddingVertical: 5,
//     elevation: 3,
//     boxShadow: BoxShadow.shadow_drop,
//     zIndex: 0,
//   },
//   getGps: {fontSize: FontSize.fs_14, textAlign: 'left'},
//   add19: {
//     paddingHorizontal: Padding.padding_12,
//     backgroundColor: COLORS.colorWhite,
//     alignItems: 'center',
//   },
//   selectEntryPit: {fontSize: FontSize.fs_14, flex: 1},
//   row3: {width: 324, flexDirection: 'column'},
//   control: {
//     gap: Gap.gap_5,
//     alignItems: 'center',
//     flexDirection: 'row',
//     flex: 1,
//   },
//   span13: {
//     height: Height.height_18,
//     paddingHorizontal: Padding.padding_4,
//     borderStyle: 'solid',
//     borderRadius: Border.br_5,
//   },
//   span15: {alignItems: 'center', flexDirection: 'row', alignSelf: 'stretch'},
//   add21: {
//     paddingHorizontal: Padding.padding_12,
//     backgroundColor: COLORS.colorWhite,
//   },
//   enterLandmark: {opacity: 1, fontSize: FontSize.fs_14, flex: 1},
//   li11: {gap: Gap.gap_8, alignSelf: 'stretch'},
//   li12: {
//     paddingHorizontal: SIZE.MS(20),
//     paddingVertical: SIZE.MS(13),
//     borderRadius: Border.br_8,
//     elevation: 3,
//     boxShadow: BoxShadow.shadow_drop,
//     alignSelf: 'stretch',
//   },
//   submit: {textAlign: 'center', fontSize: FontSize.fs_14},
// });
// export default AddInstallationFrom;
