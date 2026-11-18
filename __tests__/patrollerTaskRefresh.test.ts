/**
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
import {
  getPatrollerTaskAssinmentApi,
  taskReducer,
} from '../src/store/slices/task.slice';

jest.mock('@apis', () => ({APIs: {}, URLs: {}}));
jest.mock('@navigation/services', () => ({goBack: jest.fn()}));
jest.mock('@utils', () => ({
  Common: {},
  Preferences: {},
  Location: {calculateDistance: () => 25},
}));

test('replaces counts and completed chambers and calculates pending distances on every response', () => {
  const arg = {param: {lat: '28.6', lng: '77.2'}};
  const first = taskReducer(
    undefined,
    getPatrollerTaskAssinmentApi.fulfilled(
      {
        data: {
          chamberCount: 1,
          taskChamberList: [{chamberId: 1, chamberLat: '28', chamberLong: '77'}],
          successTaskChamberList: [],
        },
      },
      'first',
      arg,
    ),
  );
  expect(first.taskListData?.taskChamberList[0].distance).toBe(25);

  const updated = taskReducer(
    first,
    getPatrollerTaskAssinmentApi.fulfilled(
      {
        data: {
          chamberCount: 2,
          taskChamberList: [{chamberId: 2, chamberLat: '28', chamberLong: '77'}],
          successTaskChamberList: [{chamberId: 1}],
        },
      },
      'refresh',
      arg,
    ),
  );
  expect(updated.taskListData).toEqual({
    chamberCount: 2,
    taskChamberList: [
      {chamberId: 2, chamberLat: '28', chamberLong: '77', distance: 25},
    ],
    successTaskChamberList: [{chamberId: 1}],
  });
});
