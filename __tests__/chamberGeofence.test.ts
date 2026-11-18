import Geolocation from 'react-native-geolocation-service';
import {Platform} from 'react-native';
import {checkPermission} from '../src/utils/location';
import {
  ChamberLocation,
  getVerifiedChamberLocation,
  isOfflineChamberTaskValid,
  validateChamberLocation,
} from '../src/utils/chamberGeofence';

jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: jest.fn(),
}));

jest.mock('../src/utils/location', () => ({
  checkPermission: jest.fn(async () => 'granted'),
}));

const now = 1800000000000;
const position = (
  overrides: Partial<ChamberLocation> = {},
): ChamberLocation => ({
  coords: {
    latitude: 0,
    longitude: 0,
    accuracy: 5,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: now,
  ...overrides,
});
const evidence = () => ({position: position(), verifiedAt: now});
const task = () => ({
  lat: '0',
  lon: '0',
  chamberLat: '0',
  chamberLon: '0',
  reportingImage: [{imageUrl: 'first-photo'}, {imageUrl: 'second-photo'}],
  geofenceEvidence: {
    version: 1,
    submission: evidence(),
    photos: [evidence(), evidence()],
  },
});

beforeEach(() => {
  jest.useFakeTimers({now});
  jest.clearAllMocks();
  (Geolocation.getCurrentPosition as jest.Mock).mockReset();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('accepts valid zero coordinates and numeric strings', () => {
  expect(validateChamberLocation(position(), '0', '0', now)).toBe(0);
});
test('enforces 100 metres without rounding 100.1 metres down', () => {
  const longitudeAtDistance = (metres: number) =>
    ((metres / 6371000) * 180) / Math.PI;
  expect(
    validateChamberLocation(position(), 0, longitudeAtDistance(99.9), now),
  ).toBeCloseTo(99.9);
  expect(() =>
    validateChamberLocation(position(), 0, longitudeAtDistance(100.1), now),
  ).toThrow('within 100');
});
test.each([null, undefined, '', ' ', '12garbage', NaN, Infinity, 91])(
  'rejects invalid chamber latitude %s',
  value => {
    expect(() => validateChamberLocation(position(), value, 0, now)).toThrow();
  },
);
test('rejects invalid user coordinates and longitude bounds', () => {
  expect(() =>
    validateChamberLocation(
      {...position(), coords: {...position().coords, latitude: NaN}},
      0,
      0,
      now,
    ),
  ).toThrow();
  expect(() => validateChamberLocation(position(), 0, 181, now)).toThrow();
});
test.each([now - 10001, now + 1, NaN])(
  'rejects stale, future or missing timestamps',
  timestamp => {
    expect(() =>
      validateChamberLocation(position({timestamp}), 0, 0, now),
    ).toThrow();
  },
);
test.each([0, -1, 21, Infinity, NaN, undefined])(
  'does not block submission based on reported accuracy %s',
  accuracy => {
    const fix = position();
    fix.coords.accuracy = accuracy as number;
    expect(validateChamberLocation(fix, 0, 0, now)).toBe(0);
  },
);
test('rejects reported mock locations', () => {
  expect(() =>
    validateChamberLocation(position({mocked: true}), 0, 0, now),
  ).toThrow('Mock');
});
test('requests recent real GPS without accepting saved coordinates', async () => {
  (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(success =>
    success(position()),
  );
  await expect(getVerifiedChamberLocation(0, 0)).resolves.toEqual(evidence());
  expect(Geolocation.getCurrentPosition).toHaveBeenCalledWith(
    expect.any(Function),
    expect.any(Function),
    expect.objectContaining({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
      forceLocationManager: false,
    }),
  );
  (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((_, error) =>
    error({code: 2}),
  );
  await Promise.all([
    expect(getVerifiedChamberLocation(0, 0)).rejects.toThrow(
      'GPS could not obtain',
    ),
    jest.advanceTimersByTimeAsync(30000),
  ]);
});
test('validates callback data rather than trusting GPS success', async () => {
  (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(success =>
    success(position({timestamp: now - 10001})),
  );
  await Promise.all([
    expect(getVerifiedChamberLocation(0, 0)).rejects.toThrow('old'),
    jest.advanceTimersByTimeAsync(30000),
  ]);
});
test('accepts historical offline evidence without requiring user near chamber at upload', () => {
  jest.spyOn(Date, 'now').mockReturnValue(now + 86400000);
  expect(isOfflineChamberTaskValid(task())).toBe(true);
});
test('rejects legacy records and missing photo evidence', () => {
  expect(isOfflineChamberTaskValid({lat: 0, lon: 0})).toBe(false);
  const saved = task();
  saved.geofenceEvidence.photos.pop();
  expect(isOfflineChamberTaskValid(saved)).toBe(false);
});
test('rejects saved coordinates different from verified fix', () => {
  const saved = task();
  saved.lat = '1';
  expect(isOfflineChamberTaskValid(saved)).toBe(false);
});
test('rejects out-of-range photo even when submission is in range', () => {
  const saved = task();
  saved.geofenceEvidence.photos[0].position.coords.latitude = 1;
  expect(isOfflineChamberTaskValid(saved)).toBe(false);
});
test('rejects photo verification after submission and missing image bytes', () => {
  const saved = task();
  saved.geofenceEvidence.photos[0].verifiedAt += 1;
  expect(isOfflineChamberTaskValid(saved)).toBe(false);
  expect(
    isOfflineChamberTaskValid({
      ...task(),
      reportingImage: [{imageUrl: ''}, {imageUrl: 'photo'}],
    }),
  ).toBe(false);
});

test('rejects null payload coordinates even when verified coordinates are zero', () => {
  expect(isOfflineChamberTaskValid({...task(), lat: null})).toBe(false);
});

test('waits for precise location permission before requesting GPS', async () => {
  let allow: (value: string) => void = () => {};
  (checkPermission as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        allow = resolve;
      }),
  );
  (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(success =>
    success(position()),
  );
  const request = getVerifiedChamberLocation(0, 0);
  expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
  allow('granted');
  await expect(request).resolves.toEqual(evidence());
});
test('does not request GPS when location permission is denied', async () => {
  (checkPermission as jest.Mock).mockResolvedValueOnce('denied');
  await expect(getVerifiedChamberLocation(0, 0)).rejects.toThrow(
    'Precise location access',
  );
  expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
});
test('falls back to a real GPS provider if fused location is unavailable on Android', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  (Geolocation.getCurrentPosition as jest.Mock)
    .mockImplementationOnce((_, failure) =>
      failure({code: 2, message: 'Provider unavailable'}),
    )
    .mockImplementationOnce(success => success(position()));
  const request = getVerifiedChamberLocation(0, 0);
  await jest.advanceTimersByTimeAsync(1000);
  await expect(request).resolves.toMatchObject({
    position: {coords: {accuracy: 5}},
  });
  expect(Geolocation.getCurrentPosition).toHaveBeenNthCalledWith(
    2,
    expect.any(Function),
    expect.any(Function),
    expect.objectContaining({forceLocationManager: true}),
  );
});
test.each([1, 5])(
  'does not retry native permission or settings rejection (%s)',
  async code => {
    jest.replaceProperty(Platform, 'OS', 'android');
    (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
      (_, failure) => failure({code}),
    );
    await expect(getVerifiedChamberLocation(0, 0)).rejects.toThrow(
      code === 1 ? 'permission is denied' : 'Location services are disabled',
    );
    expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  },
);
test('gives a timeout message instead of hiding the native failure', async () => {
  (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
    (_, failure) => failure({code: 3}),
  );
  await Promise.all([
    expect(getVerifiedChamberLocation(0, 0)).rejects.toThrow('GPS timed out'),
    jest.advanceTimersByTimeAsync(30000),
  ]);
});
test('GPS fallback still rejects coordinates outside 100 metres', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const outside = position();
  outside.coords.latitude = 1;
  (Geolocation.getCurrentPosition as jest.Mock)
    .mockImplementationOnce((_, failure) => failure({code: 2}))
    .mockImplementationOnce(success => success(outside));
  await Promise.all([
    expect(getVerifiedChamberLocation(0, 0)).rejects.toThrow('within 100'),
    jest.advanceTimersByTimeAsync(1000),
  ]);
});

test('waits for a 15-metre fix instead of accepting the first coarse reading', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const coarse = position();
  coarse.coords.accuracy = 150;
  const precise = position();
  precise.coords.accuracy = 12;
  precise.coords.latitude = 0.00001;
  (Geolocation.getCurrentPosition as jest.Mock)
    .mockImplementationOnce(success => success(coarse))
    .mockImplementationOnce(success => success(precise));
  const request = getVerifiedChamberLocation(0, 0);
  await jest.advanceTimersByTimeAsync(0);
  expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1000);
  await expect(request).resolves.toEqual({
    position: precise,
    verifiedAt: now + 1000,
  });
  await jest.advanceTimersByTimeAsync(30000);
  expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
  expect(jest.getTimerCount()).toBe(0);
});

test('uses the best fresh coarse fix at the deadline without an accuracy alert', async () => {
  (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(success => {
    const fix = position({timestamp: Date.now()});
    fix.coords.accuracy = Date.now() === now + 25000 ? 80 : 150;
    success(fix);
  });
  const request = getVerifiedChamberLocation(0, 0);
  await jest.advanceTimersByTimeAsync(30000);
  await expect(request).resolves.toMatchObject({
    position: {coords: {accuracy: 80}, timestamp: now + 25000},
    verifiedAt: now + 30000,
  });
  expect(jest.getTimerCount()).toBe(0);
});

test('does not return an expired precise fix instead of a fresh coarse fix', async () => {
  (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(success => {
    const fix = position({timestamp: Date.now()});
    fix.coords.accuracy = Date.now() === now ? 20 : 150;
    success(fix);
  });
  const request = getVerifiedChamberLocation(0, 0);
  await jest.advanceTimersByTimeAsync(30000);
  await expect(request).resolves.toMatchObject({
    position: {coords: {accuracy: 150}, timestamp: now + 29000},
  });
});

test('times out even if the native provider never calls back', async () => {
  await Promise.all([
    expect(getVerifiedChamberLocation(0, 0)).rejects.toThrow('GPS timed out'),
    jest.advanceTimersByTimeAsync(30000),
  ]);
  expect(jest.getTimerCount()).toBe(0);
});

test('ignores late native callbacks after timeout', async () => {
  let success: (fix: ChamberLocation) => void = () => {};
  (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(callback => {
    success = callback;
  });
  await Promise.all([
    expect(getVerifiedChamberLocation(0, 0)).rejects.toThrow('GPS timed out'),
    jest.advanceTimersByTimeAsync(30000),
  ]);
  const coarse = position({timestamp: Date.now()});
  coarse.coords.accuracy = 150;
  success(coarse);
  await jest.advanceTimersByTimeAsync(1000);
  expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

test('uses a recent precise fix without requesting another location', async () => {
  await expect(getVerifiedChamberLocation(0, 0, position())).resolves.toEqual(
    evidence(),
  );
  expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
});

test('does not block offline sync because of coarse historical accuracy', () => {
  const saved = task();
  saved.geofenceEvidence.submission.position.coords.accuracy = 150;
  saved.geofenceEvidence.photos.forEach(photo => {
    photo.position.coords.accuracy = 150;
  });
  expect(isOfflineChamberTaskValid(saved)).toBe(true);
});
