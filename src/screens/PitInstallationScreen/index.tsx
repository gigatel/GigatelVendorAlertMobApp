// import React, {FC, useState, useEffect, useRef, useMemo} from 'react';
// import {
//   Text,
//   StyleSheet,
//   View,
//   TextInput,
//   Image,
//   ScrollView,
//   Alert,
//   Pressable,
//   Modal,
//   Platform,
//   TouchableOpacity,
//   TouchableWithoutFeedback,
// } from 'react-native';
// import {Preferences} from '@utils';
// import {
//   Border,
//   Padding,
//   LetterSpacing,
//   Gap,
//   FontSize,
// } from '../../res/globalStyle';
// import {fetchCurrentGpsLocation} from '../../components/molecules/LocationButton/gps';
// import {GeoPosition} from 'react-native-geolocation-service';
// import {Common} from '@utils';
// import {ScreenProps} from '@types';
// import {Screen} from '@organisms';
// import styles from './styles';
// import {DataType} from '@types';
// import {
//   insertUpdatePitLocationV2,
//   getPitList,
//   checkPitLocationNoAPI,
// } from '../../store/slices/dss.slice';
// import {COLORS, FONTS, IMAGES, SIZE} from '@res';
// import {useDispatch, useSelector} from 'react-redux';
// import {Location} from '@utils';
// import {StoreDispatch, RootState} from '@reducers';
// import ProjectListScreen, {
//   Project,
// } from '../../components/molecules/DssProjectPickerButton';
// import Geolocation, {
//   GeolocationResponse,
// } from '@react-native-community/geolocation';
// import {CaptureImageWatermark} from '@molecules';
// import type {BurnResult} from '../../components/molecules/capture-image-watermark/index';
// // ─── Types ────────────────────────────────────────────────────────────────────
// type GalleryItem = {
//   pitId: string;
//   pic1Url: string | null;
//   pic2Url: string | null;
// };
// type VendorItem = {
//   vendorId: string;
//   vendorCode: string;
//   vendorName: string;
// };

// type SmartLocationCallbacks = {
//   onBetterLocation?: (pos: GeolocationResponse) => void;
// };

// export const getSmartLocation = (
//   callbacks: SmartLocationCallbacks = {},
// ): Promise<GeolocationResponse> & {stop?: () => void} => {
//   const {onBetterLocation} = callbacks;
//   let watchId: number | null = null;

//   const promise: any = new Promise((resolve, reject) => {
//     let isResolved = false;

//     Geolocation.getCurrentPosition(
//       (pos: GeolocationResponse) => {
//         if (!isResolved) {
//           isResolved = true;
//           resolve(pos);
//         }
//       },
//       () => {
//         Geolocation.getCurrentPosition(
//           (pos: GeolocationResponse) => {
//             if (!isResolved) {
//               isResolved = true;
//               resolve(pos);
//             }
//           },
//           reject,
//           {enableHighAccuracy: false, timeout: 7000, maximumAge: 60000},
//         );
//       },
//       {enableHighAccuracy: true, timeout: 8000, maximumAge: 0},
//     );

//     watchId = Geolocation.watchPosition(
//       (pos: GeolocationResponse) => {
//         if (pos.coords.accuracy <= 50) {
//           onBetterLocation?.(pos);
//           if (watchId !== null) {
//             Geolocation.clearWatch(watchId);
//             watchId = null;
//           }
//         }
//       },
//       () => {},
//       {enableHighAccuracy: true, distanceFilter: 0},
//     );
//   });

//   promise.stop = () => {
//     if (watchId !== null) {
//       Geolocation.clearWatch(watchId);
//       watchId = null;
//     }
//   };

//   return promise;
// };

// // ─── Helpers ──────────────────────────────────────────────────────────────────
// const displayPitNo = (pitNo: string | number): string => {
//   const s = String(pitNo ?? '').trim();
//   if (!s.includes('.')) return s;
//   return s.replace(/\.?0+$/, '') || '0';
// };

// const getAccurateGPS = ({
//   desiredAccuracy = 20,
//   timeout = 30000,
// }: {
//   desiredAccuracy?: number;
//   timeout?: number;
// } = {}): Promise<GeoPosition> => {
//   return new Promise((resolve, reject) => {
//     let watchId: number | null = null;
//     let bestPosition: GeoPosition | null = null;
//     let completed = false;

//     const cleanup = () => {
//       if (watchId !== null) {
//         Geolocation.clearWatch(watchId);
//         watchId = null;
//       }

//       clearTimeout(timeoutId);
//     };

//     const finish = (position: GeoPosition) => {
//       if (completed) return;

//       completed = true;
//       cleanup();
//       resolve(position);
//     };
//     const timeoutId = setTimeout(() => {
//       if (completed) return;
//       completed = true;
//       cleanup();
//       if (bestPosition) {
//         // Return the best reading captured during the timeout period.
//         resolve(bestPosition);
//       } else {
//         reject({
//           code: 3,
//           message: 'GPS timed out. Move to an open area and try again.',
//         });
//       }
//     }, timeout);
//     watchId = Geolocation.watchPosition(
//       position => {
//         const accuracy = Number(position.coords.accuracy);
//         console.log('GPS reading:', {
//           latitude: position.coords.latitude,
//           longitude: position.coords.longitude,
//           accuracy,
//         });
//         const bestAccuracy = Number(
//           bestPosition?.coords?.accuracy ?? Number.POSITIVE_INFINITY,
//         );

//         if (!bestPosition || accuracy < bestAccuracy) {
//           bestPosition = position;
//         }

//         if (accuracy > 0 && accuracy <= desiredAccuracy) {
//           finish(position);
//         }
//       },
//       error => {
//         console.log('GPS watch error:', error);

//         // Do not immediately fail if we already captured a usable position.
//         if (bestPosition) {
//           return;
//         }

//         completed = true;
//         cleanup();
//         reject(error);
//       },
//       {
//         enableHighAccuracy: true,
//         distanceFilter: 0,
//         interval: 1000,
//         fastestInterval: 500,
//         maximumAge: 0,
//         forceRequestLocation: true,
//         showLocationDialog: true,
//       },
//     );
//   });
// };
// const haversineDistance = (
//   lat1: number,
//   lon1: number,
//   lat2: number,
//   lon2: number,
// ): number => {
//   const R = 6371000;
//   const r = (d: number) => (d * Math.PI) / 180;
//   const dLat = r(lat2 - lat1);
//   const dLon = r(lon2 - lon1);
//   const a =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLon / 2) ** 2;
//   return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
// };

// const formatDistance = (m: number) =>
//   m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;

// const calcPitDistance = (a: any, b: any): number | null => {
//   const la = parseFloat(a?.lat ?? '0'),
//     lna = parseFloat(a?.lng ?? '0');
//   const lb = parseFloat(b?.lat ?? '0'),
//     lnb = parseFloat(b?.lng ?? '0');
//   if (
//     isNaN(la) ||
//     isNaN(lna) ||
//     isNaN(lb) ||
//     isNaN(lnb) ||
//     (la === 0 && lna === 0) ||
//     (lb === 0 && lnb === 0)
//   )
//     return null;
//   return haversineDistance(la, lna, lb, lnb);
// };

// // ─── Parse comma-separated vendor fields into VendorItem[] ───────────────────
// const parseVendors = (
//   vendorID: string | undefined,
//   vendorCode: string | undefined,
//   vendorName: string | undefined,
// ): VendorItem[] => {
//   const ids = (vendorID ?? '')
//     .split(',')
//     .map(s => s.trim())
//     .filter(Boolean);
//   const codes = (vendorCode ?? '')
//     .split(',')
//     .map(s => s.trim())
//     .filter(Boolean);
//   const names = (vendorName ?? '')
//     .split(',')
//     .map(s => s.trim())
//     .filter(Boolean);
//   const count = Math.max(ids.length, codes.length, names.length);
//   if (count === 0) return [];
//   return Array.from({length: count}, (_, i) => ({
//     vendorId: ids[i] ?? '',
//     vendorCode: codes[i] ?? '',
//     vendorName: names[i] ?? '',
//   }));
// };

// // ─── Inline VendorPicker ──────────────────────────────────────────────────────
// type VendorPickerProps = {
//   data: VendorItem[];
//   value: VendorItem | null;
//   placeholder: string;
//   onSelect: (item: VendorItem) => void;
//   hasError: boolean;
// };

// const VendorPicker: FC<VendorPickerProps> = ({
//   data,
//   value,
//   placeholder,
//   onSelect,
//   hasError,
// }) => {
//   const [visible, setVisible] = useState(false);
//   return (
//     <>
//       <TouchableOpacity
//         activeOpacity={0.8}
//         style={[
//           vendorPickerStyles.inputBox,
//           hasError && vendorPickerStyles.inputBoxError,
//         ]}
//         onPress={() => setVisible(true)}>
//         <Text
//           style={[
//             vendorPickerStyles.inputText,
//             !value && vendorPickerStyles.placeholder,
//           ]}
//           numberOfLines={1}>
//           {value ? value.vendorName : placeholder}
//         </Text>
//         <Text style={vendorPickerStyles.arrow}>▾</Text>
//       </TouchableOpacity>

//       <Modal visible={visible} transparent animationType="fade">
//         <TouchableOpacity
//           style={vendorPickerStyles.overlay}
//           activeOpacity={1}
//           onPress={() => setVisible(false)}>
//           <View style={vendorPickerStyles.dropdown}>
//             {data.map((item, index) => (
//               <TouchableOpacity
//                 key={`${item.vendorId}-${index}`}
//                 style={[
//                   vendorPickerStyles.item,
//                   index < data.length - 1 && vendorPickerStyles.itemBorder,
//                   value?.vendorId === item.vendorId &&
//                     vendorPickerStyles.itemSelected,
//                 ]}
//                 onPress={() => {
//                   onSelect(item);
//                   setVisible(false);
//                 }}>
//                 <Text style={vendorPickerStyles.itemName}>
//                   {item.vendorName}
//                 </Text>
//               </TouchableOpacity>
//             ))}
//           </View>
//         </TouchableOpacity>
//       </Modal>
//     </>
//   );
// };

// // ─── PitCard ──────────────────────────────────────────────────────────────────
// type PitCardProps = {
//   pitId: string;
//   lat: string;
//   long: string;
//   landmark: string;
//   address: string;
//   pic1Url: string | null;
//   pic2Url: string | null;
//   onViewImages: () => void;
// };

