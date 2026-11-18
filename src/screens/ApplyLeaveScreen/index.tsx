import React, {FC, useMemo, useState} from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Image,
  TextInput,
  ScrollView,
  Modal,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {Calendar} from 'react-native-calendars';
import moment from 'moment';
import EmergencyLeaveDetails from './EmergencyLeaveDetails';
import {
  getMinimumFromDate,
  getMinimumToDate,
  validateFromDate,
  validateLeaveDates,
} from './date-validation';
import {Screen} from '@organisms';
import {ScreenProps} from '@types';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {
  FontSize,
  FontFamily,
  Border,
  Padding,
  Gap,
  Height,
  BoxShadow,
  LetterSpacing,
  LineHeight,
  Width,
} from '../../res/globalStyle';
const LEAVE_DURATIONS = [
  'Full Day',
  'Half Day (First Half)',
  'Half Day (Second Half)',
] as const;
type LeaveDuration = (typeof LEAVE_DURATIONS)[number];
const LEAVE_REQUEST_TYPES = ['Emergency Leave', 'Planned Leave'] as const;
type LeaveRequestType = (typeof LEAVE_REQUEST_TYPES)[number];

const ApplyLeaveScreen: FC<ScreenProps.ApplyLeaveScreen> = ({
  navigation,
  loading,
}) => {
  const [leaveRequestType, setLeaveRequestType] =
    useState<LeaveRequestType>('Planned Leave');
  const [reason, setReason] = useState('');
  const [fromDate, setFromDate] = useState(getMinimumFromDate);
  const [toDate, setToDate] = useState(fromDate);
  const [dateError, setDateError] = useState('');
  const [dateField, setDateField] = useState<'from' | 'to' | null>(null);
  const [openDurationDate, setOpenDurationDate] = useState<string | null>(null);
  const [leaveDurations, setLeaveDurations] = useState<
    Record<string, LeaveDuration>
  >({});
  const leaveDates = useMemo(() => {
    const dates: string[] = [];
    if (validateLeaveDates(fromDate, toDate)) {
      return dates;
    }
    const day = moment(fromDate, 'YYYY-MM-DD');
    const lastDay = moment(toDate, 'YYYY-MM-DD');
    while (day.isSameOrBefore(lastDay, 'day')) {
      dates.push(day.format('YYYY-MM-DD'));
      day.add(1, 'day');
    }
    return dates;
  }, [fromDate, toDate]);
  const minimumFromDate = getMinimumFromDate();
  const minimumToDate = getMinimumToDate(fromDate);
  const minimumDate =
    dateField === 'to' && minimumToDate > minimumFromDate
      ? minimumToDate
      : minimumFromDate;
  const selectedDate = dateField === 'to' ? toDate : fromDate;

  const selectDate = (date: string) => {
    if (!dateField) {
      return;
    }
    const error =
      dateField === 'to'
        ? validateLeaveDates(fromDate, date)
        : validateFromDate(date);
    if (error) {
      setDateError(error);
      return;
    }
    let nextFrom = fromDate;
    let nextTo = toDate;
    if (dateField === 'from') {
      nextFrom = date;
      if (date !== fromDate) {
        nextTo = date;
      }
    } else {
      nextTo = date;
    }
    setFromDate(nextFrom);
    setToDate(nextTo);
    setDateError('');
    setLeaveDurations(current =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([day]) => day >= nextFrom && day <= nextTo,
        ),
      ),
    );
    setOpenDurationDate(null);
    setDateField(null);
  };
  const openCalendar = (field: 'from' | 'to') => {
    Keyboard.dismiss();
    setOpenDurationDate(null);
    setDateField(field);
  };
  const handleSubmit = () => {
    Keyboard.dismiss();
    const error = validateLeaveDates(fromDate, toDate);
    setDateError(error);
    if (error) {
      return;
    }
    // UI confirmation only until the leave submission API is connected.
    navigation.navigate('RequestSubMissionScreen', {
      leaveRequestType,
      request: {
        id: `local-${Date.now()}`,
        appliedOn: moment().format('YYYY-MM-DD'),
        fromDate,
        toDate,
        totalDays: leaveDates.reduce(
          (total, date) =>
            total + (leaveDurations[date]?.startsWith('Half Day') ? 0.5 : 1),
          0,
        ),
        status: 'Pending',
        reason,
        dayTypes: leaveDurations,
      },
    });
  };
  return (
    <Screen
      statusBgColor={COLORS.BACKGROUND_DEFAULT}
      loading={loading}
      preset="fixed"
      statusBarStyle="dark">
      <View style={styles.body}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Image
              style={styles.backIcon}
              resizeMode="contain"
              source={IMAGES.back}
            />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            Apply Leave
          </Text>
          <View style={styles.rightPlaceholder} />
        </View>
        <KeyboardAvoidingView
          style={styles.main}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled">
            <View style={[styles.holidaybody, styles.holidaybodyFlexBox]}>
              <View style={styles.holiday}>
                <View style={styles.holidayitem}>
                  <View style={styles.ul}>
                    <View style={styles.requestTypeGroup}>
                      <Text style={[styles.leaveReason, styles.fromTypo]}>
                        Leave Request Type{' '}
                        <Text style={styles.required}>*</Text>
                      </Text>
                      <View style={styles.row} accessibilityRole="radiogroup">
                        {LEAVE_REQUEST_TYPES.map(type => {
                          const selected = leaveRequestType === type;
                          return (
                            <Pressable
                              key={type}
                              style={[
                                styles.requestTypeOption,
                                selected && styles.requestTypeSelected,
                              ]}
                              accessibilityRole="radio"
                              accessibilityLabel={type}
                              accessibilityState={{checked: selected}}
                              onPress={() => {
                                Keyboard.dismiss();
                                setOpenDurationDate(null);
                                setLeaveRequestType(type);
                              }}>
                              <Text
                                style={[
                                  styles.requestTypeText,
                                  selected && styles.requestTypeTextSelected,
                                ]}>
                                {type}
                              </Text>
                              <Image
                                source={
                                  type === 'Emergency Leave'
                                    ? IMAGES.info
                                    : IMAGES.calendar
                                }
                                style={[
                                  styles.requestTypeIcon,
                                  selected && styles.requestTypeIconSelected,
                                ]}
                                resizeMode="contain"
                              />
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    <EmergencyLeaveDetails
                      visible={leaveRequestType === 'Emergency Leave'}
                    />
                    <Text style={[styles.leaveReason, styles.fromTypo]}>
                      Leave Reason
                    </Text>
                    <TextInput
                      style={[
                        styles.ulInner,
                        styles.fromTypo,
                        styles.reasonInput,
                      ]}
                      value={reason}
                      onChangeText={setReason}
                      placeholder="Enter leave reason"
                      placeholderTextColor={COLORS.colorDarkslategray}
                      multiline
                      textAlignVertical="top"
                      accessibilityLabel="Leave reason"
                    />
                    <View style={styles.row}>
                      <View style={styles.col}>
                        <View style={[styles.span, styles.addFlexBox]}>
                          <Text style={[styles.from, styles.fromTypo]}>
                            From
                          </Text>
                        </View>
                        <Pressable
                          style={[styles.add, styles.addBorder]}
                          onPress={() => openCalendar('from')}
                          accessibilityRole="button"
                          accessibilityLabel="Select from date">
                          <Text style={[styles.may2026, styles.fromTypo]}>
                            {moment(fromDate).format('DD MMM YYYY')}
                          </Text>
                          <Image
                            source={IMAGES.calendar}
                            style={styles.vectorIcon}
                            resizeMode="contain"
                          />
                        </Pressable>
                      </View>
                      <View style={styles.col}>
                        <View style={[styles.span, styles.addFlexBox]}>
                          <Text style={[styles.from, styles.fromTypo]}>To</Text>
                        </View>
                        <Pressable
                          style={[styles.add, styles.addBorder]}
                          onPress={() => openCalendar('to')}
                          accessibilityRole="button"
                          accessibilityLabel="Select to date">
                          <Text style={[styles.may2026, styles.fromTypo]}>
                            {toDate
                              ? moment(toDate).format('DD MMM YYYY')
                              : 'Select To Date'}
                          </Text>
                          <Image
                            source={IMAGES.calendar}
                            style={styles.vectorIcon}
                            resizeMode="contain"
                          />
                        </Pressable>
                      </View>
                    </View>
                    <Text style={styles.dateHint}>
                      From Date must be at least 3 days after today. To Date can
                      be the same date or later.
                    </Text>
                    {!!dateError && (
                      <Text
                        style={styles.dateError}
                        accessibilityRole="alert"
                        accessibilityLiveRegion="polite">
                        {dateError}
                      </Text>
                    )}
                    <View style={[styles.span, styles.addFlexBox]}>
                      <Text style={[styles.from, styles.fromTypo]}>
                        Per Day Leave Types
                      </Text>
                    </View>
                    <View style={[styles.add3, styles.addBorder]}>
                      {leaveDates.map((date, index) => (
                        <React.Fragment key={date}>
                          {index > 0 && <View style={styles.hr} />}
                          <View style={[styles.row2, styles.row2FlexBox]}>
                            <Text style={[styles.may2026, styles.fromTypo]}>
                              {moment(date).format('DD MMM YYYY')}
                            </Text>
                            <Pressable
                              style={[styles.select, styles.selectLayout]}
                              accessibilityRole="button"
                              accessibilityLabel={`Leave type for ${moment(
                                date,
                              ).format('DD MMM YYYY')}`}
                              accessibilityState={{
                                expanded: openDurationDate === date,
                              }}
                              onPress={() => {
                                Keyboard.dismiss();
                                setOpenDurationDate(current =>
                                  current === date ? null : date,
                                );
                              }}>
                              <Text style={[styles.may2026, styles.fromTypo]}>
                                {leaveDurations[date] ?? 'Select'}
                              </Text>
                              <Image
                                source={IMAGES.down}
                                style={styles.vectorIcon3}
                                resizeMode="contain"
                              />
                            </Pressable>
                          </View>
                          {openDurationDate === date && (
                            <View style={styles.durationMenu}>
                              {LEAVE_DURATIONS.map((duration, optionIndex) => (
                                <Pressable
                                  key={duration}
                                  style={[
                                    styles.durationOption,
                                    optionIndex > 0 &&
                                      styles.durationOptionBorder,
                                  ]}
                                  accessibilityRole="button"
                                  accessibilityState={{
                                    selected: leaveDurations[date] === duration,
                                  }}
                                  onPress={() => {
                                    setLeaveDurations(current => ({
                                      ...current,
                                      [date]: duration,
                                    }));
                                    setOpenDurationDate(null);
                                  }}>
                                  <Text style={styles.fromTypo}>
                                    {duration}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          )}
                        </React.Fragment>
                      ))}
                    </View>
                    <View style={[styles.span, styles.addFlexBox]}>
                      <Text style={[styles.from, styles.fromTypo]}>
                        Select Optional Holiday (Optional)
                      </Text>
                    </View>
                    <View style={[styles.add4, styles.row2FlexBox]}>
                      <View style={[styles.badge, styles.addFlexBox]}>
                        <Text style={[styles.nearbyStatus, styles.submitTypo]}>
                          21 May 2026
                        </Text>
                      </View>
                      <Image style={styles.vectorIcon3} resizeMode="cover" />
                    </View>
                    <Pressable
                      style={styles.li}
                      onPress={handleSubmit}
                      accessibilityRole="button"
                      accessibilityLabel="Submit leave">
                      <Text style={[styles.submit, styles.submitTypo]}>
                        Submit
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
      <Modal
        visible={dateField !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDateField(null)}>
        <View style={styles.calendarOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setDateField(null)}
            accessibilityRole="button"
            accessibilityLabel="Close calendar"
          />
          {dateField !== null && (
            <View style={styles.calendarCard}>
              <Text style={[styles.fromTypo, styles.calendarTitle]}>
                {dateField === 'from' ? 'Select From Date' : 'Select To Date'}
              </Text>
              {!!dateError && (
                <Text
                  style={styles.dateError}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite">
                  {dateError}
                </Text>
              )}
              <Calendar
                key={dateField}
                current={selectedDate || minimumDate}
                minDate={minimumDate}
                disableAllTouchEventsForDisabledDays
                markedDates={
                  selectedDate
                    ? {
                        [selectedDate]: {
                          selected: true,
                          selectedColor: COLORS.colorDeepskyblue,
                        },
                      }
                    : {}
                }
                onDayPress={day => selectDate(day.dateString)}
                theme={{arrowColor: COLORS.colorDeepskyblue}}
              />
              <Pressable
                style={styles.calendarCancel}
                onPress={() => setDateField(null)}
                accessibilityRole="button">
                <Text style={styles.fromTypo}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
    </Screen>
  );
};

export default ApplyLeaveScreen;

const styles = StyleSheet.create({
  requestTypeGroup: {alignSelf: 'stretch', gap: 8},
  required: {color: COLORS.colorCrimson},
  requestTypeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderRadius: Border.br_8,
    backgroundColor: COLORS.colorWhite,
  },
  requestTypeSelected: {
    borderColor: COLORS.colorDeepskyblue,
    backgroundColor: '#F2FCFF',
  },
  requestTypeText: {
    flex: 1,
    fontFamily: FONTS.REGULAR,
    fontSize: 11,
    color: COLORS.colorDarkslategray,
  },
  requestTypeTextSelected: {color: COLORS.colorDeepskyblue},
  requestTypeIcon: {width: 14, height: 14, tintColor: COLORS.colorSlategray},
  requestTypeIconSelected: {tintColor: COLORS.colorDeepskyblue},
  dateHint: {
    fontFamily: FONTS.REGULAR,
    fontSize: 12,
    color: COLORS.colorSlategray,
  },
  dateError: {
    fontFamily: FONTS.REGULAR,
    fontSize: 12,
    color: COLORS.colorCrimson,
  },
  formScroll: {width: '100%', flex: 1},
  formContent: {paddingBottom: 24},
  reasonInput: {paddingHorizontal: 12, paddingVertical: 9},
  durationMenu: {
    alignSelf: 'stretch',
    marginHorizontal: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#D9DEE2',
  },
  durationOption: {paddingHorizontal: 20, paddingVertical: 12},
  durationOptionBorder: {borderTopWidth: 1, borderTopColor: '#CFD4D8'},
  calendarOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  calendarCard: {
    width: '100%',
    maxWidth: 430,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.colorWhite,
  },
  calendarTitle: {fontFamily: FONTS.MEDIUM, padding: 8},
  calendarCancel: {alignSelf: 'flex-end', padding: 12},
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
    width: '100%',
    paddingHorizontal: Padding.padding_16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    marginBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backIcon: {width: 24, height: 24},
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: SIZE.MS(14),
    letterSpacing: -0.4,
    lineHeight: 23,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
    fontWeight: '500',
  },
  rightPlaceholder: {width: 40},
  addFlexBox: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  holidaybodyFlexBox: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  fromTypo: {
    textAlign: 'left',
    fontSize: FontSize.fs_13,
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
  },
  addBorder: {
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderStyle: 'solid',
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
  },
  row2FlexBox: {
    justifyContent: 'space-between',
    paddingHorizontal: Padding.padding_12,
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  selectLayout: {
    paddingHorizontal: 9,
    borderRadius: Border.br_6,
    flex: 1.25,
    alignItems: 'center',
    flexDirection: 'row',
  },
  submitTypo: {
    color: COLORS.colorWhite,
    textAlign: 'left',
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
  },
  main: {
    gap: 24,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    flex: 1,
    marginTop: SIZE.MS(20),
  },
  lanheader: {
    zIndex: 0,
    justifyContent: 'center',
    flex: 1,
  },
  applyLeave: {
    fontSize: 18,
    letterSpacing: -0.4,
    lineHeight: 23,
    textAlign: 'center',
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
  },
  arrowBack24dp434343Fill0WIcon: {
    width: 24,
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
    height: Height.height_24,
  },
  holidaybody: {
    width: '100%',
  },
  holiday: {
    paddingBottom: Padding.padding_20,
    alignItems: 'flex-start',
    flex: 1,
  },
  holidayitem: {
    paddingVertical: Padding.padding_16,
    maxWidth: 430,
    paddingHorizontal: Padding.padding_12,
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    overflow: 'hidden',
    alignItems: 'flex-start',
    width: '100%',
  },
  ul: {
    gap: Gap.gap_12,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  leaveReason: {
    letterSpacing: LetterSpacing.ls_0_2,
    textAlign: 'left',
    fontSize: FontSize.fs_13,
    alignSelf: 'stretch',
  },
  ulInner: {
    height: 100,
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderStyle: 'solid',
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
    overflow: 'hidden',
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  loremIpsumIsSimplyDummyTeWrapper: {
    paddingVertical: 9,
    paddingHorizontal: Padding.padding_12,
    flex: 1,
  },
  loremIpsumIsSimply: {
    lineHeight: 20,
    fontSize: FontSize.fs_13,
    textAlign: 'left',
    flex: 1,
  },
  row: {
    gap: Gap.gap_12,
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  col: {
    gap: Gap.gap_12,
    alignItems: 'flex-start',
    flex: 1,
  },
  span: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  from: {
    letterSpacing: LetterSpacing.ls_0_2,
    textAlign: 'left',
    fontSize: FontSize.fs_13,
  },
  add: {
    paddingHorizontal: Padding.padding_12,
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  may2026: {
    lineHeight: LineHeight.lh_22,
    fontSize: FontSize.fs_13,
    textAlign: 'left',
    flex: 1,
  },
  vectorIcon: {
    height: Height.height_15,
    width: Width.width_14,
  },
  add3: {
    paddingHorizontal: Padding.padding_0,
    gap: 6,
    justifyContent: 'center',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  row2: {
    paddingVertical: Padding.padding_0,
    gap: 0,
  },
  select: {
    backgroundColor: COLORS.colorWhitesmoke,
    borderColor: COLORS.colorLightgray,
    borderWidth: 1,
    paddingVertical: 3,
    gap: Gap.gap_8,
    borderStyle: 'solid',
    paddingHorizontal: 9,
    borderRadius: Border.br_6,
    minHeight: 36,
  },
  vectorIcon3: {
    height: 5.86,
    width: 10.25,
    opacity: 1,
  },
  hr: {
    height: Height.height_1,
    backgroundColor: COLORS.colorGainsboro,
    alignSelf: 'stretch',
  },
  select3: {
    paddingVertical: Padding.padding_3,
  },
  add4: {
    height: 39,
    gap: 20,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderStyle: 'solid',
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
  },
  badge: {
    borderRadius: 5,
    backgroundColor: COLORS.colorLimegreen,
    paddingHorizontal: 5,
    paddingVertical: 2,
    justifyContent: 'center',
  },
  nearbyStatus: {
    fontSize: 10,
  },
  li: {
    backgroundColor: COLORS.colorDeepskyblue,
    paddingHorizontal: Padding.padding_20,
    paddingVertical: 13,
    borderRadius: Border.br_8,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  submit: {
    fontSize: 14,
    textTransform: 'uppercase',
  },
});
