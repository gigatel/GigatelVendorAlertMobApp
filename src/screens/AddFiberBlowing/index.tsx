import React, {useState, useEffect, FC} from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {useDispatch} from 'react-redux';
import {ScreenProps} from '@types';
import {Screen} from '@organisms';
import DssCustomPicker from '../../components/molecules/DsscustomPicker';
import {CaptureImageWatermark} from '@molecules';
import {COLORS, IMAGES, FONTS} from '@res';
import {
  FontSize,
  Padding,
  Border,
  LineHeight,
  Gap,
  Height,
  LetterSpacing,
} from '../../res/globalStyle';
import {
  insertFiberBlowingDetails,
  VendorStoreListAPI,
  getProjectStoreItemListAPI,
  getDrumNumberListAPI,
} from '../../store/slices/dss.slice';
import type {BurnResult} from '../../components/molecules/capture-image-watermark/index';

const AddFiberBlowing: FC<ScreenProps.AddFiberBlowing> = ({
  navigation,
  route,
}) => {
  const dispatch = useDispatch<any>();
  const {
    projectId,
    vendorId,
    CurrentChamberInstallationId,
    distanceFromUser,
    pitLocationId,
    sldeReportData,
    ductNo,
    previousPitInstallationId,
    nextPitInstallationId,
    loopData,
    vendorStoreId,
    fibreTypeId,
    pitId,
    fromChamberInstallationId,
    toChamberInstallationId,
    pitType,
  } = route?.params;
  console.log('pitType:', {pitType});
  // ── Mode flag ─────────────────────────────────────────────────────────────
  const hasSldCode =
    sldeReportData?.sldCode !== null &&
    sldeReportData?.sldCode !== undefined &&
    String(sldeReportData?.sldCode).trim() !== '';
  console.log('sldeReportData', {sldeReportData});
  console.log('hasSldCode:', hasSldCode);
  console.log(
    'params:',
    {previousPitInstallationId},
    {nextPitInstallationId},
    {distanceFromUser},
  );
  // ── Parse vendorId(s) ─────────────────────────────────────────────────────
  // vendorId can be a single id or comma-separated list e.g. "1,2,3"
  // vendorId = "1,2"
  // vendorName = "ABC Vendor,XYZ Vendor"
  const vendorIds = String(vendorId ?? '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
  const vendorNames = String(route?.params?.vendorName ?? '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);

  const vendorIdList: {id: number; label: string}[] = vendorIds.map(
    (id, index) => ({
      id: Number(id),
      label:
        vendorNames[index] && vendorNames[index] !== ''
          ? vendorNames[index]
          : `Vendor ${index + 1}`,
    }),
  );
  const isSingleVendor = vendorIdList.length <= 1;

  // The resolved single vendor id (auto if single, or chosen from picker)
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(
    isSingleVendor && vendorIdList.length === 1 ? vendorIdList[0].id : null,
  );
  const [selectedVendorItem, setSelectedVendorItem] = useState<any>(
    isSingleVendor && vendorIdList.length === 1 ? vendorIdList[0] : null,
  );

  // ── GPS ───────────────────────────────────────────────────────────────────
  const gpsLat = sldeReportData?.lat?.toString() ?? '';
  const gpsLong = sldeReportData?.lon?.toString() ?? '';

  // ── Form fields (shared) ──────────────────────────────────────────────────
  const [address, setAddress] = useState(sldeReportData?.pitAddress ?? '');
  const [landmark, setLandmark] = useState(sldeReportData?.pitLandmark ?? '');
  const [remarks, setRemarks] = useState('');
  const [manualLoopLength, setManualLoopLength] = useState('');

  // ── UI state ──────────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Image state ───────────────────────────────────────────────────────────
  const [pic1, setPic1] = useState<BurnResult | null>(null);
  const [pic2, setPic2] = useState<BurnResult | null>(null);

  // ══════════════════════════════════════════════════════════════════════════
  // MODE A: hasSldCode = true → simple TextInput fields
  // ══════════════════════════════════════════════════════════════════════════
  const [sld, setSld] = useState(
    hasSldCode ? String(sldeReportData?.sldCode).trim() : '',
  );
  const [fiberTypeName] = useState(sldeReportData?.fiberType ?? '');
  const [drumNumberText, setDrumNumberText] = useState(
    sldeReportData?.drumNo ?? '',
  );
  // ══════════════════════════════════════════════════════════════════════════
  // MODE B: hasSldCode = false → API-driven pickers
  // ══════════════════════════════════════════════════════════════════════════
  // ── Vendor Store ──────────────────────────────────────────────────────────
  const [vendorListData, setVendorListData] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [isLoadingStore, setIsLoadingStore] = useState(false);

  // ── Fiber Type ────────────────────────────────────────────────────────────
  const [itemTypeList, setItemTypeList] = useState<any[]>([]);
  const [fiberTypeSelected, setFiberTypeSelected] = useState<any>(null);
  const [isLoadingFiberTypes, setIsLoadingFiberTypes] = useState(false);

  // ── Drum Number ───────────────────────────────────────────────────────────
  const [drumList, setDrumList] = useState<any[]>([]);
  const [selectedDrum, setSelectedDrum] = useState<any>(null);
  const [isLoadingDrums, setIsLoadingDrums] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // API: Drum Number List  (Mode B only)
  // ───────────────────────────────────────────────────────────₹──────────────
  const fetchDrumNumbers = async (
    projId: number,
    storeId: number,
    itemTypeId: number,
  ) => {
    try {
      setIsLoadingDrums(true);
      setDrumList([]);
      setSelectedDrum(null);

      const response: any = await dispatch(
        getDrumNumberListAPI({projectId: projId, storeId, itemId: itemTypeId}),
      ).unwrap();

      const list = Array.isArray(response) ? response : [];
      setDrumList(list);
      if (list.length === 1) {
        setSelectedDrum({
          lotNo: list[0]?.lotNo,
          qty: list[0]?.qty,
        });
      }
    } catch (error) {
      console.log('Drum Number API Error:', error);
      setDrumList([]);
    } finally {
      setIsLoadingDrums(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // API: Fiber Type List  (Mode B only)
  // ─────────────────────────────────────────────────────────────────────────
  const fetchFiberTypes = async (
    projId: number,
    storeId: number,
    itemId: number,
  ) => {
    try {
      setIsLoadingFiberTypes(true);
      setItemTypeList([]);
      setFiberTypeSelected(null);
      setDrumList([]);
      setSelectedDrum(null);

      const response: any = await dispatch(
        getProjectStoreItemListAPI({projectId: projId, storeId, itemId}),
      ).unwrap();

      const list = Array.isArray(response) ? response : [];
      setItemTypeList(list);

      if (list.length === 1) {
        setFiberTypeSelected(list[0]);
        fetchDrumNumbers(Number(projId), Number(storeId), Number(list[0].id));
      }
    } catch (error) {
      console.log('Fiber Type API Error:', error);
      setItemTypeList([]);
    } finally {
      setIsLoadingFiberTypes(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // API: Vendor Store List  (Mode B only)
  // ─────────────────────────────────────────────────────────────────────────
  const fetchVendorStoreList = async (resolvedVendorId: number) => {
    if (!resolvedVendorId || !projectId) return;
    try {
      setIsLoadingStore(true);
      setVendorListData([]);
      setSelectedVendor(null);
      setItemTypeList([]);
      setFiberTypeSelected(null);
      setDrumList([]);
      setSelectedDrum(null);

      const result = await dispatch(
        VendorStoreListAPI({
          vendorId: resolvedVendorId,
          projectId: Number(projectId),
        }),
      ).unwrap();

      const data = Array.isArray(result) ? result : [];
      setVendorListData(data);

      if (data.length === 1) {
        const store = {id: data[0].id, storeName: data[0].storeName};
        setSelectedVendor(store);
        fetchFiberTypes(Number(projectId), Number(data[0].id), 1);
      }
    } catch (error) {
      console.log('Vendor Store API Error:', error);
      setVendorListData([]);
    } finally {
      setIsLoadingStore(false);
    }
  };

  // Fetch store list only in Mode B
  // - If single vendor: fetch immediately on mount
  // - If multiple vendors: fetch only after user selects a vendor
  useEffect(() => {
    if (!hasSldCode && selectedVendorId) {
      fetchVendorStoreList(selectedVendorId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVendorId]);

  // ─────────────────────────────────────────────────────────────────────────
  // Validate & Submit
  // ─────────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (isSubmitting) return;

    const isCouplerPit =
      String(pitType ?? '')
        .trim()
        .toLowerCase() === 'coupler';

    const errs: Record<string, boolean> = {};

    if (hasSldCode) {
      if (!sld.trim()) errs.sld = true;
      if (!drumNumberText.trim()) errs.drumNumber = true;
    } else {
      if (!isSingleVendor && !selectedVendorId) errs.selectedVendorId = true;
      if (!selectedVendor) errs.vendor = true;
      if (!fiberTypeSelected) errs.fiberType = true;
      if (!selectedDrum) errs.drumNumber = true;
    }

    if (!address.trim()) errs.address = true;
    if (!landmark.trim()) errs.landmark = true;
    if (!remarks.trim()) errs.remarks = true;
    if (!pic1) errs.image1 = true;
    if (!pic2) errs.image2 = true;

    // if (!isCouplerPit && Number(loopData) === 0 && !manualLoopLength.trim()) {
    //   errs.manualLoopLength = true;
    // }
    if (
      !hasSldCode &&
      !isCouplerPit &&
      Number(loopData) === 0 &&
      !manualLoopLength.trim()
    ) {
      errs.manualLoopLength = true;
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      Alert.alert('Missing Fields', 'Please fill all required fields.');
      return;
    }

    const fibreLoopLength = isCouplerPit
      ? 0
      : Number(loopData) > 0
      ? Number(loopData)
      : Number(manualLoopLength);
    // const fibreLoopLength =
    //   hasSldCode || isCouplerPit
    //     ? 0
    //     : Number(loopData) > 0
    //     ? Number(loopData)
    //     : Number(manualLoopLength);
    const fibreType: string | number = hasSldCode
      ? fibreTypeId && Number(fibreTypeId) !== 0
        ? Number(fibreTypeId)
        : fiberTypeName ?? ''
      : Number(fiberTypeSelected?.id ?? 0);

    const params = {
      projectId: Number(projectId),
      id: sldeReportData?.id ?? 0,
      vendorId:
        selectedVendorId ??
        Number(String(vendorId)?.split(',')[0]?.trim() ?? 0),
      vendorStoreId: hasSldCode
        ? Number(vendorStoreId ?? 0)
        : Number(selectedVendor?.id ?? 0),
      colorId: 0,
      shotMapDuctColorId: sldeReportData?.shotMapDuctColorId ?? 0,
      fromChamberInstallId: Number(fromChamberInstallationId ?? 0),
      toChamberInstallId: Number(toChamberInstallationId ?? 0),
      fibreLength: Number(distanceFromUser ?? 0),
      fibreLoopLength,
      fibreDrumNo: hasSldCode
        ? drumNumberText.trim()
        : String(selectedDrum?.lotNo ?? ''),
      fibreType,
      ChamberInstallId: Number(CurrentChamberInstallationId ?? 0),
      DuctNo: Number(ductNo ?? 0),
      PitId: Number(pitId ?? 0),
      remark: remarks.trim(),
      drumPic: pic1,
      chamberPic: pic2,
    };

    console.log('Submit params:', params);

    setIsSubmitting(true);
    try {
      await dispatch(insertFiberBlowingDetails(params)).unwrap();
      Alert.alert('Success', 'Fiber blowing details submitted successfully!', [
        {text: 'OK', onPress: () => navigation?.goBack()},
      ]);
    } catch (error: any) {
      Alert.alert(
        'Submission Failed',
        typeof error === 'string'
          ? error
          : error?.message ?? 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  // const handleSubmit = async () => {
  //   if (isSubmitting) return;

  //   const errs: Record<string, boolean> = {};

  //   if (hasSldCode) {
  //     if (!sld.trim()) errs.sld = true;
  //     if (!drumNumberText.trim()) errs.drumNumber = true;
  //   } else {
  //     if (!isSingleVendor && !selectedVendorId) errs.selectedVendorId = true;
  //     if (!selectedVendor) errs.vendor = true;
  //     if (!fiberTypeSelected) errs.fiberType = true;
  //     if (!selectedDrum) errs.drumNumber = true;
  //   }

  //   if (!address.trim()) errs.address = true;
  //   if (!landmark.trim()) errs.landmark = true;
  //   if (!remarks.trim()) errs.remarks = true;
  //   if (!pic1) errs.image1 = true;
  //   if (!pic2) errs.image2 = true;

  //   // Loop length — skip validation for coupler pit type
  //   const isCouplerPit = String(pitType).trim().toLowerCase() === 'coupler';
  //   if (!isCouplerPit && Number(loopData) === 0 && !manualLoopLength.trim()) {
  //     errs.manualLoopLength = true;
  //   }

  //   if (Object.keys(errs).length > 0) {
  //     setErrors(errs);
  //     Alert.alert('Missing Fields', 'Please fill all required fields.');
  //     return;
  //   }

  //   // ── Resolve fibreLoopLength ──────────────────────────────────────────────
  //   let fibreLoopLength = 0;
  //   if (isCouplerPit) {
  //     fibreLoopLength = 0;
  //   } else if (Number(loopData) > 0) {
  //     fibreLoopLength = Number(loopData);
  //   } else {
  //     fibreLoopLength = Number(manualLoopLength);
  //   }

  //   // ── Resolve fibreType ────────────────────────────────────────────────────
  //   let fibreType: string | number = 0;
  //   if (hasSldCode) {
  //     fibreType =
  //       fibreTypeId && Number(fibreTypeId) !== 0
  //         ? Number(fibreTypeId)
  //         : fiberTypeName ?? '';
  //   } else {
  //     fibreType = Number(fiberTypeSelected?.id ?? 0);
  //   }

  //   const params = {
  //     projectId: Number(projectId),
  //     id: sldeReportData?.id ?? 0,
  //     vendorId:
  //       selectedVendorId ??
  //       Number(String(vendorId)?.split(',')[0]?.trim() ?? 0),
  //     vendorStoreId: hasSldCode
  //       ? Number(vendorStoreId ?? 0)
  //       : Number(selectedVendor?.id ?? 0),
  //     colorId: 0,
  //     shotMapDuctColorId: sldeReportData?.shotMapDuctColorId ?? 0,
  //     fromChamberInstallId: Number(fromChamberInstallationId ?? 0),
  //     toChamberInstallId: Number(toChamberInstallationId ?? 0),
  //     fibreLength: Number(distanceFromUser ?? 0),
  //     fibreLoopLength,
  //     fibreDrumNo: hasSldCode
  //       ? drumNumberText.trim()
  //       : String(selectedDrum?.lotNo ?? ''),
  //     fibreType,
  //     ChamberInstallId: Number(CurrentChamberInstallationId ?? 0),
  //     DuctNo: Number(ductNo ?? 0),
  //     PitId: Number(pitId ?? 0),
  //     remark: remarks.trim(),
  //     drumPic: pic1,
  //     chamberPic: pic2,
  //   };

  //   console.log('Submit params:', params);

  //   setIsSubmitting(true);
  //   try {
  //     await dispatch(insertFiberBlowingDetails(params)).unwrap();
  //     Alert.alert('Success', 'Fiber blowing details submitted successfully!', [
  //       {text: 'OK', onPress: () => navigation?.goBack()},
  //     ]);
  //   } catch (error: any) {
  //     Alert.alert(
  //       'Submission Failed',
  //       typeof error === 'string'
  //         ? error
  //         : error?.message ?? 'Something went wrong. Please try again.',
  //     );
  //   } finally {
  //     setIsSubmitting(false);
  //   }
  // };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS — Mode B pickers
  // ─────────────────────────────────────────────────────────────────────────

  // ── Multi-Vendor Picker (only shown when multiple vendor IDs come) ────────
  const renderVendorIdPicker = () => {
    if (isSingleVendor) return null;
    return (
      <View style={styles.ul}>
        <View style={styles.labelRow}>
          <Text style={styles.labelText}>Vendor</Text>
          <Text style={styles.required}> *</Text>
        </View>
        <DssCustomPicker
          data={vendorIdList}
          value={selectedVendorItem}
          placeholder="Select Vendor"
          labelKey="label"
          onSelect={(item: any) => {
            setSelectedVendorItem(item);
            setSelectedVendorId(item.id);
            // Reset downstream
            setVendorListData([]);
            setSelectedVendor(null);
            setItemTypeList([]);
            setFiberTypeSelected(null);
            setDrumList([]);
            setSelectedDrum(null);
            if (errors.selectedVendorId)
              setErrors(e => ({...e, selectedVendorId: false}));
          }}
          hasError={!!errors.selectedVendorId}
        />
      </View>
    );
  };

  const renderVendorStorePicker = () => {
    if (isLoadingStore) {
      return (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="small" color={COLORS.colorDeepskyblue} />
        </View>
      );
    }
    return (
      <DssCustomPicker
        data={vendorListData ?? []}
        value={selectedVendor}
        placeholder={
          !isSingleVendor && !selectedVendorId
            ? 'Select vendor first'
            : 'Select Store'
        }
        labelKey="storeName"
        onSelect={(item: any) => {
          const store = {id: item.id, storeName: item.storeName};
          setSelectedVendor(store);
          setItemTypeList([]);
          setFiberTypeSelected(null);
          setDrumList([]);
          setSelectedDrum(null);
          fetchFiberTypes(Number(projectId), Number(item.id), 1);
          if (errors.vendor) setErrors(e => ({...e, vendor: false}));
        }}
        hasError={!!errors.vendor}
        disabled={isLoadingStore || (!isSingleVendor && !selectedVendorId)}
      />
    );
  };

  const renderFiberTypePicker = () => {
    if (isLoadingFiberTypes) {
      return (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="small" color={COLORS.colorDeepskyblue} />
        </View>
      );
    }
    return (
      <DssCustomPicker
        data={itemTypeList}
        value={fiberTypeSelected}
        placeholder={
          !selectedVendor
            ? 'Select store first'
            : itemTypeList.length === 0
            ? 'No types available'
            : 'Select Fiber Type'
        }
        labelKey="name"
        onSelect={(item: any) => {
          setFiberTypeSelected(item);
          if (errors.fiberType) setErrors(e => ({...e, fiberType: false}));
          setDrumList([]);
          setSelectedDrum(null);
          fetchDrumNumbers(
            Number(projectId),
            Number(selectedVendor?.id),
            Number(item.id),
          );
        }}
        hasError={!!errors.fiberType}
        disabled={!selectedVendor || itemTypeList.length === 0}
      />
    );
  };

  const renderDrumNumberPicker = () => {
    if (isLoadingDrums) {
      return (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="small" color={COLORS.colorDeepskyblue} />
        </View>
      );
    }
    return (
      <DssCustomPicker
        data={drumList}
        value={selectedDrum}
        placeholder={
          !fiberTypeSelected
            ? 'Select fiber type first'
            : drumList.length === 0
            ? 'No drums available'
            : 'Select Drum No.'
        }
        labelKey="lotNo"
        onSelect={(item: any) => {
          console.log('Selected Drum:', item);
          setSelectedDrum({
            lotNo: item?.lotNo,
            qty: item?.qty,
          });
          if (errors.drumNumber) {
            setErrors(e => ({...e, drumNumber: false}));
          }
        }}
        hasError={!!errors.drumNumber}
        disabled={!fiberTypeSelected || drumList.length === 0}
      />
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Screen statusBgColor={COLORS.BACKGROUND_DEFAULT} statusBarStyle="light">
      <View style={styles.body}>
        <View style={styles.main}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation?.goBack()}
              style={styles.backWrap}>
              <Image
                style={styles.backIcon}
                source={IMAGES.arrowBack}
                resizeMode="cover"
              />
            </TouchableOpacity>
            <Text style={styles.title}>Fiber Blowing</Text>
            <View style={styles.backWrap} />
          </View>{' '}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            <View style={styles.card}>
              <View style={styles.ul}>
                {hasSldCode ? (
                  /* ══════════════════════════════════════════════════════
                     MODE A — sldCode is present
                     Fields: SLD | Fiber Type (read-only) | Drum Number | Distance
                     Vendor Store → NOT shown at all
                     ══════════════════════════════════════════════════════ */
                  <>
                    {/* Row: SLD + Fiber Type (read-only) */}
                    <View style={styles.row}>
                      {/* SLD */}
                      <View style={styles.col}>
                        <View style={styles.labelRow}>
                          <Text style={styles.labelText}>SLD</Text>
                          <Text style={styles.required}> *</Text>
                        </View>
                        <TextInput
                          style={[
                            styles.input,
                            errors.sld && styles.inputError,
                          ]}
                          value={sld}
                          onChangeText={v => {
                            setSld(v);
                            if (errors.sld)
                              setErrors(e => ({...e, sld: false}));
                          }}
                          editable={false}
                          placeholder="SLD-CODE"
                          placeholderTextColor={COLORS.colorGray || '#9ca3af'}
                        />
                      </View>

                      {/* Fiber Type — read-only */}
                      <View style={styles.col}>
                        <View style={styles.labelRow}>
                          <Text style={styles.labelText}>Fiber Type</Text>
                          <Text style={styles.required}> *</Text>
                        </View>
                        <TextInput
                          style={styles.input}
                          value={fiberTypeName}
                          editable={false}
                          placeholder="Fiber Type"
                          placeholderTextColor={COLORS.colorGray || '#9ca3af'}
                        />
                      </View>
                    </View>

                    {/* Row: Drum Number (editable) + Distance (read-only) */}
                    <View style={styles.row}>
                      {/* Drum Number */}
                      <View style={styles.col}>
                        <View style={styles.labelRow}>
                          <Text style={styles.labelText}>Drum Number</Text>
                          <Text style={styles.required}> *</Text>
                        </View>
                        <TextInput
                          style={[
                            styles.input,
                            {backgroundColor: COLORS?.colorWhite},
                            errors.drumNumber && styles.inputError,
                          ]}
                          value={drumNumberText}
                          onChangeText={v => {
                            setDrumNumberText(v);
                            if (errors.drumNumber)
                              setErrors(e => ({...e, drumNumber: false}));
                          }}
                          placeholder="D-2000"
                          editable={false}
                          placeholderTextColor={COLORS.colorGray || '#9ca3af'}
                        />
                      </View>

                      {/* Distance */}
                      <View style={styles.col}>
                        <View style={styles.labelRow}>
                          <Text style={styles.labelText}>Distance</Text>
                          <Text style={styles.required}> *</Text>
                        </View>
                        <TextInput
                          style={styles.input}
                          value={String(distanceFromUser ?? '')}
                          editable={false}
                          placeholder="Enter Distance"
                          placeholderTextColor={COLORS.colorGray || '#9ca3af'}
                        />
                      </View>
                    </View>
                  </>
                ) : (
                  /* ══════════════════════════════════════════════════════
                     MODE B — no sldCode
                     If multiple vendors → show Vendor picker first
                     Then: Vendor Store (picker) | Fiber Type (picker)
                           | Drum Number (picker) | Distance
                     ══════════════════════════════════════════════════════ */
                  <>
                    {/* Vendor picker — only if multiple vendor IDs */}
                    {renderVendorIdPicker()}

                    {/* Row: Vendor Store + Fiber Type */}
                    <View style={styles.row}>
                      <View style={styles.col}>
                        <View style={styles.labelRow}>
                          <Text style={styles.labelText}>Vendor Store</Text>
                          <Text style={styles.required}> *</Text>
                        </View>
                        {renderVendorStorePicker()}
                      </View>

                      <View style={styles.col}>
                        <View style={styles.labelRow}>
                          <Text style={styles.labelText}>Fiber Type</Text>
                          <Text style={styles.required}> *</Text>
                        </View>
                        {renderFiberTypePicker()}
                      </View>
                    </View>

                    {/* Row: Drum Number + Distance */}
                    <View style={styles.row}>
                      <View style={styles.col}>
                        <View style={styles.labelRow}>
                          <Text style={styles.labelText}>Drum Number</Text>
                          <Text style={styles.required}> *</Text>
                        </View>
                        {renderDrumNumberPicker()}
                      </View>

                      <View style={styles.col}>
                        <View style={styles.labelRow}>
                          <Text style={styles.labelText}>Distance</Text>
                          <Text style={styles.required}> *</Text>
                        </View>
                        <TextInput
                          style={styles.input}
                          value={String(distanceFromUser ?? '')}
                          editable={false}
                          placeholder="Enter Distance"
                          placeholderTextColor={COLORS.colorGray || '#9ca3af'}
                        />
                      </View>
                    </View>
                  </>
                )}

                {/* ══ Loop Length — shown in BOTH modes when loopData = 0 ══ */}
                {/* ══ Loop Length — hide completely when sldCode exists ══ */}
                {!hasSldCode && (
                  <View style={styles.ul}>
                    <View style={styles.labelRow}>
                      <Text style={styles.labelText}>Loop Length</Text>
                      <Text style={styles.required}> *</Text>
                    </View>

                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor:
                            String(pitType).trim().toLowerCase() === 'coupler'
                              ? '#E5E7EB'
                              : COLORS?.colorWhite,
                        },
                        errors.manualLoopLength && styles.inputError,
                      ]}
                      value={
                        String(pitType).trim().toLowerCase() === 'coupler'
                          ? '0'
                          : Number(loopData) > 0
                          ? String(loopData)
                          : manualLoopLength
                      }
                      onChangeText={v => {
                        if (
                          String(pitType).trim().toLowerCase() === 'coupler'
                        ) {
                          return;
                        }

                        setManualLoopLength(v);

                        if (errors.manualLoopLength) {
                          setErrors(e => ({
                            ...e,
                            manualLoopLength: false,
                          }));
                        }
                      }}
                      editable={
                        String(pitType).trim().toLowerCase() !== 'coupler'
                      }
                      placeholder="Enter Loop Length"
                      keyboardType="numeric"
                      placeholderTextColor={COLORS.colorGray || '#9ca3af'}
                    />
                  </View>
                )}

                {/* ══ Latitude / Longitude ══ */}
                <View style={styles.ul}>
                  <View style={styles.labelRow}>
                    <Text style={styles.labelText}>Latitude/Longitude</Text>
                    <Text style={styles.required}> *</Text>
                  </View>
                  <View style={styles.row}>
                    <TextInput
                      style={[styles.input, styles.flex1]}
                      value={gpsLat}
                      placeholder="Latitude"
                      placeholderTextColor={COLORS.colorGray || '#9ca3af'}
                      editable={false}
                    />
                    <TextInput
                      style={[styles.input, styles.flex1]}
                      value={gpsLong}
                      placeholder="Longitude"
                      placeholderTextColor={COLORS.colorGray || '#9ca3af'}
                      editable={false}
                    />
                  </View>
                </View>

                {/* ══ Address ══ */}
                <View style={styles.ul}>
                  <View style={styles.labelRow}>
                    <Text style={styles.labelText}>Address</Text>
                    <Text style={styles.required}> *</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      {backgroundColor: COLORS?.colorWhite},
                      errors.address && styles.inputError,
                    ]}
                    value={address}
                    onChangeText={v => {
                      setAddress(v);
                      if (errors.address)
                        setErrors(e => ({...e, address: false}));
                    }}
                    placeholder="Enter Address"
                    placeholderTextColor={COLORS.colorGray || '#9ca3af'}
                  />
                </View>

                {/* ══ Landmark ══ */}
                <View style={styles.ul}>
                  <View style={styles.labelRow}>
                    <Text style={styles.labelText}>Landmark</Text>
                    <Text style={styles.required}> *</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      {backgroundColor: COLORS?.colorWhite},
                      errors.landmark && styles.inputError,
                    ]}
                    value={landmark}
                    onChangeText={v => {
                      setLandmark(v);
                      if (errors.landmark)
                        setErrors(e => ({...e, landmark: false}));
                    }}
                    placeholder="Enter Landmark"
                    placeholderTextColor={COLORS.colorGray || '#9ca3af'}
                  />
                </View>

                {/* ══ Fiber Blowing Images ══ */}
                <View style={styles.ul}>
                  <View style={styles.labelRow}>
                    <Text style={styles.labelText}>Fiber Blowing Images</Text>
                    <Text style={styles.required}> *</Text>
                  </View>
                  <View style={styles.imagesRow}>
                    <View style={styles.imageCol}>
                      <CaptureImageWatermark
                        title="Drum Pic"
                        pic={pic1}
                        setPic={result => {
                          setPic1(result);
                          if (result && errors.image1)
                            setErrors(e => ({...e, image1: false}));
                        }}
                        lat={gpsLat}
                        long={gpsLong}
                        address={address}
                        hasError={!!errors.image1}
                      />
                    </View>
                    <View style={styles.imageCol}>
                      <CaptureImageWatermark
                        title="Chamber Pic"
                        pic={pic2}
                        setPic={result => {
                          setPic2(result);
                          if (result && errors.image2)
                            setErrors(e => ({...e, image2: false}));
                        }}
                        lat={gpsLat}
                        long={gpsLong}
                        address={address}
                        hasError={!!errors.image2}
                      />
                    </View>
                  </View>
                </View>

                {/* ══ Remarks ══ */}
                <View style={styles.ul}>
                  <View style={styles.labelRow}>
                    <Text style={styles.labelText}>Remarks</Text>
                    <Text style={styles.required}> *</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      {backgroundColor: COLORS?.colorWhite},
                      styles.textarea,
                      errors.remarks && styles.inputError,
                    ]}
                    value={remarks}
                    onChangeText={v => {
                      setRemarks(v);
                      if (errors.remarks)
                        setErrors(e => ({...e, remarks: false}));
                    }}
                    placeholder="Enter Remarks"
                    placeholderTextColor={COLORS.colorGray || '#9ca3af'}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                {/* ══ Submit ══ */}
                <TouchableOpacity
                  style={[styles.submitBtn, isSubmitting && {opacity: 0.7}]}
                  activeOpacity={0.85}
                  disabled={isSubmitting}
                  onPress={handleSubmit}>
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={COLORS.colorWhite} />
                  ) : (
                    <Text style={styles.submitText}>Submit</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Screen>
  );
};

export default AddFiberBlowing;
// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  body: {flex: 1, paddingTop: 16},
  main: {flex: 1, gap: 12},
  scrollContent: {paddingHorizontal: 12, paddingBottom: 32},

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: Height.height_24,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  backWrap: {width: 32},
  backIcon: {width: 24, height: 24},
  title: {
    fontSize: 18,
    fontFamily: FONTS.REGULAR,
    color: COLORS.colorDarkslategray,
    textAlign: 'center',
    flex: 1,
  },

  card: {
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 6,
    padding: Padding.padding_16,
  },

  ul: {gap: Gap.gap_12, alignSelf: 'stretch'},
  row: {flexDirection: 'row', alignSelf: 'stretch', gap: Gap.gap_12},
  col: {flex: 1, gap: Gap.gap_12},
  flex1: {flex: 1},
  imagesRow: {flexDirection: 'row', gap: Gap.gap_12, alignSelf: 'stretch'},
  imageCol: {flex: 1},

  labelRow: {flexDirection: 'row', alignItems: 'center'},
  labelText: {
    fontSize: FontSize.fs_14,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
    letterSpacing: LetterSpacing.ls_0_2,
  },
  required: {
    fontSize: FontSize.fs_14,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorRed,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderRadius: Border.br_8,
    paddingHorizontal: Padding.padding_12,
    paddingVertical: Padding.padding_6,
    fontSize: FontSize.fs_14,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
    lineHeight: LineHeight.lh_22,
    backgroundColor: COLORS.colorWhitesmoke,
    alignSelf: 'stretch',
  },
  inputError: {borderColor: COLORS.colorRed || '#f44'},
  textarea: {minHeight: 80, paddingTop: Padding.padding_8},
  loaderBox: {
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderRadius: Border.br_8,
    paddingVertical: Padding.padding_6 + 4,
    backgroundColor: COLORS.colorWhitesmoke,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    minHeight: 42,
  },
  submitBtn: {
    backgroundColor: COLORS.colorDeepskyblue,
    borderRadius: Border.br_8,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    elevation: 3,
    shadowColor: COLORS.colorDeepskyblue,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 6,
    marginTop: 4,
  },
  submitText: {
    fontSize: FontSize.fs_14,
    fontFamily: FONTS.MEDIUM,
    fontWeight: '500',
    color: COLORS.colorWhite,
    textAlign: 'center',
  },
});
