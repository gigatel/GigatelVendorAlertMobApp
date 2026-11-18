import {APIs} from '@apis';
import {Preferences} from '@utils';
import {
  startOfflineSync,
  stopOfflineSync,
} from '../src/hooks/OfflineSyncService';
import {store} from '../src/store/store';

jest.mock('@apis', () => ({
  APIs: {postRequestWithJson: jest.fn()},
  URLs: {submitDailyReport: '/report'},
}));
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(async () => ({isConnected: true})),
  addEventListener: jest.fn(() => jest.fn()),
}));
jest.mock('react-native-geolocation-service', () => ({}));
jest.mock('../src/utils/location', () => ({checkPermission: jest.fn()}));
jest.mock('@utils', () => ({
  Preferences: {getData: jest.fn(), setData: jest.fn()},
  Common: {
    log: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    showToast: jest.fn(),
  },
  Voice: {speak: jest.fn()},
}));
jest.mock('../src/store/store', () => ({
  store: {
    getState: () => ({task: {taskListData: {taskId: 1}}}),
    dispatch: jest.fn(),
  },
}));
jest.mock('../src/store/slices/task.slice', () => ({
  updateSubmitPatrollerTask: (payload: any) => ({type: 'confirmed', payload}),
}));

let queue: any[];
const flush = async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
};
const savedTask = (id = 1) => {
  const evidence = {
    position: {
      coords: {latitude: 0, longitude: 0, accuracy: 5},
      timestamp: Date.now(),
    },
    verifiedAt: Date.now(),
  };
  return {
    taskId: 1,
    gigatelOldNearestChamberID: id,
    lat: '0',
    lon: '0',
    chamberLat: '0',
    chamberLon: '0',
    reportingImage: [{imageUrl: 'one'}, {imageUrl: 'two'}],
    geofenceEvidence: {
      version: 1,
      submission: evidence,
      photos: [evidence, evidence],
    },
  };
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  queue = [];
  (Preferences.getData as jest.Mock).mockImplementation(key =>
    key === 'SUBMIT_TASK_DATA' ? JSON.parse(JSON.stringify(queue)) : null,
  );
  (Preferences.setData as jest.Mock).mockImplementation((key, value) => {
    if (key === 'SUBMIT_TASK_DATA') {
      queue = value;
    }
  });
});
afterEach(() => {
  stopOfflineSync();
  jest.useRealTimers();
});

test('uploads verified records, retains legacy records and strips local evidence', async () => {
  const legacy = {taskId: 1, gigatelOldNearestChamberID: 2};
  queue = [savedTask(), legacy];
  (APIs.postRequestWithJson as jest.Mock).mockResolvedValue({
    status: 200,
    success: true,
  });
  startOfflineSync();
  await flush();
  const sent = (APIs.postRequestWithJson as jest.Mock).mock.calls[0][0].params;
  expect(sent).toHaveLength(1);
  expect(sent[0].isOffline).toBe(true);
  expect(sent[0].geofenceEvidence).toBeUndefined();
  expect(queue).toEqual([legacy]);
  expect(store.dispatch).toHaveBeenCalledTimes(1);
});
test('retries after server rejection without marking task complete', async () => {
  queue = [savedTask()];
  (APIs.postRequestWithJson as jest.Mock).mockResolvedValue({
    status: 500,
    success: false,
  });
  startOfflineSync();
  await flush();
  expect(queue).toHaveLength(1);
  expect(store.dispatch).not.toHaveBeenCalled();
  jest.advanceTimersByTime(60000);
  await flush();
  expect(APIs.postRequestWithJson).toHaveBeenCalledTimes(2);
});
test('preserves records added while a sync request is in flight', async () => {
  queue = [savedTask()];
  let finish: (response: any) => void = () => {};
  (APIs.postRequestWithJson as jest.Mock).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  startOfflineSync();
  await flush();
  const newTask = savedTask(3);
  queue.push(newTask);
  finish({status: 200, success: true});
  await flush();
  expect(queue).toEqual([newTask]);
});
