import {Platform} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {
  PERMISSIONS,
  RESULTS,
  check,
  request,
  requestMultiple,
  checkLocationAccuracy,
  requestLocationAccuracy,
} from 'react-native-permissions';
import {
  isLocationEnabled,
  promptForEnableLocationIfNeeded,
} from 'react-native-android-location-enabler';

type GpsSample = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export type CurrentGpsLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  samplesUsed: number;
};

Geolocation.setRNConfiguration({
  skipPermissionRequests: true,
  authorizationLevel: 'whenInUse',
  locationProvider: 'android',
});

// GPS configuration
const MAX_READING_AGE_MS = 15000;
const WARMUP_DISCARD_COUNT = 1;
const BEST_SAMPLES_ON_TIMEOUT = 5;
const MAX_ACCEPTABLE_ACCURACY = 100;
const MAX_SAMPLE_SPREAD = 10;

// Calculate distance between two GPS coordinates.
const calculateDistanceMeters = (
  firstLatitude: number,
  firstLongitude: number,
  secondLatitude: number,
  secondLongitude: number,
): number => {
  const radius = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const latitudeDifference = toRadians(secondLatitude - firstLatitude);
  const longitudeDifference = toRadians(secondLongitude - firstLongitude);

  const firstLatitudeRadians = toRadians(firstLatitude);
  const secondLatitudeRadians = toRadians(secondLatitude);

  const value =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitudeRadians) *
      Math.cos(secondLatitudeRadians) *
      Math.sin(longitudeDifference / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

// Calculate median value.
const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// Drops samples that sit far from the median centre.
const rejectOutliers = (samples: GpsSample[]): GpsSample[] => {
  if (samples.length < 3) {
    return samples;
  }

  const centerLat = median(samples.map(s => s.latitude));
  const centerLng = median(samples.map(s => s.longitude));

  const kept = samples.filter(
    s =>
      calculateDistanceMeters(s.latitude, s.longitude, centerLat, centerLng) <=
      Math.max(s.accuracy, 10),
  );

  // Return filtered samples, or original samples if all were rejected.
  return kept.length > 0 ? kept : samples;
};

// Calculate accuracy-weighted GPS position.
const calculateWeightedPosition = (
  samples: GpsSample[],
): CurrentGpsLocation => {
  let latitudeTotal = 0;
  let longitudeTotal = 0;
  let weightTotal = 0;
  let bestAccuracy = Number.POSITIVE_INFINITY;

  samples.forEach(sample => {
    const weight = 1 / Math.max(sample.accuracy ** 2, 1);

    latitudeTotal += sample.latitude * weight;
    longitudeTotal += sample.longitude * weight;
    weightTotal += weight;

    bestAccuracy = Math.min(bestAccuracy, sample.accuracy);
  });

  return {
    latitude: latitudeTotal / weightTotal,
    longitude: longitudeTotal / weightTotal,
    accuracy: bestAccuracy,
    samplesUsed: samples.length,
  };
};
// Request location permission.
const requestLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    const gpsEnabled = await isLocationEnabled();
    if (!gpsEnabled) {
      try {
        await promptForEnableLocationIfNeeded();
      } catch {
        return false;
      }
    }
    const fineStatus = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
    if (fineStatus === RESULTS.GRANTED) {
      return true;
    }
    const statuses = await requestMultiple([
      PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
      PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    ]);
    return (
      statuses[PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION] === RESULTS.GRANTED
    );
  }

  let permissionStatus = await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);

  if (permissionStatus !== RESULTS.GRANTED) {
    permissionStatus = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
  }

  if (permissionStatus !== RESULTS.GRANTED) {
    return false;
  }

  try {
    const accuracyStatus = await checkLocationAccuracy();

    if (accuracyStatus === 'reduced') {
      const requestedAccuracy = await requestLocationAccuracy({
        purposeKey: 'PitLocation',
      });

      return requestedAccuracy === 'full';
    }
  } catch (error) {
    console.log('iOS precise-location check failed:', error);
  }

  return true;
};

/**
 * Collects live GPS fixes and returns the best lat/long it can get.
 *
 * - Finishes early when minimumSamples fixes meet targetAccuracy
 *   and agree with each other.
 * - On timeout, returns the weighted average of the best samples.
 * - Rejects when permission is denied, accuracy is too low,
 *   or no GPS signal arrives.
 */
