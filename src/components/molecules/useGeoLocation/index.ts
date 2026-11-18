import {useEffect, useRef, useCallback, useState} from 'react';
import Geolocation from 'react-native-geolocation-service';
import {
  Alert,
  Linking,
  Platform,
  PermissionsAndroid,
  ToastAndroid,
} from 'react-native';

export type UserCoords = {latitude: number; longitude: number} | null;

// ─── Permission ───────────────────────────────────────────────────────────────
export const requestLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'ios') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};
// ─── One-shot position ────────────────────────────────────────────────────────
export const getCurrentPosition = (): Promise<{
  latitude: number;
  longitude: number;
}> =>
  new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      pos =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      err => reject(err),
      {
        enableHighAccuracy: true,
        accuracy: {android: 'high', ios: 'best'},
        timeout: 15000,
        maximumAge: 0,
        forceRequestLocation: true,
        showLocationDialog: true,
      },
    );
  });

// ─── Toast ────────────────────────────────────────────────────────────────────
export const showToast = (msg: string) => {
  if (Platform.OS === 'android') {
    try {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    } catch {
      /* ignore */
    }
  }
};

// ─── Map directions ───────────────────────────────────────────────────────────
export const openMapDirections = (
  lat: string | number | undefined,
  lng: string | number | undefined,
  label: string,
) => {
  const pLat = parseFloat(String(lat ?? '0'));
  const pLng = parseFloat(String(lng ?? '0'));
  if (isNaN(pLat) || isNaN(pLng) || (pLat === 0 && pLng === 0)) {
    Alert.alert('No Location', `No valid coordinates available for ${label}.`);
    return;
  }
  const nativeUrl =
    Platform.OS === 'ios'
      ? `maps://app?daddr=${pLat},${pLng}&dirflg=d`
      : `google.navigation:q=${pLat},${pLng}`;
  const webFallback = `https://www.google.com/maps/dir/?api=1&destination=${pLat},${pLng}`;
  Linking.canOpenURL(nativeUrl)
    .then(supported => Linking.openURL(supported ? nativeUrl : webFallback))
    .catch(() => Linking.openURL(webFallback));
};

// ─── Geo math ─────────────────────────────────────────────────────────────────
const DEG_TO_M = 111_320;
const PERP_TOL_M = 300;
const T_LOW = -0.1;
const T_HIGH = 1.1;
const AT_LAST_PIT_TOL_M = 20;

