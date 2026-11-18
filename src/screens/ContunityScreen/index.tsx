import React, {FC, useEffect, useState, useCallback, useMemo} from 'react';
import {
  Text,
  StyleSheet,
  ScrollView,
  View,
  Image,
  Pressable,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
} from 'react-native';
import {Location, Common} from '@utils';
import MapView, {Marker} from 'react-native-maps';
import {useDispatch, useSelector} from 'react-redux';
import {fetchCurrentGpsLocation} from '../../components/molecules/LocationButton/gps';
import {
  FontFamily,
  Border,
  Padding,
  BoxShadow,
  Width,
  Height,
  Gap,
  FontSize,
  LineHeight,
  LetterSpacing,
} from '../../res/globalStyle';
import {Screen} from '@organisms';
import {ScreenProps} from '@types';
import {COLORS, IMAGES, FONTS} from '@res';
import CaptureImageWatermark from '../../components/molecules/capture-image-watermark';
import type {AppDispatch, RootState} from '@reducers';
import {Preferences} from '@utils';
import {
  getMaintenanceActivityListByIdAPI,
  getZonewiseEmpForActivityAPI,
  getNearestChamberByLatlngAPI,
  getNearestRouteByLatlngAPI,
  insertActivityStatusAPI,
  getMaintenanceActivityDDAPI,
} from '../../store/slices/maintenance.slice';

type MasterItem = {
  id: number | string;
  displayName: string;
  parentValueId?: number | string;
  [key: string]: any;
};
type DropdownMaster = {
  activityType: MasterItem[]; // Cut / Alert / Locating (parentValueId: 0)
  cutType: MasterItem[];
  alertType: MasterItem[];
  locatingType: MasterItem[];
  workBy: MasterItem[];
  workingFor: MasterItem[];
  companyType: MasterItem[];
  priority: MasterItem[];
};
interface MaintenanceMedia {
  id: number;
  maintenanceActivityId: number;
  mediaType: string;
  filePath: string;
  isActive: boolean;
}
interface MaintenanceActivityDetail {
  id: number;
  activityId: number;
  activityCode: string;
  activityTypeId: number;
  activityType: string;
  cutAlertLocatingTypeId: number;
  cutAlertLocatingType: string;
  priorityTypeId: number;
  priority: string;
  workById: number;
  workBy: string;
  workForId: number;
  workFor: string;
  companyTypeId: number;
  companyType: string;
  vendorName: string;
  vendorMobileNo: string;
  workOnRoute: number;
  latLng: string;
  address: string;
  landmark: string;
  remark: string;
  chamber1Id: string;
  chamber1IdInt: number;
  chamber2IdInt: number;
  chamber1Name: string;
  chamber1LatLong: string;
  chamber2Id: string;
  chamber2Name: string;
  chamber2LatLong: string;
  routeId: string;
  routeIdStr: string;
  routeName: string;
  distanceToChamber1: number | null;
  distanceToChamber2: number | null;
  distanceBetweenChamber: number | null;
  createdOn: string;
  currentStatus: string | null;
  isActive: boolean;
  statusUpdatedOn: string | null;
  mediaList: MaintenanceMedia[];
  // ── NEW: Submit-button gating ke liye zaroori fields (API response me
  // aate hain, e.g. status-detail endpoint) ─────────────────────────────
  handOverToEmpId?: number | string | null;
  statusUpdatedBy?: number | string | null;
}

// Zone-wise employee list backend se generic shape me aa sakta hai
// (id/name field naming confirm nahi hai), isliye defensive accessors
interface ZonewiseEmployee {
  [key: string]: any;
}
interface Coords {
  latitude: number;
  longitude: number;
}

// Naya captured photo slot (Get GPS ke baad watermark ke saath capture hota hai)
type ImageSlot = {uri: string; type: string; name: string} | null;

// ── Nearest Chamber API response shape (same as AddCutScreen) ─────────────
type NearestChamberItem = {
  id?: number | string;
  chamberId?: number | string;
  chamber1Id?: number | string;
  chamber2Id?: number | string;
  chamber1Name?: string;
  chamber2Name?: string;
  chamber1Address?: string;
  chamber2Address?: string;
  chamber1Landmark?: string;
  chamber2Landmark?: string;
  chamber1Lat?: number | string;
  chamber1Lng?: number | string;
  chamber2Lat?: number | string;
  chamber2Lng?: number | string;
  enclosureId?: string;
  name?: string;
  code?: string;
  chamberIdStr?: string;
  chamberName?: string;
  [key: string]: any;
};

const getChamberLabel = (item?: NearestChamberItem | null): string | null => {
  if (!item) return null;
  const value =
    item.enclosureId ??
    item.chamberIdStr ??
    item.chamberId ??
    item.chamberName ??
    item.name ??
    item.code ??
    null;
  return value === null || value === undefined ? null : String(value);
};

const buildChamberDisplay = (
  chamber: 'left' | 'right',
  item?: NearestChamberItem | null,
): string | null => {
  if (!item) return null;
  const isLeft = chamber === 'left';
  const landmark = isLeft ? item.chamber1Landmark : item.chamber2Landmark;
  const lat = isLeft ? item.chamber1Lat : item.chamber2Lat;
  const lng = isLeft ? item.chamber1Lng : item.chamber2Lng;
  const address = isLeft ? item.chamber1Address : item.chamber2Address;
  const name = isLeft ? item.chamber1Name : item.chamber2Name;

  const values = [
    landmark,
    lat !== undefined && lat !== null ? String(lat) : null,
    lng !== undefined && lng !== null ? String(lng) : null,
  ].filter(
    (value): value is string =>
      value !== null && value !== undefined && String(value).trim() !== '',
  );
  if (values.length > 0) return values.join(', ');

  const fallback = [name, address].filter(
    (value): value is string => !!value && String(value).trim() !== '',
  );
  return fallback.length > 0 ? fallback.join(', ') : null;
};

type NearestChamberParsed = {
  leftLabel: string | null;
  rightLabel: string | null;
  leftLat: number | string | null;
  leftLng: number | string | null;
  rightLat: number | string | null;
  rightLng: number | string | null;
  // FIX/ADD: nearest-chamber ids, so we can send real Chamber1Id/Chamber2Id
  // to insertActivityStatusAPI instead of always falling back to the
  // activity's original chamber ids even after a fresh GPS lookup.
  leftId: number | string | null;
  rightId: number | string | null;
};
// Same defensive parsing as AddCutScreen — API kabhi single object, kabhi array bhej sakta hai
const getNearestChamberAddresses = (result: any): NearestChamberParsed => {
  const data: any =
    result?.nearestChambers ??
    result?.nearestChamber ??
    result?.chambers ??
    result?.data ??
    result;
  if (!Array.isArray(data) && data) {
    return {
      leftLabel:
        buildChamberDisplay('left', data) ??
        data.chamber1Address ??
        getChamberLabel(data),
      rightLabel:
        buildChamberDisplay('right', data) ?? data.chamber2Address ?? null,
      leftLat: data.chamber1Lat ?? null,
      leftLng: data.chamber1Lng ?? null,
      rightLat: data.chamber2Lat ?? null,
      rightLng: data.chamber2Lng ?? null,
      leftId: data.chamber1Id ?? null,
      rightId: data.chamber2Id ?? null,
    };
  }

  const list: NearestChamberItem[] = Array.isArray(data) ? data : [];
  const firstItem = list[0];
  const secondItem = list[1];

  return {
    leftLabel:
      buildChamberDisplay('left', firstItem) ??
      firstItem?.chamber1Address ??
      getChamberLabel(firstItem),
    rightLabel:
      buildChamberDisplay('right', firstItem) ??
      buildChamberDisplay('right', secondItem) ??
      firstItem?.chamber2Address ??
      secondItem?.chamber2Address ??
      getChamberLabel(secondItem),
    leftLat: firstItem?.chamber1Lat ?? null,
    leftLng: firstItem?.chamber1Lng ?? null,
    rightLat: firstItem?.chamber2Lat ?? secondItem?.chamber2Lat ?? null,
    rightLng: firstItem?.chamber2Lng ?? secondItem?.chamber2Lng ?? null,
    leftId: firstItem?.chamber1Id ?? firstItem?.id ?? null,
    rightId:
      firstItem?.chamber2Id ?? secondItem?.chamber2Id ?? secondItem?.id ?? null,
  };
};

// ── Nearest-route fallback (used when getNearestChamberByLatlngAPI finds
// no chamber within range) — parses GetNearestRouteByLatlng's response
// shape: {success,status,message,data:[{routeId,routeIdStr,routeName,
// chamber1*,chamber2*,distanceToFirstChamber,distanceToSecondChamber,
// distanceBetweenChambers,distanceToNearestChamber}]}
type NearestRouteFallbackItem = {
  routeId: number | string;
  routeIdStr: string | null;
  routeName: string | null;
  chamber1Id?: number | string;
  chamber1Name?: string | null;
  chamber2Id?: number | string;
  chamber2Name?: string | null;
  distanceToFirstChamber?: number | null;
  distanceToSecondChamber?: number | null;
  distanceBetweenChambers?: number | null;
  distanceToNearestChamber?: number | null;
};
const parseNearestRouteFallback = (
  result: any,
): NearestRouteFallbackItem | null => {
  const list: any[] = Array.isArray(result)
    ? result
    : Array.isArray(result?.data)
    ? result.data
    : [];
  const item = list[0];
  if (!item) return null;
  return {
    routeId: item.routeId ?? item.RouteId ?? '',
    routeIdStr: item.routeIdStr ?? item.RouteIdStr ?? null,
    routeName: item.routeName ?? item.RouteName ?? null,
    chamber1Id: item.chamber1Id,
    chamber1Name: item.chamber1Name ?? null,
    chamber2Id: item.chamber2Id,
    chamber2Name: item.chamber2Name ?? null,
    distanceToFirstChamber: item.distanceToFirstChamber ?? null,
    distanceToSecondChamber: item.distanceToSecondChamber ?? null,
    distanceBetweenChambers: item.distanceBetweenChambers ?? null,
    distanceToNearestChamber: item.distanceToNearestChamber ?? null,
  };
};

const DEFAULT_NEAREST_CHAMBER_RANGE_METERS = 200;