export const fetchCurrentGpsLocation = async ({
  targetAccuracy = 15,
  minimumSamples = 4,
  timeout = 45000,
}: {
  targetAccuracy?: number;
  minimumSamples?: number;
  timeout?: number;
} = {}): Promise<CurrentGpsLocation> => {
  const permissionGranted = await requestLocationPermission();

  if (!permissionGranted) {
    throw new Error(
      'Precise location permission was not granted. Enable Precise Location from app settings.',
    );
  }

  return new Promise((resolve, reject) => {
    let watchId: number | null = null;
    let completed = false;
    let readingCount = 0;

    const allSamples: GpsSample[] = [];
    const goodSamples: GpsSample[] = [];

    const cleanup = () => {
      clearTimeout(timeoutId);

      if (watchId !== null) {
        Geolocation.clearWatch(watchId);
        watchId = null;
      }
    };

    const finish = (result: CurrentGpsLocation) => {
      if (completed) {
        return;
      }

      completed = true;
      cleanup();
      resolve(result);
    };

    const timeoutId = setTimeout(() => {
      if (completed) {
        return;
      }

      completed = true;
      cleanup();

      // Only fresh, non-mocked samples are stored here.
      const usable = allSamples.filter(
        s => s.accuracy <= MAX_ACCEPTABLE_ACCURACY,
      );

      if (usable.length > 0) {
        const best = [...usable]
          .sort((a, b) => a.accuracy - b.accuracy)
          .slice(0, BEST_SAMPLES_ON_TIMEOUT);

        resolve(calculateWeightedPosition(rejectOutliers(best)));
        return;
      }

      if (allSamples.length > 0) {
        const bestAccuracy = Math.min(...allSamples.map(s => s.accuracy));

        reject(
          new Error(
            `GPS accuracy is too low (best ${Math.round(
              bestAccuracy,
            )}m). Move to an open area and tap Get GPS again.`,
          ),
        );
        return;
      }

      reject(
        new Error(
          'No GPS signal received. Make sure Location is ON, then move to an open area and retry.',
        ),
      );
    }, timeout);

    watchId = Geolocation.watchPosition(
      position => {
        if (completed) {
          return;
        }

        const latitude = Number(position.coords.latitude);
        const longitude = Number(position.coords.longitude);
        const accuracy = Number(position.coords.accuracy);

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          !Number.isFinite(accuracy) ||
          accuracy <= 0
        ) {
          return;
        }

        const readingAge = Math.abs(Date.now() - Number(position.timestamp));

        if (Number.isFinite(readingAge) && readingAge > MAX_READING_AGE_MS) {
          console.log('Discarding stale/cached GPS fix, age(ms):', readingAge);
          return;
        }

        if ((position as any).mocked) {
          console.log('Discarding mocked GPS fix');
          return;
        }

        readingCount += 1;

        if (readingCount <= WARMUP_DISCARD_COUNT) {
          console.log('Discarding warm-up GPS fix #', readingCount);
          return;
        }

        console.log('GPS reading:', {
          latitude,
          longitude,
          accuracyInMeters: accuracy,
          readingAge,
        });

        const sample = {
          latitude,
          longitude,
          accuracy,
        };

        allSamples.push(sample);

        if (allSamples.length > 30) {
          allSamples.shift();
        }

        if (accuracy > targetAccuracy) {
          return;
        }

        goodSamples.push(sample);

        if (goodSamples.length > 10) {
          goodSamples.shift();
        }
        if (goodSamples.length < minimumSamples) {
          return;
        }
        const samplesToUse = goodSamples.slice(-minimumSamples);
        // Calculate median centre.
        const centerLat = median(samplesToUse.map(s => s.latitude));
        const centerLng = median(samplesToUse.map(s => s.longitude));
        // Calculate maximum GPS spread.
        const maximumSpread = Math.max(
          ...samplesToUse.map(s =>
            calculateDistanceMeters(
              s.latitude,
              s.longitude,
              centerLat,
              centerLng,
            ),
          ),
        );
        console.log('GPS stability:', {
          samples: samplesToUse.length,
          maximumSpread,
        });
        if (maximumSpread <= MAX_SAMPLE_SPREAD) {
          finish(calculateWeightedPosition(samplesToUse));
        }
      },
      error => {
        console.log('GPS error:', error);
        if (completed) {
          return;
        }
        if (error.code === 1) {
          completed = true;
          cleanup();

          reject(new Error('Precise location permission was not granted.'));
        }
        // Other errors retry until the main timeout.
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout,
        distanceFilter: 0,
        interval: 1000,
        fastestInterval: 500,
      },
    );
  });
};
