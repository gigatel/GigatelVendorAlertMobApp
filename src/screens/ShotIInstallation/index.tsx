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
} from '../../res/globalStyle';
import {
  getPitListwithLiveShotStatus,
  getOpenShotDetailsByIdAPI,
} from '../../store/slices/dss.slice';
import {useDispatch} from 'react-redux';
import Geolocation from '@react-native-community/geolocation';
import {useFocusEffect} from '@react-navigation/native';
import {useSelector} from 'react-redux';

// ── Constants ─────────────────────────────────────────────────────────────────
const DASH_COL_WIDTH = 38;
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
const isChildOf = (aDisp: string, bDisp: string): boolean =>
  bDisp.startsWith(aDisp + '.');
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
  numberOfDucts?: number | null;
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
const calcPitDistance = (pitA: any, pitB: any): number | null => {
  const lat1 = parseFloat(pitA?.lat ?? '0'),
    lon1 = parseFloat(pitA?.lng ?? '0');
  const lat2 = parseFloat(pitB?.lat ?? '0'),
    lon2 = parseFloat(pitB?.lng ?? '0');
  if (
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2) ||
    (lat1 === 0 && lon1 === 0) ||
    (lat2 === 0 && lon2 === 0)
  )
    return null;
  return haversineDistance(lat1, lon1, lat2, lon2);
};

const getNextBetweenPitNo = (pitList: any[], index: number): string => {
  if (!pitList || pitList.length === 0) return '1';
  const curRaw = String(pitList[index]?.pitNo ?? '0');
  const nxtRaw =
    index + 1 < pitList.length
      ? String(pitList[index + 1]?.pitNo ?? '0')
      : null;
  const curDisp = displayPitNo(curRaw);
  const nxtDisp = nxtRaw ? displayPitNo(nxtRaw) : null;
  if (nxtDisp && isChildOf(curDisp, nxtDisp)) {
    const nxtAfterParent = nxtDisp.slice(curDisp.length + 1);
    const nxtFirstChildStr = nxtAfterParent.split('.')[0];
    const nxtFirstChildSeg = parseInt(nxtFirstChildStr, 10);
    const existingInSlot = pitList
      .map((it: any) => displayPitNo(String(it?.pitNo ?? '0')))
      .filter((d: string) => {
        if (!d.startsWith(curDisp + '.')) return false;
        const seg = parseInt(d.slice(curDisp.length + 1).split('.')[0], 10);
        return seg > 0 && seg < nxtFirstChildSeg;
      })
      .map((d: string) =>
        parseInt(d.slice(curDisp.length + 1).split('.')[0], 10),
      );
    const maxInSlot =
      existingInSlot.length > 0 ? Math.max(...existingInSlot) : 0;
    const padded = String(maxInSlot + 1).padStart(
      nxtFirstChildStr.length + 1,
      '0',
    );
    return `${curDisp}.${padded}`;
  }
  const curParts = curDisp.split('.');
  if (curParts.length > 1 && nxtDisp) {
    const curParentDisp = curParts.slice(0, -1).join('.');
    const curLastStr = curParts[curParts.length - 1];
    const curLastSeg = parseInt(curLastStr, 10);
    if (isChildOf(curParentDisp, nxtDisp)) {
      const nxtAfterParent = nxtDisp.slice(curParentDisp.length + 1);
      const nxtFirstChildSeg = parseInt(nxtAfterParent.split('.')[0], 10);
      if (nxtFirstChildSeg >= curLastSeg) {
        const existingInSlot = pitList
          .map((it: any) => displayPitNo(String(it?.pitNo ?? '0')))
          .filter((d: string) => {
            if (!d.startsWith(curParentDisp + '.')) return false;
            const afterParent = d.slice(curParentDisp.length + 1);
            if (afterParent.includes('.')) return false;
            const seg = parseInt(afterParent, 10);
            return seg > curLastSeg && seg < nxtFirstChildSeg;
          })
          .map((d: string) => parseInt(d.slice(curParentDisp.length + 1), 10));
        const maxInSlot =
          existingInSlot.length > 0 ? Math.max(...existingInSlot) : curLastSeg;
        const padded = String(maxInSlot + 1).padStart(curLastStr.length, '0');
        return `${curParentDisp}.${padded}`;
      }
    }
  }
  if (curParts.length === 1) {
    const existingChildren = pitList
      .map((it: any) => displayPitNo(String(it?.pitNo ?? '0')))
      .filter((d: string) => d.startsWith(curDisp + '.'))
      .map((d: string) =>
        parseInt(d.slice(curDisp.length + 1).split('.')[0], 10),
      )
      .filter((n: number) => !isNaN(n) && n > 0);
    const maxChild =
      existingChildren.length > 0 ? Math.max(...existingChildren) : 0;
    return `${curDisp}.${maxChild + 1}`;
  }
  const parentPart = curParts.slice(0, -1).join('.');
  const lastSeg = parseInt(curParts[curParts.length - 1], 10);
  const nxtParts = nxtDisp ? nxtDisp.split('.') : null;
  const nxtLastSeg =
    nxtParts &&
    nxtParts.length === curParts.length &&
    nxtParts.slice(0, -1).join('.') === parentPart
      ? parseInt(nxtParts[nxtParts.length - 1], 10)
      : Infinity;
  const existingInRange = pitList
    .map((it: any) => displayPitNo(String(it?.pitNo ?? '0')))
    .filter((d: string) => {
      const parts = d.split('.');
      if (parts.length !== curParts.length) return false;
      if (parts.slice(0, -1).join('.') !== parentPart) return false;
      const last = parseInt(parts[parts.length - 1], 10);
      return last > lastSeg && last < nxtLastSeg;
    })
    .map((d: string) => parseInt(d.split('.').pop()!, 10));
  const maxInRange =
    existingInRange.length > 0 ? Math.max(...existingInRange) : lastSeg;
  return `${parentPart}.${maxInRange + 1}`;
};

