import {COLORS, IMAGES, SIZE, FONTS} from '@res';
import {Common} from '@utils';
import React, {FC, memo, useState} from 'react';
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
 *
 * BurnResult shape — same as before so API payload is unchanged:
 *   imageData      → plain base64 string (NO "data:image/png;base64," prefix)
 *   imageExtention → always 'png'
 *   uri            → local file URI for preview (data: URI or file:// path)
 *
 * UI is intentionally identical to CaptureChamberPicture.
 * No internal double-preview — parent (AddInstallationFrom) removed ImagePreviewCard.
 */

// ── Public type — imported by AddInstallationFrom ────────────────────────────
export type BurnResult = {
  imageData: string; // plain base64, no prefix — ready for FormData text field
  imageExtention: 'png';
  uri: string; // preview URI (data:image/png;base64,... or file://)
};

interface Props {
  title: string;
  pic: BurnResult | null;
  setPic: (result: BurnResult | null) => void;
  /** Latitude as string (matches wLat / wLong from AddInstallationFrom) */
  lat: string;
  long: string;
  address?: string; // ✅ ADD THIS
  hasError?: boolean;
  compact?: boolean;
}

const CaptureImageWatermark: FC<Props> = ({
  title,
  pic,
  setPic,
  lat,
  long,
  address, // ✅ ADD
  hasError = false,
  compact = false,
}) => {
  const [loading, setLoading] = useState(false);

  const handleCapture = () => {
    setLoading(true);
    try {
      const latNum = parseFloat(lat) || 0;
      const lngNum = parseFloat(long) || 0;

      const watermarkText = [
        `Location: ${address || 'N/A'}`, // ✅ fresh address
        `Latitude: ${latNum.toFixed(7)} | Longitude: ${lngNum.toFixed(7)}`,
        Common.getFormatedDate('DD-MMM-YYYY hh:mm:ss A'),
      ].join('\n');

      Common.captureCameraImageWithWatermark(watermarkText).then(
        (data: any) => {
          setLoading(false);
          if (!data) {
            Common.showToast(
              'There is an issue in click picture and add watermark',
              'long',
            );
            return;
          }
          /*
           * Normalise into BurnResult — two shapes handled:
           *   A) Already BurnResult  → { imageData, imageExtention, uri }
           *   B) ImagePickerResponse → { path, data, mime, ... }
           */
          if (data.imageData !== undefined) {
            // Shape A — already correct
            setPic(data as BurnResult);
          } else {
            // Shape B — adapt (same as CaptureChamberPicture uses)
            const rawBase64: string =
              typeof data.data === 'string'
                ? data.data.replace(/^data:[^;]+;base64,/, '')
                : '';

            const previewUri: string =
              data.path ??
              (rawBase64 ? `data:image/png;base64,${rawBase64}` : '');

            setPic({
              imageData: rawBase64,
              imageExtention: 'png',
              uri: previewUri,
            });
          }
        },
      );
    } catch (error) {
      Common.error('ERROR IN CAPTURE IMAGE:', error);
      setLoading(false);
    }
  };

  const handleRemove = () => setPic(null);

  // Derive preview URI: prefer explicit uri field, fall back to data: prefix
  const previewUri: string | null = pic
    ? pic.uri ||
      (pic.imageData ? `data:image/png;base64,${pic.imageData}` : null)
    : null;

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <TouchableOpacity
          accessibilityLabel={`Capture ${title}`}
          style={[styles.compactSlot, hasError && styles.cameraButtonError]}
          onPress={handleCapture}
          disabled={loading}>
          {previewUri ? (
            <Image source={{uri: previewUri}} style={styles.compactPreview} />
          ) : (
            <>
              <Image
                source={IMAGES.camera}
                style={styles.compactCamera}
                resizeMode="contain"
              />
              <Text style={styles.compactLabel}>{title}</Text>
            </>
          )}
          {loading && <ActivityIndicator color={COLORS.PRIMARY} />}
        </TouchableOpacity>
        {previewUri && (
          <TouchableOpacity
            accessibilityLabel={`Remove ${title}`}
            style={styles.removeButton}
            onPress={handleRemove}>
            <Image
              source={IMAGES.close}
              style={styles.closeIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Camera Button — identical to CaptureChamberPicture ── */}
      <TouchableOpacity
        style={[styles.cameraButton, hasError && styles.cameraButtonError]}
        onPress={handleCapture}
        disabled={loading}
        activeOpacity={0.75}>
        <Image
          source={IMAGES.camera}
          style={styles.cameraIcon}
          resizeMode="contain"
        />
        <Text style={styles.buttonText}>{title}</Text>
      </TouchableOpacity>

      {/* ── Single Image Preview (exactly like CaptureChamberPicture) ── */}
      {previewUri ? (
        <View style={styles.imageContainer}>
          <Image
            source={{uri: previewUri}}
            style={styles.previewImage}
            resizeMode="cover"
          />
          <TouchableOpacity style={styles.removeButton} onPress={handleRemove}>
            <Image
              source={IMAGES.close}
              style={styles.closeIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Loading overlay ── */}
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        </View>
      )}
    </View>
  );
};

export default memo(CaptureImageWatermark);

// ─────────────────────────────────────────────────────────────────────────────
// Styles — 1:1 copy of CaptureChamberPicture styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  compactContainer: {flex: 1, position: 'relative'},
  compactSlot: {
    height: 74,
    borderRadius: 6,
    backgroundColor: '#F3F6F9',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    overflow: 'hidden',
  },
  compactPreview: {width: '100%', height: '100%'},
  compactCamera: {width: 20, height: 18, tintColor: '#617795'},
  compactLabel: {fontSize: 10, color: '#617795', fontFamily: FONTS.REGULAR},
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
  cameraButtonError: {
    borderColor: '#f44336',
    borderWidth: 1.5,
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
