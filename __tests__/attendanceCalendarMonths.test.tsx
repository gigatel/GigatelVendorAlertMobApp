/**
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {StyleSheet, TouchableOpacity} from 'react-native';
import {Calendar} from 'react-native-calendars';
import {APIs} from '@apis';
import {useDispatch} from 'react-redux';
import * as attendanceSlice from '../src/store/slices/attendance.slice';
import AttendanceDashboard from '../src/screens/attendance/attendance-dashboard';
import DDAttendanceDashboard from '../src/screens/attendance/dd-attendance-dashboard';
import {Common, Preferences} from '@utils';
import AttendanceCalendar from '../src/components/atoms/attendance-calendar';
import {
  attendanceReducer,
  viewAttendanceApi,
} from '../src/store/slices/attendance.slice';

jest.mock('@atoms', () => ({AttendanceCalendar: 'AttendanceCalendar'}));
jest.mock('@molecules', () => ({BackHeader: () => null}));
jest.mock('@organisms', () => ({Screen: ({children}: any) => children}));
jest.mock('@react-navigation/native', () => ({useFocusEffect: jest.fn()}));
jest.mock('react-redux', () => ({
  connect: () => (component: any) => component,
  useDispatch: jest.fn(),
}));
jest.mock('@slices/permission.slice', () => ({
  checkCameraPermission: jest.fn(),
}));
jest.mock('../src/utils/common', () => ({log: jest.fn()}));
jest.mock('../src/screens/attendance/components/card-button-view', () => ({
  CardButton: () => null,
}));
jest.mock('../src/screens/attendance/components/mark-inout-button', () => ({
  MarkInOutButton: () => null,
}));
jest.mock('@apis', () => ({APIs: {postRequestWithJson: jest.fn()}, URLs: {}}));
jest.mock('@navigation/services', () => ({goBack: jest.fn()}));
jest.mock('@slices/task.slice', () => ({clearChamberTaskData: jest.fn()}));
jest.mock('../src/utils/preferences', () => ({
  OFFLINE_TODAY_WORKING_ON_BEHALF_PREFIX: 'behalf-',
}));
jest.mock('src/utils/common', () => ({log: jest.fn()}), {virtual: true});
jest.mock('src/apis/urls', () => ({BASE_URL_3: ''}), {virtual: true});
jest.mock('@utils', () => ({
  Common: {
    getNetConnection: jest.fn(),
    showToast: jest.fn(),
    getCurrentYear: () => 2026,
    getCurrentMonth: () => 11,
    formatTodayDate: () => '2026-11-06',
    dateFormatFromTo: (date: string, from: string, to: string) =>
      require('moment')(date, from).format(to),
    width: 400,
  },
  Preferences: {getData: jest.fn(), setData: jest.fn()},
  Location: {getAddressFromLatLong: async () => ''},
}));
jest.mock('@res', () => ({
  COLORS: {SUCCESS: 'green', DISABLED: 'gray', PRIMARY_LIGHT: 'blue'},
  IMAGES: {},
  CONSTANT: {},
  FONTS: {},
  STYLES: {},
  SIZE: {MS: (n: number) => n, MVS: (n: number) => n},
}));
jest.mock('react-native-calendars', () => ({Calendar: 'Calendar'}));

const params = (month: number, year = 2026) => ({
  month,
  year,
  page: '1',
  size: '31',
  search: '',
  showAttPolicy: true,
});
const attendance = (date: string, isPresent = true, doubleLogs: any[] = []) =>
  ({date, isPresent, doubleLogs} as any);
const response = (date: string) => ({
  status: 200,
  success: true,
  attendanceData: [attendance(date)],
});

beforeEach(() => jest.clearAllMocks());

test('uses a separate offline response for each month and year', async () => {
  let cache: any = null;
  jest.mocked(Preferences.getData).mockImplementation(() => cache);
  jest.mocked(Preferences.setData).mockImplementation((_key, data) => {
    cache = data;
  });
  jest.mocked(Common.getNetConnection).mockResolvedValue(true);
  jest
    .mocked(APIs.postRequestWithJson)
    .mockResolvedValueOnce(response('06-11-2026'))
    .mockResolvedValueOnce(response('06-10-2026'))
    .mockResolvedValueOnce(response('06-10-2025'));
  const dispatch = jest.fn();
  const run = (arg: any) =>
    viewAttendanceApi(arg)(dispatch, () => ({}), undefined);
  await run(params(11));
  await run(params(10));
  await run(params(10, 2025));
  jest.mocked(Common.getNetConnection).mockResolvedValue(false);
  for (const [month, year, date] of [
    [11, 2026, '06-11-2026'],
    [10, 2026, '06-10-2026'],
    [10, 2025, '06-10-2025'],
  ] as const) {
    const result = await run(params(month, year));
    expect(result.payload.attendanceData[0].date).toBe(date);
  }
  expect((await run(params(9))).meta.requestStatus).toBe('rejected');
  expect(APIs.postRequestWithJson).toHaveBeenCalledTimes(3);
});

test('ignores a late response from a previously selected month', () => {
  let state = attendanceReducer(
    undefined,
    viewAttendanceApi.pending('november', params(11)),
  );
  state = attendanceReducer(
    state,
    viewAttendanceApi.pending('october', params(10)),
  );
  state = attendanceReducer(
    state,
    viewAttendanceApi.fulfilled(response('06-10-2026'), 'october', params(10)),
  );
  state = attendanceReducer(
    state,
    viewAttendanceApi.fulfilled(response('06-11-2026'), 'november', params(11)),
  );
  expect(state.calenderAttendanceData?.[0].date).toBe('06-10-2026');
  state = attendanceReducer(
    state,
    viewAttendanceApi.pending('september', params(9)),
  );
  expect(state.calenderAttendanceData).toBeNull();
  state = attendanceReducer(
    state,
    viewAttendanceApi.rejected(new Error('offline'), 'september', params(9)),
  );
  expect(state.calenderAttendanceData).toBeNull();
});

test('renders green present days for previous months and previous years', () => {
  let tree: renderer.ReactTestRenderer;
  const renderDay = (
    month: number,
    year: number,
    data: any[],
    day = 6,
    isDoubleDuty = false,
  ) => {
    act(() => {
      tree = renderer.create(
        <AttendanceCalendar
          currMonth={month}
          currYear={year}
          presentDates={data}
          isDoubleDuty={isDoubleDuty}
        />,
      );
    });
    const calendar = tree!.root.findByType(Calendar);
    const dayView = calendar.props.dayComponent({
      date: {
        day,
        month,
        year,
        dateString: `${year}-${String(month).padStart(2, '0')}-${String(
          day,
        ).padStart(2, '0')}`,
      },
    });
    let renderedDay: renderer.ReactTestRenderer;
    act(() => {
      renderedDay = renderer.create(dayView);
    });
    return StyleSheet.flatten(
      renderedDay!.root.findByType(TouchableOpacity).props.style,
    ).backgroundColor;
  };
  expect(renderDay(11, 2026, [attendance('06-11-2026')])).toBe('green');
  expect(renderDay(10, 2026, [attendance('06-10-2026')])).toBe('green');
  expect(renderDay(12, 2025, [attendance('06-12-2025')])).toBe('green');
  expect(renderDay(10, 2026, [attendance('06-10-2026', false)])).not.toBe(
    'green',
  );
  expect(renderDay(10, 2026, [attendance('06-11-2026')])).not.toBe('green');
  expect(renderDay(10, 2026, [attendance('06-10-2026')], 6, true)).not.toBe(
    'green',
  );
  expect(
    renderDay(10, 2026, [attendance('06-10-2026', true, [{}])], 6, true),
  ).toBe('green');
});

test.each([AttendanceDashboard, DDAttendanceDashboard])(
  'requests the displayed month AND year when browsing the dashboard',
  async Dashboard => {
    const request = jest.spyOn(attendanceSlice, 'viewAttendanceApi');
    const dispatch = jest.fn(() => ({unwrap: async () => ({})}));
    jest.mocked(useDispatch).mockReturnValue(dispatch);
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <Dashboard
          route={{params: {isViewAllow: false, isMarkAllow: false}} as any}
          navigation={{} as any}
          todayAttData={null}
          todayDoubleDuty={null}
        />,
      );
    });
    for (const {month, year} of [
      {month: 10, year: 2026},
      {month: 12, year: 2025},
      {month: 10, year: 2025},
      {month: 11, year: 2026},
    ]) {
      await act(async () => {
        tree!.root
          .findByType('AttendanceCalendar' as any)
          .props.onMonthChange({month, year});
      });
      expect(request).toHaveBeenLastCalledWith(
        expect.objectContaining({month, year}),
      );
    }
    act(() => tree!.unmount());
    request.mockRestore();
  },
);
