import {COLORS, IMAGES, SIZE, FONTS} from '@res';
import {DataType} from '@types';
import {Common, Preferences} from '@utils';
import React, {FC, memo, useRef, useState} from 'react';
import {
  getVerifiedChamberLocation,
  LocationEvidence,
} from '../../../utils/chamberGeofence';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
} from 'react-native';
/*
 @ 𝔸𝕦𝕥𝕙𝕠𝕣: ℙ𝕒𝕟𝕜𝕒𝕛 𝕂𝕦𝕞𝕒𝕣 ℙ𝕣𝕒𝕛𝕒𝕡𝕒𝕥𝕚
 @ 𝔼𝕞𝕒𝕚𝕝: 𝕡𝕜𝕡𝕣𝕒𝕛𝕒𝕡𝕒𝕥𝕚𝟙𝟙𝟡𝟡𝟟@𝕘𝕞𝕒𝕚𝕝.𝕔𝕠𝕞
 */
interface Props {
  title: string;
  pic: DataType.ImagePickerResponse | null;
  setPic: (pic: DataType.ImagePickerResponse | null) => void;
  lat: number;
  long: number;
  chamber?: {latitude: unknown; longitude: unknown};
}

const CaptureChamberPicture: FC<Props> = ({
  title,
  pic,
  setPic,
  lat,
  long,
  chamber,
}) => {
  const [loading, setLoading] = useState(false);
  const capturing = useRef(false);
  const handleCapture = async () => {
    if (capturing.current) {
      return;
    }
    capturing.current = true;
    setLoading(true);
    try {
      let captureLocation: LocationEvidence | undefined;
      if (chamber) {
        await getVerifiedChamberLocation(
          chamber.latitude,
          chamber.longitude,
          undefined,
          {preferAccuracy: false},
        );
      }
      const watermark = async () => {
        // The native camera can remain open for minutes. Verify again on return
        // before accepting the photo or writing coordinates onto it.
        if (chamber) {
          captureLocation = await getVerifiedChamberLocation(
            chamber.latitude,
            chamber.longitude,
            undefined,
            {preferAccuracy: false},
          );
        }
        const latitude = captureLocation?.position.coords.latitude ?? lat;
        const longitude = captureLocation?.position.coords.longitude ?? long;
        const geoAdd = Preferences.getData(
          'LAST_GEO_ADDRESS',
        ) as DataType.GeoAddress;
        const address = chamber
          ? ''
          : `Location: ${geoAdd?.address ?? 'N/A'}\n`;
        return `${address}Latitude: ${latitude.toFixed(
          7,
        )} | Longitude: ${longitude.toFixed(7)}\n${Common.getFormatedDate(
          'DD-MMM-YYYY hh:mm:ss A',
        )}`;
      };
      const data = await Common.captureCameraImageWithWatermark(watermark);
      if (data) {
        setPic({...data, captureLocation});
      }
    } catch (error) {
      Common.alert({
        title: 'Photo not accepted',
        msg:
          error instanceof Error
            ? error.message
            : 'Unable to verify photo location. Please try again.',
      });
    } finally {
      capturing.current = false;
      setLoading(false);
    }
  };

  const handleRemove = () => {
    setPic(null);
  };

  return (
    <View style={styles.container}>
      {/* Camera Button */}
      <TouchableOpacity
        style={styles.cameraButton}
        onPress={handleCapture}
        disabled={loading}>
        <Image
          source={IMAGES.camera}
          style={styles.cameraIcon}
          resizeMode="contain"
        />
        <Text style={styles.buttonText}>{title}</Text>
      </TouchableOpacity>

      {/* Image Preview */}
      {pic?.path && (
        <View style={styles.imageContainer}>
          <Image
            source={{uri: pic.path}}
            style={styles.previewImage}
            resizeMode="cover"
          />
          {/* Remove Button */}
          <TouchableOpacity style={styles.removeButton} onPress={handleRemove}>
            <Image
              source={IMAGES.close}
              style={styles.closeIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      )}
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        </View>
      )}
    </View>
  );
};

export default memo(CaptureChamberPicture);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  cameraButton: {
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderRadius: SIZE.MS(6),
    paddingVertical: SIZE.MS(6),
    paddingHorizontal: SIZE.MS(10),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZE.MS(6),
    backgroundColor: COLORS.WHITE,
    marginBottom: SIZE.MVS(6),
  },
  cameraIcon: {
    width: SIZE.MS(14),
    height: SIZE.MS(12),
    tintColor: COLORS.colorDarkslategray100,
  },
  buttonText: {
    fontSize: SIZE.MS(12),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray100,
  },
  imageContainer: {
    width: '100%',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: SIZE.MS(90),
    borderRadius: SIZE.MS(6),
    backgroundColor: COLORS.BACKGROUND_DEFAULT,
  },
  removeButton: {
    position: 'absolute',
    top: SIZE.MS(-6),
    right: SIZE.MS(-6),
    width: SIZE.MS(20),
    height: SIZE.MS(20),
    borderRadius: SIZE.MS(10),
    backgroundColor: COLORS.colorRed,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: COLORS.BLACK,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  closeIcon: {
    width: SIZE.MS(8),
    height: SIZE.MS(8),
    tintColor: COLORS.WHITE,
  },
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: SIZE.MS(6),
  },
});