const getBetweenLabel = (pitList: any[], index: number): string => {
  if (!pitList || index >= pitList.length - 1) return '';
  const cur = displayPitNo(pitList[index]?.pitNo ?? String(index + 1));
  const nxt = displayPitNo(pitList[index + 1]?.pitNo ?? String(index + 2));
  return `Add Pit between ${cur} - ${nxt}`;
};

const getNextNewPitNo = (pitList: any[]): number => {
  if (!pitList || pitList.length === 0) return 1;
  const maxBase = Math.max(
    ...pitList.map((it: any) =>
      parseInt(displayPitNo(String(it?.pitNo ?? '0')).split('.')[0], 10),
    ),
  );
  return maxBase + 1;
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

// ── NEW: DashLineCol with measured height for bottom-pinning ─────────────────
const VerticalDashedLineAutoHeight: FC<{
  left: number;
  color?: string;
  opacity?: number;
  // called with the measured container height so parent can place pin at bottom
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

// ── Persistent pit list cache ──────────────────────────────────────────────────
const pitListCache: Record<string, PitItem[]> = {};

// ── Main Screen ───────────────────────────────────────────────────────────────
const ShotInstallation: FC<ScreenProps.ShotInstallation> = ({
  navigation,
  route,
}) => {
  const dispatch = useDispatch<AppDispatch>();
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
    startPoint,
    endPoint,
  } = route.params;

  const cacheKey = String(projectId);
  const [pitList, setPitList] = useState<PitItem[]>(
    () => pitListCache[cacheKey] ?? [],
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
  const openShotId = useSelector((state: any) => state.dss?.openShotId);
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
  // ── NEW: measured height of the dashed-line column ────────────────────────
  const [dashColHeight, setDashColHeight] = useState<number>(0);
  const calledOpenShotIdsRef = useRef<Set<number>>(new Set());
  //
  const watchIdRef = useRef<number | null>(null);
  const toastIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  //
  const pitListRef = useRef<PitItem[]>(pitListCache[cacheKey] ?? []);
  const projectEndRef = useRef<{lat: number; lng: number} | null>(null);
  const projectEndAnchorRef = useRef<{lat: number; lng: number} | null>(null);
  const projectStartRef = useRef<{lat: number; lng: number} | null>(null);
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
  const AT_LAST_PIT_TOL_M = 15;
  const pitSpatialIndexRef = useRef<any[]>([]);
  const lastNearestCheck = useRef(0);
  const findNearestRef = useRef<((lat: number, lng: number) => void) | null>(
    null,
  );
  const pendingDistanceLabel = React.useMemo(() => {
    if (!pitList || pitList.length < 2) return '0 m';

    let totalMeters = 0;

    for (let i = 0; i < pitList.length - 1; i++) {
      const currentPit = pitList[i];
      const nextPit = pitList[i + 1];

      // agar dono done hain toh skip karo
      const isCompleted =
        currentPit?.shotStatus2?.trim()?.toLowerCase() === 'done' &&
        nextPit?.shotStatus2?.trim()?.toLowerCase() === 'done';

      // sirf pending segment ka distance add karo
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
    pitList: any[],
  ): boolean => {
    if (!pitList || pitList.length === 0) return false;
    const lastPit = pitList[pitList.length - 1];
    const prevPit = pitList.length > 1 ? pitList[pitList.length - 2] : null;
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
    if (pitList.length > 0) {
      pitListCache[cacheKey] = pitList;
    }
    pitSpatialIndexRef.current = pitList.map(p => ({
      ...p,
      latNum: parseFloat(p?.lat ?? '0'),
      lngNum: parseFloat(p?.lng ?? '0'),
    }));
  }, [pitList, cacheKey]);

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

  const startToastInterval = useCallback(() => {
    toastIntervalRef.current = setInterval(() => {
      setUserCoords(prev => {
        if (prev)
          showToast(`📍 Lat: ${prev.latitude}°  Long: ${prev.longitude}°`);
        return prev;
      });
    }, TOAST_INTERVAL_MS);
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

  const fetchPitList = useCallback(async () => {
    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      setActivePitLoading(true);

      const result = await dispatch(
        getPitListwithLiveShotStatus({projectId}),
      ).unwrap();

      let newList: PitItem[] = [];
      if (Array.isArray(result)) newList = result;
      else if (result?.data && Array.isArray(result.data))
        newList = result.data;

      setPitList(newList);

      if (newList.length > 0) {
        pitListCache[cacheKey] = newList;
        pitListRef.current = newList;

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
              getOpenShotDetailsByIdAPI({pitLocationId: p.pitLocationId}),
            );
          }
        });
      }
    } catch (error) {
      console.error('Failed to fetch pit list:', error);
      const cached = pitListCache[cacheKey];
      if (cached && cached.length > 0) {
        setPitList(cached);
      } else {
        setPitList([]);
      }
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [dispatch, projectId, cacheKey]);

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

  useFocusEffect(
    useCallback(() => {
      calledOpenShotIdsRef.current = new Set();
      startGPSWatch();
      //startToastInterval();
      fetchPitListRef.current?.();
      initGPSRef.current?.();
      return () => {
        stopGPSWatch();
      };
    }, [startGPSWatch, startToastInterval, stopGPSWatch]),
  );

  useEffect(() => {
    if (userCoords && pitListRef.current.length > 0)
      updateLocationState(userCoords.latitude, userCoords.longitude);
  }, [userCoords]); // eslint-disable-line react-hooks/exhaustive-deps
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
  }, [pitList]); // eslint-disable-line react-deps
  useEffect(() => {
    setTimeout(() => {
      if (pinAnimRef.current) {
        if (activeBetweenIndex >= 0) pinAnimRef.current.pulse?.(500);
        else pinAnimRef.current.rubberBand?.(600);
      }
    }, 150);
  }, [activeBetweenIndex]);

  useEffect(() => {
    if (!isLoading) {
      setActivePitLoading(false);
    }
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
        //showToast(`📍 Updated  Lat: ${latitude}°  Long: ${longitude}°`);
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
    //add karna hai only for testing
    // const isNearest = true;
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
    console.log('numberofDucts', pit?.numberOfDucts);
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
        operatorId: operatorId,
        locatorId: locatorId,
        machineId: machineId,
        distanceFromPrevPit: distanceFromPrevPit,
        distanceFromPrevPitLabel: distanceFromPrevPitLabel,
        distanceBetweenPits: distanceBetweenPits,
        distanceBetweenPitsLabel: distanceBetweenPitsLabel,
        distanceFromStartPit: distanceFromStartPit,
        distanceFromEndPit: distanceFromEndPit,
        userLat: rawUserLat,
        userLng: rawUserLng,
        projectId: projectId,
        projectName: projectName,
        projectCode: projectCode,
        vendorName: vendorName,
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
      //
      console.log('numberofDucts', pit?.numberOfDucts);
      //
      navigation.navigate('AddInstallationToScreen', {
        projectId: projectId,
        toPitLocationId: pit.pitLocationId,
        openShotId: openShotId,
        toPitNo: pit.pitNo,
        distanceFromToPit: distanceFromToPit,
        distanceFromToPitLabel: distanceFromToPitLabel,
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
    return nearestPitId; //hatana hai
    // return true;
  })();
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

      return topAfterCard + bh / 2 - PIN_SIZE / 2 + 0.5;
    };

    // Within 30m → show on card
    if (nearestPitDistM <= YOU_ARE_HERE_THRESHOLD_M && nearestIndex >= 0) {
      return cardCenterTop(nearestIndex);
    }

    // Between pits (but >30m from any pit)
    if (activeBetweenIndex >= 0 && nearestPitDistM > YOU_ARE_HERE_THRESHOLD_M) {
      return betweenCenterTop(activeBetweenIndex);
    }

    // ── FAR / PAST LAST PIT:
    // Place pin at bottom of the dashed line using measured dashColHeight.
    // Keep PIN_SIZE + label (≈40px) visible above bottom edge.
    // if (nearestPitDistM > YOU_ARE_HERE_THRESHOLD_M && dashColHeight > 0) {
    //   return dashColHeight - PIN_SIZE - 44; // 44px room for label below pin
    // }
    // FAR case → last pit ke level pe hi rakho
    if (nearestPitDistM > YOU_ARE_HERE_THRESHOLD_M && nearestIndex >= 0) {
      return cardCenterTop(nearestIndex);
    }

    return -999;
  };

  const pinTop = getAccuratePinTop();
  const hasPits = pitList.length > 0;

  const isUserFar = nearestPitDistM > YOU_ARE_HERE_THRESHOLD_M;

  // Pin is visible when:
  //  • within 30m and nearest card known, OR
  //  • user is far (always show at bottom of line)
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
            <Text style={styles.title}>Shot Installation</Text>
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
                  {`Live GPS  •  Lat: ${userCoords.latitude}°  Long: ${userCoords.longitude}°`}
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
            {/* Active pit badge */}
            <ActivePitBadge
              activePitLocationId={activePitLocationId}
              isLoading={activePitLoading}
            />

            {/* ── Banners ── */}

            {userAtLastPit &&
            activeBetweenIndex === -1 &&
            !(nearestPitDistM > 5 && distanceFromLastPit > 5) &&
            hasPits ? (
              <Animatable.View
                key="banner-last"
                animation="fadeInDown"
                duration={400}
                style={styles.atLastPitBanner}>
                <Animatable.Image
                  source={IMAGES.locationCheck}
                  animation="rubberBand"
                  iterationCount="infinite"
                  duration={1600}
                  style={styles.bannerIcon}
                  resizeMode="contain"
                />
                <Text style={styles.atLastPitText}>
                  You are at / past{' '}
                  <Text style={styles.atLastPitBold}>
                    PIT -{' '}
                    {displayPitNo(pitList[pitList.length - 1]?.pitNo ?? '')}
                  </Text>
                </Text>
              </Animatable.View>
            ) : activeHereCardId && hasPits ? (
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
                  📍 You are Nearest to —
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
                    )
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
                  Total No. of Pits:{totalPits}
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
                  Pending Shots:{pendingShots}
                </Text>
              </View>
            </View>
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
                  // ── Dashed line column — measures its own height ──────────
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
                          top: pinTop + 24, // 👈 thoda neeche shift kiya

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
                    {/* //── Location pin ──//checking  between wala pin*/}
                    {showBetweenDistances && (
                      <Animatable.Image
                        ref={pinAnimRef}
                        source={IMAGES.locationCheck}
                        animation={pinAnimation}
                        iterationCount="infinite"
                        duration={1200}
                        useNativeDriver
                        // style={[styles.nearestPinIcon, {top: pinTop}]}
                        style={[
                          {
                            top: pinTop,
                            left: DASH_COL_WIDTH / 2 - PIN_SIZE / 2,
                            position: 'absolute',
                            marginTop: 8,
                            width: 20,
                            height: 20,
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
                    {/* ── "X km away from last pit" label — only when user is far ── */}
                    {userAtLastPit &&
                      activeBetweenIndex === -1 &&
                      nearestPitDistM > 5 &&
                      distanceFromLastPit > 5 && (
                        <View
                          style={[
                            styles.awayLabelWrap,
                            {top: pinTop + PIN_SIZE + 2, marginTop: -70},
                          ]}>
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

                {/* Right column: cards + Where I am button — dashLineCol
                    stretches to match this full height automatically */}
                <View style={styles.pitListRight}>
                  {hasPits ? (
                    pitList.map((pit, index) => {
                      const cardId = String(
                        pit?.pitLocationId ?? pit?.pitNo ?? index,
                      );
                      const isNearest =
                        !!activeHereCardId && cardId === activeHereCardId;
                      const betweenPitNo = getNextBetweenPitNo(pitList, index);
                      const betweenLabel = getBetweenLabel(pitList, index);
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
                  {/* ── "You are X away from last pit" inline row ──────────
                      Shown in pitListRight when user is >30m from any pit,
                      so it appears beside the pin on the dashed line ── */}

                  {userAtLastPit &&
                    activeBetweenIndex === -1 &&
                    nearestPitDistM > 5 &&
                    distanceFromLastPit > 5 &&
                    (() => {
                      // total height calculate karo (last pit ke bottom tak)
                      const totalHeight = pitList.reduce((acc, item, i) => {
                        const id = String(
                          item?.pitLocationId ?? item?.pitNo ?? i,
                        );
                        const cardH = cardHeights[id] ?? 110;
                        const betweenH = betweenRowHeights[i] ?? BETWEEN_ROW_H;
                        return acc + cardH + CARD_GAP + betweenH + CARD_GAP;
                      }, 0);
                      const bottomOffset = totalHeight - 40;
                      return (
                        <View
                          style={{
                            position: 'absolute',
                            flexDirection: 'row',
                            top: bottomOffset,
                            left: 0,
                            width: DASH_COL_WIDTH2,
                            marginLeft: SIZE.MS(60),
                            alignItems: 'center',
                            alignSelf: 'center',
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
                              marginTop: 4,
                              fontFamily: FONTS.BOLD,
                            }}>
                            You are {formatDistance(distanceFromLastPit)} away
                            {'\n'}from your last pit
                          </Text>
                        </View>
                      );
                    })()}
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
                            top: bottomOffset,
                            marginTop: SIZE.MS(12),
                            left: 0,
                            right: 0,
                            marginLeft: SIZE.MS(40),
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
                              : `You are  ${formatDistance(
                                  distanceFromProjectEnd,
                                )} away from Project End Point`}
                          </Text>
                        </View>
                      );
                    })()}
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
                            left: DASH_COL_WIDTH / 2 - 52, // 14 = image radius (28 / 2)
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
                  {/* {isUserFar && pinVisible && pinTop >= 0 && (
                    <View
                      style={{flexDirection: 'row', marginLeft: SIZE.MS(80)}}>
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
                  )}{' '} */}
                  {/* ── Where I am button is INSIDE the right column so the
                      dashLineCol (alignSelf:stretch) grows to reach it ── */}
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
                            resizeMode="cover"
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
    <TouchableOpacity
      activeOpacity={isClickable ? 0.75 : 1}
      //onPress={isClickable ? onPress : undefined}
      onPress={onPress}
      style={[
        styles.pitCard,
        {backgroundColor: isPending ? COLORS.colorWhite : '#D4DBDE'},
        isNearest && styles.pitCardNearest,
        isVisuallyDisabled && styles.pitCardDisabled,
        !isVisuallyDisabled && isClickable && styles.pitCardClickable,
      ]}
      onLayout={(e: LayoutChangeEvent) =>
        onLayout(e.nativeEvent.layout.height)
      }>
      <View style={styles.pitCardHeader}>
        <View style={[styles.pitBadge, {backgroundColor: badgeColor}]}>
          <Text style={styles.pitBadgeText}>{pitId}</Text>
        </View>
        {isNearest && (
          <Animatable.View
            animation="pulse"
            iterationCount="infinite"
            duration={1200}
            style={styles.nearestTag}>
            <Image
              source={IMAGES.locationCheck}
              style={styles.nearestTagIcon}
              resizeMode="contain"
            />

            <Text style={styles.nearestTagText}>You are here</Text>
          </Animatable.View>
        )}
        <View style={styles.shotStatusRow}>
          <Text style={styles.shotStatusLabel}>Shot Status: </Text>
          <View style={[styles.statusBadge, {backgroundColor: statusBgColor}]}>
            <Text style={styles.statusBadgeText}>{shotStatus || 'N/A'}</Text>
          </View>
        </View>
      </View>
      <Text
        style={[styles.pitMetaText, isVisuallyDisabled && styles.textDimmed]}>
        <Text style={styles.metaLabel}>Landmark: </Text>
        <Text style={styles.metaValue}>{landmark}</Text>
      </Text>
      {!!gpsAddress && (
        <Text
          style={[styles.pitAddress, isVisuallyDisabled && styles.textDimmed]}>
          {gpsAddress}
        </Text>
      )}
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <View style={styles.pitLatLong}>
          <Text
            style={[
              styles.latLongText,
              isVisuallyDisabled && styles.textDimmed,
            ]}>
            Lat: {lat}
          </Text>
          {/* <Text
            style={[
              styles.latLongText,
              isVisuallyDisabled && styles.textDimmed,
            ]}>
            Long: {long}
          </Text> */}
        </View>
        <View style={{flexDirection: 'column', alignItems: 'center'}}>
          <TouchableOpacity
            style={styles.viewImagesRow}
            onPress={onViewOnMap}
            activeOpacity={0.7}>
            <Image source={IMAGES.buttonIcon} style={styles.destinationIcon} />
          </TouchableOpacity>
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
              View Images
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
      <View style={styles.pitLatLong}>
        {/* <Text style={styles.latLongText}>Lat: {lat}</Text> */}
        <Text style={styles.latLongText}>Long: {long}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default ShotInstallation;

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
    height: 30,
    width: 30,
    resizeMode: 'contain',
    alignSelf: 'flex-end',
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
    fontSize: SIZE.MS(9),
    fontFamily: FONTS.BOLD,
    color: COLORS.BLACK,
    lineHeight: 11,
    paddingLeft: SIZE.MS(20),
    marginLeft: -SIZE.MS(8),
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
  // dashLineCol has no fixed height — it stretches to match pitListRight
  // (cards + Where I am button), so the dashed line reaches the button.
  dashLineCol: {
    width: DASH_COL_WIDTH,
    position: 'relative',
    marginRight: 6,
  },
  // ── Pin — absolutely placed within dashLineCol ────────────────────────────
  nearestPinIcon: {
    position: 'absolute',
    // Horizontally centred on the dashed line
    left: DASH_COL_WIDTH / 2 - PIN_SIZE / 2,
    width: PIN_SIZE,
    height: PIN_SIZE,
    zIndex: 10,
  },
  // ── Away label — sits directly below the pin ─────────────────────────────
  awayLabelWrap: {
    position: 'absolute',
    // Horizontally centred on the dashed line
    left: DASH_COL_WIDTH / 2 - 36, // 36 = half of ~72px label width
    width: 72,
    alignItems: 'center',
    zIndex: 10,
  },
  awayLabelWrap2: {
    // position: 'absolute',
    // Horizontally centred on the dashed line
    left: DASH_COL_WIDTH / 2 - 36, // 36 = half of ~72px label width
    width: 250,
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
  pitListRight: {flex: 1, gap: 0},
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
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 3,
    gap: Gap.gap_4,
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
  pitCardHeader: {flexDirection: 'row', alignItems: 'center', gap: Gap.gap_4},
  pitBadge: {
    borderRadius: Border.br_5,
    paddingHorizontal: Padding.padding_5,
    paddingVertical: Padding.padding_2,
    justifyContent: 'center',
    alignItems: 'center',
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

  nearestTagIcon: {
    width: 14,
    height: 14,
  },
  nearestTagText: {
    fontSize: FontSize.fs_10,
    color: '#2E7D32',
    fontFamily: FONTS.SEMI_BOLD,
  },
  shotStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
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
  // ── Inline "X away from last pit" row in pitListRight ────────────────────
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
  atLastPitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF8E1',
    borderWidth: 1.5,
    borderColor: '#FFC107',
    borderRadius: Border.br_8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  atLastPitText: {
    flex: 1,
    fontSize: FontSize.fs_12,
    color: '#5D4037',
    fontFamily: FONTS.REGULAR,
  },
  atLastPitBold: {
    fontFamily: FONTS.SEMI_BOLD,
    color: '#E65100',
  },
});
