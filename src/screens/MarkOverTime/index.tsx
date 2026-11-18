import React, {FC, useCallback, useState, useEffect, useRef} from 'react';
import {
  StyleSheet,
  View,
  Text,
  StatusBar,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Pressable,
} from 'react-native';
import {ScreenProps, DataType} from '@types';
import {Screen} from '@organisms';
import {BackHeader, UserNameDesigRow} from '@molecules';
import {COLORS, FONTS, SIZE, STYLES, CONSTANT, IMAGES} from '@res';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '@navigation/navigator';
import {RootState, StoreDispatch} from '@reducers';
import {IconTitleRow} from '@screens/attendance/components/icon-title-row';
import {Camera, CameraType} from 'react-native-camera-kit';
import {Common, Voice, Preferences, Location} from '@utils';
import {checkCameraPermission} from '@slices/permission.slice';
import {useDispatch, useSelector, connect} from 'react-redux';
import {Buttons} from '@atoms';
import DeviceInfo from 'react-native-device-info';
import {MarkAttendenceOTAPI, getLastOpenOTApi} from '@slices/attendance.slice';
type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'MarkOverTime'
>;
const MarkOverTime: FC<ScreenProps.MarkOverTime> = ({empData}) => {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useDispatch<StoreDispatch>();
  const route = useRoute<RouteProp<RootStackParamList, 'MarkOverTime'>>();
  const lastOpenOT = useSelector(
    (state: RootState) => state.attendance.lastOpenOT,
  );
  const selectedTickets = route.params?.selectedTickets ?? [];
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [address, setAddress] = useState<DataType.GeoAddress | null>(null);
  const [punchStatus, setPunchStatus] = useState<'START' | 'END'>('START');
  const [ticketValue, setTicketValue] = useState('');

  const cameraRef = useRef<any>(null);

  const handleBackPress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const getCurrentISTDateTime = () => {
    const now = new Date(); // Already IST in India
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());
    return {
      displayDate: `${day}-${month}-${year}`, // UI
      displayTime: `${hours}:${minutes}`, // UI
      apiTime: `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`, // API
    };
  };
  /** 📍 Location + Time */
  const getAddressLocation = async () => {
    const {displayDate, displayTime} = getCurrentISTDateTime();
    setDate(displayDate);
    setTime(displayTime);
    setIsLoading(true);
    try {
      const data = await Location.getAddressFromLatLong();
      setAddress(data);
    } catch (e) {
      Common.error('Address fetch failed', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getAddressLocation();
    dispatch(checkCameraPermission());
    Voice.speak(CONSTANT.MARK_IN_FACE_MESSAGE);
    dispatch(getLastOpenOTApi());
  }, [dispatch]);
  /** 🔁 OT already running */
  useEffect(() => {
    if (lastOpenOT?.ticketNo) {
      setPunchStatus('END');
      setTicketValue(lastOpenOT.ticketNo);
    } else {
      setPunchStatus('START');
      setTicketValue('');
    }
  }, [lastOpenOT]);
  /** 📸 Capture Image - IMPROVED */
  const captureImage = async () => {
    try {
      // Wait a bit for camera to be ready
      await new Promise(resolve => setTimeout(resolve, 300));

      if (!cameraRef.current) {
        console.log('❌ Camera ref is null');
        Alert.alert('Camera Error', 'Camera not ready. Please try again.');
        return null;
      }

      console.log('📸 Attempting to capture image...');
      const image = await cameraRef.current.capture();

      if (!image || !image.uri) {
        console.log('❌ No image captured');
        Alert.alert(
          'Camera Error',
          'Failed to capture image. Please try again.',
        );
        return null;
      }

      console.log('✅ Image captured:', image.uri);
      const base64 = await Common.convertImageToBase64(image.uri);

      if (!base64) {
        console.log('❌ Base64 conversion failed');
        Alert.alert('Error', 'Failed to process image. Please try again.');
        return null;
      }

      console.log('✅ Base64 converted successfully');
      return {...image, base64};
    } catch (e) {
      console.log('❌ Camera capture error:', e);
      Common.error('Camera Error', e);
      Alert.alert('Camera Error', 'Unable to capture photo. Please try again.');
      return null;
    }
  };

  /** ⏱ Shift check */
  const isWithinShiftTime = (shiftTime?: string) => {
    if (!shiftTime) return false;
    try {
      const [start, end] = shiftTime.split('-');
      const now = new Date();
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);

      const startTime = new Date();
      startTime.setHours(sh, sm, 0);

      const endTime = new Date();
      endTime.setHours(eh, em, 0);

      return now >= startTime && now <= endTime;
    } catch {
      return false;
    }
  };

  /** 🚀 START / END OT - FIXED */
  const onOTPress = async () => {
    try {
      const shiftTime = empData?.shiftTime;

      if (isWithinShiftTime(shiftTime)) {
        Alert.alert('Not Allowed', 'OT not allowed in shift timings');
        return;
      }

      const finalTickets =
        punchStatus === 'END'
          ? lastOpenOT?.ticketNo
          : selectedTickets.length > 0
          ? selectedTickets.join(',')
          : '';

      console.log(`🎯 Attempting to ${punchStatus} OT`);

      // Capture image
      const image = await captureImage();

      if (!image?.base64) {
        console.log('❌ Image capture failed - stopping OT process');
        return;
      }

      const otId = punchStatus === 'END' ? lastOpenOT?.id ?? 0 : 0;
      const otDate = punchStatus === 'END' ? lastOpenOT?.date : null;
      const {apiTime} = getCurrentISTDateTime();

      console.log('📦 Preparing payload:', {
        punchStatus,
        otId,
        finalTickets,
        apiTime,
      });

      const payload = {
        id: otId,
        punchTime: apiTime,
        imageData: image.base64,
        imageExtention: 'jpg',
        lat: address?.lat?.toString() ?? '',
        lon: address?.long?.toString() ?? '',
        gpsAddress: address?.address ?? '',
        deviceName: await DeviceInfo.getModel(),
        deviceSerial: await DeviceInfo.getUniqueId(),
        ticketNo: finalTickets,
        remark: punchStatus === 'START' ? 'OT Started' : 'OT Ended',
        date: otDate,
      };

      console.log('🚀 Calling API with payload');

      // ✅ API CALL
      await dispatch(MarkAttendenceOTAPI(payload)).unwrap();

      console.log('✅ API call successful');

      // ✅ Refresh OT State
      await dispatch(getLastOpenOTApi()).unwrap();

      // ✅ Update UI state for START
      if (punchStatus === 'START') {
        console.log('🔄 Updating status to END');
        setPunchStatus('END');
        setTicketValue(finalTickets ?? '');
      }

      // ✅ Show success & navigate
      const successMessage =
        punchStatus === 'START'
          ? 'OT Started Successfully'
          : 'OT Ended Successfully';

      Alert.alert('Success', successMessage, [
        {
          text: 'OK',
          onPress: () => {
            if (punchStatus === 'END') {
              // Only navigate back on END
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.replace('OverTime');
              }
            }
          },
        },
      ]);
    } catch (error) {
      console.log('❌ OT Error:', error);
      Alert.alert('Error', 'Failed to mark OT. Please try again.');
    }
  };

  return (
    <Screen statusBgColor={COLORS.PRIMARY} loading={isLoading}>
      <StatusBar backgroundColor={COLORS.PRIMARY} barStyle="light-content" />
      <BackHeader headerTitle="OverTime" onBackPress={handleBackPress} />

      <ScrollView>
        <UserNameDesigRow
          name={`${empData?.firstName ?? ''} ${empData?.lastName ?? ''}`}
          designation={empData?.designationName ?? ''}
        />

        {/* CAMERA - Removed key prop to prevent re-render */}
        <View style={styles.cameraContainer}>
          <View style={styles.outerCameraView}>
            <Camera
              ref={cameraRef}
              cameraType={CameraType.Front}
              style={styles.cameraStyle}
              flashMode="auto"
              shutterPhotoSound
              onOrientationChange={() => {
                console.log('📷 Camera orientation changed');
              }}
            />
          </View>
        </View>

        <IconTitleRow icon={IMAGES.calendarClock} title={`${date} ${time}`} />
        <IconTitleRow
          icon={IMAGES.location}
          title={address?.address ?? 'Fetching Address...'}
        />

        <Text style={styles.clearFaceText}>
          {CONSTANT.MARK_IN_FACE_MESSAGE}
        </Text>

        <Text style={styles.tktId}>Ticket ID (Optional)</Text>

        <TouchableOpacity
          onPress={() => navigation.navigate('OverTimeSelect')}
          style={styles.container}
          disabled={punchStatus === 'END'}>
          <Text style={styles.text}>
            {ticketValue ||
              (selectedTickets.length > 0
                ? selectedTickets.join(', ')
                : 'Select Ticket ID >>')}
          </Text>
          <Image source={IMAGES.pasteImg} style={styles.icon} />
        </TouchableOpacity>

        <Pressable onPress={() => {}}>
          <Text style={[styles.tktId, {color: 'gray'}]}>
            Select ticket if available
          </Text>
        </Pressable>
      </ScrollView>

      <View style={styles.bottomButton}>
        <Buttons
          title={punchStatus === 'START' ? 'START OT' : 'END OT'}
          onPress={onOTPress}
        />
      </View>
    </Screen>
  );
};

