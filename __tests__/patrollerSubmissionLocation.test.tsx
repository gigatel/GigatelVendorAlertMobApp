import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Text, TouchableOpacity} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import NetInfo from '@react-native-community/netinfo';
import {useDispatch} from 'react-redux';
import {RadioButton} from '@atoms';
import {CaptureChamberPicture} from '@molecules';
import {Common, Location, Preferences} from '@utils';
import {submitPatrollerTaskApi} from '@slices/task.slice';
import PatrollerTask from '../src/screens/patroller-task/submit-patroller-task';
import {getVerifiedChamberLocation} from '../src/utils/chamberGeofence';

jest.mock('@atoms', () => ({RadioButton: () => null}));
jest.mock('@molecules', () => ({
  BackHeader: () => null,
  CaptureChamberPicture: () => null,
}));
jest.mock('@organisms', () => ({Screen: ({children}: any) => children}));
jest.mock('@sheets', () => ({ChamberIssueListActionSheet: () => null}));
jest.mock('@react-native-community/geolocation', () => ({
  watchPosition: jest.fn(() => 1),
  clearWatch: jest.fn(),
}));
jest.mock('@react-native-community/netinfo', () => ({fetch: jest.fn()}));
jest.mock('react-redux', () => {
  const dispatch = jest.fn();
  return {
    connect: () => (component: any) => component,
    useDispatch: () => dispatch,
  };
});
jest.mock('@res', () => ({
  COLORS: {},
  FONTS: {},
  STYLES: {},
  SIZE: {MS: (n: number) => n, MVS: (n: number) => n},
}));
jest.mock('@slices/permission.slice', () => ({
  checkCameraPermission: jest.fn(),
}));
jest.mock('@slices/task.slice', () => ({
  submitPatrollerTaskApi: jest.fn(params => ({type: 'submit', params})),
  updateChamberTaskListDistance: jest.fn(),
  updateSubmitPatrollerTask: jest.fn(),
}));
jest.mock('@utils', () => ({
  Common: {
    alert: jest.fn(),
    showToast: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    getFormatedDate: () => '2026-10-26',
  },
  Location: {getAddressWithLatLong: jest.fn()},
  Permissions: {requestPermission: jest.fn()},
  Preferences: {getData: jest.fn(), setData: jest.fn()},
  Times: {getFormatedTime: () => '12:00:00'},
}));
jest.mock('../src/utils/chamberGeofence', () => ({
  ...jest.requireActual('../src/utils/chamberGeofence'),
  getVerifiedChamberLocation: jest.fn(),
}));
jest.mock('react-native-geolocation-service', () => ({}));
jest.mock('../src/utils/location', () => ({}));

const now = 1800000000000;
const evidence = (timestamp = Date.now(), latitude = 0) => ({
  position: {coords: {latitude, longitude: 0, accuracy: 5}, timestamp},
  verifiedAt: Date.now(),
});
let component: renderer.ReactTestRenderer;
const createScreen = () => {
  act(() => {
    component = renderer.create(
      <PatrollerTask
        {...({
          loading: false,
          navigation: {goBack: jest.fn()},
          route: {
            params: {
              empID: 1,
              selectedChamber: {chamberId: 1, chamberLat: 0, chamberLong: 0},
              currentPosition: {latitude: 0, longitude: 0},
            },
          },
          taskData: {taskId: 1},
        } as any)}
      />,
    );
  });
  act(() => {
    component.root
      .findAllByType(CaptureChamberPicture)
      .forEach((photo, index) => {
        photo.props.setPic({
          data: `photo-${index}`,
          captureLocation: {
            ...evidence(now - 60000),
            verifiedAt: now - 60000,
          },
        });
      });
    component.root.findAllByType(RadioButton)[1].props.onPress();
  });
};
const submit = () =>
  component.root
    .findAllByType(TouchableOpacity)
    .find(button =>
      button.findAllByType(Text).some(text => text.props.children === 'SUBMIT'),
    )!
    .props.onPress();

