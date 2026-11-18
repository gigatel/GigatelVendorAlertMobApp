import React, {FC, useState} from 'react';
import {FlatList, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import moment from 'moment';
import {Screen} from '@organisms';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {ScreenProps} from '@types';

const LEAVE_STATUSES = ['Pending', 'Approved', 'Rejected'] as const;
type LeaveStatus = (typeof LEAVE_STATUSES)[number];

interface LeaveRequest {
  id: string;
  appliedOn: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  status: LeaveStatus;
}

// Sample requests for the status tabs until the leave API is connected.
const LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: 'pending-1',
    appliedOn: '2026-07-01',
    fromDate: '2026-07-10',
    toDate: '2026-07-13',
    totalDays: 4,
    status: 'Pending',
  },
  {
    id: 'pending-2',
    appliedOn: '2026-07-11',
    fromDate: '2026-07-15',
    toDate: '2026-07-15',
    totalDays: 1,
    status: 'Pending',
  },
  {
    id: 'approved-1',
    appliedOn: '2026-06-18',
    fromDate: '2026-06-22',
    toDate: '2026-06-24',
    totalDays: 3,
    status: 'Approved',
  },
  {
    id: 'approved-2',
    appliedOn: '2026-06-05',
    fromDate: '2026-06-08',
    toDate: '2026-06-08',
    totalDays: 1,
    status: 'Approved',
  },
  {
    id: 'rejected-1',
    appliedOn: '2026-06-12',
    fromDate: '2026-06-16',
    toDate: '2026-06-17',
    totalDays: 2,
    status: 'Rejected',
  },
  {
    id: 'rejected-2',
    appliedOn: '2026-05-20',
    fromDate: '2026-05-25',
    toDate: '2026-05-25',
    totalDays: 1,
    status: 'Rejected',
  },
];

const STATUS_COLORS: Record<LeaveStatus, {dot: string; text: string}> = {
  Pending: {dot: COLORS.colorGold, text: COLORS.colorGoldenrod},
  Approved: {dot: COLORS.colorLimegreen, text: COLORS.colorGreen200},
  Rejected: {dot: COLORS.colorCrimson, text: COLORS.colorCrimson},
};

const formatLeaveDates = (fromDate: string, toDate: string) => {
  const from = moment(fromDate, 'YYYY-MM-DD');
  const to = moment(toDate, 'YYYY-MM-DD');
  if (fromDate === toDate) {
    return from.format('DD MMMM');
  }
  if (from.isSame(to, 'year')) {
    return `${from.format('DD MMMM')} - ${to.format('DD MMMM')}`;
  }
  return `${from.format('DD MMM YYYY')} - ${to.format('DD MMM YYYY')}`;
};

