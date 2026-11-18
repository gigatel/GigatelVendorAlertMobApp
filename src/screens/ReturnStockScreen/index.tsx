import {
  StyleSheet,
  TextInput,
  Text,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import React, {FC, useState, useEffect, useRef} from 'react';
import {IMAGES, COLORS} from '@res';
import {
  FontFamily,
  FontSize,
  LetterSpacing,
  Border,
  LineHeight,
} from '../../res/globalStyle';
import {ScreenProps, DataType} from '@types';
import {
  getVendorStoreItemListAPI,
  getCompanyStoreListAPI,
  getEmployeeDetailsApi,
  VendorStoreListAPI,
  getMasterListAPI,
  getProjectItemByStoreAPI,
  getVendorSpecificationDDAPI,
  insertUpdateStockReturnAPI,
  getVendorListForShot, // ADD
} from './../../store/slices/dss.slice';
import {useDispatch, useSelector} from 'react-redux';
import {Location, Common} from '@utils';
import DssCustomPicker from '../../components/molecules/DsscustomPicker';

// ── Types ──────────────────────────────────────────────────────────────────────
type MasterItem = {
  id: number;
  itemName: string;
  itemId: string;
  itemTypeId: string;
};

type TypeItem = {
  id: string;
  itemType: string;
  itemSpecification: string;
  itemName?: string;
  name?: string;
  itemIdInt?: number;
  itemTypeId?: number;
  // ── Raw values straight from GetProjectItems response ──
  // Kept as-is (string | number) — never run through Number() so "96f" survives
  itemId?: number | string;
  // Aliased copies forwarded to getVendorSpecificationDDAPI
  itemIdParam?: number | string; // ← itemId  as returned by GetProjectItems
  itemIdIntParam?: number; // ← itemIdInt
  itemTypeParam?: string | number; // ← itemType
};

type StoreItem = {
  id: number;
  name: string;
};

// DrumItem from getVendorSpecificationDDAPI response — displayed via drumNo key
type DrumItem = {
  id: number | string;
  drumNo: string;
  qty: number; // ✅ ADD THIS
};

type TableRow = {
  rowId: number;
  selectedItem: MasterItem | null;
  allTypeList: TypeItem[];
  typeList: TypeItem[];
  isLoadingType: boolean;
  selectedType: TypeItem | null;
  description: string;
  quantity: string;
  // Drum No. — now a picker fed by getVendorSpecificationDDAPI
  drumList: DrumItem[];
  isLoadingDrum: boolean;
  selectedDrum: DrumItem | null;
};

// ── Fresh GPS helper — NEVER uses cached position (maximumAge: 0) ──────────────
const getFreshPosition = (): Promise<GeolocationPosition> =>
  new Promise((resolve, reject) => {
    if (!navigator?.geolocation) {
      const RNGeolocation =
        require('@react-native-community/geolocation').default;
      RNGeolocation.getCurrentPosition(
        (pos: GeolocationPosition) => resolve(pos),
        (err: GeolocationPositionError) => reject(err),
        {enableHighAccuracy: true, timeout: 20000, maximumAge: 0},
      );
    } else {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });
    }
  });

