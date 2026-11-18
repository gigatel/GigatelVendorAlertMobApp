//latest addCutScreen
import React, {FC, useEffect, useMemo, useRef, useState} from 'react';
import {
  Text,
  StyleSheet,
  View,
  Image,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  ScrollView,
  Linking,
  DeviceEventEmitter,
  LayoutChangeEvent,
  Modal,
} from 'react-native';
import {useDispatch} from 'react-redux';
import {ScreenProps} from '@types';
import {Screen} from '@organisms';
import {Common, Location} from '@utils';
import {fetchCurrentGpsLocation} from '../../components/molecules/LocationButton/gps';
import {
  Padding,
  Border,
  FontFamily,
  LineHeight,
  FontSize,
  BoxShadow,
  Gap,
  Height,
  LetterSpacing,
  Width,
} from '../../res/globalStyle';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import DssCustomPicker from '../../components/molecules/DsscustomPicker';
import CaptureImageWatermark, {
  BurnResult,
} from '../../components/molecules/capture-image-watermark';
import {
  getMaintenanceActivityDDAPI,
  getMaintenanceActivityVendorDDAPI,
  getNearestChamberByLatlngAPI,
  getNearestChamberByLatlngAPIByVendor,
  getNearestRouteByLatlngAPI,
  insertMaintenanceActivityAPI,
  InsertMaintenanceActivityParams,
} from '../../store/slices/maintenance.slice';
type ImageSlot = (BurnResult & {type?: string; name?: string}) | null;
type MasterItem = {
  id: number | string;
  displayName: string;
  parentValueId?: number | string;
  [key: string]: any;
};
type VendorSuggestion = {
  id: number | string;
  vendorName: string;
  vendorMobileNo: string;
  [key: string]: any;
};
type DropdownMaster = {
  activityType: MasterItem[];
  cutType: MasterItem[];
  alertType: MasterItem[];
  locatingType: MasterItem[];
  workBy: MasterItem[];
  workingFor: MasterItem[];
  companyType: MasterItem[];
  priority: MasterItem[];
};
type NearestChamberItem = {
  id?: number | string;
  chamberId?: number | string;
  chamber1Id?: number | string;
  chamber2Id?: number | string;
  chamber1IdStr?: string;
  chamber2IdStr?: string;
  chamber1ChamberId?: string;
  chamber2ChamberId?: string;
  routeId?: number | string;
  routeIdStr?: string;
  chamber1Name?: string;
  chamber2Name?: string;
  chamber1ChamberName?: string;
  chamber2ChamberName?: string;
  chamber1Address?: string;
  chamber2Address?: string;
  chamber1Landmark?: string;
  chamber2Landmark?: string;
  enclosureId?: string;
  name?: string;
  code?: string;
  DistanceBetweenchambers?: number | string;
  chamber1Lat?: number | string;
  chamber1Lng?: number | string;
  chamber2Lat?: number | string;
  chamber2Lng?: number | string;
  distance?: number;
  chamberIdStr?: string;
  chamberName?: string;
  enclosure_id?: string;
  enclosureID?: string;
  [key: string]: any;
};
const getChamberLabel = (item?: NearestChamberItem | null): string | null => {
  if (!item) return null;
  const value =
    item.enclosureId ??
    item.enclosureID ??
    item.enclosure_id ??
    item.chamberIdStr ??
    item.chamberId ??
    item.chamberName ??
    item.name ??
    item.code ??
    null;
  return value === null || value === undefined ? null : String(value);
};
const getChamberIdValue = (
  item?: NearestChamberItem | null,
): number | string | null => {
  if (!item) return null;
  return item.id ?? item.chamberId ?? null;
};
const getRouteIdValue = (item?: any): string | null => {
  const value =
    item?.routeIdStr ??
    item?.RouteIdStr ??
    item?.route_id_str ??
    item?.routeIDStr ??
    null;
  return value === null || value === undefined || value === ''
    ? null
    : String(value);
};
const getRouteIdNumericValue = (item?: any): number | string | null => {
  const value =
    item?.routeId ?? item?.RouteId ?? item?.route_id ?? item?.routeID ?? null;
  return value === null || value === undefined || value === '' ? null : value;
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
  if (values.length > 0) {
    return values.join(', ');
  }
  const fallback = [name, address].filter(
    (value): value is string => !!value && String(value).trim() !== '',
  );
  return fallback.length > 0 ? fallback.join(', ') : null;
};
const getChamberIdDisplay = (
  chamber: 'left' | 'right',
  item?: NearestChamberItem | null,
): string | null => {
  if (!item) return null;
  const isLeft = chamber === 'left';
  const rawId = isLeft
    ? item.chamber1IdStr ?? item.chamber1ChamberId ?? item.chamber1Id
    : item.chamber2IdStr ?? item.chamber2ChamberId ?? item.chamber2Id;
  return rawId === null || rawId === undefined ? null : String(rawId);
};
const getChamberNameDisplay = (
  chamber: 'left' | 'right',
  item?: NearestChamberItem | null,
): string | null => {
  if (!item) return null;
  const isLeft = chamber === 'left';
  const rawName = isLeft
    ? item.chamber1Name ?? item.chamber1ChamberName
    : item.chamber2Name ?? item.chamber2ChamberName;
  return rawName ? String(rawName) : null;
};
const toRadians = (value: number): number => (value * Math.PI) / 180;
const getDistanceInMeters = (
  lat1?: number | string | null,
  lng1?: number | string | null,
  lat2?: number | string | null,
  lng2?: number | string | null,
): number | null => {
  if (
    lat1 === undefined ||
    lat1 === null ||
    lng1 === undefined ||
    lng1 === null ||
    lat2 === undefined ||
    lat2 === null ||
    lng2 === undefined ||
    lng2 === null
  ) {
    return null;
  }
  const la1 = Number(lat1);
  const lo1 = Number(lng1);
  const la2 = Number(lat2);
  const lo2 = Number(lng2);
  if (
    Number.isNaN(la1) ||
    Number.isNaN(lo1) ||
    Number.isNaN(la2) ||
    Number.isNaN(lo2)
  ) {
    return null;
  }

  const R = 6371000; // Earth radius in meters
  const dLat = toRadians(la2 - la1);
  const dLng = toRadians(lo2 - lo1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(la1)) *
      Math.cos(toRadians(la2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const formatDistance = (meters: number | null): string => {
  if (meters === null || Number.isNaN(meters)) return '--';
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(2)}km`;
};

type NearestChamberParsed = {
  leftLabel: string | null;
  rightLabel: string | null;
  leftId: number | string | null;
  rightId: number | string | null;
  routeId: number | string | null;
  routeIdStr: string | null;
  leftLat: number | string | null;
  leftLng: number | string | null;
  rightLat: number | string | null;
  rightLng: number | string | null;
  leftChamberIdDisplay: string | null;
  leftChamberName: string | null;
  leftAddressFull: string | null;
  leftLandmarkFull: string | null;
  rightChamberIdDisplay: string | null;
  rightChamberName: string | null;
  rightAddressFull: string | null;
  rightLandmarkFull: string | null;
};

// `list`, `firstItem` and `secondItem` are declared once, up top, so both
// the single-object branch and the array branch can use them.
const getNearestChamberAddresses = (result: any): NearestChamberParsed => {
  const data: any =
    result?.nearestChambers ??
    result?.nearestChamber ??
    result?.chambers ??
    result?.data ??
    result;

  const list: NearestChamberItem[] = Array.isArray(data) ? data : [];
  const firstItem = list[0];
  const secondItem = list[1];
  if (!Array.isArray(data) && data) {
    const leftLabel =
      buildChamberDisplay('left', data) ??
      data.chamber1Address ??
      getChamberLabel(data);
    const rightLabel =
      buildChamberDisplay('right', data) ?? data.chamber2Address ?? null;
    const leftId = data.chamber1Id ?? getChamberIdValue(data);
    const rightId = data.chamber2Id ?? null;
    const routeIdStr =
      getRouteIdValue(firstItem) ??
      getRouteIdValue(secondItem) ??
      getRouteIdValue(data);
    const routeId =
      getRouteIdNumericValue(firstItem) ??
      getRouteIdNumericValue(secondItem) ??
      getRouteIdNumericValue(data);
    const leftLat = data.chamber1Lat ?? null;
    const leftLng = data.chamber1Lng ?? null;
    const rightLat = data.chamber2Lat ?? null;
    const rightLng = data.chamber2Lng ?? null;
    const leftChamberIdDisplay = getChamberIdDisplay('left', data);
    const leftChamberName = getChamberNameDisplay('left', data);
    const leftAddressFull = data.chamber1Address ?? null;
    const leftLandmarkFull = data.chamber1Landmark ?? null;
    const rightChamberIdDisplay = getChamberIdDisplay('right', data);
    const rightChamberName = getChamberNameDisplay('right', data);
    const rightAddressFull = data.chamber2Address ?? null;
    const rightLandmarkFull = data.chamber2Landmark ?? null;
    return {
      leftLabel,
      rightLabel,
      leftId,
      rightId,
      routeId,
      routeIdStr,
      leftLat,
      leftLng,
      rightLat,
      rightLng,
      leftChamberIdDisplay,
      leftChamberName,
      leftAddressFull,
      leftLandmarkFull,
      rightChamberIdDisplay,
      rightChamberName,
      rightAddressFull,
      rightLandmarkFull,
    };
  }

  const leftLabel =
    buildChamberDisplay('left', firstItem) ??
    firstItem?.chamber1Address ??
    getChamberLabel(firstItem);

  const rightLabel =
    buildChamberDisplay('right', firstItem) ??
    buildChamberDisplay('right', secondItem) ??
    firstItem?.chamber2Address ??
    secondItem?.chamber2Address ??
    getChamberLabel(secondItem);

  const leftId = firstItem?.chamber1Id ?? getChamberIdValue(firstItem);

  const rightId = firstItem?.chamber2Id ?? getChamberIdValue(secondItem);

  const routeIdStr = getRouteIdValue(firstItem) ?? getRouteIdValue(secondItem);
  const routeId =
    getRouteIdNumericValue(firstItem) ?? getRouteIdNumericValue(secondItem);

  const leftLat = firstItem?.chamber1Lat ?? null;
  const leftLng = firstItem?.chamber1Lng ?? null;
  const rightLat = firstItem?.chamber2Lat ?? secondItem?.chamber2Lat ?? null;
  const rightLng = firstItem?.chamber2Lng ?? secondItem?.chamber2Lng ?? null;

  const leftChamberIdDisplay = getChamberIdDisplay('left', firstItem);
  const leftChamberName = getChamberNameDisplay('left', firstItem);
  const leftAddressFull = firstItem?.chamber1Address ?? null;
  const leftLandmarkFull = firstItem?.chamber1Landmark ?? null;

  const rightChamberIdDisplay =
    getChamberIdDisplay('right', firstItem) ??
    getChamberIdDisplay('right', secondItem);
  const rightChamberName =
    getChamberNameDisplay('right', firstItem) ??
    getChamberNameDisplay('right', secondItem);
  const rightAddressFull =
    firstItem?.chamber2Address ?? secondItem?.chamber2Address ?? null;
  const rightLandmarkFull =
    firstItem?.chamber2Landmark ?? secondItem?.chamber2Landmark ?? null;

  return {
    leftLabel,
    rightLabel,
    leftId,
    rightId,
    routeId,
    routeIdStr,
    leftLat,
    leftLng,
    rightLat,
    rightLng,
    leftChamberIdDisplay,
    leftChamberName,
    leftAddressFull,
    leftLandmarkFull,
    rightChamberIdDisplay,
    rightChamberName,
    rightAddressFull,
    rightLandmarkFull,
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
const VENDOR_SEARCH_DEBOUNCE_MS = 350;
const VENDOR_SEARCH_MIN_CHARS = 2;

const LOCATING_PIN_SIZE = 32;

const EVENT_VIDEO_READY = 'VIDEO_READY_EVENT';

const normalizeActivityName = (value?: string | null): string =>
  (value ?? '').trim().toLowerCase();

// ── Locating flow — chamber info card ──────────────────────────────────────
type ChamberInfoCardProps = {
  title: string;
  chamberId?: string | null;
  chamberName?: string | null;
  gig?: string | null;
  address?: string | null;
  landmark?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
};
const ChamberInfoCard: FC<ChamberInfoCardProps> = ({
  title,
  chamberId,
  chamberName,
  gig,
  address,
  landmark,
  lat,
  lng,
}) => (
  <View style={styles.chamberCard}>
    <Text style={styles.chamberCardTitle}>{title}</Text>
    <View style={styles.chamberCardHeaderRow}>
      <Text style={styles.chamberCardHeaderText}>
        Chamber ID:{' '}
        <Text style={styles.chamberCardHeaderValue}>{chamberId || '--'}</Text>
      </Text>
      <Text style={styles.chamberCardHeaderText}>
        Chamber Name:{' '}
        <Text style={styles.chamberCardHeaderValue}>{chamberName || '--'}</Text>
      </Text>
    </View>
    <Text style={styles.chamberCardRowText}>
      GIG: <Text style={styles.chamberCardRowValue}>{gig || '--'}</Text>
    </Text>
    <Text style={styles.chamberCardRowText}>
      Address: <Text style={styles.chamberCardRowValue}>{address || '--'}</Text>
    </Text>
    <View style={styles.chamberCardHeaderRow}>
      <Text style={styles.chamberCardRowText}>
        Landmark:{' '}
        <Text style={styles.chamberCardRowValue}>{landmark || '--'}</Text>
      </Text>
    </View>
    <Text style={styles.chamberCardRowText}>
      Lat/Long:{' '}
      <Text style={styles.chamberCardRowValue}>
        {lat && lng ? `${lat}°${lng}°` : '--'}
      </Text>
    </Text>
  </View>
);

type DistanceConnectorProps = {distanceText: string};
const DistanceConnector: FC<DistanceConnectorProps> = ({distanceText}) => (
  <View style={styles.distanceConnector}>
    <Text style={styles.distanceConnectorText}>{distanceText}</Text>
  </View>
);

type VideoInfo = {
  uri: string | null;
  sizeBytes?: number;
  durationSec: number;
  fromAddress: string | null;
  fromLat: string | null;
  fromLng: string | null;
  toAddress: string | null;
  toLat: string | null;
  toLng: string | null;
};

const formatVideoDuration = (totalSeconds: number): string => {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
};

type VideoSummaryCardProps = {video: VideoInfo};
const VideoSummaryCard: FC<VideoSummaryCardProps> = ({video}) => (
  <View style={styles.videoSummaryCard}>
    <View style={styles.videoSummaryHeaderRow}>
      <View style={styles.videoSummaryPlayWrap}>
        <Text style={styles.videoSummaryPlayIcon}>▶</Text>
      </View>
      <Text style={styles.videoSummaryDuration}>
        {formatVideoDuration(video.durationSec)}
      </Text>
    </View>
    <Text style={styles.chamberCardRowText} numberOfLines={2}>
      From Address:{' '}
      <Text style={styles.chamberCardRowValue}>
        {video.fromAddress || '--'}
      </Text>
    </Text>
    <Text style={styles.chamberCardRowText} numberOfLines={1}>
      From Lat/Long:{' '}
      <Text style={styles.chamberCardRowValue}>
        {video.fromLat && video.fromLng
          ? `${video.fromLat}°/${video.fromLng}°`
          : '--'}
      </Text>
    </Text>
    <Text style={styles.chamberCardRowText} numberOfLines={2}>
      To Address:{' '}
      <Text style={styles.chamberCardRowValue}>{video.toAddress || '--'}</Text>
    </Text>
    <Text style={styles.chamberCardRowText} numberOfLines={1}>
      To Lat/Long:{' '}
      <Text style={styles.chamberCardRowValue}>
        {video.toLat && video.toLng ? `${video.toLat}°/${video.toLng}°` : '--'}
      </Text>
    </Text>
  </View>
);

type CurrentLocationCardProps = {
  address: string;
  lat: string | null;
  lng: string | null;
  isRecording: boolean;
  onPressStartRec: () => void;
};
const CurrentLocationCard: FC<CurrentLocationCardProps> = ({
  address,
  lat,
  lng,
  isRecording,
  onPressStartRec,
}) => (
  <View style={styles.currentLocationCard}>
    <View style={styles.currentLocationTextWrap}>
      <Text style={styles.currentLocationAddressText}>
        Address:{' '}
        <Text style={styles.chamberCardRowValue}>{address || '--'}</Text>
      </Text>
      <Text style={styles.currentLocationLatLngText}>
        Lat/Long:{' '}
        <Text style={styles.chamberCardRowValue}>
          {lat && lng ? `${lat}°${lng}°` : '--'}
        </Text>
      </Text>
    </View>
    <TouchableOpacity
      style={[
        styles.startRecButton,
        isRecording && styles.startRecButtonActive,
      ]}
      onPress={onPressStartRec}>
      <Text style={styles.startRecButtonIcon}>⏺</Text>
      <Text style={styles.startRecButtonText}>
        {isRecording ? 'Stop Rec' : 'Start Rec'}
      </Text>
    </TouchableOpacity>
  </View>
);
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

// ── Locked image slot — shown in place of <CaptureImageWatermark/> until
// GPS (lat/long) + address have been fetched/entered. Tapping it just
// informs the user instead of opening the camera.
type LockedImageSlotProps = {label: string; compact?: boolean};
const LockedImageSlot: FC<LockedImageSlotProps> = ({
  label,
  compact = false,
}) => (
  <TouchableOpacity
    style={[styles.lockedImageSlot, compact && styles.compactLockedPhoto]}
    activeOpacity={0.7}
    onPress={() =>
      Alert.alert(
        'GPS Required',
        'Please tap "Get GPS" first and make sure the address is filled to capture photos.',
      )
    }>
    <Image
      style={styles.lockedCameraIcon}
      resizeMode="contain"
      source={IMAGES.camera}
    />
    <Text style={styles.lockedSlotText}>{label}</Text>
    {!compact && <Text style={styles.lockedSlotSubText}>Get GPS first</Text>}
  </TouchableOpacity>
);
// Used ONLY for reverse-geocoding. The captured lat/long is never changed.
const NEARBY_ADDRESS_RADII_METERS = [20, 50, 100, 200];
const NEARBY_ADDRESS_BEARINGS_DEG = [0, 90, 180, 270, 45, 135, 225, 315];
const offsetLatLng = (
  lat: number,
  lng: number,
  distanceMeters: number,
  bearingDeg: number,
): {lat: number; lng: number} => {
  const R = 6371000;
  const bearing = toRadians(bearingDeg);
  const d = distanceMeters / R;
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
const ActivityCheckboxes: FC<{
  options: MasterItem[];
  value: MasterItem | null;
  hasError?: boolean;
  label: string;
  onSelect: (item: MasterItem) => void;
}> = ({options, value, hasError, label, onSelect}) => (
  <View style={styles.workByOptions}>
    {Array.from({length: Math.ceil(options.length / 2)}, (_, rowIndex) => (
      <View key={rowIndex} style={styles.workByRow}>
        {options.slice(rowIndex * 2, rowIndex * 2 + 2).map(item => {
          const checked = String(value?.id) === String(item.id);
          return (
            <TouchableOpacity
              key={String(item.id)}
              style={[
                styles.workByOption,
                checked && styles.workByOptionSelected,
              ]}
              accessibilityRole="checkbox"
              accessibilityLabel={item.displayName}
              accessibilityState={{checked}}
              onPress={() => onSelect(item)}>
              <View
                style={[
                  styles.workByCheckbox,
                  hasError && styles.workByCheckboxError,
                  checked && styles.workByCheckboxSelected,
                ]}>
                {checked && <Text style={styles.workByCheckmark}>✓</Text>}
              </View>
              <Text style={[styles.compactText, styles.workByOptionLabel]}>
                {item.displayName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    ))}
    {hasError && <Text style={styles.errorText}>Please select {label}</Text>}
  </View>
);

const AddCutScreen: FC<ScreenProps.AddCutScreen> = ({navigation, route}) => {
  const dispatch = useDispatch();
  const routeParams = (route?.params ?? {}) as {
    cutAlertLocatingType?: string;
    cutAlertLocatingTypeId?: string | number | null;
    activityVendorId?: string | number | null;
    id?: string | number;
    routeId?: string | number;
    nearestRightChamber?: string;
    nearestLeftChamber?: string;
  };
  const [masterData, setMasterData] = useState<DropdownMaster | null>(null);
  const [isMasterLoading, setIsMasterLoading] = useState(false);
  const cutAlertLocatingType = routeParams.cutAlertLocatingType;
  const [selectedActivityType, setSelectedActivityType] =
    useState<MasterItem | null>(null);
  const [selectedType, setSelectedType] = useState<MasterItem | null>(null);
  const [selectedWorkBy, setSelectedWorkBy] = useState<MasterItem | null>(null);
  const [selectedOrganizationType, setSelectedOrganizationType] =
    useState<MasterItem | null>(null);
  const [selectedCompanyType, setSelectedCompanyType] =
    useState<MasterItem | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<MasterItem | null>(
    null,
  );
  const [isAddressApproximate, setIsAddressApproximate] = useState(false);
  const hasAutoSelectedActivityTypeRef = useRef(false);
  const hasAutoSelectedTypeRef = useRef(false);
  const hasRequestedInitialGpsRef = useRef(false);
  const [vendorName, setVendorName] = useState('');
  const [vendorMobile, setVendorMobile] = useState('');
  const [workOnRoute, setWorkOnRoute] = useState('');
  const [landmark, setLandmark] = useState('');
  const [address, setAddress] = useState('');
  const [remark, setRemark] = useState('');
  const [selectedActivityVendorId, setSelectedActivityVendorId] = useState<
    number | string | null
  >(routeParams.activityVendorId ?? null);
  const [vendorSuggestions, setVendorSuggestions] = useState<
    VendorSuggestion[]
  >([]);
  const [isVendorDropdownVisible, setIsVendorDropdownVisible] = useState(false);
  const [isFetchingVendors, setIsFetchingVendors] = useState(false);
  const vendorSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const vendorSearchSeqRef = useRef(0);
  useEffect(() => {
    return () => {
      if (vendorSearchTimeoutRef.current) {
        clearTimeout(vendorSearchTimeoutRef.current);
      }
    };
  }, []);
  const fetchVendorSuggestions = async (search: string) => {
    const seq = ++vendorSearchSeqRef.current;
    try {
      setIsFetchingVendors(true);
      // @ts-ignore - unwrap() typing depends on your store setup
      const result = await dispatch(
        getMaintenanceActivityVendorDDAPI(search),
      ).unwrap();
      if (seq !== vendorSearchSeqRef.current) return;
      const list: VendorSuggestion[] = Array.isArray(result) ? result : [];
      setVendorSuggestions(list);
      setIsVendorDropdownVisible(list.length > 0);
    } catch (e: any) {
      if (seq === vendorSearchSeqRef.current) {
        setVendorSuggestions([]);
        setIsVendorDropdownVisible(false);
      }
    } finally {
      if (seq === vendorSearchSeqRef.current) {
        setIsFetchingVendors(false);
      }
    }
  };
  const handleVendorNameChange = (text: string) => {
    // Allow only alphabets and spaces.
    // Numbers and all special characters are removed automatically.
    const sanitizedText = text.replace(/[^A-Za-z\s]/g, '');
    setVendorName(sanitizedText);
    clearError('vendorName');
    if (selectedActivityVendorId !== null) {
      setSelectedActivityVendorId(null);
    }
    if (vendorSearchTimeoutRef.current) {
      clearTimeout(vendorSearchTimeoutRef.current);
    }
    const trimmed = sanitizedText.trim();
    if (trimmed.length < VENDOR_SEARCH_MIN_CHARS) {
      vendorSearchSeqRef.current += 1;
      setVendorSuggestions([]);
      setIsVendorDropdownVisible(false);
      setIsFetchingVendors(false);
      return;
    }
    vendorSearchTimeoutRef.current = setTimeout(() => {
      fetchVendorSuggestions(trimmed);
    }, VENDOR_SEARCH_DEBOUNCE_MS);
  };
  const handleVendorInputFocus = () => {
    if (
      vendorSuggestions.length > 0 &&
      vendorName.trim().length >= VENDOR_SEARCH_MIN_CHARS
    ) {
      setIsVendorDropdownVisible(true);
    }
  };
  const handleVendorInputBlur = () => {
    setTimeout(() => setIsVendorDropdownVisible(false), 150);
  };
  const handleSelectVendorSuggestion = (item: VendorSuggestion) => {
    if (vendorSearchTimeoutRef.current) {
      clearTimeout(vendorSearchTimeoutRef.current);
    }
    vendorSearchSeqRef.current += 1;
    setVendorName((item.vendorName ?? '').trim());
    setVendorMobile((item.vendorMobileNo ?? '').replace(/[^0-9]/g, ''));
    setSelectedActivityVendorId(item.id ?? null);
    setVendorSuggestions([]);
    setIsVendorDropdownVisible(false);
    setIsFetchingVendors(false);
    clearError('vendorName');
    clearError('vendorMobile');
  };
  // `routeId` is the numeric id (e.g. 401) — this is what goes to the API.
  // `routeIdStr` is the display label (e.g. "GIG28") — this is what shows
  // in the UI (GIG ID text, chamber cards, etc). Keep them separate;
  // never send routeIdStr in the submit payload.
  const [routeId, setRouteId] = useState<number | string | null>(
    routeParams.routeId ?? null,
  );
  const [routeIdStr, setRouteIdStr] = useState<string | null>(
    getRouteIdValue(routeParams),
  );
  const [nearestRightChamber, setNearestRightChamber] = useState<string | null>(
    routeParams.nearestRightChamber ?? null,
  );
  const [nearestLeftChamber, setNearestLeftChamber] = useState<string | null>(
    routeParams.nearestLeftChamber ?? null,
  );
  const [nearestLeftChamberId, setNearestLeftChamberId] = useState<
    number | string | null
  >(null);

  const [nearestRightChamberId, setNearestRightChamberId] = useState<
    number | string | null
  >(null);
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

  const [leftChamberIdDisplay, setLeftChamberIdDisplay] = useState<
    string | null
  >(null);
  const [leftChamberNameDisplay, setLeftChamberNameDisplay] = useState<
    string | null
  >(null);
  const [leftChamberAddress, setLeftChamberAddress] = useState<string | null>(
    null,
  );
  const [leftChamberLandmark, setLeftChamberLandmark] = useState<string | null>(
    null,
  );
  const [rightChamberIdDisplay, setRightChamberIdDisplay] = useState<
    string | null
  >(null);
  const [rightChamberNameDisplay, setRightChamberNameDisplay] = useState<
    string | null
  >(null);
  const [rightChamberAddress, setRightChamberAddress] = useState<string | null>(
    null,
  );
  const [rightChamberLandmark, setRightChamberLandmark] = useState<
    string | null
  >(null);
  const [isRecordingLocating, setIsRecordingLocating] = useState(false);
  const [videoInfos, setVideoInfos] = useState<VideoInfo[]>([]);
  const [gpsLat, setGpsLat] = useState<string | null>(null);
  const [gpsLong, setGpsLong] = useState<string | null>(null);
  const [isFetchingGps, setIsFetchingGps] = useState(false);
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [gpsCaptureError, setGpsCaptureError] = useState<string | null>(null);
  const [isFetchingNearestChamber, setIsFetchingNearestChamber] =
    useState(false);
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);

  // ── Nearest-route fallback state — populated when
  // getNearestChamberByLatlngAPI finds no chamber within range. We then
  // call getNearestRouteByLatlngAPI and show its result in a popup.
  const [isFallbackRouteModalVisible, setIsFallbackRouteModalVisible] =
    useState(false);
  const [isFetchingFallbackRoute, setIsFetchingFallbackRoute] = useState(false);
  const [fallbackRouteInfo, setFallbackRouteInfo] =
    useState<NearestRouteFallbackItem | null>(null);

  const [currentLocRowLayout, setCurrentLocRowLayout] = useState<{
    y: number;
    height: number;
  }>({y: 0, height: 0});
  const handleCurrentLocRowLayout = (e: LayoutChangeEvent) => {
    const {y, height} = e.nativeEvent.layout;
    setCurrentLocRowLayout({y, height});
  };
  const timelinePinTop = currentLocRowLayout.height
    ? currentLocRowLayout.y +
      currentLocRowLayout.height / 2 -
      LOCATING_PIN_SIZE / 2
    : 0;

  // ── Cut / Alert pictures — 4 slots, each captured + watermarked via
  // <CaptureImageWatermark/>. Slots render a <LockedImageSlot/> until
  // `hasGps` is true (lat/long + address), so the camera can never be
  // opened before the location and address are available.
  const [pic1, setPic1] = useState<ImageSlot>(null);
  const [pic2, setPic2] = useState<ImageSlot>(null);
  const [pic3, setPic3] = useState<ImageSlot>(null);
  const [pic4, setPic4] = useState<ImageSlot>(null);

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // `hasLatLng`: coordinates captured (chamber section depends on this).
  // `hasGps`: coordinates AND address present (photo capture depends on this).
  const hasLatLng = !!(gpsLat && gpsLong);
  const hasGps = hasLatLng && !!address.trim();
  const clearError = (key: string) => {
    if (errors[key]) setErrors(prev => ({...prev, [key]: false}));
  };

  const distanceToLeftChamber = useMemo(
    () =>
      getDistanceInMeters(
        gpsLat,
        gpsLong,
        nearestLeftChamberLat,
        nearestLeftChamberLng,
      ),
    [gpsLat, gpsLong, nearestLeftChamberLat, nearestLeftChamberLng],
  );

  const distanceToRightChamber = useMemo(
    () =>
      getDistanceInMeters(
        gpsLat,
        gpsLong,
        nearestRightChamberLat,
        nearestRightChamberLng,
      ),
    [gpsLat, gpsLong, nearestRightChamberLat, nearestRightChamberLng],
  );
  const distanceBetweenChambers = useMemo(
    () =>
      getDistanceInMeters(
        nearestLeftChamberLat,
        nearestLeftChamberLng,
        nearestRightChamberLat,
        nearestRightChamberLng,
      ),
    [
      nearestLeftChamberLat,
      nearestLeftChamberLng,
      nearestRightChamberLat,
      nearestRightChamberLng,
    ],
  );
  useEffect(() => {
    const fetchMaster = async () => {
      try {
        setIsMasterLoading(true);
        // @ts-ignore - unwrap() typing depends on your store setup
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
    if (hasAutoSelectedActivityTypeRef.current) return;
    if (!masterData) return;

    const target = normalizeActivityName(cutAlertLocatingType ?? 'Alert');
    const match = masterData.activityType.find(
      item => normalizeActivityName(item.displayName) === target,
    );

    if (match) {
      setSelectedActivityType(match);
      clearError('activityType');
    }
    hasAutoSelectedActivityTypeRef.current = true;
  }, [masterData, cutAlertLocatingType]);
  useEffect(() => {
    if (!isFallbackRouteModalVisible) return;

    const timer = setTimeout(() => {
      setIsFallbackRouteModalVisible(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [isFallbackRouteModalVisible]);
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      EVENT_VIDEO_READY,
      (payload: any) => {
        if (!payload) return;

        const newVideo: VideoInfo = {
          uri: payload.uri ?? null,
          sizeBytes: payload.sizeBytes,
          durationSec: Number(payload.durationSec ?? 0),
          fromAddress: payload.fromAddress ?? null,
          fromLat: payload.fromLat ?? null,
          fromLng: payload.fromLng ?? null,
          toAddress: payload.toAddress ?? null,
          toLat: payload.toLat ?? null,
          toLng: payload.toLng ?? null,
        };

        setVideoInfos(prev => [...prev, newVideo]);

        setIsRecordingLocating(false);
      },
    );

    return () => subscription.remove();
  }, []);
  const activityTypeOptions = masterData?.activityType ?? [];

  const typeSourceList: MasterItem[] = useMemo(() => {
    if (!masterData || !selectedActivityType) return [];
    switch (selectedActivityType.displayName) {
      case 'Cut':
        return masterData.cutType;
      case 'Alert':
        return masterData.alertType;
      case 'Locating':
        return masterData.locatingType;
      default:
        return [];
    }
  }, [masterData, selectedActivityType]);

  const typeOptions = useMemo(
    () =>
      typeSourceList.filter(
        item => item.parentValueId === selectedActivityType?.id,
      ),
    [typeSourceList, selectedActivityType],
  );

  useEffect(() => {
    if (hasAutoSelectedTypeRef.current || !typeOptions.length) return;
    hasAutoSelectedTypeRef.current = true;
    setSelectedType(
      typeOptions.find(item => {
        const name = item.displayName.trim().toLowerCase();
        return name === 'ug' || name === 'underground';
      }) ?? typeOptions[0],
    );
  }, [typeOptions]);

  const workByOptions = useMemo(
    () =>
      masterData?.workBy.filter(
        item =>
          item.parentValueId === selectedType?.id &&
          ['jcb', 'hdd', 'manual', 'manal', 'pilling', 'piling'].includes(
            normalizeActivityName(item.displayName),
          ),
      ) ?? [],
    [masterData, selectedType],
  );

  const organizationTypeOptions = masterData?.workingFor ?? [];

  const companyTypeOptions = useMemo(
    () =>
      masterData?.companyType.filter(
        item => item.parentValueId === selectedOrganizationType?.id,
      ) ?? [],
    [masterData, selectedOrganizationType],
  );

  const priorityOptions = masterData?.priority ?? [];

  const activityLabelPrefix = selectedActivityType?.displayName ?? 'Alert';
  const isAlertActivity = selectedActivityType?.displayName === 'Alert';
  const isCutActivity = selectedActivityType?.displayName === 'Cut';
  const isLocatingActivity = selectedActivityType?.displayName === 'Locating';
  const isCutOrAlertActivity = isCutActivity || isAlertActivity;

  // Cut and alert use a compact form; resolve hidden defaults from API masters.
  const defaultPriority = masterData?.priority.find(
    item => normalizeActivityName(item.displayName) === 'high',
  );
  const defaultCompanyType = masterData?.companyType.find(
    item =>
      normalizeActivityName(item.displayName).replace(/\s+/g, '') ===
      'jalboard',
  );

  // ── Fallback: called only when the primary nearest-chamber lookup
  // returns nothing within range. Fetches the nearest route regardless of
  // range and shows it in a popup so the user knows how far off they are.
  const fetchNearestRouteFallback = async (lat: number, lng: number) => {
    try {
      setIsFetchingFallbackRoute(true);
      setFallbackRouteInfo(null);
      setIsFallbackRouteModalVisible(true);
      // @ts-ignore - unwrap() typing depends on your store setup
      const result = await dispatch(
        getNearestRouteByLatlngAPI({
          lat,
          lng,
          routeType: selectedType?.displayName ?? '',
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
  };

  const handleCloseFallbackRouteModal = () => {
    setIsFallbackRouteModalVisible(false);
  };

  const fetchNearestChamber = async (
    lat: number,
    lng: number,
    currentAddress: string = '',
  ) => {
    try {
      setIsFetchingNearestChamber(true);
      // @ts-ignore - unwrap() typing depends on your store setup
      const result = await dispatch(
        getNearestChamberByLatlngAPIByVendor({
          lat,
          lng,
          rangeInMeters: DEFAULT_NEAREST_CHAMBER_RANGE_METERS,
          // routeType: selectedType?.displayName,
        }),
      ).unwrap();
      const {
        leftLabel,
        rightLabel,
        leftId,
        rightId,
        routeId: parsedRouteId,
        routeIdStr: parsedRouteIdStr,
        leftLat,
        leftLng,
        rightLat,
        rightLng,
        leftChamberIdDisplay: leftIdDisp,
        leftChamberName: leftNameDisp,
        leftAddressFull,
        leftLandmarkFull,
        rightChamberIdDisplay: rightIdDisp,
        rightChamberName: rightNameDisp,
        rightAddressFull,
        rightLandmarkFull,
      } = getNearestChamberAddresses(result);
      setNearestLeftChamber(leftLabel);
      setNearestRightChamber(rightLabel);
      setNearestLeftChamberId(leftId);
      setNearestRightChamberId(rightId);
      setNearestLeftChamberLat(leftLat);
      setNearestLeftChamberLng(leftLng);
      setNearestRightChamberLat(rightLat);
      setNearestRightChamberLng(rightLng);
      // Numeric id (401) -> API payload's RouteId. String label ("GIG28")
      // -> UI display only. Both fall back to the top-level result shape
      // (result.data[0].routeId / routeIdStr) in case the API wraps it
      // differently than the chambers list we already parsed.
      const resolvedRouteId =
        result?.data?.[0]?.routeId ??
        result?.routeId ??
        parsedRouteId ??
        routeParams.routeId ??
        null;
      const resolvedRouteIdStr =
        result?.data?.[0]?.routeIdStr ??
        result?.routeIdStr ??
        parsedRouteIdStr ??
        getRouteIdValue(routeParams);

      setRouteId(resolvedRouteId);
      setRouteIdStr(resolvedRouteIdStr);
      setLeftChamberIdDisplay(leftIdDisp);
      setLeftChamberNameDisplay(leftNameDisp);
      setLeftChamberAddress(leftAddressFull);
      setLeftChamberLandmark(leftLandmarkFull);
      setRightChamberIdDisplay(rightIdDisp);
      setRightChamberNameDisplay(rightNameDisp);
      setRightChamberAddress(rightAddressFull);
      setRightChamberLandmark(rightLandmarkFull);

      // Last-resort address: only if the geocoder (exact + nearby) found
      // nothing. Lat/Long is NOT touched.
      const chamberFallbackAddress = leftAddressFull || rightAddressFull || '';
      if (!currentAddress.trim() && chamberFallbackAddress) {
        setAddress(chamberFallbackAddress);
        setIsAddressApproximate(true);
        clearError('address');
      }
      if (!leftLabel && !rightLabel) {
        // No chamber found within range — fall back to the nearest-route
        // lookup (no range limit) and show its distance/route info in a
        // popup instead of just a toast.
        Common.showToast('No nearby chamber found within range');
        await fetchNearestRouteFallback(lat, lng);
      }
    } catch (e: any) {
      setNearestLeftChamber(null);
      setNearestRightChamber(null);
      setNearestLeftChamberId(null);
      setNearestRightChamberId(null);
      setNearestLeftChamberLat(null);
      setNearestLeftChamberLng(null);
      setNearestRightChamberLat(null);
      setNearestRightChamberLng(null);
      setRouteId(routeParams.routeId ?? null);
      setRouteIdStr(getRouteIdValue(routeParams));
      setLeftChamberIdDisplay(null);
      setLeftChamberNameDisplay(null);
      setLeftChamberAddress(null);
      setLeftChamberLandmark(null);
      setRightChamberIdDisplay(null);
      setRightChamberNameDisplay(null);
      setRightChamberAddress(null);
      setRightChamberLandmark(null);
      Common.showToast(e?.message || 'Unable to fetch nearest chamber');
      await fetchNearestRouteFallback(lat, lng);
    } finally {
      setIsFetchingNearestChamber(false);
    }
  };

  const resetChamberState = () => {
    setNearestLeftChamber(null);
    setNearestRightChamber(null);
    setNearestLeftChamberId(null);
    setNearestRightChamberId(null);
    setNearestLeftChamberLat(null);
    setNearestLeftChamberLng(null);
    setNearestRightChamberLat(null);
    setNearestRightChamberLng(null);
    setLeftChamberIdDisplay(null);
    setLeftChamberNameDisplay(null);
    setLeftChamberAddress(null);
    setLeftChamberLandmark(null);
    setRightChamberIdDisplay(null);
    setRightChamberNameDisplay(null);
    setRightChamberAddress(null);
    setRightChamberLandmark(null);
  };

  // Photos carry the old lat/long/address watermark, so a new fix
  // invalidates them.
  const resetCapturedPhotos = () => {
    setPic1(null);
    setPic2(null);
    setPic3(null);
    setPic4(null);
  };

  // Shared by "Get GPS" and "Where I am?". Captures the exact lat/long,
  // pre-fills the address by reverse geocoding (empty if it fails so the
  // user types it), and returns the coordinates, or null on failure.
  // Shared by "Get GPS" and "Where I am?". Captures the exact lat/long,
  // resolves the address (exact point first, then nearby fallback), and
  // returns coordinates + address, or null on failure.
  const captureFreshLocation = async (): Promise<{
    latitude: number;
    longitude: number;
    resolvedAddress: string;
  } | null> => {
    let location;
    setIsCapturingGps(true);
    setGpsCaptureError(null);
    try {
      location = await fetchCurrentGpsLocation({
        targetAccuracy: 15,
        minimumSamples: 4,
        timeout: 45000,
      });
    } catch (error: any) {
      const message =
        error?.message || 'Unable to get GPS signal. Please retry.';
      setGpsCaptureError(message);
      Common.showToast(message);
      return null;
    } finally {
      setIsCapturingGps(false);
    }

    const {latitude, longitude, accuracy} = location;
    console.log('Final AddCut GPS:', {latitude, longitude, accuracy});

    // Exact lat/long as captured — never altered by address.
    setGpsLat(String(latitude));
    setGpsLong(String(longitude));
    resetCapturedPhotos();

    // Address only — tries the exact point first, then nearby points.
    // Lat/long above stays exactly as captured.
    const {address: resolvedAddress, isApproximate} =
      await getAddressWithNearbyFallback(latitude, longitude);

    // Location changed, so any previous address is stale.
    setAddress(resolvedAddress);
    setIsAddressApproximate(isApproximate);
    if (resolvedAddress) {
      clearError('address');
    }

    // Address lookup failure is silent — the Address field is shown below
    // and the user simply types it in. No error toast for address.
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
    if (isFetchingGps || isRefreshingLocation) return;
    if (!selectedActivityType) {
      Alert.alert('Required', 'Please select Activity Type first.');
      return;
    }
    if (!selectedType) {
      Alert.alert(
        'Required',
        `Please select ${selectedActivityType.displayName} Type first.`,
      );
      return;
    }
    try {
      setIsFetchingGps(true);
      // Clear everything so no stale value can show or be submitted.
      setGpsLat(null);
      setGpsLong(null);
      setAddress('');
      setIsAddressApproximate(false); // ← add
      resetChamberState();
      resetCapturedPhotos();
      const fix = await captureFreshLocation();
      if (!fix) return;

      await fetchNearestChamber(
        fix.latitude,
        fix.longitude,
        fix.resolvedAddress,
      );
    } catch (e: any) {
      Common.showToast(e?.message || 'Unable to fetch GPS location');
    } finally {
      setIsFetchingGps(false);
    }
  };

  // Wait for the default dropdown values so the chamber API has a route type.
  // Keep the latest handler without retriggering GPS on every form update.
  const initialGpsHandlerRef = useRef(handleGetGps);
  initialGpsHandlerRef.current = handleGetGps;
  useEffect(() => {
    if (
      hasRequestedInitialGpsRef.current ||
      !selectedActivityType ||
      !selectedType
    ) {
      return;
    }
    hasRequestedInitialGpsRef.current = true;
    initialGpsHandlerRef.current();
  }, [selectedActivityType, selectedType]);

  const handleWhereIAmPress = async () => {
    if (isRefreshingLocation || isFetchingGps) return;
    try {
      setIsRefreshingLocation(true);

      const fix = await captureFreshLocation();
      if (!fix) return;

      // distanceTo* are useMemo'd off gpsLat/gpsLong + chamber lat/lng,
      // so they recompute once fetchNearestChamber resolves.
      await fetchNearestChamber(
        fix.latitude,
        fix.longitude,
        fix.resolvedAddress,
      );
    } catch (e: any) {
      Common.showToast(e?.message || 'Unable to fetch current location');
    } finally {
      setIsRefreshingLocation(false);
    }
  };

  const handleStartRecording = () => {
    const projectIdParam =
      routeId ??
      (routeParams.id !== undefined && routeParams.id !== null
        ? String(routeParams.id)
        : undefined);
    setIsRecordingLocating(true);
    navigation.navigate('ActivityVideoRecorder', {projectId: projectIdParam});
  };
  const handleViewOnGoogleMap = async () => {
    if (!gpsLat || !gpsLong) {
      Common.showToast('Please fetch GPS location first');
      return;
    }

    const points: string[] = [`${gpsLat},${gpsLong}`];

    if (
      nearestLeftChamberLat !== null &&
      nearestLeftChamberLat !== undefined &&
      nearestLeftChamberLng !== null &&
      nearestLeftChamberLng !== undefined
    ) {
      points.push(`${nearestLeftChamberLat},${nearestLeftChamberLng}`);
    }

    if (
      nearestRightChamberLat !== null &&
      nearestRightChamberLat !== undefined &&
      nearestRightChamberLng !== null &&
      nearestRightChamberLng !== undefined
    ) {
      points.push(`${nearestRightChamberLat},${nearestRightChamberLng}`);
    }

    if (points.length < 2) {
      Common.showToast('Nearest chamber location not available');
      return;
    }

    const url = `https://www.google.com/maps/dir/${points.join('/')}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Common.showToast('Unable to open Google Maps');
      }
    } catch (e: any) {
      Common.showToast(e?.message || 'Unable to open Google Maps');
    }
  };
  const validateForm = () => {
    const e: Record<string, boolean> = {};

    if (!selectedActivityType) e.activityType = true;
    if (!selectedType) e.type = true;
    if (!selectedWorkBy) e.workBy = true;
    if (isCutOrAlertActivity) {
      if (!selectedOrganizationType) {
        e.organizationType = true;
      }
      if (!defaultCompanyType) e.companyType = true;
      if (!defaultPriority) e.priority = true;
    }
    if (isLocatingActivity) {
      if (!selectedOrganizationType) e.organizationType = true;
      if (!selectedCompanyType) e.companyType = true;
      if (!workOnRoute.trim() || Number.isNaN(Number(workOnRoute.trim()))) {
        e.workOnRoute = true;
      }
      if (!vendorName.trim()) e.vendorName = true;
      if (!/^\d{10}$/.test(vendorMobile.trim())) e.vendorMobile = true;
    }

    if (!address.trim()) e.address = true;

    // Chamber 1 & 2 must be resolved and non-zero before submit is allowed.
    if (!nearestLeftChamberId || Number(nearestLeftChamberId) <= 0) {
      e.chamber1 = true;
    }
    if (!nearestRightChamberId || Number(nearestRightChamberId) <= 0) {
      e.chamber2 = true;
    }

    if (!isLocatingActivity) {
      // Images can only exist if hasGps was true when they were captured,
      // but guard again here explicitly — if GPS/address were somehow
      // cleared after capture, block submit instead of silently accepting
      // stale-GPS photos.
      if (!hasGps) {
        e.gps = true;
      }

      if (!pic1 || !pic2) {
        if (!pic1) e.image1 = true;
        if (!pic2) e.image2 = true;
        e.imagesMin = true;
      }
    } else if (!videoInfos.some(video => !!video.uri)) {
      e.video = true;
    }
    setErrors(e);
    if (Object.keys(e).length > 0) {
      if (e.chamber1 || e.chamber2) {
        Common.showToast(
          'Nearest chamber not found. Please tap "Get GPS" / "Where I am?" again.',
        );
      } else if (e.gps) {
        Common.showToast(
          'Please fetch GPS location and address before submitting.',
        );
      } else if (e.imagesMin) {
        Common.showToast('Please upload both images');
      } else if (e.organizationType) {
        Common.showToast('Please select Work For');
      } else if (isCutOrAlertActivity && (e.companyType || e.priority)) {
        Common.showToast(
          'Required defaults (High, Jalboard) are unavailable. Please reload the form.',
        );
      } else {
        Common.showToast('Please fill all required fields');
      }
      return false;
    }
    return true;
  };
  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateForm() || isSubmitting) return;
    try {
      setIsSubmitting(true);

      const latLng = gpsLat && gpsLong ? `${gpsLat},${gpsLong}` : '';

      const imageMediaFiles = (
        isLocatingActivity ? [pic1, pic2, pic3, pic4] : [pic1, pic2]
      ).filter((img): img is NonNullable<ImageSlot> => !!img);

      const videoMediaFiles = videoInfos
        .filter((video): video is VideoInfo & {uri: string} => !!video.uri)
        .map((video, index) => ({
          uri: video.uri,
          type: 'video/mp4',
          name: `locating_video_${index + 1}_${Date.now()}.mp4`,
        }));

      const mediaFiles = [...imageMediaFiles, ...videoMediaFiles];
      const payload: InsertMaintenanceActivityParams = {
        Id: routeParams.id ?? 0,
        Remark: remark.trim(),
        WorkById: selectedWorkBy?.id ?? 0,
        RouteId: routeId ?? '',
        ActivityTypeId: selectedActivityType?.id ?? 0,
        CutAlertLocatingTypeId: selectedType?.id ?? undefined,
        PriorityTypeId: isCutOrAlertActivity ? defaultPriority?.id : undefined,
        LatLng: latLng,
        VendorMobileNo: isCutOrAlertActivity ? 'N/A' : vendorMobile.trim(),
        MediaJson: '',
        DistanceToChamber1: distanceToLeftChamber ?? 0,
        DistanceToChamber2: distanceToRightChamber ?? 0,
        Chamber1Id: nearestLeftChamberId,
        Chamber2Id: nearestRightChamberId,
        DistanceBetweenChambers: distanceBetweenChambers ?? 0,
        CompanyTypeId: '',
        ActivityVendorId: isCutOrAlertActivity
          ? undefined
          : selectedActivityVendorId ?? undefined,
        VendorName: isCutOrAlertActivity ? 'N/A' : vendorName.trim(),
        MediaFiles: mediaFiles,
        WorkForId: selectedOrganizationType?.id ?? 0,
        Address: address.trim(),
        Landmark: isCutOrAlertActivity ? 'N/A' : landmark.trim(),
        WorkOnRoute: null,
      };
      // @ts-ignore - unwrap() typing depends on your store setup
      await dispatch(insertMaintenanceActivityAPI(payload)).unwrap();

      Common.showToast('Activity details submitted!');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };
  const gpsCaptureStatus = isCapturingGps ? (
    <View
      style={styles.gpsCaptureStatus}
      pointerEvents="none"
      accessibilityLiveRegion="polite">
      <ActivityIndicator size="small" color={COLORS.colorRoyalblue} />
      <Text style={styles.gpsCaptureStatusText}>Fetching GPS location...</Text>
    </View>
  ) : gpsCaptureError ? (
    <Text accessibilityLiveRegion="polite" style={styles.gpsLockHintText}>
      {gpsCaptureError}
    </Text>
  ) : null;

  if (!isLocatingActivity) {
    const formTitle = 'Add New Activity';
    return (
      <Screen preset="scroll" statusBgColor="#F3F6F9" statusBarStyle="dark">
        <View style={styles.compactBody}>
          <View style={styles.compactHeader}>
            <TouchableOpacity
              accessibilityLabel="Go back"
              onPress={() => navigation.goBack()}
              style={styles.compactBack}>
              <Image
                source={IMAGES.arrowBack}
                style={styles.arrowBack24dp434343Fill0WIcon}
              />
            </TouchableOpacity>
            <Text style={styles.compactTitle}>{formTitle}</Text>
          </View>
          <Text style={styles.formIntroduction}>
            Select the work details, then add two clear photos of the site.
          </Text>
          <View style={styles.compactCard}>
            {isMasterLoading && <ActivityIndicator color="#2D64F5" />}
            <Text style={styles.sectionHeading}>1. Work details</Text>
            <Text style={styles.sectionDescription}>
              Fields marked * are required.
            </Text>
            <View style={styles.compactColumns}>
              <View style={styles.compactField}>
                <Text style={[styles.compactText, styles.workOptionHeading]}>
                  Work By<Text style={styles.requiredIndicator}> *</Text>
                </Text>
                <ActivityCheckboxes
                  label="Work By"
                  options={workByOptions}
                  value={selectedWorkBy}
                  hasError={!!errors.workBy}
                  onSelect={item => {
                    setSelectedWorkBy(item);
                    clearError('workBy');
                  }}
                />
              </View>
            </View>
            <View style={styles.compactColumns}>
              <View style={styles.compactField}>
                <Text style={[styles.compactText, styles.workOptionHeading]}>
                  Work For<Text style={styles.requiredIndicator}> *</Text>
                </Text>
                <ActivityCheckboxes
                  label="Work For"
                  options={organizationTypeOptions}
                  value={selectedOrganizationType}
                  hasError={!!errors.organizationType}
                  onSelect={item => {
                    setSelectedOrganizationType(item);
                    clearError('organizationType');
                  }}
                />
              </View>
            </View>
            {/* Hidden from the cut/alert UI; background state is retained.
            <View style={styles.compactGpsRow}>
              <Text style={styles.compactText}>
                Lat/Long <Text style={styles.requiredIndicator}>*</Text>
              </Text>
              <Text
                style={[styles.compactText, styles.compactCoordinates]}
                numberOfLines={1}>
                {hasLatLng
                  ? `${Number(gpsLat).toFixed(6)}° ${Number(gpsLong).toFixed(
                      6,
                    )}°`
                  : '--'}
              </Text>
              <TouchableOpacity
                style={styles.compactGpsButton}
                onPress={handleGetGps}
                disabled={isFetchingGps || isRefreshingLocation}>
                <Text style={styles.compactGpsText}>
                  {isFetchingGps ? 'Fetching...' : 'Get GPS'}
                </Text>
              </TouchableOpacity>
            </View>
            <TextInput
              accessibilityLabel="Address"
              value={address}
              onChangeText={text => {
                setAddress(text);
                setIsAddressApproximate(false);
                clearError('address');
              }}
              placeholder="Address will appear after fetching GPS"
              placeholderTextColor="#8A9099"
              style={[
                styles.compactAddress,
                errors.address && styles.compactError,
              ]}
              multiline
            />
            <View style={styles.compactGigRow}>
              <Text style={styles.compactText}>GIG ID:</Text>
              <Text style={[styles.compactText, styles.compactCoordinates]}>
                #{routeIdStr ?? routeId ?? '--'}
              </Text>
            </View>
            */}
            {/* Hidden chamber display; background lookup and API IDs are retained.
            <View style={styles.compactChambers}>
              <View style={styles.compactTimeline}>
                <View style={styles.compactDash} />
                <Text style={styles.compactLeftDistance}>
                  {formatDistance(distanceToLeftChamber)}
                </Text>
                <Image
                  source={IMAGES.upArrow}
                  style={styles.compactUpperArrow}
                  resizeMode="contain"
                />
                <Image
                  source={IMAGES.locationCheck}
                  style={styles.compactLocationPin}
                  resizeMode="contain"
                />
                <Image
                  source={IMAGES.downArrow2}
                  style={styles.compactLowerArrow}
                  resizeMode="contain"
                />
                <Text style={styles.compactRightDistance}>
                  {formatDistance(distanceToRightChamber)}
                </Text>
              </View>
              <View style={styles.compactChamberContent}>
                <Text style={styles.compactChamberLabel}>
                  Nearest Left Chamber:
                </Text>
                <View
                  style={[
                    styles.compactChamberBox,
                    errors.chamber1 && styles.inputError,
                  ]}>
                  <Text style={styles.compactChamberValue} numberOfLines={1}>
                    {isFetchingNearestChamber
                      ? 'Fetching...'
                      : nearestLeftChamber || 'Enclosure ID'}
                  </Text>
                </View>
                <View style={styles.compactDistanceRow}>
                  <Image
                    source={IMAGES.dualsideArrow}
                    style={styles.compactDistanceArrow}
                    resizeMode="contain"
                  />
                  <Text style={styles.distanceTypo}>
                    {formatDistance(distanceBetweenChambers)}
                  </Text>
                </View>
                <Text style={styles.compactChamberLabel}>
                  Nearest Right Chamber:
                </Text>
                <View
                  style={[
                    styles.compactChamberBox,
                    errors.chamber2 && styles.inputError,
                  ]}>
                  <Text style={styles.compactChamberValue} numberOfLines={1}>
                    {isFetchingNearestChamber
                      ? 'Fetching...'
                      : nearestRightChamber || 'Enclosure ID'}
                  </Text>
                </View>
              </View>
            </View>
            */}
            {/* Hidden from the cut/alert UI; background state is retained.
            <View style={styles.compactMapActions}>
              <TouchableOpacity
                style={styles.compactWhereButton}
                onPress={handleWhereIAmPress}
                disabled={isRefreshingLocation || isFetchingGps}>
                {isRefreshingLocation ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.compactActionText}>Where I am?</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.compactMapButton}
                onPress={handleViewOnGoogleMap}>
                <Image
                  source={IMAGES.mapNew}
                  style={styles.liItem}
                  resizeMode="contain"
                />
                <Text style={styles.compactActionText}>View on Google Map</Text>
              </TouchableOpacity>
            </View>
            */}
          </View>
          <View style={styles.compactCard}>
            <View style={styles.compactField}>
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionHeading}>2. Activity photos</Text>
                <Text style={styles.photoCount}>
                  {[pic1, pic2].filter(Boolean).length}/2 added
                </Text>
              </View>
              {gpsCaptureStatus}
              {!isCapturingGps && (
                <View style={styles.locationStatusRow}>
                  <Text style={styles.locationStatusText}>
                    {hasGps
                      ? 'Location ready — tap a photo below to capture.'
                      : hasLatLng
                      ? 'Coordinates captured. If address lookup fails, retry GPS.'
                      : 'Location is required before taking photos.'}
                  </Text>
                  {!hasGps && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={handleGetGps}
                      disabled={isFetchingGps || isRefreshingLocation}
                      style={styles.locationRetry}>
                      <Text style={styles.locationRetryText}>
                        {isFetchingGps || isRefreshingLocation
                          ? 'Please wait'
                          : 'Retry GPS'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              <View style={styles.compactUploadBar}>
                <Text style={[styles.compactText, styles.compactUploadText]}>
                  Tap each photo to open the camera
                </Text>
                <View style={styles.compactUploadCamera}>
                  <Image
                    source={IMAGES.camera}
                    style={styles.vectorIcon7}
                    resizeMode="contain"
                  />
                </View>
              </View>
              <View style={styles.compactColumns}>
                <View style={styles.compactPhoto}>
                  {hasGps ? (
                    <CaptureImageWatermark
                      compact
                      title="Image 1"
                      pic={pic1}
                      setPic={result => {
                        setPic1(result);
                        clearError('image1');
                      }}
                      lat={gpsLat || ''}
                      long={gpsLong || ''}
                      address={address}
                      hasError={!!errors.image1}
                    />
                  ) : (
                    <LockedImageSlot compact label="Image 1" />
                  )}
                </View>
                <View style={styles.compactPhoto}>
                  {hasGps ? (
                    <CaptureImageWatermark
                      compact
                      title="Image 2"
                      pic={pic2}
                      setPic={result => {
                        setPic2(result);
                        clearError('image2');
                      }}
                      lat={gpsLat || ''}
                      long={gpsLong || ''}
                      address={address}
                      hasError={!!errors.image2}
                    />
                  ) : (
                    <LockedImageSlot compact label="Image 2" />
                  )}
                </View>
              </View>
            </View>
            <View style={styles.compactField}>
              <Text style={styles.compactText}>Remarks (optional)</Text>
              <TextInput
                accessibilityLabel="Remarks"
                value={remark}
                onChangeText={setRemark}
                placeholder="Enter Remarks / Description"
                placeholderTextColor="#8A9099"
                style={styles.compactRemark}
                textAlignVertical="top"
                multiline
              />
            </View>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{
              disabled: isSubmitting || isMasterLoading,
              busy: isSubmitting,
            }}
            style={[
              styles.compactSubmit,
              (isSubmitting || isMasterLoading) && styles.submitDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting || isMasterLoading}>
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitLabel}>Submit activity</Text>
            )}
          </TouchableOpacity>
        </View>
        <NearestRouteFallbackModal
          visible={isFallbackRouteModalVisible}
          isLoading={isFetchingFallbackRoute}
          info={fallbackRouteInfo}
          onClose={handleCloseFallbackRouteModal}
        />
      </Screen>
    );
  }

  return (
    <Screen
      preset="scroll"
      statusBgColor={COLORS.BACKGROUND_DEFAULT}
      statusBarStyle="dark">
      <View style={styles.body}>
        <View style={styles.main}>
          <View style={[styles.header, styles.spanFlexBox]}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Image
                style={styles.arrowBack24dp434343Fill0WIcon}
                resizeMode="cover"
                source={IMAGES.arrowBack}
              />
            </TouchableOpacity>
            <View style={[styles.lanheader, styles.btnPosition]}>
              <Text style={styles.title}>Add New Activity</Text>
            </View>
          </View>
          <View style={[styles.holidaybody, styles.rowFlexBox]}>
            <View style={styles.holiday}>
              <View style={[styles.holidayitem, styles.addSpaceBlock]}>
                <View style={styles.ul}>
                  {isMasterLoading && (
                    <View style={styles.masterLoadingRow}>
                      <ActivityIndicator
                        size="small"
                        color={COLORS.colorRoyalblue}
                      />
                      <Text style={styles.masterLoadingText}>
                        Loading dropdown options...
                      </Text>
                    </View>
                  )}
                  {/* Activity Type + Type + Priority (Priority only when Activity Type = "Alert") */}
                  <View style={[styles.frameParent, styles.rowFlexBox]}>
                    <View style={styles.spanParent}>
                      <View style={[styles.span, styles.spanFlexBox]}>
                        <Text style={[styles.cutType, styles.image1Typo]}>
                          Activity Type
                        </Text>
                        <Text
                          style={[styles.requiredIndicator, styles.image1Typo]}>
                          {' '}
                          *
                        </Text>
                      </View>
                      <DssCustomPicker
                        data={activityTypeOptions}
                        value={selectedActivityType}
                        labelKey="displayName"
                        placeholder="Select Activity Type"
                        hasError={!!errors.activityType}
                        onSelect={item => {
                          setSelectedActivityType(item);
                          setSelectedType(null);
                          setSelectedWorkBy(null);
                          setSelectedPriority(null);
                          clearError('activityType');
                          clearError('priority');
                        }}
                      />
                    </View>

                    <View style={styles.spanParent}>
                      <View style={[styles.span, styles.spanFlexBox]}>
                        <Text style={[styles.cutType, styles.image1Typo]}>
                          {activityLabelPrefix} Type
                        </Text>
                        <Text
                          style={[styles.requiredIndicator, styles.image1Typo]}>
                          {' '}
                          *
                        </Text>
                      </View>
                      <DssCustomPicker
                        data={typeOptions}
                        value={selectedType}
                        labelKey="displayName"
                        placeholder={
                          selectedActivityType
                            ? `Select ${activityLabelPrefix} Type`
                            : 'Select Activity Type first'
                        }
                        disabled={!selectedActivityType}
                        hasError={!!errors.type}
                        onSelect={item => {
                          setSelectedType(item);
                          setSelectedWorkBy(null);
                          clearError('type');
                        }}
                      />
                    </View>

                    {isAlertActivity && (
                      <View style={styles.spanParent}>
                        <View style={[styles.span, styles.spanFlexBox]}>
                          <Text style={[styles.cutType, styles.image1Typo]}>
                            Priority
                          </Text>
                          <Text
                            style={[
                              styles.requiredIndicator,
                              styles.image1Typo,
                            ]}>
                            {' '}
                            *
                          </Text>
                        </View>
                        <DssCustomPicker
                          data={priorityOptions}
                          value={selectedPriority}
                          labelKey="displayName"
                          placeholder="Select Priority"
                          hasError={!!errors.priority}
                          onSelect={item => {
                            setSelectedPriority(item);
                            clearError('priority');
                          }}
                        />
                      </View>
                    )}
                  </View>
                  {/* Work By + Organization Type */}
                  <View style={[styles.frameParent, styles.rowFlexBox]}>
                    <View style={styles.spanParent}>
                      <View style={[styles.span, styles.spanFlexBox]}>
                        <Text style={[styles.cutType, styles.image1Typo]}>
                          Work By
                        </Text>
                        <Text
                          style={[styles.requiredIndicator, styles.image1Typo]}>
                          {' '}
                          *
                        </Text>
                      </View>
                      <DssCustomPicker
                        data={workByOptions}
                        value={selectedWorkBy}
                        labelKey="displayName"
                        placeholder={
                          selectedType
                            ? `Select ${activityLabelPrefix} by`
                            : `Select ${activityLabelPrefix} Type first`
                        }
                        disabled={!selectedType}
                        hasError={!!errors.workBy}
                        onSelect={item => {
                          setSelectedWorkBy(item);
                          clearError('workBy');
                        }}
                      />
                    </View>
                    <View style={styles.spanParent}>
                      <View style={[styles.span, styles.spanFlexBox]}>
                        <Text style={[styles.cutType, styles.image1Typo]}>
                          Working For
                        </Text>
                        <Text
                          style={[styles.requiredIndicator, styles.image1Typo]}>
                          {' '}
                          *
                        </Text>
                      </View>
                      <DssCustomPicker
                        data={organizationTypeOptions}
                        value={selectedOrganizationType}
                        labelKey="displayName"
                        placeholder="Select Pvt/Govt."
                        hasError={!!errors.organizationType}
                        onSelect={item => {
                          setSelectedOrganizationType(item);
                          setSelectedCompanyType(null);
                          clearError('organizationType');
                        }}
                      />
                    </View>
                  </View>
                  {/* Company Type + Work on Route(meters) */}
                  <View style={[styles.frameParent, styles.rowFlexBox]}>
                    <View style={styles.spanParent}>
                      <View style={[styles.span, styles.spanFlexBox]}>
                        <Text style={[styles.cutType, styles.image1Typo]}>
                          Company Type
                        </Text>
                        <Text
                          style={[styles.requiredIndicator, styles.image1Typo]}>
                          {' '}
                          *
                        </Text>
                      </View>
                      <DssCustomPicker
                        data={companyTypeOptions}
                        value={selectedCompanyType}
                        labelKey="displayName"
                        valueKey="id"
                        placeholder={
                          selectedOrganizationType
                            ? 'Select Company'
                            : 'Select Organization Type first'
                        }
                        disabled={!selectedOrganizationType}
                        hasError={!!errors.companyType}
                        onSelect={item => {
                          setSelectedCompanyType(item);
                          clearError('companyType');
                        }}
                      />
                    </View>
                    <View style={styles.spanParent}>
                      <View style={[styles.span, styles.spanFlexBox]}>
                        <Text style={[styles.cutType, styles.image1Typo]}>
                          Work on Route(meteres)
                        </Text>
                        <Text
                          style={[styles.requiredIndicator, styles.image1Typo]}>
                          {' '}
                          *
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.addBorder,
                          errors.workOnRoute && styles.inputError,
                        ]}>
                        <TextInput
                          value={workOnRoute}
                          onChangeText={text => {
                            setWorkOnRoute(text.replace(/[^0-9.]/g, ''));
                            clearError('workOnRoute');
                          }}
                          placeholder="Enter Meteres"
                          placeholderTextColor="#999"
                          keyboardType="decimal-pad"
                          style={[
                            styles.enterVendorName,
                            styles.overheadOhTypo,
                          ]}
                        />
                      </View>
                      {errors.workOnRoute && (
                        <Text style={styles.errorText}>
                          Enter a valid distance in meters
                        </Text>
                      )}
                    </View>
                  </View>
                  {/* Vendor Name (autocomplete) + Vendor Mobile Number */}
                  <View style={[styles.frameParent, styles.rowFlexBox]}>
                    <View style={styles.spanParent}>
                      <View style={[styles.span, styles.spanFlexBox]}>
                        <Text style={[styles.cutType, styles.image1Typo]}>
                          Vendor Name
                        </Text>
                        <Text
                          style={[styles.requiredIndicator, styles.image1Typo]}>
                          {' '}
                          *
                        </Text>
                      </View>
                      <View style={styles.vendorFieldWrapper}>
                        <View
                          style={[
                            styles.addBorder,
                            errors.vendorName && styles.inputError,
                          ]}>
                          <TextInput
                            value={vendorName}
                            onChangeText={handleVendorNameChange}
                            onFocus={handleVendorInputFocus}
                            onBlur={handleVendorInputBlur}
                            placeholder="Search Vendor Name"
                            placeholderTextColor="#999"
                            autoCapitalize="words"
                            autoCorrect={false}
                            style={[
                              styles.enterVendorName,
                              styles.overheadOhTypo,
                            ]}
                          />{' '}
                          {isFetchingVendors && (
                            <ActivityIndicator
                              size="small"
                              color={COLORS.colorRoyalblue}
                              style={styles.vendorLoadingIndicator}
                            />
                          )}
                        </View>

                        {isVendorDropdownVisible && (
                          <View style={styles.vendorDropdown}>
                            <ScrollView
                              keyboardShouldPersistTaps="handled"
                              style={styles.vendorDropdownScroll}
                              nestedScrollEnabled>
                              {vendorSuggestions.map((item, idx) => (
                                <TouchableOpacity
                                  key={`${item.id ?? idx}`}
                                  style={styles.vendorDropdownItem}
                                  onPress={() =>
                                    handleSelectVendorSuggestion(item)
                                  }>
                                  <Text
                                    style={styles.vendorDropdownName}
                                    numberOfLines={1}>
                                    {item.vendorName}
                                  </Text>
                                  {!!item.vendorMobileNo && (
                                    <Text
                                      style={styles.vendorDropdownMobile}
                                      numberOfLines={1}>
                                      {item.vendorMobileNo}
                                    </Text>
                                  )}
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        )}
                      </View>
                      {errors.vendorName && (
                        <Text style={styles.errorText}>
                          Vendor Name is required
                        </Text>
                      )}
                    </View>

                    <View style={styles.spanParent}>
                      <View style={[styles.span, styles.spanFlexBox]}>
                        <Text style={[styles.cutType, styles.image1Typo]}>
                          Vendor Mobile Number
                        </Text>
                        <Text
                          style={[styles.requiredIndicator, styles.image1Typo]}>
                          {' '}
                          *
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.addBorder,
                          errors.vendorMobile && styles.inputError,
                        ]}>
                        <TextInput
                          value={vendorMobile}
                          onChangeText={text => {
                            setVendorMobile(text.replace(/[^0-9]/g, ''));
                            clearError('vendorMobile');
                            if (selectedActivityVendorId !== null) {
                              setSelectedActivityVendorId(null);
                            }
                          }}
                          placeholder="Enter Number"
                          placeholderTextColor="#999"
                          keyboardType="number-pad"
                          maxLength={10}
                          style={[
                            styles.enterVendorName,
                            styles.overheadOhTypo,
                          ]}
                        />
                      </View>
                      {errors.vendorMobile && (
                        <Text style={styles.errorText}>
                          Enter a valid 10-digit number
                        </Text>
                      )}
                    </View>
                  </View>
                  {/* Latitude/Longitude/Address — combined section as per UI */}
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
                        disabled={isFetchingGps || isRefreshingLocation}>
                        <Text style={[styles.getGps, styles.getGpsTypo]}>
                          {isFetchingGps ? 'Fetching...' : 'Get GPS'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {hasLatLng && (
                    <View style={styles.ul}>
                      <View style={[styles.span, styles.spanFlexBox]}>
                        <Text style={[styles.cutType, styles.image1Typo]}>
                          Address
                        </Text>
                        <Text
                          style={[styles.requiredIndicator, styles.image1Typo]}>
                          {' '}
                          *
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.add,
                          styles.addBorder,
                          errors.address && styles.inputError,
                        ]}>
                        <TextInput
                          value={address}
                          onChangeText={text => {
                            setAddress(text);
                            setIsAddressApproximate(false); // ← user edited, no longer "auto nearby"
                            clearError('address');
                          }}
                          placeholder="Enter Address"
                          placeholderTextColor="#999"
                          multiline
                          style={[
                            styles.enterVendorName,
                            styles.overheadOhTypo,
                          ]}
                        />
                      </View>
                      {isAddressApproximate && !!address.trim() && (
                        <Text style={styles.nearbyAddressHint}>
                          No address at this exact point — showing nearest
                          nearby address. Lat/Long is unchanged.
                        </Text>
                      )}
                      {errors.address && (
                        <Text style={styles.errorText}>
                          Address is required
                        </Text>
                      )}
                    </View>
                  )}
                  {/* Landmark */}
                  <View style={styles.ul}>
                    <View style={[styles.span, styles.spanFlexBox]}>
                      <Text style={[styles.cutType, styles.image1Typo]}>
                        Landmark
                      </Text>
                    </View>
                    <View style={[styles.add, styles.addBorder]}>
                      <TextInput
                        value={landmark}
                        onChangeText={setLandmark}
                        placeholder="Enter Landmark"
                        placeholderTextColor="#999"
                        style={[styles.enterVendorName, styles.overheadOhTypo]}
                      />
                    </View>
                  </View>
                  {!isLocatingActivity && (
                    <View style={styles.ul}>
                      <View style={[styles.span, styles.spanFlexBox]}>
                        <Text style={[styles.cutType, styles.image1Typo]}>
                          {(routeIdStr || routeId !== null) && (
                            <Text>GIG ID #{routeIdStr ?? routeId}</Text>
                          )}{' '}
                        </Text>
                      </View>
                    </View>
                  )}
                  {isLocatingActivity ? (
                    <View style={styles.locatingFlowContainer}>
                      <View style={styles.gigHeaderBox}>
                        <Text style={styles.gigHeaderText}>
                          GIG ID:{' '}
                          <Text style={styles.gigHeaderValue}>
                            #{routeIdStr ?? routeId ?? '--'}
                          </Text>
                        </Text>
                      </View>
                      {hasLatLng ? (
                        <>
                          <View style={styles.locatingTimelineRow}>
                            <View style={styles.timelineLineCol}>
                              <View style={styles.timelineDashedLine} />
                              <TouchableOpacity
                                style={[
                                  styles.timelinePinBadge,
                                  {top: timelinePinTop},
                                ]}
                                onPress={handleWhereIAmPress}
                                disabled={isRefreshingLocation || isFetchingGps}
                                hitSlop={{
                                  top: 8,
                                  right: 8,
                                  bottom: 8,
                                  left: 8,
                                }}>
                                {isRefreshingLocation ? (
                                  <ActivityIndicator
                                    size="small"
                                    color={COLORS.colorRoyalblue}
                                  />
                                ) : (
                                  <Image
                                    style={styles.timelinePinIcon}
                                    resizeMode="contain"
                                    source={IMAGES.locationCheck}
                                  />
                                )}
                              </TouchableOpacity>
                            </View>

                            <View style={styles.timelineContentCol}>
                              <ChamberInfoCard
                                title="Left Chamber:"
                                chamberId={leftChamberIdDisplay}
                                chamberName={leftChamberNameDisplay}
                                gig={
                                  routeIdStr ??
                                  (routeId ? `GIG${routeId}` : null)
                                }
                                address={leftChamberAddress}
                                landmark={leftChamberLandmark}
                                lat={nearestLeftChamberLat}
                                lng={nearestLeftChamberLng}
                              />
                              <DistanceConnector
                                distanceText={formatDistance(
                                  distanceToLeftChamber,
                                )}
                              />

                              {videoInfos.map((video, index) => (
                                <React.Fragment
                                  key={`${video.uri ?? 'video'}-${index}`}>
                                  <VideoSummaryCard video={video} />

                                  <DistanceConnector
                                    distanceText={formatDistance(
                                      distanceToLeftChamber,
                                    )}
                                  />
                                </React.Fragment>
                              ))}

                              <View onLayout={handleCurrentLocRowLayout}>
                                <CurrentLocationCard
                                  address={address}
                                  lat={gpsLat}
                                  lng={gpsLong}
                                  isRecording={isRecordingLocating}
                                  onPressStartRec={handleStartRecording}
                                />
                              </View>
                              <DistanceConnector
                                distanceText={formatDistance(
                                  distanceToRightChamber,
                                )}
                              />
                              <ChamberInfoCard
                                title="Right Chamber:"
                                chamberId={rightChamberIdDisplay}
                                chamberName={rightChamberNameDisplay}
                                gig={
                                  routeIdStr ??
                                  (routeId ? `GIG${routeId}` : null)
                                }
                                address={rightChamberAddress}
                                landmark={rightChamberLandmark}
                                lat={nearestRightChamberLat}
                                lng={nearestRightChamberLng}
                              />
                            </View>
                          </View>
                        </>
                      ) : (
                        <View style={styles.locatingGpsPromptBox}>
                          <Text style={styles.locatingGpsPromptText}>
                            Tap "Get GPS" above to load the nearest Left / Right
                            chamber details.
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : hasLatLng ? (
                    <View style={styles.mainFlexBox}>
                      <View style={[styles.row3, styles.mainFlexBox]}>
                        <View style={styles.div}>
                          <View style={styles.divider} />
                          <View style={styles.location}>
                            <Image
                              style={[styles.locationChild, styles.btnPosition]}
                              resizeMode="contain"
                              source={IMAGES.locationCheck}
                            />
                            <View style={styles.locationIcon}>
                              <Image
                                style={styles.groupIcon}
                                resizeMode="contain"
                              />
                            </View>
                            <Image
                              style={[
                                styles.locationItem,
                                styles.locationLayout,
                              ]}
                              resizeMode="contain"
                              source={IMAGES.downArrow2}
                            />
                            <Image
                              style={[
                                styles.locationInner,
                                styles.locationLayout,
                              ]}
                              resizeMode="contain"
                              source={IMAGES.upArrow}
                            />
                            <Text
                              style={[
                                styles.distanceIndicator,
                                styles.distanceTypo,
                              ]}>
                              {formatDistance(distanceToLeftChamber)}
                            </Text>
                            <Text
                              style={[
                                styles.distanceIndicator2,
                                styles.distanceTypo,
                              ]}>
                              {formatDistance(distanceToRightChamber)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.ulWrapper}>
                          <View style={styles.ul2}>
                            <View style={styles.span12}>
                              <View style={styles.span17}>
                                <View style={styles.nearestLeftChamberWrapper}>
                                  <Text
                                    style={[
                                      styles.nearestLeftChamber,
                                      styles.fieldTypo,
                                    ]}>
                                    Nearest Left Chamber:
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.add11}>
                                <Text
                                  style={[
                                    styles.chhtag4EnclosureId,
                                    styles.enterMetersFlexBox,
                                  ]}
                                  numberOfLines={1}>
                                  {isFetchingNearestChamber
                                    ? 'Fetching...'
                                    : nearestLeftChamber || 'Not available'}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.li3}>
                              <Image
                                source={IMAGES.dualsideArrow}
                                style={styles.liChild}
                                resizeMode="cover"
                              />
                              <Text style={[styles.m, styles.distanceTypo]}>
                                {formatDistance(distanceBetweenChambers)}
                              </Text>
                            </View>
                            <View style={styles.formBody}>
                              <View style={styles.span12}>
                                <View style={styles.span}>
                                  <Text
                                    style={[
                                      styles.nearestLeftChamber,
                                      styles.fieldTypo,
                                    ]}>
                                    Nearest Right Chamber:
                                  </Text>
                                </View>
                                <View style={styles.add11}>
                                  <Text
                                    style={[
                                      styles.chhtag4EnclosureId,
                                      styles.enterMetersFlexBox,
                                    ]}
                                    numberOfLines={1}>
                                    {isFetchingNearestChamber
                                      ? 'Fetching...'
                                      : nearestRightChamber || 'Not available'}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        </View>
                      </View>
                      <View style={styles.footer}>
                        <TouchableOpacity
                          style={[styles.li5, styles.li5FlexBox]}
                          onPress={handleWhereIAmPress}
                          disabled={isRefreshingLocation || isFetchingGps}>
                          {isRefreshingLocation ? (
                            <ActivityIndicator
                              size="small"
                              color={COLORS.colorWhite}
                            />
                          ) : (
                            <Text
                              style={[styles.whereIAm, styles.whereIAmTypo]}>
                              Where I am?
                            </Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.li6, styles.li5FlexBox]}
                          onPress={handleViewOnGoogleMap}>
                          <Image
                            style={styles.liItem}
                            source={IMAGES.mapNew}
                            resizeMode="cover"
                          />
                          <Text style={[styles.whereIAm, styles.whereIAmTypo]}>
                            View on Google Map
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.locatingGpsPromptBox}>
                      <Text style={styles.locatingGpsPromptText}>
                        Tap "Get GPS" above to load the nearest Left / Right
                        chamber details.
                      </Text>
                    </View>
                  )}
                  {/* Cut Pictures — 4 slots.
                          Each slot renders <CaptureImageWatermark/> ONLY when
                          `hasGps` is true (lat + long + address all present).
                          Until then, a <LockedImageSlot/> is shown instead —
                          tapping it just alerts the user, so the camera can
                          never be opened without a fresh GPS + address. */}
                  <View style={styles.li2}>
                    <View style={styles.li7}>
                      <View style={styles.span12}>
                        <View style={styles.label}>
                          <View style={styles.span}>
                            <Text style={[styles.fieldLabel, styles.fieldTypo]}>
                              Alert Pictures
                            </Text>
                          </View>
                        </View>

                        {gpsCaptureStatus}

                        <View style={styles.span17}>
                          <View style={styles.col8}>
                            <View style={styles.btn2}>
                              <Text
                                style={[
                                  styles.uploadButtonText,
                                  styles.fieldTypo,
                                ]}>
                                Upload 4 Images
                              </Text>

                              <View style={styles.icon}>
                                <Image
                                  style={styles.vectorIcon7}
                                  resizeMode="cover"
                                  source={IMAGES.camera}
                                />
                              </View>
                            </View>
                          </View>
                        </View>

                        {!hasGps && (
                          <Text style={styles.gpsLockHintText}>
                            Fetch GPS location (and address) above to enable
                            photo capture.
                          </Text>
                        )}
                      </View>
                      <View
                        style={[
                          styles.row,
                          styles.rowFlexBox,
                          styles.pictureSlotRow,
                        ]}>
                        <View style={styles.pictureSlotCol}>
                          {hasGps ? (
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
                              lat={gpsLat || ''}
                              long={gpsLong || ''}
                              address={address}
                              hasError={!!errors.image1}
                            />
                          ) : (
                            <LockedImageSlot label="Image 1" />
                          )}
                        </View>
                        <View style={styles.pictureSlotCol}>
                          {hasGps ? (
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
                              lat={gpsLat || ''}
                              long={gpsLong || ''}
                              address={address}
                              hasError={!!errors.image2}
                            />
                          ) : (
                            <LockedImageSlot label="Image 2" />
                          )}
                        </View>
                      </View>
                      <View
                        style={[
                          styles.row,
                          styles.rowFlexBox,
                          styles.pictureSlotRow,
                        ]}>
                        <View style={styles.pictureSlotCol}>
                          {hasGps ? (
                            <CaptureImageWatermark
                              title="Image 3"
                              pic={pic3}
                              setPic={result => {
                                setPic3(result);
                                if (result && errors.image3)
                                  setErrors((e: any) => ({
                                    ...e,
                                    image3: false,
                                  }));
                              }}
                              lat={gpsLat || ''}
                              long={gpsLong || ''}
                              address={address}
                              hasError={!!errors.image3}
                            />
                          ) : (
                            <LockedImageSlot label="Image 3" />
                          )}
                        </View>
                        <View style={styles.pictureSlotCol}>
                          {hasGps ? (
                            <CaptureImageWatermark
                              title="Image 4"
                              pic={pic4}
                              setPic={result => {
                                setPic4(result);
                                if (result && errors.image4)
                                  setErrors((e: any) => ({
                                    ...e,
                                    image4: false,
                                  }));
                              }}
                              lat={gpsLat || ''}
                              long={gpsLong || ''}
                              address={address}
                              hasError={!!errors.image4}
                            />
                          ) : (
                            <LockedImageSlot label="Image 4" />
                          )}
                        </View>
                      </View>
                    </View>
                  </View>
                  {/* Remark */}
                  <View style={styles.ul}>
                    <View style={[styles.span, styles.spanFlexBox]}>
                      <Text style={[styles.cutType, styles.image1Typo]}>
                        Remark
                      </Text>
                    </View>
                    <View style={[styles.add, styles.addBorder]}>
                      <TextInput
                        value={remark}
                        onChangeText={setRemark}
                        placeholder="Enter Remarks"
                        placeholderTextColor="#999"
                        multiline
                        style={[styles.enterVendorName, styles.overheadOhTypo]}
                      />
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={styles.button}
          onPress={handleSubmit}
          disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator size="small" color={COLORS.colorWhite} />
          ) : (
            <Text style={[styles.whereIAm, styles.whereIAmTypo]}>Submit</Text>
          )}
        </TouchableOpacity>
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
export default AddCutScreen;
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  compactBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 32,
    backgroundColor: '#F3F6F9',
    flexGrow: 1,
  },
  compactHeader: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  compactBack: {position: 'absolute', left: 0, padding: 10, zIndex: 1},
  compactTitle: {fontSize: 19, fontFamily: FONTS.SEMI_BOLD, color: '#1D2939'},
  formIntroduction: {
    fontSize: 14,
    lineHeight: 21,
    color: '#667085',
    marginBottom: 18,
    fontFamily: FONTS.REGULAR,
  },
  sectionHeading: {fontSize: 16, fontFamily: FONTS.SEMI_BOLD, color: '#1D2939'},
  sectionDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: '#667085',
    fontFamily: FONTS.REGULAR,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoCount: {
    fontSize: 12,
    color: '#2D64F5',
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    fontFamily: FONTS.MEDIUM,
  },
  locationStatusRow: {
    padding: 12,
    backgroundColor: '#F3F6FB',
    borderRadius: 10,
    gap: 8,
  },
  locationStatusText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#475467',
    fontFamily: FONTS.REGULAR,
  },
  locationRetry: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#E5EDFF',
  },
  locationRetryText: {fontSize: 13, fontFamily: FONTS.MEDIUM, color: '#2455CE'},
  submitDisabled: {opacity: 0.55},
  submitLabel: {fontSize: 16, fontFamily: FONTS.SEMI_BOLD, color: '#FFFFFF'},
  compactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 16,
    marginBottom: 16,
    shadowColor: '#263449',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  compactColumns: {flexDirection: 'row', gap: 8, alignItems: 'stretch'},
  compactField: {flex: 1, gap: 6, minWidth: 0},
  compactText: {fontSize: 13, fontFamily: FONTS.REGULAR, color: '#373B44'},
  workOptionHeading: {fontSize: 14, fontFamily: FONTS.MEDIUM},
  workByOptions: {gap: 10},
  workByRow: {flexDirection: 'row', gap: 8},
  workByOptionSelected: {backgroundColor: '#EEF4FF', borderColor: '#2D64F5'},
  workByOption: {
    flex: 1,
    minWidth: 0,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workByOptionLabel: {flex: 1, fontSize: 14},
  workByCheckbox: {
    width: 26,
    height: 26,
    borderWidth: 1.5,
    borderColor: '#9DA7B5',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workByCheckboxSelected: {backgroundColor: '#2D64F5', borderColor: '#2D64F5'},
  workByCheckboxError: {borderColor: '#FF003B'},
  workByCheckmark: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 24,
  },
  compactGpsRow: {flexDirection: 'row', alignItems: 'center', gap: 4},
  compactCoordinates: {
    backgroundColor: '#F0F1F3',
    borderRadius: 3,
    paddingHorizontal: 4,
    flexShrink: 1,
  },
  compactGpsButton: {
    marginLeft: 'auto',
    borderRadius: 4,
    padding: 6,
    backgroundColor: '#2D64F5',
  },
  compactGpsText: {fontSize: 11, fontFamily: FONTS.MEDIUM, color: '#FFFFFF'},
  compactAddress: {
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: '#373B44',
    padding: 0,
    minHeight: 20,
  },
  compactError: {borderBottomWidth: 1, borderBottomColor: '#FF003B'},
  compactGigRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  compactChambers: {flexDirection: 'row', minHeight: 174},
  compactTimeline: {width: 30, position: 'relative'},
  compactDash: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderLeftWidth: 1,
    borderColor: '#B8BEC7',
    borderStyle: 'dashed',
  },
  compactLocationPin: {
    position: 'absolute',
    left: -9,
    top: 77,
    width: 30,
    height: 30,
  },
  compactUpperArrow: {
    position: 'absolute',
    left: 4,
    top: 42,
    width: 22,
    height: 36,
  },
  compactLowerArrow: {
    position: 'absolute',
    left: 4,
    bottom: 22,
    width: 22,
    height: 36,
  },
  compactLeftDistance: {
    position: 'absolute',
    left: 2,
    top: 30,
    fontSize: 9,
    color: '#0098FF',
    backgroundColor: '#FFFFFF',
  },
  compactRightDistance: {
    position: 'absolute',
    left: 2,
    bottom: 7,
    fontSize: 9,
    color: '#0098FF',
    backgroundColor: '#FFFFFF',
  },
  compactChamberContent: {flex: 1, gap: 6, paddingTop: 3},
  compactChamberLabel: {
    fontSize: 11,
    fontFamily: FONTS.REGULAR,
    color: '#373B44',
  },
  compactChamberBox: {
    backgroundColor: '#E9ECEF',
    borderRadius: 5,
    paddingHorizontal: 10,
    height: 33,
    justifyContent: 'center',
  },
  compactChamberValue: {
    fontSize: 11,
    fontFamily: FONTS.REGULAR,
    color: '#838992',
  },
  compactDistanceRow: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  compactDistanceArrow: {height: 25, width: 9},
  compactMapActions: {flexDirection: 'row', gap: 8, marginLeft: 30},
  compactWhereButton: {
    backgroundColor: '#2D64F5',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 7,
    justifyContent: 'center',
  },
  compactMapButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#373B44',
    paddingVertical: 9,
    borderRadius: 7,
  },
  compactActionText: {
    fontSize: 12,
    fontFamily: FONTS.MEDIUM,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  compactUploadBar: {
    height: 36,
    borderWidth: 1,
    borderColor: '#DCE5F2',
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactUploadText: {flex: 1, paddingLeft: 10},
  compactUploadCamera: {
    alignSelf: 'stretch',
    paddingHorizontal: 12,
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  compactPhoto: {flex: 1, minWidth: 0},
  compactLockedPhoto: {
    height: 74,
    backgroundColor: '#F3F6F9',
    borderWidth: 0,
    opacity: 1,
  },
  compactRemark: {
    borderWidth: 1,
    borderColor: '#DCE5F2',
    borderRadius: 7,
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    fontFamily: FONTS.REGULAR,
    color: '#373B44',
  },
  compactSubmit: {
    marginTop: 4,
    backgroundColor: '#2D64F5',
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    marginTop: 20,
    backgroundColor: COLORS.colorDeepskyblue,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: Border.br_8,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  iconLayout: {
    width: Width.width_24,
    height: Height.height_24,
  },
  uploadButtonText: {
    lineHeight: 20,
    fontSize: FontSize.fs_14,
    flex: 1,
  },
  icon: {
    height: 38,
    backgroundColor: COLORS.colorAliceblue,
    paddingVertical: 10,
    paddingHorizontal: Padding.padding_12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vectorIcon7: {
    width: 17,
    height: Height.height_15,
  },
  col10: {
    height: Height.height_80,
    backgroundColor: COLORS.colorWhitesmoke100,
    gap: Gap.gap_3,
    borderRadius: Border.br_6,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  cameraIcon: {
    zIndex: 0,
  },
  imagePlaceholder: {
    color: COLORS.colorSlategray,
    fontSize: FontSize.fs_10,
    alignSelf: 'center',
    textAlign: 'left',
    zIndex: 1,
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
  },
  btn2: {
    paddingLeft: Padding.padding_12,
    borderRadius: Border.br_6,
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderStyle: 'solid',
    overflow: 'hidden',
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  li7: {
    gap: Gap.gap_10,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  spanFlexBox: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  whereIAm: {
    fontSize: FontSize.fs_12,
  },
  whereIAmTypo: {
    color: COLORS.colorWhite,
    textAlign: 'left',
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
  },
  li6: {
    backgroundColor: COLORS.colorDarkslategray,
    gap: Gap.gap_8,
  },
  liItem: {
    width: 12.29,
    height: Height.height_18,
  },
  btnPosition: {
    zIndex: 0,
    justifyContent: 'center',
  },
  rowFlexBox: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  addSpaceBlock: {
    paddingHorizontal: Padding.padding_12,
    borderRadius: Border.br_8,
  },
  image1Typo: {
    textAlign: 'left',
    fontFamily: FontFamily.switzer,
  },
  enterMetersFlexBox: {
    opacity: 0.6,
    lineHeight: LineHeight.lh_22,
    textAlign: 'left',
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
    flex: 1,
  },
  addBorder: {
    paddingVertical: Padding.padding_7,
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderStyle: 'solid',
    alignItems: 'center',
    flexDirection: 'row',
    borderRadius: Border.br_10,
  },
  fieldLabel: {
    letterSpacing: LetterSpacing.ls_0_2,
    textAlign: 'left',
    fontSize: FontSize.fs_14,
  },
  overheadOhTypo: {
    lineHeight: LineHeight.lh_22,
    textAlign: 'left',
    fontSize: FontSize.fs_14,
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
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
  btnLayout: {
    borderRadius: Border.br_6,
    alignSelf: 'stretch',
  },
  body: {
    height: '100%',
    paddingHorizontal: Padding.padding_16,
    paddingTop: 38,
    paddingBottom: 24,
    alignItems: 'flex-start',
    flex: 1,
    width: '100%',
  },
  main: {
    gap: Gap.gap_12,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    flex: 1,
  },
  header: {
    height: Height.height_24,
    gap: Gap.gap_12,
    alignSelf: 'stretch',
  },
  lanheader: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    lineHeight: 23,
    textAlign: 'center',
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
  },
  arrowBack24dp434343Fill0WIcon: {
    width: 24,
    height: Height.height_24,
  },
  holidaybody: {
    overflow: 'hidden',
    flex: 1,
  },
  mainFlexBox: {
    gap: Gap.gap_12,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  span12: {
    gap: Gap.gap_6,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  formBody: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  fieldTypo: {
    textAlign: 'left',
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
  },
  holiday: {
    alignItems: 'flex-start',
    flex: 1,
  },
  holidayitem: {
    paddingVertical: Padding.padding_16,
    maxWidth: 430,
    backgroundColor: COLORS.colorWhite,
    paddingHorizontal: Padding.padding_12,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    overflow: 'hidden',
    alignItems: 'flex-start',
    width: '100%',
  },
  li5FlexBox: {
    paddingVertical: 9,
    borderRadius: Border.br_8,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: Padding.padding_16,
  },
  ul: {
    gap: Gap.gap_12,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  masterLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  masterLoadingText: {
    fontSize: 12,
    fontFamily: FontFamily.switzer,
    color: COLORS.colorDarkslategray,
  },
  frameParent: {
    gap: Gap.gap_12,
  },
  col8: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    flex: 1,
  },
  spanParent: {
    gap: Gap.gap_12,
    alignItems: 'stretch',
    flex: 1,
    width: '100%',
  },
  distanceTypo: {
    color: COLORS.colorRoyalblue200,
    fontSize: FontSize.fs_10,
    textAlign: 'left',
    fontFamily: FontFamily.switzer,
  },
  span: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  cutType: {
    letterSpacing: LetterSpacing.ls_0_2,
    textAlign: 'left',
    color: COLORS.colorDarkslategray,
    fontSize: FontSize.fs_14,
  },
  requiredIndicator: {
    color: COLORS.colorRed,
    fontSize: FontSize.fs_14,
  },
  add: {
    paddingHorizontal: Padding.padding_12,
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderRadius: Border.br_8,
    backgroundColor: COLORS.colorWhite,
    alignItems: 'flex-start',
  },
  placeholderText: {
    color: '#999',
  },
  enterVendorName: {
    flexWrap: 'nowrap',
    width: '100%',
    minHeight: 20,
    paddingVertical: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  readonlyTextInput: {
    color: COLORS.colorDarkslategray,
    opacity: 1,
  },
  vendorFieldWrapper: {
    position: 'relative',
    width: '100%',
    zIndex: 20,
  },
  vendorLoadingIndicator: {
    marginLeft: 6,
  },
  vendorDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: COLORS.colorWhite,
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderRadius: Border.br_8,
    elevation: 6,
    boxShadow: BoxShadow.shadow_drop,
    maxHeight: 180,
    zIndex: 30,
  },
  vendorDropdownScroll: {
    maxHeight: 180,
  },
  vendorDropdownItem: {
    paddingVertical: Padding.padding_7,
    paddingHorizontal: Padding.padding_12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.colorAliceblue,
  },
  vendorDropdownName: {
    fontSize: FontSize.fs_14,
    fontFamily: FontFamily.switzer,
    color: COLORS.colorDarkslategray,
    fontWeight: '500',
  },
  vendorDropdownMobile: {
    fontSize: FontSize.fs_12,
    fontFamily: FontFamily.switzer,
    color: COLORS.colorSlategray,
    marginTop: 2,
  },
  locationLayout: {
    borderRadius: Border.br_4,
    left: 17.5,
    width: Width.width_19,
    height: 31.5,
    position: 'absolute',
  },
  distanceIndicator: {
    width: 21,
    top: -52,
    zIndex: 4,
    left: 13,
    height: 13,
    color: COLORS.colorRoyalblue200,
    position: 'absolute',
  },
  distanceIndicator2: {
    width: 26,
    top: 100,
    zIndex: 5,
    left: 13,
    height: 13,
    color: COLORS.colorRoyalblue200,
    position: 'absolute',
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
  add5: {
    backgroundColor: COLORS.colorWhitesmoke,
    paddingHorizontal: Padding.padding_12,
    borderRadius: Border.br_8,
    alignSelf: 'stretch',
  },
  readonlyBoxHeight: {
    paddingVertical: Padding.padding_7,
    justifyContent: 'center',
  },
  li2: {
    gap: Gap.gap_10,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  label: {
    gap: 4,
    justifyContent: 'center',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  takeClearPhotos: {
    fontSize: 9,
    letterSpacing: LetterSpacing.ls_0_2,
    textAlign: 'left',
    color: COLORS.colorDarkslategray,
    alignSelf: 'flex-start',
  },
  row: {
    gap: Gap.gap_10,
  },
  col: {
    gap: Gap.gap_10,
    alignItems: 'flex-start',
    flex: 1,
    position: 'relative',
  },
  pictureSlotRow: {
    alignItems: 'stretch',
  },
  pictureSlotCol: {
    flex: 1,
    alignItems: 'stretch',
    minHeight: Height.height_80,
  },
  btn: {
    height: Height.height_36,
    paddingHorizontal: 17,
    gap: Gap.gap_10,
    paddingVertical: Padding.padding_7,
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderStyle: 'solid',
    alignItems: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
    zIndex: 0,
    justifyContent: 'center',
    width: '100%',
  },
  vectorIcon4: {
    width: 17,
    height: Height.height_15,
  },
  image1: {
    lineHeight: LineHeight.lh_20,
    fontSize: FontSize.fs_14,
    color: COLORS.colorDarkslategray,
  },
  imgcardIcon: {
    height: Height.height_80,
    zIndex: 1,
    width: '100%',
  },
  closeIcon: {
    width: Width.width_15,
    top: 38.5,
    right: -7.5,
    zIndex: 2,
    height: Height.height_15,
    position: 'absolute',
  },
  closeIconInner: {
    width: Width.width_15,
    height: Height.height_15,
    borderRadius: Border.br_30,
    backgroundColor: COLORS.colorRed ?? 'red',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIconText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  li3: {
    gap: Gap.gap_6,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  submit: {
    fontSize: FontSize.fs_14,
  },
  inputError: {
    borderColor: COLORS.colorRed ?? 'red',
    borderWidth: 1.5,
  },
  errorText: {
    fontSize: 11,
    color: COLORS.colorRed ?? 'red',
    marginTop: -6,
    marginBottom: 2,
    fontFamily: FontFamily.switzer,
  },
  ulWrapper: {
    width: 341,
    alignItems: 'flex-start',
  },
  ul2: {
    gap: 26,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  span17: {
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  nearestLeftChamberWrapper: {
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
  },
  nearestLeftChamber: {
    fontSize: FontSize.fs_12,
    letterSpacing: LetterSpacing.ls_0_2,
    textAlign: 'left',
  },
  add11: {
    backgroundColor: COLORS.colorWhitesmoke200,
    paddingVertical: Padding.padding_6,
    borderRadius: Border.br_6,
    paddingHorizontal: Padding.padding_12,
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  chhtag4EnclosureId: {
    fontSize: FontSize.fs_12,
  },
  liChild: {
    height: 25,
  },
  m: {
    color: COLORS.colorRoyalblue200,
    fontWeight: '500',
  },
  footer: {
    paddingLeft: 34,
    gap: Gap.gap_10,
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  li5: {
    backgroundColor: COLORS.colorRoyalblue100,
  },
  row3: {
    paddingTop: 4,
    flexDirection: 'row',
  },
  div: {
    paddingRight: 19,
    gap: Gap.gap_8,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  divider: {
    width: 3,
    borderStyle: 'dashed',
    borderColor: COLORS.colorDimgray,
    borderRadius: 0,
    borderLeftWidth: 2,
    opacity: 0,
    zIndex: 0,
    flex: 1,
  },
  location: {
    marginTop: -9,
    left: -10,
    gap: Gap.gap_10,
    alignSelf: 'center',
    top: '50%',
    zIndex: 1,
    position: 'absolute',
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
    height: 28,
    width: 28,
    borderRadius: 53,
    paddingLeft: 1,
    borderColor: 'transparent',
    borderWidth: 1,
    borderStyle: 'solid',
    overflow: 'hidden',
    backgroundColor: COLORS.colorWhite,
    zIndex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupIcon: {
    width: 20.44,
    height: 20.43,
  },
  locationItem: {
    top: 62.5,
    zIndex: 2,
  },
  locationInner: {
    top: -36,
    zIndex: 3,
  },
  locatingFlowContainer: {
    width: '100%',
    gap: 0,
    alignItems: 'stretch',
    alignSelf: 'stretch',
  },
  gigHeaderBox: {
    backgroundColor: COLORS.colorWhitesmoke200 ?? '#F4F6FA',
    borderRadius: Border.br_8,
    paddingHorizontal: Padding.padding_12,
    paddingVertical: Padding.padding_7,
    alignSelf: 'stretch',
    marginBottom: 10,
  },
  gigHeaderText: {
    fontSize: FontSize.fs_14,
    fontFamily: FontFamily.switzer,
    fontWeight: '600',
    color: COLORS.colorDarkslategray,
  },
  gigHeaderValue: {
    fontWeight: '700',
    color: COLORS.colorRoyalblue,
  },
  locatingGpsPromptBox: {
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
  locatingGpsPromptText: {
    fontSize: FontSize.fs_12,
    fontFamily: FontFamily.switzer,
    color: COLORS.colorSlategray,
    textAlign: 'center',
  },
  locatingTimelineRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'stretch',
  },
  timelineLineCol: {
    width: 36,
    position: 'relative',
  },
  timelineDashedLine: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: '50%',
    marginLeft: -1,
    width: 0,
    borderLeftWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.colorRoyalblue200 ?? '#8FA8FF',
  },
  timelinePinBadge: {
    position: 'absolute',
    left: '50%',
    marginLeft: -(LOCATING_PIN_SIZE / 2),
    width: LOCATING_PIN_SIZE,
    height: LOCATING_PIN_SIZE,
    borderRadius: LOCATING_PIN_SIZE / 2,
    backgroundColor: COLORS.colorWhite,
    borderWidth: 2,
    borderColor: COLORS.colorRoyalblue,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    boxShadow: BoxShadow.shadow_drop,
    zIndex: 2,
  },
  timelinePinIcon: {
    width: 18,
    height: 18,
  },
  timelineContentCol: {
    flex: 1,
    paddingLeft: 4,
  },
  chamberCard: {
    backgroundColor: COLORS.colorWhitesmoke200 ?? '#F4F6FA',
    borderRadius: Border.br_8,
    paddingHorizontal: Padding.padding_12,
    paddingVertical: Padding.padding_10,
    gap: 6,
    alignSelf: 'stretch',
  },
  chamberCardTitle: {
    fontSize: FontSize.fs_12,
    fontFamily: FontFamily.switzer,
    fontWeight: '600',
    color: COLORS.colorDarkslategray,
    marginBottom: 2,
  },
  chamberCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  chamberCardHeaderText: {
    fontSize: FontSize.fs_12,
    fontFamily: FontFamily.switzer,
    color: COLORS.colorSlategray,
    flex: 1,
  },
  chamberCardHeaderValue: {
    fontWeight: '600',
    color: COLORS.colorDarkslategray,
  },
  chamberCardRowText: {
    fontSize: FontSize.fs_12,
    fontFamily: FontFamily.switzer,
    color: COLORS.colorSlategray,
  },
  chamberCardRowValue: {
    fontWeight: '500',
    color: COLORS.colorDarkslategray,
  },
  distanceConnector: {
    alignSelf: 'center',
    alignItems: 'center',
    paddingVertical: 6,
  },
  distanceConnectorText: {
    fontSize: FontSize.fs_12,
    fontFamily: FontFamily.switzer,
    fontWeight: '600',
    color: COLORS.colorRoyalblue200,
  },
  videoSummaryCard: {
    backgroundColor: COLORS.colorAliceblue,
    borderWidth: 1,
    borderColor: COLORS.colorRoyalblue,
    borderRadius: Border.br_8,
    paddingHorizontal: Padding.padding_12,
    paddingVertical: Padding.padding_10,
    gap: 6,
    alignSelf: 'stretch',
  },
  videoSummaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  videoSummaryPlayWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.colorRoyalblue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoSummaryPlayIcon: {
    color: COLORS.colorWhite,
    fontSize: 10,
  },
  videoSummaryDuration: {
    fontSize: FontSize.fs_12,
    fontFamily: FontFamily.switzer,
    fontWeight: '600',
    color: COLORS.colorDarkslategray,
  },
  currentLocationCard: {
    backgroundColor: COLORS.colorAliceblue,
    borderWidth: 1,
    borderColor: COLORS.colorRoyalblue,
    borderRadius: Border.br_8,
    paddingHorizontal: Padding.padding_12,
    paddingVertical: Padding.padding_10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    alignSelf: 'stretch',
  },
  currentLocationTextWrap: {
    flex: 1,
    gap: 2,
  },
  currentLocationAddressText: {
    fontSize: FontSize.fs_12,
    fontFamily: FontFamily.switzer,
    color: COLORS.colorSlategray,
  },
  currentLocationLatLngText: {
    fontSize: FontSize.fs_12,
    fontFamily: FontFamily.switzer,
    color: COLORS.colorSlategray,
  },
  startRecButton: {
    backgroundColor: COLORS.colorRoyalblue,
    borderRadius: Border.br_6,
    paddingHorizontal: Padding.padding_12,
    paddingVertical: Padding.padding_7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  startRecButtonActive: {
    backgroundColor: COLORS.colorRed ?? 'red',
  },
  startRecButtonIcon: {
    color: COLORS.colorWhite,
    fontSize: 10,
  },
  startRecButtonText: {
    color: COLORS.colorWhite,
    fontSize: FontSize.fs_12,
    fontFamily: FontFamily.switzer,
    fontWeight: '600',
  },
  locatingMapButton: {
    marginTop: 12,
    alignSelf: 'stretch',
  },

  // ── GPS-locked photo slot ────────────────────────────────────────────
  gpsCaptureStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 4,
  },
  gpsCaptureStatusText: {
    fontSize: FontSize.fs_12,
    fontFamily: FontFamily.switzer,
    color: COLORS.colorSlategray,
    flexShrink: 1,
  },
  gpsLockHintText: {
    fontSize: 11,
    fontFamily: FontFamily.switzer,
    color: COLORS.colorRed ?? 'red',
    marginTop: -2,
  },
  lockedImageSlot: {
    height: Height.height_80,
    backgroundColor: COLORS.colorWhitesmoke100,
    borderRadius: Border.br_6,
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    opacity: 0.6,
  },
  lockedCameraIcon: {
    width: 20,
    height: 18,
    opacity: 0.5,
  },
  lockedSlotText: {
    fontSize: FontSize.fs_12,
    fontFamily: FontFamily.switzer,
    color: COLORS.colorSlategray,
    fontWeight: '500',
  },
  lockedSlotSubText: {
    fontSize: 10,
    fontFamily: FontFamily.switzer,
    color: COLORS.colorSlategray,
  },
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
  nearbyAddressHint: {
    fontSize: 11,
    fontFamily: FontFamily.switzer,
    color: COLORS.colorSlategray,
    marginTop: -6,
  },
});
