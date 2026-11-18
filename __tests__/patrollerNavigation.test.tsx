import React from 'react';
import Geolocation from '@react-native-community/geolocation';
import {useDispatch} from 'react-redux';
import {getPatrollerTaskAssinmentApi} from '@slices/task.slice';
import renderer, {act} from 'react-test-renderer';
import {Buttons} from '@atoms';
import {Screen} from '@organisms';
import {Common} from '@utils';
import PatrollerTask from '../src/screens/patroller-task/patroller-task';
import {getVerifiedChamberLocation} from '../src/utils/chamberGeofence';

jest.mock('@atoms', () => ({Buttons: () => null}));
jest.mock('@molecules', () => ({
  AlertView: () => null,
  ModalSheet: () => null,
  OptionPickerSheet: () => null,
  ChamberListModal: () => null,
}));
jest.mock('@organisms', () => ({Screen: ({children}: any) => children}));
jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn((success: any) =>
    success({coords: {latitude: 0, longitude: 0}}),
  ),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: any) =>
    require('react').useEffect(callback, [callback]),
}));
jest.mock('react-redux', () => {
  const dispatch = jest.fn();
  return {
    connect: () => (component: any) => component,
    useDispatch: () => dispatch,
  };
});
jest.mock('@res', () => ({
  COLORS: {},
  IMAGES: {camera: 'camera', refresh: 'refresh'},
  FONTS: {},
  STYLES: {},
  SIZE: {MS: (n: number) => n, MVS: (n: number) => n},
}));
jest.mock('../src/res/globalStyle', () => ({
  BoxShadow: {},
  FontFamily: {},
  FontSize: {},
  Padding: {},
  Gap: {},
  Border: {},
  Width: {},
  Height: {},
  LineHeight: {},
}));
jest.mock('@slices/permission.slice', () => ({
  checkCameraPermission: jest.fn(),
}));
jest.mock('@slices/task.slice', () => ({
  getChamberIssueListApi: jest.fn(),
  getPatrollerTaskAssinmentApi: jest.fn(),
  updateChamberTaskListDistance: jest.fn(),
  updateCompletedChamberStatus: jest.fn(),
}));
jest.mock('@utils', () => ({
  Common: {
    alert: jest.fn(),
    showToast: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    isEqualIgnoreCase: () => true,
  },
  Location: {getAddressWithLatLong: async () => ({})},
  Permissions: {requestPermission: jest.fn()},
  Preferences: {getData: () => null, setData: jest.fn()},
}));
jest.mock('react-native-maps', () => ({
  __esModule: true,
  default: require('react').forwardRef(() => null),
  Marker: () => null,
}));
jest.mock('react-native-maps-directions', () => () => null);
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0}),
}));
jest.mock(
  'react-native-linear-gradient',
  () =>
    ({children}: any) =>
      children,
);
jest.mock('../src/utils/chamberGeofence', () => ({
  ...jest.requireActual('../src/utils/chamberGeofence'),
  getVerifiedChamberLocation: jest.fn(),
}));
jest.mock('react-native-geolocation-service', () => ({}));
jest.mock('../src/utils/location', () => ({}));