const LeaveCard: FC<{request: LeaveRequest; onPress: () => void}> = ({
  request,
  onPress,
}) => {
  const statusColor = STATUS_COLORS[request.status];
  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${request.status.toLowerCase()} leave from ${moment(
        request.fromDate,
      ).format('DD MMMM YYYY')}`}>
      <View style={styles.cardContent}>
        <View style={styles.appliedDateRow}>
          <Image
            source={IMAGES.calendar}
            style={styles.calendarIcon}
            resizeMode="contain"
          />
          <Text style={styles.appliedDate}>
            {moment(request.appliedOn, 'YYYY-MM-DD').format('DD MMMM YYYY')}
          </Text>
        </View>
        <View style={styles.detailsRow}>
          <View style={styles.detailColumn}>
            <Text style={styles.detailLabel}>Leave Date</Text>
            <Text style={styles.detailValue}>
              {formatLeaveDates(request.fromDate, request.toDate)}
            </Text>
          </View>
          <View style={styles.detailColumn}>
            <Text style={styles.detailLabel}>Total Leave</Text>
            <Text style={styles.detailValue}>
              {request.totalDays} {request.totalDays === 1 ? 'Day' : 'Days'}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, {backgroundColor: statusColor.dot}]} />
        <Text style={[styles.statusText, {color: statusColor.text}]}>
          {request.status}
        </Text>
      </View>
    </Pressable>
  );
};

const LeaveStatusScreen: FC<ScreenProps.LeaveStatusScreen> = ({
  navigation,
  loading,
}) => {
  const [activeStatus, setActiveStatus] = useState<LeaveStatus>('Pending');
  const requests = LEAVE_REQUESTS.filter(item => item.status === activeStatus);

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
          <Text style={styles.title}>Leave Status</Text>
          <Pressable
            style={styles.addButton}
            onPress={() => navigation.navigate('ApplyLeaveScreen')}
            accessibilityRole="button"
            accessibilityLabel="Apply leave">
            <View style={styles.addIconBackground}>
              <Image
                source={IMAGES.plus}
                style={styles.addIcon}
                resizeMode="contain"
              />
            </View>
          </Pressable>
        </View>
        <View style={styles.tabs} accessibilityRole="tablist">
          {LEAVE_STATUSES.map(status => {
            const selected = status === activeStatus;
            return (
              <Pressable
                key={status}
                style={[styles.tab, selected && styles.activeTab]}
                onPress={() => setActiveStatus(status)}
                accessibilityRole="tab"
                accessibilityLabel={status}
                accessibilityState={{selected}}>
                <Text
                  style={[styles.tabText, selected && styles.activeTabText]}>
                  {status}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <FlatList
          data={requests}
          keyExtractor={item => item.id}
          renderItem={({item}) => (
            <LeaveCard
              request={item}
              onPress={() =>
                navigation.navigate('LeaveDetailScreen', {request: item})
              }
            />
          )}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No {activeStatus.toLowerCase()} leave requests
            </Text>
          }
        />
      </View>
    </Screen>
  );
};
export default LeaveStatusScreen;
const styles = StyleSheet.create({
  body: {
    flex: 1,
    backgroundColor: COLORS.colorWhitesmoke100,
    paddingHorizontal: 14,
  },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZE.MS(16),
    marginTop: SIZE.MS(16),
  },
  backButton: {
    width: 40,
    height: 44,
    justifyContent: 'center',
  },
  backIcon: {
    width: 22,
    height: 22,
  },
  addButton: {
    width: 40,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  addIconBackground: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: '#43CAFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: {width: 16, height: 16, tintColor: COLORS.WHITE},
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MS(14),
    color: COLORS.colorDarkslategray,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.WHITE,
    borderRadius: 24,
    padding: 1,
    marginTop: 12,
  },
  tab: {
    flex: 1,
    minHeight: 32,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  activeTab: {backgroundColor: '#43CAFA'},
  tabText: {
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MS(12),
    color: COLORS.colorDarkslategray,
  },
  activeTabText: {color: COLORS.WHITE, fontFamily: FONTS.MEDIUM},
  list: {flex: 1, marginTop: 14},
  listContent: {paddingBottom: 24},
  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#AEBAC4',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 1,
  },
  cardContent: {paddingHorizontal: 8, paddingTop: 9, paddingBottom: 7},
  appliedDateRow: {flexDirection: 'row', alignItems: 'center', gap: 5},
  calendarIcon: {width: 16, height: 16, tintColor: '#00BFFF'},
  appliedDate: {
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MS(10),
    color: COLORS.colorDarkslategray,
  },
  detailsRow: {flexDirection: 'row', marginTop: 9, gap: 12},
  detailColumn: {flex: 1, gap: 3},
  detailLabel: {
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MS(10),
    color: COLORS.colorSlategray,
  },
  detailValue: {
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MS(12),
    color: COLORS.colorDarkslategray,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderTopWidth: 1,
    borderTopColor: '#F2F3F5',
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  statusDot: {width: 12, height: 12, borderRadius: 6},
  statusText: {fontFamily: FONTS.REGULAR, fontSize: SIZE.MS(11)},
  emptyText: {
    paddingVertical: 32,
    textAlign: 'center',
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MS(12),
    color: COLORS.colorSlategray,
  },
});