const MapStateToProps = (state: RootState) => ({
  empData: state.dashboard.dashboardList?.employeeDetails ?? null,
});

export default connect(MapStateToProps)(MarkOverTime);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignSelf: 'center',
    width: '92%',
    justifyContent: 'space-between',
    padding: SIZE.MS(10),
    borderRadius: SIZE.MS(8),
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  text: {
    fontSize: SIZE.MS(14),
    color: '#9E9E9E',
    flex: 1,
  },
  tktId: {
    color: COLORS.PRIMARY,
    fontSize: SIZE.MVS(12),
    fontFamily: FONTS.SEMI_BOLD,
    margin: SIZE.MS(10),
  },
  icon: {
    width: SIZE.MS(24),
    height: SIZE.MS(24),
    resizeMode: 'contain',
  },
  cameraContainer: {
    alignSelf: 'center',
    marginVertical: SIZE.MVS(20),
    ...STYLES.SHADOW_PRIMARY_3,
  },
  outerCameraView: {
    width: SIZE.MVS(150),
    height: SIZE.MVS(200),
    borderRadius: SIZE.MS(6),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
    backgroundColor: '#000',
  },
  cameraStyle: {
    width: '100%',
    height: '100%',
  },
  bottomButton: {
    position: 'absolute',
    bottom: 10,
    left: 16,
    right: 16,
  },
  clearFaceText: {
    fontFamily: FONTS.REGULAR,
    fontSize: SIZE.MVS(14),
    color: COLORS.SUCCESS,
    textAlign: 'center',
    marginHorizontal: SIZE.MS(20),
    marginTop: SIZE.MS(10),
  },
});
