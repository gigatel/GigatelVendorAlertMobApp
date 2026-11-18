import React, {useRef, useState} from 'react';
import {
  Alert,
  Image,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
} from '@react-native-documents/picker';
import {viewDocument} from '@react-native-documents/viewer';
import RNFS from 'react-native-fs';
import {COLORS, FONTS, IMAGES} from '@res';

const EMERGENCY_REASONS = ['Sick Leave', 'Other Reason'] as const;
const MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
type Attachment = {uri: string; name: string; type: string; size: number};

export default function EmergencyLeaveDetails({visible}: {visible: boolean}) {
  const [reason, setReason] =
    useState<(typeof EMERGENCY_REASONS)[number]>('Sick Leave');
  const [documents, setDocuments] = useState<Attachment[]>([]);
  const [isPicking, setIsPicking] = useState(false);
  const pickingRef = useRef(false);

  const chooseFiles = async () => {
    if (pickingRef.current) {
      return;
    }
    Keyboard.dismiss();
    pickingRef.current = true;
    setIsPicking(true);
    try {
      const files = await pick({
        allowMultiSelection: true,
        type:
          Platform.OS === 'ios'
            ? ['com.adobe.pdf', 'public.jpeg', 'public.png']
            : MIME_TYPES,
      });
      const accepted: Attachment[] = [];
      const rejected: string[] = [];
      for (const file of files) {
        const name = file.name ?? 'Document';
        if (
          file.error ||
          !file.hasRequestedType ||
          !MIME_TYPES.includes(file.type ?? '') ||
          (file.size !== null && file.size > MAX_FILE_SIZE)
        ) {
          rejected.push(name);
          continue;
        }
        try {
          const [copy] = await keepLocalCopy({
            files: [{uri: file.uri, fileName: name}],
            destination: 'cachesDirectory',
          });
          if (copy.status !== 'success') {
            rejected.push(name);
            continue;
          }
          const localPath = decodeURIComponent(copy.localUri);
          const size = Number((await RNFS.stat(localPath)).size);
          if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_SIZE) {
            await RNFS.unlink(localPath).catch(() => {});
            rejected.push(name);
            continue;
          }
          accepted.push({uri: copy.localUri, name, type: file.type!, size});
        } catch {
          rejected.push(name);
        }
      }
      setDocuments(current => [...current, ...accepted]);
      if (rejected.length) {
        Alert.alert(
          'Some files could not be attached',
          `Choose readable PDF, JPG, JPEG or PNG files up to 5 MB each.\n\n${rejected.join(
            '\n',
          )}`,
        );
      }
    } catch (error) {
      if (
        !isErrorWithCode(error) ||
        error.code !== errorCodes.OPERATION_CANCELED
      ) {
        Alert.alert(
          'Unable to choose documents',
          'Please try selecting your documents again.',
        );
      }
    } finally {
      pickingRef.current = false;
      setIsPicking(false);
    }
  };

  const previewDocument = async (document: Attachment) => {
    try {
      await viewDocument({
        uri: document.uri,
        mimeType: document.type,
        headerTitle: document.name,
      });
    } catch {
      Alert.alert(
        'Unable to preview document',
        'Please make sure a compatible document viewer is installed.',
      );
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.label}>
        Emergency Leave Reason <Text style={styles.required}>*</Text>
      </Text>
      <View style={styles.reasonRow} accessibilityRole="radiogroup">
        {EMERGENCY_REASONS.map(option => (
          <Pressable
            key={option}
            style={styles.reasonOption}
            accessibilityRole="radio"
            accessibilityLabel={option}
            accessibilityState={{checked: reason === option}}
            onPress={() => setReason(option)}>
            <View
              style={[styles.radio, reason === option && styles.radioSelected]}>
              {reason === option && <View style={styles.radioDot} />}
            </View>
            <Text style={styles.label}>{option}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Supporting Documents (Optional)</Text>
      <Pressable
        style={styles.uploadBox}
        onPress={chooseFiles}
        disabled={isPicking}
        accessibilityRole="button"
        accessibilityLabel="Choose supporting documents"
        accessibilityState={{disabled: isPicking, busy: isPicking}}>
        <Image
          source={IMAGES.upload}
          style={styles.uploadIcon}
          resizeMode="contain"
        />
        <Text style={styles.uploadTitle}>Upload Documents</Text>
        <Text style={styles.uploadHint}>PDF, JPG, JPEG, PNG</Text>
        <Text style={styles.uploadHint}>Maximum 5 MB per file</Text>
        <View style={styles.chooseButton}>
          <Text style={styles.chooseText}>
            {isPicking ? 'Choosing...' : '+ Choose File'}
          </Text>
        </View>
      </Pressable>
      {documents.length > 0 && (
        <Text style={styles.label}>Uploaded Documents</Text>
      )}
      {documents.map(document => (
        <View key={document.uri} style={styles.documentRow}>
          <Text style={styles.fileBadge}>
            {document.type === 'application/pdf' ? 'PDF' : 'IMG'}
          </Text>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>
              {document.name}
            </Text>
            <Text style={styles.fileMeta}>
              {(document.size / (1024 * 1024)).toFixed(2)} MB ·{' '}
              {document.type === 'application/pdf'
                ? 'PDF'
                : document.type === 'image/png'
                ? 'PNG'
                : 'JPEG'}
            </Text>
          </View>
          <Pressable
            style={styles.fileAction}
            onPress={() => previewDocument(document)}
            accessibilityRole="button"
            accessibilityLabel={`Preview ${document.name}`}>
            <Text style={styles.previewIcon}>◉</Text>
          </Pressable>
          <Pressable
            style={styles.fileAction}
            onPress={() => {
              setDocuments(current =>
                current.filter(item => item.uri !== document.uri),
              );
              RNFS.unlink(decodeURIComponent(document.uri)).catch(() => {});
            }}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${document.name}`}>
            <Text style={styles.removeIcon}>×</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {alignSelf: 'stretch', gap: 10},
  label: {
    fontFamily: FONTS.REGULAR,
    fontSize: 13,
    color: COLORS.colorDarkslategray,
  },
  required: {color: COLORS.colorCrimson},
  reasonRow: {flexDirection: 'row', gap: 12},
  reasonOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderRadius: 8,
  },
  radio: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: COLORS.colorSlategray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {borderColor: COLORS.colorDeepskyblue, borderWidth: 2},
  radioDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.colorDeepskyblue,
  },
  uploadBox: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 3,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.colorDeepskyblue,
    borderRadius: 8,
  },
  uploadIcon: {width: 18, height: 18, tintColor: COLORS.colorDeepskyblue},
  uploadTitle: {
    fontFamily: FONTS.REGULAR,
    fontSize: 11,
    color: COLORS.colorDarkslategray,
  },
  uploadHint: {
    fontFamily: FONTS.REGULAR,
    fontSize: 9,
    color: COLORS.colorSlategray,
  },
  chooseButton: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: COLORS.colorDeepskyblue,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chooseText: {
    fontFamily: FONTS.REGULAR,
    fontSize: 10,
    color: COLORS.colorDeepskyblue,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderRadius: 8,
    paddingLeft: 8,
    minHeight: 44,
    gap: 6,
  },
  fileBadge: {
    fontFamily: FONTS.MEDIUM,
    fontSize: 9,
    color: COLORS.colorCrimson,
  },
  fileInfo: {flex: 1, gap: 3},
  fileName: {
    fontFamily: FONTS.REGULAR,
    fontSize: 11,
    color: COLORS.colorDarkslategray,
  },
  fileMeta: {
    fontFamily: FONTS.REGULAR,
    fontSize: 9,
    color: COLORS.colorSlategray,
  },
  fileAction: {
    minWidth: 36,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewIcon: {fontSize: 18, color: COLORS.colorSlategray},
  removeIcon: {fontSize: 24, color: COLORS.colorCrimson},
});
