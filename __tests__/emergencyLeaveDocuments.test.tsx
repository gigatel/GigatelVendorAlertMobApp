import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert} from 'react-native';
import {keepLocalCopy, pick} from '@react-native-documents/picker';
import {viewDocument} from '@react-native-documents/viewer';
import RNFS from 'react-native-fs';
import EmergencyLeaveDetails from '../src/screens/ApplyLeaveScreen/EmergencyLeaveDetails';

jest.mock(
  '@res',
  () => ({
    COLORS: {},
    FONTS: {},
    IMAGES: {upload: 1},
  }),
  {virtual: true},
);
jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  keepLocalCopy: jest.fn(),
  errorCodes: {OPERATION_CANCELED: 'OPERATION_CANCELED'},
  isErrorWithCode: (error: {code?: string}) => !!error.code,
}));
jest.mock('@react-native-documents/viewer', () => ({viewDocument: jest.fn()}));
jest.mock('react-native-fs', () => ({stat: jest.fn(), unlink: jest.fn()}));

const pickedFile = {
  uri: 'content://prescription',
  name: 'Prescription.pdf',
  type: 'application/pdf',
  size: 1200,
  hasRequestedType: true,
  error: null,
};

describe('Emergency Leave documents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (pick as jest.Mock).mockResolvedValue([pickedFile]);
    (keepLocalCopy as jest.Mock).mockResolvedValue([
      {status: 'success', localUri: 'file:///cache/Prescription.pdf'},
    ]);
    (RNFS.stat as jest.Mock).mockResolvedValue({size: 1200});
    (RNFS.unlink as jest.Mock).mockResolvedValue(undefined);
    (viewDocument as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => jest.restoreAllMocks());

  test('shows the emergency fields only when Emergency Leave is selected', () => {
    const screen = renderer.create(<EmergencyLeaveDetails visible={false} />);
    expect(screen.toJSON()).toBeNull();
    act(() => screen.update(<EmergencyLeaveDetails visible />));
    const otherReason = screen.root.findAllByProps({
      accessibilityLabel: 'Other Reason',
    })[0];
    act(() => otherReason.props.onPress());
    expect(otherReason.props.accessibilityState.checked).toBe(true);
  });

  test('attaches, previews and removes a valid document', async () => {
    const screen = renderer.create(<EmergencyLeaveDetails visible />);
    await act(async () =>
      screen.root
        .findAllByProps({accessibilityLabel: 'Choose supporting documents'})[0]
        .props.onPress(),
    );
    await act(async () =>
      screen.root
        .findAllByProps({accessibilityLabel: 'Preview Prescription.pdf'})[0]
        .props.onPress(),
    );
    expect(viewDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        uri: 'file:///cache/Prescription.pdf',
        mimeType: 'application/pdf',
      }),
    );
    act(() =>
      screen.root
        .findAllByProps({accessibilityLabel: 'Remove Prescription.pdf'})[0]
        .props.onPress(),
    );
    expect(
      screen.root.findAllByProps({
        accessibilityLabel: 'Preview Prescription.pdf',
      }),
    ).toHaveLength(0);
    expect(RNFS.unlink).toHaveBeenCalledWith('file:///cache/Prescription.pdf');
  });

  test('rejects unsupported and oversized files before copying', async () => {
    (pick as jest.Mock).mockResolvedValue([
      {...pickedFile, type: 'image/gif'},
      {...pickedFile, size: 5 * 1024 * 1024 + 1},
    ]);
    const screen = renderer.create(<EmergencyLeaveDetails visible />);
    await act(async () =>
      screen.root
        .findAllByProps({accessibilityLabel: 'Choose supporting documents'})[0]
        .props.onPress(),
    );
    expect(keepLocalCopy).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Some files could not be attached',
      expect.any(String),
    );
  });

  test('checks the copied file size even when the provider omits it', async () => {
    (pick as jest.Mock).mockResolvedValue([{...pickedFile, size: null}]);
    (RNFS.stat as jest.Mock).mockResolvedValue({size: 5 * 1024 * 1024 + 1});
    const screen = renderer.create(<EmergencyLeaveDetails visible />);
    await act(async () =>
      screen.root
        .findAllByProps({accessibilityLabel: 'Choose supporting documents'})[0]
        .props.onPress(),
    );
    expect(RNFS.unlink).toHaveBeenCalled();
    expect(
      screen.root.findAllByProps({
        accessibilityLabel: 'Preview Prescription.pdf',
      }),
    ).toHaveLength(0);
  });

  test('canceling the picker does not show an error', async () => {
    (pick as jest.Mock).mockRejectedValue({code: 'OPERATION_CANCELED'});
    const screen = renderer.create(<EmergencyLeaveDetails visible />);
    await act(async () =>
      screen.root
        .findAllByProps({accessibilityLabel: 'Choose supporting documents'})[0]
        .props.onPress(),
    );
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  test('decodes spaces in file URIs for filesystem validation', async () => {
    (keepLocalCopy as jest.Mock).mockResolvedValue([
      {status: 'success', localUri: 'file:///cache/Doctor%20Prescription.pdf'},
    ]);
    const screen = renderer.create(<EmergencyLeaveDetails visible />);
    await act(async () =>
      screen.root
        .findAllByProps({accessibilityLabel: 'Choose supporting documents'})[0]
        .props.onPress(),
    );
    expect(RNFS.stat).toHaveBeenCalledWith(
      'file:///cache/Doctor Prescription.pdf',
    );
  });
});
