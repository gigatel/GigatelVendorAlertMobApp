import type {GeolocationResponse} from '@react-native-community/geolocation';
import Geolocation, {
  GeoError,
  GeoPosition,
} from 'react-native-geolocation-service';
import {Platform} from 'react-native';
import {checkPermission} from './location';

export const CHAMBER_RADIUS_METRES = 100;

export const MAX_LOCATION_AGE_MS = 10000;
const TARGET_LOCATION_ACCURACY_METRES = 15;
const LOCATION_ACQUISITION_TIMEOUT_MS = 30000;
const LOCATION_RETRY_INTERVAL_MS = 1000;

export type ChamberLocation = GeolocationResponse & {mocked?: boolean};
export type LocationEvidence = {position: ChamberLocation; verifiedAt: number};

export const isChamberLocationFresh = (
  position: ChamberLocation | null | undefined,
  now = Date.now(),
): boolean => {
  const timestamp = position?.timestamp;
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    return false;
  }
  const age = now - timestamp;
  return Number.isFinite(age) && age >= 0 && age <= MAX_LOCATION_AGE_MS;
};

const coordinate = (value: unknown, limit: number): number => {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && !value.trim())
  ) {
    throw new Error('Chamber or GPS coordinates are missing.');
  }
  const result = Number(value);
  if (!Number.isFinite(result) || Math.abs(result) > limit) {
    throw new Error('Chamber or GPS coordinates are invalid.');
  }
  return result;
};

// Distance display must also work outside the permitted radius. Authorization
// still goes through validateChamberLocation with freshness and mock-location checks.
export const calculateChamberDistance = (
  latitude: unknown,
  longitude: unknown,
  chamberLat: unknown,
  chamberLong: unknown,
): number => {
  const lat = coordinate(latitude, 90);
  const lon = coordinate(longitude, 180);
  const targetLat = coordinate(chamberLat, 90);
  const targetLon = coordinate(chamberLong, 180);
  const radians = (value: number) => (value * Math.PI) / 180;
  const a =
    Math.sin(radians(targetLat - lat) / 2) ** 2 +
    Math.cos(radians(lat)) *
      Math.cos(radians(targetLat)) *
      Math.sin(radians(targetLon - lon) / 2) ** 2;
  const distance =
    6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
  return distance;
};

export const validateChamberLocation = (
  position: ChamberLocation,
  chamberLat: unknown,
  chamberLong: unknown,
  now = Date.now(),
): number => {
  const distance = calculateChamberDistance(
    position?.coords?.latitude,
    position?.coords?.longitude,
    chamberLat,
    chamberLong,
  );
  if (
    position.mocked ||
    (position.coords as typeof position.coords & {mocked?: boolean}).mocked
  ) {
    throw new Error(
      'Mock locations are not allowed. Disable mock location and try again.',
    );
  }
  const age = now - position.timestamp;
  if (
    !Number.isFinite(position.timestamp) ||
    !Number.isFinite(age) ||
    age < 0 ||
    age > MAX_LOCATION_AGE_MS
  ) {
    throw new Error(
      'GPS location is old or unavailable. Please get a fresh location and try again.',
    );
  }
  if (!Number.isFinite(distance) || distance > CHAMBER_RADIUS_METRES) {
    throw new Error(
      `You must be within ${CHAMBER_RADIUS_METRES} metres of the chamber. Current distance: ${distance.toFixed(
        1,
      )} m.`,
    );
  }
  return distance;
};

const locationRequestError = (error: GeoError): Error => {
  switch (error.code) {
    case 1:
      return new Error(
        'Location permission is denied. Allow precise location for this app in Settings.',
      );
    case 3:
      return new Error(
        'GPS timed out while finding your location. Move to an open area and try again.',
      );
    case 5:
      return new Error(
        'Location services are disabled or not accurate enough. Turn on Location and Google Location Accuracy, then try again.',
      );
    case 4:
      return new Error(
        'Location provider is unavailable. Check Google Play services and try again.',
      );
    default:
      return new Error(
        `GPS could not obtain a location${
          error.message
            ? `: ${error.message}`
            : '. Move to an open area and try again.'
        }`,
      );
  }
};