// const PitCard: FC<PitCardProps> = ({
//   pitId,
//   lat,
//   long,
//   landmark,
//   address,
//   pic1Url,
//   pic2Url,
//   onViewImages,
// }) => {
//   const hasImages = !!(pic1Url || pic2Url);
//   return (
//     <View style={pitCardStyles.card}>
//       <View style={pitCardStyles.header}>
//         <View style={pitCardStyles.badge}>
//           <Text style={pitCardStyles.badgeText}>{pitId}</Text>
//         </View>
//       </View>
//       <Text style={pitCardStyles.metaText}>
//         <Text style={pitCardStyles.metaLabel}>Landmark: </Text>
//         <Text style={pitCardStyles.metaValue}>{landmark}</Text>
//       </Text>
//       <Text style={pitCardStyles.address}>{address}</Text>
//       <View style={pitCardStyles.bottomRow}>
//         <View style={pitCardStyles.latLongRow}>
//           <Text style={pitCardStyles.latLongText}>Lat: {lat}</Text>
//           {/* <Text style={pitCardStyles.latLongText}>Long: {long}</Text> */}
//         </View>
//         <TouchableOpacity
//           style={[
//             pitCardStyles.viewBtn,
//             !hasImages && pitCardStyles.viewBtnDimmed,
//           ]}
//           onPress={onViewImages}
//           disabled={!hasImages}
//           activeOpacity={0.7}>
//           <Text
//             style={[
//               pitCardStyles.viewBtnText,
//               !hasImages && pitCardStyles.viewBtnTextDimmed,
//             ]}>
//             View Images
//           </Text>
//           <Image
//             style={[pitCardStyles.galleryIcon, !hasImages && {opacity: 0.35}]}
//             source={IMAGES.galleryIcon}
//             resizeMode="contain"
//           />
//           {hasImages && (
//             <View style={pitCardStyles.imgCountBadge}>
//               <Text style={pitCardStyles.imgCountText}>
//                 {pic1Url && pic2Url ? '2' : '1'}
//               </Text>
//             </View>
//           )}
//         </TouchableOpacity>
//       </View>
//       <View style={pitCardStyles.latLongRow}>
//         {/* <Text style={pitCardStyles.latLongText}>Lat: {lat}</Text> */}
//         <Text style={pitCardStyles.latLongText}>Long: {long}</Text>
//       </View>
//     </View>
//   );
// };
// // ─── Main Screen ──────────────────────────────────────────────────────────────
// const PitInstallation: FC<ScreenProps.PitInstallationScreen> = ({
//   navigation,
//   route,
//   loading,
// }) => {
//   const [isLoading, setIsLoading] = useState(false);
//   const [currentPosition, setCurrentPosition] =
//     useState<DataType.Coords | null>(null);
//   const [gpsLat, setGpsLat] = useState<string | null>('');
//   const [gpsLong, setGpsLong] = useState<string | null>('');
//   const [countdown, setCountdown] = useState<number | null>(null);
//   const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
//   const [isCheckingPitNo, setIsCheckingPitNo] = useState(false);
//   const [pitNoAvailable, setPitNoAvailable] = useState<boolean | null>(null);
//   const {
//     pitNo: initialPitNo,
//     projectId,
//     projectName,
//     vendorID,
//     vendorCode,
//     vendorName,
//     distanceBetweenPits,
//     nextPitNo,
//     nextPitId,
//     distanceFromNextPit,
//   } = route.params;
//   // ── Parse vendors ─────────────────────────────────────────────────────────
//   const vendorList: VendorItem[] = useMemo(
//     () =>
//       parseVendors(
//         String(vendorID ?? ''),
//         String(vendorCode ?? ''),
//         String(vendorName ?? ''),
//       ),
//     [vendorID, vendorCode, vendorName],
//   );
//   const isMultiVendor = vendorList.length > 1;
//   const [selectedVendor, setSelectedVendor] = useState<VendorItem | null>(() =>
//     vendorList.length === 1 ? vendorList[0] : null,
//   );
//   useEffect(() => {
//     if (vendorList.length === 1) {
//       setSelectedVendor(vendorList[0]);
//     } else if (vendorList.length > 1) {
//       setSelectedVendor(null);
//     }
//   }, [vendorList.length]);
//   const [pitNo, setPitNo] = useState('');
//   const dispatch = useDispatch<StoreDispatch>();
//   const [errors, setErrors] = useState<any>({});
//   const [address, setAddress] = useState('');
//   const [landmark, setLandmark] = useState('');
//   const [locationError, setLocationError] = useState('');
//   // ── Image state — BurnResult (plain base64 + uri for preview) ────────────
//   // Matches AddInstallationFrom/To exactly: pic1/pic2 are BurnResult | null
//   const [pic1, setPic1] = useState<BurnResult | null>(null);
//   const [pic2, setPic2] = useState<BurnResult | null>(null);
//   const [isProjectPickerVisible, setIsProjectPickerVisible] = useState(false);
//   const [selectedProject, setSelectedProject] = useState<Project | null>(null);
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [galleryData, setGalleryData] = useState<GalleryItem | null>(null);
//   const pitList = useSelector((state: RootState) => state.dss.pitListData);
//   const wLat = gpsLat ?? '';
//   const wLong = gpsLong ?? '';
//   const totalRouteDistanceLabel = useMemo(() => {
//     if (!pitList || pitList.length < 2) return '0 m';
//     let total = 0;
//     for (let i = 0; i < pitList.length - 1; i++) {
//       const d = calcPitDistance(pitList[i], pitList[i + 1]);
//       if (d) total += d;
//     }
//     return formatDistance(total);
//   }, [pitList]);
//   useEffect(
//     () => () => {
//       if (countdownRef.current) clearInterval(countdownRef.current);
//     },
//     [],
//   );
//   useEffect(() => {
//     if (initialPitNo) setPitNo(String(initialPitNo));
//   }, [initialPitNo]);
//   useEffect(() => {
//     if (projectId) dispatch(getPitList({projectId}));
//   }, [projectId]);
//   const handlePickerDismiss = () => setIsProjectPickerVisible(false);
//   const handleCheckAvailability = async () => {
//     const empId = await Preferences.getData('EMPLOYEE_ID');
//     if (!pitNo.trim()) {
//       Common.showToast('Please enter a PIT Number first');
//       return;
//     }
//     if (isCheckingPitNo) return;
//     try {
//       setIsCheckingPitNo(true);
//       setPitNoAvailable(null);
//       const result = await dispatch(
//         checkPitLocationNoAPI({
//           employeeId: empId,
//           projectId: projectId ?? 0,
//           pitLocationNo: parseFloat(pitNo.trim()),
//         }),
//       );
//       if (checkPitLocationNoAPI.fulfilled.match(result)) {
//         const data = result.payload;
//         const free =
//           data?.result === false ||
//           (data?.msg ?? '').toLowerCase().includes('does not exist');
//         setPitNoAvailable(free);
//         if (!free) Common.showToast('PIT Number already exists!');
//       } else {
//         Alert.alert('Error', (result.payload as string) ?? 'Failed to check.');
//       }
//     } catch (e: any) {
//       Alert.alert('Error', e?.message ?? 'Something went wrong');
//     } finally {
//       setIsCheckingPitNo(false);
//     }
//   };
//   const validateForm = () => {
//     const e: any = {};
//     if (!pitNo) e.pitNo = true;
//     if (!gpsLat || !gpsLong) e.gps = true;
//     if (!address) e.address = true;
//     if (!landmark) e.landmark = true;
//     if (!pic1) e.image1 = true; // BurnResult must exist
//     if (!pic2) e.image2 = true;
//     if (!selectedVendor) e.vendor = true;
//     setErrors(e);
//     if (Object.keys(e).length > 0) {
//       Common.showToast('Please fill all required fields');
//       return false;
//     }
//     return true;
//   };
//   // ── Fresh GPS ─────────────────────────────────────────────────────────────

//   // const fetchGPS = async () => {
//   //   try {
//   //     setIsLoading(true);
//   //     setLocationError('');
//   //     const perm = await Location.checkPermission();
//   //     if (perm !== 'granted') {
//   //       Alert.alert('Permission Required', 'Location permission is required.');
//   //       return;
//   //     }
//   //     let freshLat = 0;
//   //     let freshLong = 0;
//   //     try {
//   //       const position = await getSmartLocation({
//   //         onBetterLocation: betterPos => {
//   //           if (betterPos.coords.accuracy <= 25) {
//   //             const lat = betterPos.coords.latitude;
//   //             const lng = betterPos.coords.longitude;
//   //             setGpsLat(String(lat));
//   //             setGpsLong(String(lng));
//   //             setCurrentPosition({latitude: lat, longitude: lng});
//   //             Common.showToast('GPS improved automatically 🎯');
//   //           }
//   //         },
//   //       });
//   //       const accuracy = position.coords.accuracy;
//   //       if (accuracy > 100) {
//   //         Common.showToast('Low accuracy (indoor), using approximate location');
//   //       } else if (accuracy > 50) {
//   //         Common.showToast('Moderate GPS accuracy');
//   //       } else {
//   //         Common.showToast('High GPS accuracy 🎯');
//   //       }
//   //       freshLat = position.coords.latitude;
//   //       freshLong = position.coords.longitude;
//   //     } catch (posErr: any) {
//   //       const msg =
//   //         posErr?.code === 3
//   //           ? 'GPS timed out. Move to open area and try again.'
//   //           : posErr?.code === 2
//   //           ? 'GPS unavailable. Please enable location services.'
//   //           : 'Unable to fetch accurate GPS location.';
//   //       setLocationError(msg);
//   //       Alert.alert('GPS Error', msg);
//   //       return;
//   //     }

//   //     let resolvedAddress = '';
//   //     try {
//   //       const data = (await Location.getAddressFromLatLong({
//   //         lat: freshLat,
//   //         lng: freshLong,
//   //         isOla: false,
//   //       })) as DataType.GeoAddress;
//   //       if (data?.address) resolvedAddress = data.address;
//   //     } catch {
//   //       resolvedAddress = '';
//   //     }
//   //     setGpsLat(String(freshLat));
//   //     setGpsLong(String(freshLong));
//   //     setCurrentPosition({latitude: freshLat, longitude: freshLong});
//   //     if (resolvedAddress) {
//   //       setAddress(resolvedAddress);
//   //       await Preferences.setData('LAST_GEO_ADDRESS', {
//   //         address: resolvedAddress,
//   //       });
//   //       Common.showToast('GPS fetched successfully 🎯');
//   //     } else {
//   //       setAddress('');
//   //       setLocationError('Address not found. Please enter manually.');
//   //       Common.showToast('Coordinates captured. Enter address manually.');
//   //     }
//   //     // If photos already taken, clear them so user retakes with new watermark
//   //     if (pic1 || pic2) {
//   //       Alert.alert(
//   //         'GPS Updated',
//   //         'Please retake photos to update the watermark.',
//   //         [{text: 'OK'}],
//   //       );
//   //       setPic1(null);
//   //       setPic2(null);
//   //     }
//   //   } catch (e: any) {
//   //     setLocationError(e?.message || 'Location error');
//   //   } finally {
//   //     setIsLoading(false);
//   //   }
//   // };
//   const fetchGPS = async () => {
//     try {
//       setIsLoading(true);
//       setLocationError('');
//       let location;
//       try {
//         location = await fetchCurrentGpsLocation({
//           requiredAccuracy: 50,
//           minimumSamples: 5,
//           timeout: 60000,
//         });
//       } catch (error: any) {
//         const message =
//           error?.message || 'Accurate pit location could not be captured.';
//         setLocationError(message);
//         Alert.alert('Accurate GPS Not Available', message);
//         return;
//       }

//       const {latitude, longitude, accuracy, samplesUsed} = location;

//       console.log('Final pit GPS:', {
//         latitude,
//         longitude,
//         accuracyInMeters: accuracy,
//         samplesUsed,
//       });

//       // Update coordinates only after receiving stable readings.
//       setGpsLat(String(latitude));
//       setGpsLong(String(longitude));

//       setCurrentPosition({
//         latitude,
//         longitude,
//       });

//       let resolvedAddress = '';

//       try {
//         const data = (await Location.getAddressFromLatLong({
//           lat: latitude,
//           lng: longitude,
//           isOla: false,
//         })) as DataType.GeoAddress;

//         resolvedAddress = data?.address?.trim() || '';
//       } catch (error) {
//         console.log('Reverse-geocoding failed:', error);
//       }

//       if (resolvedAddress) {
//         setAddress(resolvedAddress);

//         await Preferences.setData('LAST_GEO_ADDRESS', {
//           address: resolvedAddress,
//           lat: latitude,
//           long: longitude,
//           accuracy,
//         });

//         Common.showToast(
//           `Pit GPS captured: ${accuracy.toFixed(1)}m accuracy 🎯`,
//         );
//       } else {
//         setAddress('');
//         setLocationError(
//           'Coordinates captured, but the address was not found. Enter it manually.',
//         );

//         Common.showToast(
//           `Coordinates captured: ${accuracy.toFixed(1)}m accuracy`,
//         );
//       }

//       if (pic1 || pic2) {
//         Alert.alert(
//           'GPS Updated',
//           'Please retake photos to update the watermark.',
//           [{text: 'OK'}],
//         );

//         setPic1(null);
//         setPic2(null);
//       }
//     } catch (error: any) {
//       const message = error?.message || 'Location error';

