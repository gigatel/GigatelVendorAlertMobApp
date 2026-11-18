import {
  StyleSheet,
  Text,
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import React, {FC, useState, useEffect, useRef} from 'react';
import {ScreenProps} from '@types';
import {
  Border,
  FontFamily,
  LineHeight,
  FontSize,
  LetterSpacing,
} from '../../res/globalStyle';
import {COLORS, FONTS, IMAGES} from '@res';
import {useDispatch} from 'react-redux';
import {
  VendorStoreListAPI,
  getMasterListAPI,
  getProjectItemByStoreAPI,
  getEmployeeDetailsApi,
  insertUpdateStockRequestAPI,
  getVendorListForShot, // ADD
} from '@slices/dss.slice';
import {useSelector} from 'react-redux';
import DssCustomPicker from '../../components/molecules/DsscustomPicker';
import {Location, Common} from '@utils';
import {DataType} from '@types';
import {useNavigation} from '@react-navigation/native';
import DatePicker from 'react-native-date-picker';
// ── Types ──────────────────────────────────────────────────────────────────────
type MasterItem = {
  id: number;
  itemName: string;
  //
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
  itemId?: number | string;
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

// ── Date formatter DD/MM/YYYY ──────────────────────────────────────────────────
const formatDateDisplay = (date: Date): string => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const RequirementStockScreen: FC<ScreenProps.StockRequirement> = ({
  navigation,
  route,
}) => {
  const {projectId, projectCode, vendorName, vendorID} = route?.params;
  const dispatch = useDispatch<any>();
  const {vendorListData} = useSelector((state: any) => state.dss);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [savedVendorId, setSavedVendorId] = useState<any>(vendorID ?? null);
  const [savedVendorCode, setSavedVendorCode] = useState<any>(null);
  const [urgent, setUrgent] = useState(false);

  // ── Vendor store ───────────────────────────────────────────────────────
  const [isLoadingStore, setIsLoadingStore] = useState(false);
  const [vendorStoreList, setVendorStoreList] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<any[]>([]);

  // ── Master item list ───────────────────────────────────────────────────
  const [masterList, setMasterList] = useState<MasterItem[]>([]);
  const [isLoadingMaster, setIsLoadingMaster] = useState(false);

  // ── All project type items (fetched once per store, shared across rows) ─
  const [allProjectItems, setAllProjectItems] = useState<TypeItem[]>([]);
  const [isFetchingProjectItems, setIsFetchingProjectItems] = useState(false);
  // const [gpsLat, setGpsLat] = useState<string | null>('');
  // const [gpsLong, setGpsLong] = useState<string | null>('');
  // const [address, setAddress] = useState<string>('');
  // const [landmark, setLandmark] = useState<string>('');
  // ── GPS state ──────────────────────────────────────────────────────────
  const [gpsLat, setGpsLat] = useState<string | null>('');
  const [gpsLong, setGpsLong] = useState<string | null>('');
  const [address, setAddress] = useState<string>('');
  const [landmark, setLandmark] = useState<string>('');

  const [locationError, setLocationError] = useState('');
  const [isLoadingGps, setIsLoadingGps] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCountingDown = countdown !== null;

  // ── Date Picker state ──────────────────────────────────────────────────
  const [requiredOnDate, setRequiredOnDate] = useState<Date>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // ── Remarks state ──────────────────────────────────────────────────────
  const [remarks, setRemarks] = useState<string>('');
  const getNumericValue = (val: any): number => {
    const num = String(val || '').replace(/\D/g, '');
    return num ? Number(num) : 0;
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
  });

  const [tableRows, setTableRows] = useState<TableRow[]>([makeEmptyRow()]);

  useEffect(
    () => () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    },
    [],
  );
  useEffect(() => {
    const loadVendorList = async () => {
      dispatch(
        getVendorListForShot({
          employeeID: '',
          projectId,
        }),
      );
    };

    loadVendorList();
  }, [projectId]);
  useEffect(() => {
    if (vendorListData?.length === 1 && !selectedVendor) {
      const item = vendorListData[0];

      setSelectedVendor(item);
      setSavedVendorId(item?.vendorId);
      setSavedVendorCode(item?.vendorCode);

      fetchVendorStoreList(item?.vendorId);
    }
  }, [vendorListData]);
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
  const openEmployeeScreen = () => {
    navigation.navigate('EmployeeSelectionScreen', {
      selected: selectedEmployees,
      onSelect: (data: any[]) => setSelectedEmployees(data),
    });
  };

  // ── Fetch master list + project items when store selected ──────────────
  useEffect(() => {
    if (selectedStore) {
      fetchMasterList(selectedStore);
      fetchAllProjectItems();
    } else {
      setMasterList([]);
      setAllProjectItems([]);
    }
  }, [selectedStore]);

  // ── API: vendor store list ─────────────────────────────────────────────
  const fetchVendorStoreList = async (vendorId: string | number) => {
    try {
      setIsLoadingStore(true);
      setVendorStoreList([]);
      setSelectedStore(null);
      setMasterList([]);
      setAllProjectItems([]);
      setTableRows([makeEmptyRow()]);

      const result = await dispatch(VendorStoreListAPI({vendorId, projectId}));

      if (VendorStoreListAPI.fulfilled.match(result)) {
        const raw = result.payload;
        const data: any[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.data)
          ? raw.data
          : [];

        const formattedData = data.map(item => ({
          ...item,
          label: item.storeName || item.name || `Store ${item.id}`,
        }));

        setVendorStoreList(formattedData);

        if (formattedData.length === 1) {
          setSelectedStore(formattedData[0]);
        }
      } else {
        setVendorStoreList([]);
      }
    } catch (error) {
      setVendorStoreList([]);
    } finally {
      setIsLoadingStore(false);
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
        setAllProjectItems(data);
      }
    } catch {
      setAllProjectItems([]);
    } finally {
      setIsFetchingProjectItems(false);
    }
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
          Alert.alert('Weak GPS', 'Please Try again');
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
  const handleVendorSelect = (item: any) => {
    setSelectedVendor(item);
    setSavedVendorId(item?.vendorId);
    setSavedVendorCode(item?.vendorCode);

    setSelectedStore(null);
    setVendorStoreList([]);
    setMasterList([]);
    setAllProjectItems([]);

    fetchVendorStoreList(item?.vendorId);
  };

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    try {
      // Validation
      if (!selectedStore) {
        Alert.alert('Validation', 'Please select a vendor store.');
        return;
      }
      if (!gpsLat || !gpsLong) {
        Alert.alert('Validation', 'Please fetch GPS location first.');
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
      // Employee ids (comma string)
      const employeeIds = selectedEmployees.map(e => e.id).join(',');
      // Items mapping
      // const requestedItemList = tableRows.map(row => ({
      //   descriptionId: row.selectedItem?.itemTypeId,
      //   itemId: row.selectedItem?.itemId ?? 0,
      //   itemTypeId: row.selectedItem?.itemTypeId ?? 0,
      //   qty: Number(row.quantity) || 0,
      // }));
      const requestedItemList = tableRows.map(row => ({
        descriptionId: getNumericValue(row.selectedType?.itemTypeId),
        itemId: getNumericValue(row.selectedType?.itemIdInt), // ✅ FIXED
        itemTypeId: getNumericValue(row.selectedType?.itemTypeId),
        qty: Number(row.quantity) || 0,
      }));
      const payload = {
        id: 0,
        projectId: projectId,
        storeId: selectedStore?.id ?? 0,
        vendorId: savedVendorId,
        employeeId: employeeIds,
        gpsLocation: address,
        isUrgent: urgent,
        landmark: landmark,
        lat: gpsLat,
        lng: gpsLong,
        remarks: remarks,
        // ✅ Send selected date as ISO string to API
        requiredOn: requiredOnDate.toISOString(),
        requestedItemList: requestedItemList,
      };
      console.log('FINAL PAYLOAD =>', payload);
      const result = await dispatch(insertUpdateStockRequestAPI(payload));
      if (insertUpdateStockRequestAPI.fulfilled.match(result)) {
        Alert.alert('Success', 'Stock Request Created');
        navigation.goBack();
      } else {
        Alert.alert('Error', result.payload || 'Something went wrong.');
      }
    } catch (err) {
      console.log(err);
      Alert.alert('Error', 'Unexpected error occurred.');
    }
  };
  // ── Validate row completeness ──────────────────────────────────────────
  const isRowComplete = (row: TableRow): boolean => {
    return (
      row.selectedItem !== null &&
      row.selectedType !== null &&
      row.quantity.trim() !== '' &&
      row.description.trim() !== ''
    );
  };
  // ── Handlers ──────────────────────────────────────────────────────────
  const handleStoreSelect = (store: any) => {
    setSelectedStore(store);
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
            }
          : r,
      ),
    );
  };

  const handleTypeSelect = (rowId: number, type: TypeItem) => {
    setTableRows(prev =>
      prev.map(r =>
        r.rowId === rowId
          ? {
              ...r,
              selectedType: type,
              description: type.itemSpecification ?? '',
            }
          : r,
      ),
    );
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

  return (
    <View style={styles.body}>
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
        <Text style={styles.title}>Requirement</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          {/* Project Name */}
          <View style={styles.fieldRow}>
            <View style={styles.labelWrap}>
              <Text style={styles.label}>Project Name</Text>
              <Text style={styles.required}> *</Text>
            </View>
            <Text style={styles.readonlyInput}>{projectCode}</Text>
          </View>
          {/* Vendor Name */}
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
            />
          </View>
          {/* Vendor Store */}
          <View style={styles.fieldRow}>
            <View style={styles.labelWrap}>
              <Text style={styles.label}>Vendor Store</Text>
              <Text style={styles.required}> *</Text>
            </View>
            <DssCustomPicker
              data={vendorStoreList}
              value={selectedStore}
              placeholder={isLoadingStore ? 'Loading...' : 'Select Store'}
              labelKey="storeName"
              onSelect={handleStoreSelect}
            />
          </View>
          {/* ── Table ── */}
          <View style={styles.table}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.thCell, styles.colItem]}>Item</Text>
              <Text style={[styles.thCell, styles.colType]}>Type</Text>
              <Text style={[styles.thCell, styles.colDesc]}>Desc.</Text>
              <Text style={[styles.thCell, styles.colQty]}>Qty.</Text>
              <Text
                style={[
                  styles.thCell,
                  styles.colAction,
                  {borderRightWidth: 0},
                ]}>
                {''}
              </Text>
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
                        placeholder={!selectedStore ? '—' : 'Select'}
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
                        editable={!!selectedStore}
                      />
                    </View>

                    {/* Delete */}
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
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Add Item */}
          <View style={styles.addItemRow}>
            <TouchableOpacity
              style={[
                styles.addItemBtn,
                (!selectedStore || isLoadingMaster || isFetchingProjectItems) &&
                  styles.btnDisabled,
              ]}
              activeOpacity={0.85}
              disabled={
                !selectedStore || isLoadingMaster || isFetchingProjectItems
              }
              onPress={handleAddRow}>
              <Text style={styles.addItemBtnText}>+ Add Item</Text>
            </TouchableOpacity>
          </View>

          {/* ── GPS Address Section ── */}
          <View style={styles.gpsLabelRow}>
            <View style={styles.labelWrap}>
              <Text style={styles.label}>GPS Address</Text>
              <Text style={styles.required}> *</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.getGpsBtn,
                (isCountingDown || isLoadingGps) && styles.btnDisabled,
              ]}
              activeOpacity={0.85}
              onPress={handleGetGPS}
              disabled={isCountingDown || isLoadingGps}>
              <Text style={styles.getGpsBtnText}>
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
          <View style={styles.inputBox}>
            <TextInput
              style={styles.inputPlaceholder}
              value={address}
              onChangeText={setAddress}
              placeholder="Address will auto-fill after GPS fetch"
              placeholderTextColor={COLORS.colorDarkgray ?? '#999'}
              multiline
            />
          </View>

          {/* Location error */}
          {!!locationError && (
            <Text style={styles.errorText}>{locationError}</Text>
          )}

          {/* Landmark */}
          <View style={styles.labelWrap}>
            <Text style={styles.label}>Landmark</Text>
            <Text style={styles.required}> *</Text>
          </View>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.inputPlaceholder}
              value={landmark}
              onChangeText={setLandmark}
              placeholder="Enter Landmark"
              placeholderTextColor={COLORS.colorDarkgray ?? '#999'}
            />
          </View>

          {/* ── Required on Date ── */}
          <View style={styles.labelWrap}>
            <Text style={styles.label}>Required on Date</Text>
            <Text style={styles.required}> *</Text>
          </View>
          <View style={styles.dateRow}>
            {/* Date display box */}
            <View style={styles.dateBox}>
              <Text style={styles.dateValue}>
                {formatDateDisplay(requiredOnDate)}
              </Text>
              <Image
                source={IMAGES.calendar ?? IMAGES.back}
                style={styles.calendarIcon}
                resizeMode="contain"
              />
            </View>

            {/* Set button opens DatePicker */}
            <TouchableOpacity
              style={styles.setBtn}
              activeOpacity={0.85}
              onPress={() => setIsDatePickerOpen(true)}>
              <Text style={styles.setBtnText}>Set</Text>
            </TouchableOpacity>

            {/* Urgent checkbox */}
            <TouchableOpacity
              style={styles.urgentRow}
              activeOpacity={0.8}
              onPress={() => setUrgent(v => !v)}>
              <View style={[styles.checkbox, urgent && styles.checkboxChecked]}>
                {urgent && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.urgentText}>Urgent</Text>
            </TouchableOpacity>
          </View>

          {/* ── react-native-date-picker Modal ── */}
          <DatePicker
            modal
            open={isDatePickerOpen}
            date={requiredOnDate}
            mode="date"
            minimumDate={new Date()}
            title="Select Required Date"
            confirmText="Confirm"
            cancelText="Cancel"
            onConfirm={(date: Date) => {
              setIsDatePickerOpen(false);
              setRequiredOnDate(date);
            }}
            onCancel={() => {
              setIsDatePickerOpen(false);
            }}
          />

          {/* Send Alerts to */}
          <View style={styles.labelWrap}>
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
                source={IMAGES.dropdownArrow}
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

          {/* Remarks */}
          <View style={styles.labelWrap}>
            <Text style={styles.label}>Remarks</Text>
            <Text style={styles.required}> *</Text>
          </View>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.inputPlaceholder}
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Enter Remarks"
              placeholderTextColor={COLORS.colorDarkgray ?? '#999'}
            />
          </View>

          {/* Create Requirement */}
          <TouchableOpacity style={styles.createBtn} onPress={handleSubmit}>
            <Text style={styles.createBtnText}>Create Requirement</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default RequirementStockScreen;

