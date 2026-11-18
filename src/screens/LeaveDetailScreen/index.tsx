import React, {FC, useMemo} from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import moment from 'moment';
import {Screen} from '@organisms';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {ScreenProps} from '@types';

export interface LeaveDetailRequest {
  id: string;
  appliedOn: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  reason?: string;
  dayTypes?: Record<string, string>;
}

// Preview data until leave requests are loaded from the API.
const SAMPLE_REQUEST: LeaveDetailRequest = {
  id: 'pending-1',
  appliedOn: '2026-07-01',
  fromDate: '2026-07-10',
  toDate: '2026-07-13',
  totalDays: 4,
  status: 'Pending',
  reason: 'Lorem Ipsum is simply dummy text of the',
  dayTypes: {'2026-07-13': 'Half Day (First Half)'},
};

const STATUS_COLORS = {
  Pending: {dot: COLORS.colorGold, text: COLORS.colorGoldenrod},
  Approved: {dot: COLORS.colorLimegreen, text: COLORS.colorGreen200},
  Rejected: {dot: COLORS.colorCrimson, text: COLORS.colorCrimson},
};

const LeaveDetailScreen: FC<ScreenProps.LeaveDetailScreen> = ({
  navigation,
  route,
  loading,
}) => {
  const request = route.params?.request ?? SAMPLE_REQUEST;
  const statusColor = STATUS_COLORS[request.status];
  const dates = useMemo(() => {
    const result: string[] = [];
    const date = moment(request.fromDate, 'YYYY-MM-DD');
    const end = moment(request.toDate, 'YYYY-MM-DD');
    while (date.isSameOrBefore(end, 'day')) {
      result.push(date.format('YYYY-MM-DD'));
      date.add(1, 'day');
    }
    return result;
  }, [request.fromDate, request.toDate]);
  const from = moment(request.fromDate, 'YYYY-MM-DD');
  const to = moment(request.toDate, 'YYYY-MM-DD');
  const dateFormat = from.isSame(to, 'year') ? 'DD MMMM' : 'DD MMM YYYY';
  const dateRange =
    request.fromDate === request.toDate
      ? from.format(dateFormat)
      : `${from.format(dateFormat)} - ${to.format(dateFormat)}`;

  return (
    <Screen
      preset="fixed"
      loading={loading}
      statusBarStyle="dark"
      statusBgColor={COLORS.colorWhitesmoke100}
      navBarColor={COLORS.colorWhitesmoke100}>
      <View style={styles.body}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <Image
              source={IMAGES.back}
              style={styles.backIcon}
              resizeMode="contain"
            />
          </Pressable>
          <Text style={styles.title}>Leave Detail</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.appliedDateRow}>
                <Image
                  source={IMAGES.calendar}
                  style={styles.calendarIcon}
                  resizeMode="contain"
                />
                <Text style={styles.appliedDate}>
                  {moment(request.appliedOn, 'YYYY-MM-DD').format(
                    'DD MMMM YYYY',
                  )}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <View
                  style={[styles.statusDot, {backgroundColor: statusColor.dot}]}
                />
                <Text style={[styles.statusText, {color: statusColor.text}]}>
                  {request.status}
                </Text>
              </View>
            </View>
            <Text style={styles.label}>Leave Reason:</Text>
            <View style={styles.reasonBox}>
              <Text style={styles.value}>
                {request.reason ?? 'No reason provided'}
              </Text>
            </View>
            <View style={styles.detailsRow}>
              <View style={styles.detailColumn}>
                <Text style={styles.label}>Leave Date</Text>
                <Text style={styles.value}>{dateRange}</Text>
              </View>
              <View style={styles.detailColumn}>
                <Text style={styles.label}>Total Leave</Text>
                <Text style={styles.value}>
                  {request.totalDays} {request.totalDays === 1 ? 'Day' : 'Days'}
                </Text>
              </View>
            </View>
            <Text style={styles.label}>Per Day Leave Types:</Text>
            <View style={styles.daysTable}>
              {dates.map((date, index) => (
                <View
                  key={date}
                  style={[styles.dayRow, index > 0 && styles.dayDivider]}>
                  <Text style={[styles.value, styles.dayDate]}>
                    {moment(date).format('DD MMM YYYY')}
                  </Text>
                  <Text style={[styles.value, styles.dayType]}>
                    : {request.dayTypes?.[date] ?? 'Full Day'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
        <Pressable
          style={styles.backToLeaveButton}
          onPress={() => navigation.popTo('LeaveStatusScreen')}
          accessibilityRole="button"
          accessibilityLabel="Back to leave">
          <Image
            source={IMAGES.back}
            style={styles.buttonIcon}
            resizeMode="contain"
          />
          <Text style={styles.buttonText}>Back To Leave</Text>
        </Pressable>
      </View>
    </Screen>
  );
};

export default LeaveDetailScreen;

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: 14,
    backgroundColor: COLORS.colorWhitesmoke100,
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  backButton: {width: 40, height: 44, justifyContent: 'center'},
  backIcon: {width: 22, height: 22},
  headerSpacer: {width: 40},
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MS(14),
    color: COLORS.colorDarkslategray,
  },
  scroll: {flex: 1},
  scrollContent: {paddingBottom: 20},
  card: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: COLORS.WHITE,
    gap: 9,
    shadowColor: '#AEBAC4',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  appliedDateRow: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5},
  calendarIcon: {width: 16, height: 16, tintColor: '#00BFFF'},
  appliedDate: {
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MS(10),
    color: COLORS.colorDarkslategray,
    flexShrink: 1,
  },
  statusRow: {flexDirection: 'row', alignItems: 'center', gap: 5},
  statusDot: {width: 12, height: 12, borderRadius: 6},
  statusText: {fontFamily: FONTS.REGULAR, fontSize: SIZE.MS(10)},
  label: {
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MS(10),
    color: COLORS.colorSlategray,
  },
  value: {
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MS(12),
    color: COLORS.colorDarkslategray,
    lineHeight: 18,
  },
  reasonBox: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderRadius: 7,
    padding: 10,
  },
  detailsRow: {flexDirection: 'row', gap: 12, marginVertical: 3},
  detailColumn: {flex: 1, gap: 4},
  daysTable: {
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderRadius: 7,
    overflow: 'hidden',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    gap: 8,
  },
  dayDivider: {borderTopWidth: 1, borderTopColor: '#F2F3F5'},
  dayDate: {flex: 1},
  dayType: {flex: 1.05},
  backToLeaveButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: 12,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#43CAFA',
  },
  buttonIcon: {width: 16, height: 16, tintColor: COLORS.WHITE},
  buttonText: {
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MS(13),
    color: COLORS.WHITE,
  },
});