//       setLocationError(message);
//       Alert.alert('Location Error', message);
//     } finally {
//       setIsLoading(false);
//     }
//   };
//   const handleGetPitGPS = async () => {
//     const perm = await Location.checkPermission();
//     if (perm !== 'granted') {
//       Alert.alert('Permission Required', 'Location permission is required.');
//       return;
//     }
//     if (countdownRef.current) clearInterval(countdownRef.current);
//     setCountdown(10);
//     let remaining = 10;
//     countdownRef.current = setInterval(() => {
//       remaining -= 1;
//       setCountdown(remaining);
//       if (remaining <= 0) {
//         clearInterval(countdownRef.current!);
//         countdownRef.current = null;
//         setCountdown(null);
//         fetchGPS();
//       }
//     }, 1000);
//   };
//   const handleSubmit = async () => {
//     if (!validateForm() || isSubmitting) return;
//     try {
//       setIsSubmitting(true);
//       const empId = await Preferences.getData('EMPLOYEE_ID');
//       if (!empId) {
//         Common.showToast('Employee ID not found.');
//         return;
//       }
//       const activeVendorId = selectedVendor?.vendorId ?? '';
//       const payload = {
//         id: 0,
//         employeeID: Number(empId),
//         projectID: projectId,
//         pitNo: Number(pitNo),
//         pitLandmark: landmark ?? '',
//         pitGPSLocation: address ?? '',
//         lat: String(gpsLat),
//         lng: String(gpsLong),
//         vendorId: activeVendorId ? Number(activeVendorId) : 0,
//         // pic1 and pic2 are {imageData: plainBase64, imageExtention: 'png'}
//         // The slice's FormData appends them as text params — exactly like Java's
//         // addMultipartParameter("Pic1.ImageData", CapturePhotoNP)
//         pic1: pic1 ?? {imageData: '', imageExtention: ''},
//         pic2: pic2 ?? {imageData: '', imageExtention: ''},
//         distance:
//           distanceBetweenPits != null ? Math.round(distanceBetweenPits) : 0,
//         ...(nextPitNo && {nextPitId: Number(nextPitId)}),
//         ...(distanceFromNextPit && {
//           nextPitDistance: Math.round(distanceFromNextPit),
//         }),
//       };
//       const result = await dispatch(insertUpdatePitLocationV2(payload));
//       if (insertUpdatePitLocationV2.fulfilled.match(result)) {
//         Common.showToast('PIT location saved successfully!');
//         dispatch(getPitList({projectId}));
//         navigation.goBack();
//       } else {
//         Alert.alert('Error', (result.payload as string) ?? 'Failed to save.');
//       }
//     } catch (e: any) {
//       Alert.alert('Error', e?.message ?? 'Something went wrong');
//     } finally {
//       setIsSubmitting(false);
//     }
//   };
//   const isCountingDown = countdown !== null;
//   const hasPits = !!(pitList && pitList.length > 0);
//   // ── RENDER ────────────────────────────────────────────────────────────────
//   return (
//     <Screen
//       statusBgColor={COLORS.BACKGROUND_DEFAULT}
//       loading={isLoading || loading}
//       preset={'fixed'}
//       statusBarStyle={'dark'}>
//       {/* Gallery Modal */}
//       <Modal
//         visible={galleryData !== null}
//         transparent
//         animationType="slide"
//         onRequestClose={() => setGalleryData(null)}>
//         <TouchableWithoutFeedback onPress={() => setGalleryData(null)}>
//           <View style={modalStyles.overlay}>
//             <TouchableWithoutFeedback>
//               <View style={modalStyles.modalContainer}>
//                 <View style={modalStyles.modalHeader}>
//                   <Text style={modalStyles.modalTitle}>
//                     {galleryData?.pitId ?? 'PIT Images'}
//                   </Text>
//                   <TouchableOpacity
//                     hitSlop={{top: 10, right: 10, bottom: 10, left: 10}}
//                     onPress={() => setGalleryData(null)}>
//                     <Text style={modalStyles.closeBtn}>✕</Text>
//                   </TouchableOpacity>
//                 </View>
//                 <ScrollView
//                   showsVerticalScrollIndicator={false}
//                   contentContainerStyle={modalStyles.scrollBody}>
//                   {(['Image 1', 'Image 2'] as const).map((lbl, idx) => {
//                     const url =
//                       idx === 0 ? galleryData?.pic1Url : galleryData?.pic2Url;
//                     return (
//                       <View key={lbl} style={modalStyles.imgBlock}>
//                         <Text style={modalStyles.imgLabel}>{lbl}</Text>
//                         {url ? (
//                           <Image
//                             style={modalStyles.pitStyling}
//                             source={{uri: url}}
//                             resizeMode="cover"
//                           />
//                         ) : (
//                           <View style={modalStyles.noImgBox}>
//                             <Image
//                               source={IMAGES.galleryIcon}
//                               style={modalStyles.noImgIcon}
//                               resizeMode="contain"
//                             />
//                             <Text style={modalStyles.noImgText}>
//                               No image available
//                             </Text>
//                           </View>
//                         )}
//                       </View>
//                     );
//                   })}
//                 </ScrollView>
//                 <TouchableOpacity
//                   onPress={() => setGalleryData(null)}
//                   style={modalStyles.imageButton}>
//                   <Text style={modalStyles.closeTxt}>Close</Text>
//                 </TouchableOpacity>
//               </View>
//             </TouchableWithoutFeedback>
//           </View>
//         </TouchableWithoutFeedback>
//       </Modal>
//       {/* Project Picker Modal */}
//       <Modal
//         visible={isProjectPickerVisible}
//         animationType="slide"
//         statusBarTranslucent={false}
//         onRequestClose={handlePickerDismiss}>
//         <ProjectListScreen
//           projects={[]}
//           selectedProjectId={selectedProject?.id ?? null}
//           onSelect={project => {
//             setSelectedProject(project);
//             setIsProjectPickerVisible(false);
//           }}
//           onDismiss={handlePickerDismiss}
//           onReload={handlePickerDismiss}
//           onBack={handlePickerDismiss}
//         />
//       </Modal>
//       <ScrollView showsVerticalScrollIndicator={false}>
//         <View style={styles.body}>
//           <View style={styles.main}>
//             {/* Header */}
//             <View style={styles.header}>
//               <Pressable
//                 style={styles.backBtn}
//                 onPress={() => navigation.goBack()}>
//                 <Image
//                   style={styles.backIcon}
//                   resizeMode="contain"
//                   source={IMAGES.back}
//                 />
//               </Pressable>
//               <Text style={styles.pitLocationMaster}>PIT Location Master</Text>
//               <View style={styles.rightPlaceholder} />
//             </View>
//             <View style={styles.holidaybody}>
//               <View style={styles.holiday}>
//                 <View style={[styles.holidayitem, styles.ul2Layout]}>
//                   <View style={styles.ul}>
//                     {/* Project Name */}
//                     <View style={styles.span}>
//                       <Text
//                         style={[styles.projectName, styles.projectNameTypo]}>
//                         Project Name
//                       </Text>
//                       <Text style={styles.textTypo}> *</Text>
//                     </View>
//                     <TextInput
//                       value={projectName}
//                       editable={false}
//                       pointerEvents="none"
//                       style={[styles.txtInputStyle, xStyles.disabledInput]}
//                     />

//                     {/* Vendor Name */}
//                     <View style={styles.span}>
//                       <Text
//                         style={[styles.projectName, styles.projectNameTypo]}>
//                         Vendor Name
//                       </Text>
//                       <Text style={styles.textTypo}> *</Text>
//                     </View>
//                     {isMultiVendor ? (
//                       <>
//                         <VendorPicker
//                           data={vendorList}
//                           value={selectedVendor}
//                           placeholder="Select Vendor"
//                           onSelect={(item: VendorItem) => {
//                             setSelectedVendor(item);
//                             if (errors.vendor)
//                               setErrors((e: any) => ({...e, vendor: false}));
//                           }}
//                           hasError={!!errors.vendor}
//                         />
//                         {errors.vendor && (
//                           <Text style={xStyles.errorText}>
//                             Please select a vendor
//                           </Text>
//                         )}
//                       </>
//                     ) : (
//                       <View>
//                         <TextInput
//                           value={vendorList[0]?.vendorName ?? vendorName ?? ''}
//                           editable={false}
//                           pointerEvents="none"
//                           style={[styles.txtInputStyle, xStyles.disabledInput]}
//                         />
//                         <Image style={styles.vectorIcon} resizeMode="cover" />
//                       </View>
//                     )}

//                     {/* Distance Pills */}
//                     {distanceBetweenPits != null && distanceBetweenPits > 0 && (
//                       <View style={xStyles.distancePill}>
//                         <Image
//                           source={IMAGES.locationCheck}
//                           style={xStyles.distanceIcon}
//                           resizeMode="contain"
//                         />
//                         <Text style={xStyles.distancePillText}>
//                           {distanceBetweenPits >= 1000
//                             ? `${(distanceBetweenPits / 1000).toFixed(
//                                 1,
//                               )} km from Previous Pit`
//                             : `${Math.round(
//                                 distanceBetweenPits,
//                               )} m from Previous Pit`}
//                         </Text>
//                       </View>
//                     )}
//                     {distanceFromNextPit != null && distanceFromNextPit > 0 && (
//                       <View style={xStyles.distancePill}>
//                         <Image
//                           source={IMAGES.locationCheck}
//                           style={xStyles.distanceIcon}
//                           resizeMode="contain"
//                         />
//                         <Text style={xStyles.distancePillText}>
//                           {distanceFromNextPit >= 1000
//                             ? `${(distanceFromNextPit / 1000).toFixed(
//                                 1,
//                               )} km from Next Pit`
//                             : `${Math.round(
//                                 distanceFromNextPit,
//                               )} m from Next Pit`}
//                         </Text>
//                       </View>
//                     )}

//                     {/* PIT Number */}
//                     <View style={styles.span}>
//                       <Text
//                         style={[styles.projectName, styles.projectNameTypo]}>
//                         PIT Number{' '}
//                       </Text>
//                       <Text style={styles.textTypo}> *</Text>
//                     </View>
//                     <View style={styles.add3}>
//                       <TextInput
//                         value={pitNo}
//                         editable={false}
//                         selectTextOnFocus={false}
//                         placeholder="Enter PIT Number"
//                         placeholderTextColor="#999"
//                         keyboardType="numeric"
//                         style={[
//                           styles.pitInput,
//                           errors.pitNo && xStyles.inputError,
//                         ]}
//                       />
//                       {/* <Pressable
//                         style={[
//                           styles.checkBtn,
//                           isCheckingPitNo && xStyles.btnDisabled,
//                         ]}
//                         onPress={handleCheckAvailability}
//                         disabled={isCheckingPitNo}>
//                         <Text style={styles.checkBtnText}>
//                           {isCheckingPitNo
//                             ? 'Checking...'
//                             : 'Check Availability'}
//                         </Text>
//                       </Pressable> */}
//                     </View>
//                     {errors.pitNo && (
//                       <Text style={xStyles.errorText}>
//                         PIT Number is required
//                       </Text>
//                     )}
//                     {pitNoAvailable !== null &&
//                       (pitNoAvailable ? (
//                         <Text style={xStyles.availableText}>✓ Available</Text>
//                       ) : (
//                         <View style={xStyles.unavailableBadge}>
//                           <Text style={xStyles.unavailableText}>
//                             ✗ PIT Number already exists!
//                           </Text>
//                         </View>
//                       ))}
//                     {/* PIT GPS */}
//                     <View style={styles.span4}>
//                       <Text
//                         style={[styles.pitLocationGps, styles.projectNameTypo]}>
//                         PIT (GPS)
//                       </Text>
//                       <Text style={[styles.text4, styles.textTypo]}> *</Text>
//                       {gpsLat && gpsLong && (
//                         <Text style={xStyles.gpsCoords}>
//                           {`Lat: ${gpsLat}°\nLong: ${gpsLong}°`}
//                         </Text>
//                       )}
//                       <TouchableOpacity
//                         style={[
//                           styles.li2,
//                           styles.liFlexBox,
//                           isCountingDown && xStyles.btnDisabled,
//                         ]}
//                         onPress={handleGetPitGPS}
//                         disabled={isCountingDown}>
//                         <Text
//                           style={[styles.checkAvailability, styles.submitClr]}>
//                           {countdown !== null
//                             ? `Fetching GPS... ${countdown}s`
//                             : 'Get PIT GPS'}
//                         </Text>
//                       </TouchableOpacity>
//                     </View>
//                     {errors.gps && (
//                       <Text style={xStyles.errorText}>
//                         GPS location is required
//                       </Text>
//                     )}

//                     {/* Countdown bar */}
//                     {isCountingDown && (
//                       <View style={xStyles.countdownWrap}>
//                         <View style={xStyles.countdownBarBg}>
//                           <View
//                             style={[
//                               xStyles.countdownBarFill,
//                               {
//                                 width: `${
//                                   ((10 - (countdown ?? 0)) / 10) * 100
//                                 }%`,
//                               },
//                             ]}
//                           />
//                         </View>
//                         <Text style={xStyles.countdownText}>
//                           {`Getting GPS in ${countdown}s…`}
//                         </Text>
//                       </View>
//                     )}

//                     {/* Address */}
//                     <View style={[styles.add4, styles.addBorder]}>
//                       <TextInput
//                         value={address}
//                         onChangeText={text => {
//                           setAddress(text);
//                           if (errors.address)
//                             setErrors((e: any) => ({...e, address: false}));
//                         }}
//                         placeholder="Address"
//                         placeholderTextColor="#999"
//                         multiline
//                         style={[
//                           styles.enterPitNumber,
//                           styles.selectProjectTypo,
//                           xStyles.addressInput,
//                           errors.address && xStyles.inputError,
//                         ]}
//                       />
//                     </View>
//                     {locationError ? (
//                       <Text style={xStyles.errorText}>{locationError}</Text>
//                     ) : null}
//                     {errors.address && !locationError && (
//                       <Text style={xStyles.errorText}>Address is required</Text>
//                     )}

//                     {/* Landmark */}
//                     <View style={styles.span}>
//                       <Text
//                         style={[styles.projectName, styles.projectNameTypo]}>
//                         PIT Landmark
//                       </Text>
//                       <Text style={styles.textTypo}> *</Text>
//                     </View>
//                     <View style={[styles.add4, styles.addBorder]}>
//                       <TextInput
//                         value={landmark}
//                         onChangeText={text => {
//                           setLandmark(text);
//                           if (errors.landmark)
//                             setErrors((e: any) => ({...e, landmark: false}));
//                         }}
//                         placeholder="Enter PIT Landmark"
//                         placeholderTextColor="#999"
//                         multiline
//                         style={[
//                           styles.enterPitNumber,
//                           styles.selectProjectTypo,
//                           xStyles.addressInput,
//                           errors.landmark && xStyles.inputError,
//                         ]}
//                       />
//                     </View>
//                     {errors.landmark && (
//                       <Text style={xStyles.errorText}>
//                         Landmark is required
//                       </Text>
//                     )}

//                     {/* ══════════════════════════════════════════════════════
//                         PIT Images — CaptureImageWatermark (same as AddInstallationFrom/To)
//                         camera button + watermark burn + preview all inside the component
//                     ══════════════════════════════════════════════════════ */}
//                     <View style={styles.ul}>
//                       <View style={styles.label}>
//                         <View style={styles.span}>
//                           <Text
//                             style={[
//                               styles.projectName,
//                               styles.projectNameTypo,
//                             ]}>
//                             PIT Images
//                           </Text>
//                           <Text style={styles.textTypo}> *</Text>
//                         </View>
//                       </View>

//                       {!gpsLat || !gpsLong ? (
//                         <View style={xStyles.gpsWarningBanner}>
//                           <Text style={xStyles.gpsWarningText}>
//                             ⚠ Tap "Get PIT GPS" first — Lat, Long & Address will
//                             be permanently burned onto both photos as a
//                             watermark.
//                           </Text>
//                         </View>
//                       ) : (
//                         <View style={xStyles.gpsReadyBanner}>
//                           <Text style={xStyles.gpsReadyText}>
//                             ✓ GPS ready — watermark will be burned into both
//                             photos
//                           </Text>
//                         </View>
//                       )}