let component: renderer.ReactTestRenderer;
const navigate = jest.fn();
const createScreen = (distance: number) => {
  const props: any = {
    loading: false,
    navigation: {navigate, goBack: jest.fn(), isFocused: () => true},
    taskData: {
      chamberCount: 1,
      taskChamberList: [
        {
          chamberId: 1,
          chamberIdStr: 'C1',
          chamberName: 'Chamber',
          chamberLat: '0',
          chamberLong: '0',
          distance,
        },
      ],
      successTaskChamberList: [],
    },
    empData: {id: 1},
    isAllTaskSubmitted: false,
  };
  act(() => {
    component = renderer.create(<PatrollerTask {...props} />);
  });
  return component.root
    .findAllByType(Buttons)
    .find(button => button.props.icon === 'camera')!;
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (useDispatch() as jest.Mock).mockReturnValue({payload: {data: {}}});
  (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(success =>
    success({coords: {latitude: 0, longitude: 0}}),
  );
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  if (component) {
    act(() => component.unmount());
  }
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('shows modal and stays on Patroller Task when displayed distance exceeds 100 metres', async () => {
  const button = createScreen(125);
  await act(async () => {
    await button.props.onPress();
  });
  expect(Common.alert).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'More than 100 metres away',
      msg: expect.stringContaining('125.0 metres'),
    }),
  );
  expect(navigate).not.toHaveBeenCalled();
  expect(getVerifiedChamberLocation).not.toHaveBeenCalled();
});
test('opens submission with verified coordinates when within 50 metres', async () => {
  const coords = {latitude: 0, longitude: 0, accuracy: 5};
  (getVerifiedChamberLocation as jest.Mock).mockResolvedValue({
    position: {coords},
  });
  const button = createScreen(50);
  await act(async () => {
    await button.props.onPress();
  });
  expect(navigate).toHaveBeenCalledWith(
    'SubmitPatrollerTask',
    expect.objectContaining({
      currentPosition: coords,
      selectedChamber: expect.objectContaining({distance: 0}),
    }),
  );
});
test('stays on screen if fresh location verification rejects a cached in-range distance', async () => {
  (getVerifiedChamberLocation as jest.Mock).mockRejectedValue(
    new Error('You must be within 50 metres of the chamber.'),
  );
  const button = createScreen(20);
  await act(async () => {
    await button.props.onPress();
  });
  expect(navigate).not.toHaveBeenCalled();
  expect(Common.alert).toHaveBeenCalledWith(
    expect.objectContaining({msg: expect.stringContaining('within 50 metres')}),
  );
});

const flushRefresh = async () => {
  await act(async () => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  });
};

