// 4june working code — PATCHED: crossing-based destination detection
import {
  StyleSheet,
  Text,
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  Platform,
  TouchableWithoutFeedback,
  Modal,
  LayoutChangeEvent,
  Alert,
  ActivityIndicator,
  ToastAndroid,
  Dimensions,
  Linking,
} from 'react-native';
import React, {FC, useState, useEffect, useRef, useCallback} from 'react';
import * as Animatable from 'react-native-animatable';
import {Screen} from '@organisms';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {ScreenProps} from '@types';
import {AppDispatch} from '@reducers';
import {
  FontSize,
  Border,
  Gap,
  Padding,
  LetterSpacing,
  Width,
  Height,
  LineHeight,
} from '../../res/globalStyle';
import {
  getPitListwithABDShotStatus,
  getOpenShotDetailsByIdAPI,
} from '../../store/slices/dss.slice';
import {useDispatch} from 'react-redux';
import Geolocation from '@react-native-community/geolocation';
import {useFocusEffect} from '@react-navigation/native';
import {useSelector} from 'react-redux';
// ── Constants ─────────────────────────────────────────────────────────────────
const DASH_COL_WIDTH = 35;
const DASH_COL_WIDTH2 = 120;
const CARD_GAP = 8;
const BETWEEN_ROW_H = 44;
const BETWEEN_ROW_H_ACTIVE = 100;
const PIN_SIZE = 24;
const DASH_H = 5;
const DASH_GAP = 4;
const DASH_W = 1.5;
const TOAST_INTERVAL_MS = 15000;
const YOU_ARE_HERE_THRESHOLD_M = 30;
const DESTINATION_PROTECTION_DISTANCE_M = 0;
const ABD_SEGMENT_METERS = 9;
const getABDDistance = (abd1: any, abd2: any) => {
  const lat1 = parseFloat(abd1?.abdLat ?? abd1?.lat);
  const lng1 = parseFloat(abd1?.abdLng ?? abd1?.lng);

  const lat2 = parseFloat(abd2?.abdLat ?? abd2?.lat);
  const lng2 = parseFloat(abd2?.abdLng ?? abd2?.lng);

  if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
    return '--';
  }

  return formatDistance(haversineDistance(lat1, lng1, lat2, lng2));
};
// ── CROSSING DETECTION CONSTANTS ──────────────────────────────────────────────
// User must come within this radius of the destination PIT before crossing
// can be detected. This prevents false-positives when far away.
const CROSSING_ENTRY_RADIUS_M = 15;
const SCREEN_HEIGHT = Dimensions.get('window').height;