//                       <View style={styles.row}>
//                         {/* ── Image 1 column ── */}
//                         <View style={styles.col}>
//                           <CaptureImageWatermark
//                             title="Image 1"
//                             pic={pic1}
//                             setPic={result => {
//                               setPic1(result);
//                               if (result && errors.image1)
//                                 setErrors((e: any) => ({
//                                   ...e,
//                                   image1: false,
//                                 }));
//                             }}
//                             lat={gpsLat || ''} // ✅ DIRECT
//                             long={gpsLong || ''} // ✅ DIRECT
//                             address={address} // already fixed
//                             hasError={!!errors.image1}
//                           />
//                           {errors.image1 && !pic1 && (
//                             <Text style={xStyles.errorText}>Required</Text>
//                           )}
//                         </View>

//                         {/* ── Image 2 column ── */}
//                         <View style={styles.col}>
//                           <CaptureImageWatermark
//                             title="Image 2"
//                             pic={pic2}
//                             setPic={result => {
//                               setPic2(result);
//                               if (result && errors.image2)
//                                 setErrors((e: any) => ({
//                                   ...e,
//                                   image2: false,
//                                 }));
//                             }}
//                             lat={gpsLat || ''} // ✅ DIRECT
//                             long={gpsLong || ''} // ✅ DIRECT
//                             address={address} // already fixed
//                             hasError={!!errors.image2}
//                           />
//                           {errors.image2 && !pic2 && (
//                             <Text style={xStyles.errorText}>Required</Text>
//                           )}
//                         </View>
//                       </View>
//                     </View>
//                   </View>
//                 </View>

//                 {/* Submit */}
//                 <TouchableOpacity
//                   style={[
//                     styles.li4,
//                     styles.li4FlexBox,
//                     isSubmitting && xStyles.btnDisabled,
//                   ]}
//                   onPress={handleSubmit}
//                   disabled={isSubmitting}>
//                   <Text style={[styles.submit, styles.submitClr]}>
//                     {isSubmitting ? 'Submitting…' : 'Submit'}
//                   </Text>
//                 </TouchableOpacity>

//                 {/* PIT Cards */}
//                 {hasPits && (
//                   <View style={xStyles.pitListSection}>
//                     <View style={xStyles.statsRow}>
//                       <View style={xStyles.statBox}>
//                         <Text style={xStyles.statLabel}>Total Distance:</Text>
//                         <View style={xStyles.statValueBox}>
//                           <Text style={xStyles.statValue}>
//                             {totalRouteDistanceLabel}
//                           </Text>
//                         </View>
//                       </View>
//                       <View style={xStyles.statBox}>
//                         <Text style={xStyles.statLabel}>
//                           Total No. of Pits:
//                         </Text>
//                         <View style={xStyles.statValueBox}>
//                           <Text style={xStyles.statValue}>
//                             {pitList?.length ?? 0}
//                           </Text>
//                         </View>
//                       </View>
//                     </View>
//                     {pitList.map((item: any, index: number) => {
//                       const displayNo = displayPitNo(item?.pitNo ?? '');
//                       const cardId = String(
//                         item?.pitLocationId ?? item?.pitNo ?? index,
//                       );
//                       const nextItem =
//                         index < pitList.length - 1 ? pitList[index + 1] : null;
//                       const dist = nextItem
//                         ? calcPitDistance(item, nextItem)
//                         : null;
//                       const distLabel =
//                         dist !== null ? formatDistance(dist) : null;
//                       return (
//                         <React.Fragment key={cardId}>
//                           <PitCard
//                             pitId={`PIT - ${displayNo}`}
//                             lat={`${item?.lat ?? '0'}°`}
//                             long={`${item?.lng ?? '0'}°`}
//                             landmark={item?.pitLandmark ?? '-'}
//                             address={item?.pitGPSLocation ?? '-'}
//                             pic1Url={item?.pic1Url ?? null}
//                             pic2Url={item?.pic2Url ?? null}
//                             onViewImages={() =>
//                               setGalleryData({
//                                 pitId: `PIT - ${displayNo}`,
//                                 pic1Url: item?.pic1Url ?? null,
//                                 pic2Url: item?.pic2Url ?? null,
//                               })
//                             }
//                           />
//                           {index < pitList.length - 1 && (
//                             <View style={xStyles.betweenRow}>
//                               <Image
//                                 source={IMAGES.updownArrow}
//                                 style={xStyles.betweenArrow}
//                                 resizeMode="contain"
//                               />
//                               <Text style={xStyles.betweenText}>
//                                 {distLabel
//                                   ? `Distance: ${distLabel}`
//                                   : 'Distance: —'}
//                               </Text>
//                             </View>
//                           )}
//                         </React.Fragment>
//                       );
//                     })}
//                   </View>
//                 )}
//                 {!hasPits && pitList !== null && pitList !== undefined && (
//                   <View style={xStyles.emptyWrap}>
//                     <Image
//                       source={IMAGES.noImage}
//                       style={xStyles.emptyIcon}
//                       resizeMode="contain"
//                     />
//                     <Text style={xStyles.emptyText}>No PITs added yet</Text>
//                   </View>
//                 )}
//               </View>
//             </View>
//           </View>
//         </View>
//       </ScrollView>
//     </Screen>
//   );
// };

// export default PitInstallation;

// // ─────────────────────────────────────────────────────────────────────────────
// // VendorPicker styles
// // ─────────────────────────────────────────────────────────────────────────────
// const vendorPickerStyles = StyleSheet.create({
//   inputBox: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     borderWidth: 1,
//     borderColor: '#E6EEF6',
//     borderRadius: 6,
//     paddingHorizontal: 12,
//     height: 40,
//     backgroundColor: '#F7F9FB',
//     justifyContent: 'space-between',
//   },
//   inputBoxError: {borderColor: COLORS.ERROR ?? '#f44', borderWidth: 1.5},
//   inputText: {
//     flex: 1,
//     fontSize: 13,
//     fontFamily: FONTS.MEDIUM,
//     color: '#2F4F4F',
//   },
//   placeholder: {color: '#999'},
//   arrow: {fontSize: 12, color: '#888', marginLeft: 4},
//   overlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0,0,0,0.35)',
//     justifyContent: 'center',
//     paddingHorizontal: 20,
//   },
//   dropdown: {
//     backgroundColor: '#fff',
//     borderRadius: 10,
//     overflow: 'hidden',
//     elevation: 6,
//     shadowColor: '#000',
//     shadowOffset: {width: 0, height: 2},
//     shadowOpacity: 0.15,
//     shadowRadius: 4,
//   },
//   item: {paddingHorizontal: 16, paddingVertical: 12},
//   itemBorder: {borderBottomWidth: 1, borderBottomColor: '#eee'},
//   itemSelected: {backgroundColor: '#EEF2FF'},
//   itemName: {fontSize: 14, fontFamily: FONTS.MEDIUM, color: '#1a1a1a'},
//   itemCode: {
//     fontSize: 11,
//     fontFamily: FONTS.REGULAR,
//     color: '#5C6BC0',
//     marginTop: 2,
//   },
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // Gallery / modal styles
// // ─────────────────────────────────────────────────────────────────────────────
// const modalStyles = StyleSheet.create({
//   overlay: {
//     flex: 1,
//     backgroundColor: 'rgba(0,0,0,0.55)',
//     justifyContent: 'flex-end',
//   },
//   modalContainer: {
//     backgroundColor: '#fff',
//     borderTopLeftRadius: 20,
//     borderTopRightRadius: 20,
//     paddingHorizontal: 20,
//     paddingBottom: 28,
//     maxHeight: '85%',
//   },
//   modalHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     paddingVertical: 16,
//     borderBottomWidth: 1,
//     borderBottomColor: '#eee',
//     marginBottom: 4,
//   },
//   modalTitle: {
//     fontSize: 17,
//     fontWeight: '600',
//     color: '#1a1a1a',
//     fontFamily: FONTS.SEMI_BOLD,
//   },
//   closeBtn: {fontSize: 20, color: '#666', paddingHorizontal: 4},
//   scrollBody: {paddingTop: 12, paddingBottom: 8, gap: 18},
//   imgBlock: {gap: 8},
//   imgLabel: {fontSize: 13, fontFamily: FONTS.SEMI_BOLD, color: '#555'},
//   pitStyling: {
//     height: 210,
//     width: '100%',
//     borderRadius: 12,
//     backgroundColor: '#f2f2f2',
//   },
//   noImgBox: {
//     height: 120,
//     width: '100%',
//     borderRadius: 12,
//     backgroundColor: '#fafafa',
//     borderWidth: 1.5,
//     borderColor: '#ddd',
//     borderStyle: 'dashed',
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 8,
//   },
//   noImgIcon: {width: 28, height: 28, opacity: 0.3},
//   noImgText: {fontSize: 13, color: '#aaa', fontFamily: FONTS.REGULAR},
//   imageButton: {
//     marginTop: 16,
//     paddingVertical: 13,
//     backgroundColor: '#535455',
//     alignItems: 'center',
//     borderRadius: 10,
//   },
//   closeTxt: {color: '#fff', fontFamily: FONTS.SEMI_BOLD, fontSize: 14},
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // PitCard styles
// // ─────────────────────────────────────────────────────────────────────────────
// const pitCardStyles = StyleSheet.create({
//   card: {
//     backgroundColor: COLORS.colorWhite,
//     borderRadius: Border.br_8,
//     padding: Padding.padding_8,
//     elevation: 3,
//     shadowColor: '#000',
//     shadowOffset: {width: 0, height: 1},
//     shadowOpacity: 0.08,
//     shadowRadius: 3,
//     gap: Gap.gap_4,
//     overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
//   },
//   header: {flexDirection: 'row', alignItems: 'center', gap: Gap.gap_4},
//   badge: {
//     backgroundColor: COLORS.PRIMARY,
//     borderRadius: Border.br_5,
//     paddingHorizontal: Padding.padding_5,
//     paddingVertical: Padding.padding_2,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   badgeText: {
//     color: COLORS.colorWhite,
//     fontSize: FontSize.fs_10,
//     fontFamily: FONTS.REGULAR,
//   },
//   metaText: {
//     fontSize: FontSize.fs_12,
//     color: COLORS.colorDarkslategray,
//     fontFamily: FONTS.REGULAR,
//   },
//   metaLabel: {fontFamily: FONTS.SEMI_BOLD},
//   metaValue: {fontFamily: FONTS.REGULAR},
//   address: {
//     fontSize: FontSize.fs_11,
//     color: COLORS.colorDarkslategray,
//     fontFamily: FONTS.REGULAR,
//     lineHeight: 15,
//   },
//   bottomRow: {flexDirection: 'row', alignItems: 'center'},
//   latLongRow: {
//     flex: 1,
//     flexDirection: 'row',
//     gap: Gap.gap_4,
//     alignItems: 'center',
//   },
//   latLongText: {
//     fontSize: FontSize.fs_10,
//     color: COLORS.colorDarkslategray,
//     fontFamily: FONTS.REGULAR,
//     letterSpacing: LetterSpacing?.ls_0_2 ?? 0.2,
//   },
//   viewBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//     position: 'relative',
//     paddingVertical: 2,
//     paddingHorizontal: 4,
//   },
//   viewBtnDimmed: {opacity: 0.38},
//   viewBtnText: {
//     fontSize: FontSize.fs_10,
//     color: COLORS.colorMediumslateblue ?? '#6C63FF',
//     fontFamily: FONTS.MEDIUM,
//     textDecorationLine: 'underline',
//   },
//   viewBtnTextDimmed: {
//     color: COLORS.colorDarkslategray,
//     textDecorationLine: 'none',
//   },
//   galleryIcon: {width: 17, height: 17},
//   imgCountBadge: {
//     position: 'absolute',
//     top: -3,
//     right: -2,
//     backgroundColor: COLORS.PRIMARY,
//     borderRadius: 8,
//     minWidth: 14,
//     height: 14,
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingHorizontal: 3,
//   },
//   imgCountText: {
//     fontSize: 9,
//     color: COLORS.colorWhite,
//     fontFamily: FONTS.SEMI_BOLD,
//   },
// });