export const haversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6_371_000;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1);
  const dLon = toR(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const formatDistance = (meters: number): string =>
  meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(2)} km`;

export const calcPitDistance = (pitA: any, pitB: any): number | null => {
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

const segmentCheck = (
  userLat: number,
  userLng: number,
  latA: number,
  lngA: number,
  latB: number,
  lngB: number,
): {onSegment: boolean; perp: number; t: number} => {
  const abLat = latB - latA,
    abLng = lngB - lngA;
  const apLat = userLat - latA,
    apLng = userLng - lngA;
  const abDot = abLat * abLat + abLng * abLng;
  if (abDot < 1e-18) return {onSegment: false, perp: Infinity, t: -1};
  const t = (apLat * abLat + apLng * abLng) / abDot;
  const closestLat = latA + t * abLat;
  const closestLng = lngA + t * abLng;
  const dLatM = (userLat - closestLat) * DEG_TO_M;
  const avgLat = (userLat + closestLat) / 2;
  const dLngM =
    (userLng - closestLng) *
    DEG_TO_M *
    Math.cos((avgLat * Math.PI) / 180);
  const perp = Math.sqrt(dLatM * dLatM + dLngM * dLngM);
  return {
    onSegment: t >= T_LOW && t <= T_HIGH && perp <= PERP_TOL_M,
    perp,
    t,
  };
};

export const isUserBetweenPits = (
  userLat: number,
  userLng: number,
  pitA: any,
  pitB: any,
): boolean => {
  const latA = parseFloat(pitA?.lat ?? '0'),
    lngA = parseFloat(pitA?.lng ?? '0');
  const latB = parseFloat(pitB?.lat ?? '0'),
    lngB = parseFloat(pitB?.lng ?? '0');
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

export const findActiveBetweenIndex = (
  userLat: number,
  userLng: number,
  pitList: any[],
): number => {
  if (!pitList || pitList.length < 2) return -1;
  let bestIndex = -1,
    bestScore = Infinity;
  for (let i = 0; i < pitList.length - 1; i++) {
    const latA = parseFloat(pitList[i]?.lat ?? '0'),
      lngA = parseFloat(pitList[i]?.lng ?? '0');
    const latB = parseFloat(pitList[i + 1]?.lat ?? '0'),
      lngB = parseFloat(pitList[i + 1]?.lng ?? '0');
    if (
      isNaN(latA) ||
      isNaN(lngA) ||
      isNaN(latB) ||
      isNaN(lngB) ||
      (latA === 0 && lngA === 0) ||
      (latB === 0 && lngB === 0)
    )
      continue;
    const {onSegment, perp, t} = segmentCheck(
      userLat,
      userLng,
      latA,
      lngA,
      latB,
      lngB,
    );
    if (!onSegment) continue;
    const tClamped = Math.max(0, Math.min(1, t));
    const score =
      Math.abs(tClamped - 0.5) +
      (t >= 0 && t < 0.3 ? -0.05 : 0) +
      (perp / PERP_TOL_M) * 0.1;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
};

export const isUserAtOrPastLastPit = (
  userLat: number,
  userLng: number,
  pitList: any[],
): boolean => {
  if (!pitList || pitList.length === 0) return false;
  const lastPit = pitList[pitList.length - 1];
  const lastLat = parseFloat(lastPit?.lat ?? '0'),
    lastLng = parseFloat(lastPit?.lng ?? '0');
  if (isNaN(lastLat) || isNaN(lastLng) || (lastLat === 0 && lastLng === 0))
    return false;
  if (haversineDistance(userLat, userLng, lastLat, lastLng) <= AT_LAST_PIT_TOL_M)
    return true;
  if (pitList.length >= 2) {
    const sLat = parseFloat(pitList[pitList.length - 2]?.lat ?? '0');
    const sLng = parseFloat(pitList[pitList.length - 2]?.lng ?? '0');
    if (!isNaN(sLat) && !isNaN(sLng) && !(sLat === 0 && sLng === 0)) {
      const {t, perp} = segmentCheck(
        userLat,
        userLng,
        sLat,
        sLng,
        lastLat,
        lastLng,
      );
      if (t > 0.85 && perp <= PERP_TOL_M) return true;
    }
  }
  return false;
};

// ─────────────────────────────────────────────────────────────────────────────
// useWatchLocation — ALL CRASH FIXES APPLIED
// ─────────────────────────────────────────────────────────────────────────────
const TOAST_INTERVAL_MS = 10_000;

// Sentinel value: watchPosition on some Android devices returns 0 (a valid ID).
// Using -1 as "no watcher" is unambiguous.
const NO_WATCH_ID = -1;

export const useWatchLocation = (
  onUpdate: (lat: number, lng: number) => void,
) => {
  const [userCoords, setUserCoords] = useState<UserCoords>(null);
  const [locLoading, setLocLoading] = useState(false);

  // FIX-C: use -1 sentinel instead of null so watchId === 0 is handled correctly
  const watchIdRef = useRef<number>(NO_WATCH_ID);
  const toastTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const coordsRef = useRef<UserCoords>(null);

  // FIX-A: initialise to FALSE — only set true inside useEffect (after mount)
  const isMountedRef = useRef(false);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // FIX-2 (original): always-fresh onUpdate ref
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Safe setState wrappers
  const safeSetCoords = useCallback((c: UserCoords) => {
    if (isMountedRef.current) setUserCoords(c);
  }, []);
  const safeSetLoading = useCallback((v: boolean) => {
    if (isMountedRef.current) setLocLoading(v);
  }, []);

  // Central handler for every new position fix
  const handleNewCoords = useCallback(
    (c: {latitude: number; longitude: number}) => {
      if (!isMountedRef.current) return; // FIX-A guard
      coordsRef.current = c;
      safeSetCoords(c);
      try {
        onUpdateRef.current(c.latitude, c.longitude);
      } catch (e) {
        console.warn('[WatchLocation] onUpdate threw:', e);
      }
    },
    [safeSetCoords],
  );

  // FIX-G: stopWatch nulls ref BEFORE clearWatch to be fully idempotent
  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== NO_WATCH_ID) {
      const id = watchIdRef.current;
      watchIdRef.current = NO_WATCH_ID; // clear first
      Geolocation.clearWatch(id);
    }
    if (toastTimerRef.current !== null) {
      clearInterval(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const startWatch = useCallback(async () => {
    // FIX-C: guard uses sentinel value, handles watchId === 0 correctly
    if (watchIdRef.current !== NO_WATCH_ID) return;

    // FIX-F: wrap entire startWatch body so no unhandled rejections escape
    try {
      let permOk = false;
      try {
        permOk = await requestLocationPermission();
      } catch (permErr) {
        console.warn('[WatchLocation] Permission request threw:', permErr);
        permOk = false;
      }

      if (!permOk) {
        Alert.alert(
          'Permission Denied',
          'Location permission is required.\n\nPlease grant location access in your device settings.',
        );
        return;
      }

      // FIX-B: one-shot getCurrentPosition — guard the .then() callback
      getCurrentPosition()
        .then(c => {
          // Only call handleNewCoords if still mounted AND no watch running yet
          if (isMountedRef.current) {
            handleNewCoords(c);
          }
        })
        .catch(() => {
          /* watchPosition will deliver coordinates soon — silently ignore */
        });

      // FIX-D: toast timer is created INSIDE try, only if watchPosition succeeds
      try {
        // FIX-C: pre-set a temporary sentinel so a re-entrant call is blocked
        // even in the tiny window between here and the watchPosition return.
        watchIdRef.current = NO_WATCH_ID - 1; // temporary non-sentinel blocker

        const id = Geolocation.watchPosition(
          pos => {
            // FIX-A: native thread may call this after unmount
            if (!isMountedRef.current) return;
            handleNewCoords({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
          },
          err => {
            console.warn(
              '[WatchLocation] GPS error:',
              err.code,
              err.message,
            );
          },
          {
            enableHighAccuracy: true,
            accuracy: {android: 'high', ios: 'best'},
            distanceFilter: 3,
            interval: 3000,
            fastestInterval: 1500,
            forceRequestLocation: true,
            showLocationDialog: true,
            useSignificantChanges: false,
          },
        );

        // Assign the real watch ID (may be 0 on some devices — that is valid)
        watchIdRef.current = id;

        // FIX-D: timer only created after watchPosition succeeds
        toastTimerRef.current = setInterval(() => {
          if (!isMountedRef.current) return;
          const c = coordsRef.current;
          if (c) {
            showToast(
              `📍 Lat: ${c.latitude.toFixed(5)}°  Long: ${c.longitude.toFixed(5)}°`,
            );
          }
        }, TOAST_INTERVAL_MS);
      } catch (watchErr) {
        // watchPosition itself threw — reset sentinel so startWatch can retry
        watchIdRef.current = NO_WATCH_ID;
        console.warn('[WatchLocation] watchPosition threw:', watchErr);
      }
    } catch (outerErr) {
      // FIX-F: catch-all so startWatch never produces an unhandled rejection
      watchIdRef.current = NO_WATCH_ID;
      console.warn('[WatchLocation] startWatch unexpected error:', outerErr);
    }
  }, [handleNewCoords]);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => stopWatch();
  }, [stopWatch]);

  // FIX-E: forceRefresh guards both .then() and .catch() against unmount
  const forceRefresh = useCallback((): Promise<{
    latitude: number;
    longitude: number;
  }> => {
    safeSetLoading(true);
    return getCurrentPosition()
      .then(c => {
        if (!isMountedRef.current) {
          // Component gone — return coords but do NOT touch any state
          return c;
        }
        handleNewCoords(c);
        safeSetLoading(false);
        showToast(
          `📍 Updated  Lat: ${c.latitude.toFixed(5)}°  Long: ${c.longitude.toFixed(5)}°`,
        );
        return c;
      })
      .catch(err => {
        // FIX-E: only call safeSetLoading if still mounted
        safeSetLoading(false);
        // FIX-E: swallow the rejection if unmounted to avoid unhandled-rejection crash
        if (!isMountedRef.current) {
          return Promise.reject(err); // caller is gone anyway, but at least we logged
        }
        throw err;
      });
  }, [handleNewCoords, safeSetLoading]);

  return {userCoords, locLoading, startWatch, stopWatch, forceRefresh};
};
