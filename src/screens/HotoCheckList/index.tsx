import React, {FC, useState, useEffect, useRef} from 'react';
import {
  Text,
  Image,
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {connect, useDispatch} from 'react-redux';
import {ScreenProps} from '@types';
import {
  Gap,
  Padding,
  Border,
  BoxShadow,
  FontFamily,
  Width,
  LetterSpacing,
  FontSize,
  Height,
  LineHeight,
} from '../../res/globalStyle';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {Screen} from '@organisms';
import {Common, Location, Preferences} from '@utils';
import {resetStore, RootState, StoreDispatch} from '@reducers';
import CaptureImageWatermark, {
  BurnResult,
} from '../../components/molecules/capture-image-watermark';
import {
  getHotoCheckListById,
  insertUpdateHotoCheckListAPI,
} from '../../store/slices/dss.slice';
import Geolocation, {
  GeolocationResponse,
} from '@react-native-community/geolocation';
type ActionType = 'toggle' | 'toggleImages' | 'reading';
interface RowConfig {
  id: string;
  sno: number;
  scope: string;
  type: ActionType;
  options?: [string, string];
  // if set, a small dropdown picker renders inline in the SCOPE cell (left side)
  scopeDropdownOptions?: string[];
}
interface RowState {
  selected?: string;
  reading?: string;
  dropdownValue?: string;
  image1: BurnResult | null;
  image2: BurnResult | null;
}
const initRowState = (rows: RowConfig[]): Record<string, RowState> => {
  const init: Record<string, RowState> = {};
  rows.forEach(row => {
    init[row.id] = {
      image1: null,
      image2: null,
      // default dropdown selection (e.g. JC/Loop row -> 'JC')
      dropdownValue: row.scopeDropdownOptions?.[0],
    };
  });
  return init;
};
// ---------- Convert a server image URL into a BurnResult-shaped object ----------
// CaptureImageWatermark expects a BurnResult; when we're loading a previously
// submitted checklist we only have plain URLs from the API, so we wrap them.
const toServerImage = (url?: string | null): BurnResult | null => {
  if (!url) return null;
  return {uri: url} as unknown as BurnResult;
};

// ---------- Robust GPS helper (same pattern as PitInstallation) ----------
// Tries high accuracy first; if it fails/times out, falls back to low accuracy.
// Also keeps a background watch running to silently improve accuracy if a
// better fix (accuracy <= 25m) comes in while the first result is already in use.
// Timeouts trimmed down (6s / 5s) so the UI doesn't sit blocked waiting on a
// slow/indoor fix — we resolve with whatever we get fastest and let the
// watcher silently upgrade it later.
type SmartLocationCallbacks = {
  onBetterLocation?: (pos: GeolocationResponse) => void;
};
const getSmartLocation = (
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
        // High accuracy failed (common indoors) — fall back to low accuracy / network location
        Geolocation.getCurrentPosition(
          (pos: GeolocationResponse) => {
            if (!isResolved) {
              isResolved = true;
              resolve(pos);
            }
          },
          reject,
          {enableHighAccuracy: false, timeout: 5000, maximumAge: 60000},
        );
      },
      {enableHighAccuracy: true, timeout: 6000, maximumAge: 0},
    );

    watchId = Geolocation.watchPosition(
      (pos: GeolocationResponse) => {
        if (pos.coords.accuracy <= 25) {
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

const HotoCheckList: FC<ScreenProps.HotoCheckList> = ({
  navigation,
  route,
  employeeDetails,
}) => {
  const dispatch = useDispatch<any>();

  // TODO: replace with real values from route.params / redux
  const projId = route?.params?.projectId ?? 0;
  // const vendorId = route?.params?.vendorId ?? 0;
  const chamberId = route?.params?.chamberId ?? 0;
  const recordId = route?.params?.id ?? 0;
  const fiberType = route?.params?.fiberType;
  const [existingHotoId, setExistingHotoId] = useState<number | null>(null);

  const CHECKLIST_ROWS: RowConfig[] = [
    {
      id: 'abd_graph',
      sno: 1,
      scope: 'ABD With Graph',
      type: 'toggle',
      options: ['Received', 'Pending'],
    },
    {
      id: 'fiber_type',
      sno: 2,
      scope: 'Fiber Type',
      type: 'toggle',
      options: ['Yes', 'No'],
      scopeDropdownOptions: Array.isArray(fiberType) ? fiberType : [fiberType],
    },
    {
      id: 'fiber_reading',
      sno: 3,
      scope: 'Fiber Reading',
      type: 'reading',
    },
    {
      id: 'chamber_cc_inside',
      sno: 4,
      scope: 'Chamber CC Inside',
      type: 'toggleImages',
      options: ['Complete', 'Pending'],
    },
    {
      id: 'chamber_cc_outside',
      sno: 5,
      scope: 'Chamber CC Outside',
      type: 'toggleImages',
      options: ['Complete', 'Pending'],
    },
    {
      id: 'simplex',
      sno: 6,
      scope: 'Simplex',
      type: 'toggleImages',
      options: ['Complete', 'Pending'],
    },
    {
      id: 'cable_tie',
      sno: 7,
      scope: 'Cable Tie',
      type: 'toggleImages',
      options: ['Yes', 'No'],
    },
    {
      id: 'jc_loop',
      sno: 8,
      scope: 'JC / Loop',
      type: 'toggleImages',
      options: ['Yes', 'No'],
      scopeDropdownOptions: ['JC', 'Loop'],
    },
    {
      id: 'row_permission',
      sno: 9,
      scope: 'ROW Permission',
      type: 'toggle',
      options: ['Available', 'Pending'],
    },
  ];
  console.log('employeeDetails:=>', {employeeDetails});
  const loginInfo = Preferences.getData('LOGIN_RESPONSE') ?? {};
  const userId = loginInfo?.userId;
  const userName = loginInfo?.userName;

  const designationName = loginInfo?.designaionName;

  const [formData, setFormData] = useState<Record<string, RowState>>(
    initRowState(CHECKLIST_ROWS),
  );
  const projCode = route?.params?.projectCode;
  const projName = route?.params?.projectName;
  const vendorCodeName = route?.params?.vendorName;
  const employeeName = userName;

  // ---------- GPS state (auto-fetched on screen mount) ----------
  const [gpsLat, setGpsLat] = useState<string>('0');
  const [gpsLong, setGpsLong] = useState<string>('0');
  const [gpsAddress, setGpsAddress] = useState<string>('Fetching location...');
  // gpsLoading = waiting for raw coordinates (blocks Submit)
  const [gpsLoading, setGpsLoading] = useState(false);
  // addressLoading = waiting for reverse-geocoded address text only (does NOT block Submit)
  const [addressLoading, setAddressLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const locationStopRef = useRef<(() => void) | null>(null);

  const [remarks, setRemarks] = useState('');
  const [dropdownOpenFor, setDropdownOpenFor] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ---------- Existing checklist (edit mode) loading state ----------
  const [loadingChecklist, setLoadingChecklist] = useState(false);

  const dateTime = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // ---------- Resolve address for a given lat/long ----------
  // Runs independently of the GPS fetch flow so a slow reverse-geocode call
  // never blocks Submit — only the lat/long values do.
  const resolveAddress = async (lat: number, long: number) => {
    try {
      setAddressLoading(true);
      const data = await Location.getAddressFromLatLong({
        lat,
        lng: long,
        isOla: false,
      });
      setGpsAddress(data?.address || 'Address not found');
    } catch {
      setGpsAddress('Address not found');
    } finally {
      setAddressLoading(false);
    }
  };

  // ---------- Auto GPS fetch on page open ----------
  const fetchLocation = async () => {
    try {
      setGpsLoading(true);
      setGpsError('');
      setGpsAddress('Fetching location...');

      // Stop any previous watcher before starting a new attempt
      locationStopRef.current?.();

      let perm = await Location.checkPermission();
      if (
        perm !== 'granted' &&
        typeof (Location as any).requestPermission === 'function'
      ) {
        perm = await (Location as any).requestPermission();
      }
      if (perm !== 'granted') {
        setGpsError('Location permission is required.');
        setGpsAddress('Permission required to fetch address.');
        setGpsLoading(false);
        Alert.alert(
          'Permission Required',
          'Location permission is required to fetch GPS.',
        );
        return;
      }

      const locationPromise = getSmartLocation({
        onBetterLocation: betterPos => {
          // Silent upgrade — a more accurate fix arrived after we already resolved
          const lat = betterPos.coords.latitude;
          const long = betterPos.coords.longitude;
          setGpsLat(String(lat));
          setGpsLong(String(long));
          resolveAddress(lat, long);
          Common.showToast?.('GPS improved automatically 🎯');
        },
      });
      locationStopRef.current = locationPromise.stop ?? null;

      const position = await locationPromise;
      const lat = position.coords.latitude;
      const long = position.coords.longitude;
      const accuracy = position.coords.accuracy ?? 999;

      // Unblock the screen (and Submit) the moment we have coordinates —
      // don't wait for the address text to resolve.
      setGpsLat(String(lat));
      setGpsLong(String(long));
      setGpsLoading(false);

      if (accuracy > 100) {
        Common.showToast?.('Low accuracy (indoor), using approximate location');
      } else if (accuracy > 50) {
        Common.showToast?.('Moderate GPS accuracy');
      } else {
        Common.showToast?.('High GPS accuracy 🎯');
      }
      // Fire-and-forget: address resolves in the background via its own loader.
      resolveAddress(lat, long);
    } catch (e: any) {
      const msg =
        e?.code === 3
          ? 'GPS timed out. Move to open area and try again.'
          : e?.code === 2
          ? 'GPS unavailable. Please enable location services.'
          : 'Unable to fetch accurate GPS location.';
      setGpsError(msg);
      setGpsAddress('Unable to fetch location');
      setGpsLoading(false);
    }
  };

  // ---------- Map an existing API record onto formData / remarks ----------
  // Only fills in fields that are present on the record; anything not
  // returned by the API is left at its default (untouched) state.
  const populateFromRecord = (record: any) => {
    console.log('recordData:', record);
    // Capture the actual HotoId returned by getHotoCheckListById so submit
    // updates this same record instead of creating a duplicate.
    if (record?.hotoId != null) {
      setExistingHotoId(record.hotoId);
    }

    setFormData(prev => {
      const updated: Record<string, RowState> = {...prev};

      updated.abd_graph = {
        ...updated.abd_graph,
        selected: record.abdWithGraph || updated.abd_graph?.selected,
      };

      updated.fiber_type = {
        ...updated.fiber_type,
        selected: record.fiberStatus || updated.fiber_type?.selected,
      };

      updated.fiber_reading = {
        ...updated.fiber_reading,
        reading:
          record.fiberReading != null
            ? String(record.fiberReading)
            : updated.fiber_reading?.reading,
      };

      updated.chamber_cc_inside = {
        ...updated.chamber_cc_inside,
        selected: record.chamberCCInside || updated.chamber_cc_inside?.selected,
        image1: toServerImage(record.chamberCCInsideImage1),
        image2: toServerImage(record.chamberCCInsideImage2),
      };

      updated.chamber_cc_outside = {
        ...updated.chamber_cc_outside,
        selected:
          record.chamberCCOutside || updated.chamber_cc_outside?.selected,
        image1: toServerImage(record.chamberCCOutsideImage1),
        image2: toServerImage(record.chamberCCOutsideImage2),
      };

      updated.simplex = {
        ...updated.simplex,
        selected: record.simplex || updated.simplex?.selected,
        image1: toServerImage(record.simplexImage1),
        image2: toServerImage(record.simplexImage2),
      };

      updated.cable_tie = {
        ...updated.cable_tie,
        selected: record.cableTie || updated.cable_tie?.selected,
        image1: toServerImage(record.cableTieImage1),
        image2: toServerImage(record.cableTieImage2),
      };

      // JC / Loop share a single row — whichever one is non-null on the
      // record tells us which dropdown option was originally selected.
      if (record.loop != null) {
        updated.jc_loop = {
          ...updated.jc_loop,
          selected: record.loop || updated.jc_loop?.selected,
          dropdownValue: 'Loop',
          image1: toServerImage(record.loopImage1),
          image2: toServerImage(record.loopImage2),
        };
      } else if (record.jc != null) {
        updated.jc_loop = {
          ...updated.jc_loop,
          selected: record.jc || updated.jc_loop?.selected,
          dropdownValue: 'JC',
          image1: toServerImage(record.jcImage1),
          image2: toServerImage(record.jcImage2),
        };
      }

      updated.row_permission = {
        ...updated.row_permission,
        selected: record.rowPermission || updated.row_permission?.selected,
      };

      return updated;
    });

    if (record.remarks) {
      setRemarks(record.remarks);
    }
  };

  // ---------- Load existing checklist (if this chamber already has one) ----------
  const loadExistingChecklist = async () => {
    if (!projId || !chamberId) return;
    try {
      setLoadingChecklist(true);
      const result = await dispatch(
        getHotoCheckListById({projectId: projId, chamberId: chamberId}),
      ).unwrap();

      const record = Array.isArray(result) ? result[0] : result;
      if (record) {
        populateFromRecord(record);
      }
    } catch (e) {
      // No existing checklist for this chamber, or the fetch failed —
      // that's fine, screen just stays in its normal "fresh entry" state.
      console.log('No existing HOTO checklist found / fetch failed:', e);
    } finally {
      setLoadingChecklist(false);
    }
  };

  useEffect(() => {
    fetchLocation();
    loadExistingChecklist();
    return () => {
      locationStopRef.current?.();
    };
  }, []);

  // ---------- Handlers ----------
  const handleToggleSelect = (rowId: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [rowId]: {...prev[rowId], selected: value},
    }));
  };

  const handleReadingChange = (rowId: string, text: string) => {
    setFormData(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        reading: text,
      },
    }));
  };
  const handleDropdownSelect = (rowId: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [rowId]: {...prev[rowId], dropdownValue: value},
    }));
    setDropdownOpenFor(null);
  };

  const setRowImage = (
    rowId: string,
    slot: 'image1' | 'image2',
    result: BurnResult | null,
  ) => {
    setFormData(prev => ({
      ...prev,
      [rowId]: {...prev[rowId], [slot]: result},
    }));
  };

  const validateForm = (): boolean => {
    for (const row of CHECKLIST_ROWS) {
      const state = formData[row.id];
      if (row.type !== 'reading' && !state?.selected) {
        Alert.alert('Incomplete', `Please select a status for "${row.scope}"`);
        return false;
      }
      if (
        row.type === 'reading' &&
        (state?.reading === undefined || state?.reading === null)
      ) {
        Alert.alert('Incomplete', 'Please enter the fiber reading');
        return false;
      }
      // Extra check: JC/Loop dropdown must be explicitly resolved
      if (row.id === 'jc_loop' && !state?.dropdownValue) {
        Alert.alert('Incomplete', 'Please select JC or Loop first');
        return false;
      }
    }
    if (!gpsLat || !gpsLong || gpsLat === '0' || gpsLong === '0') {
      Alert.alert(
        'GPS Missing',
        'Unable to get GPS location. Please wait or retry before submitting.',
      );
      return false;
    }
    return true;
  };

  // ---------- Build API params from formData ----------
  const buildApiParams = () => {
    const abdGraph = formData['abd_graph'];
    const fiberType = formData['fiber_type'];
    const fiberReading = formData['fiber_reading'];
    const ccInside = formData['chamber_cc_inside'];
    const ccOutside = formData['chamber_cc_outside'];
    const simplex = formData['simplex'];
    const cableTie = formData['cable_tie'];
    const jcLoop = formData['jc_loop'];
    const rowPermission = formData['row_permission'];
    const isLoop = jcLoop?.dropdownValue === 'Loop';
    const isJc =
      jcLoop?.dropdownValue === 'JC' || (!isLoop && !!jcLoop?.dropdownValue);

    const params: any = {
      id: existingHotoId ?? recordId,
      projectId: projId,
      //vendorId: vendorId,
      //vendorId: 0,
      chamberId: chamberId,
      abdWithGraph: abdGraph?.selected ?? '',
      // "Fiber Type" scope carries both a Yes/No toggle and a size dropdown (24F/48F/96F/99F).
      // Sending the dropdown value (actual fiber type) as FiberType, with toggle status appended.
      fiberType: fiberType?.selected ?? '',
      fiberReading: fiberReading?.reading ?? '',
      chamberCCInside: ccInside?.selected ?? '',
      chamberCCInsideImage1: ccInside?.image1 ?? null,
      chamberCCInsideImage2: ccInside?.image2 ?? null,
      chamberCCOutside: ccOutside?.selected ?? '',
      chamberCCOutsideImage1: ccOutside?.image1 ?? null,
      chamberCCOutsideImage2: ccOutside?.image2 ?? null,
      simplex: simplex?.selected ?? '',
      simplexImage1: simplex?.image1 ?? null,
      simplexImage2: simplex?.image2 ?? null,

      cableTie: cableTie?.selected ?? '',
      cableTieImage1: cableTie?.image1 ?? null,
      cableTieImage2: cableTie?.image2 ?? null,

      rowPermission: rowPermission?.selected ?? '',

      remarks: remarks ?? '',
      lat: gpsLat,
      lon: gpsLong,
      gpsLocation: gpsAddress,
    };

    // Only one of Loop / Jc goes to the API, based on the row's dropdown selection
    if (isLoop) {
      params.loop = jcLoop?.selected ?? '';
      params.loopImage1 = jcLoop?.image1 ?? null;
      params.loopImage2 = jcLoop?.image2 ?? null;
    } else if (isJc) {
      params.jc = jcLoop?.selected ?? '';
      params.jcImage1 = jcLoop?.image1 ?? null;
      params.jcImage2 = jcLoop?.image2 ?? null;
    }

    return params;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      setSubmitting(true);

      const params = buildApiParams();

      const result = await dispatch(
        insertUpdateHotoCheckListAPI(params),
      ).unwrap();

      console.log('HOTO Checklist submitted:', result);

      Alert.alert('Success', 'HOTO Checklist submitted successfully.', [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
    } catch (err: any) {
      Alert.alert(
        'Error',
        typeof err === 'string'
          ? err
          : err?.message ??
              'Something went wrong while submitting. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Scope cell renderer (label + optional dropdown, e.g. Fiber Type, JC/Loop) ----------
  const renderScopeContent = (row: RowConfig) => {
    const state = formData[row.id];

    if (!row.scopeDropdownOptions) {
      return <Text style={styles.text3}>{row.scope}</Text>;
    }

    return (
      <View style={styles.scopeWithDropdown}>
        <Text style={styles.text3}>{row.scope}</Text>
        <TouchableOpacity
          style={[
            styles.add,
            styles.addBorder,
            state?.dropdownValue === 'JC' && {
              borderColor: COLORS.colorLimegreen,
              backgroundColor: '#eafaf0',
            },
          ]}
          onPress={() => setDropdownOpenFor(row.id)}>
          <Text style={[styles.f, styles.fFlexBox]}>
            {state?.dropdownValue ?? row.scopeDropdownOptions[0]}
          </Text>
          <Image
            style={styles.vectorIcon}
            resizeMode="contain"
            source={IMAGES.dropdownArrow}
          />
        </TouchableOpacity>

        {/* Hint below the JC/Loop dropdown */}
        {row.id === 'jc_loop' && (
          <Text style={styles.dropdownHint}>
            {state?.dropdownValue
              ? `Selected: ${state.dropdownValue}`
              : 'Please select JC or Loop first'}
          </Text>
        )}
        {row.id === 'jc_loop' && (
          <Text style={styles.dropdownHint}>
            Select JC/Loop from above Dropdown
          </Text>
        )}
        <Modal
          transparent
          visible={dropdownOpenFor === row.id}
          animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setDropdownOpenFor(null)}>
            <View style={styles.dropdownBox}>
              <FlatList
                data={row.scopeDropdownOptions}
                keyExtractor={item => item}
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => handleDropdownSelect(row.id, item)}>
                    <Text style={styles.dropdownItemText}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  };

  // ---------- Action cell renderer ----------
  const renderActionContent = (row: RowConfig) => {
    const state = formData[row.id];
    if (row.type === 'reading') {
      return (
        <View style={{width: '100%'}}>
          <TextInput
            style={styles.readingInput}
            placeholder="Enter Fiber Reading"
            keyboardType="default" // or "visible-password"
            value={state?.reading ?? ''}
            onChangeText={text => {
              handleReadingChange(row.id, text.replace(/[^0-9.]/g, ''));
            }}
          />
        </View>
      );
    }
    // toggle + toggleImages — no border box, just buttons (+ images below if applicable)
    const [optA, optB] = row.options ?? ['Yes', 'No'];
    return (
      <View style={styles.actionContainer}>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.li,
              styles.liFlexBox,
              state?.selected === optA && styles.optionSelected,
            ]}
            onPress={() => handleToggleSelect(row.id, optA)}>
            <Text style={[styles.received, styles.snoTypo]}>{optA}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.li2,
              styles.liFlexBox,
              state?.selected === optB && styles.optionSelected,
            ]}
            onPress={() => handleToggleSelect(row.id, optB)}>
            <Text style={[styles.received, styles.snoTypo]}>{optB}</Text>
          </TouchableOpacity>
        </View>

        {row.type === 'toggleImages' && (
          <View style={styles.imagesRow}>
            <View style={styles.imageSlot}>
              <CaptureImageWatermark
                title="Image 1"
                pic={state?.image1 ?? null}
                setPic={result => setRowImage(row.id, 'image1', result)}
                lat={gpsLat}
                long={gpsLong}
                address={gpsAddress}
              />
            </View>
            <View style={styles.imageSlot}>
              <CaptureImageWatermark
                title="Image 2"
                pic={state?.image2 ?? null}
                setPic={result => setRowImage(row.id, 'image2', result)}
                lat={gpsLat}
                long={gpsLong}
                address={gpsAddress}
              />
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <Screen statusBarStyle="dark" statusBgColor={COLORS.BACKGROUND_DEFAULT}>
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.body}>
          {/* Header (fixed, not part of scroll) */}
          <View style={[styles.header, styles.mainFlexBox]}>
            <View style={[styles.lanheader, styles.mainIconPosition]}>
              <Text style={styles.title}>HOTO Checklist</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.arrowBack24dp434343Fill0WIcon,
                styles.iconPosition,
              ]}
              onPress={() => navigation.goBack()}>
              <Image
                style={{width: '100%', height: '100%'}}
                resizeMode="contain"
                source={IMAGES.back}
              />
            </TouchableOpacity>
          </View>

          {/* Scrollable content */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <View style={styles.ul}>
              <View style={[styles.header2, styles.li22FlexBox]}>
                <Image
                  style={styles.icon}
                  resizeMode="contain"
                  source={IMAGES.HotoIcon ?? IMAGES.back}
                />

                <View style={styles.content}>
                  <Text style={[styles.projectCode, styles.fFlexBox]}>
                    <Text style={styles.projCode}>PROJ-CODE:</Text>
                    <Text style={styles.text}> </Text>
                    <Text style={styles.m4s1c7a1r11}>{projCode}</Text>
                  </Text>
                  <Text style={[styles.projectCode, styles.fFlexBox]}>
                    <Text style={styles.projCode}>PROJ-NAME:</Text>
                    <Text style={styles.text}> </Text>
                    <Text style={styles.m4s1c7a1r11}>{projName}</Text>
                  </Text>
                  <Text style={[styles.projectCode, styles.fFlexBox]}>
                    <Text style={styles.projCode}>{'Vendor Code/Name: '}</Text>
                    <Text style={styles.m4s1c7a1r11}>{vendorCodeName}</Text>
                  </Text>
                </View>
              </View>
            </View>
            <View style={[styles.body2, styles.btn3Common]}>
              {loadingChecklist && (
                <Text style={styles.loadingText}>
                  Checking for existing checklist...
                </Text>
              )}
              {/* Table */}
              <View style={styles.table}>
                <View style={styles.tableHeaderRow}>
                  <Text
                    style={[
                      styles.tableHeaderCell,
                      styles.snoColWidth,
                      styles.snoTypo,
                      styles.colDivider,
                    ]}>
                    S.no
                  </Text>
                  <Text
                    style={[
                      styles.tableHeaderCell,
                      styles.scopeColWidth,
                      styles.snoTypo,
                      styles.colDivider,
                    ]}>
                    Scope
                  </Text>
                  <Text
                    style={[
                      styles.tableHeaderCell,
                      styles.actionColWidth,
                      styles.snoTypo,
                    ]}>
                    Action
                  </Text>
                </View>

                {CHECKLIST_ROWS.map((row, index) => (
                  <View
                    key={row.id}
                    style={[
                      styles.tableRow,
                      index === CHECKLIST_ROWS.length - 1 &&
                        styles.tableRowLast,
                    ]}>
                    <View
                      style={[
                        styles.snoColWidth,
                        styles.tableCellCenter,
                        styles.colDivider,
                      ]}>
                      <Text style={styles.text3}>{row.sno}</Text>
                    </View>
                    <View
                      style={[
                        styles.scopeColWidth,
                        styles.tableCellStart,
                        styles.colDivider,
                      ]}>
                      {renderScopeContent(row)}
                    </View>
                    <View
                      style={[styles.actionColWidth, styles.tableCellStart]}>
                      {renderActionContent(row)}
                    </View>
                  </View>
                ))}
              </View>
            </View>
            <View style={[styles.hotoChecklist2, styles.hotoLayout]}>
              <View style={styles.infoRow}>
                <View style={styles.labelBox}>
                  <Text style={[styles.name, styles.nameTypo]}>
                    Employee Name & Id
                  </Text>
                </View>
                <View style={styles.valueBox}>
                  <Text
                    style={[styles.name2, styles.f15BlockTypo]}
                    numberOfLines={2}>
                    : {employeeDetails?.firstName} {employeeDetails?.lastName}
                  </Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.labelBox}>
                  <Text style={[styles.name, styles.nameTypo]}>
                    GPS Location
                  </Text>
                </View>
                <View style={[styles.valueBox, styles.gpsValueRow]}>
                  <Text style={[styles.f15Block, styles.f15BlockTypo]}>
                    :{' '}
                    {gpsLoading
                      ? 'Fetching location...'
                      : addressLoading
                      ? 'Locating address...'
                      : gpsAddress}
                  </Text>
                  {(gpsLoading || addressLoading) && (
                    <ActivityIndicator
                      size="small"
                      color={COLORS.colorDarkslategray}
                      style={styles.gpsSpinner}
                    />
                  )}
                </View>
              </View>
              {!!gpsError && !gpsLoading && (
                <View style={styles.infoRow}>
                  <View style={styles.labelBox} />
                  <View style={styles.valueBox}>
                    <TouchableOpacity onPress={fetchLocation}>
                      <Text style={styles.gpsRetryText}>
                        ⚠ {gpsError} Tap to retry
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              <View style={styles.infoRow}>
                <View style={styles.labelBox}>
                  <Text style={[styles.name, styles.nameTypo]}>
                    {'Date & Time'}
                  </Text>
                </View>
                <View style={styles.valueBox}>
                  <Text style={styles.nameTypo}>: {dateTime}</Text>
                </View>
              </View>
            </View>

            {/* Remarks */}
            <View style={[styles.li22, styles.li22FlexBox]}>
              <View style={styles.span11}>
                <Text style={styles.nameTypo}>Remarks</Text>
              </View>
              <TextInput
                style={[styles.add3, styles.addBorder, styles.remarksInput]}
                multiline
                placeholder="Add remarks (optional)"
                placeholderTextColor={COLORS.colorDarkslategray}
                value={remarks}
                onChangeText={setRemarks}
              />
            </View>
          </ScrollView>
          {/* Submit stays fixed at bottom, outside ScrollView.
              Only blocked by gpsLoading (raw coords) — NOT by addressLoading,
              since the address text isn't required to submit. */}
          <TouchableOpacity
            style={[
              styles.li23,
              styles.btn3Layout,
              (submitting || gpsLoading) && {opacity: 0.6},
            ]}
            onPress={handleSubmit}
            disabled={submitting || gpsLoading}>
            <Text style={[styles.submit, styles.snoTypo]}>
              {submitting
                ? 'Submitting...'
                : gpsLoading
                ? 'Fetching GPS...'
                : 'Submit'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
};
const MapStateToProps = (state: RootState) => ({
  loading: state.account.loading === 'pending',
  employeeDetails: state.dashboard.dashboardList?.employeeDetails,
});

export default connect(MapStateToProps)(HotoCheckList);
const styles = StyleSheet.create({
  mainFlexBox: {
    gap: Gap.gap_12,
    alignSelf: 'stretch',
  },
  mainIconPosition: {
    zIndex: 0,
    flex: 1,
  },
  iconPosition: {
    zIndex: 1,
    position: 'absolute',
  },
  btn3Common: {
    overflow: 'hidden',
    gap: Gap.gap_10,
  },
  hotoLayout: {
    maxWidth: 430,
    paddingHorizontal: Padding.padding_12,
    width: '100%',
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    overflow: 'hidden',
    alignItems: 'flex-start',
  },
  li22FlexBox: {
    gap: Gap.gap_8,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  fFlexBox: {
    textAlign: 'left',
    color: COLORS.colorDarkslategray,
  },
  snoTypo: {
    color: COLORS.colorWhite,
    textAlign: 'left',
    fontFamily: FONTS.REGULAR,
  },
  addBorder: {
    borderColor: COLORS.colorAliceblue,
    borderStyle: 'solid',
    alignItems: 'center',
  },
  liFlexBox: {
    paddingVertical: Padding.padding_5,
    paddingHorizontal: Padding.padding_6,
    width: Width.width_70,
    minHeight: 32,
    borderRadius: Border.br_5,
    borderColor: 'transparent',
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  nameTypo: {
    letterSpacing: LetterSpacing.ls_0_2,
    fontSize: FontSize.fs_11,
    textAlign: 'left',
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.BOLD,
  },
  f15BlockTypo: {
    display: 'flex',
    letterSpacing: LetterSpacing.ls_0_2,
    fontSize: FontSize.fs_11,
    textAlign: 'left',
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
    alignItems: 'center',
  },
  li17FlexBox: {
    gap: Gap.gap_5,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  btn3Layout: {
    borderRadius: Border.br_8,
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: Padding.padding_16,
    paddingTop: 38,
    paddingBottom: Padding.padding_16,
    gap: 12,
    flex: 1,
    width: '100%',
  },
  scrollArea: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingBottom: 24,
    gap: 16,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: Height.height_24,
  },
  lanheader: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  title: {
    fontSize: 18,
    lineHeight: 23,
    textAlign: 'center',
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
    fontWeight: '500',
  },
  arrowBack24dp434343Fill0WIcon: {
    width: 24,
    top: 0,
    left: 0,
    height: Height.height_24,
  },
  body2: {
    gap: Gap.gap_10,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    backgroundColor: COLORS.colorWhite,
  },
  loadingText: {
    fontSize: FontSize.fs_11,
    fontFamily: FONTS.REGULAR,
    color: COLORS.colorDarkslategray,
    alignSelf: 'flex-start',
  },
  ul: {
    width: '100%',
    backgroundColor: COLORS.colorWhite,
    paddingHorizontal: 10,
    alignItems: 'stretch', // instead of flex-start
    borderRadius: Border.br_8,
    elevation: 2,
  },

  content: {
    width: '100%', // Important
    flexShrink: 1, // Prevent overflow
    paddingVertical: Padding.padding_6,
    gap: 2,
    backgroundColor: 'transparent',
  },
  header2: {
    flexDirection: 'row',
  },
  icon: {
    width: SIZE.MS(45),
    borderRadius: Border.br_6,
    height: SIZE.MS(45),
  },

  projectCode: {
    fontSize: FontSize.fs_12,
    alignSelf: 'stretch',
  },
  projCode: {
    fontFamily: FONTS.SEMI_BOLD,
  },
  text: {
    fontWeight: '600',
    fontFamily: FONTS.REGULAR,
  },
  m4s1c7a1r11: {
    fontFamily: FONTS.REGULAR,
  },
  table: {
    alignSelf: 'stretch',
    borderRadius: Border.br_8,
    borderWidth: 1,
    borderColor: COLORS.colorLavender,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.colorDeepskyblue100,
    borderColor: COLORS.colorDeepskyblue300,
    borderBottomWidth: 1,
  },
  tableHeaderCell: {
    paddingVertical: Padding.padding_6,
    paddingHorizontal: Padding.padding_6,
    fontSize: FontSize.fs_12,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: COLORS.colorLavender,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  colDivider: {
    borderRightWidth: 1,
    borderRightColor: COLORS.colorLavender,
  },
  tableCellCenter: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: Padding.padding_6,
    paddingVertical: Padding.padding_8,
  },
  tableCellStart: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingHorizontal: Padding.padding_6,
    paddingVertical: Padding.padding_8,
  },
  snoColWidth: {
    width: 34,
  },
  scopeColWidth: {
    width: 110,
  },
  actionColWidth: {
    flex: 1,
  },
  text3: {
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.BLACK,
  },
  scopeWithDropdown: {
    gap: Gap.gap_6,
    alignItems: 'flex-start',
  },
  actionContainer: {
    width: '100%',
    gap: Gap.gap_8,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Gap.gap_6,
  },
  li: {
    backgroundColor: COLORS.colorLimegreen,
  },
  li2: {
    backgroundColor: COLORS.colorCrimson,
  },
  optionSelected: {
    borderWidth: 2,
    borderColor: COLORS.colorDarkslategray,
  },
  received: {
    lineHeight: LineHeight.lh_16,
    fontSize: FontSize.fs_12,
    fontWeight: '500',
  },
  readingInput: {
    borderWidth: 1,
    borderColor: COLORS.colorLavender,
    borderRadius: Border.br_6,
    paddingHorizontal: Padding.padding_8,
    paddingVertical: Padding.padding_6,
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.colorDarkslategray,
    width: '100%',
  },
  add: {
    width: 68,
    borderRadius: 5,
    backgroundColor: COLORS.colorWhite,
    borderWidth: 1.5,
    borderColor: COLORS.colorDeepskyblue300,
    paddingHorizontal: 6,
    paddingVertical: 5,
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
  },
  f: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 1,
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray,
    flex: 1,
  },
  vectorIcon: {
    height: 8,
    width: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownBox: {
    width: 160,
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
    paddingVertical: Padding.padding_6,
    elevation: 4,
  },
  dropdownItem: {
    paddingVertical: Padding.padding_8,
    paddingHorizontal: Padding.padding_12,
  },
  dropdownItemText: {
    fontSize: FontSize.fs_13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.colorDarkslategray,
  },
  imagesRow: {
    flexDirection: 'row',
    gap: Gap.gap_8,
    width: '100%',
  },
  imageSlot: {
    flex: 1,
  },
  hotoChecklist2: {
    paddingVertical: Padding.padding_14,
    paddingHorizontal: Padding.padding_12,
    gap: Gap.gap_8,
    flexDirection: 'column',
    alignSelf: 'stretch',
    width: '100%',
    marginTop: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    width: '100%',
  },
  labelBox: {
    width: 120,
    flexShrink: 0,
  },
  valueBox: {
    flex: 1,
    flexShrink: 1,
  },
  gpsValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Gap.gap_6,
  },
  gpsSpinner: {
    marginLeft: 4,
  },
  name: {
    fontFamily: FONTS.BOLD,
    fontSize: FontSize.fs_12,
  },
  name2: {
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  f15Block: {
    flexShrink: 1,
    flexWrap: 'wrap',
    fontSize: FontSize.fs_12,
  },
  gpsRetryText: {
    fontSize: FontSize.fs_11,
    fontFamily: FONTS.REGULAR,
    color: COLORS.colorCrimson ?? '#C62828',
  },
  li22: {
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  span11: {
    width: 138,
    alignItems: 'center',
    flexDirection: 'row',
  },
  add3: {
    height: 85,
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
    alignSelf: 'stretch',
  },
  remarksInput: {
    padding: Padding.padding_8,
    fontSize: FontSize.fs_13,
    fontFamily: FONTS.REGULAR,
    color: COLORS.colorDarkslategray,
    textAlignVertical: 'top',
  },
  li23: {
    backgroundColor: '#40c7fc',
    paddingHorizontal: 20,
    paddingVertical: 13,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    borderRadius: Border.br_8,
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  dropdownHint: {
    fontSize: 10,
    fontFamily: FONTS.REGULAR,
    color: COLORS.colorGreen100,
    marginTop: 2,
  },
  submit: {
    fontSize: 14,
    fontWeight: '500',
  },
});
