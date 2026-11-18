import {RadioButton} from '@atoms';
import {BackHeader, CaptureChamberPicture} from '@molecules';
import {Screen} from '@organisms';
import Geolocation from '@react-native-community/geolocation';
import {RootState, StoreDispatch} from '@reducers';
import {COLORS, FONTS, SIZE, STYLES, IMAGES} from '@res';
import {ChamberIssueListActionSheet} from '@sheets';
import {checkCameraPermission} from '@slices/permission.slice';
import {
  submitPatrollerTaskApi,
  updateChamberTaskListDistance,
  updateSubmitPatrollerTask,
} from '@slices/task.slice';
import {DataType, ScreenProps} from '@types';
import {Common, Location, Permissions, Preferences, Times} from '@utils';
import React, {
  FC,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import NetInfo from '@react-native-community/netinfo';
import {
  calculateChamberDistance,
  getVerifiedChamberLocation,
  isChamberLocationFresh,
  validateChamberLocation,
  isOfflineChamberTaskValid,
} from '../../../utils/chamberGeofence';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import {connect, useDispatch} from 'react-redux';
const RadioButtonRow = ({value, setValue, type}: any) => {
  return (
    <TouchableOpacity
      onPress={() => {
        setValue(type);
      }}
      style={styles.submitRadioButtonRow}>
      <RadioButton
        active={value === type}
        viewStyle={{}}
        onPress={() => {
          setValue(type);
        }}
      />
      <Text style={styles.submitRatioTitle}>
        {type === 'yes' ? 'Yes' : 'No'}
      </Text>
    </TouchableOpacity>
  );
};
//! ***************** Submit Patroller Task ***************
const PatrollerTask: FC<ScreenProps.SubmitPatrollerTask> = ({
  loading,
  navigation,
  route,
  taskData,
}) => {
  const dispatch = useDispatch<StoreDispatch>();
  const [isLoading, setIsLoading] = useState(false);
  const submitting = useRef(false);
  const latestPosition = useRef<any>(null);
  const [empID] = useState(route.params.empID);
  const [selectedChamber] = useState(route.params.selectedChamber);
  const [currentPosition, setCurrentPosition] = useState(
    route.params?.currentPosition,
  );
  const [locationError, setLocationError] = useState<string | null>(null);
  const distance = useMemo(() => {
    try {
      return calculateChamberDistance(
        currentPosition?.latitude,
        currentPosition?.longitude,
        selectedChamber?.chamberLat,
        selectedChamber?.chamberLong,
      );
    } catch {
      return null;
    }
  }, [currentPosition, selectedChamber]);
  const [isIssueFound, setIsIssueFound] = useState<'yes' | 'no' | ''>('');
  const [pic1, setPic1] = useState<DataType.ImagePickerResponse | null>(null);
  const [pic2, setPic2] = useState<DataType.ImagePickerResponse | null>(null);
  const [chamberIssue, setChamberIssue] = useState<null | DataType.IdName>(
    null,
  );
  const [remark, setRemark] = useState('');
  useEffect(() => {
    dispatch(checkCameraPermission());
    Permissions.requestPermission();
  }, [dispatch]);
  const handleBackPress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);
  // Watch Position
  useEffect(() => {
    const watchId = Geolocation.watchPosition(
      res => {
        // Ignore cached watch callbacks. Submission fetches a new fix as needed.
        if (!isChamberLocationFresh(res)) {
          return;
        }
        latestPosition.current = res;
        const coords = res.coords;
        Common.success('Watch Position Start in Submit', coords);
        setCurrentPosition(coords as DataType.Coords);
        const lat = coords?.latitude;
        const lng = coords?.longitude;
        const lastAdd = Preferences.getData(
          'LAST_GEO_ADDRESS',
        ) as DataType.GeoAddress;
        const updatedAddress = {
          address: lastAdd?.address ?? '',
          lat,
          long: lng,
        };
        Preferences.setData('LAST_GEO_ADDRESS', updatedAddress);
        try {
          validateChamberLocation(
            res,
            selectedChamber?.chamberLat,
            selectedChamber?.chamberLong,
          );
          setLocationError(null);
        } catch (error) {
          setLocationError(
            error instanceof Error
              ? error.message
              : 'Unable to verify your location.',
          );
        }
      },
      err => {
        setLocationError(
          'GPS location unavailable. Enable precise GPS and try again.',
        );
        Common.error('❌ Error in Watch Position::', err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        distanceFilter: 0,
        interval: 3000,
        fastestInterval: 1000,
      },
    );
    return () => {
      if (watchId != null) {
        Common.error('Watch Position Cleared in Submit');
        Geolocation.clearWatch(watchId);
      }
    };
  }, [selectedChamber]);
  const saveOfflineTask = (params: any) => {
    const prevData = Preferences.getData('SUBMIT_TASK_DATA');
    if (prevData && prevData?.length > 0) {
      Preferences.setData('SUBMIT_TASK_DATA', [...prevData, ...params]);
    } else {
      Preferences.setData('SUBMIT_TASK_DATA', params);
    }
    Common.alert({
      title: 'Offline Task',
      msg: 'Task saved as offline, data will be sync to server when internet available.',
      onPress: () => navigation.goBack(),
    });
  };
  const withTimeout = <T,>(
    promise: Promise<T>,
    ms: number,
  ): Promise<T | null> =>
    Promise.race([
      promise,
      new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
    ]);
  const checkValidation = async () => {
    if (submitting.current || loading) {
      return;
    }
    if (!pic1) {
      Common.alert({title: 'Alert', msg: 'Please add first image of Chamber!'});
      return;
    }
    if (!pic2) {
      Common.alert({
        title: 'Alert',
        msg: 'Please add second image of Chamber!',
      });
      return;
    }
    if (isIssueFound === '') {
      Common.alert({title: 'Alert', msg: 'Please select issue found or not!'});
      return;
    }
    if (isIssueFound === 'yes' && !chamberIssue) {
      Common.alert({
        title: 'Alert',
        msg: 'You have selected yes on chamber issue found but not selected any issue from the given list.',
      });
      return;
    }
    if (!selectedChamber) {
      Common.showToast('No Chamber Data Found!');
      return;
    }
    const queuedTasks = Preferences.getData('SUBMIT_TASK_DATA') ?? [];
    if (
      queuedTasks.some(
        (task: any) =>
          isOfflineChamberTaskValid(task) &&
          String(task.gigatelOldNearestChamberID) ===
            String(selectedChamber.chamberId) &&
          String(task.taskId) === String(taskData?.taskId ?? 0) &&
          String(task.employeeId) === String(empID),
      )
    ) {
      Common.alert({
        title: 'Pending sync',
        msg: 'This chamber already has an offline submission waiting to sync.',
      });
      return;
    }
    submitting.current = true;
    setIsLoading(true);
    try {
      // Resolve connectivity before acquiring GPS so network delays cannot age it.
      const network = await NetInfo.fetch();
      let submission = await getVerifiedChamberLocation(
        selectedChamber.chamberLat,
        selectedChamber.chamberLong,
        latestPosition.current,
        {preferAccuracy: false},
      );
      const offline =
        !network.isConnected || network.isInternetReachable === false;
      const addressCoords = submission.position.coords;
      const chamberAddress = selectedChamber.chamberAddress;

      // Address max 3 sec wait, nahi mila to empty string chalega
      const currentAddress = offline
        ? null
        : await withTimeout(
            Location.getAddressWithLatLong(
              addressCoords.latitude,
              addressCoords.longitude,
            ),
            3000,
          ).catch(() => null);

      // Refresh silently if the address lookup outlasted the reading's lifetime.
      if (!isChamberLocationFresh(submission.position)) {
        submission = await getVerifiedChamberLocation(
          selectedChamber.chamberLat,
          selectedChamber.chamberLong,
          latestPosition.current,
          {preferAccuracy: false},
        );
      }
      const coords = submission.position.coords;
      latestPosition.current = submission.position;
      setCurrentPosition(coords as DataType.Coords);
      setLocationError(null);
      const markdate = Common.getFormatedDate('YYYY-MM-DD');
      const markTime = Times.getFormatedTime('HH:mm:ss');
      const params = [
        {
          reportingImage: [
            {
              imageUrl: pic1?.data ?? '',
              imageExtention: 'jpg',
            },
            {
              imageUrl: pic2?.data ?? '',
              imageExtention: 'jpg',
            },
          ],
          remarks: remark,
          alerts: [{alert_id: 0, group_id: 0, is_alert: false}],
          gigatelOldNearestChamberID: selectedChamber.chamberId,
          isSubmitWithAlert: false,
          isChamberComplaint: false,
          lat: `${coords.latitude}`,
          lon: `${coords.longitude}`,
          chamberLat: selectedChamber?.chamberLat,
          chamberLon: selectedChamber?.chamberLong,
          gpsAddress:
            coords.latitude === addressCoords.latitude &&
            coords.longitude === addressCoords.longitude
              ? currentAddress?.address ?? ''
              : '',
          chamberGPSAddress: chamberAddress,
          priority: '2',
          taskType: '',
          taskId: taskData?.taskId ?? 0,
          isOffline: false,
          companyCode: 'gtpl',
          createdOn: `${markdate}T${markTime}`,
          employeeId: empID,
          status: '1',
          updateStatusAlso: true,
          isIssueExist: isIssueFound === 'yes',
          issueTypId: chamberIssue?.id ?? 0,
          issueRemark: remark,
        },
      ];
      const offlineTask = {
        ...params[0],
        isOffline: true,
        geofenceEvidence: {
          version: 1,
          submission,
          photos: [pic1.captureLocation, pic2.captureLocation],
        },
      };
      if (!isOfflineChamberTaskValid(offlineTask)) {
        throw new Error(
          'Both photos must have verified locations within 100 metres of this chamber. Please retake them.',
        );
      }
      if (offline) {
        saveOfflineTask([offlineTask]);
        return;
      }
      // 10 sec mein response nahi aaya => internet kharab hai, seedha offline save
      const result = await withTimeout(
        dispatch(submitPatrollerTaskApi(params)),
        10000,
      );
      if (!result) {
        saveOfflineTask([offlineTask]);
        return;
      }

      const response = result.payload as
        | {status?: number; success?: boolean; message?: string}
        | undefined;
      if (response?.status === 200 && response.success) {
        dispatch(
          updateSubmitPatrollerTask({chamberId: selectedChamber.chamberId}),
        );
        dispatch(
          updateChamberTaskListDistance({
            lat: coords.latitude,
            lng: coords.longitude,
          }),
        );
        Common.alert({
          title: 'Success',
          msg: 'Task Submitted Successfully!',
          onPress: () => navigation.goBack(),
        });
      } else if (response?.status === 202 && !response.success) {
        // This evidence was verified before sending. Server latency does not
        // invalidate its historical location when saving for offline sync.
        saveOfflineTask([offlineTask]);
      } else {
        Common.alert({
          title: 'Submission failed',
          msg: response?.message ?? 'Unable to submit. Please try again.',
        });
      }
    } catch (error) {
      Common.error('❌ [SUBMIT] Task submission failed', error);
      Common.alert({
        title: 'Submission blocked',
        msg:
          error instanceof Error
            ? error.message
            : 'Unable to verify or submit this task. Please try again.',
      });
    } finally {
      submitting.current = false;
      setIsLoading(false);
    }
  };
  return (
    <Screen
      statusBgColor={COLORS.PRIMARY}
      preset={'fixed'}
      statusBarStyle={'light'}
      loading={loading || isLoading}>
      <StatusBar backgroundColor={COLORS.PRIMARY} barStyle="light-content" />
      {/* Header */}
      <View style={styles.headerWrapper}>
        <BackHeader headerTitle="Submit Task" onBackPress={handleBackPress} />
      </View>

      {/* Floating Card with ScrollView */}
      <View style={styles.floatingCard}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <View style={styles.cardContent}>
            {/* Chamber Info Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Chamber</Text>
              <View style={styles.chamberBox}>
                <Text style={styles.chamberText}>
                  {`${selectedChamber?.chamberIdStr ?? ''} - ${
                    selectedChamber?.chamberName ?? ''
                  }`}
                </Text>
              </View>
            </View>
            {/* Chamber Pictures Section */}
            <View style={styles.section}>
              <View style={styles.labelRow}>
                <Text style={styles.sectionLabel}>Chamber Pictures</Text>
                <Text style={styles.required}> *</Text>
              </View>
              <Text style={styles.helperText}>
                Take both photos within 100 metres of the chamber with precise
                GPS enabled.
              </Text>

              <View style={styles.submitTaskPicRow}>
                <CaptureChamberPicture
                  chamber={{
                    latitude: selectedChamber?.chamberLat,
                    longitude: selectedChamber?.chamberLong,
                  }}
                  title="PIC 1"
                  pic={pic1}
                  setPic={(e: any) => setPic1(e)}
                  lat={currentPosition?.latitude ?? 0}
                  long={currentPosition?.longitude ?? 0}
                />
                <CaptureChamberPicture
                  chamber={{
                    latitude: selectedChamber?.chamberLat,
                    longitude: selectedChamber?.chamberLong,
                  }}
                  title="PIC 2"
                  pic={pic2}
                  setPic={(e: any) => setPic2(e)}
                  lat={currentPosition?.latitude ?? 0}
                  long={currentPosition?.longitude ?? 0}
                />
              </View>
            </View>
            {distance && distance > 100 && (
              <View style={styles.warningBox}>
                <View style={styles.warningRow}>
                  <Image
                    source={IMAGES.location}
                    style={styles.warningIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.warningText}>
                    अभी चैम्बर से आपकी दूरी है:{' '}
                    <Text style={styles.distanceText}>{` ${(
                      distance ?? 0
                    ).toFixed(1)}m`}</Text>
                  </Text>
                </View>
                <View style={styles.warningRow}>
                  <Image
                    source={IMAGES.warning}
                    style={styles.warningIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.warningText}>
                    चेंबर का स्थान अपडेट करवाएं। | आप{' '}
                    <Text style={styles.distanceText}>100</Text> मीटर के दायरे
                    में नहीं है।|
                  </Text>
                </View>
              </View>
            )}{' '}
            <View style={styles.section}>
              <View style={styles.issueRow}>
                <View style={styles.issueCol}>
                  <View style={styles.labelRow}>
                    <Text style={styles.sectionLabel}>Chamber Issue Found</Text>
                    <Text style={styles.required}> *</Text>
                  </View>
                  <View style={styles.submitRadioViewContainer}>
                    <RadioButtonRow
                      value={isIssueFound}
                      setValue={setIsIssueFound}
                      type={'yes'}
                    />
                    <RadioButtonRow
                      value={isIssueFound}
                      setValue={setIsIssueFound}
                      type={'no'}
                    />
                  </View>
                </View>
              </View>
            </View>
            {/* Chamber Issue Selection */}
            {isIssueFound === 'yes' && (
              <View style={styles.section}>
                <ChamberIssueListActionSheet
                  value={chamberIssue}
                  setValue={setChamberIssue}
                />
              </View>
            )}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Remarks</Text>
              {/* <InputField
                  value={remark}
                  onChangeText={setRemark}
                  placeholder="Enter remarks here..."
                  multiline
                  numberOfLines={4}
                  viewStyle={styles.remarksBox}
                  // textInputStyle={styles.remarksInput}
                /> */}
              <TextInput
                value={remark}
                onChangeText={setRemark}
                placeholder="Enter remarks here..."
                multiline
                numberOfLines={4}
                style={styles.remarksBox}
              />
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.discardButton}
                onPress={handleBackPress}>
                <Text style={styles.buttonText}>DISCARD</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                disabled={isLoading || loading}
                onPress={checkValidation}>
                <Text style={styles.buttonText}>SUBMIT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
};

const MapStateToProps = (state: RootState) => ({
  loading: state.task.submitTaskLoading === 'pending',
  taskData: state.task.taskListData,
});

export default connect(MapStateToProps)(PatrollerTask);

const styles = StyleSheet.create({
  headerWrapper: {
    backgroundColor: COLORS.PRIMARY,
    paddingBottom: SIZE.MVS(28),
  },
  floatingCard: {
    position: 'absolute',
    top: SIZE.MVS(60),
    left: 0,
    right: 0,
    bottom: 0,
    marginHorizontal: SIZE.MS(12),
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: SIZE.MS(12),
    borderTopRightRadius: SIZE.MS(12),
    ...STYLES.SHADOW_BLACK_6,
    elevation: 8,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  cardContent: {
    padding: SIZE.MS(16),
    paddingBottom: SIZE.MVS(30),
  },
  section: {
    marginBottom: SIZE.MVS(16),
    backgroundColor: COLORS.WHITE,
  },
  sectionLabel: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray,
    marginBottom: SIZE.MVS(8),
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZE.MVS(4),
  },
  remarkView: {marginHorizontal: 0},
  required: {
    color: COLORS.colorRed,
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.MEDIUM,
  },
  helperText: {
    fontSize: SIZE.MS(9),
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray200,
    marginBottom: SIZE.MVS(8),
  },
  submitTaskPicRow: {
    flexDirection: 'row',
    gap: SIZE.MS(8),
  },
  chamberBox: {
    backgroundColor: COLORS.colorWhitesmoke,
    borderRadius: SIZE.MS(6),
    padding: SIZE.MS(12),
  },
  chamberText: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDimgray,
    lineHeight: SIZE.MS(22),
  },
  warningBox: {
    backgroundColor: COLORS.colorGoldenrod200,
    borderWidth: 0.5,
    borderColor: COLORS.colorGoldenrod100,
    borderRadius: SIZE.MS(6),
    padding: SIZE.MS(12),
    marginBottom: SIZE.MVS(16),
    gap: SIZE.MS(8),
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZE.MS(6),
  },
  submitRadioViewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningIcon: {
    width: SIZE.MS(13),
    height: SIZE.MS(17),
  },
  warningText: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray200,
    flex: 1,
    lineHeight: SIZE.MS(22),
  },
  distanceText: {
    fontWeight: '600',
    color: COLORS.colorGoldenrod100,
  },
  issueRow: {
    flexDirection: 'row',
    gap: SIZE.MS(10),
  },
  issueCol: {
    flex: 1,
  },
  remarksBox: {
    alignSelf: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderRadius: SIZE.MS(6),
    minHeight: SIZE.MS(100),
  },
  remarksInput: {
    fontSize: SIZE.MS(13),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray200,
    textAlignVertical: 'top',
    borderWidth: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SIZE.MS(10),
    marginTop: SIZE.MVS(8),
  },
  discardButton: {
    flex: 1,
    backgroundColor: COLORS.colorDarkslategray,
    borderRadius: SIZE.MS(8),
    paddingVertical: SIZE.MS(13),
    alignItems: 'center',
    justifyContent: 'center',
    ...STYLES.SHADOW_BLACK_6,
  },
  submitButton: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: SIZE.MS(8),
    paddingVertical: SIZE.MS(13),
    alignItems: 'center',
    justifyContent: 'center',
    ...STYLES.SHADOW_BLACK_6,
  },
  buttonText: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.MEDIUM,
    fontWeight: '500',
    color: COLORS.WHITE,
    textTransform: 'uppercase',
  },
  submitRadioButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SIZE.MS(20),
  },
  submitRatioTitle: {
    fontSize: SIZE.MS(14),
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_DARKER,
    marginLeft: SIZE.MS(10),
  },
  imageTitleRowView: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SIZE.MS(15),
  },
  imageTitleRowIcon: {
    height: SIZE.MS(20),
    width: SIZE.MS(20),
  },
  imageTitleRowTitle: {
    marginLeft: SIZE.MS(5),
    marginRight: SIZE.MS(10),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.TEXT_DARK,
    fontSize: SIZE.MS(14),
  },
  imageTitleRowDesc: {
    marginLeft: SIZE.MS(5),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.ACCENT_ORANGE,
    fontSize: SIZE.MS(14),
  },
});