// Dropdown ke liye fixed status options - backend ke saath in exact strings ko confirm kar lena
const STATUS_OPTIONS = ['Running', 'Pending', 'Closed'] as const;
type StatusOption = (typeof STATUS_OPTIONS)[number];
// Map load fail hone par ya activity ka latLng missing hone par fallback center
const DEFAULT_COORDS: Coords = {
  latitude: 28.62648628,
  longitude: 77.2308646,
};
const parseLatLng = (latLng?: string): Coords | null => {
  if (!latLng) return null;
  const parts = latLng.split(',').map(p => parseFloat(p.trim()));
  if (parts.length !== 2 || parts.some(v => isNaN(v))) return null;
  return {latitude: parts[0], longitude: parts[1]};
};

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${dd}-${mm}-${yyyy} • ${String(hours).padStart(
    2,
    '0',
  )}:${minutes} ${ampm}`;
};

const formatDistance = (val?: number | null) => {
  if (val === null || val === undefined || isNaN(val)) return '--';
  if (val >= 1000) return `${(val / 1000).toFixed(2)}km`;
  return `${val}m`;
};

// FIX: "UG" jaisa 2-letter badge cutAlertLocatingType se derive kiya (pehle hardcoded tha)
const getLocatingBadge = (type?: string) => {
  if (!type) return 'NA';
  const lower = type.toLowerCase();
  if (lower.includes('under')) return 'UG';
  if (lower.includes('over') || lower.includes('above')) return 'OG';
  return type.substring(0, 2).toUpperCase();
};

// Agar API se aaya currentStatus hamare fixed options se match nahi karta (case-insensitive),
// to usko normalize karne ki koshish karte hain, warna blank rakhte hain
const normalizeStatus = (status?: string | null): StatusOption | '' => {
  if (!status) return '';
  const match = STATUS_OPTIONS.find(
    opt => opt.toLowerCase() === status.trim().toLowerCase(),
  );
  return match ?? '';
};

// Zone wise employee response me id/name field ka naming exact confirm nahi hai,
// isliye common possible keys try karte hain
const getEmpId = (emp: ZonewiseEmployee): string | number => {
  return emp?.employeeId ?? emp?.empId ?? emp?.id ?? emp?.userId ?? '';
};

const getEmpName = (emp: ZonewiseEmployee): string => {
  return (
    emp?.employeeName ??
    emp?.empName ??
    emp?.name ??
    emp?.fullName ??
    emp?.userName ??
    'Unknown'
  );
};
// Current GPS position se kisi bhi chamber tak ka distance nikalne ke liye
// Haversine formula (meters me return karta hai)
const EARTH_RADIUS_METERS = 6371000;
const toRadians = (deg: number) => (deg * Math.PI) / 180;
const getDistanceMeters = (from: Coords, to: Coords): number => {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
};
// ── Nearby-address fallback ────────────────────────────────────────────────
// Used ONLY for reverse-geocoding. The captured lat/long is never changed.
const NEARBY_ADDRESS_RADII_METERS = [20, 50, 100, 200];
const NEARBY_ADDRESS_BEARINGS_DEG = [0, 90, 180, 270, 45, 135, 225, 315];

const offsetLatLng = (
  lat: number,
  lng: number,
  distanceMeters: number,
  bearingDeg: number,
): {lat: number; lng: number} => {
  const bearing = toRadians(bearingDeg);
  const d = distanceMeters / EARTH_RADIUS_METERS;
  const lat1 = toRadians(lat);
  const lng1 = toRadians(lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
      Math.cos(lat1) * Math.sin(d) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );

  return {lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI};
};

const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const data = (await Location.getAddressFromLatLong({
      lat,
      lng,
      isOla: false,
    })) as any;
    return data?.address?.trim() || '';
  } catch (err) {
    console.log('Reverse-geocoding failed:', err);
    return '';
  }
};

// 1) Try the exact point. 2) If empty, probe rings of points around it
// (20m → 200m) and take the first address found. Returns isApproximate=true
// when the address came from a nearby point.
const getAddressWithNearbyFallback = async (
  lat: number,
  lng: number,
): Promise<{address: string; isApproximate: boolean}> => {
  const exact = await reverseGeocode(lat, lng);
  if (exact) return {address: exact, isApproximate: false};

  for (const radius of NEARBY_ADDRESS_RADII_METERS) {
    const results = await Promise.all(
      NEARBY_ADDRESS_BEARINGS_DEG.map(bearing => {
        const p = offsetLatLng(lat, lng, radius, bearing);
        return reverseGeocode(p.lat, p.lng);
      }),
    );
    const found = results.find(Boolean);
    if (found) return {address: found, isApproximate: true};
  }

  return {address: '', isApproximate: false};
};

// ── NEW: Submit-button gating helpers ──────────────────────────────────
// "Valid" empId ka matlab: null/undefined/'' nahi hai AUR number me convert
// karne par 0 se bada hai. 0 / null / '' / undefined => invalid (fallback
// to statusUpdatedBy check).
const isValidEmpId = (val?: number | string | null): boolean => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string' && val.trim() === '') return false;
  const num = Number(val);
  return Number.isFinite(num) && num > 0;
};

const idsMatch = (
  a?: number | string | null,
  b?: number | string | null,
): boolean => {
  if (a === null || a === undefined || b === null || b === undefined) {
    return false;
  }
  const numA = Number(a);
  const numB = Number(b);
  if (Number.isFinite(numA) && Number.isFinite(numB)) return numA === numB;
  return String(a).trim() === String(b).trim();
};

// ── Nearest-route fallback popup — shown when no chamber is found within
// range. Tells the user how far they are from their nearest route/chamber.
type NearestRouteFallbackModalProps = {
  visible: boolean;
  isLoading: boolean;
  info: NearestRouteFallbackItem | null;
  onClose: () => void;
};
const NearestRouteFallbackModal: FC<NearestRouteFallbackModalProps> = ({
  visible,
  isLoading,
  info,
  onClose,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}>
    <View style={styles.fallbackModalOverlay}>
      <View style={styles.fallbackModalCard}>
        {isLoading ? (
          <View style={styles.fallbackModalLoadingRow}>
            <ActivityIndicator size="small" color={COLORS.colorRoyalblue} />
            <Text style={styles.fallbackModalLoadingText}>
              Finding nearest route...
            </Text>
          </View>
        ) : info ? (
          <>
            <Text style={styles.fallbackModalTitle}>
              You're not near your nearest chamber
            </Text>
            <Text style={styles.fallbackModalText}>
              You are{' '}
              <Text style={styles.fallbackModalHighlight}>
                {formatDistance(info.distanceToNearestChamber ?? null)}
              </Text>{' '}
              away from route{' '}
              <Text style={styles.fallbackModalHighlight}>
                {info.routeName || info.routeIdStr || `#${info.routeId}`}
              </Text>
              {info.routeIdStr ? ` (${info.routeIdStr})` : ''}.
            </Text>
            {(info.chamber1Name || info.chamber2Name) && (
              <Text style={styles.fallbackModalSubText} numberOfLines={3}>
                {[info.chamber1Name, info.chamber2Name]
                  .filter(Boolean)
                  .join('  ↔  ')}
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.fallbackModalText}>
            No nearby route found within range.
          </Text>
        )}
        <TouchableOpacity style={styles.fallbackModalButton} onPress={onClose}>
          <Text style={styles.fallbackModalButtonText}>OK</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const ContunityScreen: FC<ScreenProps.ContunityScreen> = ({
  navigation,
  route,
}) => {
  const dispatch = useDispatch<AppDispatch>();

  const {id} = route.params;
  // TODO: 'maintenance' key apne rootReducer me is slice ko jis naam se mount kiya hai usse match karo
  const zonewiseEmpForActivity = useSelector(
    (state: RootState) =>
      (state as any)?.maintenance?.zonewiseEmpForActivity as ZonewiseEmployee[],
  );
  const [wantsHandover, setWantsHandover] = useState(false); // default Yes

  const zonewiseEmpForActivityLoading = useSelector(
    (state: RootState) =>
      (state as any)?.maintenance?.zonewiseEmpForActivityLoading as boolean,
  );
  const [activity, setActivity] = useState<MaintenanceActivityDetail | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isMasterLoading, setIsMasterLoading] = useState(false);
  const [nearestLeftChamber, setNearestLeftChamber] = useState('');
  const [nearestRightChamber, setNearestRightChamber] = useState('');
  const [masterData, setMasterData] = useState<DropdownMaster | null>(null);
  const [activityTypeId, setActivityTypeId] = useState<number | string>('');
  const [activityTypeName, setActivityTypeName] = useState('');
  const [activityTypeDropdownOpen, setActivityTypeDropdownOpen] =
    useState(false);
  const [remark, setRemark] = useState('');
  const [currentStatus, setCurrentStatus] = useState<StatusOption | ''>('');
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  // Handover To - ab plain text nahi, zonewise employee list se select hota hai
  const [handoverToId, setHandoverToId] = useState<string | number>('');
  const [handoverToName, setHandoverToName] = useState('');
  const [handoverDropdownOpen, setHandoverDropdownOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [workCompleted, setWorkCompleted] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // User ki current GPS location — sirf "Get GPS" / "Where I am?" dabane par
  // set hoti hai (handleGetGps). Screen load par koi auto GPS fetch NAHI hota.
  const [currentLocation, setCurrentLocation] = useState<Coords | null>(null);

  // ── New: Get GPS button state (AddCutScreen jaisa) ─────────────────────
  const [gpsLat, setGpsLat] = useState<string | null>(null);
  const [gpsLong, setGpsLong] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  // NEW: true jab address exact point ki jagah nearby point se aaya ho
  const [isAddressApproximate, setIsAddressApproximate] = useState(false);
  const [isFetchingGps, setIsFetchingGps] = useState(false);
  const [isFetchingNearestChamber, setIsFetchingNearestChamber] =
    useState(false);
  const [nearestLeftChamberLat, setNearestLeftChamberLat] = useState<
    number | string | null
  >(null);

  const [nearestLeftChamberLng, setNearestLeftChamberLng] = useState<
    number | string | null
  >(null);

  const [nearestRightChamberLat, setNearestRightChamberLat] = useState<
    number | string | null
  >(null);

  const [nearestRightChamberLng, setNearestRightChamberLng] = useState<
    number | string | null
  >(null);

  // Numeric chamber IDs from the nearest-chamber lookup
  const [nearestLeftChamberId, setNearestLeftChamberId] = useState<
    number | string | null
  >(null);

  const [nearestRightChamberId, setNearestRightChamberId] = useState<
    number | string | null
  >(null);
  // ── Nearest-route fallback state — populated when
  // getNearestChamberByLatlngAPI finds no chamber within range. We then
  // call getNearestRouteByLatlngAPI and show its result in a popup, same
  // as AddCutScreen.
  const [isFallbackRouteModalVisible, setIsFallbackRouteModalVisible] =
    useState(false);
  const [isFetchingFallbackRoute, setIsFetchingFallbackRoute] = useState(false);
  const [fallbackRouteInfo, setFallbackRouteInfo] =
    useState<NearestRouteFallbackItem | null>(null);

  // ── New: 4 photo slots, captured + watermarked via <CaptureImageWatermark/>
  // once GPS is available (same gating as AddCutScreen) ──────────────────
  const [pic1, setPic1] = useState<ImageSlot>(null);
  const [pic2, setPic2] = useState<ImageSlot>(null);
  const [pic3, setPic3] = useState<ImageSlot>(null);
  const [pic4, setPic4] = useState<ImageSlot>(null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // ── NEW: current logged-in user ke ids, Preference se ────────────────
  // currentEmpId => handOverToEmpId ke against match karne ke liye
  // currentUserId => statusUpdatedBy ke against match karne ke liye
  const [currentEmpId, setCurrentEmpId] = useState<number | string | null>(
    null,
  );
  const [currentUserId, setCurrentUserId] = useState<number | string | null>(
    null,
  );
  console.log('CurrentUserId:', {currentUserId});
  const [isUserIdsLoading, setIsUserIdsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadCurrentUserIds = async () => {
      try {
        setIsUserIdsLoading(true);
        // TODO: apne Preference util ke real method/keys se replace karo.
        const [empIdValue, userIdValue] = await Promise.all([
          Preferences.getData('EMPLOYEE_ID'),
          Preferences.getData('USERID'),
        ]);
        if (!isMounted) return;
        setCurrentEmpId(
          empIdValue !== null && empIdValue !== undefined ? empIdValue : null,
        );
        setCurrentUserId(
          userIdValue !== null && userIdValue !== undefined
            ? userIdValue
            : null,
        );
      } catch (e) {
        console.log('Failed to load current user/employee id:', e);
        if (isMounted) {
          setCurrentEmpId(null);
          setCurrentUserId(null);
        }
      } finally {
        if (isMounted) setIsUserIdsLoading(false);
      }
    };
    loadCurrentUserIds();
    return () => {
      isMounted = false;
    };
  }, []);
  // ── NEW: Submit button gating ────────────────────────────────────────
  const canSubmit = useMemo(() => {
    if (!activity) return false;
    if (isValidEmpId(activity.handOverToEmpId)) {
      return idsMatch(activity.handOverToEmpId, currentEmpId);
    }
    return idsMatch(activity.statusUpdatedBy, currentUserId);
  }, [activity, currentEmpId, currentUserId]);
  // ── NEW: Hide "Pending" when user swaps Activity Type between Cut <-> Alert ──
  const availableStatusOptions = useMemo(() => {
    const originalType = (activity?.activityType ?? '').trim().toLowerCase();
    const selectedType = activityTypeName.trim().toLowerCase();

    const isCutAlertSwap =
      originalType !== '' &&
      selectedType !== '' &&
      originalType !== selectedType &&
      ['cut', 'alert'].includes(originalType) &&
      ['cut', 'alert'].includes(selectedType);

    if (isCutAlertSwap) {
      return STATUS_OPTIONS.filter(opt => opt !== 'Pending');
    }
    return STATUS_OPTIONS;
  }, [activity?.activityType, activityTypeName]);

  // `hasLatLng`: coordinates captured.
  // `hasGps`: coordinates AND address present (photo capture + submit depend on this).
  const hasLatLng = !!(gpsLat && gpsLong);
  const hasGps = hasLatLng && !!address.trim();

  const clearError = (key: string) => {
    if (errors[key]) setErrors(prev => ({...prev, [key]: false}));
  };

  const fetchActivityDetail = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      const result = await dispatch(
        getMaintenanceActivityListByIdAPI(id),
      ).unwrap();

      setActivity(result);

      // NOTE: Nearest Left/Right Chamber are intentionally NOT populated
      // from this by-id activity detail response. They stay blank until the
      // user explicitly taps "Get GPS" or "Where I am?", which runs a fresh
      // nearest-chamber lookup off the device's current GPS fix.

      setRemark(result?.remark?.trim() ?? '');

      setCurrentStatus(normalizeStatus(result?.currentStatus));
    } catch (err: any) {
      setErrorMsg(
        err?.message ?? String(err) ?? 'Unable to fetch activity details',
      );
    } finally {
      setLoading(false);
    }
  }, [dispatch, id]);

  // ── Fallback: called only when the primary nearest-chamber lookup
  // returns nothing within range (or errors out). Fetches the nearest
  // route regardless of range and shows it in a popup so the user knows
  // how far off they are. Same pattern as AddCutScreen.
  const fetchNearestRouteFallback = useCallback(
    async (lat: number, lng: number, routeType: string) => {
      try {
        setIsFetchingFallbackRoute(true);
        setFallbackRouteInfo(null);
        setIsFallbackRouteModalVisible(true);
        // @ts-ignore - unwrap() typing depends on your store setup
        const result = await dispatch(
          getNearestRouteByLatlngAPI({
            lat,
            lng,
            routeType,
          }),
        ).unwrap();

        const parsed = parseNearestRouteFallback(result);
        setFallbackRouteInfo(parsed);

        if (!parsed) {
          Common.showToast('No nearby route found');
        }
      } catch (e: any) {
        setFallbackRouteInfo(null);
        Common.showToast(e?.message || 'Unable to fetch nearest route');
      } finally {
        setIsFetchingFallbackRoute(false);
      }
    },
    [dispatch],
  );

  const handleCloseFallbackRouteModal = () => {
    setIsFallbackRouteModalVisible(false);
  };

  // Auto-hide the fallback popup after 5s, same as AddCutScreen.
  useEffect(() => {
    if (!isFallbackRouteModalVisible) return;

    const timer = setTimeout(() => {
      setIsFallbackRouteModalVisible(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [isFallbackRouteModalVisible]);

  const fetchNearestChamber = useCallback(
    async (lat: number, lng: number, routeType: string) => {
      try {
        setIsFetchingNearestChamber(true);
        const result = await dispatch(
          getNearestChamberByLatlngAPI({
            lat,
            lng,
            rangeInMeters: DEFAULT_NEAREST_CHAMBER_RANGE_METERS,
            routeType,
          }),
        ).unwrap();
        const {
          leftLabel,
          rightLabel,
          leftLat,
          leftLng,
          rightLat,
          rightLng,
          leftId,
          rightId,
        } = getNearestChamberAddresses(result);
        setNearestLeftChamber(leftLabel ?? '');
        setNearestRightChamber(rightLabel ?? '');
        setNearestLeftChamberLat(leftLat);
        setNearestLeftChamberLng(leftLng);
        setNearestRightChamberLat(rightLat);
        setNearestRightChamberLng(rightLng);
        setNearestLeftChamberId(leftId);
        setNearestRightChamberId(rightId);
        if (!leftLabel && !rightLabel) {
          // No chamber found within range — fall back to the nearest-route
          // lookup (no range limit) and show its distance/route info in a
          // popup instead of just a toast.
          Common.showToast('No nearby chamber found within range');
          await fetchNearestRouteFallback(lat, lng, routeType);
        }
      } catch (e: any) {
        setNearestLeftChamberLat(null);
        setNearestLeftChamberLng(null);
        setNearestRightChamberLat(null);
        setNearestRightChamberLng(null);
        setNearestLeftChamberId(null);
        setNearestRightChamberId(null);
        Common.showToast(e?.message || 'Unable to fetch nearest chamber');
        await fetchNearestRouteFallback(lat, lng, routeType);
      } finally {
        setIsFetchingNearestChamber(false);
      }
    },
    [dispatch, fetchNearestRouteFallback],
  );

  // ── NEW: GPS flow, AddCutScreen jaisa ──────────────────────────────────
  // Naya fix aate hi purana chamber data / photos clear ho jate hain, kyunki
  // photos par purana lat/long/address watermark hota hai.
  const resetChamberState = () => {
    setNearestLeftChamber('');
    setNearestRightChamber('');
    setNearestLeftChamberLat(null);
    setNearestLeftChamberLng(null);
    setNearestRightChamberLat(null);
    setNearestRightChamberLng(null);
    setNearestLeftChamberId(null);
    setNearestRightChamberId(null);
  };

  const resetCapturedPhotos = () => {
    setPic1(null);
    setPic2(null);
    setPic3(null);
    setPic4(null);
  };

  // Exact lat/long capture karta hai, phir address resolve karta hai
  // (pehle exact point, fir nearby fallback). Failure par null return.
  const captureFreshLocation = async (): Promise<{
    latitude: number;
    longitude: number;
    resolvedAddress: string;
  } | null> => {
    let location;
    try {
      location = await fetchCurrentGpsLocation({
        targetAccuracy: 15,
        minimumSamples: 4,
        timeout: 45000,
      });
    } catch (error: any) {
      Common.showToast(error?.message || 'Unable to get GPS signal');
      return null;
    }

    const {latitude, longitude, accuracy} = location;
    console.log('Final Continuity GPS:', {latitude, longitude, accuracy});

    // Exact lat/long as captured — address se kabhi change nahi hota.
    setGpsLat(String(latitude));
    setGpsLong(String(longitude));
    setCurrentLocation({latitude, longitude});
    resetCapturedPhotos();

    const {address: resolvedAddress, isApproximate} =
      await getAddressWithNearbyFallback(latitude, longitude);

    // Location change hui, isliye purana address stale hai.
    setAddress(resolvedAddress);
    setIsAddressApproximate(isApproximate);
    if (resolvedAddress) {
      clearError('address');
    }

    const accText = `${accuracy.toFixed(1)}m`;
    if (accuracy > 15) {
      Common.showToast(
        `GPS captured (${accText}). Accuracy is low — move to open sky and retry if needed.`,
      );
    } else {
      Common.showToast(`GPS captured (${accText})`);
    }

    return {latitude, longitude, resolvedAddress};
  };

  const handleGetGps = async () => {
    if (isFetchingGps) return;
    try {
      setIsFetchingGps(true);
      // Sab kuch clear karo taaki koi stale value na dikhe ya submit ho.
      setGpsLat(null);
      setGpsLong(null);
      setAddress('');
      setIsAddressApproximate(false);
      resetChamberState();
      resetCapturedPhotos();

      const fix = await captureFreshLocation();
      if (!fix) return;

      // routeType activity.cutAlertLocatingType se, jaisa pehle tha
      await fetchNearestChamber(
        fix.latitude,
        fix.longitude,
        activity?.cutAlertLocatingType ?? '',
      );
    } catch (e: any) {
      Common.showToast(e?.message || 'Unable to fetch GPS location');
    } finally {
      setIsFetchingGps(false);
    }
  };
  useEffect(() => {
    fetchActivityDetail();
  }, [fetchActivityDetail]);
  useEffect(() => {
    const fetchMaster = async () => {
      try {
        setIsMasterLoading(true);
        const result = await dispatch(getMaintenanceActivityDDAPI()).unwrap();
        setMasterData(result as DropdownMaster);
      } catch (e: any) {
        Common.showToast(e?.message || e || 'Failed to load dropdown options');
      } finally {
        setIsMasterLoading(false);
      }
    };
    fetchMaster();
  }, [dispatch]);
  useEffect(() => {
    if (currentStatus !== 'Running' && currentStatus !== 'Pending') return;
    if (!wantsHandover) return;
    if (!activity?.chamber1Id && !activity?.chamber2Id) return;
    dispatch(
      getZonewiseEmpForActivityAPI({
        chamber1Id: Number(activity?.chamber1Id) || 0,
        chamber2Id: Number(activity?.chamber2Id) || 0,
      }),
    );
  }, [
    currentStatus,
    wantsHandover,
    activity?.chamber1Id,
    activity?.chamber2Id,
    dispatch,
  ]);
  const openInGoogleMaps = useCallback(() => {
    const chamber1 = parseLatLng(activity?.chamber1LatLong);
    const chamber2 = parseLatLng(activity?.chamber2LatLong);
    if (!chamber1 && !chamber2) {
      Alert.alert('Not Available', 'Chamber location not available');
      return;
    }
    const destination = chamber2 ?? chamber1!;
    const waypoint = chamber1 && chamber2 ? chamber1 : null;
    let url = currentLocation
      ? `https://www.google.com/maps/dir/?api=1&origin=${currentLocation.latitude},${currentLocation.longitude}&destination=${destination.latitude},${destination.longitude}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
    if (waypoint) {
      url += `&waypoints=${waypoint.latitude},${waypoint.longitude}`;
    }
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open Google Maps');
    });
  }, [activity?.chamber1LatLong, activity?.chamber2LatLong, currentLocation]);
  useEffect(() => {
    if (currentStatus !== 'Running') return;
    console.log('activityData:==>', {activity});
    if (!activity?.chamber1Id && !activity?.chamber2Id) return;
    dispatch(
      getZonewiseEmpForActivityAPI({
        chamber1Id: Number(activity?.chamber1Id) || 0,
        chamber2Id: Number(activity?.chamber2Id) || 0,
      }),
    );
  }, [currentStatus, activity?.chamber1Id, activity?.chamber2Id, dispatch]);
  useEffect(() => {
    console.log('idData==>', {id});
  }, []);
  const handleSelectActivityType = (item: MasterItem) => {
    setActivityTypeId(item.id);
    setActivityTypeName(item.displayName);
    setActivityTypeDropdownOpen(false);
    clearError('activityType');

    // NEW: reset Pending/reason if this selection makes Pending invalid
    const originalType = (activity?.activityType ?? '').trim().toLowerCase();
    const newType = String(item.displayName ?? '')
      .trim()
      .toLowerCase();
    const isCutAlertSwap =
      originalType !== '' &&
      newType !== '' &&
      originalType !== newType &&
      ['cut', 'alert'].includes(originalType) &&
      ['cut', 'alert'].includes(newType);

    if (isCutAlertSwap && currentStatus === 'Pending') {
      setCurrentStatus('');
      setReason('');
      setStatusDropdownOpen(false);
    }
  };
  const handleSelectStatus = (option: StatusOption) => {
    setCurrentStatus(option);
    setStatusDropdownOpen(false);
    if (option === 'Running' || option === 'Pending') {
      setWantsHandover(false); // default Yes on every status change
    } else {
      setWantsHandover(true);
      setHandoverToId('');
      setHandoverToName('');
      setHandoverDropdownOpen(false);
    }
    if (option !== 'Pending') {
      setReason('');
    }
  };

  // NEW: Yes/No toggle handler
  const handleToggleWantsHandover = (value: boolean) => {
    setWantsHandover(value);
    if (!value) {
      setHandoverToId('');
      setHandoverToName('');
      setHandoverDropdownOpen(false);
    }
  };
  const handleSelectEmployee = (emp: ZonewiseEmployee) => {
    setHandoverToId(getEmpId(emp));
    setHandoverToName(getEmpName(emp));
    setHandoverDropdownOpen(false);
  };
  const mainCoords = currentLocation ?? parseLatLng(activity?.latLng);
  const chamber1Coords: Coords | null =
    nearestLeftChamberLat !== null && nearestLeftChamberLng !== null
      ? {
          latitude: Number(nearestLeftChamberLat),
          longitude: Number(nearestLeftChamberLng),
        }
      : parseLatLng(activity?.chamber1LatLong);
  const chamber2Coords: Coords | null =
    nearestRightChamberLat !== null && nearestRightChamberLng !== null
      ? {
          latitude: Number(nearestRightChamberLat),
          longitude: Number(nearestRightChamberLng),
        }
      : parseLatLng(activity?.chamber2LatLong);
  const leftChamberDistanceFromMe =
    currentLocation && chamber1Coords
      ? getDistanceMeters(currentLocation, chamber1Coords)
      : null;
  const rightChamberDistanceFromMe =
    currentLocation && chamber2Coords
      ? getDistanceMeters(currentLocation, chamber2Coords)
      : null;
  const distanceBetweenChambers =
    nearestLeftChamberLat !== null &&
    nearestLeftChamberLng !== null &&
    nearestRightChamberLat !== null &&
    nearestRightChamberLng !== null
      ? getDistanceMeters(
          {
            latitude: Number(nearestLeftChamberLat),
            longitude: Number(nearestLeftChamberLng),
          },
          {
            latitude: Number(nearestRightChamberLat),
            longitude: Number(nearestRightChamberLng),
          },
        )
      : null;
  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert(
        'Not Allowed',
        'You are not authorized to submit this activity',
      );
      return;
    }
    if (
      activityTypeId === undefined ||
      activityTypeId === null ||
      String(activityTypeId).trim() === ''
    ) {
      Alert.alert('Required', 'Please select Activity Type');
      return;
    }
    if (!currentStatus) {
      Alert.alert('Required', 'Please select current status of activity');
      return;
    }
    if (
      (currentStatus === 'Running' || currentStatus === 'Pending') &&
      wantsHandover &&
      !handoverToId
    ) {
      Alert.alert('Required', 'Please select handover to employee');
      return;
    }
    if (currentStatus === 'Pending' && !reason.trim()) {
      Alert.alert('Required', 'Please enter reason for pending');
      return;
    }
    // NEW: GPS + address dono hone chahiye (AddCutScreen jaisa)
    if (!hasGps) {
      setErrors(prev => ({...prev, address: true}));
      Alert.alert(
        'Required',
        'Please fetch GPS location and address before submitting.',
      );
      return;
    }
    const mediaFiles = [pic1, pic2, pic3, pic4].filter(
      (img): img is NonNullable<ImageSlot> => !!img,
    );
    // All four activity pictures are required.
    if (mediaFiles.length < 4) {
      Alert.alert(
        'Required',
        'Please capture all 4 activity pictures before submitting',
      );
      return;
    }

    // Chamber 1 & 2 must be resolved and non-zero
    const resolvedChamber1Id = nearestLeftChamberId ?? activity?.chamber1IdInt;
    const resolvedChamber2Id = nearestRightChamberId ?? activity?.chamber2IdInt;

    if (!resolvedChamber1Id || Number(resolvedChamber1Id) <= 0) {
      Alert.alert('Required', 'Nearest Left Chamber not found. Cannot submit.');
      return;
    }
    if (!resolvedChamber2Id || Number(resolvedChamber2Id) <= 0) {
      Alert.alert(
        'Required',
        'Nearest Right Chamber not found. Cannot submit.',
      );
      return;
    }

    try {
      setSubmitting(true);
      const resolvedLatLng =
        gpsLat && gpsLong ? `${gpsLat},${gpsLong}` : activity?.latLng ?? '';
      const resolvedAddress = address || activity?.address || '';
      const resolvedDistanceToChamber1 =
        leftChamberDistanceFromMe ?? activity?.distanceToChamber1 ?? 0;
      const resolvedDistanceToChamber2 =
        rightChamberDistanceFromMe ?? activity?.distanceToChamber2 ?? 0;
      const resolvedDistanceBetweenChamber =
        distanceBetweenChambers ?? activity?.distanceBetweenChamber ?? 0;
      const selectedActivityTypeId = Number(activityTypeId);
      if (
        !Number.isFinite(selectedActivityTypeId) ||
        selectedActivityTypeId <= 0
      ) {
        Alert.alert('Required', 'Please select Activity Type');
        return;
      }
      console.log('activity:==>', {activity});
      await dispatch(
        insertActivityStatusAPI({
          activityId: activity?.activityId,
          activityTypeId: selectedActivityTypeId,
          latLng: resolvedLatLng,
          address: resolvedAddress,
          landmark: activity?.landmark ?? '',
          routeId: Number(activity?.routeId) || 0,
          chamber1Id: resolvedChamber1Id,
          chamber2Id: resolvedChamber2Id,
          distanceToChamber1: resolvedDistanceToChamber1,
          distanceToChamber2: resolvedDistanceToChamber2,
          distanceBetweenChamber: resolvedDistanceBetweenChamber,
          statusOfActivity: currentStatus,
          handOverTo:
            (currentStatus === 'Running' || currentStatus === 'Pending') &&
            wantsHandover &&
            handoverToId
              ? Number(handoverToId)
              : undefined,
          reason: currentStatus === 'Pending' ? reason.trim() : undefined,
          remark: remark.trim() || undefined,
          mediaFiles,
        }),
      ).unwrap();

      Alert.alert('Success', 'Activity status updated successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.message ?? String(err) ?? 'Unable to submit activity status',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const mediaSlots: Array<MaintenanceMedia | undefined> = Array.from({
    length: 4,
  }).map((_, i) => activity?.mediaList?.[i]);
  if (loading) {
    return (
      <Screen
        preset="fixed"
        statusBgColor={COLORS.BACKGROUND_DEFAULT}
        statusBarStyle="dark">
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.colorDeepskyblue} />
        </View>
      </Screen>
    );
  }
  if (errorMsg && !activity) {
    return (
      <Screen
        preset="fixed"
        statusBgColor={COLORS.BACKGROUND_DEFAULT}
        statusBarStyle="dark">
        <View style={styles.loaderContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={fetchActivityDetail}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }
  const isSubmitDisabled =
    submitting || isUserIdsLoading || loading || !canSubmit;
  return (
    <Screen
      preset="fixed"
      statusBgColor={COLORS.BACKGROUND_DEFAULT}
      statusBarStyle="dark">
      <View style={styles.body}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Image
              style={styles.backIcon}
              resizeMode="contain"
              source={IMAGES.back}
            />
          </Pressable>
          <Text style={styles.cutCss}>Continuity Activity</Text>
          <View style={styles.rightPlaceholder} />
        </View>
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainerContent}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: mainCoords.latitude,
              longitude: mainCoords.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            showsUserLocation
            showsMyLocationButton>
            <Marker coordinate={mainCoords} title="Alert Location" />
            {chamber1Coords && (
              <Marker
                coordinate={chamber1Coords}
                title={activity?.chamber1Name ?? 'Chamber 1'}
                pinColor="green"
              />
            )}
            {chamber2Coords && (
              <Marker
                coordinate={chamber2Coords}
                title={activity?.chamber2Name ?? 'Chamber 2'}
                pinColor="orange"
              />
            )}
          </MapView>
          <View style={styles.mainFlexBox}>
            <View style={[styles.workActivityAlert, styles.workShadowBox]}>
              <View style={[styles.headerRow, styles.headerFlexBox]}>
                <View style={styles.headerLeft}>
                  <View style={styles.warningIconBg}>
                    <Text style={[styles.filterText, styles.titleTypo]}>
                      {getLocatingBadge(activity?.cutAlertLocatingType)}
                    </Text>
                  </View>
                  <View style={styles.titleGroup}>
                    <Text
                      numberOfLines={1}
                      style={[styles.distanceText, styles.textTypo]}>
                      AlertID#{activity?.activityCode ?? id}
                    </Text>
                    <View style={styles.span}>
                      <Text style={styles.imageTypo}>Type:</Text>
                      <Text style={[styles.cardSubtitle, styles.textTypo]}>
                        {activity?.activityType ?? '--'}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.ul}>
                  <View
                    style={[styles.priorityPill, styles.prioritySpaceBlock]}>
                    <Text style={[styles.priorityText, styles.textTypo]}>
                      Event Start Date:
                    </Text>
                    <View style={[styles.ul2, styles.ul2FlexBox]}>
                      <Image
                        source={IMAGES.clock}
                        style={styles.vectorIcon2}
                        resizeMode="cover"
                      />
                      <Text
                        numberOfLines={1}
                        style={[styles.priorityText2, styles.textTypo]}>
                        {' '}
                        {formatDateTime(activity?.statusUpdatedOn)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.prioritySpaceBlock}>
                    <Text style={[styles.priorityText, styles.textTypo]}>
                      Status:
                    </Text>
                    <Text style={[styles.priorityText, styles.textTypo]}>
                      {activity?.currentStatus ?? 'Pending'}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.specsTable}>
                <View style={styles.ul3}>
                  <View style={styles.specRow1}>
                    <Text style={[styles.labelWorkBy2, styles.imageTypo]}>
                      Vendor Name:
                    </Text>
                    <Text style={styles.valTypo}>
                      {activity?.vendorName?.trim() ?? '--'}
                    </Text>
                  </View>
                  <View style={styles.specRow1}>
                    <Text style={[styles.labelWorkBy2, styles.imageTypo]}>
                      Work By:
                    </Text>
                    <Text style={styles.valTypo}>
                      {activity?.workBy ?? '--'}
                    </Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.ul3}>
                  <Text style={[styles.labelWorkBy2, styles.imageTypo]}>
                    Alert Address:
                  </Text>
                  <Text style={[styles.valCompany, styles.valTypo]}>
                    {activity?.address?.trim() ?? '--'}
                  </Text>
                </View>
                <View style={styles.row}>
                  <View style={styles.specRow1}>
                    <Text style={[styles.labelWorkBy2, styles.imageTypo]}>
                      Gig ID:
                    </Text>
                    {/* NOTE: response me explicit "gig id" field nahi hai, routeIdStr use kiya - confirm from backend */}
                    <Text style={[styles.valWorkBy3, styles.distanceTypo]}>
                      {activity?.routeIdStr ?? '--'}
                    </Text>
                  </View>
                </View>

                {/* Nearest Left/Right Chamber block */}
                <View style={styles.chamberSection}>
                  <View style={styles.chamberLayout}>
                    <View style={styles.chamberTimeline}>
                      <View style={styles.chamberDash} />
                      <Text style={styles.chamberLeftDistance}>
                        {isFetchingNearestChamber
                          ? '...'
                          : formatDistance(leftChamberDistanceFromMe)}
                      </Text>
                      <Image
                        source={IMAGES.upArrow}
                        style={styles.chamberUpperArrow}
                        resizeMode="contain"
                      />
                      <Image
                        source={IMAGES.locationCheck}
                        style={styles.chamberLocationPin}
                        resizeMode="contain"
                      />
                      <Image
                        source={IMAGES.downArrow2}
                        style={styles.chamberLowerArrow}
                        resizeMode="contain"
                      />
                      <Text style={styles.chamberRightDistance}>
                        {isFetchingNearestChamber
                          ? '...'
                          : formatDistance(rightChamberDistanceFromMe)}
                      </Text>
                    </View>
                    <View style={styles.chamberContent}>
                      <Text style={styles.chamberLabel}>
                        Nearest Left Chamber:
                      </Text>
                      <TextInput
                        style={styles.chamberInput}
                        accessibilityLabel="Nearest Left Chamber"
                        value={
                          isFetchingNearestChamber
                            ? 'Fetching...'
                            : nearestLeftChamber
                        }
                        onChangeText={setNearestLeftChamber}
                        editable={!isFetchingNearestChamber}
                        placeholder="Enclosure ID"
                        placeholderTextColor="#838992"
                      />
                      <View style={styles.chamberDistanceRow}>
                        <Image
                          source={IMAGES.dualsideArrow}
                          style={styles.chamberDistanceArrow}
                          resizeMode="contain"
                        />
                        <Text style={styles.chamberDistanceText}>
                          {isFetchingNearestChamber
                            ? '...'
                            : formatDistance(distanceBetweenChambers)}
                        </Text>
                      </View>
                      <Text style={styles.chamberLabel}>
                        Nearest Right Chamber:
                      </Text>
                      <TextInput
                        style={styles.chamberInput}
                        accessibilityLabel="Nearest Right Chamber"
                        value={
                          isFetchingNearestChamber
                            ? 'Fetching...'
                            : nearestRightChamber
                        }
                        onChangeText={setNearestRightChamber}
                        editable={!isFetchingNearestChamber}
                        placeholder="Enclosure ID"
                        placeholderTextColor="#838992"
                      />
                    </View>
                  </View>
                  <View style={styles.chamberActions}>
                    <TouchableOpacity
                      style={styles.chamberWhereButton}
                      disabled={isFetchingGps || isFetchingNearestChamber}
                      onPress={handleGetGps}>
                      {isFetchingGps || isFetchingNearestChamber ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.chamberButtonText}>
                          Where I am?
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.chamberMapButton}
                      onPress={openInGoogleMaps}>
                      <Image
                        style={styles.chamberMapIcon}
                        source={IMAGES.mapNew}
                        resizeMode="contain"
                      />
                      <Text style={styles.chamberButtonText}>
                        View on Google Map
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {/* ── Get GPS button (AddCutScreen jaisa) — dabate hi current
                      location + address fetch hota hai, aur uss lat/lng se nearest
                      chamber API call hokar Left/Right Chamber fields fresh data se
                      bhar deta hai. Photo capture bhi isi GPS fix (+ address) ke baad
                      enable hota hai (neeche Activity Pictures section). */}
                <View style={styles.fields}>
                  <View style={[styles.span5, styles.spanFlexBox]}>
                    <Text style={[styles.cutType, styles.image1Typo]}>
                      Lat/Lng:
                      {gpsLat && gpsLong
                        ? `${Number(gpsLat)
                            .toFixed(6)
                            .replace(/\.?0+$/, '')},${Number(gpsLong)
                            .toFixed(6)
                            .replace(/\.?0+$/, '')}`
                        : ''}{' '}
                    </Text>
                    <TouchableOpacity
                      style={[styles.li, styles.liShadowBox]}
                      onPress={handleGetGps}
                      disabled={isFetchingGps}>
                      {isFetchingGps ? (
                        <ActivityIndicator
                          size="small"
                          color={COLORS.colorWhite}
                        />
                      ) : (
                        <Text style={[styles.getGps, styles.getGpsTypo]}>
                          Get GPS
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  {/* NEW: Address ab editable hai (GPS milne ke baad). Agar
                      geocoder ko address na mile to user khud type kar sakta hai. */}
                  {hasLatLng && (
                    <View style={{alignSelf: 'stretch', gap: 6}}>
                      <Text style={[styles.cutType, styles.image1Typo]}>
                        Address *
                      </Text>
                      <View
                        style={[
                          styles.add3,
                          styles.btnBorder,
                          errors.address && styles.inputError,
                        ]}>
                        <TextInput
                          style={[styles.enterRemarks, styles.whereIAmTypo]}
                          value={address}
                          multiline
                          onChangeText={text => {
                            setAddress(text);
                            setIsAddressApproximate(false);
                            clearError('address');
                          }}
                          placeholder="Enter Address"
                          placeholderTextColor="rgba(0, 0, 0, 0.5)"
                        />
                      </View>
                      {isAddressApproximate && !!address.trim() && (
                        <Text style={styles.nearbyAddressHint}>
                          No address at this exact point — showing nearest
                          nearby address. Lat/Long is unchanged.
                        </Text>
                      )}
                      {errors.address && (
                        <Text style={styles.addressErrorText}>
                          Address is required
                        </Text>
                      )}
                    </View>
                  )}
                </View>

                <View style={styles.li6}>
                  <View style={styles.specsTable}>
                    <View style={styles.label}>
                      <View style={styles.span3}>
                        <Text
                          style={[
                            styles.activityPictures,
                            styles.whereIAmTypo,
                          ]}>
                          Activity Pictures:
                        </Text>
                      </View>
                    </View>
                  </View>

                  {hasGps ? (
                    <>
                      <View
                        style={[
                          styles.row,
                          styles.rowFlexBox,
                          styles.pictureSlotRow,
                        ]}>
                        <View style={styles.pictureSlotCol}>
                          <CaptureImageWatermark
                            title="Image 1"
                            pic={pic1}
                            setPic={result => {
                              setPic1(result);
                              if (result && errors.image1)
                                setErrors(e => ({...e, image1: false}));
                            }}
                            lat={gpsLat || ''}
                            long={gpsLong || ''}
                            address={address}
                            hasError={!!errors.image1}
                          />
                        </View>
                        <View style={styles.pictureSlotCol}>
                          <CaptureImageWatermark
                            title="Image 2"
                            pic={pic2}
                            setPic={result => {
                              setPic2(result);
                              if (result && errors.image2)
                                setErrors(e => ({...e, image2: false}));
                            }}
                            lat={gpsLat || ''}
                            long={gpsLong || ''}
                            address={address}
                            hasError={!!errors.image2}
                          />
                        </View>
                      </View>
                      <View
                        style={[
                          styles.row,
                          styles.rowFlexBox,
                          styles.pictureSlotRow,
                        ]}>
                        <View style={styles.pictureSlotCol}>
                          <CaptureImageWatermark
                            title="Image 3"
                            pic={pic3}
                            setPic={result => {
                              setPic3(result);
                              if (result && errors.image3)
                                setErrors(e => ({...e, image3: false}));
                            }}
                            lat={gpsLat || ''}
                            long={gpsLong || ''}
                            address={address}
                            hasError={!!errors.image3}
                          />
                        </View>
                        <View style={styles.pictureSlotCol}>
                          <CaptureImageWatermark
                            title="Image 4"
                            pic={pic4}
                            setPic={result => {
                              setPic4(result);
                              if (result && errors.image4)
                                setErrors(e => ({...e, image4: false}));
                            }}
                            lat={gpsLat || ''}
                            long={gpsLong || ''}
                            address={address}
                            hasError={!!errors.image4}
                          />
                        </View>
                      </View>
                    </>
                  ) : (
                    <View style={styles.gpsPromptBox}>
                      <Text style={styles.gpsPromptText}>
                        Tap "Get GPS" above and make sure the address is filled
                        to enable photo capture.
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.mainFlexBox}>
                  <View style={styles.specsTable}>
                    <View style={styles.span3}>
                      <Text
                        style={[styles.activityPictures, styles.whereIAmTypo]}>
                        Remark
                      </Text>
                    </View>
                    <View style={[styles.add3]}>
                      <TextInput
                        style={[styles.enterRemarks, styles.whereIAmTypo]}
                        value={remark}
                        onChangeText={setRemark}
                        placeholder="Enter remark"
                        placeholderTextColor="rgba(0, 0, 0, 0.5)"
                      />
                    </View>
                  </View>
                  <View style={styles.specsTable}>
                    <View style={styles.span3}>
                      <Text
                        style={[styles.activityPictures, styles.whereIAmTypo]}>
                        Activity Type
                      </Text>
                    </View>
                    <View style={styles.dropdownWrapper}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={[styles.add3, styles.btnBorder]}
                        disabled={isMasterLoading}
                        onPress={() => {
                          setActivityTypeDropdownOpen(prev => !prev);
                          setStatusDropdownOpen(false);
                          setHandoverDropdownOpen(false);
                        }}>
                        <Text
                          style={[
                            styles.runningpendingclosed,
                            styles.whereIAmTypo,
                            !activityTypeName && styles.placeholderText,
                          ]}>
                          {isMasterLoading
                            ? 'Loading...'
                            : activityTypeName || 'Select Activity Type'}
                        </Text>
                        {isMasterLoading ? (
                          <ActivityIndicator
                            size="small"
                            color={COLORS.colorDeepskyblue}
                          />
                        ) : (
                          <Image
                            style={[
                              styles.vectorIcon4,
                              activityTypeDropdownOpen && styles.chevronOpen,
                            ]}
                            resizeMode="cover"
                          />
                        )}
                      </TouchableOpacity>
                      {activityTypeDropdownOpen && (
                        <View style={styles.dropdownList}>
                          {masterData?.activityType?.length ? (
                            masterData.activityType
                              .filter(
                                item =>
                                  String(item?.displayName ?? '')
                                    .trim()
                                    .toLowerCase() !== 'locating',
                              )
                              .map((item, index, filteredActivityTypes) => {
                                const isSelected =
                                  String(activityTypeId) === String(item.id);
                                return (
                                  <TouchableOpacity
                                    key={String(item.id)}
                                    activeOpacity={0.7}
                                    style={[
                                      styles.dropdownItem,
                                      index !==
                                        filteredActivityTypes.length - 1 &&
                                        styles.dropdownItemBorder,
                                    ]}
                                    onPress={() =>
                                      handleSelectActivityType(item)
                                    }>
                                    <Text
                                      style={[
                                        styles.dropdownItemText,
                                        isSelected &&
                                          styles.dropdownItemTextSelected,
                                      ]}>
                                      {item.displayName}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })
                          ) : (
                            <View style={styles.dropdownItem}>
                              <Text style={styles.dropdownItemText}>
                                No activity type found
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.specsTable}>
                    <View style={styles.span3}>
                      <Text
                        style={[styles.activityPictures, styles.whereIAmTypo]}>
                        Current Status of Activity
                      </Text>
                    </View>
                    <View style={styles.dropdownWrapper}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={[styles.add3, styles.btnBorder]}
                        onPress={() => {
                          setStatusDropdownOpen(prev => !prev);
                          setHandoverDropdownOpen(false);
                        }}>
                        <Text
                          style={[
                            styles.runningpendingclosed,
                            styles.whereIAmTypo,
                            !currentStatus && styles.placeholderText,
                          ]}>
                          {currentStatus || 'Running/Pending/Closed'}
                        </Text>
                        <Image
                          style={[
                            styles.vectorIcon4,
                            statusDropdownOpen && styles.chevronOpen,
                          ]}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                      {statusDropdownOpen && (
                        <View style={styles.dropdownList}>
                          {availableStatusOptions.map((option, index) => (
                            <TouchableOpacity
                              key={option}
                              activeOpacity={0.7}
                              style={[
                                styles.dropdownItem,
                                index !== availableStatusOptions.length - 1 &&
                                  styles.dropdownItemBorder,
                              ]}
                              onPress={() => handleSelectStatus(option)}>
                              <Text
                                style={[
                                  styles.dropdownItemText,
                                  currentStatus === option &&
                                    styles.dropdownItemTextSelected,
                                ]}>
                                {option}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                  {(currentStatus === 'Running' ||
                    currentStatus === 'Pending') && (
                    <View style={styles.specsTable}>
                      <View style={styles.span3}>
                        <Text
                          style={[
                            styles.activityPictures,
                            styles.whereIAmTypo,
                          ]}>
                          Handover To :
                        </Text>
                      </View>

                      <View style={[styles.span3, {gap: Gap.gap_12}]}>
                        <Text
                          style={[
                            styles.activityPictures,
                            styles.whereIAmTypo,
                          ]}>
                          Do you want to handover?
                        </Text>
                        <TouchableOpacity
                          style={styles.checkboxRow}
                          activeOpacity={0.7}
                          onPress={() => handleToggleWantsHandover(true)}>
                          <View
                            style={[
                              styles.checkboxBox,
                              wantsHandover && styles.checkboxBoxChecked,
                            ]}>
                            {wantsHandover && (
                              <View style={styles.checkboxInnerDot} />
                            )}
                          </View>
                          <Text style={styles.dropdownItemText}>Yes</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.checkboxRow}
                          activeOpacity={0.7}
                          onPress={() => handleToggleWantsHandover(false)}>
                          <View
                            style={[
                              styles.checkboxBox,
                              !wantsHandover && styles.checkboxBoxChecked,
                            ]}>
                            {!wantsHandover && (
                              <View style={styles.checkboxInnerDot} />
                            )}
                          </View>
                          <Text style={styles.dropdownItemText}>No</Text>
                        </TouchableOpacity>
                      </View>

                      {wantsHandover && (
                        <View style={styles.dropdownWrapper}>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            style={[styles.add3, styles.btnBorder]}
                            disabled={zonewiseEmpForActivityLoading}
                            onPress={() => {
                              setHandoverDropdownOpen(prev => !prev);
                              setStatusDropdownOpen(false);
                            }}>
                            <Text
                              style={[
                                styles.runningpendingclosed,
                                styles.whereIAmTypo,
                                !handoverToName && styles.placeholderText,
                              ]}>
                              {zonewiseEmpForActivityLoading
                                ? 'Loading employees...'
                                : handoverToName || 'Select employee'}
                            </Text>
                            {zonewiseEmpForActivityLoading ? (
                              <ActivityIndicator
                                size="small"
                                color={COLORS.colorDeepskyblue}
                              />
                            ) : (
                              <Image
                                style={[
                                  styles.vectorIcon4,
                                  handoverDropdownOpen && styles.chevronOpen,
                                ]}
                                resizeMode="cover"
                              />
                            )}
                          </TouchableOpacity>
                          {handoverDropdownOpen && (
                            <View style={styles.dropdownList}>
                              {zonewiseEmpForActivity &&
                              zonewiseEmpForActivity.length > 0 ? (
                                zonewiseEmpForActivity.map((emp, index) => (
                                  <TouchableOpacity
                                    key={`${getEmpId(emp)}-${index}`}
                                    activeOpacity={0.7}
                                    style={[
                                      styles.dropdownItem,
                                      index !==
                                        zonewiseEmpForActivity.length - 1 &&
                                        styles.dropdownItemBorder,
                                    ]}
                                    onPress={() => handleSelectEmployee(emp)}>
                                    <Text
                                      style={[
                                        styles.dropdownItemText,
                                        handoverToId === getEmpId(emp) &&
                                          styles.dropdownItemTextSelected,
                                      ]}>
                                      {getEmpName(emp)}
                                    </Text>
                                  </TouchableOpacity>
                                ))
                              ) : (
                                <View style={styles.dropdownItem}>
                                  <Text style={styles.dropdownItemText}>
                                    No employees found
                                  </Text>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}
                  {currentStatus === 'Pending' && (
                    <View style={styles.specsTable}>
                      <View style={styles.span3}>
                        <Text
                          style={[
                            styles.activityPictures,
                            styles.whereIAmTypo,
                          ]}>{`Reason :  `}</Text>
                      </View>
                      <View style={[styles.add3, styles.btnBorder]}>
                        <TextInput
                          style={[
                            styles.runningpendingclosed,
                            styles.whereIAmTypo,
                          ]}
                          value={reason}
                          onChangeText={setReason}
                          placeholder="Enter Reason to Pending"
                          placeholderTextColor="rgba(0, 0, 0, 0.5)"
                        />
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
          <View style={styles.li3}>
            {!isUserIdsLoading && activity && !canSubmit && (
              <Text style={styles.notAuthorizedText}>
                Aap is activity ko submit karne ke liye authorized nahi hain.
              </Text>
            )}
            <TouchableOpacity
              style={[styles.button, isSubmitDisabled && styles.buttonDisabled]}
              disabled={isSubmitDisabled}
              onPress={handleSubmit}>
              {submitting || isUserIdsLoading ? (
                <ActivityIndicator size="small" color={COLORS.colorWhite} />
              ) : (
                <Text style={[styles.whereIAm, styles.whereIAmTypo]}>
                  Submit
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      <NearestRouteFallbackModal
        visible={isFallbackRouteModalVisible}
        isLoading={isFetchingFallbackRoute}
        info={fallbackRouteInfo}
        onClose={handleCloseFallbackRouteModal}
      />
    </Screen>
  );
};
export default ContunityScreen;
const styles = StyleSheet.create({
  titleTypo: {
    textAlign: 'center',
    fontFamily: FONTS.REGULAR,
  },
  cameraIconLayout: {
    width: Width.width_24,
    height: Height.height_24,
  },
  mapIconFlexBox: {
    borderRadius: Border.br_8,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  workShadowBox: {
    padding: 10,
    backgroundColor: COLORS.colorWhite,
    elevation: 0,
    borderRadius: Border.br_8,
    alignItems: 'flex-start',
  },
  headerFlexBox: {
    justifyContent: 'space-between',
    flexDirection: 'row',
  },
  textTypo: {
    textAlign: 'left',
    fontFamily: FONTS.REGULAR,
  },
  prioritySpaceBlock: {
    gap: Gap.gap_2,
    paddingVertical: Padding.padding_2,
    paddingHorizontal: Padding.padding_0,
    borderRadius: Border.br_5,
    alignItems: 'flex-start',
  },
  ul2FlexBox: {
    gap: Gap.gap_1,
    alignItems: 'center',
    flexDirection: 'row',
  },
  imageTypo: {
    color: COLORS.colorSlategray,
    fontSize: 9,
    textAlign: 'left',
    fontFamily: FONTS.SEMI_BOLD,
  },
  valTypo: {
    color: COLORS.BLACK,
    fontSize: 9,
    textAlign: 'left',
    fontFamily: FONTS.REGULAR,
    fontWeight: '500',
    flex: 1,
  },
  distanceTypo: {
    color: COLORS.colorRoyalblue300,
    textAlign: 'left',
    fontWeight: '600',
    fontFamily: FONTS.REGULAR,
  },
  chamberSection: {alignSelf: 'stretch', gap: 10},
  chamberLayout: {flexDirection: 'row', minHeight: 174},
  chamberTimeline: {width: 30, position: 'relative'},
  chamberDash: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderLeftWidth: 2,
    borderColor: '#D2D5D9',
    borderStyle: 'dashed',
  },
  chamberLocationPin: {
    position: 'absolute',
    left: -9,
    top: 77,
    width: 30,
    height: 30,
  },
  chamberUpperArrow: {
    position: 'absolute',
    left: 4,
    top: 42,
    width: 22,
    height: 36,
  },
  chamberLowerArrow: {
    position: 'absolute',
    left: 4,
    bottom: 22,
    width: 22,
    height: 36,
  },
  chamberLeftDistance: {
    position: 'absolute',
    left: 2,
    top: 30,
    fontSize: 9,
    color: '#0098FF',
    backgroundColor: '#FFFFFF',
  },
  chamberRightDistance: {
    position: 'absolute',
    left: 2,
    bottom: 7,
    fontSize: 9,
    color: '#0098FF',
    backgroundColor: '#FFFFFF',
  },
  chamberContent: {flex: 1, minWidth: 0, gap: 6, paddingTop: 3},
  chamberLabel: {fontSize: 11, fontFamily: FONTS.REGULAR, color: '#373B44'},
  chamberInput: {
    alignSelf: 'stretch',
    backgroundColor: '#E9ECEF',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 0,
    height: 33,
    fontSize: 11,
    fontFamily: FONTS.REGULAR,
    color: '#838992',
  },
  chamberDistanceRow: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  chamberDistanceArrow: {height: 25, width: 9},
  chamberDistanceText: {
    fontSize: 9,
    color: '#0098FF',
    fontFamily: FONTS.REGULAR,
  },
  chamberActions: {
    flexDirection: 'row',
    gap: 10,
    marginLeft: 30,
    alignSelf: 'stretch',
  },
  chamberWhereButton: {
    backgroundColor: '#2D64F5',
    borderRadius: 7,
    minHeight: 34,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chamberMapButton: {
    backgroundColor: '#373B44',
    borderRadius: 7,
    minHeight: 34,
    paddingHorizontal: 14,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 1,
  },
  chamberButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: FONTS.REGULAR,
    fontWeight: '500',
    flexShrink: 1,
  },
  chamberMapIcon: {width: 13, height: 18},
  mainFlexBox: {
    gap: Gap.gap_10,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  liShadowBox: {
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
  },
  getGpsTypo: {
    color: COLORS.colorWhite,
    textAlign: 'left',
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
  },
  locationPosition: {
    top: '50%',
    position: 'absolute',
  },
  btnBorder: {
    borderWidth: 1,
    borderStyle: 'solid',
    alignItems: 'center',
  },
  closeIconPosition: {
    zIndex: 2,
    position: 'absolute',
  },
  locationLayout: {
    left: 17.5,
    width: Width.width_19,
    height: 31.5,
    borderRadius: Border.br_4,
  },
  mTypo: {
    color: COLORS.colorRoyalblue200,
    fontSize: FontSize.fs_10,
    textAlign: 'left',
    fontFamily: FONTS.REGULAR,
  },
  incaseOfRunningTypo: {
    fontSize: FontSize.fs_12,
    textAlign: 'left',
    fontFamily: FONTS.SEMI_BOLD,
  },
  addFlexBox: {
    borderRadius: Border.br_6,
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  enterRemarksLayout: {
    opacity: 1,
    lineHeight: LineHeight.lh_22,
    color: COLORS.colorDarkslategray,
    flex: 1,
  },
  li4FlexBox: {
    paddingVertical: 9,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    borderRadius: Border.br_8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: Padding.padding_16,
  },
  addSpaceBlock: {
    paddingHorizontal: Padding.padding_12,
    borderRadius: Border.br_8,
  },
  whereIAmTypo: {
    fontSize: 10,
    textAlign: 'left',
    fontFamily: FONTS.SEMI_BOLD,
  },
  body: {
    width: '100%',
    height: '100%',
    paddingTop: 20,
    paddingBottom: 24,
    gap: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F3F6F9',
    alignItems: 'flex-start',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 24,
    gap: Gap.gap_12,
    alignSelf: 'stretch',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  cutCss: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    letterSpacing: -0.4,
    lineHeight: 23,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
    fontWeight: '500',
  },
  rightPlaceholder: {
    width: 40,
  },
  list: {
    flex: 1,
    alignSelf: 'stretch',
    width: '100%',
  },
  fields: {
    width: '100%',
    gap: Gap.gap_12,
    alignItems: 'flex-start',
  },
  span5: {
    justifyContent: 'space-between',
    gap: 20,
    alignSelf: 'stretch',
  },
  li: {
    borderRadius: 5,
    backgroundColor: COLORS.colorRoyalblue,
    paddingHorizontal: 6,
    paddingVertical: 5,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  getGps: {
    fontSize: 12,
  },
  cutType: {
    letterSpacing: LetterSpacing.ls_0_2,
    textAlign: 'left',
    color: COLORS.colorDarkslategray,
    fontSize: FontSize.fs_14,
  },
  image1Typo: {
    textAlign: 'left',
    fontFamily: FontFamily.switzer,
  },
  listLayout: {
    alignSelf: 'stretch',
  },
  listContainerContent: {
    gap: 12,
    paddingBottom: 24,
    alignItems: 'center',
    flexGrow: 1,
  },
  map: {
    width: '100%',
    aspectRatio: 2.2,
    borderRadius: 6,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Gap.gap_12,
  },
  errorText: {
    fontSize: FontSize.fs_14,
    color: COLORS.ERROR ?? 'red',
    textAlign: 'center',
    fontFamily: FONTS.REGULAR,
    paddingHorizontal: Padding.padding_16,
  },
  retryBtn: {
    backgroundColor: COLORS.colorDeepskyblue,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Border.br_8,
  },
  retryBtnText: {
    color: COLORS.colorWhite,
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: FontSize.fs_14,
  },
  workActivityAlert: {
    gap: Gap.gap_6,
    alignSelf: 'stretch',
  },
  headerRow: {
    gap: 8,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  headerLeft: {
    gap: 7,
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    minWidth: 0,
  },
  warningIconBg: {
    backgroundColor: COLORS.colorMediumvioletred,
    borderRadius: Border.br_5,
    width: 25,
    height: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterText: {
    fontWeight: '700',
    color: COLORS.colorWhite,
    fontSize: 11,
    alignSelf: 'center',
  },
  titleGroup: {
    gap: 1,
    alignItems: 'flex-start',
    flex: 1,
  },
  distanceText: {
    color: COLORS.colorMediumvioletred,
    fontWeight: '600',
    textAlign: 'left',
    letterSpacing: LetterSpacing.ls_0_2,
    fontSize: 11,
    alignSelf: 'flex-start',
  },
  span: {
    gap: Gap.gap_3,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  cardSubtitle: {
    color: COLORS.colorDarkorange,
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'left',
  },
  ul: {
    flex: 1.5,
    minWidth: 0,
    gap: 9,
    alignItems: 'center',
    flexDirection: 'row',
  },
  priorityPill: {
    flex: 1,
  },
  priorityText: {
    fontSize: 9,
    alignSelf: 'flex-start',
    color: COLORS.colorDarkslategray,
    fontWeight: '500',
  },
  ul2: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  vectorIcon2: {
    height: 10,
    width: 10,
  },
  priorityText2: {
    fontSize: 8,
    flexShrink: 1,
    color: COLORS.colorDarkslategray,
    fontWeight: '500',
  },
  divider: {
    height: Height.height_0,
    borderTopWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderStyle: 'solid',
    alignSelf: 'stretch',
  },
  specsTable: {
    gap: Gap.gap_6,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  ul3: {
    gap: Gap.gap_6,
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  specRow1: {
    gap: Gap.gap_6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  labelWorkBy2: {
    width: 66,
  },
  labelWorkingFor: {
    width: 90,
  },
  valCompany: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  valWorkBy3: {
    fontSize: 9,
    flex: 1,
  },
  row3: {
    paddingTop: Padding.padding_4,
    flexDirection: 'row',
  },
  div: {
    paddingRight: 19,
    gap: Gap.gap_8,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  location: {
    marginTop: -9,
    left: -10,
    alignSelf: 'center',
    gap: Gap.gap_10,
    zIndex: 1,
    alignItems: 'center',
    flexDirection: 'row',
  },
  locationChild: {
    height: 12.36,
    width: 12.36,
    marginTop: -6,
    right: -6.32,
    borderRadius: 1,
    zIndex: 0,
  },
  locationIcon: {
    borderRadius: 53,
    paddingLeft: 1,
    width: Width.width_28,
    height: Height.height_28,
    borderWidth: 1,
    overflow: 'hidden',
    borderColor: 'transparent',
    backgroundColor: COLORS.colorWhite,
    zIndex: 1,
    justifyContent: 'center',
  },
  groupIcon: {
    width: 20.44,
    height: 20.43,
  },
  locationItem: {
    top: 62.5,
    left: 17.5,
    width: Width.width_19,
    height: 31.5,
    borderRadius: Border.br_4,
  },
  locationInner: {
    top: -36,
    zIndex: 3,
    position: 'absolute',
  },
  m: {
    width: 60,
    top: -30,
    zIndex: 4,
    left: 13,
    height: 13,
    color: COLORS.colorRoyalblue200,
    position: 'absolute',
  },
  m2: {
    width: 60,
    top: 88,
    zIndex: 5,
    left: 13,
    height: 13,
    color: COLORS.colorRoyalblue200,
    position: 'absolute',
  },
  box: {
    width: 341,
    alignItems: 'flex-start',
  },
  ul5: {
    gap: 26,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  span2: {
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  nearestLeftChamberWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  nearestLeftChamber: {
    letterSpacing: LetterSpacing.ls_0_2,
    color: COLORS.colorDarkslategray,
  },
  add: {
    backgroundColor: COLORS.colorWhitesmoke200,
    paddingVertical: Padding.padding_6,
    paddingHorizontal: Padding.padding_12,
    borderRadius: Border.br_6,
    alignItems: 'flex-start',
    width: '85%',
  },
  chhtag4EnclosureId: {
    fontSize: FontSize.fs_12,
    textAlign: 'left',
    fontFamily: FONTS.REGULAR,
  },
  li2: {
    gap: Gap.gap_6,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  liChild: {
    height: 25,
  },
  m3: {
    fontWeight: '500',
  },
  li3: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  span3: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  footer: {
    paddingLeft: 34,
    gap: Gap.gap_10,
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  li4: {
    backgroundColor: COLORS.colorRoyalblue100,
  },
  whereIAm: {
    color: COLORS.colorWhite,
    fontWeight: '500',
  },
  li5: {
    backgroundColor: COLORS.colorDarkslategray,
    gap: Gap.gap_8,
    width: '60%',
  },
  liItem: {
    height: 18,
    width: 12.29,
  },
  li6: {
    gap: Gap.gap_10,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  label: {
    justifyContent: 'center',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  activityPictures: {
    letterSpacing: LetterSpacing.ls_0_2,
    color: COLORS.colorDarkslategray,
  },
  col2: {
    gap: Gap.gap_8,
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  colFlexBox: {
    backgroundColor: COLORS.colorWhitesmoke100,
    height: Height.height_80,
    borderRadius: Border.br_6,
    gap: Gap.gap_3,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  cameraIcon: {
    zIndex: 0,
  },
  image1: {
    alignSelf: 'center',
    zIndex: 1,
  },
  rowFlexBox: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  pictureSlotRow: {
    alignItems: 'stretch',
  },
  pictureSlotCol: {
    flex: 1,
    alignItems: 'stretch',
    minHeight: Height.height_80,
  },
  gpsPromptBox: {
    backgroundColor: COLORS.colorWhitesmoke200 ?? '#F4F6FA',
    borderRadius: Border.br_8,
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderStyle: 'dashed',
    paddingHorizontal: Padding.padding_12,
    paddingVertical: Padding.padding_16,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  gpsPromptText: {
    fontSize: FontSize.fs_12,
    fontFamily: FontFamily.switzer,
    color: COLORS.colorSlategray,
    textAlign: 'center',
  },
  add3: {
    paddingHorizontal: Padding.padding_12,
    borderColor: COLORS.colorAliceblue,
    backgroundColor: COLORS.colorWhite,
    borderWidth: 1,
    borderRadius: Border.br_8,
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  enterRemarks: {
    flex: 1,
    color: COLORS.colorDarkslategray,
  },
  runningpendingclosed: {
    lineHeight: LineHeight.lh_22,
    fontSize: FontSize.fs_14,
    color: COLORS.colorDarkslategray,
    flex: 1,
  },
  placeholderText: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
  vectorIcon4: {
    height: 5.86,
    width: 10.25,
    opacity: 1,
  },
  chevronOpen: {
    transform: [{rotate: '180deg'}],
  },
  incaseOfRunning: {
    color: COLORS.colorRed,
    letterSpacing: LetterSpacing.ls_0_2,
  },
  button: {
    backgroundColor: COLORS.colorDeepskyblue,
    paddingHorizontal: 20,
    paddingVertical: 13,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    borderRadius: Border.br_8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  notAuthorizedText: {
    fontSize: FontSize.fs_10,
    fontFamily: FONTS.REGULAR,
    color: COLORS.ERROR ?? 'red',
    textAlign: 'center',
    alignSelf: 'stretch',
    marginBottom: Gap.gap_6,
  },
  dropdownWrapper: {
    alignSelf: 'stretch',
  },
  dropdownList: {
    marginTop: 4,
    maxHeight: 220,
    backgroundColor: COLORS.colorWhite,
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderRadius: Border.br_8,
    elevation: 4,
    boxShadow: BoxShadow.shadow_drop,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: Padding.padding_12,
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderColor: COLORS.colorAliceblue,
  },
  dropdownItemText: {
    color: COLORS.colorDarkslategray,
  },
  dropdownItemTextSelected: {
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDeepskyblue,
  },
  spanFlexBox: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkboxBox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.colorWhite,
  },
  checkboxBoxChecked: {
    borderColor: COLORS.colorDeepskyblue,
  },
  checkboxInnerDot: {
    width: 9,
    height: 9,
    borderRadius: 2,
    backgroundColor: COLORS.colorDeepskyblue,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerUserInfo: {
    fontSize: 10,
    color: COLORS.colorSlategray,
    fontFamily: FONTS.REGULAR,
    marginTop: 2,
  },

  // ── NEW: Address input / hint styles ──────────────────────────────────
  inputError: {
    borderColor: COLORS.colorRed ?? 'red',
    borderWidth: 1.5,
  },
  nearbyAddressHint: {
    fontSize: 11,
    fontFamily: FontFamily.switzer,
    color: COLORS.colorSlategray,
  },
  addressErrorText: {
    fontSize: 11,
    fontFamily: FontFamily.switzer,
    color: COLORS.colorRed ?? 'red',
  },

  // ── Nearest-route fallback popup ──────────────────────────────────────
  fallbackModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  fallbackModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_10,
    paddingHorizontal: Padding.padding_16,
    paddingVertical: Padding.padding_16,
    gap: 10,
    elevation: 6,
    boxShadow: BoxShadow.shadow_drop,
  },
  fallbackModalLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  fallbackModalLoadingText: {
    fontSize: FontSize.fs_14,
    fontFamily: FontFamily.switzer,
    color: COLORS.colorDarkslategray,
  },
  fallbackModalTitle: {
    fontSize: FontSize.fs_14,
    fontFamily: FontFamily.switzer,
    fontWeight: '700',
    color: COLORS.colorDarkslategray,
  },
  fallbackModalText: {
    fontSize: FontSize.fs_14,
    fontFamily: FontFamily.switzer,
    color: COLORS.colorDarkslategray,
    lineHeight: LineHeight.lh_22,
  },
  fallbackModalHighlight: {
    fontWeight: '700',
    color: COLORS.colorRoyalblue,
  },
  fallbackModalSubText: {
    fontSize: FontSize.fs_12,
    fontFamily: FontFamily.switzer,
    color: COLORS.colorSlategray,
  },
  fallbackModalButton: {
    marginTop: 4,
    alignSelf: 'flex-end',
    backgroundColor: COLORS.colorRoyalblue,
    borderRadius: Border.br_6,
    paddingHorizontal: Padding.padding_16,
    paddingVertical: Padding.padding_7,
  },
  fallbackModalButtonText: {
    color: COLORS.colorWhite,
    fontSize: FontSize.fs_14,
    fontFamily: FontFamily.switzer,
    fontWeight: '600',
  },
});