const styles = StyleSheet.create({
  body: {flex: 1, backgroundColor: '#F0F4FF', paddingTop: 16},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 44,
    backgroundColor: '#F0F4FF',
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
  // ── Table ──────────────────────────────────────────────────────────────
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
  colSno: {width: 40},
  colItem: {flex: 1.5},
  colType: {flex: 1.3},
  colDesc: {flex: 1.2},
  colQty: {width: 60},
  colAction: {width: 40},
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
  tdCell: {
    fontSize: FontSize.fs_12,
    color: COLORS.colorDarkslategray200,
    fontFamily: FontFamily.switzer,
    textAlign: 'center',
  },
  qtyInput: {
    fontSize: FontSize.fs_12,
    // color: 'transparent',
    fontFamily: FontFamily.switzer,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: COLORS.colorWhite,
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 2,
    width: 44,
    backgroundColor: '#F7F9FB',
  },
  descInput: {
    fontSize: FontSize.fs_12,
    fontWeight: 500,
    //    fontWeight: FONTS.BOLD,
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
  getGpsBtn: {
    backgroundColor: COLORS.colorDeepskyblue,
    borderRadius: Border.br_5,
    paddingHorizontal: 14,
    paddingVertical: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  getGpsBtnText: {
    color: COLORS.colorWhite,
    fontSize: FontSize.fs_12,
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
  },
  countdownWrap: {marginTop: 2, marginBottom: 2, gap: 4},
  countdownBarBg: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  countdownBarFill: {
    height: 4,
    backgroundColor: COLORS.colorDeepskyblue,
    borderRadius: 4,
  },
  countdownText: {
    fontSize: FontSize.fs_11,
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
    fontSize: FontSize.fs_12,
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
    fontSize: FontSize.fs_12,
    color: '#2E7D32',
    fontFamily: FontFamily.switzer,
  },
  errorText: {
    fontSize: FontSize.fs_12,
    color: COLORS.colorRed,
    fontFamily: FontFamily.switzer,
    marginTop: 2,
  },

  // ── Other fields ───────────────────────────────────────────────────────
  dropdownStatic: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderRadius: Border.br_8,
    backgroundColor: COLORS.colorWhite,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 38,
  },
  dropdownValue: {
    flex: 1,
    fontSize: FontSize.fs_14,
    color: COLORS.colorDarkslategray200,
    fontFamily: FontFamily.switzer,
    lineHeight: LineHeight.lh_22,
  },
  dropdownArrow: {width: 10, height: 6, opacity: 0.8},
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
  inputValue: {
    fontSize: FontSize.fs_14,
    color: COLORS.colorDarkslategray200,
    fontFamily: FontFamily.switzer,
    lineHeight: LineHeight.lh_22,
  },
  inputPlaceholder: {
    fontSize: FontSize.fs_14,
    color: COLORS.colorDarkslategray200,
    fontFamily: FontFamily.switzer,
    lineHeight: LineHeight.lh_22,
    padding: 0,
    margin: 0,
  },
  dateRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderRadius: Border.br_8,
    backgroundColor: COLORS.colorWhite,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    minWidth: 130,
  },
  dateValue: {
    fontSize: FontSize.fs_14,
    color: COLORS.colorDarkslategray200,
    fontFamily: FontFamily.switzer,
    flex: 1,
  },
  calendarIcon: {width: 16, height: 16, opacity: 0.7},
  setBtn: {
    backgroundColor: COLORS.colorDeepskyblue,
    borderRadius: Border.br_8,
    paddingHorizontal: 16,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  setBtnText: {
    color: COLORS.colorWhite,
    fontSize: FontSize.fs_13,
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
  },
  urgentRow: {flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1},
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: COLORS.colorDarkgray ?? '#9E9E9E',
    backgroundColor: COLORS.colorWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.colorDeepskyblue,
    borderColor: COLORS.colorDeepskyblue,
  },
  checkmark: {color: COLORS.colorWhite, fontSize: 10, lineHeight: 14},
  urgentText: {
    fontSize: FontSize.fs_14,
    color: COLORS.colorDarkslategray200,
    fontFamily: FontFamily.switzer,
  },
  createBtn: {
    backgroundColor: COLORS.colorDeepskyblue,
    borderRadius: Border.br_8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 3,
    marginTop: 4,
  },
  createBtnText: {
    color: COLORS.colorWhite,
    fontSize: FontSize.fs_14,
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
  },
});
