//add new pit 1august 3:46
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
  KeyboardAvoidingView,
  Pressable,
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
import {RootState, AppDispatch} from '@reducers';
import {useFocusEffect} from '@react-navigation/native';
import {
  Width,
  FontFamily,
  Height,
  FontSize,
  Border,
  Gap,
  BoxShadow,
  Padding,
  LetterSpacing,
} from '../../res/globalStyle';
import {getPitList} from '../../store/slices/dss.slice';
import Tts from 'react-native-tts';
import {useDispatch, useSelector} from 'react-redux';
import Geolocation from '@react-native-community/geolocation';
const DASH_COL_WIDTH = 38;
const DASH_COL_WIDTH2 = 120;

const CARD_GAP = 8;
const BETWEEN_ROW_H = 44;
const BETWEEN_ROW_H_ACTIVE = 48;
const PIN_SIZE = 32;
const DASH_H = 5;
const DASH_GAP = 4;
const DASH_W = 1.5;
// ─── GPS / Toast intervals ────────────────────────────────────────────────────
const TOAST_INTERVAL_MS = 15000;
const OUT_OF_PROJECT_END_TOL_M = 1500; // same tolerance you use for isOutOfProject

// ─── How close (metres) to last pit = "at last pit" ─────────────────────────
const AT_LAST_PIT_TOL_M = 50; //previous 50
type UserCoords = {latitude: number; longitude: number} | null;

const smoothCoords = (
  prev: UserCoords,
  next: {latitude: number; longitude: number},
): {latitude: number; longitude: number} => {
  if (!prev) {
    return {
      latitude: next.latitude,
      longitude: next.longitude,
    };
  }
  const alpha = 0.35;
  return {
    latitude: prev.latitude + alpha * (next.latitude - prev.latitude),
    longitude: prev.longitude + alpha * (next.longitude - prev.longitude),
  };
};
const haversineDistanceRaw = (
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

// ─────────────────────────────────────────────────────────────────────────
// NEW: LineString (path.lineString) based route validation.
//
// This is ONLY used when the API provides a valid `path.lineString`. It is
// completely additive — it never touches the existing "Add Between" logic
// (segmentCheck / findActiveBetweenIndex / isWithinStartEndCorridor as used
// for the between-pits corridor / handleAddPitBetween), and whenever a
// LineString is not available, all screens fall back to the exact existing
// behavior below (isWithinStartEndCorridor / isUserOnProjectRoute).
// ─────────────────────────────────────────────────────────────────────────
type LatLng = {lat: number; lng: number};
// Parses a WKT string like:
// "LINESTRING (77.25482 28.54165, 77.25449 28.54177, ...)"
// NOTE: WKT order is (lng lat), so we swap while parsing.
const parseWKTLineString = (wkt?: string | null): LatLng[] => {
  if (!wkt) return [];
  const match = wkt.match(/LINESTRING\s*\(([^)]+)\)/i);
  if (!match) return [];
  return match[1]
    .split(',')
    .map(pair => pair.trim().split(/\s+/))
    .filter(parts => parts.length >= 2)
    .map(([lngStr, latStr]) => ({
      lat: parseFloat(latStr),
      lng: parseFloat(lngStr),
    }))
    .filter(p => !isNaN(p.lat) && !isNaN(p.lng));
};
const LINESTRING_CORRIDOR_TOL_M = 250; // 500m tolerance around the LineString
const LINESTRING_START_BEFORE_TOL_M = 250; // 500m allowed before StartPoint
const LINESTRING_END_AFTER_TOL_M = 250; // 500m allowed after EndPoint
// Shortest distance (metres) from a point to the LineString polyline.
const distanceToPolyline = (
  lat: number,
  lng: number,
  line: LatLng[],
): number => {
  if (!line || line.length === 0) return Infinity;
  if (line.length === 1) {
    return haversineDistanceRaw(lat, lng, line[0].lat, line[0].lng);
  }
  let minDist = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const abLat = b.lat - a.lat;
    const abLng = b.lng - a.lng;
    const apLat = lat - a.lat;
    const apLng = lng - a.lng;
    const abDot = abLat * abLat + abLng * abLng;
    const t = abDot < 1e-18 ? 0 : (apLat * abLat + apLng * abLng) / abDot;
    const tClamped = Math.max(0, Math.min(1, t));
    const closestLat = a.lat + tClamped * abLat;
    const closestLng = a.lng + tClamped * abLng;
    const d = haversineDistanceRaw(lat, lng, closestLat, closestLng);
    if (d < minDist) minDist = d;
  }
  return minDist;
};
// Valid area = 500m before StartPoint  →  200m corridor around LineString  →
// 500m after EndPoint.
const isWithinLineStringCorridor = (
  userLat: number,
  userLng: number,
  line: LatLng[],
  projectStart: {lat: number; lng: number} | null,
  projectEnd: {lat: number; lng: number} | null,
): boolean => {
  if (!line || line.length < 2) return false;
  const distToLine = distanceToPolyline(userLat, userLng, line);
  if (distToLine <= LINESTRING_CORRIDOR_TOL_M) return true;
  if (projectStart) {
    const distToStart = haversineDistanceRaw(
      userLat,
      userLng,
      projectStart.lat,
      projectStart.lng,
    );
    if (distToStart <= LINESTRING_START_BEFORE_TOL_M) return true;
  }
  if (projectEnd) {
    const distToEnd = haversineDistanceRaw(
      userLat,
      userLng,
      projectEnd.lat,
      projectEnd.lng,
    );
    if (distToEnd <= LINESTRING_END_AFTER_TOL_M) return true;
  }
  return false;
};
// ─────────────────────────────────────────────────────────────────────────
// SP → EP corridor check with REAL meter-based tolerances:
// - 100m allowed before Start Point (along route)
// - 100m allowed after End Point (along route)
// - 50m allowed sideways (perpendicular) in any direction
const START_END_SIDE_TOL_M = 1500; //increase tolerance to 1500
const START_BEFORE_TOL_M = 1500;
const END_AFTER_TOL_M = 1500;