// After entering the entry radius, if the distance grows by this delta,
// the user has physically crossed and moved past the destination PIT.
const CROSSING_EXIT_DELTA_M = 3;
// ── GPS helpers ───────────────────────────────────────────────────────────────
type UserCoords = {latitude: number; longitude: number} | null;
const smoothCoords = (
  prev: UserCoords,
  next: {latitude: number; longitude: number},
): {latitude: number; longitude: number} => {
  if (!prev) return {latitude: next.latitude, longitude: next.longitude};
  const alpha = 0.35;
  return {
    latitude: prev.latitude + alpha * (next.latitude - prev.latitude),
    longitude: prev.longitude + alpha * (next.longitude - prev.longitude),
  };
};
const haversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6371000;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1);
  const dLon = toR(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const DEG_TO_M = 111_320;
const PERP_TOL_M = 25;
const T_LOW = -0.05;
const T_HIGH = 1.05;
const segmentCheck = (
  userLat: number,
  userLng: number,
  latA: number,
  lngA: number,
  latB: number,
  lngB: number,
): {onSegment: boolean; perp: number; t: number} => {
  const abLat = latB - latA;
  const abLng = lngB - lngA;
  const apLat = userLat - latA;
  const apLng = userLng - lngA;
  const abDot = abLat * abLat + abLng * abLng;
  if (abDot < 1e-18) return {onSegment: false, perp: Infinity, t: -1};
  const t = (apLat * abLat + apLng * abLng) / abDot;
  const closestLat = latA + t * abLat;
  const closestLng = lngA + t * abLng;
  const dLatM = (userLat - closestLat) * DEG_TO_M;
  const avgLat = (userLat + closestLat) / 2;
  const dLngM =
    (userLng - closestLng) * DEG_TO_M * Math.cos((avgLat * Math.PI) / 180);
  const perp = Math.sqrt(dLatM * dLatM + dLngM * dLngM);
  const onSegment = t >= T_LOW && t <= T_HIGH && perp <= PERP_TOL_M;
  return {onSegment, perp, t};
};
const findActiveBetweenIndex = (
  userLat: number,
  userLng: number,
  pitList: any[],
): number => {
  if (!pitList || pitList.length < 2) return -1;
  let bestIndex = -1;
  let bestScore = Infinity;
  for (let i = 0; i < pitList.length - 1; i++) {
    const latA = parseFloat(pitList[i]?.lat ?? '0');
    const lngA = parseFloat(pitList[i]?.lng ?? '0');
    const latB = parseFloat(pitList[i + 1]?.lat ?? '0');
    const lngB = parseFloat(pitList[i + 1]?.lng ?? '0');
    if (
      isNaN(latA) ||
      isNaN(lngA) ||
      isNaN(latB) ||
      isNaN(lngB) ||
      (latA === 0 && lngA === 0) ||
      (latB === 0 && lngB === 0)
    )
      continue;
    const {perp, t} = segmentCheck(userLat, userLng, latA, lngA, latB, lngB);
    const tClamped = Math.max(0, Math.min(1, t));
    const centredness = Math.abs(tClamped - 0.5);
    const forwardBias = t >= 0 && t < 0.3 ? -0.05 : 0;
    const perpNorm = perp / 40;
    const score = centredness + forwardBias + perpNorm * 0.3;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
};
const showToast = (msg: string) => {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
};
const openMapDirections = (location: string | undefined, label: string) => {
  if (!location) {
    Alert.alert('No Location', `No valid coordinates available for ${label}.`);
    return;
  }

  const [lat, lng] = location.split(',');

  const pLat = parseFloat(lat);
  const pLng = parseFloat(lng);

  if (isNaN(pLat) || isNaN(pLng) || (pLat === 0 && pLng === 0)) {
    Alert.alert('No Location', `No valid coordinates available for ${label}.`);
    return;
  }

  const mapsUrl =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${pLat},${pLng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${pLat},${pLng}`;

  Linking.openURL(mapsUrl).catch(() => {
    Alert.alert('Error', 'Unable to open Maps.');
  });
};
const getABDTotalDistance = (abdList: any[] = []) => {
  if (!abdList.length) return '--';

  // If API already returns distance for every ABD
  const apiTotal = abdList.reduce(
    (sum, item) => sum + Number(item.distance ?? item.abdDistance ?? 0),
    0,
  );

  if (apiTotal > 0) {
    return formatDistance(apiTotal);
  }

  // Otherwise calculate from lat/lng
  let total = 0;

  for (let i = 0; i < abdList.length - 1; i++) {
    const lat1 = parseFloat(abdList[i].abdLat ?? abdList[i].lat);
    const lng1 = parseFloat(abdList[i].abdLng ?? abdList[i].lng);

    const lat2 = parseFloat(abdList[i + 1].abdLat ?? abdList[i + 1].lat);
    const lng2 = parseFloat(abdList[i + 1].abdLng ?? abdList[i + 1].lng);

    if (!isNaN(lat1) && !isNaN(lng1) && !isNaN(lat2) && !isNaN(lng2)) {
      total += haversineDistance(lat1, lng1, lat2, lng2);
    }
  }
  return formatDistance(total);
};
const getCurrentPosition = (): Promise<{latitude: number; longitude: number}> =>
  new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      pos =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => {
        Geolocation.getCurrentPosition(
          pos =>
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          err => reject(err),
          {enableHighAccuracy: true, timeout: 15000, maximumAge: 0},
        );
      },
      {enableHighAccuracy: false, timeout: 3000, maximumAge: 0},
    );
  });

// ── Types ─────────────────────────────────────────────────────────────────────
type PitItem = {
  pitLocationId: number;
  pitNo: string;
  pitLandmark: string;
  pitGPSLocation: string;
  lat: string;
  lng: string;
  pic1Url: string;
  pic2Url: string;
  shotStatus: string;
  shotStatus2: string;
  isShotOpen?: boolean;
  isOpenForShot?: boolean;
  fromTo?: string | null;
  vendorId?: string;
  numberOfDucts?: number | null;
  abdList?: any[];
};

type GalleryItem = {
  pitId: string;
  pic1Url: string | null;
  pic2Url: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const displayPitNo = (pitNo: string | number): string => {
  const s = String(pitNo ?? '').trim();
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '') || '0';
};

const formatDistance = (meters: number): string => {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
};

const safeCoord = (raw: string | number | undefined | null): number | null => {
  const n = parseFloat(String(raw ?? ''));
  return isFinite(n) && !isNaN(n) ? n : null;
};

const hasValidCoords = (lat: number | null, lng: number | null): boolean =>
  lat !== null && lng !== null;

const safeDistance = (
  lat1: number | null,
  lng1: number | null,
  lat2: number | null,
  lng2: number | null,
): number | null => {
  if (!hasValidCoords(lat1, lng1) || !hasValidCoords(lat2, lng2)) return null;
  return haversineDistance(lat1!, lng1!, lat2!, lng2!);
};

const safeDistanceLabel = (
  lat1: number | null,
  lng1: number | null,
  lat2: number | null,
  lng2: number | null,
): string => {
  const d = safeDistance(lat1, lng1, lat2, lng2);
  return d !== null ? formatDistance(d) : '';
};

type PitClickState = 'not-clickable' | 'clickable-from' | 'clickable-to';

const getPitClickState = (
  pitList: PitItem[],
  pitIndex: number,
): PitClickState => {
  if (!pitList || pitList.length === 0) return 'not-clickable';
  const thisPit = pitList[pitIndex];
  if (!thisPit) return 'not-clickable';
  const fromTo = thisPit.fromTo;
  if (fromTo === 'From') return 'clickable-from';
  if (fromTo === 'To') return 'clickable-to';
  return 'not-clickable';
};

const isSegmentDone = (pitList: PitItem[], segIndex: number): boolean => {
  if (!pitList || segIndex < 0 || segIndex >= pitList.length - 1) return false;
  const upper = pitList[segIndex];
  const lower = pitList[segIndex + 1];
  const upperDone =
    typeof upper?.shotStatus2 === 'string' &&
    upper.shotStatus2.trim().toLowerCase() === 'done';
  const lowerDone =
    typeof lower?.shotStatus2 === 'string' &&
    lower.shotStatus2.trim().toLowerCase() === 'done';
  return upperDone && lowerDone;
};

// ── Bearing helper (degrees 0-360) ────────────────────────────────────────────
const getBearing = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLng = toR(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toR(lat2));
  const x =
    Math.cos(toR(lat1)) * Math.sin(toR(lat2)) -
    Math.sin(toR(lat1)) * Math.cos(toR(lat2)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

// ── Dashed line components ────────────────────────────────────────────────────
const VerticalDashedLine: FC<{
  height: number;
  color?: string;
  opacity?: number;
}> = ({height, color = COLORS.colorDimgray ?? '#888', opacity = 0.5}) => {
  if (Platform.OS === 'android') {
    return (
      <View
        style={{
          width: DASH_W,
          height,
          borderLeftWidth: DASH_W,
          borderStyle: 'dashed',
          borderColor: color,
          opacity,
        }}
      />
    );
  }
  const count = Math.floor(height / (DASH_H + DASH_GAP)) + 1;
  return (
    <View style={{width: DASH_W, height, overflow: 'hidden', opacity}}>
      {Array.from({length: count}).map((_, i) => (
        <View
          key={i}
          style={{
            width: DASH_W,
            height: DASH_H,
            backgroundColor: color,
            marginBottom: DASH_GAP,
          }}
        />
      ))}
    </View>
  );
};

const VerticalDashedLineAutoHeight: FC<{
  left: number;
  color?: string;
  opacity?: number;
  onHeightMeasured?: (h: number) => void;
}> = ({left, color, opacity, onHeightMeasured}) => {
  const [h, setH] = useState(0);
  return (
    <View
      style={StyleSheet.absoluteFillObject}
      pointerEvents="none"
      onLayout={e => {
        const measured = e.nativeEvent.layout.height;
        setH(measured);
        onHeightMeasured?.(measured);
      }}>
      <View style={{position: 'absolute', top: 0, left}}>
        {h > 0 && (
          <VerticalDashedLine height={h} color={color} opacity={opacity} />
        )}
      </View>
    </View>
  );
};

const ShortDashedConnector: FC<{color?: string}> = ({
  color = COLORS.colorDarkslategray ?? '#555',
}) => {
  if (Platform.OS === 'android') {
    return (
      <View style={styles.dashedWrap}>
        <View
          style={{
            width: 0,
            height: 8,
            borderLeftWidth: DASH_W,
            borderStyle: 'dashed',
            borderColor: color,
            opacity: 0.45,
          }}
        />
      </View>
    );
  }
  return (
    <View style={styles.dashedWrap}>
      <View style={{width: DASH_W, opacity: 0.45}}>
        <View
          style={{
            width: DASH_W,
            height: 3,
            backgroundColor: color,
            marginBottom: 2,
          }}
        />
        <View style={{width: DASH_W, height: 3, backgroundColor: color}} />
      </View>
    </View>
  );
};

// ── Between Status Pill ───────────────────────────────────────────────────────
const BetweenStatusPill: FC<{
  isDone: boolean;
  isActive: boolean;
  distLabel: string;
}> = ({isDone, isActive, distLabel}) => {
  return (
    <View style={styles.betweenRowNew}>
      <Text style={styles.distanceText}>{distLabel || '--'}</Text>
      <Text style={styles.bigDoubleArrow}> ↕ </Text>
      <View
        style={[
          styles.statusPillNew,
          {backgroundColor: isDone ? '#E6F9EE' : '#FFF3E0'},
        ]}>
        <View
          style={[
            styles.statusDotNew,
            {backgroundColor: isDone ? '#2E7D32' : '#FF9800'},
          ]}
        />
        <Text
          style={[
            styles.statusTextNew,
            {color: isDone ? '#2E7D32' : '#E65100'},
          ]}>
          {isDone ? 'Completed' : 'Pending'}
        </Text>
      </View>
    </View>
  );
};
const BetweenStatusPill2: FC<{
  distLabel: string;
}> = ({distLabel}) => {
  return (
    <View style={[styles.betweenRowNew2, {marginLeft: -18}]}>
      <Text style={styles.distanceText}>{distLabel || '--'}</Text>
      <Text style={styles.bigDoubleArrow}> ↕ </Text>
    </View>
  );
};

// ── Active Pit Badge ──────────────────────────────────────────────────────────
const ActivePitBadge: FC<{
  activePitLocationId: number | null;
  isLoading: boolean;
}> = ({activePitLocationId, isLoading}) => {
  if (isLoading) {
    return (
      <Animatable.View
        animation="pulse"
        iterationCount="infinite"
        duration={1200}
        style={styles.activePitBadgeSkeleton}>
        <ActivityIndicator size={12} color="#1976D2" style={{marginRight: 6}} />
        <Text style={styles.activePitBadgeSkeletonText}>
          Detecting active pit…
        </Text>
      </Animatable.View>
    );
  }
  if (activePitLocationId === null) return null;
  return (
    <View style={styles.activePitBadge}>
      <View style={styles.activePitBadgeDot} />
      <Text style={styles.activePitBadgeLabel}>Active PIT: </Text>
      <Text style={styles.activePitBadgeValue}>#{activePitLocationId}</Text>
    </View>
  );
};

// ── Walking Status Banner ─────────────────────────────────────────────────────
const WalkingStatusBanner: FC<{
  destinationPitNo: string;
  distanceToDestination: string;
  bearing: number | null;
}> = ({destinationPitNo, distanceToDestination, bearing}) => {
  const directionLabel = React.useMemo(() => {
    if (bearing === null) return '';
    if (bearing >= 337.5 || bearing < 22.5) return '↑ North';
    if (bearing >= 22.5 && bearing < 67.5) return '↗ NE';
    if (bearing >= 67.5 && bearing < 112.5) return '→ East';
    if (bearing >= 112.5 && bearing < 157.5) return '↘ SE';
    if (bearing >= 157.5 && bearing < 202.5) return '↓ South';
    if (bearing >= 202.5 && bearing < 247.5) return '↙ SW';
    if (bearing >= 247.5 && bearing < 292.5) return '← West';
    return '↖ NW';
  }, [bearing]);

  return (
    <Animatable.View
      animation="fadeInDown"
      duration={500}
      style={styles.walkingBanner}>
      <View style={styles.walkingIconWrap}>
        <Animatable.Text
          animation={{
            0: {translateY: 0},
            0.5: {translateY: -4},
            1: {translateY: 0},
          }}
          iterationCount="infinite"
          duration={700}
          style={styles.walkingEmoji}>
          🚶
        </Animatable.Text>
        <Animatable.View
          animation={{
            0: {scaleX: 1},
            0.5: {scaleX: 0.6},
            1: {scaleX: 1},
          }}
          iterationCount="infinite"
          duration={700}
          style={styles.walkingDots}>
          {[0, 1, 2].map(i => (
            <Animatable.View
              key={i}
              animation={{
                0: {opacity: 0.2},
                0.5: {opacity: 1},
                1: {opacity: 0.2},
              }}
              iterationCount="infinite"
              duration={700}
              delay={i * 150}
              style={styles.walkingDot}
            />
          ))}
        </Animatable.View>
        <View style={styles.destinationPin}>
          <Text style={styles.destinationPinText}>📍</Text>
        </View>
      </View>
      <View style={styles.walkingInfo}>
        <View style={styles.walkingRow}>
          <View style={styles.walkingActiveDot} />
          <Text style={styles.walkingActiveText}>Shot in Progress</Text>
        </View>
        <Text style={styles.walkingDestText}>
          Heading to{' '}
          <Text style={styles.walkingDestBold}>PIT - {destinationPitNo}</Text>
        </Text>
        <View style={styles.walkingMetaRow}>
          {!!distanceToDestination && (
            <Text style={styles.walkingMetaDist}>{distanceToDestination}</Text>
          )}
          {!!directionLabel && (
            <View style={styles.walkingDirBadge}>
              <Text style={styles.walkingDirText}>{directionLabel}</Text>
            </View>
          )}
        </View>
      </View>
    </Animatable.View>
  );
};

// ── ABD Progress Bar ──────────────────────────────────────────────────────────
const ABDProgressBar: FC<{
  distanceFromLastABD: number;
  abdPending: boolean;
  isTracking: boolean;
}> = ({distanceFromLastABD, abdPending, isTracking}) => {
  if (!isTracking) return null;
  const progress = Math.min(distanceFromLastABD / ABD_SEGMENT_METERS, 1);
  const barColor = abdPending
    ? '#D32F2F'
    : progress >= 0.8
    ? '#FF9800'
    : '#2E7D32';

  return (
    <View style={styles.abdProgressContainer}>
      <View style={styles.abdProgressHeader}>
        <Text style={styles.abdProgressLabel}>
          {abdPending ? '⚠️ ABD Required' : `ABD Distance`}
        </Text>
        <Text style={[styles.abdProgressValue, {color: barColor}]}>
          {distanceFromLastABD.toFixed(1)} / {ABD_SEGMENT_METERS} m
        </Text>
      </View>
      <View style={styles.abdProgressTrack}>
        <View
          style={[
            styles.abdProgressFill,
            {width: `${progress * 100}%`, backgroundColor: barColor},
          ]}
        />
      </View>
      {abdPending && (
        <Text style={styles.abdPendingWarning}>Add ABD before continuing</Text>
      )}
    </View>
  );
};

// ── Persistent shot tracking state (survives navigation) ──────────────────────
type ShotTrackingState = {
  isTracking: boolean;
  startShotLocation: UserCoords;
  lastABDLocation: UserCoords;
  distanceFromLastABD: number;
  abdPending: boolean;
  isAddABDEnabled: boolean;
  abdTriggerCoords: UserCoords;
  walkingBearing: number | null;
  distToDestination: string;
  movementAccumulator: number;
  lastGpsPoint: UserCoords;
  destinationReached: boolean;
  // ── CROSSING STATE (new) ──────────────────────────────────────────────────
  // Tracks whether the user has entered the destination crossing zone
  crossingEntryRecorded: boolean;
  // The minimum distance ever observed to the destination while tracking
  closestDistanceToDestination: number;
};

const shotTrackingCache: Record<string, ShotTrackingState> = {};

// ── Main Screen ───────────────────────────────────────────────────────────────
const ABDMasterScreen: FC<ScreenProps.ABDMasterScreen> = ({
  navigation,
  route,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const pitListLoadedRef = useRef(false);
  //
  const stationaryCountRef = useRef(0);
  const confirmedWalkingRef = useRef(false);
  //
  const abdTriggeredDistanceRef = useRef<number>(0);
  //
  const MIN_WALKING_STEP_M = 3;
  const MIN_TOTAL_MOVEMENT_FOR_TRACKING_M = 5;

  //
  const {
    projectId,
    projectCode,
    spRoute,
    epRoute,
    projectName,
    vendorCode,
    vendorName,
    operatorId,
    machineId,
    locatorId,
    vendorID,
    startPoint,
    endPoint,
  } = route.params;
  const cacheKey = String(projectId);

  const [pitList, setPitList] = useState<PitItem[]>([]);
  // ── ABD Workflow State ────────────────────────────────────────────────────
  const getInitialTrackingState = (): ShotTrackingState =>
    shotTrackingCache[cacheKey] ?? {
      isTracking: false,
      startShotLocation: null,
      lastABDLocation: null,
      distanceFromLastABD: 0,
      abdPending: false,
      isAddABDEnabled: false,
      abdTriggerCoords: null,
      walkingBearing: null,
      distToDestination: '',
      movementAccumulator: 0,
      lastGpsPoint: null,
      destinationReached: false,
      crossingEntryRecorded: false,
      closestDistanceToDestination: Infinity,
    };

  const [isShotTracking, setIsShotTracking] = useState(
    () => getInitialTrackingState().isTracking,
  );
  const [startShotLocation, setStartShotLocation] = useState<UserCoords>(
    () => getInitialTrackingState().startShotLocation,
  );
  const [lastABDLocation, setLastABDLocation] = useState<UserCoords>(
    () => getInitialTrackingState().lastABDLocation,
  );
  //new
  const [abdSectionHeights, setAbdSectionHeights] = useState<
    Record<string, number>
  >({});
  const handleAbdSectionLayout = (id: string, h: number) =>
    setAbdSectionHeights(prev => (prev[id] === h ? prev : {...prev, [id]: h}));
  const [distanceFromLastABD, setDistanceFromLastABD] = useState<number>(
    () => getInitialTrackingState().distanceFromLastABD,
  );
  const [abdPending, setAbdPending] = useState<boolean>(
    () => getInitialTrackingState().abdPending,
  );
  const [isAddABDEnabled, setIsAddABDEnabled] = useState<boolean>(
    () => getInitialTrackingState().isAddABDEnabled,
  );
  const [abdTriggerCoords, setAbdTriggerCoords] = useState<UserCoords>(
    () => getInitialTrackingState().abdTriggerCoords,
  );
  const [walkingBearing, setWalkingBearing] = useState<number | null>(
    () => getInitialTrackingState().walkingBearing,
  );
  const [distToDestination, setDistToDestination] = useState<string>(
    () => getInitialTrackingState().distToDestination,
  );
  const [distanceToDestinationM, setDistanceToDestinationM] =
    useState<number>(Infinity);
  const [destinationReached, setDestinationReached] = useState<boolean>(
    () => getInitialTrackingState().destinationReached,
  );

  // Refs that mirror state for use inside callbacks without stale closures
  const prevDistanceRef = useRef<number>(0);
  const abdWatchIdRef = useRef<number | null>(null);
  const lastABDLocationRef = useRef<UserCoords>(
    getInitialTrackingState().lastABDLocation,
  );
  const abdPendingRef = useRef<boolean>(getInitialTrackingState().abdPending);
  const movementAccumulatorRef = useRef(
    getInitialTrackingState().movementAccumulator,
  );
  const lastGpsPointRef = useRef<UserCoords>(
    getInitialTrackingState().lastGpsPoint,
  );
  const isShotTrackingRef = useRef<boolean>(
    getInitialTrackingState().isTracking,
  );
  const destinationReachedRef = useRef<boolean>(
    getInitialTrackingState().destinationReached,
  );

  // ── CROSSING STATE REFS (new) ─────────────────────────────────────────────
  // crossingEntryRecorded: true once the user has come within CROSSING_ENTRY_RADIUS_M
  // of the destination. Once true, we watch for the distance to grow by
  // CROSSING_EXIT_DELTA_M — that growth means the user has physically walked past.
  const crossingEntryRecordedRef = useRef<boolean>(
    getInitialTrackingState().crossingEntryRecorded,
  );
  // The closest distance we have ever measured to the destination while tracking.
  // Resets when a new shot starts.
  const closestDistanceToDestinationRef = useRef<number>(
    getInitialTrackingState().closestDistanceToDestination,
  );

  // ── Persist tracking state to cache whenever it changes ──────────────────
  const persistTrackingState = useCallback(() => {
    shotTrackingCache[cacheKey] = {
      isTracking: isShotTrackingRef.current,
      startShotLocation: startShotLocation,
      lastABDLocation: lastABDLocationRef.current,
      distanceFromLastABD: movementAccumulatorRef.current,
      abdPending: abdPendingRef.current,
      isAddABDEnabled: isAddABDEnabled,
      abdTriggerCoords: abdTriggerCoords,
      walkingBearing: walkingBearing,
      distToDestination: distToDestination,
      movementAccumulator: movementAccumulatorRef.current,
      lastGpsPoint: lastGpsPointRef.current,
      destinationReached: destinationReachedRef.current,
      crossingEntryRecorded: crossingEntryRecordedRef.current,
      closestDistanceToDestination: closestDistanceToDestinationRef.current,
    };
  }, [
    startShotLocation,
    isAddABDEnabled,
    abdTriggerCoords,
    walkingBearing,
    distToDestination,
  ]);

  // ── Destination PIT ───────────────────────────────────────────────────────
  const getDestinationPit = useCallback((list: PitItem[]): PitItem | null => {
    if (!list || list.length === 0) return null;
    const toPit = list.find(p => p.fromTo === 'To' && p.isShotOpen !== true);
    if (toPit) return toPit;
    const openIdx = list.findIndex(p => p.isShotOpen === true);
    if (openIdx >= 0 && openIdx < list.length - 1) {
      return list[openIdx + 1];
    }
    return null;
  }, []);

  const openShotPit = React.useMemo(
    () => pitList.find(p => p.isShotOpen === true),
    [pitList],
  );
  const openShotVendorId = openShotPit?.vendorId ?? vendorID;
  console.log('openshotId', openShotPit?.vendorId);
  const destinationPit = React.useMemo(
    () => getDestinationPit(pitList),
    [pitList, getDestinationPit],
  );

  const destinationPitRef = useRef<PitItem | null>(null);
  useEffect(() => {
    destinationPitRef.current = destinationPit ?? null;
  }, [destinationPit]);

  // ── CROSSING DETECTION ────────────────────────────────────────────────────
  // Called from processABDCoordinate on every GPS update while tracking.
  //
  // Crossing is defined as:
  //   1. User has come within CROSSING_ENTRY_RADIUS_M of the destination PIT.
  //      (crossingEntryRecorded becomes true, closestDistance is updated)
  //   2. After recording entry, the current distance exceeds
  //      (closestDistance + CROSSING_EXIT_DELTA_M).
  //      This means the user has reached the closest point and is now moving
  //      away — they have physically crossed / passed the destination PIT.
  //
  // Entering the radius alone does NOT trigger crossing.
  // Standing exactly on the destination coords does NOT trigger crossing.
  // Only moving PAST the closest-approach point triggers crossing.
  const checkDestinationCrossed = useCallback(
    (userLat: number, userLng: number) => {
      if (!isShotTrackingRef.current) return;
      if (destinationReachedRef.current) return;

      const dest = destinationPitRef.current;
      if (!dest) return;

      const destLat = parseFloat(dest.lat ?? '0');
      const destLng = parseFloat(dest.lng ?? '0');
      if (isNaN(destLat) || isNaN(destLng) || (destLat === 0 && destLng === 0))
        return;

      const dist = haversineDistance(userLat, userLng, destLat, destLng);

      // Step 1: Update closest-distance tracker
      if (dist < closestDistanceToDestinationRef.current) {
        closestDistanceToDestinationRef.current = dist;
      }

      // Step 2: Record when user first enters the crossing zone
      if (
        !crossingEntryRecordedRef.current &&
        dist <= CROSSING_ENTRY_RADIUS_M
      ) {
        crossingEntryRecordedRef.current = true;
      }

      // Step 3: Crossing is confirmed only after entry has been recorded AND
      //         the user has moved beyond the closest approach by EXIT_DELTA.
      //         This guarantees the user actually walked past the pit.
      if (
        crossingEntryRecordedRef.current &&
        dist > closestDistanceToDestinationRef.current + CROSSING_EXIT_DELTA_M
      ) {
        // User has physically crossed the destination PIT — stop the shot.
        destinationReachedRef.current = true;
        setDestinationReached(true);
        isShotTrackingRef.current = false;
        setIsShotTracking(false);

        if (abdWatchIdRef.current !== null) {
          Geolocation.clearWatch(abdWatchIdRef.current);
          abdWatchIdRef.current = null;
        }

        // Clear persistent cache since the shot is done
        delete shotTrackingCache[cacheKey];

        Alert.alert(
          'Shot Completed',
          `You have crossed PIT - ${displayPitNo(
            dest.pitNo ?? '',
          )}. Shot is now complete.`,
        );
      }
    },
    [cacheKey],
  );

  // ── Update bearing & distance-to-destination while walking ───────────────
  const updateWalkingDirection = useCallback(
    (userLat: number, userLng: number) => {
      const dest = destinationPitRef.current;
      if (!dest) return;

      const destLat = parseFloat(dest.lat ?? '0');
      const destLng = parseFloat(dest.lng ?? '0');

      if (isNaN(destLat) || isNaN(destLng)) return;

      const bearing = getBearing(userLat, userLng, destLat, destLng);
      setWalkingBearing(bearing);

      const dist = haversineDistance(userLat, userLng, destLat, destLng);

      setDistanceToDestinationM(dist);
      setDistToDestination(formatDistance(dist));
    },
    [],
  );

  // ── ABD GPS Tracking ──────────────────────────────────────────────────────
  const processABDCoordinate = useCallback(
    (latitude: number, longitude: number) => {
      if (!isShotTrackingRef.current) return;
      if (destinationReachedRef.current) return;

      // Run crossing check on every GPS update
      checkDestinationCrossed(latitude, longitude);

      // If crossing was just triggered, bail out
      if (destinationReachedRef.current) return;

      updateWalkingDirection(latitude, longitude);

      const currentPoint = {latitude, longitude};

      if (!lastGpsPointRef.current) {
        lastGpsPointRef.current = currentPoint;
        return;
      }

      const stepDistance = haversineDistance(
        lastGpsPointRef.current.latitude,
        lastGpsPointRef.current.longitude,
        latitude,
        longitude,
      );

      // GPS drift ignore
      if (stepDistance < 1.5) return;

      // Unrealistic GPS jump ignore
      if (stepDistance > 15) {
        lastGpsPointRef.current = currentPoint;
        return;
      }

      if (!abdPendingRef.current) {
        movementAccumulatorRef.current += stepDistance;
        setDistanceFromLastABD(movementAccumulatorRef.current);
        if (movementAccumulatorRef.current >= ABD_SEGMENT_METERS) {
          abdTriggeredDistanceRef.current = movementAccumulatorRef.current;

          abdPendingRef.current = true;
          setAbdPending(true);
          setIsAddABDEnabled(true);
          setAbdTriggerCoords({latitude, longitude});

          Alert.alert(
            'ABD Required',
            `You have walked ${movementAccumulatorRef.current.toFixed(
              1,
            )} meters. Please add an ABD before continuing.`,
          );
        }
      }

      lastGpsPointRef.current = currentPoint;

      persistTrackingState();
    },
    [updateWalkingDirection, checkDestinationCrossed, persistTrackingState],
  );

  const startABDGPSWatch = useCallback(() => {
    if (abdWatchIdRef.current !== null) return;
    abdWatchIdRef.current = Geolocation.watchPosition(
      position => {
        const {latitude, longitude, accuracy} = position.coords;
        if (!accuracy || accuracy > 20) return;
        processABDCoordinate(latitude, longitude);
      },
      error => {
        console.warn('[ABD GPS Watch Error]', error.code, error.message);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 1,
        interval: 1000,
        fastestInterval: 500,
        maximumAge: 0,
        timeout: 15000,
      },
    );
  }, [processABDCoordinate]);

  const stopABDGPSWatch = useCallback(() => {
    if (abdWatchIdRef.current !== null) {
      Geolocation.clearWatch(abdWatchIdRef.current);
      abdWatchIdRef.current = null;
    }
  }, []);

  const openShotId = useSelector((state: any) => state.dss?.openShotId);

  // ── Start Shot Handler ────────────────────────────────────────────────────
  const handleStartShot = useCallback(() => {
    getCurrentPosition()
      .then(({latitude, longitude}) => {
        const origin = {latitude, longitude};

        setStartShotLocation(origin);
        setLastABDLocation(origin);
        lastABDLocationRef.current = origin;
        movementAccumulatorRef.current = 0;
        lastGpsPointRef.current = origin;
        setDistanceFromLastABD(0);
        prevDistanceRef.current = 0;
        setAbdPending(false);
        abdPendingRef.current = false;
        setIsAddABDEnabled(false);
        setAbdTriggerCoords(null);
        setDestinationReached(false);
        destinationReachedRef.current = false;
        setIsShotTracking(true);
        isShotTrackingRef.current = true;

        // Reset crossing state for new shot
        crossingEntryRecordedRef.current = false;
        closestDistanceToDestinationRef.current = Infinity;
        // Initial bearing/distance update
        updateWalkingDirection(latitude, longitude);
        // Persist immediately
        shotTrackingCache[cacheKey] = {
          isTracking: true,
          startShotLocation: origin,
          lastABDLocation: origin,
          distanceFromLastABD: 0,
          abdPending: false,
          isAddABDEnabled: false,
          abdTriggerCoords: null,
          walkingBearing: null,
          distToDestination: '',
          movementAccumulator: 0,
          lastGpsPoint: origin,
          destinationReached: false,
          crossingEntryRecorded: false,
          closestDistanceToDestination: Infinity,
        };

        startABDGPSWatch();
      })
      .catch(() => {
        Alert.alert(
          'Location Error',
          'Unable to get your location. Please enable GPS and try again.',
        );
      });
  }, [startABDGPSWatch, updateWalkingDirection, cacheKey]);

  // ── Add ABD Handler ───────────────────────────────────────────────────────
  // const handleAddABD = useCallback(
  //   (pit: PitItem) => {
  //     if (!isAddABDEnabled) return;

  //     const coords = abdTriggerCoords ?? lastGpsPointRef.current;
  //     if (!coords) {
  //       Alert.alert('Location Error', 'GPS coordinates not available.');
  //       return;
  //     }

  //     const dest = destinationPitRef.current;
  //     const toPitLocationID = dest?.pitLocationId ?? null;
  //     const openIdx = pitListRef.current.findIndex(p => p.isShotOpen === true);
  //     const currentPit = openIdx >= 0 ? pitListRef.current[openIdx] : null;
  //     // const orderNumber =
  //     //   (Array.isArray(pit?.abdList) ? pit.abdList.length : 0) + 1;
  //     // const allABDs = pitListRef.current.flatMap(p =>
  //     //   Array.isArray(p.abdList) ? p.abdList : [],
  //     // );
  //     // const orderNumber = allABDs.length + 1;
  //     const segmentABDs = Array.isArray(pit?.abdList) ? pit.abdList : [];
  //     const orderNumber = segmentABDs.length + 1;
  //     persistTrackingState();
  //     navigation.navigate('AddABDMasterScreen', {
  //       vendorID: openShotVendorId,
  //       projectId,
  //       openShotId,
  //       toPitLocationID,
  //       fromPitLocationID: currentPit?.pitLocationId ?? null,
  //       orderNumber,
  //       abdLat: coords.latitude,
  //       abdLng: coords.longitude,
  //       distanceFromLastABD: Number(abdTriggeredDistanceRef.current.toFixed(1)),
  //     });
  //   },
  //   [
  //     isAddABDEnabled,
  //     abdTriggerCoords,
  //     navigation,
  //     vendorID,
  //     projectId,
  //     openShotId,
  //     persistTrackingState,
  //   ],
  // );
  // NAYA
  const handleAddABD = useCallback(
    (pit: PitItem) => {
      if (!isAddABDEnabled) return;

      const coords = abdTriggerCoords ?? lastGpsPointRef.current;
      if (!coords) {
        Alert.alert('Location Error', 'GPS coordinates not available.');
        return;
      }

      const dest = destinationPitRef.current;
      const toPitLocationID = dest?.pitLocationId ?? null;

      const openIdx = pitListRef.current.findIndex(p => p.isShotOpen === true);
      const currentPit = openIdx >= 0 ? pitListRef.current[openIdx] : null;

      const fromId = String(currentPit?.pitLocationId ?? '');
      const toId = String(dest?.pitLocationId ?? '');

      // pitListRef se fresh segment ABDs count karo — pit.abdList stale ho sakti hai
      const segmentABDs = pitListRef.current
        .flatMap((p: PitItem) => (Array.isArray(p.abdList) ? p.abdList : []))
        .filter((abd: any) => {
          const abdFrom = String(
            abd.fromPitLocationID ?? abd.fromPitLocationId ?? '',
          );
          const abdTo = String(
            abd.toPitLocationID ?? abd.toPitLocationId ?? '',
          );
          return (
            (abdFrom === fromId && abdTo === toId) ||
            (abdFrom === toId && abdTo === fromId)
          );
        })
        // Duplicate remove karo — same ABD multiple pits ke abdList mein aa sakta hai
        .filter((abd: any, idx: number, arr: any[]) => {
          const id = abd.abdId ?? abd.abdMasterId ?? abd.id;
          if (!id) return true; // id nahi hai toh dedupe skip
          return (
            arr.findIndex(
              (x: any) => (x.abdId ?? x.abdMasterId ?? x.id) === id,
            ) === idx
          );
        });

      const orderNumber = segmentABDs.length + 1;
      console.log('[handleAddABD] fromId:', fromId, 'toId:', toId);
      console.log(
        '[handleAddABD] segmentABDs count:',
        segmentABDs.length,
        '→ orderNumber:',
        orderNumber,
      );

      persistTrackingState();

      navigation.navigate('AddABDMasterScreen', {
        vendorID: openShotVendorId,
        projectId,
        openShotId,
        toPitLocationID,
        fromPitLocationID: currentPit?.pitLocationId ?? null,
        orderNumber,
        abdLat: coords.latitude,
        abdLng: coords.longitude,
        distanceFromLastABD: Number(abdTriggeredDistanceRef.current.toFixed(1)),
      });
    },
    [
      isAddABDEnabled,
      abdTriggerCoords,
      navigation,
      projectId,
      openShotId,
      persistTrackingState,
      openShotVendorId,
    ],
  );
  const resetABDCounter = useCallback(() => {
    const current = lastGpsPointRef.current;
    if (current) {
      setLastABDLocation(current);
      lastABDLocationRef.current = current;
    }
    movementAccumulatorRef.current = 0;
    setDistanceFromLastABD(0);
    prevDistanceRef.current = 0;
    setAbdPending(false);
    abdPendingRef.current = false;
    setIsAddABDEnabled(false);
    setAbdTriggerCoords(null);

    if (shotTrackingCache[cacheKey]) {
      shotTrackingCache[cacheKey] = {
        ...shotTrackingCache[cacheKey],
        distanceFromLastABD: 0,
        abdPending: false,
        isAddABDEnabled: false,
        abdTriggerCoords: null,
        movementAccumulator: 0,
      };
    }
  }, [cacheKey]);

  const [galleryData, setGalleryData] = useState<GalleryItem | null>(null);
  const [userCoords, setUserCoords] = useState<UserCoords>(null);
  const [isOutOfProject, setIsOutOfProject] = useState(false);
  const [activeBetweenIndex, setActiveBetweenIndex] = useState<number>(-1);
  const pinAnimRef = useRef<any>(null);
  const [userAtLastPit, setUserAtLastPit] = useState<boolean>(false);
  const [pinVisible, setPinVisible] = useState(false);
  const [nearestPitId, setNearestPitId] = useState<string | null>(null);
  const [nearestPitLabel, setNearestPitLabel] = useState<string>('');
  const [nearestPitLabel2, setNearestPitLabel2] = useState<string>('');
  const [nearestPitDistM, setNearestPitDistM] = useState<number>(Infinity);
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});
  const [betweenRowHeights, setBetweenRowHeights] = useState<
    Record<number, number>
  >({});
  const [activePitLoading, setActivePitLoading] = useState(true);
  const [distanceFromLastPit, setDistanceFromLastPit] =
    useState<number>(Infinity);
  const [dashColHeight, setDashColHeight] = useState<number>(0);
  const calledOpenShotIdsRef = useRef<Set<number>>(new Set());
  const watchIdRef = useRef<number | null>(null);
  const toastIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const pitListRef = useRef<PitItem[]>([]);
  const projectEndRef = useRef<{lat: number; lng: number} | null>(null);
  const projectEndAnchorRef = useRef<{lat: number; lng: number} | null>(null);
  const projectStartRef = useRef<{lat: number; lng: number} | null>(null);

  const AT_LAST_PIT_TOL_M = 15;

  const pitSpatialIndexRef = useRef<any[]>([]);
  const lastNearestCheck = useRef(0);
  const findNearestRef = useRef<((lat: number, lng: number) => void) | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [locLoading, setLocLoading] = useState(false);
  const [userPastLastPit, setUserPastLastPit] = useState(false);
  const [betweenPrevDistance, setBetweenPrevDistance] = useState<number | null>(
    null,
  );
  const [betweenNextDistance, setBetweenNextDistance] = useState<number | null>(
    null,
  );
  const [distanceFromProjectEnd, setDistanceFromProjectEnd] =
    useState<number>(0);
  const [isPastProjectEnd, setIsPastProjectEnd] = useState<boolean>(false);
  const getInsertIndex = (
    point: {lat: number; lng: number} | null,
    pits: any[],
  ) => {
    if (!point || pits.length === 0) return -1;
    if (pits.length === 1) return 0;

    let bestIndex = -1;
    let bestScore = Number.MAX_VALUE;

    for (let i = 0; i < pits.length - 1; i++) {
      const a = pits[i];
      const b = pits[i + 1];

      const latA = parseFloat(a.lat);
      const lngA = parseFloat(a.lng);
      const latB = parseFloat(b.lat);
      const lngB = parseFloat(b.lng);

      if (isNaN(latA) || isNaN(lngA) || isNaN(latB) || isNaN(lngB)) {
        continue;
      }

      const {t, perp} = segmentCheck(
        point.lat,
        point.lng,
        latA,
        lngA,
        latB,
        lngB,
      );

      if (t < -0.35 || t > 1.35) continue;

      const tClamp = Math.max(0, Math.min(1, t));

      const projLat = latA + (latB - latA) * tClamp;
      const projLng = lngA + (lngB - lngA) * tClamp;

      const projectionDistance = haversineDistance(
        point.lat,
        point.lng,
        projLat,
        projLng,
      );

      const midDistance = haversineDistance(
        point.lat,
        point.lng,
        (latA + latB) / 2,
        (lngA + lngB) / 2,
      );

      const segmentLength = haversineDistance(latA, lngA, latB, lngB);

      const tPenalty =
        t < 0 ? Math.abs(t) * 40 : t > 1 ? Math.abs(t - 1) * 40 : 0;

      const score =
        projectionDistance * 0.6 +
        perp * 0.2 +
        midDistance * 0.15 +
        tPenalty +
        segmentLength * 0.02;

      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestIndex !== -1) {
      return bestIndex;
    }

    const first = pits[0];
    const last = pits[pits.length - 1];

    const dFirst = haversineDistance(
      point.lat,
      point.lng,
      parseFloat(first.lat),
      parseFloat(first.lng),
    );

    const dLast = haversineDistance(
      point.lat,
      point.lng,
      parseFloat(last.lat),
      parseFloat(last.lng),
    );

    return dFirst <= dLast ? -1 : pits.length - 1;
  };

  const projectStart = React.useMemo(() => {
    if (!startPoint) return null;
    const [lat, lng] = startPoint.split(',').map(Number);
    return {lat, lng};
  }, [startPoint]);

  const projectEnd = React.useMemo(() => {
    if (!endPoint) return null;
    const [lat, lng] = endPoint.split(',').map(Number);
    return {lat, lng};
  }, [endPoint]);

  const startInsertIndex = React.useMemo(
    () => getInsertIndex(projectStart, pitList),
    [projectStart, pitList],
  );

  const endInsertIndex = React.useMemo(
    () => getInsertIndex(projectEnd, pitList),
    [projectEnd, pitList],
  );
  useEffect(() => {
    projectStartRef.current = projectStart;
  }, [projectStart]);

  useEffect(() => {
    projectEndRef.current = projectEnd;

    if (!projectEnd || !pitList?.length) {
      projectEndAnchorRef.current = null;
      return;
    }

    const anchorIdx = endInsertIndex >= 0 ? endInsertIndex : pitList.length - 1;

    if (anchorIdx < 0 || anchorIdx >= pitList.length) {
      projectEndAnchorRef.current = null;
      return;
    }

    const anchor = pitList[anchorIdx];
    const aLat = parseFloat(anchor?.lat ?? '0');
    const aLng = parseFloat(anchor?.lng ?? '0');

    if (isNaN(aLat) || isNaN(aLng) || (aLat === 0 && aLng === 0)) {
      projectEndAnchorRef.current = null;
      return;
    }

    projectEndAnchorRef.current = {lat: aLat, lng: aLng};
  }, [projectEnd, pitList, endInsertIndex]);
  useEffect(() => {
    projectEndRef.current = projectEnd;

    if (!projectEnd || !pitList?.length) {
      projectEndAnchorRef.current = null;
      return;
    }

    const anchorIdx = endInsertIndex >= 0 ? endInsertIndex : pitList.length - 1;

    if (anchorIdx < 0 || anchorIdx >= pitList.length) {
      projectEndAnchorRef.current = null;
      return;
    }

    const anchor = pitList[anchorIdx];
    const aLat = parseFloat(anchor?.lat ?? '0');
    const aLng = parseFloat(anchor?.lng ?? '0');

    if (isNaN(aLat) || isNaN(aLng) || (aLat === 0 && aLng === 0)) {
      projectEndAnchorRef.current = null;
      return;
    }

    projectEndAnchorRef.current = {lat: aLat, lng: aLng};
  }, [projectEnd, pitList, endInsertIndex]);
  const pendingDistanceLabel = React.useMemo(() => {
    if (!pitList || pitList.length < 2) return '0 m';
    let totalMeters = 0;
    for (let i = 0; i < pitList.length - 1; i++) {
      const currentPit = pitList[i];
      const nextPit = pitList[i + 1];
      const isCompleted =
        currentPit?.shotStatus2?.trim()?.toLowerCase() === 'done' &&
        nextPit?.shotStatus2?.trim()?.toLowerCase() === 'done';
      if (!isCompleted) {
        const lat1 = parseFloat(currentPit?.lat ?? '0');
        const lng1 = parseFloat(currentPit?.lng ?? '0');
        const lat2 = parseFloat(nextPit?.lat ?? '0');
        const lng2 = parseFloat(nextPit?.lng ?? '0');
        if (
          !isNaN(lat1) &&
          !isNaN(lng1) &&
          !isNaN(lat2) &&
          !isNaN(lng2) &&
          !(lat1 === 0 && lng1 === 0) &&
          !(lat2 === 0 && lng2 === 0)
        ) {
          totalMeters += haversineDistance(lat1, lng1, lat2, lng2);
        }
      }
    }
    return formatDistance(totalMeters);
  }, [pitList]);

  const isUserAtOrPastLastPit = (
    userLat: number,
    userLng: number,
    list: any[],
  ): boolean => {
    if (!list || list.length === 0) return false;
    const lastPit = list[list.length - 1];
    const prevPit = list.length > 1 ? list[list.length - 2] : null;
    const lastLat = parseFloat(lastPit?.lat ?? '0');
    const lastLng = parseFloat(lastPit?.lng ?? '0');
    if (isNaN(lastLat) || isNaN(lastLng)) return false;
    const dist = haversineDistance(userLat, userLng, lastLat, lastLng);
    if (dist <= 10) return true;
    if (prevPit) {
      const prevLat = parseFloat(prevPit?.lat ?? '0');
      const prevLng = parseFloat(prevPit?.lng ?? '0');
      if (!isNaN(prevLat) && !isNaN(prevLng)) {
        const {t} = segmentCheck(
          userLat,
          userLng,
          prevLat,
          prevLng,
          lastLat,
          lastLng,
        );
        if (t > 0.95) return true;
      }
    }
    return false;
  };

  const updateLocationStateRef = useRef<
    ((lat: number, lng: number) => void) | null
  >(null);
  const isLoadingRef = useRef(true);
  const userCoordsRef = useRef<UserCoords>(null);

  useEffect(() => {
    pitListRef.current = pitList;
    pitSpatialIndexRef.current = pitList.map(p => ({
      ...p,
      latNum: parseFloat(p?.lat ?? '0'),
      lngNum: parseFloat(p?.lng ?? '0'),
    }));
  }, [pitList]);

  useEffect(() => {
    console.log('OPEN SHOT DATA ===>', JSON.stringify(openShotId, null, 2));
  }, [openShotId]);

  useEffect(() => {
    userCoordsRef.current = userCoords;
  }, [userCoords]);

  const getNearestPitDistance = (userLat: number, userLng: number) => {
    const pits = pitSpatialIndexRef.current;
    let min = Infinity;
    for (let i = 0; i < pits.length; i++) {
      const lat = pits[i].latNum;
      const lng = pits[i].lngNum;
      if (!lat || !lng) continue;
      const d = haversineDistance(userLat, userLng, lat, lng);
      if (d < min) {
        min = d;
        if (min < 6) break;
      }
    }
    return min;
  };
  const handleViewOnMap = async (
    lat: string | number | undefined,
    lng: string | number | undefined,
    pitNo: string,
  ) => {
    const pitLat = parseFloat(String(lat ?? '0'));
    const pitLng = parseFloat(String(lng ?? '0'));

    if (isNaN(pitLat) || isNaN(pitLng) || (pitLat === 0 && pitLng === 0)) {
      Alert.alert('Invalid Location', 'Pit coordinates are not available.');
      return;
    }

    try {
      // Get current location
      const {latitude, longitude} = await getCurrentPosition();

      // Build the URL for navigation
      const url =
        Platform.OS === 'ios'
          ? `http://maps.apple.com/?saddr=${latitude},${longitude}&daddr=${pitLat},${pitLng}&dirflg=d`
          : `https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${pitLat},${pitLng}&travelmode=driving`;

      // Check if the URL can be opened
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
      } else {
        // Fallback to web
        const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${pitLat},${pitLng}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback: Open maps with just the destination
      try {
        const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${pitLat},${pitLng}`;
        await Linking.openURL(fallbackUrl);
      } catch (e) {
        Alert.alert(
          'Navigation Error',
          'Unable to open maps. Please try again later.',
        );
      }
    }
  };
  const updateLocationState = useCallback((lat: number, lng: number) => {
    if (lat === 0 && lng === 0) return;
    const list = pitListRef.current;
    if (!list?.length) return;

    const last = list[list.length - 1];
    const lastLat = parseFloat(last?.lat ?? '0');
    const lastLng = parseFloat(last?.lng ?? '0');
    let distFromLast = Infinity;
    if (!isNaN(lastLat) && !isNaN(lastLng)) {
      distFromLast = haversineDistance(lat, lng, lastLat, lastLng);
    }
    setDistanceFromLastPit(distFromLast);
    const pEnd = projectEndRef.current;

    if (pEnd) {
      const distToEnd = haversineDistance(lat, lng, pEnd.lat, pEnd.lng);
      setDistanceFromProjectEnd(distToEnd);

      const anchor = projectEndAnchorRef.current;

      if (anchor) {
        const {t} = segmentCheck(
          lat,
          lng,
          anchor.lat,
          anchor.lng,
          pEnd.lat,
          pEnd.lng,
        );
        setIsPastProjectEnd(t > 1);
      } else {
        setIsPastProjectEnd(false);
      }
    } else {
      setDistanceFromProjectEnd(0);
      setIsPastProjectEnd(false);
    }
    if (distFromLast > 500) {
      setIsOutOfProject(true);
      setActiveBetweenIndex(-1);
      setUserAtLastPit(false);
      setBetweenPrevDistance(null);
      setBetweenNextDistance(null);
      return;
    } else {
      setIsOutOfProject(false);
    }

    const nearestDist = getNearestPitDistance(lat, lng);
    if (nearestDist < 30) {
      if (distFromLast <= AT_LAST_PIT_TOL_M) {
        setUserAtLastPit(true);
      } else {
        setUserAtLastPit(false);
      }
      setActiveBetweenIndex(-1);
      setBetweenPrevDistance(null);
      setBetweenNextDistance(null);
      return;
    }

    const atLast = isUserAtOrPastLastPit(lat, lng, list);
    if (atLast) {
      setUserAtLastPit(true);
      setActiveBetweenIndex(-1);
      setBetweenPrevDistance(null);
      setBetweenNextDistance(null);
      return;
    }
    setUserAtLastPit(false);

    const betweenIndex = findActiveBetweenIndex(lat, lng, list);
    if (betweenIndex >= 0) {
      const prevPitItem = list[betweenIndex];
      const nextPitItem = list[betweenIndex + 1];

      const prevLat = parseFloat(prevPitItem?.lat ?? '0');
      const prevLng = parseFloat(prevPitItem?.lng ?? '0');
      const nextLat = parseFloat(nextPitItem?.lat ?? '0');
      const nextLng = parseFloat(nextPitItem?.lng ?? '0');

      if (
        !isNaN(prevLat) &&
        !isNaN(prevLng) &&
        (prevLat !== 0 || prevLng !== 0)
      ) {
        setBetweenPrevDistance(haversineDistance(lat, lng, prevLat, prevLng));
      } else {
        setBetweenPrevDistance(null);
      }

      if (
        !isNaN(nextLat) &&
        !isNaN(nextLng) &&
        (nextLat !== 0 || nextLng !== 0)
      ) {
        setBetweenNextDistance(haversineDistance(lat, lng, nextLat, nextLng));
      } else {
        setBetweenNextDistance(null);
      }

      setActiveBetweenIndex(betweenIndex);
      setUserAtLastPit(false);
      return;
    }
    setBetweenPrevDistance(null);
    setBetweenNextDistance(null);
    setActiveBetweenIndex(prev =>
      prev === betweenIndex ? prev : betweenIndex,
    );
  }, []);

  useEffect(() => {
    updateLocationStateRef.current = updateLocationState;
  }, [updateLocationState]);

  const startGPSWatch = useCallback(() => {
    if (watchIdRef.current !== null) return;
    watchIdRef.current = Geolocation.watchPosition(
      position => {
        const {latitude, longitude, accuracy} = position.coords;
        if (!accuracy || accuracy > 35) return;
        setUserCoords(prev => {
          const smooth = smoothCoords(prev, {latitude, longitude});
          updateLocationStateRef.current?.(smooth.latitude, smooth.longitude);
          findNearestRef.current?.(smooth.latitude, smooth.longitude);
          return smooth;
        });
      },
      error => {
        console.warn('[GPS Watch Error]', error.code, error.message);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 2,
        interval: 1000,
        fastestInterval: 800,
        maximumAge: 0,
        timeout: 15000,
      },
    );
  }, []);

  const stopGPSWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (toastIntervalRef.current) {
      clearInterval(toastIntervalRef.current);
      toastIntervalRef.current = null;
    }
  }, []);

  const findNearest = useCallback((latitude: number, longitude: number) => {
    const now = Date.now();
    if (now - lastNearestCheck.current < 800) return;
    lastNearestCheck.current = now;
    if (!latitude || !longitude || (latitude === 0 && longitude === 0)) return;
    const list = pitListRef.current;
    if (!list || list.length === 0) return;
    let minDist = Infinity;
    let closestId: string | null = null;
    let closestLabel = '';
    let closestLabel2 = '';
    list.forEach(item => {
      const pLat = parseFloat(item?.lat ?? '0');
      const pLng = parseFloat(item?.lng ?? '0');
      if (!isNaN(pLat) && !isNaN(pLng) && (pLat !== 0 || pLng !== 0)) {
        const d = haversineDistance(latitude, longitude, pLat, pLng);
        if (d < minDist) {
          minDist = d;
          closestId = String(item?.pitLocationId ?? item?.pitNo ?? '');
          closestLabel = `PIT - ${displayPitNo(item?.pitNo ?? '')}  (${
            d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`
          } away)`;
          closestLabel2 = `PIT - ${displayPitNo(item?.pitNo ?? '')}\n${
            d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(1)}km`
          }\naway`;
        }
      }
    });
    if (closestId) {
      setNearestPitId(closestId);
      setNearestPitLabel(closestLabel);
      setNearestPitLabel2(closestLabel2);
      setNearestPitDistM(minDist);
      setPinVisible(true);
    }
  }, []);

  useEffect(() => {
    findNearestRef.current = findNearest;
  }, [findNearest]);
  //working
  // const fetchPitList = useCallback(async () => {
  //   try {
  //     isLoadingRef.current = true;
  //     setIsLoading(true);
  //     setActivePitLoading(true);

  //     pitListLoadedRef.current = false;

  //     const result = await dispatch(
  //       getPitListwithABDShotStatus({projectId}),
  //     ).unwrap();

  //     console.log('FULL RESPONSE ====', JSON.stringify(result, null, 2));

  //     let newList: PitItem[] = [];

  //     if (Array.isArray(result)) {
  //       newList = result;
  //     } else if (Array.isArray(result?.data?.pitLocationList)) {
  //       const pitLocationList = result.data.pitLocationList || [];
  //       const abdList = result.data._ABDList || [];

  //       console.log(
  //         'PIT ORDER ====',
  //         pitLocationList.map((x: any) => x.pitLocationId),
  //       );

  //       newList = pitLocationList.map((pit: any, index: number) => {
  //         const nextPit = pitLocationList[index + 1];
  //         return {
  //           ...pit,
  //           abdList: abdList.filter((abd: any) => {
  //             const fromId = String(
  //               abd.fromPitLocationID ?? abd.fromPitLocationId,
  //             );
  //             const toId = String(abd.toPitLocationID ?? abd.toPitLocationId);
  //             return (
  //               String(pit.pitLocationId) === toId &&
  //               String(nextPit?.pitLocationId ?? '') === fromId
  //             );
  //           }),
  //         };
  //       });
  //     } else if (Array.isArray(result?.pitLocationList)) {
  //       const pitLocationList = result.pitLocationList || [];
  //       const abdList = result._ABDList || [];

  //       console.log(
  //         'PIT ORDER ====',
  //         pitLocationList.map((x: any) => x.pitLocationId),
  //       );

  //       newList = pitLocationList.map((pit: any, index: number) => {
  //         const nextPit = pitLocationList[index + 1];
  //         return {
  //           ...pit,
  //           abdList: abdList.filter((abd: any) => {
  //             const fromId = String(
  //               abd.fromPitLocationID ?? abd.fromPitLocationId,
  //             );
  //             const toId = String(abd.toPitLocationID ?? abd.toPitLocationId);
  //             return (
  //               String(pit.pitLocationId) === toId &&
  //               String(nextPit?.pitLocationId ?? '') === fromId
  //             );
  //           }),
  //         };
  //       });
  //     }

  //     console.log('FINAL PIT LIST ====', JSON.stringify(newList, null, 2));

  //     setPitList(newList);
  //     pitListRef.current = newList;

  //     if (newList.length > 0) {
  //       pitListLoadedRef.current = true;

  //       const coords = userCoordsRef.current;
  //       if (coords) {
  //         updateLocationStateRef.current?.(coords.latitude, coords.longitude);
  //         lastNearestCheck.current = 0;
  //         findNearestRef.current?.(coords.latitude, coords.longitude);
  //       }

  //       const openShotPits = newList.filter(p => p.isShotOpen === true);
  //       openShotPits.forEach(p => {
  //         if (!calledOpenShotIdsRef.current.has(p.pitLocationId)) {
  //           calledOpenShotIdsRef.current.add(p.pitLocationId);
  //           dispatch(
  //             getOpenShotDetailsByIdAPI({
  //               pitLocationId: p.pitLocationId,
  //             }),
  //           );
  //         }
  //       });
  //     } else {
  //       pitListLoadedRef.current = false;
  //     }
  //   } catch (error) {
  //     console.error('Failed to fetch pit list:', error);
  //     setPitList([]);
  //     pitListRef.current = [];
  //     pitListLoadedRef.current = false;
  //   } finally {
  //     isLoadingRef.current = false;
  //     setIsLoading(false);
  //     setActivePitLoading(false);
  //   }
  // }, [dispatch, projectId]);
  const fetchPitList = useCallback(async () => {
    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      setActivePitLoading(true);

      pitListLoadedRef.current = false;

      const result = await dispatch(
        getPitListwithABDShotStatus({projectId}),
      ).unwrap();

      console.log('FULL RESPONSE ====', JSON.stringify(result, null, 2));

      let newList: PitItem[] = [];

      const buildPitList = (
        pitLocationList: any[] = [],
        abdList: any[] = [],
      ) => {
        console.log(
          'PIT ORDER ====',
          pitLocationList.map((x: any) => x.pitLocationId),
        );

        return pitLocationList.map((pit: any, index: number) => {
          const nextPit = pitLocationList[index + 1];

          const currentPitId = String(pit.pitLocationId);
          const nextPitId = String(nextPit?.pitLocationId ?? '');

          return {
            ...pit,
            abdList: abdList.filter((abd: any) => {
              const fromId = String(
                abd.fromPitLocationID ?? abd.fromPitLocationId,
              );
              const toId = String(abd.toPitLocationID ?? abd.toPitLocationId);
              // ABD current pit aur next pit ke beech ka hai
              // return currentPitId === fromId && nextPitId === toId;
              return (
                (currentPitId === fromId && nextPitId === toId) ||
                (currentPitId === toId && nextPitId === fromId)
              );
            }),
          };
        });
      };

      if (Array.isArray(result)) {
        newList = result;
      } else if (Array.isArray(result?.data?.pitLocationList)) {
        newList = buildPitList(
          result.data.pitLocationList || [],
          result.data._ABDList || [],
        );
      } else if (Array.isArray(result?.pitLocationList)) {
        newList = buildPitList(
          result.pitLocationList || [],
          result._ABDList || [],
        );
      }

      console.log('FINAL PIT LIST ====', JSON.stringify(newList, null, 2));

      setPitList(newList);
      pitListRef.current = newList;

      if (newList.length > 0) {
        pitListLoadedRef.current = true;

        const coords = userCoordsRef.current;

        if (coords) {
          updateLocationStateRef.current?.(coords.latitude, coords.longitude);

          lastNearestCheck.current = 0;

          findNearestRef.current?.(coords.latitude, coords.longitude);
        }

        const openShotPits = newList.filter(p => p.isShotOpen === true);

        openShotPits.forEach(p => {
          if (!calledOpenShotIdsRef.current.has(p.pitLocationId)) {
            calledOpenShotIdsRef.current.add(p.pitLocationId);

            dispatch(
              getOpenShotDetailsByIdAPI({
                pitLocationId: p.pitLocationId,
              }),
            );
          }
        });
      } else {
        pitListLoadedRef.current = false;
      }
    } catch (error) {
      console.error('Failed to fetch pit list:', error);

      setPitList([]);
      pitListRef.current = [];
      pitListLoadedRef.current = false;
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
      setActivePitLoading(false);
    }
  }, [dispatch, projectId]);

  const fetchPitListRef = useRef(fetchPitList);
  useEffect(() => {
    fetchPitListRef.current = fetchPitList;
  }, [fetchPitList]);

  const initGPS = useCallback(() => {
    getCurrentPosition()
      .then(({latitude, longitude}) => {
        setUserCoords({latitude, longitude});
        userCoordsRef.current = {latitude, longitude};
        updateLocationState(latitude, longitude);
        lastNearestCheck.current = 0;
        findNearest(latitude, longitude);
      })
      .catch(() => {});
  }, [updateLocationState, findNearest]);

  const initGPSRef = useRef(initGPS);
  useEffect(() => {
    initGPSRef.current = initGPS;
  }, [initGPS]);
  // //old
  useFocusEffect(
    useCallback(() => {
      startGPSWatch();
      fetchPitListRef.current?.();
      initGPSRef.current?.();
      // Reset UI state on every focus
      setDistanceFromLastABD(0);
      setAbdPending(false);
      setIsAddABDEnabled(false);
      movementAccumulatorRef.current = 0;
      abdPendingRef.current = false;
      lastGpsPointRef.current = null;
      // Reset tracking state on focus so Start Shot is always shown fresh
      setIsShotTracking(false);
      isShotTrackingRef.current = false;
      return () => {
        stopGPSWatch();
        stopABDGPSWatch();
      };
    }, [startGPSWatch, stopGPSWatch, stopABDGPSWatch]),
  );
  // NAYA
  // useFocusEffect(
  //   useCallback(() => {
  //     startGPSWatch();
  //     fetchPitListRef.current?.();
  //     initGPSRef.current?.();

  //     // Sirf tab reset karo jab tracking active NA ho
  //     if (!isShotTrackingRef.current) {
  //       setDistanceFromLastABD(0);
  //       setAbdPending(false);
  //       setIsAddABDEnabled(false);
  //       movementAccumulatorRef.current = 0;
  //       abdPendingRef.current = false;
  //       lastGpsPointRef.current = null;
  //       setIsShotTracking(false);
  //       isShotTrackingRef.current = false;
  //     }

  //     // Agar tracking chal rahi thi toh ABD GPS watch resume karo
  //     if (isShotTrackingRef.current) {
  //       startABDGPSWatch();
  //     }

  //     return () => {
  //       stopGPSWatch();
  //       stopABDGPSWatch();
  //     };
  //   }, [startGPSWatch, stopGPSWatch, stopABDGPSWatch, startABDGPSWatch]),
  // );
  // FIND:
  // useFocusEffect(
  //   useCallback(() => {
  //     startGPSWatch();
  //     fetchPitListRef.current?.();
  //     initGPSRef.current?.();
  //     // Sirf tab reset karo jab tracking active NA ho
  //     if (!isShotTrackingRef.current) {
  //       setDistanceFromLastABD(0);
  //       setAbdPending(false);
  //       setIsAddABDEnabled(false);
  //       movementAccumulatorRef.current = 0;
  //       abdPendingRef.current = false;
  //       lastGpsPointRef.current = null;
  //       setIsShotTracking(false);
  //       isShotTrackingRef.current = false;
  //     }
  //     // Agar tracking chal rahi thi toh ABD GPS watch resume karo
  //     if (isShotTrackingRef.current) {
  //       startABDGPSWatch();
  //     }
  //     return () => {
  //       stopGPSWatch();
  //       stopABDGPSWatch();
  //     };
  //   }, [startGPSWatch, stopGPSWatch, stopABDGPSWatch, startABDGPSWatch]),
  // );

  // REPLACE WITH:
  // const isFirstFocusRef = useRef(true);

  // useFocusEffect(
  //   useCallback(() => {
  //     startGPSWatch();
  //     initGPSRef.current?.();

  //     if (isFirstFocusRef.current) {
  //       // Sirf pehli baar fetch karo
  //       isFirstFocusRef.current = false;
  //       fetchPitListRef.current?.();

  //       // Pehli baar hi reset karo tracking nahi chal rahi toh
  //       if (!isShotTrackingRef.current) {
  //         setDistanceFromLastABD(0);
  //         setAbdPending(false);
  //         setIsAddABDEnabled(false);
  //         movementAccumulatorRef.current = 0;
  //         abdPendingRef.current = false;
  //         lastGpsPointRef.current = null;
  //         setIsShotTracking(false);
  //         isShotTrackingRef.current = false;
  //       }
  //     } else {
  //       // AddABDMasterScreen se wapas aaye — sirf ABD counter reset karo
  //       // pitList fetch mat karo, tracking state mat chedo
  //       resetABDCounter();
  //     }

  //     // Tracking chal rahi hai toh GPS watch resume karo
  //     if (isShotTrackingRef.current) {
  //       startABDGPSWatch();
  //     }

  //     return () => {
  //       stopGPSWatch();
  //       stopABDGPSWatch();
  //     };
  //   }, [
  //     startGPSWatch,
  //     stopGPSWatch,
  //     stopABDGPSWatch,
  //     startABDGPSWatch,
  //     resetABDCounter,
  //   ]),
  // );

  // const isFirstFocusRef = useRef(true);

  // useFocusEffect(
  //   useCallback(() => {
  //     startGPSWatch();
  //     initGPSRef.current?.();

  //     if (isFirstFocusRef.current) {
  //       isFirstFocusRef.current = false;

  //       fetchPitListRef.current?.();

  //       if (!isShotTrackingRef.current) {
  //         setDistanceFromLastABD(0);
  //         setAbdPending(false);
  //         setIsAddABDEnabled(false);
  //         movementAccumulatorRef.current = 0;
  //         abdPendingRef.current = false;
  //         lastGpsPointRef.current = null;
  //         setIsShotTracking(false);
  //         isShotTrackingRef.current = false;
  //       }
  //     } else {
  //       resetABDCounter();
  //     }

  //     if (isShotTrackingRef.current) {
  //       startABDGPSWatch();
  //     }

  //     return () => {
  //       stopGPSWatch();
  //       stopABDGPSWatch();
  //     };
  //   }, [
  //     startGPSWatch,
  //     stopGPSWatch,
  //     stopABDGPSWatch,
  //     startABDGPSWatch,
  //     resetABDCounter,
  //   ]),
  // );
  useEffect(() => {
    if (userCoords && pitListRef.current.length > 0)
      updateLocationState(userCoords.latitude, userCoords.longitude);
  }, [userCoords]); // eslint-disable-line

  useEffect(() => {
    if (pitList && pitList.length > 0) {
      const coords = userCoordsRef.current;
      if (coords) {
        updateLocationState(coords.latitude, coords.longitude);
        lastNearestCheck.current = 0;
        findNearestRef.current?.(coords.latitude, coords.longitude);
      } else {
        getCurrentPosition()
          .then(({latitude, longitude}) => {
            setUserCoords({latitude, longitude});
            updateLocationState(latitude, longitude);
            lastNearestCheck.current = 0;
            findNearestRef.current?.(latitude, longitude);
          })
          .catch(() => {});
      }
    }
  }, [pitList]); // eslint-disable-line

  useEffect(() => {
    setTimeout(() => {
      if (pinAnimRef.current) {
        if (activeBetweenIndex >= 0) pinAnimRef.current.pulse?.(500);
        else pinAnimRef.current.rubberBand?.(600);
      }
    }, 150);
  }, [activeBetweenIndex]);

  useEffect(() => {
    if (!isLoading) setActivePitLoading(false);
  }, [isLoading]);

  const handleWhereAmI = useCallback(() => {
    if (isLoadingRef.current) return;
    if (!pitListRef.current || pitListRef.current.length === 0) return;
    setLocLoading(true);
    getCurrentPosition()
      .then(({latitude, longitude}) => {
        setUserCoords({latitude, longitude});
        userCoordsRef.current = {latitude, longitude};
        updateLocationState(latitude, longitude);
        setLocLoading(false);
        lastNearestCheck.current = 0;
        findNearest(latitude, longitude);
      })
      .catch(() => {
        setLocLoading(false);
        Alert.alert(
          'Location Error',
          'Unable to get your location.\n\nPlease enable GPS.',
        );
      });
  }, [updateLocationState, findNearest]);
  const handlePitPress = (pit: PitItem, pitIndex: number) => {
    const isNearest =
      String(pit?.pitLocationId ?? pit?.pitNo ?? '') === activeHereCardId;
    if (!isNearest) return;
    // const isNearest = true;//for testing
    const clickState = getPitClickState(pitList, pitIndex);
    if (clickState === 'not-clickable') return;
    if (clickState === 'clickable-to' && !openShotId) {
      Alert.alert('Shot Error', 'Open shot id not available');
      return;
    }
    const rawUserLat = userCoordsRef.current?.latitude ?? 0;
    const rawUserLng = userCoordsRef.current?.longitude ?? 0;
    const startPit = pit;
    const isLastPit = pitIndex === pitList.length - 1;
    const nextPitIndex = isLastPit ? pitIndex - 1 : pitIndex + 1;
    const nextPit = pitList[nextPitIndex] ?? null;
    const prevPitIndex = pitIndex - 1;
    const prevPit = prevPitIndex >= 0 ? pitList[prevPitIndex] ?? null : null;
    const lastPit = pitList[pitList.length - 1];

    const startLat = safeCoord(startPit?.lat);
    const startLng = safeCoord(startPit?.lng);
    const nextLat = safeCoord(nextPit?.lat);
    const nextLng = safeCoord(nextPit?.lng);
    const lastLat = safeCoord(lastPit?.lat);
    const lastLng = safeCoord(lastPit?.lng);
    const prevLat = safeCoord(prevPit?.lat);
    const prevLng = safeCoord(prevPit?.lng);

    const uLat: number | null =
      rawUserLat !== 0 || rawUserLng !== 0 ? rawUserLat : null;
    const uLng: number | null =
      rawUserLat !== 0 || rawUserLng !== 0 ? rawUserLng : null;
    const distanceFromPrevPit: number | null = safeDistance(
      prevLat,
      prevLng,
      startLat,
      startLng,
    );
    const distanceFromPrevPitLabel: string =
      distanceFromPrevPit !== null ? formatDistance(distanceFromPrevPit) : '';
    let distanceBetweenPits: number | null = null;
    let distanceBetweenPitsLabel = '';
    if (isLastPit) {
      distanceBetweenPits = 0;
      distanceBetweenPitsLabel = '0 m';
    } else {
      let totalMeters = 0;
      let allValid = true;
      for (let i = pitIndex; i < pitList.length - 1; i++) {
        const aLat = safeCoord(pitList[i]?.lat);
        const aLng = safeCoord(pitList[i]?.lng);
        const bLat = safeCoord(pitList[i + 1]?.lat);
        const bLng = safeCoord(pitList[i + 1]?.lng);
        const segDist = safeDistance(aLat, aLng, bLat, bLng);
        if (segDist === null) {
          allValid = false;
          break;
        }
        totalMeters += segDist;
      }
      if (allValid) {
        distanceBetweenPits = totalMeters;
        distanceBetweenPitsLabel = formatDistance(totalMeters);
      }
    }
    const distanceFromStartPit: string | null =
      safeDistanceLabel(uLat, uLng, startLat, startLng) || null;
    const distanceFromEndPit: string | null =
      safeDistanceLabel(uLat, uLng, lastLat, lastLng) || null;
    if (clickState === 'clickable-from') {
      navigation.navigate('AddInstallationFrom', {
        pitLocationId: startPit.pitLocationId,
        pitNo: startPit.pitNo,
        startPitId: startPit.pitLocationId,
        startPitNo: startPit.pitNo,
        startPitLat: startLat,
        startPitLng: startLng,
        endPitId: nextPit?.pitLocationId ?? 0,
        endPitNo: nextPit?.pitNo ?? '',
        endPitLat: nextLat,
        endPitLng: nextLng,
        lastPitId: lastPit?.pitLocationId ?? 0,
        lastPitNo: lastPit?.pitNo ?? '',
        lastPitLat: lastLat,
        lastPitLng: lastLng,
        prevPitId: prevPit?.pitLocationId ?? null,
        prevPitNo: prevPit?.pitNo ?? null,
        prevPitLat: prevLat,
        prevPitLng: prevLng,
        operatorId,
        locatorId,
        machineId,
        distanceFromPrevPit,
        distanceFromPrevPitLabel,
        distanceBetweenPits,
        distanceBetweenPitsLabel,
        distanceFromStartPit,
        distanceFromEndPit,
        userLat: rawUserLat,
        userLng: rawUserLng,
        projectId,
        projectName,
        projectCode,
        vendorName,
        vendorCode: vendorCode ?? '',
        epRoute:
          typeof epRoute === 'object'
            ? (epRoute as any)?.address ?? ''
            : epRoute ?? '',
        spRoute:
          typeof spRoute === 'object'
            ? (spRoute as any)?.address ?? ''
            : spRoute ?? '',
      });
    } else if (clickState === 'clickable-to') {
      const openShotPit = pitList.find(p => p.isShotOpen === true);
      if (!openShotPit) {
        Alert.alert('Error', 'Open shot PIT not found');
        return;
      }
      const fromLat = safeCoord(openShotPit?.lat);
      const fromLng = safeCoord(openShotPit?.lng);
      const toLat = safeCoord(pit?.lat);
      const toLng = safeCoord(pit?.lng);
      const distanceFromToPit = safeDistance(fromLat, fromLng, toLat, toLng);
      const distanceFromToPitLabel =
        distanceFromToPit !== null ? formatDistance(distanceFromToPit) : '';

      navigation.navigate('AddInstallationToScreen', {
        projectId,
        toPitLocationId: pit.pitLocationId,
        openShotId,
        toPitNo: pit.pitNo,
        distanceFromToPit,
        distanceFromToPitLabel,
        ductCountData: pit?.numberOfDucts ?? null,
      });
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const nearestIndex =
    pitList && nearestPitId
      ? pitList.findIndex(
          item =>
            String(item?.pitLocationId ?? item?.pitNo ?? '') === nearestPitId,
        )
      : -1;

  const activeHereCardId: string | null = (() => {
    if (!pitList || pitList.length === 0) return null;
    if (nearestPitDistM > YOU_ARE_HERE_THRESHOLD_M) return null;
    return nearestPitId;
  })();
  // useEffect(() => {
  //   if (!pitList?.length) return;

  //   const timer = setTimeout(() => {
  //     const pinY = getAccuratePinTop();

  //     if (pinY < 0) return;

  //     // Active PIT ko screen ke center me lao
  //     const targetY = Math.max(0, pinY - SCREEN_HEIGHT / 2);

  //     scrollViewRef.current?.scrollTo({
  //       y: targetY,
  //       animated: true,
  //     });
  //   }, 250);

  //   return () => clearTimeout(timer);
  // }, [
  //   activeBetweenIndex,
  //   userAtLastPit,
  //   nearestPitId,
  //   cardHeights,
  //   betweenRowHeights,
  //   pitList,
  // ]);
  useEffect(() => {
    if (!pitList?.length) return;
    const timer = setTimeout(() => {
      const y = getAccuratePinTop();
      if (y >= 0) {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, y - 10),
          animated: true,
        });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [
    activeBetweenIndex,
    userAtLastPit,
    nearestPitId,
    cardHeights,
    betweenRowHeights,
    abdSectionHeights, // ADD
    pitList,
  ]);
  // ── Pin top calculation ───────────────────────────────────────────────────
  const getAccuratePinTop = (): number => {
    if (!pitList || pitList.length === 0) return -999;

    const topBeforeCard = (targetIdx: number): number => {
      let top = 0;
      for (let i = 0; i < targetIdx; i++) {
        const id = String(pitList[i]?.pitLocationId ?? pitList[i]?.pitNo ?? i);
        top += (cardHeights[id] ?? 110) + CARD_GAP;
        top += abdSectionHeights[id] ?? 0; // ADD — ABD block ki height
        const bh = betweenRowHeights[i] ?? BETWEEN_ROW_H;
        top += bh + CARD_GAP;
      }
      return top;
    };
    const cardCenterTop = (targetIdx: number): number => {
      const top = topBeforeCard(targetIdx);
      const selId = String(
        pitList[targetIdx]?.pitLocationId ??
          pitList[targetIdx]?.pitNo ??
          targetIdx,
      );
      const cardHeight = cardHeights[selId] ?? 110;
      return top + cardHeight / 2 - PIN_SIZE / 2;
    };

    const betweenCenterTop = (segIdx: number): number => {
      const topAfterCard =
        topBeforeCard(segIdx) +
        (cardHeights[
          String(
            pitList[segIdx]?.pitLocationId ?? pitList[segIdx]?.pitNo ?? segIdx,
          )
        ] ?? 110) +
        CARD_GAP;
      const bh =
        segIdx === activeBetweenIndex
          ? BETWEEN_ROW_H_ACTIVE
          : betweenRowHeights[segIdx] ?? BETWEEN_ROW_H;
      return topAfterCard + bh / 2 - PIN_SIZE / 2;
    };

    if (nearestPitDistM <= YOU_ARE_HERE_THRESHOLD_M && nearestIndex >= 0) {
      return cardCenterTop(nearestIndex);
    }

    if (activeBetweenIndex >= 0 && nearestPitDistM > YOU_ARE_HERE_THRESHOLD_M) {
      return betweenCenterTop(activeBetweenIndex);
    }

    if (nearestPitDistM > YOU_ARE_HERE_THRESHOLD_M && nearestIndex >= 0) {
      return cardCenterTop(nearestIndex);
    }
    return -999;
  };
  const pinTop = getAccuratePinTop();
  const hasPits = pitList.length > 0;
  const isUserFar = nearestPitDistM > YOU_ARE_HERE_THRESHOLD_M;
  const shouldShowPin =
    hasPits &&
    !isOutOfProject &&
    pinVisible &&
    ((!isUserFar && nearestIndex >= 0) || isUserFar);
  const pinAnimation = activeHereCardId !== null ? 'pulse' : 'rubberBand';
  const pinDuration = activeHereCardId !== null ? 1000 : 1500;
  const activePitLocationId = React.useMemo<number | null>(() => {
    const found = pitList.find(p => p.isShotOpen === true);
    return found?.pitLocationId ?? null;
  }, [pitList]);
  const showBetweenDistances =
    activeBetweenIndex >= 0 &&
    betweenPrevDistance !== null &&
    betweenNextDistance !== null;
  const totalPits = pitList.length;
  const pendingShots = pitList.filter(
    p => p?.shotStatus2?.trim()?.toLowerCase() !== 'done',
  ).length;

  const totalRouteDistanceLabel = React.useMemo(() => {
    if (!pitList || pitList.length < 2) return '0 m';
    let totalMeters = 0;
    for (let i = 0; i < pitList.length - 1; i++) {
      const lat1 = parseFloat(pitList[i]?.lat ?? '0');
      const lng1 = parseFloat(pitList[i]?.lng ?? '0');
      const lat2 = parseFloat(pitList[i + 1]?.lat ?? '0');
      const lng2 = parseFloat(pitList[i + 1]?.lng ?? '0');
      if (
        !isNaN(lat1) &&
        !isNaN(lng1) &&
        !isNaN(lat2) &&
        !isNaN(lng2) &&
        !(lat1 === 0 && lng1 === 0) &&
        !(lat2 === 0 && lng2 === 0)
      ) {
        totalMeters += haversineDistance(lat1, lng1, lat2, lng2);
      }
    }
    return formatDistance(totalMeters);
  }, [pitList]);

  const segmentDistLabels = React.useMemo<string[]>(() => {
    if (!pitList || pitList.length < 2) return [];
    return pitList.slice(0, -1).map((_, i) => {
      const lat1 = parseFloat(pitList[i]?.lat ?? '0');
      const lng1 = parseFloat(pitList[i]?.lng ?? '0');
      const lat2 = parseFloat(pitList[i + 1]?.lat ?? '0');
      const lng2 = parseFloat(pitList[i + 1]?.lng ?? '0');
      if (
        isNaN(lat1) ||
        isNaN(lng1) ||
        isNaN(lat2) ||
        isNaN(lng2) ||
        (lat1 === 0 && lng1 === 0) ||
        (lat2 === 0 && lng2 === 0)
      )
        return '';
      return formatDistance(haversineDistance(lat1, lng1, lat2, lng2));
    });
  }, [pitList]);

  const handleLayout = (id: string, h: number) =>
    setCardHeights(prev => (prev[id] === h ? prev : {...prev, [id]: h}));

  const handleBetweenLayout = (idx: number, h: number) =>
    setBetweenRowHeights(prev =>
      prev[idx] === h ? prev : {...prev, [idx]: h},
    );

  // ── Destination PIT Highlight Banner ──────────────────────────────────────
  const DestinationBanner: FC = React.memo(() => {
    if (!isShotTracking || !destinationPit || destinationReached) return null;
    return (
      <Animatable.View
        animation="fadeInDown"
        duration={400}
        style={styles.destinationBanner}>
        <Text style={styles.destinationBannerIcon}>🎯</Text>
        <View style={styles.destinationBannerTextWrap}>
          <Text style={styles.destinationBannerLabel}>Destination PIT</Text>
          <Text style={styles.destinationBannerValue}>
            PIT - {displayPitNo(destinationPit.pitNo ?? '')}
          </Text>
          {!!destinationPit.pitLandmark && (
            <Text style={styles.destinationBannerLandmark} numberOfLines={1}>
              {destinationPit.pitLandmark}
            </Text>
          )}
        </View>
        {!!distToDestination && (
          <View style={styles.destinationBannerDistWrap}>
            <Text style={styles.destinationBannerDist}>
              {distToDestination}
            </Text>
            <Text style={styles.destinationBannerDistLabel}>remaining</Text>
          </View>
        )}
      </Animatable.View>
    );
  });

  // ── Start Shot button visibility ──────────────────────────────────────────
  // Show Start Shot when there is an open shot pit AND shot has not been
  // completed by crossing. Distance to destination is intentionally NOT
  // used to gate this button — the user may be standing inside the radius
  // or even on the destination coords; Start Shot stays enabled until
  // the crossing event fires (user walks past the destination).
  const showStartShotButton =
    !!openShotPit?.pitLocationId && !destinationReached;

  // canPlaceABD: ABD can always be placed while shot is tracking and not done.
  // We no longer block ABD based on distance to destination.
  const canPlaceABD = isShotTracking && !destinationReached;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Screen statusBarStyle="dark" statusBgColor={COLORS.BACKGROUND_DEFAULT}>
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
            <Text style={styles.title}>Shot Installation with ABD</Text>
            <View style={styles.backWrap} />
          </View>
          <ScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            {/* ── Live GPS banner ── */}
            {userCoords && (
              <View style={styles.liveGpsBanner}>
                <Animatable.View
                  animation="pulse"
                  iterationCount="infinite"
                  duration={1800}
                  style={styles.liveGpsDot}
                />
                <Text style={styles.liveGpsText}>
                  {`Live GPS  •  Lat: ${userCoords.latitude.toFixed(
                    5,
                  )}°  Long: ${userCoords.longitude.toFixed(5)}°`}
                </Text>
              </View>
            )}
            <Text
              style={{
                fontSize: SIZE.MS(10),
                color: COLORS.BLACK,
                fontFamily: FONTS.BOLD,
              }}>
              Project StartPoint:{' '}
              <Text style={{color: COLORS.SUCCESS, fontFamily: FONTS.BOLD}}>
                {startPoint}
              </Text>
              {'\n'}
              Project EndPoint:{'  '}
              <Text style={{color: COLORS.ERROR, fontFamily: FONTS.BOLD}}>
                {endPoint}
              </Text>
            </Text>
            <ActivePitBadge
              activePitLocationId={activePitLocationId}
              isLoading={activePitLoading}
            />
            {/* Destination PIT banner — always visible while tracking */}
            <DestinationBanner />
            {/* ── Walking Status Banner ── */}
            {isShotTracking && destinationPit && !destinationReached ? (
              <WalkingStatusBanner
                destinationPitNo={displayPitNo(destinationPit.pitNo ?? '')}
                distanceToDestination={distToDestination}
                bearing={walkingBearing}
              />
            ) : null}
            {/* ── Destination Reached Banner ── */}
            {destinationReached && (
              <Animatable.View
                animation="bounceIn"
                duration={600}
                style={styles.destinationReachedBanner}>
                <Text style={styles.destinationReachedIcon}>🎉</Text>
                <View>
                  <Text style={styles.destinationReachedTitle}>
                    Shot Completed!
                  </Text>
                  <Text style={styles.destinationReachedText}>
                    You have crossed the destination PIT.
                  </Text>
                </View>
              </Animatable.View>
            )}
            {/* ── ABD Progress Bar ── */}
            <ABDProgressBar
              distanceFromLastABD={distanceFromLastABD}
              abdPending={abdPending}
              isTracking={isShotTracking}
            />
            {/* ── Location Banners ── */}
            {activeHereCardId && hasPits ? (
              <Animatable.View
                key={`banner-here-${activeHereCardId}`}
                animation="fadeInDown"
                duration={400}
                style={styles.nearestBanner}>
                <Animatable.Image
                  source={IMAGES.locationCheck}
                  animation="pulse"
                  iterationCount="infinite"
                  duration={1000}
                  style={styles.bannerIcon}
                  resizeMode="contain"
                />
                <Text style={styles.bannerText}>
                  📍 You are Nearest to —{' '}
                  <Text style={styles.bannerBold}>{nearestPitLabel}</Text>
                </Text>
              </Animatable.View>
            ) : activeBetweenIndex >= 0 && hasPits ? (
              <Animatable.View
                key={`banner-between-${activeBetweenIndex}`}
                animation="fadeInDown"
                duration={400}
                style={styles.betweenCorrBanner}>
                <Animatable.Image
                  source={IMAGES.locationCheck}
                  animation="pulse"
                  iterationCount="infinite"
                  duration={1000}
                  style={styles.bannerIcon}
                  resizeMode="contain"
                />
                <Text style={styles.betweenCorrText}>
                  You are between{' '}
                  <Text style={styles.betweenCorrBold}>
                    PIT -{' '}
                    {displayPitNo(pitList[activeBetweenIndex]?.pitNo ?? '')} (
                    {betweenPrevDistance != null
                      ? `${formatDistance(betweenPrevDistance)} away`
                      : '-'}
                    ){' '}
                  </Text>{' '}
                  and{' '}
                  <Text style={styles.betweenCorrBold}>
                    PIT -{' '}
                    {displayPitNo(pitList[activeBetweenIndex + 1]?.pitNo ?? '')}{' '}
                    (
                    {betweenNextDistance != null
                      ? `${formatDistance(betweenNextDistance)} away`
                      : '-'}
                    ){' '}
                  </Text>
                </Text>
              </Animatable.View>
            ) : userAtLastPit &&
              activeBetweenIndex === -1 &&
              nearestPitDistM > 5 &&
              distanceFromLastPit > 5 ? (
              <Animatable.View
                key="banner-away-last-pit"
                animation="fadeInDown"
                duration={400}
                style={styles.nearestBanner}>
                <Animatable.Image
                  source={IMAGES.locationCheck}
                  animation="pulse"
                  iterationCount="infinite"
                  duration={1200}
                  style={styles.bannerIcon}
                  resizeMode="contain"
                />
                <Text style={styles.bannerText}>
                  You are{' '}
                  <Text style={styles.bannerBold}>
                    {formatDistance(distanceFromLastPit)}
                  </Text>{' '}
                  away from last pit
                </Text>
              </Animatable.View>
            ) : pinVisible && nearestPitLabel !== '' ? (
              <Animatable.View
                key="banner-nearest"
                animation="fadeInDown"
                duration={400}
                style={styles.nearestBanner}>
                <Animatable.Image
                  source={IMAGES.locationCheck}
                  animation="pulse"
                  iterationCount="infinite"
                  duration={1400}
                  style={styles.bannerIcon}
                  resizeMode="contain"
                />
                <Text style={styles.bannerText}>
                  You are nearest to:{' '}
                  <Text style={styles.bannerBold}>{nearestPitLabel}</Text>
                </Text>
              </Animatable.View>
            ) : null}
            {/* ── Project card ── */}
            <View style={styles.projectCard}>
              <View style={styles.projectHeader}>
                <Image
                  style={styles.projectIcon}
                  source={IMAGES.hddiconImg}
                  resizeMode="contain"
                />
                <View style={styles.projectMeta}>
                  <Text style={styles.metaText}>
                    <Text style={styles.metaLabel}>PROJ-CODE: </Text>
                    <Text style={styles.metaValue}>{projectCode}</Text>
                  </Text>
                  <Text style={styles.metaText}>
                    <Text style={styles.metaLabel}>PROJ-NAME: </Text>
                    <Text style={styles.metaValue}>{projectName}</Text>
                  </Text>
                  <Text style={styles.metaText}>
                    <Text style={styles.metaLabel}>Vendor Code/Name: </Text>
                    <Text style={styles.metaValue}>
                      {vendorCode}/{vendorName}
                    </Text>
                  </Text>
                </View>
              </View>
              <View style={styles.routeRow}>
                <View style={styles.routeBox}>
                  <View
                    style={[styles.routeBadge, {backgroundColor: '#3EC21E'}]}>
                    <Text style={styles.routeBadgeText}>SP</Text>
                  </View>
                  <Text style={styles.routeAddress} numberOfLines={1}>
                    {spRoute?.address}
                  </Text>
                  <Text style={styles.routeDistance}>{spRoute?.distance}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => openMapDirections(startPoint, 'Start Point')}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                  activeOpacity={0.75}>
                  <Image source={IMAGES.buttonIcon} style={styles.btnIcon} />
                </TouchableOpacity>
              </View>
              <ShortDashedConnector />
              <View style={styles.routeRow}>
                <View style={styles.routeBox}>
                  <View
                    style={[
                      styles.routeBadge,
                      {backgroundColor: COLORS.ERROR},
                    ]}>
                    <Text style={styles.routeBadgeText}>EP</Text>
                  </View>
                  <Text style={styles.routeAddress} numberOfLines={1}>
                    {epRoute?.address}
                  </Text>
                  <Text style={styles.routeDistance}>{epRoute?.distance}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => openMapDirections(endPoint, 'End Point')}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                  activeOpacity={0.75}>
                  <Image source={IMAGES.buttonIcon} style={styles.btnIcon} />
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Stats ── */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>
                  Total Distance: {totalRouteDistanceLabel}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>
                  Total No. of Pits: {totalPits}
                </Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>
                  Pending Distance: {pendingDistanceLabel || '-'}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>
                  Pending Shots: {pendingShots}
                </Text>
              </View>
            </View>

            {/* Start Shot button — visible as long as shot is open and not crossed */}
            {showStartShotButton && (
              <TouchableOpacity
                onPress={handleStartShot}
                style={styles.shotStart}>
                <Text style={styles.startTxt}>Start Shot</Text>
              </TouchableOpacity>
            )}

            {/* ── Pit list ── */}
            {isLoading ? (
              <View style={styles.loaderContainer}>
                <Animatable.View
                  animation="pulse"
                  iterationCount="infinite"
                  duration={1000}>
                  <ActivityIndicator size="large" color={COLORS.PRIMARY} />
                </Animatable.View>
                <Text style={styles.loaderText}>Loading pits…</Text>
                {[0, 1, 2].map(i => (
                  <Animatable.View
                    key={i}
                    animation="pulse"
                    iterationCount="infinite"
                    duration={1200 + i * 200}
                    style={styles.skeletonCard}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.pitListContainer}>
                {hasPits && (
                  <View style={styles.dashLineCol} pointerEvents="none">
                    <VerticalDashedLineAutoHeight
                      left={DASH_COL_WIDTH / 2 - DASH_W / 2}
                      color={COLORS.colorDimgray ?? '#888'}
                      opacity={0.5}
                      onHeightMeasured={h => {
                        if (h > 0 && h !== dashColHeight) setDashColHeight(h);
                      }}
                    />
                    {userAtLastPit && activeBetweenIndex < 0 && (
                      <View
                        style={{
                          position: 'absolute',
                          // top: pinTop + 140, // 👈 thoda neeche shift kiya
                          bottom: 0,
                          left: DASH_COL_WIDTH / 2 - PIN_SIZE / 2,
                          flexDirection: 'column  ',
                          alignItems: 'flex-start',
                          zIndex: 5,
                        }}>
                        <Animatable.Image
                          source={IMAGES.locationCheck}
                          animation="rubberBand"
                          iterationCount="infinite"
                          duration={1200}
                          style={{width: 28, height: 28}}
                          resizeMode="contain"
                        />
                        <View style={{marginLeft: -18, width: 130}}>
                          <Text
                            style={{
                              fontSize: SIZE.MS(9),
                              color: COLORS.BLACK,
                              fontFamily: FONTS.BOLD,
                              textAlign: 'left',
                            }}>
                            You are at{'\n'}last PIT
                          </Text>
                          <Text
                            style={{
                              marginTop: 2,
                              fontSize: SIZE.MS(9),
                              color: COLORS.BLACK,
                              fontFamily: FONTS.BOLD,
                              textAlign: 'left',
                            }}>
                            {isPastProjectEnd
                              ? 'You past the'
                              : `You are ${
                                  distanceFromProjectEnd < 1000
                                    ? `${Math.round(distanceFromProjectEnd)}m`
                                    : `${(
                                        distanceFromProjectEnd / 1000
                                      ).toFixed(2)}\nkm`
                                }`}
                          </Text>
                          <Text
                            style={{
                              fontSize: SIZE.MS(9),
                              color: COLORS.BLACK,
                              fontFamily: FONTS.BOLD,
                              textAlign: 'left',
                            }}>
                            {isPastProjectEnd
                              ? 'Project End'
                              : 'away from\nProject\nEnd Point'}
                          </Text>
                        </View>
                      </View>
                    )}
                    {showBetweenDistances && (
                      <Animatable.Image
                        ref={pinAnimRef}
                        source={IMAGES.locationCheck}
                        animation={pinAnimation}
                        iterationCount="infinite"
                        duration={pinDuration}
                        useNativeDriver
                        style={[
                          styles.nearestPinIcon,
                          {
                            top: pinTop,
                            left: DASH_COL_WIDTH / 2 - PIN_SIZE / 2,
                            position: 'absolute',
                            marginTop: 10,
                          },
                        ]}
                        resizeMode="contain"
                      />
                    )}
                    {activeBetweenIndex >= 0 &&
                      betweenPrevDistance !== null &&
                      betweenNextDistance !== null && (
                        <>
                          <View
                            style={[
                              styles.betweenArrowWrap,
                              {top: pinTop - 46},
                            ]}>
                            <Text style={styles.betweenArrowSymbol}>↑</Text>
                            <Text style={styles.betweenArrowLabel}>
                              {formatDistance(betweenPrevDistance)} away from{' '}
                              {displayPitNo(
                                pitList[activeBetweenIndex]?.pitNo ?? '',
                              )}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.betweenArrowWrap,
                              {top: pinTop + PIN_SIZE + 4},
                            ]}>
                            <Text style={styles.betweenArrowSymbol}>↓</Text>
                            <Text style={styles.betweenArrowLabel}>
                              {formatDistance(betweenNextDistance)} away from{' '}
                              {displayPitNo(
                                pitList[activeBetweenIndex + 1]?.pitNo ?? '',
                              )}
                            </Text>
                          </View>
                        </>
                      )}
                    {userAtLastPit &&
                      activeBetweenIndex === -1 &&
                      nearestPitDistM > 5 &&
                      distanceFromLastPit > 5 && (
                        <View style={[styles.awayLabelWrap, {bottom: -80}]}>
                          <Animatable.Image
                            source={IMAGES.locationCheck}
                            animation="pulse"
                            iterationCount="infinite"
                            duration={1200}
                            style={styles.awayLabelIcon}
                            resizeMode="contain"
                          />
                          <Text style={styles.awayLabelLine1}>
                            {nearestPitDistM < 1000
                              ? `${Math.round(nearestPitDistM)} m`
                              : `${(nearestPitDistM / 1000).toFixed(2)} km`}
                          </Text>
                          <Text style={styles.awayLabelLine2}>away from</Text>
                          <Text style={styles.awayLabelLine2}>last pit</Text>
                        </View>
                      )}
                  </View>
                )}

                <View style={styles.pitListRight}>
                  {hasPits ? (
                    pitList.map((pit, index) => {
                      const cardId = String(
                        pit?.pitLocationId ?? pit?.pitNo ?? index,
                      );
                      const isNearest =
                        !!activeHereCardId && cardId === activeHereCardId;
                      const isDone = pit.isShotOpen === true;
                      const isShotSTatus2 = pit.shotStatus2;
                      const pitDisplayNo = displayPitNo(pit.pitNo);
                      const clickState = getPitClickState(pitList, index);
                      const isClickable =
                        (clickState === 'clickable-from' ||
                          clickState === 'clickable-to') &&
                        isNearest;
                      const isNotClickable = clickState === 'not-clickable';
                      const fromToLabel = pit.fromTo ?? null;
                      const statusBgColor = isNotClickable
                        ? '#9E9E9E'
                        : fromToLabel === 'From'
                        ? '#3EC21E'
                        : '#1976D2';
                      const segDone =
                        index < pitList.length - 1
                          ? isSegmentDone(pitList, index)
                          : null;

                      const isOpenShotPit = pit.isShotOpen === true;
                      const existingAbdCount = Array.isArray(pit.abdList)
                        ? pit.abdList.length
                        : 0;

                      const isDestinationPit =
                        isShotTracking &&
                        !destinationReached &&
                        destinationPit?.pitLocationId === pit.pitLocationId;

                      return (
                        <React.Fragment key={cardId}>
                          {index === 0 && startInsertIndex === -1 && (
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                marginBottom: 10,
                              }}>
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  marginVertical: 10,
                                }}>
                                {/* Left Dashed Line */}
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    width: '100%',
                                  }}>
                                  {/* Left Dashed Line */}
                                  <View
                                    style={{
                                      flex: 1,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      overflow: 'hidden',
                                    }}>
                                    {Array.from({length: 20}).map((_, i) => (
                                      <View
                                        key={i}
                                        style={{
                                          width: 8,
                                          height: 3,
                                          backgroundColor: COLORS.SUCCESS,
                                          marginRight: 5,
                                          borderRadius: 2,
                                        }}
                                      />
                                    ))}
                                  </View>
                                  {/* Center Text */}
                                  <Text
                                    style={{
                                      color: COLORS.SUCCESS,
                                      fontWeight: '700',
                                      fontSize: 15,
                                      marginHorizontal: 10,
                                    }}>
                                    Project Start Point
                                  </Text>
                                  {/* Right Dashed Line */}
                                  <View
                                    style={{
                                      flex: 1,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      overflow: 'hidden',
                                    }}>
                                    {Array.from({length: 20}).map((_, i) => (
                                      <View
                                        key={i}
                                        style={{
                                          width: 8,
                                          height: 3,
                                          backgroundColor: COLORS.SUCCESS,
                                          marginRight: 5,
                                          borderRadius: 2,
                                        }}
                                      />
                                    ))}
                                  </View>
                                </View>
                              </View>
                            </View>
                          )}

                          {startInsertIndex === index && (
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                marginBottom: 10,
                              }}>
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  marginVertical: 10,
                                }}>
                                {/* Left Dashed Line */}
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    width: '100%',
                                  }}>
                                  {/* Left Dashed Line */}
                                  <View
                                    style={{
                                      flex: 1,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      overflow: 'hidden',
                                    }}>
                                    {Array.from({length: 20}).map((_, i) => (
                                      <View
                                        key={i}
                                        style={{
                                          width: 8,
                                          height: 3,
                                          backgroundColor: COLORS.SUCCESS,
                                          marginRight: 5,
                                          borderRadius: 2,
                                        }}
                                      />
                                    ))}
                                  </View>
                                  {/* Center Text */}
                                  <Text
                                    style={{
                                      color: COLORS.SUCCESS,
                                      fontWeight: '700',
                                      fontSize: 15,
                                      marginHorizontal: 10,
                                    }}>
                                    Project Start Point
                                  </Text>
                                  {/* Right Dashed Line */}
                                  <View
                                    style={{
                                      flex: 1,
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      overflow: 'hidden',
                                    }}>
                                    {Array.from({length: 20}).map((_, i) => (
                                      <View
                                        key={i}
                                        style={{
                                          width: 8,
                                          height: 3,
                                          backgroundColor: COLORS.SUCCESS,
                                          marginRight: 5,
                                          borderRadius: 2,
                                        }}
                                      />
                                    ))}
                                  </View>
                                </View>
                              </View>
                            </View>
                          )}
                          <ShotCard
                            pitId={`PIT - ${pitDisplayNo}`}
                            fromToLabel={fromToLabel}
                            shotStatus={isShotSTatus2}
                            gpsAddress={pit.pitGPSLocation?.trim() ?? ''}
                            statusBgColor={statusBgColor}
                            isPending={!isDone}
                            isNearest={isNearest}
                            isClickable={isClickable}
                            isNotClickable={isNotClickable}
                            landmark={pit.pitLandmark?.trim() ?? '-'}
                            lat={`${pit.lat ?? '0'}°`}
                            long={`${pit.lng ?? '0'}°`}
                            pic1Url={pit.pic1Url ?? null}
                            pic2Url={pit.pic2Url ?? null}
                            onLayout={h => handleLayout(cardId, h)}
                            onViewImages={() =>
                              setGalleryData({
                                pitId: `PIT - ${pitDisplayNo}`,
                                pic1Url: pit.pic1Url ?? null,
                                pic2Url: pit.pic2Url ?? null,
                              })
                            }
                            onViewOnMap={() =>
                              handleViewOnMap(pit?.lat, pit?.lng, pitDisplayNo)
                            }
                            onPress={() => handlePitPress(pit, index)}
                          />
                          {/* ── ABD Section — open-shot pit while tracking and not crossed ── */}
                          {isOpenShotPit && canPlaceABD && (
                            <View
                              style={styles.abdSection}
                              onLayout={e =>
                                handleAbdSectionLayout(
                                  cardId,
                                  e.nativeEvent.layout.height,
                                )
                              }>
                              {' '}
                              {existingAbdCount > 0 &&
                                pit.abdList!.map(
                                  (abd: any, abdIndex: number) => (
                                    <React.Fragment
                                      key={`abd-entry-${abdIndex}`}>
                                      <View style={styles.abdEntryRow}>
                                        <View style={styles.abdEntryCard}>
                                          <View style={styles.abdEntryHeader}>
                                            <Text style={styles.abdEntryTitle}>
                                              ABD #{abdIndex + 1}
                                            </Text>
                                            <View
                                              style={styles.abdEntryDoneBadge}>
                                              <Text
                                                style={styles.abdEntryDoneText}>
                                                ✓ Saved
                                              </Text>
                                            </View>
                                          </View>
                                          <Text
                                            style={styles.abdEntryAddressLabel}>
                                            Address:{' '}
                                            <Text
                                              style={styles.abdEntryAddressVal}>
                                              {abd?.gpsAddress ?? '-'}
                                            </Text>
                                          </Text>
                                          <View style={styles.abdEntryGpsRow}>
                                            <Text
                                              style={
                                                styles.abdEntryAddressLabel
                                              }>
                                              GPS:{' '}
                                              <Text
                                                style={
                                                  styles.abdEntryAddressVal
                                                }>
                                                {abd?.abdLat
                                                  ? Number(abd.abdLat).toFixed(
                                                      5,
                                                    )
                                                  : '--'}
                                                °,{' '}
                                                {abd?.abdLng
                                                  ? Number(abd.abdLng).toFixed(
                                                      5,
                                                    )
                                                  : '--'}
                                                °
                                              </Text>
                                            </Text>
                                            <TouchableOpacity
                                              style={styles.viewImagesRow}
                                              activeOpacity={0.7}>
                                              <Text
                                                style={styles.viewImagesText}>
                                                Images
                                              </Text>
                                              <Image
                                                style={styles.pitThumb}
                                                source={IMAGES.galleryIcon}
                                                resizeMode="contain"
                                              />
                                            </TouchableOpacity>
                                          </View>
                                        </View>
                                      </View>
                                      {abdIndex < existingAbdCount - 1 && (
                                        <View style={styles.abdSegmentMarker}>
                                          <View
                                            style={styles.abdSegmentMarkerLine}
                                          />
                                          <Text
                                            style={styles.abdSegmentMarkerText}>
                                            ↕ {ABD_SEGMENT_METERS} m
                                          </Text>
                                          <View
                                            style={styles.abdSegmentMarkerLine}
                                          />
                                        </View>
                                      )}
                                    </React.Fragment>
                                  ),
                                )}
                              {existingAbdCount > 0 && (
                                <View style={styles.abdSegmentMarker}>
                                  <View style={styles.abdSegmentMarkerLine} />
                                  <Text style={styles.abdSegmentMarkerText}>
                                    ↕ {ABD_SEGMENT_METERS} m
                                  </Text>
                                  <View style={styles.abdSegmentMarkerLine} />
                                </View>
                              )}
                              <TouchableOpacity
                                style={[
                                  styles.addAbdBtn,
                                  isAddABDEnabled
                                    ? styles.addAbdBtnEnabled
                                    : styles.addAbdBtnDisabled,
                                ]}
                                disabled={!isAddABDEnabled}
                                activeOpacity={0.75}
                                onPress={() => handleAddABD(pit)}>
                                <Text
                                  style={[
                                    styles.addAbdBtnText,
                                    !isAddABDEnabled &&
                                      styles.addAbdBtnTextDisabled,
                                  ]}>
                                  {isAddABDEnabled ? `+ Add ABD` : `Add ABD`}
                                </Text>
                                {isAddABDEnabled && (
                                  <Animatable.View
                                    animation="pulse"
                                    iterationCount="infinite"
                                    duration={900}
                                    style={styles.addAbdBtnDot}
                                  />
                                )}
                              </TouchableOpacity>
                            </View>
                          )}
                          {!(isShotTracking && isOpenShotPit) &&
                            Array.isArray(pit?.abdList) &&
                            pit.abdList.length > 0 && (
                              <View
                                style={{
                                  position: 'relative',
                                  marginLeft: SIZE.MS(20),
                                }}
                                onLayout={e =>
                                  handleAbdSectionLayout(
                                    cardId,
                                    e.nativeEvent.layout.height,
                                  )
                                }>
                                <VerticalDashedLineAutoHeight
                                  left={20}
                                  color={COLORS.colorDimgray ?? '#888'}
                                  opacity={0.6}
                                />
                                {/* Distance exactly in center */}
                                <View style={styles.segmentDistanceWrapper}>
                                  <BetweenStatusPill2
                                    isDone={segDone}
                                    isActive={activeBetweenIndex === index}
                                    distLabel={getABDTotalDistance(pit.abdList)}
                                  />
                                </View>

                                {pit.abdList.map(
                                  (abd: any, abdIndex: number) => (
                                    <React.Fragment key={`abd-ro-${abdIndex}`}>
                                      <View style={{flexDirection: 'row'}}>
                                        <View style={styles.abdCard}>
                                          <Text style={styles.landmarkAddress}>
                                            Address:
                                            <Text style={styles.abdText}>
                                              {abd?.gpsAddress ?? '-'}
                                            </Text>
                                          </Text>
                                          <View
                                            style={{
                                              flexDirection: 'row',
                                              alignItems: 'center',
                                              marginTop: SIZE.MS(4),
                                            }}>
                                            <View
                                              style={{
                                                flexDirection: 'row',
                                                justifyContent: 'space-around',
                                              }}>
                                              <Text
                                                style={styles.landmarkAddress}>
                                                GPS:
                                                <Text style={styles.abdText}>
                                                  {' '}
                                                  {abd?.abdLat
                                                    ? Number(
                                                        abd.abdLat,
                                                      ).toFixed(5)
                                                    : '--'}
                                                  ° ,{' '}
                                                  {abd?.abdLng
                                                    ? Number(
                                                        abd.abdLng,
                                                      ).toFixed(5)
                                                    : '--'}
                                                  °
                                                </Text>
                                              </Text>
                                              <View
                                                style={{
                                                  flexDirection: 'column',
                                                  alignItems: 'center',
                                                  // marginLeft: SIZE.MS(-20),
                                                  marginTop: SIZE.MS(8),
                                                }}>
                                                <TouchableOpacity
                                                  style={styles.viewImagesRow}
                                                  onPress={() =>
                                                    handleViewOnMap(
                                                      abd?.abdLat,
                                                      abd?.abdLng,
                                                      `ABD-${abdIndex + 1}`,
                                                    )
                                                  }
                                                  activeOpacity={0.7}>
                                                  <Image
                                                    source={IMAGES.buttonIcon}
                                                    style={
                                                      styles.destinationIcon
                                                    }
                                                  />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                  style={styles.viewImagesRow}
                                                  activeOpacity={0.7}
                                                  onPress={() =>
                                                    setGalleryData({
                                                      pitId: `ABD Images`,
                                                      pic1Url:
                                                        abd?.abdPic1Url ?? null,
                                                      pic2Url:
                                                        abd?.abdPic2Url ?? null,
                                                    })
                                                  }>
                                                  <Text
                                                    style={
                                                      styles.viewImagesText
                                                    }>
                                                    Images
                                                  </Text>
                                                  <Image
                                                    style={styles.pitThumb}
                                                    source={IMAGES.galleryIcon}
                                                    resizeMode="contain"
                                                  />
                                                </TouchableOpacity>
                                              </View>
                                            </View>
                                          </View>
                                        </View>
                                      </View>
                                      {abdIndex < pit.abdList.length - 1 && (
                                        <View
                                          style={{
                                            alignItems: 'center',
                                            marginVertical: 6,
                                          }}>
                                          <Text
                                            style={{
                                              color: '#1976D2',
                                              fontSize: 12,
                                              fontWeight: '600',
                                            }}>
                                            ↕{' '}
                                            {getABDDistance(
                                              pit.abdList[abdIndex],
                                              pit.abdList[abdIndex + 1],
                                            )}{' '}
                                          </Text>
                                        </View>
                                      )}
                                    </React.Fragment>
                                  ),
                                )}
                              </View>
                            )}

                          {endInsertIndex === index &&
                            index !== pitList.length - 1 && (
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  marginTop: 10,
                                  width: '100%',
                                }}>
                                {/* Left Dashed Line */}
                                <View
                                  style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    overflow: 'hidden',
                                  }}>
                                  {Array.from({length: 20}).map((_, i) => (
                                    <View
                                      key={`left-${i}`}
                                      style={{
                                        width: 8,
                                        height: 3,
                                        backgroundColor: COLORS.ERROR,
                                        marginRight: 5,
                                        borderRadius: 2,
                                      }}
                                    />
                                  ))}
                                </View>
                                {/* Center Text */}
                                <Text
                                  style={{
                                    color: COLORS.ERROR,
                                    fontWeight: '700',
                                    fontSize: 15,
                                    marginHorizontal: 10,
                                  }}>
                                  Project End Point
                                </Text>

                                {/* Right Dashed Line */}
                                <View
                                  style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    overflow: 'hidden',
                                  }}>
                                  {Array.from({length: 20}).map((_, i) => (
                                    <View
                                      key={`right-${i}`}
                                      style={{
                                        width: 8,
                                        height: 3,
                                        backgroundColor: COLORS.ERROR,
                                        marginRight: 5,
                                        borderRadius: 2,
                                      }}
                                    />
                                  ))}
                                </View>
                              </View>
                            )}

                          {index === pitList.length - 1 &&
                            endInsertIndex === pitList.length - 1 && (
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  marginTop: 10,
                                  width: '100%',
                                }}>
                                {/* Left Dashed Line */}
                                <View
                                  style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    overflow: 'hidden',
                                  }}>
                                  {Array.from({length: 20}).map((_, i) => (
                                    <View
                                      key={`left-${i}`}
                                      style={{
                                        width: 8,
                                        height: 3,
                                        backgroundColor: COLORS.ERROR,
                                        marginRight: 5,
                                        borderRadius: 2,
                                      }}
                                    />
                                  ))}
                                </View>
                                {/* Center Text */}
                                <Text
                                  style={{
                                    color: COLORS.ERROR,
                                    fontWeight: '700',
                                    fontSize: 15,
                                    marginHorizontal: 10,
                                  }}>
                                  Project End Point
                                </Text>

                                {/* Right Dashed Line */}
                                <View
                                  style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    overflow: 'hidden',
                                  }}>
                                  {Array.from({length: 20}).map((_, i) => (
                                    <View
                                      key={`right-${i}`}
                                      style={{
                                        width: 8,
                                        height: 3,
                                        backgroundColor: COLORS.ERROR,
                                        marginRight: 5,
                                        borderRadius: 2,
                                      }}
                                    />
                                  ))}
                                </View>
                              </View>
                            )}

                          {index < pitList.length - 1 && (
                            <View
                              style={styles.betweenRow}
                              onLayout={e =>
                                handleBetweenLayout(
                                  index,
                                  e.nativeEvent.layout.height,
                                )
                              }>
                              <BetweenStatusPill
                                isDone={segDone === true}
                                isActive={activeBetweenIndex === index}
                                distLabel={segmentDistLabels[index] ?? ''}
                              />
                            </View>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <View style={styles.noPitsWrap}>
                      <Image
                        source={IMAGES.noImage}
                        style={styles.noDataIcon}
                        resizeMode="contain"
                      />
                      <Text style={styles.noDataText}>No Data Found</Text>
                    </View>
                  )}

                  {activeBetweenIndex < 0 &&
                    !userAtLastPit &&
                    nearestPitId &&
                    (() => {
                      const targetIndex = pitList.findIndex(
                        (item: any) =>
                          String(item?.pitLocationId ?? item?.pitNo ?? '') ===
                          nearestPitId,
                      );
                      if (targetIndex < 0) return null;
                      let topOffset = 0;
                      for (let i = 0; i < targetIndex; i++) {
                        const id = String(
                          pitList[i]?.pitLocationId ?? pitList[i]?.pitNo ?? i,
                        );
                        const cardH = cardHeights[id] ?? 110;
                        const betweenH = betweenRowHeights[i] ?? BETWEEN_ROW_H;

                        topOffset += cardH + CARD_GAP + betweenH + CARD_GAP;
                      }
                      const currentId = String(
                        pitList[targetIndex]?.pitLocationId ??
                          pitList[targetIndex]?.pitNo ??
                          targetIndex,
                      );
                      const cardHeight = cardHeights[currentId] ?? 110;

                      const centerOffset = topOffset + cardHeight / 2 - 14;
                      return (
                        <View
                          style={{
                            position: 'absolute',
                            top: centerOffset,
                            // Center exactly on the dashed line
                            left: DASH_COL_WIDTH / 2 - 22, // 14 = image radius (28 / 2)
                            width: 28,
                            alignItems: 'center',
                            zIndex: 999,
                          }}>
                          <Animatable.Image
                            source={IMAGES.locationCheck}
                            animation="pulse"
                            iterationCount="infinite"
                            duration={1200}
                            style={{
                              width: 28,
                              height: 28,
                            }}
                            resizeMode="contain"
                          />

                          <Text
                            numberOfLines={3}
                            style={{
                              marginLeft: SIZE.MS(80),
                              marginTop: 4,
                              fontSize: SIZE.MS(9),
                              color: COLORS.BLACK,
                              fontFamily: FONTS.BOLD,
                              width: 120,
                            }}>
                            {nearestPitLabel2.split('\n').join('\n')}
                          </Text>
                        </View>
                      );
                    })()}
                  {userAtLastPit &&
                    activeBetweenIndex === -1 &&
                    nearestPitDistM > 5 &&
                    distanceFromLastPit > 5 && (
                      <View style={{flexDirection: 'row', alignSelf: 'center'}}>
                        <Animatable.Image
                          source={IMAGES.locationCheck}
                          animation="pulse"
                          iterationCount="infinite"
                          duration={1400}
                          style={styles.bannerIcon}
                          resizeMode="contain"
                        />
                        <Text
                          style={{
                            color: COLORS.BLACK,
                            fontFamily: FONTS.SEMI_BOLD,
                            fontSize: SIZE.MS(12),
                          }}>
                          {' '}
                          You are {formatDistance(distanceFromLastPit)} away
                          from your last pit
                        </Text>
                      </View>
                    )}
                  {userAtLastPit &&
                    distanceFromProjectEnd > 1 &&
                    (() => {
                      const totalHeight = pitList.reduce((acc, item, i) => {
                        const id = String(
                          item?.pitLocationId ?? item?.pitNo ?? i,
                        );
                        const cardH = cardHeights[id] ?? 110;
                        const betweenH = betweenRowHeights[i] ?? BETWEEN_ROW_H;
                        return acc + cardH + CARD_GAP + betweenH + CARD_GAP;
                      }, 0);

                      const lastPitBannerAlsoShowing =
                        userAtLastPit &&
                        activeBetweenIndex === -1 &&
                        nearestPitDistM > 30 &&
                        distanceFromLastPit > 30;

                      const bottomOffset =
                        totalHeight - 40 + (lastPitBannerAlsoShowing ? 46 : 0);

                      return (
                        <View
                          style={{
                            position: 'absolute',
                            flexDirection: 'row',
                            bottom: -30,
                            marginTop: SIZE.MS(12),
                            left: 0,
                            right: 0,
                            marginLeft: SIZE.MS(60),
                            marginRight: SIZE.MS(20),
                            alignItems: 'center',
                          }}>
                          <Animatable.Image
                            source={IMAGES.locationCheck}
                            animation="pulse"
                            iterationCount="infinite"
                            duration={1200}
                            style={{width: 28, height: 28}}
                            resizeMode="contain"
                          />
                          <Text
                            style={{
                              marginLeft: SIZE.MS(6),
                              fontSize: 10,
                              color: COLORS.BLACK,
                              fontFamily: FONTS.BOLD,
                              flexShrink: 1,
                            }}>
                            {isPastProjectEnd
                              ? `You are ${formatDistance(
                                  distanceFromProjectEnd,
                                )}\n from Project End Point`
                              : `You are ${formatDistance(
                                  distanceFromProjectEnd,
                                )} away from Project End Point`}
                          </Text>
                        </View>
                      );
                    })()}
                </View>
              </View>
            )}
          </ScrollView>
        </View>

        <TouchableOpacity
          style={[
            styles.whereAreYouBar,
            (locLoading || isLoading) && styles.whereAreYouBarLoading,
          ]}
          activeOpacity={0.85}
          disabled={locLoading || isLoading}
          onPress={handleWhereAmI}>
          {locLoading || isLoading ? (
            <View style={styles.whereAmIRow}>
              <ActivityIndicator size={16} color={COLORS.colorWhite} />
              <Text style={styles.whereAreYouText}>
                {isLoading ? 'Loading pits…' : 'Getting location…'}
              </Text>
            </View>
          ) : (
            <Text style={styles.whereAreYouText}>Where I am?</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Gallery Modal ── */}
      <Modal
        visible={galleryData !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setGalleryData(null)}>
        <TouchableWithoutFeedback onPress={() => setGalleryData(null)}>
          <View style={modalStyles.overlay}>
            <TouchableWithoutFeedback>
              <View style={modalStyles.modalContainer}>
                <View style={modalStyles.modalHeader}>
                  <Text style={modalStyles.modalTitle}>
                    {galleryData?.pitId ?? 'PIT Images'}
                  </Text>
                  <TouchableOpacity
                    hitSlop={{top: 10, right: 10, bottom: 10, left: 10}}
                    onPress={() => setGalleryData(null)}>
                    <Text style={modalStyles.closeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={modalStyles.scrollBody}>
                  {(['pic1Url', 'pic2Url'] as const).map((key, idx) => {
                    const url = galleryData?.[key];
                    return (
                      <View key={key} style={modalStyles.imgBlock}>
                        <Text style={modalStyles.imgLabel}>
                          Image {idx + 1}
                        </Text>
                        {url ? (
                          <Image
                            style={modalStyles.pitStyling}
                            source={{uri: url}}
                            resizeMode="stretch"
                          />
                        ) : (
                          <View style={modalStyles.noImgBox}>
                            <Image
                              source={IMAGES.galleryIcon}
                              style={modalStyles.noImgIcon}
                              resizeMode="contain"
                            />
                            <Text style={modalStyles.noImgText}>
                              No image available
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity
                  onPress={() => setGalleryData(null)}
                  style={modalStyles.imageButton}>
                  <Text style={modalStyles.closeTxt}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </Screen>
  );
};
// ── ShotCard ──────────────────────────────────────────────────────────────────
type ShotCardProps = {
  pitId: string;
  fromToLabel: string | null;
  shotStatus: string;
  gpsAddress: string;
  statusBgColor: string;
  isPending: boolean;
  isNearest: boolean;
  isClickable: boolean;
  isNotClickable: boolean;
  landmark: string;
  lat: string;
  long: string;
  pic1Url: string | null;
  pic2Url: string | null;
  isDestination?: boolean;
  onLayout: (h: number) => void;
  onViewImages: () => void;
  onViewOnMap: () => void;
  onPress: () => void;
};

const ShotCard: FC<ShotCardProps> = ({
  pitId,
  fromToLabel,
  shotStatus,
  gpsAddress,
  statusBgColor,
  isPending,
  isNearest,
  isClickable,
  isNotClickable,
  landmark,
  lat,
  long,
  pic1Url,
  pic2Url,
  isDestination = false,
  onLayout,
  onViewImages,
  onViewOnMap,
  onPress,
}) => {
  const hasImages = !!(pic1Url || pic2Url);
  const isVisuallyDisabled = !isNearest;
  const badgeColor = isNotClickable
    ? '#9E9E9E'
    : isNearest
    ? COLORS.SUCCESS ?? '#3EC21E'
    : COLORS.PRIMARY;

  return (
    <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
      <View style={[styles.pitBadge, {backgroundColor: badgeColor}]}>
        <Text style={styles.pitBadgeText}>{pitId}</Text>
      </View>

      <TouchableOpacity
        activeOpacity={isClickable ? 0.75 : 1}
        onPress={onPress}
        style={[
          styles.pitCard,
          {backgroundColor: isPending ? COLORS.colorWhite : '#D4DBDE'},
          isNearest && styles.pitCardNearest,
          isVisuallyDisabled && styles.pitCardDisabled,
          !isVisuallyDisabled && isClickable && styles.pitCardClickable,
          isDestination && styles.pitCardDestination,
        ]}
        onLayout={(e: LayoutChangeEvent) =>
          onLayout(e.nativeEvent.layout.height)
        }>
        <View style={styles.pitCardHeader}>
          {isDestination && (
            <View style={styles.destinationCardBadge}>
              <Text style={styles.destinationCardBadgeText}>
                🎯 Destination
              </Text>
            </View>
          )}
        </View>
        <Text
          style={[styles.pitMetaText, isVisuallyDisabled && styles.textDimmed]}>
          <Text style={styles.metaLabel}>Landmark: </Text>
          <Text style={styles.metaValue}>{landmark}</Text>
        </Text>
        {!!gpsAddress && (
          <Text
            style={[
              styles.pitAddress,
              isVisuallyDisabled && styles.textDimmed,
            ]}>
            {gpsAddress}
          </Text>
        )}
        <View style={styles.mapIconWrap}>
          <TouchableOpacity onPress={onViewOnMap} activeOpacity={0.7}>
            <Image source={IMAGES.buttonIcon} style={styles.destinationIcon} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      <View style={styles.shotStatusRow}>
        <View style={{flexDirection: 'column'}}>
          <View>
            <Text style={styles.shotStatusLabel}>Shot Status:</Text>
            {shotStatus === 'Pending' ? (
              <View
                style={[styles.statusBadge, {backgroundColor: COLORS.ERROR}]}>
                <Text style={styles.statusBadgeText}>
                  {shotStatus || 'N/A'}
                </Text>
              </View>
            ) : (
              <View
                style={[styles.statusBadge, {backgroundColor: statusBgColor}]}>
                <Text style={styles.statusBadgeText}>
                  {shotStatus || 'N/A'}
                </Text>
              </View>
            )}
          </View>
          {/* <Text style={styles.shotStatusLabel}>From/To:</Text> */}
          <TouchableOpacity
            style={[
              styles.viewImagesRow,
              !hasImages && styles.viewImagesDisabled,
            ]}
            onPress={e => {
              e.stopPropagation?.();
              onViewImages();
            }}
            disabled={!hasImages}
            activeOpacity={0.7}>
            <Text
              style={[
                styles.viewImagesText,
                !hasImages && styles.viewImagesTextDimmed,
              ]}>
              Images
            </Text>
            <Image
              style={[styles.pitThumb, !hasImages && {opacity: 0.35}]}
              source={IMAGES.galleryIcon}
              resizeMode="contain"
            />
            {hasImages && (
              <View style={styles.imgCountBadge}>
                <Text style={styles.imgCountText}>
                  {pic1Url && pic2Url ? '2' : '1'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default ABDMasterScreen;

// ── Gallery Modal Styles ──────────────────────────────────────────────────────
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: FONTS.SEMI_BOLD,
  },
  closeBtn: {fontSize: 20, color: '#666', paddingHorizontal: 4},
  scrollBody: {paddingTop: 12, paddingBottom: 8, gap: 18},
  imgBlock: {gap: 8},
  imgLabel: {fontSize: 13, fontFamily: FONTS.SEMI_BOLD, color: '#555'},
  pitStyling: {
    height: 210,
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#f2f2f2',
  },
  noImgBox: {
    height: 120,
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#fafafa',
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noImgIcon: {width: 28, height: 28, opacity: 0.3},
  noImgText: {fontSize: 13, color: '#aaa', fontFamily: FONTS.REGULAR},
  imageButton: {
    marginTop: 16,
    paddingVertical: 13,
    backgroundColor: '#535455',
    alignItems: 'center',
    borderRadius: 10,
  },
  closeTxt: {color: '#fff', fontFamily: FONTS.SEMI_BOLD, fontSize: 14},
});

// ── Main Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  addressTypo: {
    textAlign: 'left',
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
  },
  destinationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZE.MS(10),
    backgroundColor: '#EDE7F6',
    borderWidth: 1.5,
    borderColor: '#9575CD',
    borderRadius: Border.br_8,
    paddingHorizontal: SIZE.MS(12),
    paddingVertical: SIZE.MVS(10),
  },
  destinationBannerIcon: {fontSize: SIZE.MS(24)},
  destinationBannerTextWrap: {flex: 1},
  destinationBannerLabel: {
    fontSize: FontSize.fs_10,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#4527A0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  destinationBannerValue: {
    fontSize: FontSize.fs_14,
    fontFamily: FONTS.BOLD,
    color: '#311B92',
  },
  destinationBannerLandmark: {
    fontSize: FontSize.fs_11,
    fontFamily: FONTS.REGULAR,
    color: '#5E35B1',
    marginTop: 1,
  },
  destinationBannerDistWrap: {alignItems: 'center'},
  destinationBannerDist: {
    fontSize: FontSize.fs_14,
    fontFamily: FONTS.BOLD,
    color: '#6A1B9A',
  },
  destinationBannerDistLabel: {
    fontSize: FontSize.fs_9,
    fontFamily: FONTS.REGULAR,
    color: '#7B1FA2',
  },
  destinationReachedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZE.MS(10),
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: '#43A047',
    borderRadius: Border.br_8,
    paddingHorizontal: SIZE.MS(14),
    paddingVertical: SIZE.MVS(12),
  },
  destinationReachedIcon: {fontSize: SIZE.MS(28)},
  destinationReachedTitle: {
    fontSize: FontSize.fs_15,
    fontFamily: FONTS.BOLD,
    color: '#1B5E20',
  },
  destinationReachedText: {
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.REGULAR,
    color: '#2E7D32',
    marginTop: 2,
  },
  betweenArrowWrap: {
    position: 'absolute',
    left: DASH_COL_WIDTH / 2 - 40,
    width: 80,
    alignItems: 'center',
    zIndex: 10,
  },
  betweenArrowSymbol: {
    fontSize: 25,
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray,
    // marginTop: 2,
    // backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 2,
  },
  betweenArrowLabel: {
    fontSize: 10,
    fontFamily: FONTS.BOLD,
    color: COLORS.BLACK,
    lineHeight: 11,
    paddingLeft: SIZE.MS(20),
  },
  pitCardDestination: {
    borderWidth: 2,
    borderColor: '#7E57C2',
    backgroundColor: '#F3E5F5',
  },
  destinationCardBadge: {
    backgroundColor: '#EDE7F6',
    borderRadius: 10,
    paddingHorizontal: SIZE.MS(8),
    paddingVertical: SIZE.MS(2),
    borderWidth: 1,
    borderColor: '#9575CD',
    alignSelf: 'flex-start',
  },
  destinationCardBadgeText: {
    fontSize: FontSize.fs_10,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#4527A0',
  },
  abdSection: {
    marginLeft: SIZE.MS(40),
    marginRight: SIZE.MS(4),
    marginTop: SIZE.MS(4),
    gap: SIZE.MS(6),
  },
  abdEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  abdEntryCard: {
    flex: 1,
    backgroundColor: '#E3F0FF',
    borderWidth: 1,
    borderColor: '#90CAF9',
    borderRadius: Border.br_8,
    padding: SIZE.MS(10),
    gap: SIZE.MS(4),
  },
  abdEntryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SIZE.MS(2),
  },
  abdEntryTitle: {
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#1565C0',
  },
  abdEntryDoneBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    paddingHorizontal: SIZE.MS(8),
    paddingVertical: SIZE.MS(2),
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  abdEntryDoneText: {
    fontSize: FontSize.fs_10,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#2E7D32',
  },
  abdEntryAddressLabel: {
    fontSize: FontSize.fs_11,
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray,
  },
  abdEntryAddressVal: {
    fontFamily: FONTS.REGULAR,
    color: '#374151',
  },
  abdEntryGpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: SIZE.MS(4),
  },
  abdSegmentMarker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZE.MS(6),
    paddingHorizontal: SIZE.MS(4),
    marginVertical: SIZE.MS(2),
  },
  abdSegmentMarkerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#90CAF9',
    opacity: 0.6,
  },
  abdSegmentMarkerText: {
    fontSize: FontSize.fs_11,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#1976D2',
  },
  addAbdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Border.br_8,
    paddingVertical: SIZE.MVS(10),
    paddingHorizontal: SIZE.MS(16),
    gap: SIZE.MS(8),
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  addAbdBtnEnabled: {
    backgroundColor: '#1976D2',
  },
  addAbdBtnDisabled: {
    backgroundColor: '#CFD8DC',
    elevation: 0,
  },
  addAbdBtnText: {
    fontSize: FontSize.fs_13,
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorWhite,
  },
  addAbdBtnTextDisabled: {
    color: '#78909C',
  },
  addAbdBtnDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF9C4',
  },
  walkingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZE.MS(12),
    backgroundColor: '#E8F5E9',
    borderWidth: 1.5,
    borderColor: '#66BB6A',
    borderRadius: Border.br_8,
    paddingHorizontal: SIZE.MS(12),
    paddingVertical: SIZE.MVS(10),
  },
  walkingIconWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZE.MS(4),
  },
  walkingEmoji: {fontSize: SIZE.MS(26)},
  walkingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZE.MS(3),
    marginHorizontal: SIZE.MS(2),
  },
  walkingDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#388E3C',
  },
  destinationPin: {alignItems: 'center', justifyContent: 'center'},
  destinationPinText: {fontSize: SIZE.MS(22)},
  walkingInfo: {flex: 1, gap: SIZE.MS(3)},
  walkingRow: {flexDirection: 'row', alignItems: 'center', gap: SIZE.MS(6)},
  walkingActiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E7D32',
  },
  walkingActiveText: {
    fontSize: FontSize.fs_11,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#1B5E20',
  },
  walkingDestText: {
    fontSize: FontSize.fs_13,
    fontFamily: FONTS.REGULAR,
    color: '#1B5E20',
  },
  walkingDestBold: {fontFamily: FONTS.BOLD, color: '#1B5E20'},
  walkingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZE.MS(8),
    flexWrap: 'wrap',
  },
  walkingMetaDist: {
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.BOLD,
    color: '#2E7D32',
  },
  walkingDirBadge: {
    backgroundColor: '#C8E6C9',
    borderRadius: 10,
    paddingHorizontal: SIZE.MS(8),
    paddingVertical: SIZE.MS(2),
  },
  walkingDirText: {
    fontSize: FontSize.fs_10,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#1B5E20',
  },
  abdBtn: {
    width: SIZE.MS(60),
    backgroundColor: '#BDBDBD',
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SIZE.MS(8),
    marginLeft: SIZE.MS(10),
    marginTop: SIZE.MS(10),
  },
  abdBtnText: {
    color: COLORS.colorWhite,
    fontSize: SIZE.MS(10),
    fontFamily: FONTS.SEMI_BOLD,
  },
  li: {
    boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.05)',
    elevation: 3,
    backgroundColor: COLORS.colorLightsteelblue,
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderWidth: 1,
    width: '100%',
    padding: 5,
    gap: 6,
    alignItems: 'flex-start',
    flex: 1,
  },
  field: {
    alignSelf: 'stretch',
    gap: Gap.gap_4,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  address: {
    fontSize: FontSize.fs_10,
    lineHeight: LineHeight.lh_12,
    fontWeight: '500',
  },
  landmarkAddress: {fontSize: SIZE.MS(11), fontFamily: FONTS.SEMI_BOLD},
  status: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    flexDirection: 'row',
  },
  imgIcon: {height: 11, width: 11},
  body: {flex: 1, paddingTop: 16},
  main: {flex: 1, gap: 12},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: Height.height_24,
    paddingHorizontal: 16,
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
  outOfProjectWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  outOfProjectText: {
    fontSize: 12,
    color: '#D32F2F',
    fontFamily: FONTS.SEMI_BOLD,
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    overflow: 'hidden',
  },
  scrollContent: {gap: 10, paddingBottom: 150, paddingHorizontal: 16},
  liveGpsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#EAF4FF',
    borderWidth: 1,
    borderColor: '#90CAF9',
    borderRadius: Border.br_8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveGpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2196F3',
  },
  liveGpsText: {
    fontSize: FontSize.fs_11,
    color: '#1565C0',
    fontFamily: FONTS.MEDIUM,
    flexShrink: 1,
  },
  btnIcon: {
    height: 30,
    width: 30,
    backgroundColor: '#e8f0fe',
    resizeMode: 'contain',
  },
  activePitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#66BB6A',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 6,
    marginTop: 2,
  },
  activePitBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E7D32',
  },
  activePitBadgeLabel: {
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.MEDIUM,
    color: '#1B5E20',
  },
  activePitBadgeValue: {
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#1B5E20',
  },
  activePitBadgeSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#90CAF9',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 4,
    marginTop: 2,
  },
  activePitBadgeSkeletonText: {
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.MEDIUM,
    color: '#1565C0',
  },
  nearestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E6F9EE',
    borderWidth: 1,
    borderColor: COLORS.SUCCESS ?? '#3EC21E',
    borderRadius: Border.br_8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bannerIcon: {width: 20, height: 20},
  bannerText: {
    flex: 1,
    fontSize: FontSize.fs_12,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
  },
  bannerBold: {fontFamily: FONTS.SEMI_BOLD, color: COLORS.SUCCESS ?? '#3EC21E'},
  betweenCorrBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E3F2FD',
    borderWidth: 1.5,
    borderColor: '#1976D2',
    borderRadius: Border.br_8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  betweenCorrText: {
    flex: 1,
    fontSize: FontSize.fs_12,
    color: '#0D47A1',
    fontFamily: FONTS.REGULAR,
  },
  betweenCorrBold: {fontFamily: FONTS.SEMI_BOLD, color: '#0D47A1'},
  projectCard: {
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
    padding: Padding.padding_8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 3,
    gap: 6,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  projectHeader: {
    flexDirection: 'row',
    gap: Gap.gap_8,
    alignItems: 'flex-start',
  },
  projectIcon: {width: 36, height: 35, borderRadius: Border.br_6},
  projectMeta: {flex: 1, gap: 2},
  metaText: {
    fontSize: FontSize.fs_12,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
    textAlign: 'left',
  },
  metaLabel: {fontFamily: FONTS.SEMI_BOLD},
  metaValue: {fontFamily: FONTS.REGULAR},
  routeRow: {flexDirection: 'row', alignItems: 'center', gap: Gap.gap_4},
  destinationIcon: {
    height: 20,
    width: 20,
    resizeMode: 'contain',
    // alignSelf: 'flex-end',
  },
  routeBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.colorGainsboro,
    borderRadius: Border.br_8,
    paddingHorizontal: Padding.padding_4,
    paddingVertical: Padding.padding_2,
    minHeight: 28,
    gap: Gap.gap_4,
    backgroundColor: COLORS.colorWhite,
  },
  routeBadge: {
    width: Width.width_24,
    height: Height.height_24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeBadgeText: {
    fontSize: FontSize.fs_11,
    color: COLORS.colorWhite,
    fontFamily: FONTS.REGULAR,
  },
  routeAddress: {
    flex: 1,
    fontSize: FontSize.fs_10,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
  },
  routeDistance: {
    fontSize: FontSize.fs_10,
    color: COLORS.colorMediumslateblue,
    fontFamily: FONTS.REGULAR,
  },
  mapPinIcon: {
    width: Width.width_28,
    height: Height.height_28,
    borderRadius: Border.br_8,
  },
  dashedWrap: {paddingLeft: 12, height: 8, justifyContent: 'center'},
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 3,
    gap: 10,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  statBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Gap.gap_3,
    backgroundColor: COLORS.colorGray ?? '#f5f5f5',
    borderRadius: Border.br_6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  shotStart: {
    backgroundColor: '#2B67ED',
    flexWrap: 'nowrap',
    paddingVertical: SIZE.MVS(4),
    paddingHorizontal: SIZE.MS(4),
    width: SIZE.MS(100),
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Border.br_5,
  },
  startTxt: {
    color: COLORS.colorWhite,
    fontSize: SIZE.MS(12),
    fontFamily: FONTS.SEMI_BOLD,
  },
  statLabel: {
    fontSize: SIZE.MS(12),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
    flexShrink: 1,
  },
  statValueBox: {
    borderWidth: 1,
    borderColor: '#F7F6F6',
    borderRadius: Border.br_5,
    paddingHorizontal: Padding.padding_6,
    paddingVertical: 2,
    justifyContent: 'center',
    backgroundColor: COLORS.colorWhite,
  },
  statValue: {
    fontSize: 12,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
  },
  loaderContainer: {paddingVertical: 20, alignItems: 'center', gap: 12},
  loaderText: {
    fontSize: FontSize.fs_13,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
  },
  skeletonCard: {
    width: '100%',
    height: 100,
    borderRadius: Border.br_8,
    backgroundColor: '#E0E0E0',
  },
  pitListContainer: {flexDirection: 'row', alignItems: 'stretch'},
  dashLineCol: {width: DASH_COL_WIDTH, position: 'relative', marginRight: 6},
  nearestPinIcon: {
    position: 'absolute',
    left: DASH_COL_WIDTH / 2 - PIN_SIZE / 2,
    width: PIN_SIZE,
    height: PIN_SIZE,
    zIndex: 10,
  },
  awayLabelWrap: {
    position: 'absolute',
    left: DASH_COL_WIDTH / 2 - 36,
    width: 72,
    alignItems: 'center',
    zIndex: 10,
  },
  awayLabelIcon: {width: 18, height: 18, marginBottom: 1},
  awayLabelLine1: {
    fontSize: 10,
    color: COLORS.colorDarkslategray ?? '#555',
    fontFamily: FONTS.BOLD,
    textAlign: 'center',
    lineHeight: 13,
  },
  awayLabelLine2: {
    fontSize: 9,
    color: COLORS.BLACK ?? '#777',
    fontFamily: FONTS.BOLD,
    textAlign: 'center',
    lineHeight: 12,
  },
  pitListRight: {flex: 1, gap: 4, marginLeft: -SIZE.MS(35)},
  noPitsWrap: {alignItems: 'center', paddingVertical: 10},
  noDataIcon: {width: 125, height: 125, alignSelf: 'center'},
  noDataText: {
    fontSize: 15,
    color: COLORS.colorDarkslategray,
    opacity: 0.6,
    fontFamily: FONTS.REGULAR,
  },
  pitCard: {
    borderRadius: Border.br_8,
    padding: Padding.padding_8,
    elevation: 3,
    width: '70%',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 3,
    gap: Gap.gap_4,
    marginLeft: 4,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  pitCardNearest: {
    borderWidth: 2,
    borderColor: COLORS.SUCCESS,
    backgroundColor: '#F0FFF4',
  },
  pitCardClickable: {elevation: 4},
  pitCardDisabled: {
    backgroundColor: '#ECEFF1',
    opacity: 0.55,
    borderWidth: 1,
    borderColor: '#CFD8DC',
    elevation: 1,
  },
  textDimmed: {opacity: 0.5},
  pitCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Gap.gap_4,
  },
  pitBadge: {
    borderRadius: Border.br_5,
    alignItems: 'center',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    paddingHorizontal: SIZE.MS(6),
    height: SIZE.MS(20),
  },
  abdCard: {
    marginTop: 6,
    marginLeft: 40,
    marginBottom: 6,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#bfd3ff',
    borderWidth: 1,
    borderColor: '#D9E2EC',
    width: '68%',
    flexDirection: 'column',
  },
  abdTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1976D2',
    marginBottom: 4,
  },
  abdText: {
    fontSize: 11,
    color: '#374151',
    marginBottom: 2,
    fontWeight: '400',
    fontFamily: FONTS.LIGHT,
  },
  pitBadgeText: {
    color: COLORS.colorWhite,
    fontSize: FontSize.fs_10,
    fontFamily: FONTS.REGULAR,
  },
  nearestTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  nearestTagIcon: {width: 14, height: 14},
  nearestTagText: {
    fontSize: FontSize.fs_10,
    color: '#2E7D32',
    fontFamily: FONTS.SEMI_BOLD,
  },
  shotStatusRow: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    marginLeft: SIZE.MS(4),
  },
  shotStatusLabel: {
    fontSize: FontSize.fs_10,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
    letterSpacing: LetterSpacing?.ls_0_2 ?? 0.2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Border.br_5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadgeText: {
    color: COLORS.colorWhite,
    fontSize: FontSize.fs_10,
    fontFamily: FONTS.SEMI_BOLD,
  },
  pitMetaText: {
    fontSize: FontSize.fs_12,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
    textAlign: 'left',
  },
  pitAddress: {
    fontSize: FontSize.fs_11,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
    textAlign: 'left',
    lineHeight: 15,
  },
  pitLatLong: {
    flex: 1,
    flexDirection: 'row',
    gap: Gap.gap_4,
    alignItems: 'center',
  },
  latLongText: {
    fontSize: FontSize.fs_10,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
    letterSpacing: LetterSpacing?.ls_0_2 ?? 0.2,
  },
  viewImagesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    position: 'relative',
    paddingVertical: 2,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  viewImagesDisabled: {opacity: 0.38},
  viewImagesText: {
    fontSize: FontSize.fs_10,
    color: COLORS.colorMediumslateblue ?? '#6C63FF',
    fontFamily: FONTS.MEDIUM,
    textDecorationLine: 'underline',
  },
  viewImagesTextDimmed: {
    color: COLORS.colorDarkslategray,
    textDecorationLine: 'none',
  },
  pitThumb: {width: 17, height: 17},
  imgCountBadge: {
    position: 'absolute',
    top: -3,
    right: -2,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  imgCountText: {
    fontSize: 9,
    color: COLORS.colorWhite,
    fontFamily: FONTS.SEMI_BOLD,
  },
  betweenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: BETWEEN_ROW_H,
    marginVertical: 2,
    paddingVertical: 4,
  },
  betweenRowNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  betweenRowNew2: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: -10,
    paddingVertical: 12,
  },
  bigDoubleArrow: {fontSize: SIZE.MVS(30), color: '#6B7280', fontWeight: '700'},
  distanceText: {fontSize: 14, fontFamily: FONTS.SEMI_BOLD, color: '#374151'},
  statusPillNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDotNew: {width: 8, height: 8, borderRadius: 4},
  statusTextNew: {fontSize: 12, fontFamily: FONTS.SEMI_BOLD},
  whereAreYouBar: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Border.br_8,
    marginTop: 16,
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
    width: '82%',
    alignSelf: 'center',
  },
  whereAreYouBarLoading: {backgroundColor: COLORS.colorDimgray ?? '#888'},
  whereAmIRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  whereAreYouText: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: COLORS.colorWhite,
  },
  awayInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF8E1',
    borderWidth: 1.5,
    borderColor: '#FFC107',
    borderRadius: Border.br_8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  awayInlineIcon: {width: 22, height: 22},
  awayInlineTextWrap: {flex: 1},
  awayInlineDistText: {
    fontSize: FontSize.fs_13,
    fontFamily: FONTS.BOLD,
    color: '#E65100',
  },
  awayInlineSubText: {
    fontSize: FontSize.fs_11,
    fontFamily: FONTS.REGULAR,
    color: '#795548',
    marginTop: 1,
  },
  abdProgressContainer: {
    backgroundColor: '#F9FBE7',
    borderWidth: 1,
    borderColor: '#C5E1A5',
    borderRadius: Border.br_8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  abdProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  abdProgressLabel: {
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#33691E',
  },
  abdProgressValue: {fontSize: FontSize.fs_12, fontFamily: FONTS.BOLD},
  abdProgressTrack: {
    height: 8,
    backgroundColor: '#DCEDC8',
    borderRadius: 4,
    overflow: 'hidden',
  },
  abdProgressFill: {height: 8, borderRadius: 4},
  abdPendingWarning: {
    fontSize: FontSize.fs_11,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#D32F2F',
    textAlign: 'center',
  },
  abdPendingBanner: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1.5,
    borderColor: '#EF9A9A',
    borderRadius: Border.br_8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  abdPendingBannerTitle: {
    fontSize: FontSize.fs_13,
    fontFamily: FONTS.BOLD,
    color: '#B71C1C',
  },
  abdPendingBannerText: {
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.REGULAR,
    color: '#C62828',
    lineHeight: 18,
  },
  mapIconWrap: {
    position: 'absolute',
    right: 8,
    bottom: 2,
  },
  segmentDistanceWrapper: {
    position: 'absolute',
    top: '50%',
    left: DASH_COL_WIDTH / 2,
    transform: [
      {translateX: -60}, // Half width of pill
      {translateY: -22}, // Half height of pill
    ],
    width: 120,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
});