/* ─────────────────────────────────────────────────────────────────────────────
   Main Screen
───────────────────────────────────────────────────────────────────────────── */
const ReturnStockScreen: FC<ScreenProps.ReturnStockScreen> = ({
  navigation,
  route,
}) => {
  const dispatch = useDispatch<any>();
  const {projectId, projectCode, vendorName, vendorID} = route?.params;
  const {vendorListData} = useSelector((state: any) => state.dss);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [savedVendorId, setSavedVendorId] = useState<any>(vendorID ?? null);
  const [savedVendorCode, setSavedVendorCode] = useState<any>(null); // ── Get createdBy / companyId from Redux store ──
  const createdBy: number = useSelector(
    (state: any) => state?.auth?.user?.employeeId ?? state?.auth?.user?.id ?? 0,
  );
  const companyId: number = useSelector(
    (state: any) => state?.auth?.user?.companyId ?? 0,
  );

  const [selectedEmployees, setSelectedEmployees] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Store lists ────────────────────────────────────────────────────────
  const [vendorStoreList, setVendorStoreList] = useState<StoreItem[]>([]);
  const [companyStoreList, setCompanyStoreList] = useState<StoreItem[]>([]);
  const [isLoadingVendorStore, setIsLoadingVendorStore] = useState(false);
  const [isLoadingCompanyStore, setIsLoadingCompanyStore] = useState(false);
  const [selectedFromVendorStore, setSelectedFromVendorStore] =
    useState<StoreItem | null>(null);
  const [selectedToCompanyStore, setSelectedToCompanyStore] =
    useState<StoreItem | null>(null);

  // ── Master item list ───────────────────────────────────────────────────
  const [masterList, setMasterList] = useState<MasterItem[]>([]);
  const [isLoadingMaster, setIsLoadingMaster] = useState(false);

  // ── All project type items (fetched once per store, shared across rows) ─
  const [allProjectItems, setAllProjectItems] = useState<TypeItem[]>([]);
  const [isFetchingProjectItems, setIsFetchingProjectItems] = useState(false);
  const [gpsLat, setGpsLat] = useState<string | null>('');
  const [gpsLong, setGpsLong] = useState<string | null>('');
  const [address, setAddress] = useState<string>('');
  const [landmark, setLandmark] = useState<string>('');
  // ── GPS state ──────────────────────────────────────────────────────────
  // const [gpsLat, setGpsLat] = useState<string | null>('28.54182457463821');
  // const [gpsLong, setGpsLong] = useState<string | null>('77.25467633917383');
  // const [address, setAddress] = useState<string>(
  //   'Gigatel Solutions Private Limited',
  // );
  // const [landmark, setLandmark] = useState<string>('yes bank');
  const [locationError, setLocationError] = useState('');
  const [isLoadingGps, setIsLoadingGps] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCountingDown = countdown !== null;

  // ── Driver / Vehicle ──────────────────────────────────────────────────
  const [driverName, setDriverName] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');

  // ── Remarks ────────────────────────────────────────────────────────────
  const [remarks, setRemarks] = useState('');
  const handleVendorSelect = (item: any) => {
    setSelectedVendor(item);
    setSavedVendorId(item?.vendorId);
    setSavedVendorCode(item?.vendorCode);

    setSelectedFromVendorStore(null);
    setVendorStoreList([]);
    setMasterList([]);
    setAllProjectItems([]);
    setTableRows([makeEmptyRow()]);

    fetchVendorStoreList(item?.vendorId);
  };
  // ── Table rows ─────────────────────────────────────────────────────────
  const makeEmptyRow = (): TableRow => ({
    rowId: Date.now() + Math.random(),
    selectedItem: null,
    allTypeList: [],
    typeList: [],
    isLoadingType: false,
    selectedType: null,
    description: '',
    quantity: '',
    drumList: [],
    isLoadingDrum: false,
    selectedDrum: null,
  });

  const [tableRows, setTableRows] = useState<TableRow[]>([makeEmptyRow()]);

  // ── Cleanup countdown on unmount ───────────────────────────────────────
  useEffect(
    () => () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    },
    [],
  );
  useEffect(() => {
    if (vendorListData?.length > 0 && vendorID && !selectedVendor) {
      const matchedVendor = vendorListData.find(
        (item: any) => String(item?.vendorId) === String(vendorID),
      );

      if (matchedVendor) {
        setSelectedVendor(matchedVendor);
        setSavedVendorId(matchedVendor?.vendorId);
        setSavedVendorCode(matchedVendor?.vendorCode);
      }
    }
  }, [vendorListData, vendorID]);
  useEffect(() => {
    dispatch(
      getVendorListForShot({
        employeeID: '',
        projectId,
      }),
    );
  }, [projectId]);
  useEffect(() => {
    if (vendorListData?.length > 0 && vendorID && !selectedVendor) {
      const matchedVendor = vendorListData.find(
        (item: any) => String(item?.vendorId) === String(vendorID),
      );

      if (matchedVendor) {
        setSelectedVendor(matchedVendor);
        setSavedVendorId(matchedVendor?.vendorId);
        setSavedVendorCode(matchedVendor?.vendorCode);
      }
    }
  }, [vendorListData, vendorID]);
  useEffect(() => {
    if (vendorListData?.length > 0 && vendorID && !selectedVendor) {
      const matchedVendor = vendorListData.find(
        (item: any) => String(item?.vendorId) === String(vendorID),
      );

      if (matchedVendor) {
        setSelectedVendor(matchedVendor);
        setSavedVendorId(matchedVendor?.vendorId);
        setSavedVendorCode(matchedVendor?.vendorCode);
      }
    }
  }, [vendorListData, vendorID]);
  // ── Fetch vendor store list + company store on mount ────
  useEffect(() => {
    fetchCompanyStoreList();
  }, []);

  useEffect(() => {
    if (savedVendorId) {
      fetchVendorStoreList(savedVendorId);
    }
  }, [savedVendorId]); // ── Fetch master list + project items when FROM vendor store selected ──
  useEffect(() => {
    if (selectedFromVendorStore) {
      fetchMasterList(selectedFromVendorStore);
      fetchAllProjectItems();
    } else {
      setMasterList([]);
      setAllProjectItems([]);
      setTableRows([makeEmptyRow()]);
    }
  }, [selectedFromVendorStore]);
  // ── API: vendor store list ────────────────────────────────────────────
  const fetchVendorStoreList = async (vendorId: string | number) => {
    try {
      setIsLoadingVendorStore(true);
      const res: any = await dispatch(getVendorStoreItemListAPI(vendorId));
      if (Array.isArray(res?.payload)) {
        setVendorStoreList(res.payload);
      }
    } catch (e) {
      console.error('fetchVendorStoreList', e);
    } finally {
      setIsLoadingVendorStore(false);
    }
  };
  // ── API: company store list ────────────────────────────────────────────
  const fetchCompanyStoreList = async () => {
    try {
      setIsLoadingCompanyStore(true);
      const res: any = await dispatch(getCompanyStoreListAPI({projectId}));
      if (Array.isArray(res?.payload)) {
        setCompanyStoreList(res.payload);
      }
    } catch (e) {
      console.error('fetchCompanyStoreList', e);
    } finally {
      setIsLoadingCompanyStore(false);
    }
  };

  // ── API: master item list ──────────────────────────────────────────────
  const fetchMasterList = async (store: any) => {
    try {
      setIsLoadingMaster(true);
      setMasterList([]);
      const result = await dispatch(
        getMasterListAPI({
          vendorStoreId: store?.id ?? store?.vendorStoreId ?? store?.storeId,
        }),
      );
      if (getMasterListAPI.fulfilled.match(result)) {
        const raw = result.payload;
        const data: MasterItem[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
          ? raw.data
          : [];
        setMasterList(data);
      }
    } catch {
      setMasterList([]);
    } finally {
      setIsLoadingMaster(false);
    }
  };

  // ── API: fetch ALL project items once (shared pool for filtering) ───────
  // GET /api/Stock/GetProjectItems?id=<projectId>
  //
  // FIX: itemId from this API can be a non-numeric string like "96f".
  // We store it RAW (never Number()) and alias it to itemIdParam so
  // fetchDrumList and the submit payload can forward it unchanged.
  const fetchAllProjectItems = async () => {
    try {
      setIsFetchingProjectItems(true);
      const result = await dispatch(getProjectItemByStoreAPI({projectId}));
      if (getProjectItemByStoreAPI.fulfilled.match(result)) {
        const raw = result.payload;
        const data: TypeItem[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
          ? raw.data
          : [];

        console.log(
          'GetProjectItems raw sample =>',
          JSON.stringify(data.slice(0, 3), null, 2),
        );

        // Preserve itemId exactly as the API returns it — do NOT coerce with Number()
        const mapped: TypeItem[] = data.map(item => ({
          ...item,
          // Alias the raw API fields so consumers never touch item.itemId directly
          itemIdParam: item.itemId, // forwarded as ?itemId=   (kept as-is)
          itemIdIntParam: item.itemIdInt, // forwarded as ?itemIdInt=
          itemTypeParam: item.itemType, // forwarded as ?itemType=
        }));

        setAllProjectItems(mapped);
      }
    } catch {
      setAllProjectItems([]);
    } finally {
      setIsFetchingProjectItems(false);
    }
  };
  // ── API: fetch drum list for a row right after type selection ──────────
  // itemId is forwarded RAW from itemIdParam — never coerced to Number
  const fetchDrumList = async (rowId: number, selectedType: TypeItem) => {
    if (!selectedFromVendorStore) return;

    setTableRows(prev =>
      prev.map(r =>
        r.rowId === rowId
          ? {
              ...r,
              isLoadingDrum: true,
              drumList: [],
              selectedDrum: null,
              quantity: '',
            }
          : r,
      ),
    );

    try {
      const params = {
        itemId: selectedType.itemIdParam ?? selectedType.itemId ?? 0,
        itemIdInt: selectedType.itemIdIntParam ?? selectedType.itemIdInt ?? 0,
        itemType: selectedType.itemTypeParam ?? selectedType.itemType ?? 0,
        vendorStoreId: selectedFromVendorStore?.id ?? 0,
      };

      const result = await dispatch(getVendorSpecificationDDAPI(params));

      if (getVendorSpecificationDDAPI.fulfilled.match(result)) {
        const raw = result.payload;

        const drums: DrumItem[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
          ? raw.data
          : [];

        setTableRows(prev =>
          prev.map(r => {
            if (r.rowId !== rowId) return r;

            // ✅ CASE 1: Only ONE drum → auto select
            if (drums.length === 1) {
              return {
                ...r,
                drumList: drums,
                selectedDrum: drums[0],
                quantity: String(drums[0].qty ?? ''), // auto fill
                isLoadingDrum: false,
              };
            }

            // ✅ CASE 2: Multiple drums → user select kare
            return {
              ...r,
              drumList: drums,
              selectedDrum: null,
              quantity: '',
              isLoadingDrum: false,
            };
          }),
        );
      } else {
        setTableRows(prev =>
          prev.map(r =>
            r.rowId === rowId
              ? {
                  ...r,
                  drumList: [],
                  selectedDrum: null,
                  quantity: '',
                  isLoadingDrum: false,
                }
              : r,
          ),
        );
      }
    } catch (error) {
      console.error('fetchDrumList error =>', error);

      setTableRows(prev =>
        prev.map(r =>
          r.rowId === rowId
            ? {
                ...r,
                drumList: [],
                selectedDrum: null,
                quantity: '',
                isLoadingDrum: false,
              }
            : r,
        ),
      );
    }
  };

  const openEmployeeScreen = () => {
    navigation.navigate('EmployeeSelectionScreen', {
      selected: selectedEmployees,
      onSelect: (data: any[]) => setSelectedEmployees(data),
    });
  };

  // ── GPS: core fetch logic ──────────────────────────────────────────────
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
          Alert.alert('Weak GPS', 'Please try again.');
          return;
        }
        freshLat = position.coords.latitude;
        freshLong = position.coords.longitude;
      } catch (posErr: any) {
        const msg =
          posErr?.code === 3
            ? 'GPS timed out. Move to an open area with better signal and try again.'
            : posErr?.code === 2
            ? 'GPS unavailable. Please enable location services and try again.'
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
        if (data?.address) {
          resolvedAddress = data.address;
        }
      } catch {
        resolvedAddress = '';
      }
      setGpsLat(String(freshLat));
      setGpsLong(String(freshLong));
      if (resolvedAddress) {
        setAddress(resolvedAddress);
        Common.showToast('GPS fetched successfully!');
      } else {
        setAddress('');
        setLocationError(
          'Address could not be resolved. Please type manually.',
        );
        Common.showToast(
          'GPS coordinates captured. Please enter address manually.',
        );
      }
    } catch (e: any) {
      setLocationError(e?.message || 'Location error');
    } finally {
      setIsLoadingGps(false);
    }
  };

  // ── GPS: countdown then fetch ──────────────────────────────────────────
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

  // ── Table row helpers ──────────────────────────────────────────────────
  const isRowComplete = (row: TableRow): boolean =>
    row.selectedItem !== null &&
    row.selectedType !== null &&
    row.quantity.trim() !== '' &&
    row.description.trim() !== '';

  const handleFromVendorStoreSelect = (store: StoreItem) => {
    setSelectedFromVendorStore(store);
    setTableRows([makeEmptyRow()]);
  };

  const handleItemSelect = (rowId: number, item: MasterItem) => {
    const filtered = allProjectItems
      .filter(
        t =>
          (t.itemName ?? '').toLowerCase().trim() ===
          item.itemName.toLowerCase().trim(),
      )
      .map(t => ({
        ...t,
        dropdownLabel: `${t.itemType} - ${t.itemSpecification}`,
        selectedLabel: t.itemType,
      }));

    setTableRows(prev =>
      prev.map(r =>
        r.rowId === rowId
          ? {
              ...r,
              selectedItem: item,
              selectedType: null,
              description: '',
              allTypeList: allProjectItems,
              typeList: filtered,
              isLoadingType: false,
              drumList: [],
              selectedDrum: null,
              isLoadingDrum: false,
            }
          : r,
      ),
    );
  };

  // When type is selected → update row and immediately fetch drum list
  const handleTypeSelect = (rowId: number, type: TypeItem) => {
    setTableRows(prev =>
      prev.map(r =>
        r.rowId === rowId
          ? {
              ...r,
              selectedType: type,
              description: type.itemSpecification ?? '',
              selectedDrum: null,
              drumList: [],
            }
          : r,
      ),
    );
    fetchDrumList(rowId, type);
  };

  const handleQtyChange = (rowId: number, qty: string) => {
    setTableRows(prev =>
      prev.map(r => (r.rowId === rowId ? {...r, quantity: qty} : r)),
    );
  };

  const handleDescChange = (rowId: number, desc: string) => {
    setTableRows(prev =>
      prev.map(r => (r.rowId === rowId ? {...r, description: desc} : r)),
    );
  };

  // const handleDrumSelect = (rowId: number, drum: DrumItem) => {
  //   setTableRows(prev =>
  //     prev.map(r => (r.rowId === rowId ? {...r, selectedDrum: drum} : r)),
  //   );
  // };
  const handleDrumSelect = (rowId: number, drum: DrumItem) => {
    setTableRows(prev =>
      prev.map(r =>
        r.rowId === rowId
          ? {
              ...r,
              selectedDrum: drum,
              quantity: String(drum.qty ?? ''), // ✅ auto update on change
            }
          : r,
      ),
    );
  };

  const handleDeleteRow = (rowId: number) => {
    setTableRows(prev => {
      if (prev.length === 1) return [makeEmptyRow()];
      return prev.filter(r => r.rowId !== rowId);
    });
  };

  const handleAddRow = () => {
    const lastRow = tableRows[tableRows.length - 1];
    if (!isRowComplete(lastRow)) {
      Alert.alert(
        'Incomplete Row',
        'Please fill Item, Type, Description and Quantity before adding a new row.',
      );
      return;
    }
    setTableRows(prev => [...prev, makeEmptyRow()]);
  };

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleProceed = async () => {
    if (!selectedFromVendorStore) {
      Alert.alert('Validation', 'Please select a vendor store.');
      return;
    }
    if (!selectedToCompanyStore) {
      Alert.alert('Validation', 'Please select a company store.');
      return;
    }
    if (!gpsLat || !gpsLong) {
      Alert.alert('Validation', 'Please fetch GPS location first.');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Validation', 'Please enter the GPS address.');
      return;
    }
    if (!landmark.trim()) {
      Alert.alert('Validation', 'Please enter a landmark.');
      return;
    }
    if (selectedEmployees.length === 0) {
      Alert.alert('Validation', 'Please select at least one employee.');
      return;
    }
    if (!driverName.trim()) {
      Alert.alert('Validation', 'Please enter driver name.');
      return;
    }
    if (!vehicleNumber.trim()) {
      Alert.alert('Validation', 'Please enter vehicle number.');
      return;
    }
    // FIX: itemId forwarded RAW from itemIdParam — never coerced with Number()
    // itemTypeId is numeric so Number() is safe there
    const stockReturnItemList = tableRows.map(row => ({
      itemId: Number(
        row.selectedType?.itemIdIntParam ?? row.selectedType?.itemIdInt ?? 0,
      ),
      itemTypeId: Number(row.selectedType?.itemTypeId ?? 0),
      qty: Number(row.quantity) || 0,
      drumNo: row.selectedDrum?.drumNo ?? '',
    }));
    const employeeIds = selectedEmployees.map(e => e.id).join(',');
    const payload = {
      projectId: Number(projectId),
      vendorId: Number(savedVendorId),
      toStoreId: Number(selectedToCompanyStore?.id ?? 0),
      fromVendorStoreId: Number(selectedFromVendorStore?.id ?? 0),
      driverName: driverName.trim(),
      vehicleNumber: vehicleNumber.trim(),
      employeeIds,
      remarks: remarks.trim(),
      createdBy,
      companyId,
      stockReturnItemList,
      lat: gpsLat,
      lng: gpsLong,
      gpsLocation: address.trim(),
      landmark: landmark.trim(),
    };

    console.log('RETURN STOCK PAYLOAD =>', JSON.stringify(payload, null, 2));

    try {
      setIsSubmitting(true);
      const result = await dispatch(insertUpdateStockReturnAPI(payload));
      if (insertUpdateStockReturnAPI.fulfilled.match(result)) {
        Common.showToast('Stock returned successfully!');
        navigation.goBack();
      } else {
        const errMsg =
          (result.payload as string) ?? 'Failed to submit. Please try again.';
        Alert.alert('Error', errMsg);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation?.goBack()}
          style={styles.backBtn}>
          <Image
            source={IMAGES.back}
            style={styles.backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <Text style={styles.title}>Return Material</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {/* ── Project Name ── */}
          <View style={styles.fieldRow}>
            <View style={styles.labelWrap}>
              <Text style={styles.label}>Project Name</Text>
              <Text style={styles.required}> *</Text>
            </View>
            <Text style={styles.readonlyInput}>{projectCode}</Text>
          </View>
          {/* ── Vendor Name ── */}
          <View style={styles.fieldRow}>
            <View style={styles.labelWrap}>
              <Text style={styles.label}>Vendor Name</Text>
              <Text style={styles.required}> *</Text>
            </View>
            <DssCustomPicker
              data={vendorListData ?? []}
              value={selectedVendor}
              placeholder="Select Vendor"
              labelKey="vendorName"
              onSelect={handleVendorSelect}
            />{' '}
          </View>

          {/* ── From Vendor Store ── */}
          <View style={styles.fieldRow}>
            <View style={styles.labelWrap}>
              <Text style={styles.label}>From Vendor Store</Text>
              <Text style={styles.required}> *</Text>
            </View>
            {isLoadingVendorStore ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator
                  size="small"
                  color={COLORS.colorDeepskyblue}
                />
                <Text style={styles.loadingText}>Loading stores...</Text>
              </View>
            ) : (
              <DssCustomPicker
                data={vendorStoreList}
                value={selectedFromVendorStore}
                placeholder="Select Vendor Store"
                labelKey="name"
                onSelect={handleFromVendorStoreSelect}
              />
            )}
          </View>

          {/* ── To Company Store ── */}
          <View style={styles.fieldRow}>
            <View style={styles.labelWrap}>
              <Text style={styles.label}>To Company Store</Text>
              <Text style={styles.required}> *</Text>
            </View>
            {isLoadingCompanyStore ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator
                  size="small"
                  color={COLORS.colorDeepskyblue}
                />
                <Text style={styles.loadingText}>Loading stores...</Text>
              </View>
            ) : (
              <DssCustomPicker
                data={companyStoreList}
                value={selectedToCompanyStore}
                placeholder="Select Company Store"
                labelKey="name"
                onSelect={setSelectedToCompanyStore}
              />
            )}
          </View>

          {/* ── Driver Name ── */}
          <View style={styles.fieldRow}>
            <View style={styles.labelWrap}>
              <Text style={styles.label}>Driver Name</Text>
              <Text style={styles.required}> *</Text>
            </View>
            <TextInput
              style={styles.readonlyInput}
              value={driverName}
              onChangeText={setDriverName}
              placeholder="Enter Driver Name"
              placeholderTextColor={COLORS.colorDarkgray}
            />
          </View>

          {/* ── Vehicle No. ── */}
          <View style={styles.fieldRow}>
            <View style={styles.labelWrap}>
              <Text style={styles.label}>Vehicle No.</Text>
              <Text style={styles.required}> *</Text>
            </View>
            <TextInput
              style={styles.readonlyInput}
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
              placeholder="e.g. DL01AB1234"
              placeholderTextColor={COLORS.colorDarkgray}
              autoCapitalize="characters"
            />
          </View>

          {/* ── Item Table ── */}
          <View style={styles.table}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.thCell, styles.colItem]}>Item</Text>
              <Text style={[styles.thCell, styles.colType]}>Type</Text>
              <Text style={[styles.thCell, styles.colDesc]}>Desc.</Text>
              <Text style={[styles.thCell, styles.colDrum]}>Drum No.</Text>
              <Text style={[styles.thCell, styles.colQty]}>Qty.</Text>
              {/* <Text
                style={[
                  styles.thCell,
                  styles.colAction,
                  {borderRightWidth: 0},
                ]}>
                {''}
              </Text> */}
            </View>

            {/* Rows */}
            {isLoadingMaster || isFetchingProjectItems ? (
              <View style={styles.tableStateRow}>
                <ActivityIndicator
                  size="small"
                  color={COLORS.colorDeepskyblue}
                />
                <Text style={styles.stateText}>Loading items...</Text>
              </View>
            ) : (
              tableRows.map((row, index) => {
                const isLast = index === tableRows.length - 1;
                return (
                  <View
                    key={row.rowId}
                    style={[styles.tableRow, isLast && styles.tableRowLast]}>
                    {/* Item picker */}
                    <View
                      style={[
                        styles.tdWrap,
                        styles.colItem,
                        styles.pickerCell,
                      ]}>
                      <DssCustomPicker
                        data={masterList}
                        value={row.selectedItem}
                        placeholder={!selectedFromVendorStore ? '—' : 'Select'}
                        labelKey="itemName"
                        onSelect={item => handleItemSelect(row.rowId, item)}
                      />
                    </View>
                    {/* Type picker */}
                    <View
                      style={[
                        styles.tdWrap,
                        styles.colType,
                        styles.pickerCell,
                      ]}>
                      {row.isLoadingType ? (
                        <ActivityIndicator
                          size="small"
                          color={COLORS.colorDeepskyblue}
                        />
                      ) : (
                        <DssCustomPicker
                          data={row.typeList}
                          value={
                            row.selectedType
                              ? {
                                  ...row.selectedType,
                                  dropdownLabel: row.selectedType.itemType,
                                }
                              : null
                          }
                          placeholder={!row.selectedItem ? '—' : 'Select'}
                          labelKey="dropdownLabel"
                          onSelect={type => handleTypeSelect(row.rowId, type)}
                        />
                      )}
                    </View>
                    {/* Desc */}
                    <View style={[styles.tdWrap, styles.colDesc]}>
                      <TextInput
                        style={styles.descInput}
                        value={row.description}
                        onChangeText={text => handleDescChange(row.rowId, text)}
                        placeholder="—"
                        placeholderTextColor={COLORS.colorDarkgray ?? '#999'}
                        editable={false}
                      />
                    </View>
                    {/* ── Drum No. picker ── */}
                    <View
                      style={[
                        styles.tdWrap,
                        styles.colDrum,
                        styles.pickerCell,
                      ]}>
                      {row.isLoadingDrum ? (
                        <ActivityIndicator
                          size="small"
                          color={COLORS.colorDeepskyblue}
                        />
                      ) : (
                        <DssCustomPicker
                          data={row.drumList}
                          value={row.selectedDrum}
                          placeholder={
                            !row.selectedType
                              ? '—'
                              : row.drumList.length === 0
                              ? 'N/A'
                              : 'Select'
                          }
                          labelKey="drumNo"
                          onSelect={drum => handleDrumSelect(row.rowId, drum)}
                        />
                      )}
                    </View>
                    {/* Qty */}
                    <View style={[styles.tdWrap, styles.colQty]}>
                      <TextInput
                        style={styles.qtyInput}
                        value={row.quantity}
                        onChangeText={text => handleQtyChange(row.rowId, text)}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={COLORS.colorDarkgray ?? '#999'}
                        maxLength={6}
                        editable={!!selectedFromVendorStore}
                      />
                    </View>
                    {/* Delete
                    <View
                      style={[
                        styles.tdWrap,
                        styles.colAction,
                        {borderRightWidth: 0},
                      ]}>
                      <TouchableOpacity
                        onPress={() => handleDeleteRow(row.rowId)}
                        activeOpacity={0.7}
                        style={styles.deleteBtn}>
                        <Text style={styles.deleteBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View> */}
                  </View>
                );
              })
            )}
          </View>

          {/* ── Add Item ── */}
          <View style={styles.addItemRow}>
            <TouchableOpacity
              style={[
                styles.addItemBtn,
                (!selectedFromVendorStore ||
                  isLoadingMaster ||
                  isFetchingProjectItems) &&
                  styles.btnDisabled,
              ]}
              activeOpacity={0.85}
              disabled={
                !selectedFromVendorStore ||
                isLoadingMaster ||
                isFetchingProjectItems
              }
              onPress={handleAddRow}>
              <Text style={styles.addItemBtnText}>+ Add Item</Text>
            </TouchableOpacity>
          </View>

          {/* ── GPS Address Section ── */}
          <View style={styles.gpsLabelRow}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>GPS Address</Text>
              <Text style={styles.required}> *</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.gpsBtn,
                (isCountingDown || isLoadingGps) && styles.btnDisabled,
              ]}
              activeOpacity={0.85}
              onPress={handleGetGPS}
              disabled={isCountingDown || isLoadingGps}>
              <Text style={styles.gpsBtnText}>
                {isLoadingGps
                  ? 'Fetching...'
                  : countdown !== null
                  ? `GPS... ${countdown}s`
                  : 'Get GPS'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Countdown progress bar */}
          {isCountingDown && (
            <View style={styles.countdownWrap}>
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
            </View>
          )}

          {/* GPS status banner */}
          {!gpsLat || !gpsLong ? (
            <View style={styles.gpsWarningBanner}>
              <Text style={styles.gpsWarningText}>
                ⚠ Tap "Get GPS" to auto-fill the address with your current
                location.
              </Text>
            </View>
          ) : (
            <View style={styles.gpsReadyBanner}>
              <Text style={styles.gpsReadyText}>
                ✓ GPS fetched — Lat: {gpsLat}° Long: {gpsLong}°
              </Text>
            </View>
          )}

          {/* Address (auto-filled, editable) */}
          <View style={styles.infoBox}>
            <TextInput
              style={styles.textInput}
              value={address}
              onChangeText={setAddress}
              placeholder="Address will auto-fill after GPS fetch"
              placeholderTextColor={COLORS.colorDarkgray}
              multiline
            />
          </View>
          {/* Location error */}
          {!!locationError && (
            <Text style={styles.errorText}>{locationError}</Text>
          )}
          {/* ── Landmark ── */}
          <View style={styles.fieldBlock}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Landmark</Text>
              <Text style={styles.required}> *</Text>
            </View>
            <View style={styles.infoBox}>
              <TextInput
                style={styles.textInput}
                value={landmark}
                onChangeText={setLandmark}
                placeholder="Enter Landmark"
                placeholderTextColor={COLORS.colorDarkgray}
              />
            </View>
          </View>

          {/* ── Send Alerts to (Employee picker) ── */}
          <View style={styles.fieldBlock}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Send Alerts to</Text>
              <Text style={styles.required}> *</Text>
            </View>
            <TouchableOpacity activeOpacity={0.8} onPress={openEmployeeScreen}>
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.inputPlaceholder}
                  value={
                    selectedEmployees.length > 0
                      ? selectedEmployees
                          .map(e => `${e.employeeName} (${e.employeeCode})`)
                          .join(', ')
                      : ''
                  }
                  placeholder="Select Employee"
                  placeholderTextColor={COLORS.colorDarkgray ?? '#999'}
                  editable={false}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                />
                <Image
                  source={IMAGES.down}
                  style={{
                    position: 'absolute',
                    right: 12,
                    width: 10,
                    height: 6,
                    top: '50%',
                  }}
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* ── Remarks ── */}
          <View style={styles.fieldBlock}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Remarks</Text>
              <Text style={styles.required}> *</Text>
            </View>
            <View style={styles.infoBox}>
              <TextInput
                style={styles.textInput}
                value={remarks}
                onChangeText={setRemarks}
                placeholder="Enter Remarks"
                placeholderTextColor={COLORS.colorDarkgray}
              />
            </View>
          </View>

          {/* ── Proceed ── */}
          <TouchableOpacity
            style={[styles.proceedBtn, isSubmitting && styles.btnDisabled]}
            onPress={handleProceed}
            disabled={isSubmitting}
            activeOpacity={0.85}>
            {isSubmitting ? (
              <ActivityIndicator size="small" color={COLORS.colorWhite} />
            ) : (
              <Text style={styles.proceedText}>Proceed to Return</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default ReturnStockScreen;

/* ── Styles ── */
const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: COLORS.colorBackground},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 36,
    paddingBottom: 12,
    backgroundColor: COLORS.colorBackground,
  },
  backBtn: {width: 32, alignItems: 'flex-start', justifyContent: 'center'},
  backIcon: {width: 24, height: 24},
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.colorDarkslategray200,
    fontFamily: FontFamily.switzer,
    textAlign: 'center',
    flex: 1,
  },
  scroll: {flex: 1},
  scrollContent: {paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32},
  card: {
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  fieldRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  labelWrap: {flexDirection: 'row', alignItems: 'center'},
  rowFields: {
    flexDirection: 'row',
    gap: 10,
  },
  rowFieldItem: {
    flex: 1,
    gap: 6,
  },
  fieldBlock: {gap: 6},
  labelRow: {flexDirection: 'row', alignItems: 'center'},
  label: {
    fontSize: FontSize.fs_14,
    color: COLORS.colorDarkslategray200,
    fontFamily: FontFamily.switzer,
    letterSpacing: LetterSpacing.ls_0_2,
  },
  required: {
    color: COLORS.colorRed,
    fontSize: FontSize.fs_14,
    fontFamily: FontFamily.switzer,
  },
  readonlyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderRadius: Border.br_8,
    backgroundColor: '#F7F9FB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 38,
    fontSize: FontSize.fs_14,
    color: COLORS.colorDarkslategray200,
    fontFamily: FontFamily.switzer,
  },
  infoBox: {
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.colorWhite,
    minHeight: 40,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 14,
    color: COLORS.colorDarkslategray,
    padding: 0,
    margin: 0,
    lineHeight: 20,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  loadingText: {
    fontSize: FontSize.fs_13,
    color: COLORS.colorDarkgray,
    fontFamily: FontFamily.switzer,
  },
  // ── Table ─────────────────────────────────────────────────────────────
  table: {
    borderRadius: Border.br_8,
    borderWidth: 1,
    borderColor: '#B0C4DE',
    overflow: 'hidden',
    marginTop: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#D6E4F0',
    borderBottomWidth: 1,
    borderBottomColor: '#B0C4DE',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#D6E4F0',
    backgroundColor: COLORS.colorWhite,
    minHeight: 48,
    alignItems: 'center',
  },
  tableRowLast: {borderBottomWidth: 0},
  tableStateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  stateText: {
    fontSize: FontSize.fs_13,
    color: COLORS.colorDarkgray ?? '#999',
    fontFamily: FontFamily.switzer,
  },
  // Column widths
  colItem: {flex: 1.4},
  colType: {flex: 1.2},
  colDesc: {flex: 1.1},
  colQty: {width: 52},
  colDrum: {width: 80},
  colAction: {width: 38},
  thCell: {
    fontSize: FontSize.fs_11,
    color: COLORS.colorDarkslategray200,
    fontFamily: FontFamily.switzer,
    letterSpacing: LetterSpacing.ls_0_2,
    paddingVertical: 8,
    paddingHorizontal: 3,
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#B0C4DE',
  },
  tdWrap: {
    borderRightWidth: 1,
    borderRightColor: '#D6E4F0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    alignSelf: 'stretch',
  },
  pickerCell: {
    paddingHorizontal: 3,
    paddingVertical: 4,
  },
  qtyInput: {
    fontSize: FontSize.fs_12,
    fontFamily: FontFamily.switzer,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: COLORS.colorWhite,
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 2,
    width: 40,
    backgroundColor: '#F7F9FB',
  },
  descInput: {
    fontSize: FontSize.fs_12,
    fontWeight: '500',
  },
  deleteBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFE5E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontSize: 9,
    color: '#E53935',
    fontWeight: '700',
    lineHeight: 13,
  },
  addItemRow: {flexDirection: 'row', justifyContent: 'flex-end'},
  addItemBtn: {
    backgroundColor: COLORS.colorDeepskyblue,
    borderRadius: Border.br_5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  addItemBtnText: {
    color: COLORS.colorWhite,
    fontSize: FontSize.fs_12,
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
  },
  btnDisabled: {opacity: 0.45},
  // ── GPS ────────────────────────────────────────────────────────────────
  gpsLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gpsBtn: {
    backgroundColor: COLORS.colorDeepskyblue100,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  gpsBtnText: {color: COLORS.colorWhite, fontSize: 12, fontWeight: '500'},
  countdownWrap: {gap: 4},
  countdownBarBg: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  countdownBarFill: {
    height: 4,
    backgroundColor: COLORS.colorDeepskyblue100,
    borderRadius: 4,
  },
  countdownText: {
    fontSize: 11,
    color: COLORS.colorDeepskyblue,
    fontFamily: FontFamily.switzer,
    textAlign: 'center',
    marginTop: 2,
  },
  gpsWarningBanner: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  gpsWarningText: {
    fontSize: 12,
    color: '#E65100',
    fontFamily: FontFamily.switzer,
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
  gpsReadyText: {
    fontSize: 12,
    color: '#2E7D32',
    fontFamily: FontFamily.switzer,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.colorRed,
    fontFamily: FontFamily.switzer,
    marginTop: 2,
  },
  // ── Proceed ──────────────────────────────────────────────────────────
  proceedBtn: {
    backgroundColor: COLORS.colorDeepskyblue100,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  proceedText: {
    color: COLORS.colorWhite,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  inputBox: {
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderRadius: Border.br_8,
    backgroundColor: COLORS.colorWhite,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 38,
    justifyContent: 'center',
  },
  inputPlaceholder: {
    fontSize: FontSize.fs_14,
    color: COLORS.colorDarkslategray200,
    fontFamily: FontFamily.switzer,
    lineHeight: LineHeight.lh_22,
    padding: 0,
    margin: 0,
  },
});
