import {RootState} from '@reducers';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import React, {useState} from 'react';
import {
  Padding,
  FontSize,
  FontFamily,
  Height,
  Width,
  Gap,
} from '../../../res/globalStyle';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Pressable,
  Modal,
} from 'react-native';
import {useSelector} from 'react-redux';
interface TicketInfo {
  ticketNo?: string;
  dateTime?: string;
  assignedBy?: string;
}
interface BackHeaderProps {
  onBackPress: () => void;
  headerTitle?: string;
  ticketInfo?: TicketInfo;
  showLanguageSelector?: boolean;
  selectedLang?: 'en' | 'hi';
  onLangChange?: (lang: 'en' | 'hi') => void;
}
const BackHeader: React.FC<BackHeaderProps> = ({
  onBackPress,
  headerTitle = '',
  ticketInfo,
  showLanguageSelector = false,
  selectedLang = 'en',
  onLangChange,
}) => {
  const device = useSelector((state: RootState) => state.device);
  const [open, setOpen] = useState(false);
  const showTicketCard =
    ticketInfo?.ticketNo || ticketInfo?.dateTime || ticketInfo?.assignedBy;
  const selectLang = (lang: 'en' | 'hi') => {
    onLangChange?.(lang);
    setOpen(false);
  };
  return (
    <>
      {/* ================= HEADER ================= */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={onBackPress} style={styles.backBtn}>
          <Image source={IMAGES.back} style={styles.backIcon} />
        </TouchableOpacity>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {headerTitle}
        </Text>
        {/* 🌍 LANGUAGE BUTTON */}
        {showLanguageSelector ? (
          <Pressable style={styles.lan1} onPress={() => setOpen(prev => !prev)}>
            <View style={styles.parentFlexBox}>
              <Image source={IMAGES.globeNew} style={styles.globe2Icon} />
              <Text style={styles.en}>{selectedLang.toUpperCase()}</Text>
            </View>
            <Image source={IMAGES.arrowDown} style={styles.vectorIcon} />
          </Pressable>
        ) : (
          <View style={styles.rightSpace} />
        )}
      </View>
      {/* ================= LANGUAGE DROPDOWN ================= */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <View style={styles.dropdown}>
            <Pressable style={styles.langRow} onPress={() => selectLang('en')}>
              <Image source={IMAGES.usiconFlag} style={styles.flag} />
              <Text style={[styles.langLabel, {marginLeft: 10}]}>English</Text>
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.langRow} onPress={() => selectLang('hi')}>
              <Image source={IMAGES.indianFlag} style={styles.flag} />
              <Text style={[styles.langLabel, {marginLeft: 10}]}>Hindi</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
      {/* ================= TICKET INFO CARD ================= */}
      {showTicketCard && (
        <View style={styles.ticketCard}>
          <View style={styles.ticketTopRow}>
            {ticketInfo?.ticketNo && (
              <View style={styles.ticketNoBox}>
                <Image source={IMAGES.TicketId} style={styles.ticketIcon} />
                <Text style={styles.ticketNoText}>{ticketInfo.ticketNo}</Text>
              </View>
            )}
            {ticketInfo?.dateTime && (
              <Text style={styles.dateText}>{ticketInfo.dateTime}</Text>
            )}
          </View>

          {ticketInfo?.assignedBy && (
            <Text style={styles.assignedText}>
              Asg by :{' '}
              <Text style={styles.assignedName}>{ticketInfo.assignedBy}</Text>
            </Text>
          )}
        </View>
      )}
    </>
  );
};

export default BackHeader;

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  headerContainer: {
    height: SIZE.MS(55),
    backgroundColor: COLORS.PRIMARY,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  backBtn: {
    width: SIZE.MS(55),
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    tintColor: COLORS.WHITE,
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: SIZE.MS(16),
    fontFamily: FONTS.MEDIUM,
    fontWeight: '500',
    color: COLORS.WHITE,
  },
  rightSpace: {
    width: SIZE.MS(55),
  },
  langLabel: {
    fontSize: 14,
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
  },
  /* LANGUAGE BUTTON */
  lan1: {
    marginRight: SIZE.MS(12),
    borderRadius: 16,
    backgroundColor: '#007CAD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  parentFlexBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  globe2Icon: {
    width: 14,
    height: 14,
    tintColor: COLORS.WHITE,
  },
  en: {
    fontSize: 12,
    color: COLORS.WHITE,
    fontFamily: FontFamily.switzer,
  },
  vectorIcon: {
    width: 10,
    height: 6,
    tintColor: COLORS.WHITE,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdown: {
    position: 'absolute',
    top: SIZE.MS(45),
    right: SIZE.MS(12),
    backgroundColor: COLORS.WHITE,
    borderRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  langRow: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    marginLeft: 10,
  },
  langText: {
    fontSize: 14,
    fontFamily: FontFamily.switzer,
    color: COLORS.BLACK,
  },
  flag: {
    width: 22,
    height: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#EEE',
  },
  ticketCard: {
    backgroundColor: '#FBEAA6',
    marginHorizontal: SIZE.MS(12),
    marginTop: SIZE.MS(10),
    borderRadius: 8,
    padding: 12,
  },
  ticketTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ticketNoBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticketIcon: {
    width: 18,
    height: 18,
    marginRight: 6,
  },
  ticketNoText: {
    fontFamily: FONTS.MEDIUM,
    fontSize: 14,
  },
  dateText: {
    fontFamily: FONTS.REGULAR,
    fontSize: 13,
  },
  assignedText: {
    marginTop: 6,
    fontSize: 13,
  },
  assignedName: {
    color: COLORS.PRIMARY,
    fontFamily: FONTS.MEDIUM,
  },
});