// // ─────────────────────────────────────────────────────────────────────────────
// // xStyles
// // ─────────────────────────────────────────────────────────────────────────────
// const xStyles = StyleSheet.create({
//   disabledInput: {backgroundColor: '#f5f5f5', color: '#888'},
//   inputError: {borderColor: COLORS.ERROR, borderWidth: 1},
//   addressInput: {
//     minHeight: 60,
//     textAlignVertical: 'top',
//     paddingTop: 8,
//     color: '#1a1a1a',
//   },
//   gpsCoords: {
//     fontSize: 12,
//     color: COLORS.PRIMARY,
//     fontFamily: FONTS.REGULAR,
//     marginHorizontal: 6,
//     flexShrink: 1,
//   },
//   errorText: {
//     fontSize: 12,
//     color: COLORS.ERROR,
//     marginTop: 2,
//     marginBottom: 4,
//     fontFamily: FONTS.REGULAR,
//   },
//   btnDisabled: {opacity: 0.6},
//   countdownWrap: {marginTop: 6, marginBottom: 2, gap: 4},
//   countdownBarBg: {
//     height: 4,
//     backgroundColor: '#E0E0E0',
//     borderRadius: 4,
//     overflow: 'hidden',
//   },
//   countdownBarFill: {
//     height: 4,
//     backgroundColor: COLORS.PRIMARY,
//     borderRadius: 4,
//   },
//   countdownText: {
//     fontSize: 11,
//     color: COLORS.PRIMARY,
//     fontFamily: FONTS.REGULAR,
//     textAlign: 'center',
//     marginTop: 2,
//   },
//   availableText: {
//     fontSize: 13,
//     fontFamily: FONTS.SEMI_BOLD,
//     color: '#2E7D32',
//     marginTop: 4,
//     marginBottom: 6,
//   },
//   unavailableBadge: {
//     alignSelf: 'flex-start',
//     backgroundColor: '#FFEBEE',
//     borderRadius: 20,
//     paddingHorizontal: 10,
//     paddingVertical: 4,
//     marginTop: 4,
//     marginBottom: 6,
//   },
//   unavailableText: {fontSize: 12, fontFamily: FONTS.MEDIUM, color: '#C62828'},
//   distancePill: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     alignSelf: 'flex-start',
//     backgroundColor: '#E8F5E9',
//     borderRadius: 20,
//     paddingHorizontal: 10,
//     paddingVertical: 4,
//     marginTop: 4,
//     marginBottom: 8,
//     gap: 4,
//   },
//   distanceIcon: {width: 12, height: 12, tintColor: '#2E7D32'},
//   distancePillText: {fontSize: 11, color: '#2E7D32', fontFamily: FONTS.MEDIUM},
//   pitListSection: {gap: 0},
//   statsRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     backgroundColor: COLORS.colorWhite,
//     borderRadius: Border.br_8,
//     paddingHorizontal: 10,
//     paddingVertical: 7,
//     elevation: 3,
//     shadowColor: '#000',
//     shadowOffset: {width: 0, height: 1},
//     shadowOpacity: 0.08,
//     shadowRadius: 3,
//     gap: 10,
//     marginBottom: 8,
//     overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
//   },
//   statBox: {
//     flex: 1,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     gap: Gap.gap_3,
//     backgroundColor: COLORS.colorGray ?? '#f5f5f5',
//     borderRadius: Border.br_6,
//     paddingHorizontal: 6,
//     paddingVertical: 4,
//   },
//   statLabel: {
//     fontSize: SIZE.MS(12),
//     fontFamily: FONTS.MEDIUM,
//     color: COLORS.colorDarkslategray,
//     flexShrink: 1,
//   },
//   statValueBox: {
//     borderWidth: 1,
//     borderColor: '#F7F6F6',
//     borderRadius: Border.br_5,
//     paddingHorizontal: Padding.padding_6,
//     paddingVertical: 2,
//     justifyContent: 'center',
//     backgroundColor: COLORS.colorWhite,
//   },
//   statValue: {
//     fontSize: 12,
//     fontFamily: FONTS.MEDIUM,
//     color: COLORS.colorDarkslategray,
//   },
//   betweenRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 5,
//     backgroundColor: COLORS.colorGray ?? '#f5f5f5',
//     borderRadius: Border.br_6,
//     paddingHorizontal: 10,
//     paddingVertical: 6,
//     marginVertical: 6,
//   },
//   betweenArrow: {width: 5, height: 11},
//   betweenText: {
//     fontSize: FontSize.fs_11,
//     color: COLORS.colorDarkslategray,
//     fontFamily: FONTS.REGULAR,
//   },
//   emptyWrap: {alignItems: 'center', paddingVertical: 20, gap: 8},
//   emptyIcon: {width: 80, height: 80, opacity: 0.45},
//   emptyText: {
//     fontSize: 13,
//     color: COLORS.colorDarkslategray,
//     fontFamily: FONTS.REGULAR,
//     opacity: 0.6,
//   },
//   gpsWarningBanner: {
//     backgroundColor: '#FFF3E0',
//     borderRadius: 8,
//     paddingHorizontal: 10,
//     paddingVertical: 8,
//     marginBottom: 8,
//     borderLeftWidth: 3,
//     borderLeftColor: '#FF9800',
//   },
//   gpsWarningText: {
//     fontSize: 12,
//     color: '#E65100',
//     fontFamily: FONTS.REGULAR,
//     lineHeight: 17,
//   },
//   gpsReadyBanner: {
//     backgroundColor: '#E8F5E9',
//     borderRadius: 8,
//     paddingHorizontal: 10,
//     paddingVertical: 6,
//     marginBottom: 8,
//     borderLeftWidth: 3,
//     borderLeftColor: '#4CAF50',
//   },
//   gpsReadyText: {fontSize: 12, color: '#2E7D32', fontFamily: FONTS.MEDIUM},
// });
import React, {FC, useState, useEffect, useRef, useMemo} from 'react';
import {
  Text,
  StyleSheet,
  View,
  TextInput,
  Image,
  ScrollView,
  Alert,
  Pressable,
  Modal,
  Platform,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import {Preferences} from '@utils';
import {
  Border,
  Padding,
  LetterSpacing,
  Gap,
  FontSize,
} from '../../res/globalStyle';
import {fetchCurrentGpsLocation} from '../../components/molecules/LocationButton/gps';
import {GeoPosition} from 'react-native-geolocation-service';
import {Common} from '@utils';
import {ScreenProps} from '@types';
import {Screen} from '@organisms';
import styles from './styles';
import {DataType} from '@types';
import {
  insertUpdatePitLocationV2,
  getPitList,
  checkPitLocationNoAPI,
} from '../../store/slices/dss.slice';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {useDispatch, useSelector} from 'react-redux';
import {Location} from '@utils';
import {StoreDispatch, RootState} from '@reducers';
import ProjectListScreen, {
  Project,
} from '../../components/molecules/DssProjectPickerButton';
import Geolocation, {
  GeolocationResponse,
} from '@react-native-community/geolocation';
import {CaptureImageWatermark} from '@molecules';
import type {BurnResult} from '../../components/molecules/capture-image-watermark/index';
// ─── Types ────────────────────────────────────────────────────────────────────
type GalleryItem = {
  pitId: string;
  pic1Url: string | null;
  pic2Url: string | null;
};
type VendorItem = {
  vendorId: string;
  vendorCode: string;
  vendorName: string;
};

type SmartLocationCallbacks = {
  onBetterLocation?: (pos: GeolocationResponse) => void;
};

export const getSmartLocation = (
  callbacks: SmartLocationCallbacks = {},
): Promise<GeolocationResponse> & {stop?: () => void} => {
  const {onBetterLocation} = callbacks;
  let watchId: number | null = null;

  const promise: any = new Promise((resolve, reject) => {
    let isResolved = false;

    Geolocation.getCurrentPosition(
      (pos: GeolocationResponse) => {
        if (!isResolved) {
          isResolved = true;
          resolve(pos);
        }
      },
      () => {
        Geolocation.getCurrentPosition(
          (pos: GeolocationResponse) => {
            if (!isResolved) {
              isResolved = true;
              resolve(pos);
            }
          },
          reject,
          {enableHighAccuracy: false, timeout: 7000, maximumAge: 60000},
        );
      },
      {enableHighAccuracy: true, timeout: 8000, maximumAge: 0},
    );

    watchId = Geolocation.watchPosition(
      (pos: GeolocationResponse) => {
        if (pos.coords.accuracy <= 50) {
          onBetterLocation?.(pos);
          if (watchId !== null) {
            Geolocation.clearWatch(watchId);
            watchId = null;
          }
        }
      },
      () => {},
      {enableHighAccuracy: true, distanceFilter: 0},
    );
  });

  promise.stop = () => {
    if (watchId !== null) {
      Geolocation.clearWatch(watchId);
      watchId = null;
    }
  };

  return promise;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const displayPitNo = (pitNo: string | number): string => {
  const s = String(pitNo ?? '').trim();
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '') || '0';
};

const getAccurateGPS = ({
  desiredAccuracy = 20,
  timeout = 30000,
}: {
  desiredAccuracy?: number;
  timeout?: number;
} = {}): Promise<GeoPosition> => {
  return new Promise((resolve, reject) => {
    let watchId: number | null = null;
    let bestPosition: GeoPosition | null = null;
    let completed = false;

    const cleanup = () => {
      if (watchId !== null) {
        Geolocation.clearWatch(watchId);
        watchId = null;
      }

      clearTimeout(timeoutId);
    };

    const finish = (position: GeoPosition) => {
      if (completed) return;

      completed = true;
      cleanup();
      resolve(position);
    };
    const timeoutId = setTimeout(() => {
      if (completed) return;
      completed = true;
      cleanup();
      if (bestPosition) {
        // Return the best reading captured during the timeout period.
        resolve(bestPosition);
      } else {
        reject({
          code: 3,
          message: 'GPS timed out. Move to an open area and try again.',
        });
      }
    }, timeout);
    watchId = Geolocation.watchPosition(
      position => {
        const accuracy = Number(position.coords.accuracy);
        console.log('GPS reading:', {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy,
        });
        const bestAccuracy = Number(
          bestPosition?.coords?.accuracy ?? Number.POSITIVE_INFINITY,
        );

        if (!bestPosition || accuracy < bestAccuracy) {
          bestPosition = position;
        }

        if (accuracy > 0 && accuracy <= desiredAccuracy) {
          finish(position);
        }
      },
      error => {
        console.log('GPS watch error:', error);

        // Do not immediately fail if we already captured a usable position.
        if (bestPosition) {
          return;
        }

        completed = true;
        cleanup();
        reject(error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 0,
        interval: 1000,
        fastestInterval: 500,
        maximumAge: 0,
        forceRequestLocation: true,
        showLocationDialog: true,
      },
    );
  });
};
const haversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6371000;
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(lat2 - lat1);
  const dLon = r(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (m: number) =>
  m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;

const calcPitDistance = (a: any, b: any): number | null => {
  const la = parseFloat(a?.lat ?? '0'),
    lna = parseFloat(a?.lng ?? '0');
  const lb = parseFloat(b?.lat ?? '0'),
    lnb = parseFloat(b?.lng ?? '0');
  if (
    isNaN(la) ||
    isNaN(lna) ||
    isNaN(lb) ||
    isNaN(lnb) ||
    (la === 0 && lna === 0) ||
    (lb === 0 && lnb === 0)
  )
    return null;
  return haversineDistance(la, lna, lb, lnb);
};

// ─── Nearby-address fallback ──────────────────────────────────────────────────
// Used ONLY for reverse-geocoding. The captured lat/long is never changed.
const NEARBY_ADDRESS_RADII_METERS = [20, 50, 100, 200];
const NEARBY_ADDRESS_BEARINGS_DEG = [0, 90, 180, 270, 45, 135, 225, 315];
const EARTH_RADIUS_METERS = 6371000;
const toRadians = (deg: number) => (deg * Math.PI) / 180;

const offsetLatLng = (
  lat: number,
  lng: number,
  distanceMeters: number,
  bearingDeg: number,
): {lat: number; lng: number} => {
  const bearing = toRadians(bearingDeg);
  const d = distanceMeters / EARTH_RADIUS_METERS;
  const lat1 = toRadians(lat);
  const lng1 = toRadians(lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
      Math.cos(lat1) * Math.sin(d) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );

  return {lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI};
};

const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const data = (await Location.getAddressFromLatLong({
      lat,
      lng,
      isOla: false,
    })) as DataType.GeoAddress;
    return data?.address?.trim() || '';
  } catch (err) {
    console.log('Reverse-geocoding failed:', err);
    return '';
  }
};

// 1) Try the exact point. 2) If empty, probe rings of points around it
// (20m → 200m) and take the first address found. Returns isApproximate=true
// when the address came from a nearby point.
const getAddressWithNearbyFallback = async (
  lat: number,
  lng: number,
): Promise<{address: string; isApproximate: boolean}> => {
  const exact = await reverseGeocode(lat, lng);
  if (exact) return {address: exact, isApproximate: false};

  for (const radius of NEARBY_ADDRESS_RADII_METERS) {
    const results = await Promise.all(
      NEARBY_ADDRESS_BEARINGS_DEG.map(bearing => {
        const p = offsetLatLng(lat, lng, radius, bearing);
        return reverseGeocode(p.lat, p.lng);
      }),
    );
    const found = results.find(Boolean);
    if (found) return {address: found, isApproximate: true};
  }

  return {address: '', isApproximate: false};
};

// ─── Parse comma-separated vendor fields into VendorItem[] ───────────────────
const parseVendors = (
  vendorID: string | undefined,
  vendorCode: string | undefined,
  vendorName: string | undefined,
): VendorItem[] => {
  const ids = (vendorID ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const codes = (vendorCode ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const names = (vendorName ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const count = Math.max(ids.length, codes.length, names.length);
  if (count === 0) return [];
  return Array.from({length: count}, (_, i) => ({
    vendorId: ids[i] ?? '',
    vendorCode: codes[i] ?? '',
    vendorName: names[i] ?? '',
  }));
};

// ─── Inline VendorPicker ──────────────────────────────────────────────────────
type VendorPickerProps = {
  data: VendorItem[];
  value: VendorItem | null;
  placeholder: string;
  onSelect: (item: VendorItem) => void;
  hasError: boolean;
};

const VendorPicker: FC<VendorPickerProps> = ({
  data,
  value,
  placeholder,
  onSelect,
  hasError,
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        style={[
          vendorPickerStyles.inputBox,
          hasError && vendorPickerStyles.inputBoxError,
        ]}
        onPress={() => setVisible(true)}>
        <Text
          style={[
            vendorPickerStyles.inputText,
            !value && vendorPickerStyles.placeholder,
          ]}
          numberOfLines={1}>
          {value ? value.vendorName : placeholder}
        </Text>
        <Text style={vendorPickerStyles.arrow}>▾</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity
          style={vendorPickerStyles.overlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}>
          <View style={vendorPickerStyles.dropdown}>
            {data.map((item, index) => (
              <TouchableOpacity
                key={`${item.vendorId}-${index}`}
                style={[
                  vendorPickerStyles.item,
                  index < data.length - 1 && vendorPickerStyles.itemBorder,
                  value?.vendorId === item.vendorId &&
                    vendorPickerStyles.itemSelected,
                ]}
                onPress={() => {
                  onSelect(item);
                  setVisible(false);
                }}>
                <Text style={vendorPickerStyles.itemName}>
                  {item.vendorName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

// ─── PitCard ──────────────────────────────────────────────────────────────────
type PitCardProps = {
  pitId: string;
  lat: string;
  long: string;
  landmark: string;
  address: string;
  pic1Url: string | null;
  pic2Url: string | null;
  onViewImages: () => void;
};

const PitCard: FC<PitCardProps> = ({
  pitId,
  lat,
  long,
  landmark,
  address,
  pic1Url,
  pic2Url,
  onViewImages,
}) => {
  const hasImages = !!(pic1Url || pic2Url);
  return (
    <View style={pitCardStyles.card}>
      <View style={pitCardStyles.header}>
        <View style={pitCardStyles.badge}>
          <Text style={pitCardStyles.badgeText}>{pitId}</Text>
        </View>
      </View>
      <Text style={pitCardStyles.metaText}>
        <Text style={pitCardStyles.metaLabel}>Landmark: </Text>
        <Text style={pitCardStyles.metaValue}>{landmark}</Text>
      </Text>
      <Text style={pitCardStyles.address}>{address}</Text>
      <View style={pitCardStyles.bottomRow}>
        <View style={pitCardStyles.latLongRow}>
          <Text style={pitCardStyles.latLongText}>Lat: {lat}</Text>
          {/* <Text style={pitCardStyles.latLongText}>Long: {long}</Text> */}
        </View>
        <TouchableOpacity
          style={[
            pitCardStyles.viewBtn,
            !hasImages && pitCardStyles.viewBtnDimmed,
          ]}
          onPress={onViewImages}
          disabled={!hasImages}
          activeOpacity={0.7}>
          <Text
            style={[
              pitCardStyles.viewBtnText,
              !hasImages && pitCardStyles.viewBtnTextDimmed,
            ]}>
            View Images
          </Text>
          <Image
            style={[pitCardStyles.galleryIcon, !hasImages && {opacity: 0.35}]}
            source={IMAGES.galleryIcon}
            resizeMode="contain"
          />
          {hasImages && (
            <View style={pitCardStyles.imgCountBadge}>
              <Text style={pitCardStyles.imgCountText}>
                {pic1Url && pic2Url ? '2' : '1'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      <View style={pitCardStyles.latLongRow}>
        {/* <Text style={pitCardStyles.latLongText}>Lat: {lat}</Text> */}
        <Text style={pitCardStyles.latLongText}>Long: {long}</Text>
      </View>
    </View>
  );
};
// ─── Main Screen ──────────────────────────────────────────────────────────────
const PitInstallation: FC<ScreenProps.PitInstallationScreen> = ({
  navigation,
  route,
  loading,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [currentPosition, setCurrentPosition] =
    useState<DataType.Coords | null>(null);
  const [gpsLat, setGpsLat] = useState<string | null>('');
  const [gpsLong, setGpsLong] = useState<string | null>('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isCheckingPitNo, setIsCheckingPitNo] = useState(false);
  const [pitNoAvailable, setPitNoAvailable] = useState<boolean | null>(null);
  const {
    pitNo: initialPitNo,
    projectId,
    projectName,
    vendorID,
    vendorCode,
    vendorName,
    distanceBetweenPits,
    nextPitNo,
    nextPitId,
    distanceFromNextPit,
  } = route.params;
  // ── Parse vendors ─────────────────────────────────────────────────────────
  const vendorList: VendorItem[] = useMemo(
    () =>
      parseVendors(
        String(vendorID ?? ''),
        String(vendorCode ?? ''),
        String(vendorName ?? ''),
      ),
    [vendorID, vendorCode, vendorName],
  );
  const isMultiVendor = vendorList.length > 1;
  const [selectedVendor, setSelectedVendor] = useState<VendorItem | null>(() =>
    vendorList.length === 1 ? vendorList[0] : null,
  );
  useEffect(() => {
    if (vendorList.length === 1) {
      setSelectedVendor(vendorList[0]);
    } else if (vendorList.length > 1) {
      setSelectedVendor(null);
    }
  }, [vendorList.length]);
  const [pitNo, setPitNo] = useState('');
  const dispatch = useDispatch<StoreDispatch>();
  const [errors, setErrors] = useState<any>({});
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [locationError, setLocationError] = useState('');
  // true jab address exact point ki jagah nearby point se aaya ho
  const [isAddressApproximate, setIsAddressApproximate] = useState(false);
  // hasLatLng: coordinates captured. hasGps: coordinates AND address present
  // (photo capture depends on this).
  const hasLatLng = !!(gpsLat && gpsLong);
  const hasGps = hasLatLng && !!address.trim();
  // ── Image state — BurnResult (plain base64 + uri for preview) ────────────
  // Matches AddInstallationFrom/To exactly: pic1/pic2 are BurnResult | null
  const [pic1, setPic1] = useState<BurnResult | null>(null);
  const [pic2, setPic2] = useState<BurnResult | null>(null);
  const [isProjectPickerVisible, setIsProjectPickerVisible] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [galleryData, setGalleryData] = useState<GalleryItem | null>(null);
  const pitList = useSelector((state: RootState) => state.dss.pitListData);
  const wLat = gpsLat ?? '';
  const wLong = gpsLong ?? '';
  const totalRouteDistanceLabel = useMemo(() => {
    if (!pitList || pitList.length < 2) return '0 m';
    let total = 0;
    for (let i = 0; i < pitList.length - 1; i++) {
      const d = calcPitDistance(pitList[i], pitList[i + 1]);
      if (d) total += d;
    }
    return formatDistance(total);
  }, [pitList]);
  useEffect(
    () => () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    },
    [],
  );
  useEffect(() => {
    if (initialPitNo) setPitNo(String(initialPitNo));
  }, [initialPitNo]);
  useEffect(() => {
    if (projectId) dispatch(getPitList({projectId}));
  }, [projectId]);
  const handlePickerDismiss = () => setIsProjectPickerVisible(false);
  const handleCheckAvailability = async () => {
    const empId = await Preferences.getData('EMPLOYEE_ID');
    if (!pitNo.trim()) {
      Common.showToast('Please enter a PIT Number first');
      return;
    }
    if (isCheckingPitNo) return;
    try {
      setIsCheckingPitNo(true);
      setPitNoAvailable(null);
      const result = await dispatch(
        checkPitLocationNoAPI({
          employeeId: empId,
          projectId: projectId ?? 0,
          pitLocationNo: parseFloat(pitNo.trim()),
        }),
      );
      if (checkPitLocationNoAPI.fulfilled.match(result)) {
        const data = result.payload;
        const free =
          data?.result === false ||
          (data?.msg ?? '').toLowerCase().includes('does not exist');
        setPitNoAvailable(free);
        if (!free) Common.showToast('PIT Number already exists!');
      } else {
        Alert.alert('Error', (result.payload as string) ?? 'Failed to check.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong');
    } finally {
      setIsCheckingPitNo(false);
    }
  };
  const validateForm = () => {
    const e: any = {};
    if (!pitNo) e.pitNo = true;
    if (!gpsLat || !gpsLong) e.gps = true;
    if (!address) e.address = true;
    if (!landmark) e.landmark = true;
    if (!pic1) e.image1 = true; // BurnResult must exist
    if (!pic2) e.image2 = true;
    if (!selectedVendor) e.vendor = true;
    setErrors(e);
    if (Object.keys(e).length > 0) {
      Common.showToast('Please fill all required fields');
      return false;
    }
    return true;
  };
  // ── Fresh GPS ─────────────────────────────────────────────────────────────

  // const fetchGPS = async () => {
  //   try {
  //     setIsLoading(true);
  //     setLocationError('');
  //     const perm = await Location.checkPermission();
  //     if (perm !== 'granted') {
  //       Alert.alert('Permission Required', 'Location permission is required.');
  //       return;
  //     }
  //     let freshLat = 0;
  //     let freshLong = 0;
  //     try {
  //       const position = await getSmartLocation({
  //         onBetterLocation: betterPos => {
  //           if (betterPos.coords.accuracy <= 25) {
  //             const lat = betterPos.coords.latitude;
  //             const lng = betterPos.coords.longitude;
  //             setGpsLat(String(lat));
  //             setGpsLong(String(lng));
  //             setCurrentPosition({latitude: lat, longitude: lng});
  //             Common.showToast('GPS improved automatically 🎯');
  //           }
  //         },
  //       });
  //       const accuracy = position.coords.accuracy;
  //       if (accuracy > 100) {
  //         Common.showToast('Low accuracy (indoor), using approximate location');
  //       } else if (accuracy > 50) {
  //         Common.showToast('Moderate GPS accuracy');
  //       } else {
  //         Common.showToast('High GPS accuracy 🎯');
  //       }
  //       freshLat = position.coords.latitude;
  //       freshLong = position.coords.longitude;
  //     } catch (posErr: any) {
  //       const msg =
  //         posErr?.code === 3
  //           ? 'GPS timed out. Move to open area and try again.'
  //           : posErr?.code === 2
  //           ? 'GPS unavailable. Please enable location services.'
  //           : 'Unable to fetch accurate GPS location.';
  //       setLocationError(msg);
  //       Alert.alert('GPS Error', msg);
  //       return;
  //     }

  //     let resolvedAddress = '';
  //     try {
  //       const data = (await Location.getAddressFromLatLong({
  //         lat: freshLat,
  //         lng: freshLong,
  //         isOla: false,
  //       })) as DataType.GeoAddress;
  //       if (data?.address) resolvedAddress = data.address;
  //     } catch {
  //       resolvedAddress = '';
  //     }
  //     setGpsLat(String(freshLat));
  //     setGpsLong(String(freshLong));
  //     setCurrentPosition({latitude: freshLat, longitude: freshLong});
  //     if (resolvedAddress) {
  //       setAddress(resolvedAddress);
  //       await Preferences.setData('LAST_GEO_ADDRESS', {
  //         address: resolvedAddress,
  //       });
  //       Common.showToast('GPS fetched successfully 🎯');
  //     } else {
  //       setAddress('');
  //       setLocationError('Address not found. Please enter manually.');
  //       Common.showToast('Coordinates captured. Enter address manually.');
  //     }
  //     // If photos already taken, clear them so user retakes with new watermark
  //     if (pic1 || pic2) {
  //       Alert.alert(
  //         'GPS Updated',
  //         'Please retake photos to update the watermark.',
  //         [{text: 'OK'}],
  //       );
  //       setPic1(null);
  //       setPic2(null);
  //     }
  //   } catch (e: any) {
  //     setLocationError(e?.message || 'Location error');
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };
  const fetchGPS = async () => {
    try {
      setIsLoading(true);
      setLocationError('');
      const hadPhotos = !!(pic1 || pic2);

      // Sab kuch clear karo taaki koi stale value na dikhe ya submit ho.
      // Photos par purana lat/long/address watermark hota hai, isliye wo bhi.
      setGpsLat('');
      setGpsLong('');
      setCurrentPosition(null);
      setAddress('');
      setIsAddressApproximate(false);
      setPic1(null);
      setPic2(null);

      let location;
      try {
        location = await fetchCurrentGpsLocation({
          targetAccuracy: 15,
          minimumSamples: 4,
          timeout: 45000,
        });
      } catch (error: any) {
        const message =
          error?.message || 'Accurate pit location could not be captured.';
        setLocationError(message);
        Alert.alert('Accurate GPS Not Available', message);
        return;
      }

      const {latitude, longitude, accuracy, samplesUsed} = location;

      console.log('Final pit GPS:', {
        latitude,
        longitude,
        accuracyInMeters: accuracy,
        samplesUsed,
      });

      // Exact lat/long as captured — address se kabhi change nahi hota.
      setGpsLat(String(latitude));
      setGpsLong(String(longitude));
      setCurrentPosition({
        latitude,
        longitude,
      });

      // Address only — exact point pehle, phir nearby points.
      const {address: resolvedAddress, isApproximate} =
        await getAddressWithNearbyFallback(latitude, longitude);

      setAddress(resolvedAddress);
      setIsAddressApproximate(isApproximate);

      if (resolvedAddress) {
        setErrors((e: any) => ({...e, address: false, gps: false}));
        await Preferences.setData('LAST_GEO_ADDRESS', {
          address: resolvedAddress,
          lat: latitude,
          long: longitude,
          accuracy,
        });
      } else {
        setLocationError(
          'Coordinates captured, but the address was not found. Enter it manually.',
        );
      }

      const accText = `${accuracy.toFixed(1)}m`;
      if (accuracy > 15) {
        Common.showToast(
          `GPS captured (${accText}). Accuracy is low — move to open sky and retry if needed.`,
        );
      } else {
        Common.showToast(`GPS captured (${accText})`);
      }

      if (hadPhotos) {
        Alert.alert(
          'GPS Updated',
          'Please retake photos to update the watermark.',
          [{text: 'OK'}],
        );
      }
    } catch (error: any) {
      const message = error?.message || 'Location error';

      setLocationError(message);
      Alert.alert('Location Error', message);
    } finally {
      setIsLoading(false);
    }
  };
  const handleGetPitGPS = async () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(10);
    let remaining = 10;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
        countdownRef.current = null;
        setCountdown(null);
        fetchGPS();
      }
    }, 1000);
  };
  const handleSubmit = async () => {
    if (!validateForm() || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const empId = await Preferences.getData('EMPLOYEE_ID');
      if (!empId) {
        Common.showToast('Employee ID not found.');
        return;
      }
      const activeVendorId = selectedVendor?.vendorId ?? '';
      const payload = {
        id: 0,
        employeeID: Number(empId),
        projectID: projectId,
        pitNo: Number(pitNo),
        pitLandmark: landmark ?? '',
        pitGPSLocation: address ?? '',
        lat: String(gpsLat),
        lng: String(gpsLong),
        vendorId: activeVendorId ? Number(activeVendorId) : 0,
        // pic1 and pic2 are {imageData: plainBase64, imageExtention: 'png'}
        // The slice's FormData appends them as text params — exactly like Java's
        // addMultipartParameter("Pic1.ImageData", CapturePhotoNP)
        pic1: pic1 ?? {imageData: '', imageExtention: ''},
        pic2: pic2 ?? {imageData: '', imageExtention: ''},
        distance:
          distanceBetweenPits != null ? Math.round(distanceBetweenPits) : 0,
        ...(nextPitNo && {nextPitId: Number(nextPitId)}),
        ...(distanceFromNextPit && {
          nextPitDistance: Math.round(distanceFromNextPit),
        }),
      };
      const result = await dispatch(insertUpdatePitLocationV2(payload));
      if (insertUpdatePitLocationV2.fulfilled.match(result)) {
        Common.showToast('PIT location saved successfully!');
        dispatch(getPitList({projectId}));
        navigation.goBack();
      } else {
        Alert.alert('Error', (result.payload as string) ?? 'Failed to save.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };
  const isCountingDown = countdown !== null;
  const hasPits = !!(pitList && pitList.length > 0);
  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <Screen
      statusBgColor={COLORS.BACKGROUND_DEFAULT}
      loading={isLoading || loading}
      preset={'fixed'}
      statusBarStyle={'dark'}>
      {/* Gallery Modal */}
      <Modal
        visible={galleryData !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setGalleryData(null)}>
        <TouchableWithoutFeedback onPress={() => setGalleryData(null)}>
          <View style={modalStyles.overlay}>
            <TouchableWithoutFeedback>
              <View style={modalStyles.modalContainer}>
                <View style={modalStyles.modalHeader}>
                  <Text style={modalStyles.modalTitle}>
                    {galleryData?.pitId ?? 'PIT Images'}
                  </Text>
                  <TouchableOpacity
                    hitSlop={{top: 10, right: 10, bottom: 10, left: 10}}
                    onPress={() => setGalleryData(null)}>
                    <Text style={modalStyles.closeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={modalStyles.scrollBody}>
                  {(['Image 1', 'Image 2'] as const).map((lbl, idx) => {
                    const url =
                      idx === 0 ? galleryData?.pic1Url : galleryData?.pic2Url;
                    return (
                      <View key={lbl} style={modalStyles.imgBlock}>
                        <Text style={modalStyles.imgLabel}>{lbl}</Text>
                        {url ? (
                          <Image
                            style={modalStyles.pitStyling}
                            source={{uri: url}}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={modalStyles.noImgBox}>
                            <Image
                              source={IMAGES.galleryIcon}
                              style={modalStyles.noImgIcon}
                              resizeMode="contain"
                            />
                            <Text style={modalStyles.noImgText}>
                              No image available
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity
                  onPress={() => setGalleryData(null)}
                  style={modalStyles.imageButton}>
                  <Text style={modalStyles.closeTxt}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      {/* Project Picker Modal */}
      <Modal
        visible={isProjectPickerVisible}
        animationType="slide"
        statusBarTranslucent={false}
        onRequestClose={handlePickerDismiss}>
        <ProjectListScreen
          projects={[]}
          selectedProjectId={selectedProject?.id ?? null}
          onSelect={project => {
            setSelectedProject(project);
            setIsProjectPickerVisible(false);
          }}
          onDismiss={handlePickerDismiss}
          onReload={handlePickerDismiss}
          onBack={handlePickerDismiss}
        />
      </Modal>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          <View style={styles.main}>
            {/* Header */}
            <View style={styles.header}>
              <Pressable
                style={styles.backBtn}
                onPress={() => navigation.goBack()}>
                <Image
                  style={styles.backIcon}
                  resizeMode="contain"
                  source={IMAGES.back}
                />
              </Pressable>
              <Text style={styles.pitLocationMaster}>PIT Location Master</Text>
              <View style={styles.rightPlaceholder} />
            </View>
            <View style={styles.holidaybody}>
              <View style={styles.holiday}>
                <View style={[styles.holidayitem, styles.ul2Layout]}>
                  <View style={styles.ul}>
                    {/* Project Name */}
                    <View style={styles.span}>
                      <Text
                        style={[styles.projectName, styles.projectNameTypo]}>
                        Project Name
                      </Text>
                      <Text style={styles.textTypo}> *</Text>
                    </View>
                    <TextInput
                      value={projectName}
                      editable={false}
                      pointerEvents="none"
                      style={[styles.txtInputStyle, xStyles.disabledInput]}
                    />

                    {/* Vendor Name */}
                    <View style={styles.span}>
                      <Text
                        style={[styles.projectName, styles.projectNameTypo]}>
                        Vendor Name
                      </Text>
                      <Text style={styles.textTypo}> *</Text>
                    </View>
                    {isMultiVendor ? (
                      <>
                        <VendorPicker
                          data={vendorList}
                          value={selectedVendor}
                          placeholder="Select Vendor"
                          onSelect={(item: VendorItem) => {
                            setSelectedVendor(item);
                            if (errors.vendor)
                              setErrors((e: any) => ({...e, vendor: false}));
                          }}
                          hasError={!!errors.vendor}
                        />
                        {errors.vendor && (
                          <Text style={xStyles.errorText}>
                            Please select a vendor
                          </Text>
                        )}
                      </>
                    ) : (
                      <View>
                        <TextInput
                          value={vendorList[0]?.vendorName ?? vendorName ?? ''}
                          editable={false}
                          pointerEvents="none"
                          style={[styles.txtInputStyle, xStyles.disabledInput]}
                        />
                        <Image style={styles.vectorIcon} resizeMode="cover" />
                      </View>
                    )}

                    {/* Distance Pills */}
                    {distanceBetweenPits != null && distanceBetweenPits > 0 && (
                      <View style={xStyles.distancePill}>
                        <Image
                          source={IMAGES.locationCheck}
                          style={xStyles.distanceIcon}
                          resizeMode="contain"
                        />
                        <Text style={xStyles.distancePillText}>
                          {distanceBetweenPits >= 1000
                            ? `${(distanceBetweenPits / 1000).toFixed(
                                1,
                              )} km from Previous Pit`
                            : `${Math.round(
                                distanceBetweenPits,
                              )} m from Previous Pit`}
                        </Text>
                      </View>
                    )}
                    {distanceFromNextPit != null && distanceFromNextPit > 0 && (
                      <View style={xStyles.distancePill}>
                        <Image
                          source={IMAGES.locationCheck}
                          style={xStyles.distanceIcon}
                          resizeMode="contain"
                        />
                        <Text style={xStyles.distancePillText}>
                          {distanceFromNextPit >= 1000
                            ? `${(distanceFromNextPit / 1000).toFixed(
                                1,
                              )} km from Next Pit`
                            : `${Math.round(
                                distanceFromNextPit,
                              )} m from Next Pit`}
                        </Text>
                      </View>
                    )}

                    {/* PIT Number */}
                    <View style={styles.span}>
                      <Text
                        style={[styles.projectName, styles.projectNameTypo]}>
                        PIT Number{' '}
                      </Text>
                      <Text style={styles.textTypo}> *</Text>
                    </View>
                    <View style={styles.add3}>
                      <TextInput
                        value={pitNo}
                        editable={false}
                        selectTextOnFocus={false}
                        placeholder="Enter PIT Number"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        style={[
                          styles.pitInput,
                          errors.pitNo && xStyles.inputError,
                        ]}
                      />
                      {/* <Pressable
                        style={[
                          styles.checkBtn,
                          isCheckingPitNo && xStyles.btnDisabled,
                        ]}
                        onPress={handleCheckAvailability}
                        disabled={isCheckingPitNo}>
                        <Text style={styles.checkBtnText}>
                          {isCheckingPitNo
                            ? 'Checking...'
                            : 'Check Availability'}
                        </Text>
                      </Pressable> */}
                    </View>
                    {errors.pitNo && (
                      <Text style={xStyles.errorText}>
                        PIT Number is required
                      </Text>
                    )}
                    {pitNoAvailable !== null &&
                      (pitNoAvailable ? (
                        <Text style={xStyles.availableText}>✓ Available</Text>
                      ) : (
                        <View style={xStyles.unavailableBadge}>
                          <Text style={xStyles.unavailableText}>
                            ✗ PIT Number already exists!
                          </Text>
                        </View>
                      ))}
                    {/* PIT GPS */}
                    <View style={styles.span4}>
                      <Text
                        style={[styles.pitLocationGps, styles.projectNameTypo]}>
                        PIT (GPS)
                      </Text>
                      <Text style={[styles.text4, styles.textTypo]}> *</Text>
                      {gpsLat && gpsLong && (
                        <Text style={xStyles.gpsCoords}>
                          {`Lat: ${gpsLat}°\nLong: ${gpsLong}°`}
                        </Text>
                      )}
                      <TouchableOpacity
                        style={[
                          styles.li2,
                          styles.liFlexBox,
                          isCountingDown && xStyles.btnDisabled,
                        ]}
                        onPress={handleGetPitGPS}
                        disabled={isCountingDown}>
                        <Text
                          style={[styles.checkAvailability, styles.submitClr]}>
                          {countdown !== null
                            ? `Fetching GPS... ${countdown}s`
                            : 'Get PIT GPS'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {errors.gps && (
                      <Text style={xStyles.errorText}>
                        GPS location is required
                      </Text>
                    )}

                    {/* Countdown bar */}
                    {isCountingDown && (
                      <View style={xStyles.countdownWrap}>
                        <View style={xStyles.countdownBarBg}>
                          <View
                            style={[
                              xStyles.countdownBarFill,
                              {
                                width: `${
                                  ((10 - (countdown ?? 0)) / 10) * 100
                                }%`,
                              },
                            ]}
                          />
                        </View>
                        <Text style={xStyles.countdownText}>
                          {`Getting GPS in ${countdown}s…`}
                        </Text>
                      </View>
                    )}

                    {/* Address */}
                    <View style={[styles.add4, styles.addBorder]}>
                      <TextInput
                        value={address}
                        onChangeText={text => {
                          setAddress(text);
                          if (errors.address)
                            setErrors((e: any) => ({...e, address: false}));
                        }}
                        placeholder="Address"
                        placeholderTextColor="#999"
                        multiline
                        style={[
                          styles.enterPitNumber,
                          styles.selectProjectTypo,
                          xStyles.addressInput,
                          errors.address && xStyles.inputError,
                        ]}
                      />
                    </View>
                    {locationError ? (
                      <Text style={xStyles.errorText}>{locationError}</Text>
                    ) : null}
                    {isAddressApproximate && !!address.trim() && (
                      <Text style={xStyles.nearbyAddressHint}>
                        No address at this exact point — showing nearest nearby
                        address. Lat/Long is unchanged.
                      </Text>
                    )}
                    {errors.address && !locationError && (
                      <Text style={xStyles.errorText}>Address is required</Text>
                    )}

                    {/* Landmark */}
                    <View style={styles.span}>
                      <Text
                        style={[styles.projectName, styles.projectNameTypo]}>
                        PIT Landmark
                      </Text>
                      <Text style={styles.textTypo}> *</Text>
                    </View>
                    <View style={[styles.add4, styles.addBorder]}>
                      <TextInput
                        value={landmark}
                        onChangeText={text => {
                          setLandmark(text);
                          if (errors.landmark)
                            setErrors((e: any) => ({...e, landmark: false}));
                        }}
                        placeholder="Enter PIT Landmark"
                        placeholderTextColor="#999"
                        multiline
                        style={[
                          styles.enterPitNumber,
                          styles.selectProjectTypo,
                          xStyles.addressInput,
                          errors.landmark && xStyles.inputError,
                        ]}
                      />
                    </View>
                    {errors.landmark && (
                      <Text style={xStyles.errorText}>
                        Landmark is required
                      </Text>
                    )}

                    {/* ══════════════════════════════════════════════════════
                        PIT Images — CaptureImageWatermark (same as AddInstallationFrom/To)
                        camera button + watermark burn + preview all inside the component
                    ══════════════════════════════════════════════════════ */}
                    <View style={styles.ul}>
                      <View style={styles.label}>
                        <View style={styles.span}>
                          <Text
                            style={[
                              styles.projectName,
                              styles.projectNameTypo,
                            ]}>
                            PIT Images
                          </Text>
                          <Text style={styles.textTypo}> *</Text>
                        </View>
                      </View>

                      {!hasGps ? (
                        <View style={xStyles.gpsWarningBanner}>
                          <Text style={xStyles.gpsWarningText}>
                            ⚠ Tap "Get PIT GPS" first and make sure the address
                            is filled — Lat, Long & Address will be permanently
                            burned onto both photos as a watermark.
                          </Text>
                        </View>
                      ) : (
                        <View style={xStyles.gpsReadyBanner}>
                          <Text style={xStyles.gpsReadyText}>
                            ✓ GPS ready — watermark will be burned into both
                            photos
                          </Text>
                        </View>
                      )}

                      {hasGps && (
                        <View style={styles.row}>
                          {/* ── Image 1 column ── */}
                          <View style={styles.col}>
                            <CaptureImageWatermark
                              title="Image 1"
                              pic={pic1}
                              setPic={result => {
                                setPic1(result);
                                if (result && errors.image1)
                                  setErrors((e: any) => ({
                                    ...e,
                                    image1: false,
                                  }));
                              }}
                              lat={gpsLat || ''} // ✅ DIRECT
                              long={gpsLong || ''} // ✅ DIRECT
                              address={address} // already fixed
                              hasError={!!errors.image1}
                            />
                            {errors.image1 && !pic1 && (
                              <Text style={xStyles.errorText}>Required</Text>
                            )}
                          </View>

                          {/* ── Image 2 column ── */}
                          <View style={styles.col}>
                            <CaptureImageWatermark
                              title="Image 2"
                              pic={pic2}
                              setPic={result => {
                                setPic2(result);
                                if (result && errors.image2)
                                  setErrors((e: any) => ({
                                    ...e,
                                    image2: false,
                                  }));
                              }}
                              lat={gpsLat || ''} // ✅ DIRECT
                              long={gpsLong || ''} // ✅ DIRECT
                              address={address} // already fixed
                              hasError={!!errors.image2}
                            />
                            {errors.image2 && !pic2 && (
                              <Text style={xStyles.errorText}>Required</Text>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Submit */}
                <TouchableOpacity
                  style={[
                    styles.li4,
                    styles.li4FlexBox,
                    isSubmitting && xStyles.btnDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}>
                  <Text style={[styles.submit, styles.submitClr]}>
                    {isSubmitting ? 'Submitting…' : 'Submit'}
                  </Text>
                </TouchableOpacity>

                {/* PIT Cards */}
                {hasPits && (
                  <View style={xStyles.pitListSection}>
                    <View style={xStyles.statsRow}>
                      <View style={xStyles.statBox}>
                        <Text style={xStyles.statLabel}>Total Distance:</Text>
                        <View style={xStyles.statValueBox}>
                          <Text style={xStyles.statValue}>
                            {totalRouteDistanceLabel}
                          </Text>
                        </View>
                      </View>
                      <View style={xStyles.statBox}>
                        <Text style={xStyles.statLabel}>
                          Total No. of Pits:
                        </Text>
                        <View style={xStyles.statValueBox}>
                          <Text style={xStyles.statValue}>
                            {pitList?.length ?? 0}
                          </Text>
                        </View>
                      </View>
                    </View>
                    {pitList.map((item: any, index: number) => {
                      const displayNo = displayPitNo(item?.pitNo ?? '');
                      const cardId = String(
                        item?.pitLocationId ?? item?.pitNo ?? index,
                      );
                      const nextItem =
                        index < pitList.length - 1 ? pitList[index + 1] : null;
                      const dist = nextItem
                        ? calcPitDistance(item, nextItem)
                        : null;
                      const distLabel =
                        dist !== null ? formatDistance(dist) : null;
                      return (
                        <React.Fragment key={cardId}>
                          <PitCard
                            pitId={`PIT - ${displayNo}`}
                            lat={`${item?.lat ?? '0'}°`}
                            long={`${item?.lng ?? '0'}°`}
                            landmark={item?.pitLandmark ?? '-'}
                            address={item?.pitGPSLocation ?? '-'}
                            pic1Url={item?.pic1Url ?? null}
                            pic2Url={item?.pic2Url ?? null}
                            onViewImages={() =>
                              setGalleryData({
                                pitId: `PIT - ${displayNo}`,
                                pic1Url: item?.pic1Url ?? null,
                                pic2Url: item?.pic2Url ?? null,
                              })
                            }
                          />
                          {index < pitList.length - 1 && (
                            <View style={xStyles.betweenRow}>
                              <Image
                                source={IMAGES.updownArrow}
                                style={xStyles.betweenArrow}
                                resizeMode="contain"
                              />
                              <Text style={xStyles.betweenText}>
                                {distLabel
                                  ? `Distance: ${distLabel}`
                                  : 'Distance: —'}
                              </Text>
                            </View>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </View>
                )}
                {!hasPits && pitList !== null && pitList !== undefined && (
                  <View style={xStyles.emptyWrap}>
                    <Image
                      source={IMAGES.noImage}
                      style={xStyles.emptyIcon}
                      resizeMode="contain"
                    />
                    <Text style={xStyles.emptyText}>No PITs added yet</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
};

export default PitInstallation;

// ─────────────────────────────────────────────────────────────────────────────
// VendorPicker styles
// ─────────────────────────────────────────────────────────────────────────────
const vendorPickerStyles = StyleSheet.create({
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E6EEF6',
    borderRadius: 6,
    paddingHorizontal: 12,
    height: 40,
    backgroundColor: '#F7F9FB',
    justifyContent: 'space-between',
  },
  inputBoxError: {borderColor: COLORS.ERROR ?? '#f44', borderWidth: 1.5},
  inputText: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.MEDIUM,
    color: '#2F4F4F',
  },
  placeholder: {color: '#999'},
  arrow: {fontSize: 12, color: '#888', marginLeft: 4},
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  item: {paddingHorizontal: 16, paddingVertical: 12},
  itemBorder: {borderBottomWidth: 1, borderBottomColor: '#eee'},
  itemSelected: {backgroundColor: '#EEF2FF'},
  itemName: {fontSize: 14, fontFamily: FONTS.MEDIUM, color: '#1a1a1a'},
  itemCode: {
    fontSize: 11,
    fontFamily: FONTS.REGULAR,
    color: '#5C6BC0',
    marginTop: 2,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Gallery / modal styles
// ─────────────────────────────────────────────────────────────────────────────
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: FONTS.SEMI_BOLD,
  },
  closeBtn: {fontSize: 20, color: '#666', paddingHorizontal: 4},
  scrollBody: {paddingTop: 12, paddingBottom: 8, gap: 18},
  imgBlock: {gap: 8},
  imgLabel: {fontSize: 13, fontFamily: FONTS.SEMI_BOLD, color: '#555'},
  pitStyling: {
    height: 210,
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#f2f2f2',
  },
  noImgBox: {
    height: 120,
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#fafafa',
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noImgIcon: {width: 28, height: 28, opacity: 0.3},
  noImgText: {fontSize: 13, color: '#aaa', fontFamily: FONTS.REGULAR},
  imageButton: {
    marginTop: 16,
    paddingVertical: 13,
    backgroundColor: '#535455',
    alignItems: 'center',
    borderRadius: 10,
  },
  closeTxt: {color: '#fff', fontFamily: FONTS.SEMI_BOLD, fontSize: 14},
});

// ─────────────────────────────────────────────────────────────────────────────
// PitCard styles
// ─────────────────────────────────────────────────────────────────────────────
const pitCardStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
    padding: Padding.padding_8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 3,
    gap: Gap.gap_4,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  header: {flexDirection: 'row', alignItems: 'center', gap: Gap.gap_4},
  badge: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: Border.br_5,
    paddingHorizontal: Padding.padding_5,
    paddingVertical: Padding.padding_2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: COLORS.colorWhite,
    fontSize: FontSize.fs_10,
    fontFamily: FONTS.REGULAR,
  },
  metaText: {
    fontSize: FontSize.fs_12,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
  },
  metaLabel: {fontFamily: FONTS.SEMI_BOLD},
  metaValue: {fontFamily: FONTS.REGULAR},
  address: {
    fontSize: FontSize.fs_11,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
    lineHeight: 15,
  },
  bottomRow: {flexDirection: 'row', alignItems: 'center'},
  latLongRow: {
    flex: 1,
    flexDirection: 'row',
    gap: Gap.gap_4,
    alignItems: 'center',
  },
  latLongText: {
    fontSize: FontSize.fs_10,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
    letterSpacing: LetterSpacing?.ls_0_2 ?? 0.2,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    position: 'relative',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  viewBtnDimmed: {opacity: 0.38},
  viewBtnText: {
    fontSize: FontSize.fs_10,
    color: COLORS.colorMediumslateblue ?? '#6C63FF',
    fontFamily: FONTS.MEDIUM,
    textDecorationLine: 'underline',
  },
  viewBtnTextDimmed: {
    color: COLORS.colorDarkslategray,
    textDecorationLine: 'none',
  },
  galleryIcon: {width: 17, height: 17},
  imgCountBadge: {
    position: 'absolute',
    top: -3,
    right: -2,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  imgCountText: {
    fontSize: 9,
    color: COLORS.colorWhite,
    fontFamily: FONTS.SEMI_BOLD,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// xStyles
// ─────────────────────────────────────────────────────────────────────────────
const xStyles = StyleSheet.create({
  disabledInput: {backgroundColor: '#f5f5f5', color: '#888'},
  inputError: {borderColor: COLORS.ERROR, borderWidth: 1},
  addressInput: {
    minHeight: 60,
    textAlignVertical: 'top',
    paddingTop: 8,
    color: '#1a1a1a',
  },
  gpsCoords: {
    fontSize: 12,
    color: COLORS.PRIMARY,
    fontFamily: FONTS.REGULAR,
    marginHorizontal: 6,
    flexShrink: 1,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.ERROR,
    marginTop: 2,
    marginBottom: 4,
    fontFamily: FONTS.REGULAR,
  },
  btnDisabled: {opacity: 0.6},
  nearbyAddressHint: {
    fontSize: 11,
    color: COLORS.colorSlategray ?? '#607D8B',
    fontFamily: FONTS.REGULAR,
    marginTop: 2,
    marginBottom: 4,
  },
  countdownWrap: {marginTop: 6, marginBottom: 2, gap: 4},
  countdownBarBg: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  countdownBarFill: {
    height: 4,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 4,
  },
  countdownText: {
    fontSize: 11,
    color: COLORS.PRIMARY,
    fontFamily: FONTS.REGULAR,
    textAlign: 'center',
    marginTop: 2,
  },
  availableText: {
    fontSize: 13,
    fontFamily: FONTS.SEMI_BOLD,
    color: '#2E7D32',
    marginTop: 4,
    marginBottom: 6,
  },
  unavailableBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFEBEE',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
    marginBottom: 6,
  },
  unavailableText: {fontSize: 12, fontFamily: FONTS.MEDIUM, color: '#C62828'},
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
    marginBottom: 8,
    gap: 4,
  },
  distanceIcon: {width: 12, height: 12, tintColor: '#2E7D32'},
  distancePillText: {fontSize: 11, color: '#2E7D32', fontFamily: FONTS.MEDIUM},
  pitListSection: {gap: 0},
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 3,
    gap: 10,
    marginBottom: 8,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  statBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Gap.gap_3,
    backgroundColor: COLORS.colorGray ?? '#f5f5f5',
    borderRadius: Border.br_6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  statLabel: {
    fontSize: SIZE.MS(12),
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
    flexShrink: 1,
  },
  statValueBox: {
    borderWidth: 1,
    borderColor: '#F7F6F6',
    borderRadius: Border.br_5,
    paddingHorizontal: Padding.padding_6,
    paddingVertical: 2,
    justifyContent: 'center',
    backgroundColor: COLORS.colorWhite,
  },
  statValue: {
    fontSize: 12,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
  },
  betweenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.colorGray ?? '#f5f5f5',
    borderRadius: Border.br_6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginVertical: 6,
  },
  betweenArrow: {width: 5, height: 11},
  betweenText: {
    fontSize: FontSize.fs_11,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
  },
  emptyWrap: {alignItems: 'center', paddingVertical: 20, gap: 8},
  emptyIcon: {width: 80, height: 80, opacity: 0.45},
  emptyText: {
    fontSize: 13,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
    opacity: 0.6,
  },
  gpsWarningBanner: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  gpsWarningText: {
    fontSize: 12,
    color: '#E65100',
    fontFamily: FONTS.REGULAR,
    lineHeight: 17,
  },
  gpsReadyBanner: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  gpsReadyText: {fontSize: 12, color: '#2E7D32', fontFamily: FONTS.MEDIUM},
});