beforeEach(() => {
  jest.useFakeTimers({now});
  jest.clearAllMocks();
  (NetInfo.fetch as jest.Mock).mockResolvedValue({isConnected: true});
  (Location.getAddressWithLatLong as jest.Mock).mockResolvedValue({
    address: 'here',
  });
  (Preferences.getData as jest.Mock).mockReturnValue(null);
  (getVerifiedChamberLocation as jest.Mock).mockImplementation(async () =>
    evidence(),
  );
  (useDispatch() as jest.Mock).mockImplementation(action =>
    action?.type === 'submit'
      ? Promise.resolve({payload: {status: 200, success: true}})
      : {},
  );
});
afterEach(() => {
  if (component) {
    act(() => component.unmount());
  }
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('refreshes an expired fix after address lookup and submits updated coordinates', async () => {
  (getVerifiedChamberLocation as jest.Mock)
    .mockImplementationOnce(async () => evidence(now - 9000))
    .mockImplementationOnce(async () => evidence(Date.now(), 0.00001));
  (Location.getAddressWithLatLong as jest.Mock).mockImplementation(
    () =>
      new Promise(resolve =>
        setTimeout(() => resolve({address: 'old address'}), 2000),
      ),
  );
  createScreen();
  await act(async () => {
    const pending = submit();
    await jest.advanceTimersByTimeAsync(2000);
    await pending;
  });
  expect(getVerifiedChamberLocation).toHaveBeenCalledTimes(2);
  expect(submitPatrollerTaskApi).toHaveBeenCalledWith([
    expect.objectContaining({lat: '0.00001', gpsAddress: ''}),
  ]);
  expect(Common.alert).toHaveBeenCalledWith(
    expect.objectContaining({title: 'Success'}),
  );
  expect(Common.alert).not.toHaveBeenCalledWith(
    expect.objectContaining({title: 'Submission blocked'}),
  );
});

test('waits for connectivity lookup before acquiring the submission location', async () => {
  (NetInfo.fetch as jest.Mock).mockImplementation(
    () =>
      new Promise(resolve =>
        setTimeout(() => resolve({isConnected: true}), 15000),
      ),
  );
  createScreen();
  await act(async () => {
    const pending = submit();
    await jest.advanceTimersByTimeAsync(14000);
    expect(getVerifiedChamberLocation).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1000);
    await pending;
  });
  expect(submitPatrollerTaskApi).toHaveBeenCalledTimes(1);
  expect(Common.alert).toHaveBeenCalledWith(
    expect.objectContaining({title: 'Success'}),
  );
});

test('saves verified evidence offline after a slow 202 response without rechecking its live age', async () => {
  (getVerifiedChamberLocation as jest.Mock).mockImplementation(async () =>
    evidence(now - 5000),
  );
  (useDispatch() as jest.Mock).mockImplementation(action =>
    action?.type === 'submit'
      ? new Promise(resolve =>
          setTimeout(
            () => resolve({payload: {status: 202, success: false}}),
            9000,
          ),
        )
      : {},
  );
  createScreen();
  await act(async () => {
    const pending = submit();
    await jest.advanceTimersByTimeAsync(9000);
    await pending;
  });
  expect(Preferences.setData).toHaveBeenCalledWith('SUBMIT_TASK_DATA', [
    expect.objectContaining({
      geofenceEvidence: expect.objectContaining({
        submission: expect.objectContaining({
          position: expect.objectContaining({timestamp: now - 5000}),
        }),
      }),
    }),
  ]);
  expect(Common.alert).toHaveBeenCalledWith(
    expect.objectContaining({title: 'Offline Task'}),
  );
  expect(getVerifiedChamberLocation).toHaveBeenCalledTimes(1);
});

test('ignores stale watch callbacks and requests updates while standing still', () => {
  createScreen();
  const [success, , options] = (Geolocation.watchPosition as jest.Mock).mock
    .calls[0];
  expect(options).toMatchObject({
    maximumAge: 0,
    distanceFilter: 0,
    interval: 3000,
  });
  act(() => success(evidence(now - 20000).position));
  expect(
    component.root
      .findAllByType(Text)
      .some(text =>
        String(text.props.children).includes('GPS location is old'),
      ),
  ).toBe(false);
});

test('submits a coarse in-range reading without waiting for an accuracy target', async () => {
  (getVerifiedChamberLocation as jest.Mock).mockImplementation(async () => {
    const fix = evidence();
    fix.position.coords.accuracy = 150;
    return fix;
  });
  createScreen();
  await act(async () => {
    await submit();
  });
  expect(getVerifiedChamberLocation).toHaveBeenCalledWith(0, 0, null, {
    preferAccuracy: false,
  });
  expect(submitPatrollerTaskApi).toHaveBeenCalledTimes(1);
  expect(Common.alert).toHaveBeenCalledWith(
    expect.objectContaining({title: 'Success'}),
  );
});