const isWithinStartEndCorridor = (
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
  const tClamped = Math.max(0, Math.min(1, t));

  const closestLat = latA + tClamped * abLat;
  const closestLng = lngA + tClamped * abLng;

  const dLatM = (userLat - closestLat) * DEG_TO_M;
  const avgLat = (userLat + closestLat) / 2;
  const dLngM =
    (userLng - closestLng) * DEG_TO_M * Math.cos((avgLat * Math.PI) / 180);
  const perp = Math.sqrt(dLatM * dLatM + dLngM * dLngM);

  let result: {onSegment: boolean; perp: number; t: number};

  if (t < 0) {
    const distToStart = haversineDistanceRaw(userLat, userLng, latA, lngA);
    result = {
      onSegment: distToStart <= START_BEFORE_TOL_M,
      perp: distToStart,
      t,
    };
  } else if (t > 1) {
    const distToEnd = haversineDistanceRaw(userLat, userLng, latB, lngB);
    result = {onSegment: distToEnd <= END_AFTER_TOL_M, perp: distToEnd, t};
  } else {
    result = {onSegment: perp <= START_END_SIDE_TOL_M, perp, t};
  }

  console.log('isWithinStartEndCorridor =>', {
    t: result.t,
    perp: result.perp,
    onSegment: result.onSegment,
  });

  return result;
};
const isUserBetweenPits = (
  userLat: number,
  userLng: number,
  pitA: any,
  pitB: any,
): boolean => {
  const latA = parseFloat(pitA?.lat ?? '0');
  const lngA = parseFloat(pitA?.lng ?? '0');
  const latB = parseFloat(pitB?.lat ?? '0');
  const lngB = parseFloat(pitB?.lng ?? '0');
  if (
    isNaN(latA) ||
    isNaN(lngA) ||
    isNaN(latB) ||
    isNaN(lngB) ||
    (latA === 0 && lngA === 0) ||
    (latB === 0 && lngB === 0)
  )
    return false;
  return segmentCheck(userLat, userLng, latA, lngA, latB, lngB).onSegment;
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
    ) {
      continue;
    }

    const {onSegment, perp, t} = segmentCheck(
      userLat,
      userLng,
      latA,
      lngA,
      latB,
      lngB,
    );

    if (!onSegment) {
      continue;
    }

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

  if (bestIndex === -1) {
    return -1;
  }
  console.log('findActiveBetweenIndex =>', {
    bestIndex,
    bestScore,
  });

  return bestIndex;
};

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
  if (dist <= 50) return true;
  if (prevPit) {
    const prevLat = parseFloat(prevPit?.lat ?? '0');
    const prevLng = parseFloat(prevPit?.lng ?? '0');

    if (!isNaN(prevLat) && !isNaN(prevLng)) {
      const {t, perp} = segmentCheck(
        userLat,
        userLng,
        prevLat,
        prevLng,
        lastLat,
        lastLng,
      );

      if (t > 0.85) return true;
    }
  }

  return false;
};
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
}> = ({left, color, opacity}) => {
  const [h, setH] = useState(0);
  return (
    <View
      style={StyleSheet.absoluteFillObject}
      pointerEvents="none"
      onLayout={e => setH(e.nativeEvent.layout.height)}>
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
const PinConnector: FC<{
  height: number;
  color?: string;
}> = ({height, color = COLORS.colorDimgray ?? '#888'}) => {
  if (height <= 0) return null;

  return (
    <View style={{alignItems: 'center'}}>
      <VerticalDashedLine height={height} color={color} opacity={0.7} />
    </View>
  );
};

type GalleryItem = {
  pitId: string;
  pic1Url: string | null;
  pic2Url: string | null;
};
const displayPitNo = (pitNo: string | number): string => {
  const s = String(pitNo ?? '').trim();
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '') || '0';
};
const isChildOf = (aDisp: string, bDisp: string): boolean =>
  bDisp.startsWith(aDisp + '.');
const haversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => haversineDistanceRaw(lat1, lon1, lat2, lon2);
const formatDistance = (meters: number): string =>
  meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(2)} km`;

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

const getBetweenLabel = (list: any[], index: number): string => {
  if (!list) return 'Add Pit Between';

  const current = list[index];
  const next = list[index + 1];

  if (!current || !next) {
    return 'Add Pit Between';
  }

  return `Add Pit Between ${displayPitNo(current.pitNo)} - ${displayPitNo(
    next.pitNo,
  )}`;
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

const showToast = (msg: string) => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  }
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
          {
            enableHighAccuracy: true,
            distanceFilter: 2,
            interval: 2000,
            fastestInterval: 1200,
            maximumAge: 0,
          },
        );
      },
      {enableHighAccuracy: false, timeout: 3000, maximumAge: 0},
    );
  });
const AddNewPIT: FC<ScreenProps.AddNewPIT> = ({navigation, route}) => {
  const [pitModalVisible, setPitModalVisible] = useState(false);
  const [pitModalVisible2, setPitModalVisible2] = useState(false);
  const [loadingBetweenIndex, setLoadingBetweenIndex] = useState<number | null>(
    null,
  );
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
  const [loadingNewPit, setLoadingNewPit] = useState(false);
  const [galleryData, setGalleryData] = useState<GalleryItem | null>(null);
  const [userCoords, setUserCoords] = useState<UserCoords>(null);
  const [nearestDistance, setNearestDistance] = useState<number>(Infinity);
  const watchIdRef = useRef<number | null>(null);
  const toastIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [activeBetweenIndex, setActiveBetweenIndex] = useState<number>(-1);
  const [userAtLastPit, setUserAtLastPit] = useState<boolean>(false);
  const [distanceFromLastPit, setDistanceFromLastPit] = useState<number>(0);
  const [isOutOfProject, setIsOutOfProject] = useState(false);
  const dispatch = useDispatch<AppDispatch>();
  const {
    projectId,
    projectCode,
    spRoute,
    epRoute,
    vendorID,
    projectName,
    vendorCode,
    vendorName,
    startPoint,
    endPoint,
  } = route.params;
  const pitList = useSelector((state: RootState) => state.dss.pitListData);

  // ─────────────────────────────────────────────────────────────────────
  // NEW: path.lineString from the API. This is read from redux (populated
  // alongside pitListData by the same getPitList API response, which now
  // also returns a top-level "path" WKT string as shown in the API sample).
  //
  // NOTE: adjust the selector below (`state.dss.pitListPath`) if your
  // dss.slice stores this field under a different key — it just needs to
  // resolve to the raw WKT string, e.g. "LINESTRING (77.25... 28.54...)".
  // Everything else in this screen works unchanged if this stays null/empty.
  // ─────────────────────────────────────────────────────────────────────
  const pathLineStringRaw = useSelector(
    (state: RootState) => (state.dss as any)?.pitListPath ?? null,
  );

  const routeLineString = React.useMemo(
    () => parseWKTLineString(pathLineStringRaw),
    [pathLineStringRaw],
  );

  const hasLineString = routeLineString.length >= 2;

  const projectStart = React.useMemo(() => {
    if (!startPoint) return null;
    const [lat, lng] = startPoint.split(',').map(Number);
    return {
      lat,
      lng,
    };
  }, [startPoint]);
  const projectEnd = React.useMemo(() => {
    if (!endPoint) return null;
    const [lat, lng] = endPoint.split(',').map(Number);
    return {
      lat,
      lng,
    };
  }, [endPoint]);
  const PROJECT_POINT_TOLERANCE = 20;
  const showStartPoint = !!projectStart;
  const showStartDashed = React.useMemo(() => {
    if (!projectStart || !pitList?.length) return false;
    const firstPit = pitList[0];
    const d = haversineDistance(
      projectStart.lat,
      projectStart.lng,
      parseFloat(firstPit?.lat ?? '0'),
      parseFloat(firstPit?.lng ?? '0'),
    );
    return d > PROJECT_POINT_TOLERANCE;
  }, [projectStart, pitList]);
  const showEndPoint = !!projectEnd;
  const showEndDashed = React.useMemo(() => {
    if (!projectEnd || !pitList?.length) return false;
    const lastPit = pitList[pitList.length - 1];
    const d = haversineDistance(
      projectEnd.lat,
      projectEnd.lng,
      parseFloat(lastPit?.lat ?? '0'),
      parseFloat(lastPit?.lng ?? '0'),
    );

    return d > PROJECT_POINT_TOLERANCE;
  }, [projectEnd, pitList]);

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

  const startInsertIndex = React.useMemo(
    () => getInsertIndex(projectStart, pitList),
    [projectStart, pitList],
  );

  const endInsertIndex = React.useMemo(
    () => getInsertIndex(projectEnd, pitList),
    [projectEnd, pitList],
  );
  const visiblePitList = React.useMemo(() => {
    if (!pitList?.length) return [];

    let start = startInsertIndex;
    let end = endInsertIndex;

    if (start > end) {
      [start, end] = [end, start];
    }

    return pitList.filter((_, index) => index <= end && index > start);
  }, [pitList, startInsertIndex, endInsertIndex]);
  const pitListRef = useRef<any[]>(pitList ?? []);
  const pitSpatialIndexRef = useRef<any[]>([]);

  useEffect(() => {
    const list = pitList ?? [];
    pitListRef.current = list;

    pitSpatialIndexRef.current = list.map((p: any) => ({
      ...p,
      latNum: parseFloat(p?.lat ?? '0'),
      lngNum: parseFloat(p?.lng ?? '0'),
    }));
  }, [pitList]);

  const projectEndRef = useRef<{lat: number; lng: number} | null>(null);
  const projectEndAnchorRef = useRef<{lat: number; lng: number} | null>(null);
  const projectStartRef = useRef<{lat: number; lng: number} | null>(null);

  // NEW: refs for the LineString route so the GPS-watch closures below
  // (which use empty dependency arrays) never see stale values.
  const routeLineStringRef = useRef<LatLng[]>([]);
  const hasLineStringRef = useRef<boolean>(false);

  useEffect(() => {
    routeLineStringRef.current = routeLineString;
    hasLineStringRef.current = hasLineString;
  }, [routeLineString, hasLineString]);

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
  useFocusEffect(
    useCallback(() => {
      console.log('Screen focused → start GPS');
      startGPSWatch();
      lastNearestCheck.current = 0;
      getCurrentPosition()
        .then(({latitude, longitude}) => {
          setUserCoords({latitude, longitude});
          updateLocationState(latitude, longitude);
          findNearest(latitude, longitude);
        })
        .catch(() => {});

      return () => {
        console.log('Screen unfocused → stop GPS');

        stopGPSWatch();
      };
    }, []),
  );
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
      const {latitude, longitude} = await getCurrentPosition();
      const url =
        Platform.OS === 'ios'
          ? `http://maps.apple.com/?saddr=${latitude},${longitude}&daddr=${pitLat},${pitLng}&dirflg=d`
          : `https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${pitLat},${pitLng}&travelmode=driving`;
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${pitLat},${pitLng}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      console.error('Navigation error:', error);
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
  // ── Location state update ─────────────────────────────────────────
  // ── Location state update ─────────────────────────────────────────
  const updateLocationState = useCallback((lat: number, lng: number) => {
    if (lat === 0 && lng === 0) return;

    const list = pitListRef.current;

    if (!list?.length) {
      // No PITs yet — use LineString route when available, else Start/End.
      if (hasLineStringRef.current) {
        const withinLine = isWithinLineStringCorridor(
          lat,
          lng,
          routeLineStringRef.current,
          projectStartRef.current,
          projectEndRef.current,
        );

        setIsOutOfProject(!withinLine);
      } else if (projectStartRef.current && projectEndRef.current) {
        const {onSegment} = isWithinStartEndCorridor(
          lat,
          lng,
          projectStartRef.current.lat,
          projectStartRef.current.lng,
          projectEndRef.current.lat,
          projectEndRef.current.lng,
        );

        setIsOutOfProject(!onSegment);
      } else {
        setIsOutOfProject(false);
      }

      setIsPastProjectEnd(false);
      return;
    }

    const last = list[list.length - 1];

    const lastLat = parseFloat(last?.lat ?? '0');
    const lastLng = parseFloat(last?.lng ?? '0');

    let distFromLast = Infinity;

    if (!isNaN(lastLat) && !isNaN(lastLng)) {
      distFromLast = haversineDistance(lat, lng, lastLat, lastLng);
    }

    setDistanceFromLastPit(distFromLast);

    const pEnd = projectEndRef.current;

    // Distance from Project End is still useful for UI.
    if (pEnd) {
      const distToEnd = haversineDistance(lat, lng, pEnd.lat, pEnd.lng);

      setDistanceFromProjectEnd(distToEnd);
    } else {
      setDistanceFromProjectEnd(0);
    }

    /*
     * IMPORTANT:
     * DO NOT use:
     *
     * segmentCheck(lastPit -> projectEnd).t > 1
     *
     * because the actual route is curved.
     *
     * Project End is considered crossed only when the user is
     * actually close to the Project End point.
     */
    const PROJECT_END_REACHED_TOL_M = 20;

    const reachedProjectEnd =
      !!pEnd &&
      haversineDistance(lat, lng, pEnd.lat, pEnd.lng) <=
        PROJECT_END_REACHED_TOL_M;

    setIsPastProjectEnd(reachedProjectEnd);

    /*
     * User is outside only when they are NOT close to the
     * actual route. When a LineString is available it is used as the
     * authoritative route (200m corridor, +500m before Start / after End).
     * Otherwise the existing PIT-to-PIT route check is used, unchanged.
     */
    const onProjectRoute = hasLineStringRef.current
      ? isWithinLineStringCorridor(
          lat,
          lng,
          routeLineStringRef.current,
          projectStartRef.current,
          projectEndRef.current,
        )
      : isUserOnProjectRoute(
          lat,
          lng,
          list,
          projectStartRef.current,
          projectEndRef.current,
        );

    setIsOutOfProject(!onProjectRoute);

    // If actually at Project End, stop Add New PIT.
    // When a LineString route exists, keep "Add New Pit" enabled up to
    // LINESTRING_END_AFTER_TOL_M (250m) past the End Point, instead of
    // disabling it the moment the 20m "reached end" banner fires.
    const withinEndBuffer =
      hasLineStringRef.current &&
      !!pEnd &&
      haversineDistance(lat, lng, pEnd.lat, pEnd.lng) <=
        LINESTRING_END_AFTER_TOL_M;

    if (reachedProjectEnd) {
      setUserAtLastPit(withinEndBuffer);
      setActiveBetweenIndex(-1);
      setBetweenPrevDistance(null);
      setBetweenNextDistance(null);
      return;
    }
    const nearestDist = getNearestPitDistance(lat, lng);

    if (nearestDist <= 30) {
      setUserAtLastPit(distFromLast <= AT_LAST_PIT_TOL_M || distFromLast <= 50);

      setActiveBetweenIndex(-1);
      setBetweenPrevDistance(null);
      setBetweenNextDistance(null);

      return;
    }

    const prevPit = list.length > 1 ? list[list.length - 2] : null;

    if (prevPit) {
      const prevLat = parseFloat(prevPit?.lat ?? '0');
      const prevLng = parseFloat(prevPit?.lng ?? '0');

      if (
        !isNaN(prevLat) &&
        !isNaN(prevLng) &&
        !isNaN(lastLat) &&
        !isNaN(lastLng)
      ) {
        const {t} = segmentCheck(lat, lng, prevLat, prevLng, lastLat, lastLng);

        setUserPastLastPit(t > 1);
      } else {
        setUserPastLastPit(false);
      }
    } else {
      setUserPastLastPit(false);
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
      const bPrevPit = list[betweenIndex];
      const bNextPit = list[betweenIndex + 1];

      const prevLat = parseFloat(bPrevPit?.lat ?? '0');
      const prevLng = parseFloat(bPrevPit?.lng ?? '0');

      const nextLat = parseFloat(bNextPit?.lat ?? '0');
      const nextLng = parseFloat(bNextPit?.lng ?? '0');

      setBetweenPrevDistance(
        !isNaN(prevLat) && !isNaN(prevLng)
          ? haversineDistance(lat, lng, prevLat, prevLng)
          : null,
      );

      setBetweenNextDistance(
        !isNaN(nextLat) && !isNaN(nextLng)
          ? haversineDistance(lat, lng, nextLat, nextLng)
          : null,
      );

      setActiveBetweenIndex(betweenIndex);
      setUserAtLastPit(false);

      return;
    }

    setBetweenPrevDistance(null);
    setBetweenNextDistance(null);
    setActiveBetweenIndex(-1);
  }, []);

  // ── Refs so watchPosition closure never goes stale ────────────────────────
  const updateLocationStateRef = useRef(updateLocationState);
  useEffect(() => {
    updateLocationStateRef.current = updateLocationState;
  }, [updateLocationState]);

  const findNearestRef = useRef<((lat: number, lng: number) => void) | null>(
    null,
  );

  const startGPSWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      return;
    }
    Geolocation.getCurrentPosition(
      position => {
        const {latitude, longitude, accuracy} = position.coords;

        if (accuracy && accuracy <= 35) {
          const smooth = smoothCoords(userCoords, {
            latitude,
            longitude,
          });

          setUserCoords(smooth);

          updateLocationStateRef.current(smooth.latitude, smooth.longitude);

          findNearestRef.current?.(smooth.latitude, smooth.longitude);
        }
      },
      error => {
        console.warn('[Initial GPS]', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0,
      },
    );
    watchIdRef.current = Geolocation.watchPosition(
      position => {
        const {latitude, longitude, accuracy} = position.coords;
        if (!accuracy || accuracy > 35) return;
        setUserCoords(prev => {
          const smooth = smoothCoords(prev, {
            latitude,
            longitude,
          });

          updateLocationStateRef.current(smooth.latitude, smooth.longitude);

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
  }, [userCoords]);
  const openPitDirections = async (
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
      const {latitude, longitude} = await getCurrentPosition();

      const url =
        Platform.OS === 'ios'
          ? `http://maps.apple.com/?saddr=${latitude},${longitude}&daddr=${pitLat},${pitLng}&dirflg=d`
          : `https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${pitLat},${pitLng}&travelmode=driving`;

      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Location Error', 'Unable to fetch current location.');
    }
  };
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

  useEffect(() => {
    setPinVisible(false);
    setNearestPitId(null);
    setNearestPitLabel('');
    setNearestPitLabel2('');
    setNearestDistance(Infinity);
    setUserAtLastPit(false);
    setActiveBetweenIndex(-1);
    setBetweenPrevDistance(null);
    setBetweenNextDistance(null);
    setDistanceFromLastPit(0);
    setDistanceFromProjectEnd(0);
    setIsPastProjectEnd(false);
    setIsOutOfProject(false);
    setUserCoords(null);
    // clear stale previous-project pit data so a late GPS callback
    // can't compute distances against the old project's pits
    pitListRef.current = [];
    pitSpatialIndexRef.current = [];
    lastNearestCheck.current = 0;
    hasInitialPinRef.current = false;
    dispatch(getPitList({projectId}));
    getCurrentPosition()
      .then(({latitude, longitude}) => {
        setUserCoords({latitude, longitude});
        updateLocationState(latitude, longitude);
        findNearest(latitude, longitude);
      })
      .catch(() => {});
  }, [projectId]);
  useEffect(() => {
    if (pitList && pitList.length > 0) {
      lastNearestCheck.current = 0;
      if (userCoords)
        updateLocationState(userCoords.latitude, userCoords.longitude);
      autoDetectNearestPit();
    } else {
      setPinVisible(false);
      setNearestPitId(null);
      setNearestPitLabel('');
      setNearestPitLabel2('');
      setNearestDistance(Infinity);
      setUserAtLastPit(false);
      setActiveBetweenIndex(-1);
      setBetweenPrevDistance(null);
      setBetweenNextDistance(null);
      setDistanceFromLastPit(0);
      setIsOutOfProject(false);
    }
  }, [pitList]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (userCoords && pitListRef.current.length > 0)
      updateLocationState(userCoords.latitude, userCoords.longitude);
  }, [userCoords]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (
      pitList &&
      pitList.length > 0 &&
      userCoords &&
      !hasInitialPinRef.current
    ) {
      updateLocationState(userCoords.latitude, userCoords.longitude);
      findNearest(userCoords.latitude, userCoords.longitude);
    }
  }, [pitList, userCoords]); // eslint-disable-line react-hooks/exhaustive-deps
  const pinAnimRef = useRef<any>(null);
  const [pinVisible, setPinVisible] = useState(false);
  const [nearestPitId, setNearestPitId] = useState<string | null>(null);
  const [nearestPitLabel, setNearestPitLabel] = useState<string>('');
  const [nearestPitLabel2, setNearestPitLabel2] = useState<string>('');
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});
  const [betweenRowHeights, setBetweenRowHeights] = useState<
    Record<number, number>
  >({});
  const [locLoading, setLocLoading] = useState(false);
  useEffect(() => {
    setTimeout(() => {
      if (pinAnimRef.current) {
        if (userAtLastPit) pinAnimRef.current.rubberBand?.(600);
        else if (activeBetweenIndex >= 0) pinAnimRef.current.pulse?.(500);
        else pinAnimRef.current.rubberBand?.(600);
      }
    }, 150);
  }, [activeBetweenIndex, userAtLastPit]);
  const handleLayout = (id: string, h: number) =>
    setCardHeights(prev => (prev[id] === h ? prev : {...prev, [id]: h}));
  const handleBetweenLayout = (idx: number, h: number) =>
    setBetweenRowHeights(prev =>
      prev[idx] === h ? prev : {...prev, [idx]: h},
    );

  const nearestIndex =
    pitList && nearestPitId
      ? pitList.findIndex(
          (item: any) =>
            String(item?.pitLocationId ?? item?.pitNo ?? '') === nearestPitId,
        )
      : -1;

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

      return top + cardHeight / 2 - PIN_SIZE / 2 + 0.5;
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

    if (activeBetweenIndex >= 0) {
      return betweenCenterTop(activeBetweenIndex);
    }

    if (userAtLastPit) {
      return cardCenterTop(pitList.length - 1);
    }

    if (nearestIndex >= 0) {
      return cardCenterTop(nearestIndex);
    }

    return -999;
  };
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
  const activeHereCardId: string | null = (() => {
    if (!pitList || pitList.length === 0) return null;
    if (userAtLastPit) {
      const last = pitList[pitList.length - 1];
      return String(last?.pitLocationId ?? last?.pitNo ?? '');
    }
    if (activeBetweenIndex >= 0) return null;
    return nearestPitId;
  })();

  const totalRouteDistanceLabel = React.useMemo(() => {
    if (!pitList || pitList.length < 2) return '0 m';

    let totalMeters = 0;

    for (let i = 0; i < pitList.length - 1; i++) {
      const currentPit = pitList[i];
      const nextPit = pitList[i + 1];

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
    return formatDistance(totalMeters);
  }, [pitList]);
  const autoDetectNearestPit = useCallback(() => {
    const list = pitListRef.current;
    if (!list || list.length === 0) return;
    if (!userCoords) {
      getCurrentPosition()
        .then(({latitude, longitude}) =>
          findNearestRef.current?.(latitude, longitude),
        )
        .catch(() => {});
      return;
    }
    findNearestRef.current?.(userCoords.latitude, userCoords.longitude);
  }, [userCoords]);
  const lastNearestCheck = useRef(0);
  const hasInitialPinRef = useRef(false);

  const findNearest = useCallback((latitude: number, longitude: number) => {
    if (!latitude || !longitude || (latitude === 0 && longitude === 0)) return;

    const list = pitListRef.current;
    if (!list || list.length === 0) return;

    const now = Date.now();
    if (hasInitialPinRef.current && now - lastNearestCheck.current < 3000) {
      return;
    }
    lastNearestCheck.current = now;

    let minDist = Infinity,
      closestId: string | null = null,
      closestLabel = '';
    let closestLabel2 = '';
    list.forEach((item: any) => {
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
          } away`;
        }
      }
    });
    if (closestId) {
      setNearestPitId(closestId);
      setNearestPitLabel(closestLabel);
      setNearestPitLabel2(closestLabel2);
      setNearestDistance(minDist);
      setPinVisible(true);
      hasInitialPinRef.current = true;
    }
  }, []);

  useEffect(() => {
    findNearestRef.current = findNearest;
  }, [findNearest]);
  const handleWhereAmI = () => {
    if (!pitList || pitList.length === 0) {
      Alert.alert('No Pits', 'No pit data available yet.');
      return;
    }
    setLocLoading(true);
    getCurrentPosition()
      .then(({latitude, longitude}) => {
        setUserCoords({latitude, longitude});
        updateLocationState(latitude, longitude);
        setLocLoading(false);
        findNearest(latitude, longitude);
      })
      .catch(() => {
        setLocLoading(false);
        Alert.alert(
          'Location Error',
          'Unable to get your location.\n\nPlease enable GPS.',
        );
      });
  };

  const handleAddPitBetween = (
    index: number,
    prevPitItem: any,
    betweenPitNo: string,
    displayNo: string,
  ) => {
    const nextPitItem = pitList[index + 1];

    if (activeBetweenIndex !== index) {
      const curNo = displayPitNo(prevPitItem?.pitNo ?? String(index + 1));
      const nxtNo = displayPitNo(nextPitItem?.pitNo ?? String(index + 2));

      Alert.alert(
        'Not in Range',
        `You can only add a pit between PIT ${curNo} and PIT ${nxtNo} when you are physically located between them.`,
      );
      return;
    }

    /*
     * FIX:
     * If there is a missing MAIN pit number between two main pits,
     * e.g. PIT 14 -> PIT 16,
     * then send PIT 15 instead of 14.1.
     *
     * Otherwise keep the existing betweenPitNo logic unchanged.
     */
    let finalBetweenPitNo = betweenPitNo;

    const prevNo = displayPitNo(prevPitItem?.pitNo ?? String(index + 1));

    const nextNo = displayPitNo(nextPitItem?.pitNo ?? String(index + 2));

    const prevMainNo = parseInt(prevNo.split('.')[0], 10);
    const nextMainNo = parseInt(nextNo.split('.')[0], 10);

    const isPrevMainPit = !prevNo.includes('.');
    const isNextMainPit = !nextNo.includes('.');

    if (
      isPrevMainPit &&
      isNextMainPit &&
      !isNaN(prevMainNo) &&
      !isNaN(nextMainNo) &&
      nextMainNo > prevMainNo + 1
    ) {
      // Example: 14 -> 16 => send 15
      finalBetweenPitNo = String(prevMainNo + 1);
    }

    setLoadingBetweenIndex(index);

    getCurrentPosition()
      .then(({latitude, longitude}) => {
        setLoadingBetweenIndex(null);
        setUserCoords({latitude, longitude});

        const prevLat = parseFloat(prevPitItem?.lat ?? '0');
        const prevLng = parseFloat(prevPitItem?.lng ?? '0');
        const nextLat = parseFloat(nextPitItem?.lat ?? '0');
        const nextLng = parseFloat(nextPitItem?.lng ?? '0');

        let prevDistance: number | null = null;
        let prevDistanceLabel = '';

        let nextDistance: number | null = null;
        let nextDistanceLabel = '';

        if (!isNaN(prevLat) && !isNaN(prevLng)) {
          prevDistance = haversineDistance(
            prevLat,
            prevLng,
            latitude,
            longitude,
          );

          prevDistanceLabel = formatDistance(prevDistance);
        }

        if (!isNaN(nextLat) && !isNaN(nextLng)) {
          nextDistance = haversineDistance(
            nextLat,
            nextLng,
            latitude,
            longitude,
          );

          nextDistanceLabel = formatDistance(nextDistance);
        }

        navigation.navigate('PitInstallation', {
          // FIXED: use calculated missing PIT number
          pitNo: finalBetweenPitNo,

          projectId,
          projectCode,
          projectName,
          vendorCode,
          vendorName,
          vendorID,

          userLat: latitude,
          userLng: longitude,
          prevPitNo: getBetweenLabel(pitList, index)
            .replace('Add Pit Between ', '')
            .replace(' - ', ' - PIT '),
          prevPitLat: prevLat,
          prevPitLng: prevLng,
          nextPitNo: displayPitNo(nextPitItem?.pitNo ?? ''),
          nextPitLat: nextLat,
          nextPitLng: nextLng,
          nextPitId: nextPitItem?.pitLocationId,
          distanceBetweenPits: prevDistance,
          distanceBetweenPitsLabel: prevDistanceLabel,
          distanceFromNextPit: nextDistance,
          distanceFromNextPitLabel: nextDistanceLabel,
        });
      })
      .catch(err => {
        setLoadingBetweenIndex(null);

        Alert.alert(
          'Location Error',
          'Unable to get your location.\n\nPlease enable GPS.',
        );
      });
  };
  const isUserOnProjectRoute = (
    userLat: number,
    userLng: number,
    pits: any[],
    projectStart: {lat: number; lng: number} | null,
    projectEnd: {lat: number; lng: number} | null,
  ): boolean => {
    const ROUTE_TOLERANCE_M = 1500; //changed to 1.5 km
    // Start Point -> first PIT
    if (projectStart && pits.length > 0) {
      const firstPit = pits[0];
      const firstLat = parseFloat(firstPit?.lat ?? '0');
      const firstLng = parseFloat(firstPit?.lng ?? '0');
      if (!isNaN(firstLat) && !isNaN(firstLng)) {
        const {perp, t} = segmentCheck(
          userLat,
          userLng,
          projectStart.lat,
          projectStart.lng,
          firstLat,
          firstLng,
        );

        if (t >= -0.15 && t <= 1.15 && perp <= ROUTE_TOLERANCE_M) {
          return true;
        }
      }
    }

    // PIT -> PIT route segments
    for (let i = 0; i < pits.length - 1; i++) {
      const aLat = parseFloat(pits[i]?.lat ?? '0');
      const aLng = parseFloat(pits[i]?.lng ?? '0');
      const bLat = parseFloat(pits[i + 1]?.lat ?? '0');
      const bLng = parseFloat(pits[i + 1]?.lng ?? '0');

      if (
        isNaN(aLat) ||
        isNaN(aLng) ||
        isNaN(bLat) ||
        isNaN(bLng) ||
        (aLat === 0 && aLng === 0) ||
        (bLat === 0 && bLng === 0)
      ) {
        continue;
      }

      const {perp, t} = segmentCheck(userLat, userLng, aLat, aLng, bLat, bLng);

      if (t >= -0.15 && t <= 1.15 && perp <= ROUTE_TOLERANCE_M) {
        return true;
      }
    }

    // Last PIT -> Project End Point
    // IMPORTANT: this is only used to check route proximity,
    // NOT to decide whether the user crossed the endpoint.
    if (projectEnd && pits.length > 0) {
      const lastPit = pits[pits.length - 1];

      const lastLat = parseFloat(lastPit?.lat ?? '0');
      const lastLng = parseFloat(lastPit?.lng ?? '0');

      if (!isNaN(lastLat) && !isNaN(lastLng)) {
        const {perp, t} = segmentCheck(
          userLat,
          userLng,
          lastLat,
          lastLng,
          projectEnd.lat,
          projectEnd.lng,
        );

        if (t >= -0.15 && t <= 1.15 && perp <= ROUTE_TOLERANCE_M) {
          return true;
        }
      }
    }

    // Direct Start -> End fallback
    // This keeps the initial-pit case working.
    if (projectStart && projectEnd) {
      const {perp, t} = segmentCheck(
        userLat,
        userLng,
        projectStart.lat,
        projectStart.lng,
        projectEnd.lat,
        projectEnd.lng,
      );

      if (t >= -0.15 && t <= 1.15 && perp <= ROUTE_TOLERANCE_M) {
        return true;
      }
    }

    return false;
  };
  // ── Add New Pit ────────────────────────────────────────────────────────────
  const handleAddNewPit = () => {
    if (isOutOfProject) {
      Alert.alert(
        'Outside Project',
        'You are outside the project area. Please enter the project area to add a PIT.',
      );
      return;
    }
    const nextPitNoVal = getNextNewPitNo(pitList ?? []);
    const hasPitsNow = !!(pitList && pitList.length > 0);
    setLoadingNewPit(true);
    console.log('DEBUG path=>', {
      pathLineStringRaw,
      hasLineString,
      len: routeLineString.length,
    });
    getCurrentPosition()
      .then(({latitude, longitude}) => {
        setLoadingNewPit(false);
        setUserCoords({latitude, longitude});

        if (hasLineString) {
          const withinLine = isWithinLineStringCorridor(
            latitude,
            longitude,
            routeLineString,
            projectStart,
            projectEnd,
          );

          if (!withinLine) {
            Alert.alert(
              'Outside Project',
              'You are outside the project route. Please move within 250m of the Start Point, along the route corridor, or within 250m of the End Point to add a PIT.',
            );
            return;
          }
        } else if (projectEnd) {
          const distToEnd = haversineDistance(
            latitude,
            longitude,
            projectEnd.lat,
            projectEnd.lng,
          );

          if (distToEnd > END_AFTER_TOL_M) {
            Alert.alert(
              'Project Completed',
              `You have crossed the Project End Point.New PIT cannot be added.`,
            );
            return;
          }
        }

        if (!hasPitsNow) {
          if (!hasLineString && projectStart) {
            const distFromStart = haversineDistance(
              latitude,
              longitude,
              projectStart.lat,
              projectStart.lng,
            );

            const START_POINT_TOL_M = 1500;
            const isNearStart = distFromStart <= START_POINT_TOL_M;

            let isBetweenStartAndEnd = false;
            if (projectEnd) {
              const {onSegment} = isWithinStartEndCorridor(
                latitude,
                longitude,
                projectStart.lat,
                projectStart.lng,
                projectEnd.lat,
                projectEnd.lng,
              );
              isBetweenStartAndEnd = onSegment;
            }

            if (!isNearStart && !isBetweenStartAndEnd) {
              Alert.alert(
                'Outside Project',
                `You are ${formatDistance(
                  distFromStart,
                )} away from Project Start Point and outside the project corridor.`,
              );
              return;
            }
          }

          navigation.navigate('PitInstallation', {
            pitNo: nextPitNoVal,
            projectId,
            projectCode,
            projectName,
            vendorCode,
            vendorName,
            vendorID,
            userLat: latitude,
            userLng: longitude,
            prevPitNo: null,
            prevPitLat: null,
            prevPitLng: null,
            distanceBetweenPits: null,
            distanceBetweenPitsLabel: '',
          });
          return;
        }

        const lastPit = pitList[pitList.length - 1];
        const lastPitNo = displayPitNo(lastPit?.pitNo ?? '');
        const lastLat = parseFloat(lastPit?.lat ?? '0');
        const lastLng = parseFloat(lastPit?.lng ?? '0');

        let liveDistance: number | null = null;
        let liveDistanceLabel = '';

        if (
          !isNaN(lastLat) &&
          !isNaN(lastLng) &&
          !(lastLat === 0 && lastLng === 0)
        ) {
          liveDistance = haversineDistance(
            lastLat,
            lastLng,
            latitude,
            longitude,
          );

          liveDistanceLabel = formatDistance(liveDistance);
        }

        navigation.navigate('PitInstallation', {
          pitNo: nextPitNoVal,
          projectId,
          projectCode,
          projectName,
          vendorID,
          vendorCode,
          vendorName,
          distanceBetweenPits: liveDistance,
          distanceBetweenPitsLabel: liveDistanceLabel,
          userLat: latitude,
          userLng: longitude,
          prevPitNo: lastPitNo,
          prevPitLat: lastLat,
          prevPitLng: lastLng,
        });
      })
      .catch(() => {
        setLoadingNewPit(false);

        Alert.alert(
          'Location Error',
          'Unable to get your location.\n\nPlease enable GPS.',
        );
      });
  };

  const hasPits = !!(pitList && pitList.length > 0);
  const canAddNewPit =
    !hasPits ||
    (pitList && pitList.length < 2) ||
    userAtLastPit ||
    distanceFromLastPit <= 50;

  const canActuallyAddNewPit = canAddNewPit && !isOutOfProject;
  useEffect(() => {
    if (pitModalVisible) {
      Tts.stop();
      Tts.setDefaultLanguage('en-IN');
      Tts.setDefaultRate(0.45);
      Tts.setDefaultPitch(1);
      Tts.speak(
        'Warning. All pits for this project are already added. You cannot add a new pit now.',
      );
    }
  }, [pitModalVisible]);
  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <Screen statusBarStyle="dark" statusBgColor={COLORS.BACKGROUND_DEFAULT}>
      <View style={styles.body}>
        <View style={styles.main}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backWrap}>
              <Image
                style={styles.backIcon}
                source={IMAGES.arrowBack}
                resizeMode="cover"
              />
            </TouchableOpacity>
            <Text style={styles.title}>PIT Location Master</Text>
            <View style={styles.backWrap} />
          </View>

          <ScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            {/* Live GPS banner */}
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
            {/* ── Priority banners ── */}
            {isPastProjectEnd ? (
              <Animatable.View
                key="banner-project-end-crossed"
                animation="fadeInDown"
                duration={400}
                style={styles.projectEndCrossedBanner}>
                <Animatable.Image
                  source={IMAGES.locationCheck}
                  animation="rubberBand"
                  iterationCount="infinite"
                  duration={1600}
                  style={styles.bannerIcon}
                  resizeMode="contain"
                />
                <Text style={styles.projectEndCrossedText}>
                  You are{' '}
                  <Text style={styles.projectEndCrossedBold}>
                    {formatDistance(distanceFromProjectEnd)}
                  </Text>{' '}
                  away from{' '}
                  <Text style={styles.projectEndCrossedBold}>
                    Project End Point
                  </Text>
                </Text>
              </Animatable.View>
            ) : userAtLastPit && hasPits ? (
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
                  {'  '}
                  <Text style={styles.betweenCorrEnabled}>
                    ✓ Add Pit Between is enabled!
                  </Text>
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

            {/* Project card */}
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
                      {vendorName}/{vendorCode}
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
            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>
                  Total Distance:{'  '}
                  {totalRouteDistanceLabel}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>
                  Total No. of Pits:{'  '}
                  {pitList?.length ?? 0}
                </Text>
              </View>
            </View>
            {/* Pit list */}
            <View style={styles.pitListContainer}>
              {hasPits && (
                <View style={styles.dashLineCol} pointerEvents="none">
                  <VerticalDashedLineAutoHeight
                    left={DASH_COL_WIDTH / 2 - DASH_W / 2}
                    color={COLORS.colorDimgray ?? '#888'}
                    opacity={0.5}
                  />

                  {hasPits &&
                    !isOutOfProject &&
                    (() => {
                      const pinTop = getAccuratePinTop();
                      if (pinTop < 0) return null;

                      const showBetweenDistances =
                        activeBetweenIndex >= 0 &&
                        betweenPrevDistance !== null &&
                        betweenNextDistance !== null;

                      const connectorTopHeight = pinTop;
                      const totalListHeight = pitList.reduce((acc, item, i) => {
                        const id = String(
                          item?.pitLocationId ?? item?.pitNo ?? i,
                        );
                        const cardH = cardHeights[id] ?? 110;
                        const betweenH = betweenRowHeights[i] ?? BETWEEN_ROW_H;
                        return acc + cardH + CARD_GAP + betweenH + CARD_GAP;
                      }, 0);
                      const connectorBottomHeight =
                        totalListHeight - pinTop - PIN_SIZE;

                      return (
                        <View
                          pointerEvents="none"
                          style={{
                            position: 'absolute',
                            top: 0,
                            left:
                              DASH_COL_WIDTH / 2 -
                              DASH_W / 2 -
                              PIN_SIZE / 2 +
                              DASH_W / 2,
                            width: PIN_SIZE,
                            alignItems: 'center',
                            zIndex: 5,
                          }}>
                          <PinConnector
                            height={
                              connectorTopHeight -
                              (showBetweenDistances ? 26 : 0)
                            }
                          />

                          {showBetweenDistances && (
                            <View style={{flexDirection: 'column'}}>
                              <Text
                                style={{
                                  fontSize: 25,
                                  fontFamily: FONTS.SEMI_BOLD,
                                  color: COLORS.colorDarkslategray,
                                  paddingHorizontal: 2,
                                }}>
                                ↑
                              </Text>
                              <Text
                                style={{
                                  fontSize: 9,
                                  fontFamily: FONTS.BOLD,
                                  color: COLORS.BLACK,
                                }}>
                                {formatDistance(betweenPrevDistance)} away from{' '}
                                {displayPitNo(
                                  pitList[activeBetweenIndex]?.pitNo ?? '',
                                )}
                              </Text>
                              <Animatable.Image
                                source={IMAGES.locationCheck}
                                animation="pulse"
                                iterationCount="infinite"
                                duration={1200}
                                style={{width: 28, height: 28}}
                                resizeMode="contain"
                              />
                            </View>
                          )}

                          {activeBetweenIndex < 0 &&
                            !userAtLastPit &&
                            nearestDistance !== Infinity &&
                            (() => {
                              const targetIndex =
                                pitList.findIndex(
                                  (item: any) =>
                                    String(
                                      item?.pitLocationId ?? item?.pitNo ?? '',
                                    ) === nearestPitId,
                                ) ?? -1;

                              if (targetIndex < 0) return null;

                              let topOffset = 0;

                              for (let i = 0; i < targetIndex; i++) {
                                const id = String(
                                  pitList[i]?.pitLocationId ??
                                    pitList[i]?.pitNo ??
                                    i,
                                );

                                const cardH = cardHeights[id] ?? 110;
                                const betweenH =
                                  betweenRowHeights[i] ?? BETWEEN_ROW_H;

                                topOffset +=
                                  cardH + CARD_GAP + betweenH + CARD_GAP;
                              }

                              const currentId = String(
                                pitList[targetIndex]?.pitLocationId ??
                                  pitList[targetIndex]?.pitNo ??
                                  targetIndex,
                              );
                              const cardHeight = cardHeights[currentId] ?? 110;

                              const centerOffset =
                                topOffset + cardHeight / 2 - 14;

                              return (
                                <View
                                  style={{
                                    position: 'absolute',
                                    flexDirection: 'column',
                                    top: centerOffset,
                                    left: 2,
                                    width: DASH_COL_WIDTH,
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
                                    numberOfLines={4}
                                    style={{
                                      marginLeft: SIZE.MS(80),
                                      marginTop: 4,
                                      fontSize: SIZE.MS(8),
                                      color: COLORS.BLACK,
                                      fontFamily: FONTS.BOLD,
                                      width: 120,
                                    }}>
                                    {nearestPitLabel2.split('\n').join('\n')}
                                  </Text>
                                </View>
                              );
                            })()}
                          {userAtLastPit && activeBetweenIndex < 0 && (
                            <View
                              style={{
                                alignItems: 'center',
                              }}>
                              <Animatable.Image
                                source={IMAGES.locationCheck}
                                animation="rubberBand"
                                iterationCount="infinite"
                                duration={1200}
                                style={{width: 28, height: 28}}
                                resizeMode="contain"
                              />
                              <View
                                style={{
                                  marginTop: 4,
                                  marginLeft: 80,
                                  width: 150,
                                }}>
                                <Text
                                  style={{
                                    fontSize: SIZE.MS(9),
                                    color: COLORS.BLACK,
                                    fontFamily: FONTS.BOLD,
                                  }}>
                                  {userPastLastPit
                                    ? 'You are at\nlast PIT'
                                    : 'You are at\nlast PIT'}
                                </Text>

                                <Text
                                  style={{
                                    marginTop: 2,
                                    fontSize: SIZE.MS(9),
                                    color: COLORS.BLACK,
                                    fontFamily: FONTS.BOLD,
                                  }}>
                                  {isPastProjectEnd
                                    ? 'You past the'
                                    : `You are ${
                                        distanceFromProjectEnd < 1000
                                          ? `${Math.round(
                                              distanceFromProjectEnd,
                                            )}m`
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
                                  }}>
                                  {isPastProjectEnd
                                    ? 'Project End'
                                    : 'away from\n Project\nEnd Point'}
                                </Text>
                              </View>
                            </View>
                          )}
                          {showBetweenDistances && (
                            <View style={{flexDirection: 'column'}}>
                              <Text
                                style={{
                                  fontSize: 25,
                                  fontFamily: FONTS.SEMI_BOLD,
                                  color: COLORS.colorDarkslategray,
                                  paddingHorizontal: 2,
                                }}>
                                ↓
                              </Text>
                              <Text
                                style={{
                                  fontSize: 9,
                                  fontFamily: FONTS.SEMI_BOLD,
                                  color: COLORS.BLACK,
                                }}>
                                {formatDistance(betweenNextDistance!)}
                                {'\n'}away from{' '}
                                {displayPitNo(
                                  pitList[activeBetweenIndex + 1]?.pitNo ?? '',
                                )}
                              </Text>
                            </View>
                          )}

                          <PinConnector
                            height={
                              connectorBottomHeight -
                              (showBetweenDistances ? 14 : 0)
                            }
                          />
                        </View>
                      );
                    })()}
                  {userAtLastPit &&
                    activeBetweenIndex === -1 &&
                    nearestDistance > 5 &&
                    distanceFromLastPit > 5 &&
                    (() => {
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
                            flexDirection: 'column',
                            top: bottomOffset,
                            left: 0,
                            width: DASH_COL_WIDTH,
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
                              marginTop: 4,
                              fontFamily: FONTS.BOLD,
                            }}>
                            {formatDistance(distanceFromLastPit)} away from last
                          </Text>
                        </View>
                      );
                    })()}
                  {isPastProjectEnd &&
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
                        nearestDistance > 5 &&
                        distanceFromLastPit > 5;

                      const bottomOffset =
                        totalHeight - 40 + (lastPitBannerAlsoShowing ? 60 : 0);

                      return (
                        <View
                          style={{
                            position: 'absolute',
                            flexDirection: 'column',
                            top: bottomOffset,
                            left: 0,
                            width: DASH_COL_WIDTH,
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
                              fontSize: 9,
                              color: COLORS.BLACK,
                              marginTop: 4,
                              fontFamily: FONTS.BOLD,
                            }}>
                            {formatDistance(distanceFromProjectEnd)} away from
                            endPoint
                          </Text>
                        </View>
                      );
                    })()}
                </View>
              )}

              <View style={styles.pitListRight}>
                {hasPits ? (
                  pitList.map((item: any, index: number) => {
                    const cardId = String(
                      item?.pitLocationId ?? item?.pitNo ?? index,
                    );
                    const isNearest =
                      !isOutOfProject &&
                      !!activeHereCardId &&
                      cardId === activeHereCardId;
                    const betweenPitNo = getNextBetweenPitNo(pitList, index);
                    const betweenLabel = getBetweenLabel(pitList, index);
                    const displayNo = displayPitNo(item?.pitNo ?? '');
                    const nextItem =
                      index < pitList.length - 1 ? pitList[index + 1] : null;
                    const staticDist = nextItem
                      ? calcPitDistance(item, nextItem)
                      : null;
                    const staticDistLabel =
                      staticDist !== null ? formatDistance(staticDist) : null;
                    const isBetweenLoading = loadingBetweenIndex === index;

                    const canAddBetween: boolean =
                      index < pitList.length - 1 &&
                      !userAtLastPit &&
                      activeBetweenIndex === index;
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
                        )}
                        <PitCard
                          pitId={`PIT - ${displayNo}`}
                          lat={`${item?.lat ?? '0'}°`}
                          long={`${item?.lng ?? '0'}°`}
                          landmark={item?.pitLandmark ?? '-'}
                          address={item?.pitGPSLocation ?? '-'}
                          pic1Url={item?.pic1Url ?? null}
                          pic2Url={item?.pic2Url ?? null}
                          isNearest={isNearest}
                          onLayout={h => handleLayout(cardId, h)}
                          distanceToNext={staticDistLabel}
                          onViewImages={() =>
                            setGalleryData({
                              pitId: `PIT - ${displayNo}`,
                              pic1Url: item?.pic1Url ?? null,
                              pic2Url: item?.pic2Url ?? null,
                            })
                          }
                          onViewOnMap={() =>
                            handleViewOnMap(item?.lat, item?.lng, displayNo)
                          }
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
                            style={[
                              styles.betweenRow,
                              canAddBetween && styles.betweenRowActive,
                              canAddBetween && {height: BETWEEN_ROW_H_ACTIVE},
                            ]}
                            onLayout={e =>
                              handleBetweenLayout(
                                index,
                                e.nativeEvent.layout.height,
                              )
                            }>
                            <View style={styles.distancePill}>
                              <Image
                                source={IMAGES.updownArrow}
                                style={styles.arrowIcon}
                                resizeMode="contain"
                              />
                              <Text style={styles.distancePillText}>
                                {staticDistLabel ?? 'Distance'}
                              </Text>
                            </View>

                            <TouchableOpacity
                              onPress={() => {
                                if (!canAddBetween) {
                                  const curNo = displayPitNo(
                                    item?.pitNo ?? String(index + 1),
                                  );
                                  const nxtNo = displayPitNo(
                                    nextItem?.pitNo ?? String(index + 2),
                                  );

                                  const msg = userAtLastPit
                                    ? `You have reached the last pit.\n\nAll "Add Pit Between" options are disabled. Use the "Add New Pit" button below to continue.`
                                    : `To add a pit between PIT ${curNo} and PIT ${nxtNo}, you must physically be in the corridor between them.\n\nYour current location is outside this range.`;

                                  Alert.alert('Move to Location', msg, [
                                    {text: 'OK'},
                                  ]);
                                  return;
                                }

                                handleAddPitBetween(
                                  index,
                                  item,
                                  betweenPitNo,
                                  displayNo,
                                );
                              }}
                              disabled={isBetweenLoading}
                              style={[
                                styles.addPitBtn,
                                canAddBetween
                                  ? styles.addPitBtnEnabled
                                  : styles.addPitBtnDisabled,
                                isBetweenLoading && styles.addPitBtnLoading,
                                canAddBetween && styles.addPitBtnEnabledPadding,
                              ]}>
                              {isBetweenLoading ? (
                                <View style={styles.addPitBtnRow}>
                                  <ActivityIndicator
                                    size={12}
                                    color={COLORS.colorWhite}
                                  />
                                  <Text style={styles.addPitBtnText}>
                                    Getting location...
                                  </Text>
                                </View>
                              ) : canAddBetween ? (
                                <View style={styles.addPitBtnRow}>
                                  <Animatable.Image
                                    source={IMAGES.locationCheck}
                                    animation="pulse"
                                    iterationCount="infinite"
                                    duration={900}
                                    style={styles.addPitBtnCheckIcon}
                                    resizeMode="contain"
                                  />
                                  <Text style={styles.addPitBtnText}>
                                    {betweenLabel}
                                  </Text>
                                </View>
                              ) : (
                                <View style={styles.addPitBtnRow}>
                                  <Text style={styles.addPitBtnLockIcon}>
                                    🔒{' '}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.addPitBtnText,
                                      styles.addPitBtnTextDisabled,
                                    ]}>
                                    {betweenLabel}
                                  </Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          </View>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <View style={styles.noPitsWrap}>
                    <Image
                      source={IMAGES.noImage}
                      style={styles.Iconnew}
                      resizeMode="contain"
                    />
                    <View
                      style={[
                        styles.nodatafounddivnew,
                        styles.ticketsParentFlexBox,
                      ]}>
                      <Text style={styles.noDataFound2}>No Data Found</Text>
                    </View>
                  </View>
                )}
                {userAtLastPit &&
                  activeBetweenIndex === -1 &&
                  nearestDistance > 5 &&
                  distanceFromLastPit > 5 &&
                  (() => {
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
                          marginTop: SIZE.MS(10),
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
                {isPastProjectEnd &&
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
                      nearestDistance > 5 &&
                      distanceFromLastPit > 5;

                    const bottomOffset =
                      totalHeight - 40 + (lastPitBannerAlsoShowing ? 46 : 0);

                    return (
                      <View
                        style={{
                          position: 'absolute',
                          flexDirection: 'row',
                          top: bottomOffset,
                          marginTop: SIZE.MS(12), // 👈 10-20 try karo
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
                            fontSize: 9,
                            color: COLORS.BLACK,
                            marginTop: 4,
                            fontFamily: FONTS.BOLD,
                          }}>
                          You are {formatDistance(distanceFromProjectEnd)} away
                          {'\n'}from Project End Point
                        </Text>
                      </View>
                    );
                  })()}
                {/* ── Add New Pit ── */}
                <View style={styles.bottomSection}>
                  <TouchableOpacity
                    onPress={handleAddNewPit}
                    disabled={loadingNewPit}
                    style={[
                      styles.addNewPitBtn,
                      canActuallyAddNewPit
                        ? styles.addNewPitBtnEnabled
                        : styles.addNewPitBtnDisabled,
                      loadingNewPit && styles.addNewPitBtnLoading,
                    ]}>
                    {loadingNewPit ? (
                      <View style={styles.addNewPitBtnRow}>
                        <ActivityIndicator
                          size={14}
                          color={COLORS.colorWhite}
                        />
                        <Text style={styles.addNewPitText}>
                          Getting location...
                        </Text>
                      </View>
                    ) : canActuallyAddNewPit ? (
                      <View style={styles.addNewPitBtnRow}>
                        <Animatable.Image
                          source={IMAGES.locationCheck}
                          animation="pulse"
                          iterationCount="infinite"
                          duration={900}
                          style={styles.addNewPitCheckIcon}
                          resizeMode="contain"
                        />
                        <Text style={styles.addNewPitText}>Add New Pit</Text>
                      </View>
                    ) : (
                      <View style={styles.addNewPitBtnRow}>
                        <Text style={styles.addPitBtnLockIcon}>🔒</Text>
                        <Text style={[styles.addNewPitText, {opacity: 0.75}]}>
                          Add New Pit
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {isOutOfProject ? (
                    <Text style={styles.addNewPitHint}>
                      You have crossed the Project End Point. New PIT cannot be
                      added.
                    </Text>
                  ) : !canAddNewPit && hasPits ? (
                    <Text style={styles.addNewPitHint}>
                      Walk to the last pit to enable this button.
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </ScrollView>
          {/* Where I am bar */}
          <TouchableOpacity
            style={[
              styles.whereAreYouBar,
              locLoading && styles.whereAreYouBarLoading,
            ]}
            activeOpacity={0.85}
            disabled={locLoading}
            onPress={handleWhereAmI}>
            {locLoading ? (
              <View style={styles.whereAmIRow}>
                <ActivityIndicator size={16} color={COLORS.colorWhite} />
                <Text style={styles.whereAreYouText}>Getting location...</Text>
              </View>
            ) : (
              <Text style={styles.whereAreYouText}>Where I am?</Text>
            )}
          </TouchableOpacity>
        </View>
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
                  {['pic1Url', 'pic2Url'].map((key, idx) => {
                    const url = (galleryData as any)?.[key];
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

      {/* ── Modal 1: All pits already added ── */}
      <Modal
        visible={pitModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPitModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setPitModalVisible(false)}
          />
          <View style={styles.modalContainer}>
            <View style={styles.rowItem}>
              <Image source={IMAGES.volumeIcon} />
              <Image source={IMAGES.waveIcon} />
            </View>
            <View style={[styles.card3, styles.cardLayout]}>
              <View style={[styles.cardbody2, styles.rowFlexBox]}>
                <Image
                  style={[styles.waveIcon, styles.iconLayout]}
                  resizeMode="contain"
                  source={IMAGES.warning}
                />
                <Image
                  style={[styles.headerIcon, styles.iconLayout]}
                  resizeMode="contain"
                  tintColor={COLORS.WARNING}
                  source={IMAGES.warning}
                />
                <View style={styles.text}>
                  <Text style={[styles.warningTitle, styles.warningFlexBox]}>
                    Warning / चेतावनी
                  </Text>
                  <Text style={[styles.allPitsFor, styles.warningFlexBox]}>
                    All pits for this project are already added.{'\n'}You cannot
                    add a new pit now.
                  </Text>
                  <Text style={[styles.allPitsFor, styles.warningFlexBox]}>
                    इस प्रोजेक्ट के लिए सभी Pit पहले ही जोड़ दिए गए हैं।{'\n'}अब
                    आप नया गड्ढा नहीं जोड़ सकते।
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setPitModalVisible(false)}
                style={[styles.cardbody, styles.colFlexBox]}>
                <View style={[styles.row, styles.rowFlexBox]}>
                  <View style={[styles.col, styles.colFlexBox]}>
                    <View style={[styles.a, styles.aFlexBox]}>
                      <Text style={[styles.close, styles.closeTypo]}>
                        Close
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.col2, styles.colFlexBox]}>
                    <View style={[styles.a2, styles.aFlexBox]}>
                      <Text style={styles.closeTypo}>Continue</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal 2: Pit distance warning ── */}
      <Modal
        visible={pitModalVisible2}
        transparent
        animationType="slide"
        onRequestClose={() => setPitModalVisible2(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setPitModalVisible2(false)}
          />
          <View style={styles.modalContainer}>
            <View style={styles.rowItem}>
              <Image source={IMAGES.volumeIcon} />
              <Image source={IMAGES.waveIcon} />
            </View>
            <View style={[styles.card3, styles.cardLayout]}>
              <View style={[styles.cardbody2, styles.rowFlexBox]}>
                <Image
                  style={[styles.waveIcon, styles.iconLayout]}
                  resizeMode="contain"
                  source={IMAGES.warning}
                />
                <Image
                  style={[styles.headerIcon, styles.iconLayout]}
                  resizeMode="contain"
                  tintColor={COLORS.WARNING}
                  source={IMAGES.warning}
                />
                <View style={styles.text}>
                  <Text style={[styles.warningTitle, styles.warningFlexBox]}>
                    Warning / चेतावनी
                  </Text>
                  <Text
                    style={[
                      styles.normallyPitsAreContainer,
                      styles.warningFlexBox,
                    ]}>
                    <Text style={styles.warningClr}>
                      Normally pits are installed every{' '}
                    </Text>
                    <Text style={styles.meters}>250 meters</Text>
                    <Text style={styles.warningClr}>
                      .{'\n'}This pit is only{' '}
                    </Text>
                    <Text
                      style={[
                        styles.meters,
                        {color: COLORS.ERROR, fontFamily: FONTS.SEMI_BOLD},
                      ]}>
                      150 meters
                    </Text>
                    <Text style={styles.warningClr}>
                      {' '}
                      away{'\n'}Are you sure you want to continue?
                    </Text>
                  </Text>
                  <Text
                    style={[
                      styles.normallyPitsAreContainer,
                      styles.warningFlexBox,
                    ]}>
                    <Text style={styles.warningClr}>आमतौर पर पिट </Text>
                    <Text
                      style={[
                        styles.meters,
                        {color: COLORS.SUCCESS, fontFamily: FONTS.SEMI_BOLD},
                      ]}>
                      250 मीटर
                    </Text>
                    <Text style={styles.warningClr}>
                      {' '}
                      पर लगती है,{'\n'}लेकिन यह पिट पिछली पिट से केवल{' '}
                    </Text>
                    <Text
                      style={[
                        styles.meters,
                        {color: COLORS.ERROR, fontFamily: FONTS.SEMI_BOLD},
                      ]}>
                      150 मीटर
                    </Text>
                    <Text style={styles.warningClr}>
                      {' '}
                      दूर है।{'\n'}क्या आप वाकई जारी रखना चाहते हैं?
                    </Text>
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setPitModalVisible2(false)}
                style={[styles.cardbody, styles.colFlexBox]}>
                s
                <View style={[styles.row, styles.rowFlexBox]}>
                  <View style={[styles.col, styles.colFlexBox]}>
                    <View style={[styles.a, styles.aFlexBox]}>
                      <Text style={[styles.close, styles.closeTypo]}>
                        Close
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.col2, styles.colFlexBox]}>
                    <View style={[styles.a2, styles.aFlexBox]}>
                      <Text style={styles.closeTypo}>Continue</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
};

// ─── PitCard ──────────────────────────────────────────────────────────────────
type PitCardProps = {
  pitId: string;
  lat: string;
  long: string;
  landmark: string;
  address: string;
  pic1Url: string | null;
  pic2Url: string | null;
  isNearest: boolean;
  onLayout: (h: number) => void;
  distanceToNext?: string | null;
  onViewImages: () => void;
  onViewOnMap: () => void;
};
const PitCard: FC<PitCardProps> = ({
  pitId,
  lat,
  long,
  landmark,
  address,
  pic1Url,
  pic2Url,
  isNearest,
  onLayout,
  onViewImages,
  onViewOnMap,
}) => {
  const hasImages = !!(pic1Url || pic2Url);
  return (
    <View
      style={[styles.pitCard, isNearest && styles.pitCardNearest]}
      onLayout={(e: LayoutChangeEvent) =>
        onLayout(e.nativeEvent.layout.height)
      }>
      <View style={styles.pitCardHeader}>
        <View
          style={[
            styles.pitBadge,
            isNearest && {backgroundColor: COLORS.SUCCESS ?? '#3EC21E'},
          ]}>
          <Text style={styles.pitBadgeText}>{pitId}</Text>
        </View>
        {isNearest && (
          <Animatable.View
            animation="pulse"
            iterationCount="infinite"
            duration={1200}
            style={styles.nearestTag}>
            <Text style={styles.nearestTagText}>📍 You are here</Text>
          </Animatable.View>
        )}
      </View>
      <Text style={styles.pitMetaText}>
        <Text style={styles.metaLabel}>Landmark: </Text>
        <Text style={styles.metaValue}>{landmark}</Text>
      </Text>
      <Text style={styles.pitAddress}>{address}</Text>
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <View style={styles.pitLatLong}>
          <Text style={styles.latLongText}>Lat: {lat}</Text>
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
            onPress={onViewImages}
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
        <Text style={styles.latLongText}>Long: {long}</Text>
      </View>
    </View>
  );
};

export default AddNewPIT;

// ─── Gallery Modal Styles ─────────────────────────────────────────────────────
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

// ─── Main Styles ──────────────────────────────────────────────────────────────
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
  scrollContent: {gap: 10, paddingBottom: 20, paddingHorizontal: 16},

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
  atLastPitBold: {fontFamily: FONTS.SEMI_BOLD, color: '#E65100'},

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
  betweenCorrEnabled: {fontFamily: FONTS.SEMI_BOLD, color: '#2E7D32'},

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
  ticketsParentFlexBox: {alignItems: 'center', flexDirection: 'row'},
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
  pitListContainer: {flexDirection: 'row', alignItems: 'stretch'},
  dashLineCol: {
    width: DASH_COL_WIDTH,
    position: 'relative',
    marginRight: 6,
    zIndex: 20,
  },
  nearestPinIcon: {
    position: 'absolute',
    width: DASH_COL_WIDTH,
    height: PIN_SIZE,
    zIndex: 10,
  },
  pitListRight: {flex: 1, gap: 0},
  noPitsWrap: {alignItems: 'center', paddingVertical: 10},
  Iconnew: {
    width: 125,
    height: 125,
    alignSelf: 'center',
    resizeMode: 'contain',
  },

  pitCard: {
    backgroundColor: COLORS.colorWhite,
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
    borderColor: COLORS.SUCCESS ?? '#3EC21E',
    backgroundColor: '#F0FFF4',
  },
  pitCardHeader: {flexDirection: 'row', alignItems: 'center', gap: Gap.gap_4},
  pitBadge: {
    backgroundColor: COLORS.PRIMARY,
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
    backgroundColor: '#E6F9EE',
    borderRadius: Border.br_5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.SUCCESS ?? '#3EC21E',
  },
  nearestTagText: {
    fontSize: FontSize.fs_10,
    color: COLORS.SUCCESS ?? '#3EC21E',
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
  destinationIcon: {
    height: 30,
    width: 30,
    resizeMode: 'contain',
    alignSelf: 'flex-end',
  },
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

  distanceToNextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: COLORS.colorGainsboro ?? '#e0e0e0',
    borderStyle: 'dashed',
  },
  distanceToNextRowIOS: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
    paddingTop: 5,
  },
  dashedTopBorderIOS: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    overflow: 'hidden',
    height: 1,
  },
  dashedTopSegIOS: {
    width: 4,
    height: 1,
    backgroundColor: COLORS.colorGainsboro ?? '#e0e0e0',
    marginRight: 3,
  },

  betweenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BETWEEN_ROW_H,
    marginVertical: 4,
    gap: 6,
    borderRadius: Border.br_6,
  },
  betweenRowActive: {
    backgroundColor: '#EBF5FB',
    borderWidth: 1,
    borderColor: '#1976D2',
    paddingHorizontal: 4,
  },
  distancePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.colorGray ?? '#f5f5f5',
    borderRadius: Border.br_6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    paddingLeft: 80,
  },
  arrowIcon: {width: 5, height: 11},
  distancePillText: {
    fontSize: FontSize.fs_11,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
    alignSelf: 'center',
    textAlign: 'center',
  },

  addPitBtn: {
    borderRadius: Border.br_6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  addPitBtnEnabled: {
    backgroundColor: COLORS.PRIMARY,
  },
  addPitBtnEnabledPadding: {paddingVertical: 12},
  addPitBtnDisabled: {
    backgroundColor: '#B0BEC5',
    elevation: 0,
    shadowOpacity: 0,
  },
  addPitBtnLoading: {backgroundColor: COLORS.colorDimgray ?? '#888'},
  addPitBtnRow: {flexDirection: 'row', alignItems: 'center', gap: 5},
  addPitBtnCheckIcon: {width: 16, height: 16},
  addPitBtnLockIcon: {fontSize: 11, color: '#fff'},
  addPitBtnText: {
    color: COLORS.colorWhite,
    fontSize: FontSize.fs_11,
    fontFamily: FONTS.MEDIUM,
  },
  addPitBtnTextDisabled: {color: '#ECEFF1'},

  bottomSection: {gap: 6, marginTop: 200},
  addNewPitBtn: {
    borderRadius: Border.br_8,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  addNewPitBtnEnabled: {backgroundColor: COLORS.PRIMARY},
  addNewPitBtnDisabled: {
    backgroundColor: '#B0BEC5',
    elevation: 0,
    shadowOpacity: 0,
  },
  addNewPitBtnLoading: {backgroundColor: COLORS.colorDimgray ?? '#888'},
  addNewPitBtnRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  addNewPitCheckIcon: {width: 20, height: 20},
  addNewPitText: {
    fontSize: 14,
    fontFamily: FONTS.REGULAR,
    color: COLORS.colorWhite,
  },
  addNewPitHint: {
    textAlign: 'center',
    fontSize: FontSize.fs_11,
    color: COLORS.colorDimgray ?? '#888',
    fontFamily: FONTS.REGULAR,
    marginTop: 2,
  },

  whereAreYouBar: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Border.br_8,
    marginHorizontal: 16,
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  whereAreYouBarLoading: {backgroundColor: COLORS.colorDimgray ?? '#888'},
  whereAmIRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  whereAmIIcon: {width: 22, height: 22},
  whereAreYouText: {
    fontSize: 16,
    fontFamily: FONTS.REGULAR,
    color: COLORS.colorWhite,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: COLORS.colorWhite,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    maxHeight: '80%',
  },
  rowItem: {flexDirection: 'row'},
  waveIcon: {height: 30, flex: 1},
  iconLayout: {maxWidth: '100%', overflow: 'hidden'},
  text: {gap: 10, alignSelf: 'stretch'},
  warningTitle: {
    fontSize: 20,
    fontWeight: '500',
    textAlign: 'center',
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
  },
  warningFlexBox: {
    textAlign: 'center',
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
    alignSelf: 'stretch',
  },
  warningClr: {
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
  },
  meters: {fontFamily: FONTS.SEMI_BOLD, color: COLORS.SUCCESS},
  allPitsFor: {fontSize: 13},
  normallyPitsAreContainer: {fontSize: 13},
  card3: {paddingHorizontal: 24, paddingVertical: 0, gap: 26, marginTop: -1},
  cardbody2: {alignSelf: 'stretch'},
  headerIcon: {height: 40, alignSelf: 'stretch', width: '100%'},
  cardbody: {alignSelf: 'stretch'},
  colFlexBox: {justifyContent: 'center', alignItems: 'center'},
  row: {flexDirection: 'row', width: '100%'},
  rowFlexBox: {gap: Gap.gap_16, justifyContent: 'center', alignItems: 'center'},
  col: {flex: 1, flexDirection: 'row'},
  a: {paddingVertical: 13},
  close: {opacity: 1},
  col2: {width: 151, display: 'none', flexDirection: 'row'},
  a2: {paddingVertical: 9, maxWidth: 200},
  cardLayout: {maxWidth: 430, overflow: 'hidden', width: '100%'},
  aFlexBox: {
    paddingHorizontal: Padding.padding_20,
    backgroundColor: '#535455',
    borderRadius: Border.br_8,
    flex: 1,
    flexDirection: 'row',
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeTypo: {
    textAlign: 'left',
    color: COLORS.colorWhite,
    fontSize: FontSize.fs_14,
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
  },
  nodatafounddivnew: {justifyContent: 'center', alignSelf: 'stretch'},
  noDataFound2: {
    fontSize: 15,
    color: COLORS.colorDarkslategray300,
    opacity: 0.6,
    textAlign: 'left',
    fontFamily: FONTS.REGULAR,
  },
  btnIcon: {
    height: 30,
    width: 30,
    backgroundColor: '#e8f0fe',
    resizeMode: 'contain',
  },
  projectEndCrossedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDECEA',
    borderWidth: 1.5,
    borderColor: COLORS.ERROR,
    borderRadius: Border.br_8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  projectEndCrossedText: {
    flex: 1,
    fontSize: FontSize.fs_12,
    color: '#B71C1C',
    fontFamily: FONTS.REGULAR,
  },
  projectEndCrossedBold: {fontFamily: FONTS.SEMI_BOLD, color: COLORS.ERROR},
});