// Prefer a precise fix, but allow the best fresh reading at the deadline.
// Keep the original device coordinates, accuracy and timestamp intact.
const requestChamberPosition = (
  recentPosition?: ChamberLocation,
  preferAccuracy = true,
): Promise<ChamberLocation> =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + LOCATION_ACQUISITION_TIMEOUT_MS;
    let settled = false;
    let attempt = 0;
    const candidates: ChamberLocation[] = recentPosition
      ? [recentPosition]
      : [];
    const accuracyScore = (fix: ChamberLocation) => {
      const accuracy = fix.coords.accuracy;
      return Number.isFinite(accuracy) && accuracy > 0 ? accuracy : Infinity;
    };
    let lastError = locationRequestError({code: 3} as GeoError);
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: Error, position?: ChamberLocation) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutTimer);
      if (retryTimer !== undefined) {
        clearTimeout(retryTimer);
      }
      if (position) {
        resolve(position);
      } else {
        reject(error);
      }
    };
    const timeoutTimer = setTimeout(() => {
      const fresh = candidates.filter(fix => {
        const age = Date.now() - fix.timestamp;
        return Number.isFinite(age) && age >= 0 && age <= MAX_LOCATION_AGE_MS;
      });
      const best = fresh.reduce<ChamberLocation | undefined>(
        (selected, fix) =>
          !selected || accuracyScore(fix) <= accuracyScore(selected)
            ? fix
            : selected,
        undefined,
      );
      finish(lastError, best);
    }, LOCATION_ACQUISITION_TIMEOUT_MS);
    const retry = () => {
      if (!settled) {
        retryTimer = setTimeout(request, LOCATION_RETRY_INTERVAL_MS);
      }
    };
    const request = () => {
      if (settled || Date.now() >= deadline) {
        return;
      }
      // Alternate fused and raw GPS on Android, rather than accepting whichever
      // provider responds first regardless of its accuracy.
      const forceLocationManager =
        Platform.OS === 'android' && attempt % 2 === 1;
      attempt += 1;
      Geolocation.getCurrentPosition(
        (position: GeoPosition) => {
          if (settled) {
            return;
          }
          const fix: ChamberLocation = {
            ...position,
            coords: {
              ...position.coords,
              altitudeAccuracy: position.coords.altitudeAccuracy ?? null,
            },
          };
          // Return mock fixes to validation so they fail immediately.
          if (
            fix.mocked ||
            (fix.coords as typeof fix.coords & {mocked?: boolean}).mocked
          ) {
            finish(undefined, fix);
            return;
          }
          const age = Date.now() - fix.timestamp;
          if (!Number.isFinite(age) || age < 0 || age > MAX_LOCATION_AGE_MS) {
            lastError = new Error(
              'GPS location is old or unavailable. Please get a fresh location and try again.',
            );
            retry();
            return;
          }
          candidates.push(fix);
          if (
            !preferAccuracy ||
            accuracyScore(fix) <= TARGET_LOCATION_ACCURACY_METRES
          ) {
            finish(undefined, fix);
            return;
          }
          retry();
        },
        error => {
          if (settled) {
            return;
          }
          lastError = locationRequestError(error);
          if (error.code === 1 || error.code === 5) {
            finish(lastError);
            return;
          }
          retry();
        },
        {
          enableHighAccuracy: true,
          accuracy: {android: 'high', ios: 'bestForNavigation'},
          maximumAge: 0,
          timeout: Math.min(10000, deadline - Date.now()),
          showLocationDialog: !forceLocationManager,
          forceRequestLocation: true,
          forceLocationManager,
        },
      );
    };
    request();
  });

export const getVerifiedChamberLocation = async (
  chamberLat: unknown,
  chamberLong: unknown,
  recentPosition?: ChamberLocation | null,
  options:
    | number
    | {maxAgeMs?: number; preferAccuracy?: boolean} = MAX_LOCATION_AGE_MS,
): Promise<LocationEvidence> => {
  const {maxAgeMs = MAX_LOCATION_AGE_MS, preferAccuracy = true} =
    typeof options === 'number' ? {maxAgeMs: options} : options;
  const permission = await checkPermission();
  if (permission !== 'granted') {
    throw new Error(
      'Precise location access is required. Turn on Location and allow precise location for this app in Settings.',
    );
  }

  let position: ChamberLocation | undefined;

  // 1) watchPosition ka recent fix valid ho to wahi use karo (no GPS wait)
  if (recentPosition && Date.now() - recentPosition.timestamp <= maxAgeMs) {
    try {
      validateChamberLocation(
        recentPosition,
        chamberLat,
        chamberLong,
        Date.now(),
      );
      position = recentPosition;
    } catch {
      position = undefined; // Invalid evidence requires a new fix.
    }
  }
  // Accuracy is a fetching preference, never a submission rejection condition.
  const accuracy = position?.coords.accuracy ?? Infinity;
  if (
    !position ||
    (preferAccuracy &&
      (!Number.isFinite(accuracy) ||
        accuracy <= 0 ||
        accuracy > TARGET_LOCATION_ACCURACY_METRES))
  ) {
    position = await requestChamberPosition(position, preferAccuracy);
  }

  const verifiedAt = Date.now();
  validateChamberLocation(position, chamberLat, chamberLong, verifiedAt);
  return {position, verifiedAt};
};

// Validate historical evidence at sync time, not the phone's location at upload.
// Legacy records are retained locally because they have no verifiable evidence.
export const isOfflineChamberTaskValid = (task: any): boolean => {
  try {
    const evidence = task.geofenceEvidence;
    if (
      evidence?.version !== 1 ||
      evidence.photos?.length !== 2 ||
      task.reportingImage?.length !== 2
    ) {
      return false;
    }
    const submission = evidence.submission as LocationEvidence;
    if (
      !Number.isFinite(submission?.verifiedAt) ||
      submission.verifiedAt > Date.now()
    ) {
      return false;
    }
    validateChamberLocation(
      submission.position,
      task.chamberLat,
      task.chamberLon,
      submission.verifiedAt,
    );
    if (
      coordinate(task.lat, 90) !== submission.position.coords.latitude ||
      coordinate(task.lon, 180) !== submission.position.coords.longitude
    ) {
      return false;
    }
    return evidence.photos.every((photo: LocationEvidence, index: number) => {
      if (
        !Number.isFinite(photo?.verifiedAt) ||
        photo.verifiedAt > submission.verifiedAt ||
        !task.reportingImage[index]?.imageUrl
      ) {
        return false;
      }
      validateChamberLocation(
        photo.position,
        task.chamberLat,
        task.chamberLon,
        photo.verifiedAt,
      );
      return true;
    });
  } catch {
    return false;
  }
};
