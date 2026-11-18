import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import React, {FC} from 'react';
import moment from 'moment';
import {Screen} from '@organisms';
import {COLORS, FONTS} from '@res';
import {ScreenProps} from '@types';
import type {LeaveDetailRequest} from '@screens/LeaveDetailScreen';

const PREVIEW_REQUEST: LeaveDetailRequest = {
  id: 'submitted-preview',
  appliedOn: '2026-11-10',
  fromDate: '2026-11-12',
  toDate: '2026-11-15',
  totalDays: 4,
  status: 'Pending',
};

const RequestSubMissionScreen: FC<ScreenProps.RequestSubmissionScreen> = ({
  navigation,
  route,
  loading,
}) => {
  const request = route.params?.request ?? PREVIEW_REQUEST;
  const requestType = route.params?.leaveRequestType ?? 'Emergency Leave';
  const from = moment(request.fromDate, 'YYYY-MM-DD');
  const to = moment(request.toDate, 'YYYY-MM-DD');
  const period =
    request.fromDate === request.toDate
      ? from.format('DD MMM YYYY')
      : `${from.format(
          from.isSame(to, 'year') ? 'DD MMM' : 'DD MMM YYYY',
        )} – ${to.format('DD MMM YYYY')}`;
  const close = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('LeaveStatusScreen');
    }
  };
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
            style={styles.closeButton}
            onPress={close}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close request confirmation">
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View
            style={styles.successHalo}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            <View style={styles.successCircle}>
              <View style={styles.checkmark} />
            </View>
          </View>
          <Text style={styles.title} accessibilityRole="header">
            Request Submitted
          </Text>
          <Text style={styles.message}>
            Your {requestType.toLowerCase()} request has been submitted
            successfully.
          </Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.label}>Applied Date</Text>
              <Text style={styles.value}>
                {moment(request.appliedOn, 'YYYY-MM-DD').format('DD MMM YYYY')}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.label}>Leave Period</Text>
              <Text style={styles.value}>
                {period} ({request.totalDays}{' '}
                {request.totalDays === 1 ? 'day' : 'days'})
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.label}>Status</Text>
              <Text style={[styles.value, styles.status]}>
                {request.status === 'Pending'
                  ? 'Pending Approval'
                  : request.status}
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.viewButton}
            onPress={() => navigation.replace('LeaveDetailScreen', {request})}
            accessibilityRole="button"
            accessibilityLabel="View leave request">
            <Text style={styles.viewButtonText}>View Leave Request</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Screen>
  );
};

export default RequestSubMissionScreen;

const styles = StyleSheet.create({
  body: {flex: 1, backgroundColor: COLORS.colorWhitesmoke100},
  header: {
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 10,
    height: 44,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#D0D3D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontFamily: FONTS.REGULAR,
    fontSize: 22,
    lineHeight: 26,
    color: COLORS.colorDarkslategray,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 34,
    paddingTop: 35,
    paddingBottom: 32,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  successHalo: {
    width: 98,
    height: 98,
    borderRadius: 49,
    backgroundColor: '#E2F5EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#198F50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    width: 30,
    height: 17,
    borderLeftWidth: 5,
    borderBottomWidth: 5,
    borderColor: COLORS.colorWhite,
    borderRadius: 2,
    transform: [{translateY: -4}, {rotate: '-45deg'}],
  },
  title: {
    fontFamily: FONTS.SEMI_BOLD,
    fontSize: 16,
    color: COLORS.colorDarkslategray,
    textAlign: 'center',
    marginTop: 14,
  },
  message: {
    fontFamily: FONTS.REGULAR,
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.colorSlategray,
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 240,
  },
  summaryCard: {
    alignSelf: 'stretch',
    marginTop: 20,
    padding: 12,
    gap: 8,
    borderRadius: 8,
    backgroundColor: COLORS.colorWhite,
    elevation: 2,
    shadowColor: COLORS.BLACK,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    fontFamily: FONTS.REGULAR,
    fontSize: 11,
    lineHeight: 14,
    color: COLORS.colorDarkslategray,
  },
  value: {
    flex: 1,
    fontFamily: FONTS.REGULAR,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'right',
    color: COLORS.colorDarkslategray,
  },
  status: {color: '#D47700'},
  viewButton: {
    alignSelf: 'stretch',
    marginTop: 20,
    minHeight: 40,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#40C8F4',
    borderRadius: 8,
  },
  viewButtonText: {
    fontFamily: FONTS.MEDIUM,
    fontSize: 12,
    color: COLORS.colorWhite,
    textAlign: 'center',
  },
});
