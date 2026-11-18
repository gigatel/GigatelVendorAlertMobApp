import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {TouchableOpacity} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import CaptureChamberPicture from '../src/components/molecules/capture-chamber-picture';
import {Common} from '@utils';
import {getVerifiedChamberLocation} from '../src/utils/chamberGeofence';

jest.mock('@utils', () => ({
  Common: {
    captureCameraImageWithWatermark: jest.fn(),
    alert: jest.fn(),
    getFormatedDate: () => 'today',
  },
  Preferences: {getData: () => null},
}));
jest.mock('@res', () => ({
  COLORS: {},
  IMAGES: {},
  FONTS: {},
  SIZE: {MS: (n: number) => n, MVS: (n: number) => n},
}));
jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: jest.fn(),
}));
jest.mock('../src/utils/location', () => ({
  checkPermission: async () => 'granted',
}));
jest.mock('../src/utils/chamberGeofence', () => ({
  getVerifiedChamberLocation: jest.fn(),
}));

const fix = {
  position: {coords: {latitude: 12, longitude: 77}, timestamp: 100},
  verifiedAt: 100,
};
beforeEach(() => jest.resetAllMocks());
const capture = async () => {
  const setPic = jest.fn();
  let component: renderer.ReactTestRenderer;
  act(() => {
    component = renderer.create(
      <CaptureChamberPicture
        title="PIC 1"
        pic={null}
        setPic={setPic}
        lat={0}
        long={0}
        chamber={{latitude: 12, longitude: 77}}
      />,
    );
  });
  await act(async () => {
    await component!.root.findByType(TouchableOpacity).props.onPress();
  });
  act(() => component!.unmount());
  return setPic;
};
test('does not open camera when initial location check fails', async () => {
  (getVerifiedChamberLocation as jest.Mock).mockRejectedValue(
    new Error('Outside 100 metres'),
  );
  const setPic = await capture();
  expect(Common.captureCameraImageWithWatermark).not.toHaveBeenCalled();
  expect(setPic).not.toHaveBeenCalled();
  expect(Common.alert).toHaveBeenCalledWith(
    expect.objectContaining({msg: 'Outside 100 metres'}),
  );
});
test('rejects photo when user leaves range while camera is open', async () => {
  (getVerifiedChamberLocation as jest.Mock)
    .mockResolvedValueOnce(fix)
    .mockRejectedValueOnce(new Error('Outside 100 metres'));
  (Common.captureCameraImageWithWatermark as jest.Mock).mockImplementation(
    async watermark => {
      await watermark();
      return {path: 'photo'};
    },
  );
  expect(await capture()).not.toHaveBeenCalled();
  expect(getVerifiedChamberLocation).toHaveBeenCalledTimes(2);
});
test('uses verified coordinates for watermark and retains capture evidence', async () => {
  (getVerifiedChamberLocation as jest.Mock).mockResolvedValue(fix);
  (Common.captureCameraImageWithWatermark as jest.Mock).mockImplementation(
    async watermark => {
      expect(await watermark()).toContain(
        'Latitude: 12.0000000 | Longitude: 77.0000000',
      );
      return {path: 'photo', data: 'image'};
    },
  );
  const setPic = await capture();
  expect(setPic).toHaveBeenCalledWith({
    path: 'photo',
    data: 'image',
    captureLocation: fix,
  });
});

test.each([0, 99.9])(
  'accepts a photo %s metres from the chamber with 150-metre reported accuracy',
  async distance => {
    const actual = jest.requireActual('../src/utils/chamberGeofence');
    (getVerifiedChamberLocation as jest.Mock).mockImplementation(
      actual.getVerifiedChamberLocation,
    );
    const coarseFix = {
      ...fix.position,
      timestamp: Date.now(),
      coords: {
        ...fix.position.coords,
        altitudeAccuracy: null,
        latitude: 12 + ((distance / 6371000) * 180) / Math.PI,
        accuracy: 150,
      },
    };
    (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(success =>
      success(coarseFix),
    );
    (Common.captureCameraImageWithWatermark as jest.Mock).mockImplementation(
      async watermark => {
        await watermark();
        return {path: 'photo', data: 'image'};
      },
    );
    const setPic = await capture();
    expect(setPic).toHaveBeenCalledWith(
      expect.objectContaining({
        captureLocation: expect.objectContaining({position: coarseFix}),
      }),
    );
    expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(Common.alert).not.toHaveBeenCalled();
    expect(getVerifiedChamberLocation).toHaveBeenNthCalledWith(
      2,
      12,
      77,
      undefined,
      {preferAccuracy: false},
    );
  },
);

test('still rejects photos outside 100 metres using the real location validation', async () => {
  const actual = jest.requireActual('../src/utils/chamberGeofence');
  (getVerifiedChamberLocation as jest.Mock).mockImplementation(
    actual.getVerifiedChamberLocation,
  );
  (Geolocation.getCurrentPosition as jest.Mock).mockImplementation(success =>
    success({
      ...fix.position,
      timestamp: Date.now(),
      coords: {latitude: 13, longitude: 77, accuracy: 150},
    }),
  );
  expect(await capture()).not.toHaveBeenCalled();
  expect(Common.captureCameraImageWithWatermark).not.toHaveBeenCalled();
  expect(Common.alert).toHaveBeenCalledWith(
    expect.objectContaining({
      msg: expect.stringContaining('within 100 metres'),
    }),
  );
});
