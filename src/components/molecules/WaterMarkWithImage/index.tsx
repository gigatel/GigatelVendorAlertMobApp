import {COLORS, FONTS, SIZE, IMAGES} from '@res';
import {DataType} from '@types';
import React, {FC, memo, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
} from 'react-native';
import {Common} from '@utils';

interface Props {
  currentPosition: DataType.Coords | null;
  onImageCaptured: (imageData: string) => void;
  onRemove?: () => void;
  label: string;
  preview: string | null;
}

const WatermarkWithImage: FC<Props> = ({
  currentPosition,
  onImageCaptured,
  onRemove,
  label,
  preview,
}) => {
  const [loading, setLoading] = useState(false);

  const handleCaptureImage = async () => {
    setLoading(true);

    const imageData = await Common.captureCameraImageWithWatermark(
      'Watermark Text',
    );

    if (imageData?.data) {
      onImageCaptured(imageData.data);
    }

    setLoading(false);
  };

  return (
    <View style={styles.container}>
      {/* Capture Button */}
      <TouchableOpacity
        style={styles.captureButton}
        onPress={handleCaptureImage}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color={COLORS.PRIMARY} />
        ) : (
          <>
            <Image
              source={IMAGES.camera}
              style={styles.icon}
              resizeMode="contain"
            />
            <Text style={styles.buttonText}>{label}</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Preview Section */}
      <View style={styles.previewCard}>
        {preview ? (
          <>
            <Image
              source={{uri: `data:image/jpeg;base64,${preview}`}}
              style={styles.previewImage}
            />

            <TouchableOpacity style={styles.removeBtn} onPress={onRemove}>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Image
            source={IMAGES.galleryImg}
            style={styles.placeholderImage}
            resizeMode="contain"
          />
        )}
      </View>
    </View>
  );
};

export default memo(WatermarkWithImage);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: SIZE.MS(8),
  },

  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: SIZE.MS(34),
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderRadius: SIZE.MS(8),
    borderStyle: 'dashed',
    backgroundColor: COLORS.WHITE,
    gap: SIZE.MS(8),
  },

  icon: {
    width: SIZE.MS(16),
    height: SIZE.MS(16),
  },

  buttonText: {
    fontSize: 13,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.SEMI_BOLD,
  },

  previewCard: {
    height: SIZE.MS(110),
    borderRadius: SIZE.MS(8),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    backgroundColor: COLORS.WHITE,
    justifyContent: 'center',
    alignItems: 'center',
  },

  previewImage: {
    width: '100%',
    height: '100%',
  },

  placeholderImage: {
    width: SIZE.MS(22),
    height: SIZE.MS(22),
  },

  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'center',
  },

  removeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