test('fetches tasks every 30 seconds even when coordinates stay unchanged', async () => {
  createScreen(20);
  await flushRefresh();
  expect(getPatrollerTaskAssinmentApi).toHaveBeenCalledTimes(1);
  await act(async () => jest.advanceTimersByTime(30000));
  await flushRefresh();
  expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
  expect(getPatrollerTaskAssinmentApi).toHaveBeenCalledTimes(2);

  (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(success =>
    success({coords: {latitude: 28.6, longitude: 77.2}}),
  );
  await act(async () => jest.advanceTimersByTime(30000));
  await flushRefresh();
  expect(getPatrollerTaskAssinmentApi).toHaveBeenLastCalledWith({
    param: {lat: '28.6', lng: '77.2', employeeId: 1, companyCode: 'gtpl'},
    isRefresh: true,
  });
  expect(getPatrollerTaskAssinmentApi).toHaveBeenCalledTimes(3);
});

test('manual refresh fetches even when coordinates have not changed', async () => {
  createScreen(20);
  await flushRefresh();
  const button = component.root
    .findAllByType(Buttons)
    .find(item => item.props.icon === 'refresh')!;
  await act(async () => button.props.onPress());
  await flushRefresh();
  expect(getPatrollerTaskAssinmentApi).toHaveBeenCalledTimes(2);
});

test('does not overlap location checks and stops polling when unmounted', async () => {
  createScreen(20);
  await flushRefresh();
  let resolvePosition: any;
  (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(success => {
    resolvePosition = success;
  });
  await act(async () => jest.advanceTimersByTime(60000));
  expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
  act(() => component.unmount());
  await act(async () => {
    resolvePosition({coords: {latitude: 1, longitude: 1}});
    jest.advanceTimersByTime(30000);
  });
  expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
  expect(getPatrollerTaskAssinmentApi).toHaveBeenCalledTimes(1);
});

test('background GPS errors still refresh tasks using the last position without a popup', async () => {
  createScreen(20);
  await flushRefresh();
  (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((_, fail) =>
    fail(new Error('Location unavailable')),
  );
  await act(async () => jest.advanceTimersByTime(30000));
  await flushRefresh();
  expect(getPatrollerTaskAssinmentApi).toHaveBeenCalledTimes(2);
  expect(getPatrollerTaskAssinmentApi).toHaveBeenLastCalledWith({
    param: {lat: '0', lng: '0', employeeId: 1, companyCode: 'gtpl'},
    isRefresh: true,
  });
  expect(component.root.findByType(Screen).props.loading).toBe(false);
  expect(Common.alert).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(30000));
  await flushRefresh();
  expect(getPatrollerTaskAssinmentApi).toHaveBeenCalledTimes(3);
});

test('waits a full 30 seconds after a slow location refresh finishes', async () => {
  let resolvePosition: any;
  (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(success => {
    resolvePosition = success;
  });
  createScreen(20);
  await act(async () => jest.advanceTimersByTime(9000));
  await act(async () => {
    resolvePosition({coords: {latitude: 0, longitude: 0}});
  });
  await flushRefresh();
  expect(getPatrollerTaskAssinmentApi).toHaveBeenCalledTimes(1);

  (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(success =>
    success({coords: {latitude: 0, longitude: 0}}),
  );
  await act(async () => jest.advanceTimersByTime(29999));
  expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  expect(getPatrollerTaskAssinmentApi).toHaveBeenCalledTimes(1);
  await act(async () => jest.advanceTimersByTime(1));
  await flushRefresh();
  expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
  expect(getPatrollerTaskAssinmentApi).toHaveBeenCalledTimes(2);
});

test('does not block the screen with the location loader during automatic refresh', async () => {
  createScreen(20);
  await flushRefresh();
  expect(component.root.findByType(Screen).props.loading).toBe(false);
  let finish: any;
  (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(success => {
    finish = success;
  });
  await act(async () => jest.advanceTimersByTime(30000));
  expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
  expect(component.root.findByType(Screen).props.loading).toBe(false);
  // Redux pending task state must also stay quiet after the initial load.
  act(() =>
    component.update(
      <PatrollerTask {...component.root.props} loading={true} />,
    ),
  );
  expect(component.root.findByType(Screen).props.loading).toBe(false);
  await act(async () => {
    finish({coords: {latitude: 0, longitude: 0}});
  });
  await flushRefresh();
  expect(component.root.findByType(Screen).props.loading).toBe(false);
});

test('ends the initial location loader after a failed GPS request', async () => {
  let fail: any;
  (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(
    (_, failure) => {
      fail = failure;
    },
  );
  createScreen(20);
  await flushRefresh();
  expect(component.root.findByType(Screen).props.loading).toBe(true);
  await act(async () => {
    fail(new Error('GPS timeout'));
  });
  await flushRefresh();
  expect(component.root.findByType(Screen).props.loading).toBe(false);
  expect(getPatrollerTaskAssinmentApi).not.toHaveBeenCalled();
});

test('starts the next 30-second timer only after the task API finishes', async () => {
  createScreen(20);
  await flushRefresh();
  let finish: any;
  (getPatrollerTaskAssinmentApi as unknown as jest.Mock).mockReturnValue({
    type: 'task-refresh',
  });
  (useDispatch() as jest.Mock).mockImplementation(action =>
    action?.type === 'task-refresh'
      ? new Promise(resolve => {
          finish = resolve;
        })
      : {},
  );
  await act(async () => jest.advanceTimersByTime(30000));
  await flushRefresh();
  expect(getPatrollerTaskAssinmentApi).toHaveBeenCalledTimes(2);
  await act(async () => jest.advanceTimersByTime(30000));
  expect(getPatrollerTaskAssinmentApi).toHaveBeenCalledTimes(2);
  await act(async () => {
    finish({payload: {data: {}}});
  });
  await flushRefresh();
  await act(async () => jest.advanceTimersByTime(29999));
  expect(getPatrollerTaskAssinmentApi).toHaveBeenCalledTimes(2);
  await act(async () => jest.advanceTimersByTime(1));
  await flushRefresh();
  expect(getPatrollerTaskAssinmentApi).toHaveBeenCalledTimes(3);
});
