import {
  Image,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import React, {FC, useEffect, useRef, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {ScreenProps, DataType} from '@types';
import {Screen} from '@organisms';
import {Common, Location} from '@utils';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {
  Gap,
  FontSize,
  FontFamily,
  LetterSpacing,
  LineHeight,
  Border,
  Width,
  Height,
  Padding,
  BoxShadow,
  Opacity,
} from '../../res/globalStyle';
import CaptureImageWatermark, {
  BurnResult,
} from '../../components/molecules/capture-image-watermark';
import {fetchCurrentGpsLocation} from '../../components/molecules/LocationButton/gps';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  getListOfItemsChamberComplaintAPI,
  getAssignedChamberComplaintByIdAPI,
  insertUpdateAssignedChamberComplaintAPI,
} from '../../store/slices/maintenance.slice';
type ItemRow = {
  id: string;
  item: string;
  type: string;
  desc: string;
  received: string;
  checked: boolean;
  returnQty: string;
  ductColor: string;
};
type ImageSlotKey = 'inSide' | 'outSide' | 'left' | 'right';
type SubmitResultType = 'success' | 'error';
type SubmitResultState = {
  visible: boolean;
  type: SubmitResultType;
  message: string;
};
type InfoModalState = {
  visible: boolean;
  title: string;
  message: string;
};
const WORK_STATUS_OPTIONS = ['Update Work Status', 'Pending', 'Completed'];
const YES_NO_OPTIONS = ['Yes', 'No'];
const IMAGE_SLOTS: {key: ImageSlotKey; label: string}[] = [
  {key: 'inSide', label: 'In-Side Chamber'},
  {key: 'outSide', label: 'Out-Side Chamber'},
  {key: 'left', label: 'Left Side Image'},
  {key: 'right', label: 'Right Side Image'},
];
const FALLBACK_CHAMBER_IMAGE = IMAGES.chamberMaintenanceNew;
const parseSpecificationDesc = (specs: any): string => {
  if (specs === null || specs === undefined || specs === '') return '';
  if (typeof specs === 'string') {
    const trimmed = specs.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return parseSpecificationDesc(JSON.parse(trimmed));
      } catch {
        return specs;
      }
    }
    return specs;
  }
  if (Array.isArray(specs)) {
    const values = specs
      .map((entry: any) => {
        if (entry === null || entry === undefined) return null;
        if (typeof entry === 'string') return entry;
        return (
          entry?.LabelName ??
          entry?.labelName ??
          entry?.Value ??
          entry?.value ??
          null
        );
      })
      .filter(
        (v: any) => v !== null && v !== undefined && String(v).trim() !== '',
      );
    return values.length > 0 ? values.join(', ') : '-';
  }

  if (typeof specs === 'object') {
    return parseSpecificationDesc(specs?.Value ?? specs?.value ?? null);
  }

  return String(specs);
};

const getDuctColorValue = (item: any): string => {
  const value =
    item?.ductColor ??
    item?.DuctColor ??
    item?.duct_color ??
    item?.ductColour ??
    item?.DuctColour ??
    item?.ductColorName ??
    item?.DuctColorName ??
    item?.shotMapDuctColorName ??
    item?.ShotMapDuctColorName ??
    '';

  return value === null || value === undefined ? '' : String(value);
};

const mapApiItemToRow = (apiItem: any, index: number): ItemRow => ({
  // Index use kar rahe hain kyunki API me multiple rows ka `id` same aa raha hai (sab 3).
  // Same id hone se ek checkbox tick karne par saari rows tick ho jaati thi.
  id: String(index),
  item: apiItem?.productName ?? apiItem?.item ?? '',
  type: apiItem?.modelCode ?? apiItem?.modelName ?? apiItem?.type ?? '',
  desc:
    parseSpecificationDesc(apiItem?.specifications) ||
    apiItem?.desc ||
    apiItem?.description ||
    '-',
  received: String(
    apiItem?.receivedQuantity ?? apiItem?.quantity ?? apiItem?.received ?? '',
  ),
  checked: false,
  returnQty: '',
  ductColor: getDuctColorValue(apiItem),
});
const extractItemsFromResponse = (res: any): any[] => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.data?.items)) return res.data.items;
  return [];
};
// ── Normalizes the getAssignedChamberComplaintByIdAPI response into a
// single chamber-detail record. API returns { success, status, message,
// data: [ {...} ] } — a 1-item array keyed by id — but tolerate a bare
// object or an already-unwrapped array too.
const extractChamberDetail = (res: any): any | null => {
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload[0] ?? null;
  if (payload && typeof payload === 'object') return payload;
  return null;
};
// Server Windows-style paths bhejta hai (backslash + spaces). Valid URL banao.
const normalizeImageUrl = (url: any): string => {
  if (!url || typeof url !== 'string') return '';
  return encodeURI(url.trim().replace(/\\/g, '/'));
};
const getErrorMessage = (err: any, fallback: string): string => {
  if (typeof err === 'string' && err.trim()) return err;
  return err?.message ?? err?.payload?.message ?? fallback;
};

// ── Builds the file part for one image slot in the multipart request.
// Returns null when that slot has no captured image yet, so callers can
// skip appending it (the API only expects the slots that were actually
// filled in).
const toFormDataFile = (asset: BurnResult | null, fallbackName: string) => {
  if (!asset?.uri) return null;
  const ext = asset.imageExtention || 'jpg';
  return {
    uri: asset.uri,
    name: (asset as any).fileName || `${fallbackName}.${ext}`,
    type: (asset as any).mimeType || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  } as any;
};

const MaintenanceDetailScreen: FC<ScreenProps.MaintenanceDetailScreen> = ({
  navigation,
  route,
}) => {
  const {
    id,
    chamberId,
    chamberName,
    complaintNo,
    ptCode,
    routeId,
    routeName,
    typeOfWork,
    status,
    zone,
    address,
    landmark,
    lat,
    long,
    distanceM,
    outOfRange,
    chamber,
    assignTaskId,
  } = route.params as typeof route.params & {assignTaskId?: number | string};
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const employeeId = useSelector((state: any) => state?.auth?.employeeId);
  const companyCode = useSelector((state: any) => state?.auth?.companyCode);
  const [workStatus, setWorkStatus] = useState<string>('');
  const [reasonOfPending, setReasonOfPending] = useState('');
  const [returnItems, setReturnItems] = useState<string>('');
  const [items, setItems] = useState<ItemRow[]>([]);
  const [rawItems, setRawItems] = useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const itemsFetchedRef = useRef(false);
  const [images, setImages] = useState<Record<ImageSlotKey, BurnResult | null>>(
    {
      inSide: null,
      outSide: null,
      left: null,
      right: null,
    },
  );
  const [remark, setRemark] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState<'work' | 'return' | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  // ── Live GPS capture (same flow as PitInstallation "Get PIT GPS") ──
  // gpsLat / gpsLong / gpsAddress feed the CaptureImageWatermark so the
  // photos get Lat, Long and Address burned in.
  const [gpsLat, setGpsLat] = useState<string>('');
  const [gpsLong, setGpsLong] = useState<string>('');
  const [gpsAddress, setGpsAddress] = useState<string>('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCountingDown = countdown !== null;

  useEffect(
    () => () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    },
    [],
  );

  // ── Chamber detail fetched from getAssignedChamberComplaintByIdAPI on
  // mount. Drives the header card (name/address/lat-long/status), the
  // chamber + follow-up image grids, and the employeeId/companyCode/
  // assignTaskId/chamberId used when submitting — with route.params as
  // fallback until (or if) the fetch resolves.
  const [chamberDetail, setChamberDetail] = useState<any>(null);
  const [chamberDetailLoading, setChamberDetailLoading] = useState(false);
  // ── Submit result modal — shown instead of Alert.alert for the outcome of
  // insertUpdateAssignedChamberComplaintAPI. Blue card on success, red card
  // on any error (API rejection, network failure, etc).
  const [resultModal, setResultModal] = useState<SubmitResultState>({
    visible: false,
    type: 'success',
    message: '',
  });
  const closeResultModal = () => {
    const wasSuccess = resultModal.type === 'success';
    setResultModal(prev => ({...prev, visible: false}));
    if (wasSuccess) {
      navigation.goBack();
    }
  };
  // ── Information modal — Alert.alert ki jagah (Invalid Return Quantity /
  // Missing Information). Blue "!" icon + title + message + Ok button.
  const [infoModal, setInfoModal] = useState<InfoModalState>({
    visible: false,
    title: 'Information',
    message: '',
  });
  const showInfoModal = (title: string, message: string) =>
    setInfoModal({visible: true, title, message});
  const closeInfoModal = () =>
    setInfoModal(prev => ({...prev, visible: false}));
  const [started, setStarted] = useState(false);
  const handleStartWorking = () => setStarted(true);
  const [showChamberImages, setShowChamberImages] = useState(false);

  // ---- Fetch chamber complaint detail by id on page load ----
  useEffect(() => {
    const targetId = id ?? complaintNo;
    if (!targetId) return;
    let isActive = true;
    setChamberDetailLoading(true);
    dispatch(getAssignedChamberComplaintByIdAPI(targetId))
      .unwrap()
      .then((res: any) => {
        if (!isActive) return;
        setChamberDetail(extractChamberDetail(res));
      })
      .catch((err: any) => {
        if (!isActive) return;
        console.log('Get Assigned Chamber Complaint By Id Error =>', err);
        Alert.alert(
          'Error',
          getErrorMessage(err, 'Failed to load chamber complaint details.'),
        );
      })
      .finally(() => {
        if (isActive) setChamberDetailLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [id, complaintNo, dispatch]);
  console.log('chamberDetail', {chamberDetail});
  // ---- Display values: chamberDetail (API) first, route.params as fallback ----
  const displayComplaintNo = chamberDetail?.complaintNo ?? complaintNo;
  const displayChamberName = chamberDetail?.chamberName ?? chamberName;
  const displayRouteName = chamberDetail?.routeName ?? routeName;
  const displayRouteId = chamberDetail?.routeId ?? routeId ?? chamber?.routeId;
  const displayAddress =
    chamberDetail?.chamberAddress ?? address ?? chamber?.address;
  const displayLandmark = chamberDetail?.landmark ?? landmark;
  const displayZone = chamberDetail?.zone ?? zone;
  const displayTypeOfWork = chamberDetail?.typeOfWork ?? typeOfWork;
  const displayStatus = chamberDetail?.status ?? status;
  const displayLat = chamberDetail?.chamberLat ?? lat ?? chamber?.lat;
  const displayLong = chamberDetail?.chamberLong ?? long ?? chamber?.long;
  const displayChamberId = chamberDetail?.fromChamberId;
  const displayChamberId2 = chamberDetail?.chamberId;
  const displayAssignTaskId =
    chamberDetail?.assignTaskId ?? assignTaskId ?? chamber?.assignTaskId;
  // employeeId/companyCode from the API response take priority over the
  // redux auth slice, which is only a fallback if the fetch hasn't resolved.
  const apiEmployeeId = chamberDetail?.empId;
  const apiCompanyCode = chamberDetail?.companyCode;

  // "Before" chamber images — API's imageUrls, falling back to whatever the
  // list screen already passed in chamber.images.
  const chamberImages: string[] = (
    Array.isArray(chamberDetail?.imageUrls) &&
    chamberDetail.imageUrls.length > 0
      ? chamberDetail.imageUrls
      : Array.isArray(chamber?.images) && chamber.images.length > 0
      ? chamber.images
      : []
  )
    .map(normalizeImageUrl)
    .filter(Boolean);

  const followUpImages: string[] = (
    Array.isArray(chamberDetail?.followUpImageUrls)
      ? chamberDetail.followUpImageUrls
      : []
  )
    .map(normalizeImageUrl)
    .filter(Boolean);
  // ASSIGNED → imageUrls, otherwise → followUpImageUrls
  const isAssigned =
    String(displayStatus ?? '')
      .trim()
      .toLowerCase() === 'assigned';
  const imagesToShow: string[] = isAssigned ? chamberImages : followUpImages;
  const isUpdateStatus = workStatus === 'Update Work Status';
  const isPending = workStatus === 'Pending';
  const isCompleted = workStatus === 'Completed';
  const showItemSummaryAndRemarkOnCompleted =
    isCompleted && returnItems === 'Yes';
  const showRemark =
    isUpdateStatus || isPending || showItemSummaryAndRemarkOnCompleted;
  const showImageUpload = isUpdateStatus || isPending || isCompleted;
  useEffect(() => {
    if (!showItemSummaryAndRemarkOnCompleted) return;
    if (itemsFetchedRef.current) return;
    const targetComplaintId = id ?? complaintNo;
    if (!targetComplaintId) return;
    let isActive = true;
    itemsFetchedRef.current = true;
    setItemsLoading(true);
    dispatch(getListOfItemsChamberComplaintAPI(targetComplaintId))
      .unwrap()
      .then((res: any) => {
        if (!isActive) return;
        const fetchedRawItems = extractItemsFromResponse(res);
        setRawItems(fetchedRawItems);
        setItems(fetchedRawItems.map(mapApiItemToRow));
      })
      .catch((err: any) => {
        if (!isActive) return;
        itemsFetchedRef.current = false; // allow retry on next "Yes" selection
        Alert.alert('Error', getErrorMessage(err, 'Failed to load item list.'));
      })
      .finally(() => {
        if (isActive) setItemsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [showItemSummaryAndRemarkOnCompleted, id, complaintNo, dispatch]);
  const openDropdown = (which: 'work' | 'return') => setDropdownOpen(which);
  const closeDropdown = () => setDropdownOpen(null);
  const selectDropdownValue = (value: string) => {
    if (dropdownOpen === 'work') {
      setWorkStatus(value);
      if (value !== 'Pending') setReasonOfPending('');
      if (value !== 'Completed') setReturnItems('');
    } else if (dropdownOpen === 'return') {
      setReturnItems(value);
      if (value !== 'Yes' && items.length === 0) {
        itemsFetchedRef.current = false;
      }
    }
    closeDropdown();
  };
  const toggleItemChecked = (rowId: string) => {
    setItems(prev =>
      prev.map(row => {
        if (row.id !== rowId) {
          return row;
        }
        const newChecked = !row.checked;
        return {
          ...row,
          checked: newChecked,
          // Selected item must explicitly receive a Return Qty
          returnQty: newChecked ? '' : '',
        };
      }),
    );
  };
  const allChecked = items.length > 0 && items.every(row => row.checked);
  const someChecked = items.some(row => row.checked) && !allChecked;
  const checkedCount = items.filter(row => row.checked).length;
  // Header "Select All" — ek click par saari rows check ho jaati hain,
  // dobara click par saari uncheck (aur unki Return Qty clear).
  const toggleSelectAll = () => {
    const next = !allChecked;
    setItems(prev =>
      prev.map(row => ({
        ...row,
        checked: next,
        // Unselect par qty clear, select par user ki purani qty bachi rahe
        returnQty: next ? row.returnQty : '',
      })),
    );
  };
  const updateReturnQty = (rowId: string, value: string) => {
    // Only allow whole numbers
    const numericValue = value.replace(/[^0-9]/g, '');
    const currentRow = items.find(row => row.id === rowId);
    if (!currentRow) return;
    const receivedQty = Number(currentRow.received);
    // Allow clearing the input
    if (numericValue === '') {
      setItems(prev =>
        prev.map(row => (row.id === rowId ? {...row, returnQty: ''} : row)),
      );
      return;
    }

    const qty = Number(numericValue);

    // Don't allow 0
    if (qty <= 0) {
      setItems(prev =>
        prev.map(row => (row.id === rowId ? {...row, returnQty: ''} : row)),
      );
      return;
    }

    // If Return Qty exceeds Received Qty, show alert
    // and keep the previous valid quantity unchanged.
    if (Number.isFinite(receivedQty) && receivedQty >= 0 && qty > receivedQty) {
      showInfoModal(
        'Invalid Return Quantity',
        `Return Qty. cannot be more than Received Qty. (${receivedQty})`,
      );
      return;
    }

    // Update only when the entered quantity is valid
    setItems(prev =>
      prev.map(row =>
        row.id === rowId ? {...row, returnQty: numericValue} : row,
      ),
    );
  };

  // ---- Image slot setter — passed to each CaptureImageWatermark instance ----
  const setImageForSlot =
    (slot: ImageSlotKey) => (result: BurnResult | null) => {
      setImages(prev => ({...prev, [slot]: result}));
    };

  // ---- Fresh GPS (same approach as PitInstallation.fetchGPS) ----
  const fetchGPS = async () => {
    try {
      setGpsLoading(true);
      setGpsError('');
      let location;
      try {
        location = await fetchCurrentGpsLocation({
          requiredAccuracy: 30,
          minimumSamples: 5,
          timeout: 60000,
        });
      } catch (error: any) {
        const message =
          error?.message || 'Accurate location could not be captured.';
        setGpsError(message);
        Alert.alert('Accurate GPS Not Available', message);
        return;
      }

      const {latitude, longitude, accuracy, samplesUsed} = location;

      console.log('Final maintenance GPS:', {
        latitude,
        longitude,
        accuracyInMeters: accuracy,
        samplesUsed,
      });

      setGpsLat(String(latitude));
      setGpsLong(String(longitude));

      let resolvedAddress = '';
      try {
        const data = (await Location.getAddressFromLatLong({
          lat: latitude,
          lng: longitude,
          isOla: false,
        })) as DataType.GeoAddress;
        resolvedAddress = data?.address?.trim() || '';
      } catch (error) {
        console.log('Reverse-geocoding failed:', error);
      }

      if (resolvedAddress) {
        setGpsAddress(resolvedAddress);
        Common.showToast(`GPS captured: ${accuracy.toFixed(1)}m accuracy 🎯`);
      } else {
        setGpsAddress('');
        setGpsError(
          'Coordinates captured, but the address was not found. Enter it manually.',
        );
        Common.showToast(
          `Coordinates captured: ${accuracy.toFixed(1)}m accuracy`,
        );
      }

      // Already-captured photos carry the OLD watermark — force a retake.
      const hasAnyImage = Object.values(images).some(img => !!img);
      if (hasAnyImage) {
        showInfoModal(
          'GPS Updated',
          'Please retake photos to update the watermark.',
        );
        setImages({inSide: null, outSide: null, left: null, right: null});
      }
    } catch (error: any) {
      const message = error?.message || 'Location error';
      setGpsError(message);
      Alert.alert('Location Error', message);
    } finally {
      setGpsLoading(false);
    }
  };

  const handleGetGPS = async () => {
    const perm = await Location.checkPermission();
    if (perm !== 'granted') {
      Alert.alert('Permission Required', 'Location permission is required.');
      return;
    }
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
  const handleOpenGoogleMaps = async () => {
    const latitude = Number(displayLat);
    const longitude = Number(displayLong);

    if (
      displayLat == null ||
      displayLong == null ||
      String(displayLat).trim() === '' ||
      String(displayLong).trim() === '' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      Alert.alert(
        'Location Unavailable',
        'Valid chamber coordinates are not available.',
      );
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Unable to open Google Maps.');
    }
  };
  const validate = (): string | null => {
    // ============================================================
    // WORK STATUS
    // ============================================================
    if (!workStatus) {
      return 'Please select Work Status';
    }

    // ============================================================
    // PENDING VALIDATION
    // ============================================================
    if (workStatus === 'Pending' && !reasonOfPending.trim()) {
      return 'Please enter Reason of Pending';
    }

    // ============================================================
    // COMPLETED → RETURN ITEMS
    // ============================================================
    if (workStatus === 'Completed' && !returnItems) {
      return 'Please select Return Items';
    }

    // ============================================================
    // COMPLETED + RETURN ITEMS = YES
    // ============================================================
    if (workStatus === 'Completed' && returnItems === 'Yes') {
      // Item API still loading
      if (itemsLoading) {
        return 'Item list is still loading. Please wait.';
      }

      // At least one item must be selected
      const checkedRows = items.filter(row => row.checked);

      if (checkedRows.length === 0) {
        return 'Please select at least one item to return';
      }

      // Validate every selected item
      for (const row of checkedRows) {
        const label = row.item || 'the selected item';

        // ----------------------------------------------------------
        // 1. Return Qty cannot be empty
        // ----------------------------------------------------------
        if (!row.returnQty || !row.returnQty.trim()) {
          return `Please enter Return Qty. for ${label}`;
        }

        const returnQtyText = row.returnQty.trim();

        // ----------------------------------------------------------
        // 2. Only positive whole numbers are allowed
        //    Examples:
        //    1   ✅
        //    2   ✅
        //    0   ❌
        //    -1  ❌
        //    1.5 ❌
        // ----------------------------------------------------------
        if (!/^[1-9]\d*$/.test(returnQtyText)) {
          return `Return Qty. for ${label} must be a whole number greater than 0`;
        }

        const qty = Number(returnQtyText);

        // ----------------------------------------------------------
        // 3. Make sure quantity is a valid number
        // ----------------------------------------------------------
        if (!Number.isSafeInteger(qty) || qty <= 0) {
          return `Please enter a valid Return Qty. for ${label}`;
        }

        // ----------------------------------------------------------
        // 4. Received quantity must be valid
        // ----------------------------------------------------------
        const receivedNum = Number(row.received);

        if (!Number.isFinite(receivedNum) || receivedNum <= 0) {
          return `Received Qty. is invalid for ${label}`;
        }

        // ----------------------------------------------------------
        // 5. Return Qty cannot be greater than Received Qty
        // ----------------------------------------------------------
        if (qty > receivedNum) {
          return `Return Qty. for ${label} can't be more than Received (${row.received})`;
        }
      }
    }

    // ============================================================
    // IMAGE VALIDATION
    // All 4 images are mandatory whenever image section is visible
    // ============================================================
    if (showImageUpload) {
      const missingImages = IMAGE_SLOTS.filter(
        ({key}) => !images[key]?.uri,
      ).map(({label}) => label);

      if (missingImages.length === IMAGE_SLOTS.length) {
        return 'Please capture all 4 images';
      }

      if (missingImages.length > 0) {
        return `Please capture the following image(s):\n• ${missingImages.join(
          '\n• ',
        )}`;
      }
    }

    // ============================================================
    // REMARK VALIDATION
    // ============================================================
    if (showRemark && !remark.trim()) {
      return 'Please enter Remark';
    }

    // ============================================================
    // EVERYTHING VALID
    // ============================================================
    return null;
  };

  // ---- Build the Items[] payload (checked rows only) ----
  const buildItemsPayload = () => {
    if (!showItemSummaryAndRemarkOnCompleted) {
      return [];
    }

    return items.reduce((acc: any[], row, idx) => {
      if (!row.checked) {
        return acc;
      }

      const rawItem = rawItems[idx] ?? {};

      acc.push({
        id: Number(rawItem?.id ?? row.id ?? 0),

        inventoryOutId: Number(rawItem?.inventoryOutId ?? 0),

        categoryId: Number(rawItem?.categoryId ?? 0),

        brandId: Number(rawItem?.brandId ?? 0),

        productId: Number(rawItem?.productId ?? 0),

        modelId: Number(rawItem?.modelId ?? 0),

        specifications: rawItem?.specifications ?? '',

        quantity: Number(rawItem?.quantity ?? 0),

        ductColor: getDuctColorValue(rawItem),

        productName: rawItem?.productName ?? row.item ?? '',

        modelName: rawItem?.modelName ?? row.type ?? '',

        modelCode: rawItem?.modelCode ?? '',

        isReceived: Boolean(rawItem?.isReceived ?? true),

        isReceivedWithDispute: Boolean(rawItem?.isReceivedWithDispute ?? false),

        disputeReason: rawItem?.disputeReason ?? '',

        storeId: Number(rawItem?.storeId ?? 0),

        receivedQuantity: Number(
          row.returnQty ?? rawItem?.receivedQuantity ?? 0,
        ),

        requestItemId: Number(rawItem?.requestItemId ?? 0),

        ticketId: rawItem?.ticketId ?? '',

        tagNo: rawItem?.tagNo ?? '',

        tagId: Number(rawItem?.tagId ?? 0),

        tagRvr: Number(rawItem?.tagRvr ?? 0),
      });

      return acc;
    }, []);
  };
  // ---- Build the request payload handed to the thunk ----
  // The thunk turns this into the multipart/form-data body (dot-notation
  // fields + one array field per image side).
  const buildRequestPayload = () => {
    const complaintId = Number(chamberDetail?.id ?? id ?? complaintNo ?? 0);
    const finalChamberId = Number(displayChamberId ?? 0);
    // Captured GPS (Get GPS button) takes priority, so the submitted
    // lat/long matches the watermark. Falls back to the chamber's lat/long.
    const finalLat = String(gpsLat || displayLat || '');

    const finalLong = String(gpsLong || displayLong || '');

    const finalGpsLocation =
      finalLat && finalLong ? `${finalLat},${finalLong}` : '';

    const finalAssignTaskId = Number(displayAssignTaskId ?? 0);

    return {
      complaintFollowUp: {
        complaintId,

        chamberId: finalChamberId,

        chamberIdStr: String(finalChamberId),

        isIssueFound: false,

        issueCategory: 0,

        issueId: 0,

        lat: finalLat,

        lng: finalLong,

        gpsLocation: finalGpsLocation,

        remark: showRemark ? remark.trim() : '',

        // Prefer empId from the getAssignedChamberComplaintByIdAPI response,
        // fall back to the redux auth slice. EmployeeId is also re-resolved
        // from Preferences inside the thunk as a last-resort safety net.
        employeeId: apiEmployeeId ?? employeeId ?? 0,

        companyCode: apiCompanyCode || companyCode || 'GTPL',

        createdOn: new Date().toISOString(),

        isOffline: false,

        // IMPORTANT:
        // Send image objects to thunk.
        // Do NOT convert them to FormData here.
        complaintFollowImage: [
          {
            slot: 'inSide',
            ...(images.inSide ?? {}),
          },
          {
            slot: 'outSide',
            ...(images.outSide ?? {}),
          },
          {
            slot: 'left',
            ...(images.left ?? {}),
          },
          {
            slot: 'right',
            ...(images.right ?? {}),
          },
        ].filter((image: any) => !!image?.uri),
      },

      updateStatus: {
        complaintId,
        employeeId: apiEmployeeId ?? employeeId ?? 0,
        workStatus: workStatus ?? '',
        reasonOfPending: isPending ? reasonOfPending : '',
        remark: showRemark ? remark.trim() : '',
        returnItems: isCompleted ? returnItems : '',
        assignTaskId: finalAssignTaskId,
      },

      items: buildItemsPayload(),
    };
  };

  const handleSubmit = async () => {
    if (isSubmittingRef.current) {
      return;
    }
    const error = validate();
    if (error) {
      showInfoModal('Missing Information', error);
      return;
    }
    isSubmittingRef.current = true;
    setSubmitting(true);
    try {
      // IMPORTANT:
      // This is a normal JS object, NOT FormData.
      const body = buildRequestPayload();
      console.log('========== SCREEN REQUEST BODY ==========');
      console.log('Complaint Follow Up =>', body.complaintFollowUp);
      console.log('Update Status =>', body.updateStatus);
      console.log('Items =>', body.items);
      console.log('Images =>', body.complaintFollowUp.complaintFollowImage);
      await dispatch(insertUpdateAssignedChamberComplaintAPI(body)).unwrap();
      setResultModal({
        visible: true,
        type: 'success',
        message: 'Chamber maintenance details have been saved successfully.',
      });
    } catch (e: any) {
      console.log('Submit Assigned Chamber Complaint Error =>', e);

      setResultModal({
        visible: true,
        type: 'error',
        message: getErrorMessage(
          e,
          "We couldn't submit the chamber maintenance details. Please try again.",
        ),
      });
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };
  const dropdownOptions =
    dropdownOpen === 'work' ? WORK_STATUS_OPTIONS : YES_NO_OPTIONS;

  return (
    <Screen statusBarStyle="dark-content" statusBgColor={COLORS.PRIMARY}>
      <View style={styles.body}>
        <View style={[styles.header, {paddingTop: insets.top + 12}]}>
          <TouchableOpacity
            onPress={() => navigation?.goBack?.()}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            style={styles.backBtn}>
            <Image
              style={styles.backIcon}
              resizeMode="contain"
              source={IMAGES.arrowBack}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Chamber Maintenance
          </Text>
          <View style={styles.headerRightSpacer} />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}>
          <View style={[styles.inner, styles.ulFlexBox]}>
            <View style={[styles.li, styles.liFlexBox]}>
              <View
                style={[
                  styles.li2,
                  {
                    backgroundColor: COLORS.WHITE,
                    paddingBottom: SIZE.MVS(10),
                    paddingHorizontal: SIZE.MVS(10),
                    marginTop: SIZE.MVS(10),
                    borderRadius: SIZE.MVS(10),
                    elevation: 3,
                  },
                ]}>
                {chamberDetailLoading && !chamberDetail && (
                  <ActivityIndicator
                    style={{alignSelf: 'center', marginVertical: 12}}
                    color={COLORS.PRIMARY}
                  />
                )}
                <View style={styles.rowalign}>
                  <View style={styles.chamberIconContainer}>
                    <Image
                      style={styles.chamberIcon}
                      resizeMode="contain"
                      source={IMAGES.chamberMaintenanceNew}
                    />
                  </View>
                  <View style={styles.chamberInfoContainer}>
                    <View style={styles.topInfoRow}>
                      <Text style={styles.chamberNumberText}>
                        {displayComplaintNo}
                      </Text>
                      <Text style={styles.zoneText}>Zone: {displayZone}</Text>
                      <View style={styles.pendingContainer}>
                        <Text
                          style={[
                            styles.statusTxt,
                            {
                              backgroundColor:
                                displayStatus?.toLowerCase() === 'completed'
                                  ? COLORS.SUCCESS
                                  : COLORS.WARNING,
                            },
                          ]}
                          numberOfLines={1}>
                          {displayStatus
                            ? displayStatus.charAt(0).toUpperCase() +
                              displayStatus.slice(1).toLowerCase()
                            : ''}
                        </Text>
                      </View>
                    </View>
                    {/* Second row */}
                    <View style={styles.pt015084Parent}>
                      <Text
                        style={{
                          color: COLORS.BLACK,
                          fontSize: SIZE.MS(14),
                          fontFamily: FONTS.SEMI_BOLD,
                        }}>
                        Task Type:
                      </Text>
                      <Text style={[styles.needChamberRcc]}>
                        {displayTypeOfWork}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.col}>
                  <Text style={[styles.landmarkLabel, styles.addressTypo]}>
                    Route:{' '}
                    <Text>
                      {displayRouteId || '—'} ({displayRouteName || '—'})
                    </Text>
                  </Text>
                  <Text style={[styles.landmarkLabel, styles.addressTypo]}>
                    Chamber:{' '}
                    <Text>
                      {displayChamberId2 || '—'} ({displayChamberName || '—'})
                    </Text>
                  </Text>
                  <Text style={styles.fullAddress}>
                    <Text style={styles.addressTypo}>Chamber Address:</Text>
                    <Text style={styles.addressValue}> {displayAddress}</Text>
                  </Text>
                  <View style={[styles.latlong, styles.col2FlexBox]}>
                    <View style={[styles.col2, styles.col2FlexBox]}>
                      <View style={styles.col2FlexBox}>
                        <Text
                          style={[
                            styles.nearbyLatitudeLabel,
                            styles.tableItemClr,
                          ]}>
                          Lat:
                        </Text>
                        <Text
                          style={[
                            styles.nearbyLatitudeLabel,
                            styles.tableItemClr,
                          ]}>
                          {displayLat}°
                        </Text>
                      </View>
                      <View style={styles.col2FlexBox}>
                        <Text
                          style={[
                            styles.nearbyLatitudeLabel,
                            styles.tableItemClr,
                          ]}>
                          Long:
                        </Text>
                        <Text
                          style={[
                            styles.nearbyLatitudeLabel,
                            styles.tableItemClr,
                          ]}>
                          {displayLong}°
                        </Text>
                      </View>
                    </View>
                    {/* ── View Images — toggles the inline Chamber Images grid
                        below, instead of navigating away. ── */}
                    <TouchableOpacity
                      style={styles.col2FlexBox}
                      onPress={() => setShowChamberImages(prev => !prev)}>
                      <Text style={[styles.text2, styles.tableItemClr]}>
                        View Images
                      </Text>
                      <Image
                        style={styles.imgIcon}
                        resizeMode="contain"
                        source={IMAGES.galleryIcon}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleOpenGoogleMaps}
                      activeOpacity={0.7}
                      hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                      accessibilityRole="button"
                      accessibilityLabel="Open chamber location in Google Maps">
                      <Image
                        style={{height: 20, width: 20, resizeMode: 'contain'}}
                        source={IMAGES.GoogleMapsIcon}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ── Inline Chamber Images — 2x2 grid, shown/hidden by the
                    toggle above. Sourced from the getAssignedChamberComplaintByIdAPI
                    response (imageUrls), falling back to a placeholder icon
                    per cell when a slot has no image. ── */}
                {showChamberImages && (
                  <View style={styles.chamberImagesSection}>
                    <Text style={styles.chamberImagesTitle}>
                      {isAssigned ? 'Chamber Images' : 'Follow-Up Images'}
                    </Text>
                    {imagesToShow.length > 0 ? (
                      <View style={styles.chamberImagesGrid}>
                        {imagesToShow.map((uri, idx) => (
                          <View
                            key={`img-${idx}`}
                            style={styles.chamberImageCell}>
                            <Image
                              source={{uri}}
                              style={styles.chamberImageThumb}
                              resizeMode="cover"
                            />
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.chamberImagesEmpty}>
                        No images available.
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </View>

            {started && (
              <View style={styles.formBody}>
                <View style={styles.formCard}>
                  <View style={styles.form}>
                    <View style={[styles.ul, styles.ulFlexBox]}>
                      {/* Work Status — always visible, drives everything below */}
                      <View style={styles.formCard}>
                        <View style={styles.col3}>
                          <View style={styles.workStatusContainer}>
                            <View style={styles.span2}>
                              <Text
                                style={[
                                  styles.workStatusLabel,
                                  styles.workStatusLabelTypo,
                                ]}>
                                Work Status
                              </Text>
                              <Text
                                style={[
                                  styles.requiredIndicator,
                                  styles.workStatusLabelTypo,
                                ]}>
                                {' '}
                                *
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.add}
                              onPress={() => openDropdown('work')}>
                              <Text
                                style={[
                                  styles.workStatusValueTypo,
                                  !workStatus && styles.placeholderText,
                                ]}>
                                {workStatus || 'Work Status'}
                              </Text>
                              <View style={styles.dropdownChevron} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>

                      {/* Reason of Pending — only when Pending */}
                      {isPending && (
                        <View style={styles.span3}>
                          <View style={styles.span2}>
                            <Text
                              style={[
                                styles.workStatusLabel,
                                styles.workStatusLabelTypo,
                              ]}>
                              Reason of Pending
                            </Text>
                            <Text
                              style={[
                                styles.requiredIndicator,
                                styles.workStatusLabelTypo,
                              ]}>
                              {' '}
                              *
                            </Text>
                          </View>
                          <View style={styles.add}>
                            <TextInput
                              style={[
                                styles.pendingReasonInput,
                                styles.workStatusValueTypo,
                              ]}
                              placeholder="Enter Reason of Pending"
                              placeholderTextColor={COLORS.colorSlategray}
                              value={reasonOfPending}
                              onChangeText={setReasonOfPending}
                              multiline
                            />
                          </View>
                        </View>
                      )}

                      {/* Return Items — only when Completed */}
                      {isCompleted && (
                        <View style={styles.formCard}>
                          <View style={styles.col3}>
                            <View style={styles.workStatusContainer}>
                              <View style={styles.span2}>
                                <Text
                                  style={[
                                    styles.workStatusLabel,
                                    styles.workStatusLabelTypo,
                                  ]}>
                                  Return Items
                                </Text>
                                <Text
                                  style={[
                                    styles.requiredIndicator,
                                    styles.workStatusLabelTypo,
                                  ]}>
                                  {' '}
                                  *
                                </Text>
                              </View>
                              <TouchableOpacity
                                style={styles.add}
                                onPress={() => openDropdown('return')}>
                                <Text
                                  style={[
                                    styles.workStatusValueTypo,
                                    !returnItems && styles.placeholderText,
                                  ]}>
                                  {returnItems || 'Yes / No'}
                                </Text>
                                <View style={styles.dropdownChevron} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      )}

                      {/* Item Summary — only when Completed AND Return Items = Yes */}
                      {showItemSummaryAndRemarkOnCompleted && (
                        <View style={styles.formBody}>
                          <View style={styles.li3}>
                            <View style={styles.span2}>
                              <Text
                                style={[
                                  styles.labelItemSummary,
                                  styles.tableItemClr,
                                ]}>
                                Item Summary:
                              </Text>
                            </View>
                          </View>

                          {itemsLoading && (
                            <ActivityIndicator
                              style={{alignSelf: 'center', marginVertical: 12}}
                              color={COLORS.PRIMARY}
                            />
                          )}

                          {!itemsLoading && items.length === 0 && (
                            <Text
                              style={[
                                styles.tableRow1,
                                styles.tableItemClr,
                                {alignSelf: 'center', marginVertical: 12},
                              ]}>
                              No items found for this complaint.
                            </Text>
                          )}

                          {!itemsLoading && items.length > 0 && (
                            <View style={styles.itemTableOuter}>
                              <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={true}
                                bounces={false}
                                contentContainerStyle={
                                  styles.itemTableScrollContent
                                }>
                                <View style={styles.itemTable}>
                                  {/* TABLE HEADER */}
                                  <View style={styles.itemTableHeader}>
                                    {/* Select All checkbox — header me,
                                        click par saari rows check/uncheck */}
                                    <View
                                      style={[
                                        styles.itemColCheckbox,
                                        styles.tableHeaderCell,
                                      ]}>
                                      <TouchableOpacity
                                        onPress={toggleSelectAll}
                                        style={styles.checkboxTouchable}
                                        activeOpacity={0.7}
                                        accessibilityRole="checkbox"
                                        accessibilityLabel="Select all items"
                                        accessibilityState={{
                                          checked: someChecked
                                            ? 'mixed'
                                            : allChecked,
                                        }}
                                        hitSlop={{
                                          top: 10,
                                          bottom: 10,
                                          left: 10,
                                          right: 10,
                                        }}>
                                        <View
                                          style={[
                                            styles.checkbox,
                                            styles.checkboxLayout,
                                            (allChecked || someChecked) &&
                                              styles.checkboxChecked,
                                          ]}>
                                          {allChecked && (
                                            <Text style={styles.checkboxTick}>
                                              ✓
                                            </Text>
                                          )}
                                          {someChecked && (
                                            <Text style={styles.checkboxTick}>
                                              –
                                            </Text>
                                          )}
                                        </View>
                                      </TouchableOpacity>
                                    </View>

                                    {/* Item */}
                                    <View
                                      style={[
                                        styles.itemColItem,
                                        styles.tableHeaderCell,
                                      ]}>
                                      <Text style={styles.tableHeaderText}>
                                        Item
                                      </Text>
                                    </View>

                                    {/* Type */}
                                    <View
                                      style={[
                                        styles.itemColType,
                                        styles.tableHeaderCell,
                                      ]}>
                                      <Text style={styles.tableHeaderText}>
                                        Type
                                      </Text>
                                    </View>

                                    {/* Description */}
                                    <View
                                      style={[
                                        styles.itemColDesc,
                                        styles.tableHeaderCell,
                                      ]}>
                                      <Text style={styles.tableHeaderText}>
                                        Desc.
                                      </Text>
                                    </View>

                                    {/* Received */}
                                    <View
                                      style={[
                                        styles.itemColReceived,
                                        styles.tableHeaderCell,
                                      ]}>
                                      <Text style={styles.tableHeaderText}>
                                        Received
                                      </Text>
                                    </View>
                                    {/* Return Qty */}
                                    <View
                                      style={[
                                        styles.itemColReturnQty,
                                        styles.tableHeaderCell,
                                      ]}>
                                      <Text style={styles.tableHeaderText}>
                                        {'Return\nQty.'}
                                      </Text>
                                    </View>
                                  </View>
                                  {/* TABLE ROWS */}
                                  {items.map((row, idx) => (
                                    <View
                                      key={row.id}
                                      style={[
                                        styles.itemTableRow,
                                        idx === items.length - 1 &&
                                          styles.itemTableLastRow,
                                        row.checked && styles.rowBorder,
                                      ]}>
                                      {/* ROW CHECKBOX — sirf isi row ko toggle karta hai */}
                                      <View
                                        style={[
                                          styles.itemColCheckbox,
                                          styles.tableHeaderCell,
                                        ]}>
                                        <TouchableOpacity
                                          onPress={() =>
                                            toggleItemChecked(row.id)
                                          }
                                          style={styles.checkboxTouchable}
                                          activeOpacity={0.7}
                                          accessibilityRole="checkbox"
                                          accessibilityState={{
                                            checked: row.checked,
                                          }}
                                          hitSlop={{
                                            top: 10,
                                            bottom: 10,
                                            left: 10,
                                            right: 10,
                                          }}>
                                          <View
                                            style={[
                                              styles.checkbox,
                                              styles.checkboxLayout,
                                              row.checked &&
                                                styles.checkboxChecked,
                                            ]}>
                                            {row.checked && (
                                              <Text style={styles.checkboxTick}>
                                                ✓
                                              </Text>
                                            )}
                                          </View>
                                        </TouchableOpacity>
                                      </View>

                                      {/* ITEM */}
                                      <View
                                        style={[
                                          styles.itemColItem,
                                          styles.tableBodyCell,
                                        ]}>
                                        <Text
                                          style={[
                                            styles.tableRow1,
                                            styles.tableItemClr,
                                          ]}
                                          numberOfLines={2}
                                          ellipsizeMode="tail">
                                          {row.item || '-'}
                                        </Text>
                                      </View>

                                      {/* TYPE */}
                                      <View
                                        style={[
                                          styles.itemColType,
                                          styles.tableBodyCell,
                                        ]}>
                                        <Text
                                          style={[
                                            styles.tableRow1,
                                            styles.tableItemClr,
                                          ]}
                                          numberOfLines={2}
                                          ellipsizeMode="tail">
                                          {row.type || '-'}
                                        </Text>
                                      </View>

                                      {/* DESCRIPTION */}
                                      <View
                                        style={[
                                          styles.itemColDesc,
                                          styles.tableBodyCell,
                                        ]}>
                                        <Text
                                          style={[
                                            styles.tableRow1,
                                            styles.tableItemClr,
                                          ]}
                                          numberOfLines={2}
                                          ellipsizeMode="tail">
                                          {row.ductColor || '-'}
                                        </Text>
                                      </View>

                                      {/* RECEIVED */}
                                      <View
                                        style={[
                                          styles.itemColReceived,
                                          styles.tableBodyCell,
                                        ]}>
                                        <Text
                                          style={[
                                            styles.tableRow1,
                                            styles.tableItemClr,
                                            styles.centerText,
                                          ]}
                                          numberOfLines={1}>
                                          {row.received || '0'}
                                        </Text>
                                      </View>

                                      {/* RETURN QTY */}
                                      <View
                                        style={[
                                          styles.itemColReturnQty,
                                          styles.tableBodyCell,
                                        ]}>
                                        {row.checked ? (
                                          <TextInput
                                            style={[
                                              styles.returnQtyInput,
                                              styles.tableRow1,
                                              styles.tableItemClr,
                                            ]}
                                            value={row.returnQty}
                                            onChangeText={value =>
                                              updateReturnQty(row.id, value)
                                            }
                                            placeholder="Qty"
                                            placeholderTextColor={
                                              COLORS.colorSlategray
                                            }
                                            keyboardType="number-pad"
                                            maxLength={6}
                                            selectTextOnFocus
                                          />
                                        ) : (
                                          <View
                                            style={styles.returnQtyPlaceholder}
                                          />
                                        )}
                                      </View>
                                    </View>
                                  ))}
                                </View>
                              </ScrollView>
                            </View>
                          )}
                        </View>
                      )}

                      {/* Image Upload — Update Work Status / Pending / Completed.
                          All 4 images are mandatory. */}
                      {showImageUpload && (
                        <View style={styles.li4}>
                          <View style={styles.formBody}>
                            <View style={styles.li2}></View>
                          </View>

                          {/* ── Get GPS — captures Lat / Long / Address that
                              get burned into every photo's watermark ── */}
                          <View style={styles.gpsSection}>
                            <View style={styles.gpsRow}>
                              <View style={styles.gpsCoordsWrap}>
                                {!!gpsLat && !!gpsLong ? (
                                  <Text style={styles.gpsCoords}>
                                    {`Lat: ${gpsLat}°\nLong: ${gpsLong}°`}
                                  </Text>
                                ) : (
                                  <Text style={styles.gpsPlaceholder}>
                                    GPS not captured yet
                                  </Text>
                                )}
                              </View>
                              <TouchableOpacity
                                style={[
                                  styles.gpsBtn,
                                  (isCountingDown || gpsLoading) &&
                                    styles.submitButtonDisabled,
                                ]}
                                onPress={handleGetGPS}
                                disabled={isCountingDown || gpsLoading}>
                                {gpsLoading ? (
                                  <ActivityIndicator
                                    color={COLORS.colorWhite}
                                    size="small"
                                  />
                                ) : (
                                  <Text style={styles.gpsBtnText}>
                                    {countdown !== null
                                      ? `Fetching GPS... ${countdown}s`
                                      : gpsLat
                                      ? 'Refresh GPS'
                                      : 'Get GPS'}
                                  </Text>
                                )}
                              </TouchableOpacity>
                            </View>

                            {isCountingDown && (
                              <View style={styles.countdownWrap}>
                                <View style={styles.countdownBarBg}>
                                  <View
                                    style={[
                                      styles.countdownBarFill,
                                      {
                                        width: `${
                                          ((10 - (countdown ?? 0)) / 10) * 100
                                        }%`,
                                      },
                                    ]}
                                  />
                                </View>
                                <Text style={styles.countdownText}>
                                  {`Getting GPS in ${countdown}s…`}
                                </Text>
                              </View>
                            )}

                            <View style={styles.add}>
                              <TextInput
                                value={gpsAddress}
                                onChangeText={setGpsAddress}
                                placeholder="Address"
                                placeholderTextColor={COLORS.colorSlategray}
                                multiline
                                style={[
                                  styles.workStatusValueTypo,
                                  styles.gpsAddressInput,
                                ]}
                              />
                            </View>
                            {!!gpsError && (
                              <Text style={styles.gpsErrorText}>
                                {gpsError}
                              </Text>
                            )}

                            {!gpsLat || !gpsLong ? (
                              <View style={styles.gpsWarningBanner}>
                                <Text style={styles.gpsWarningText}>
                                  ⚠ Tap "Get GPS" first — Lat, Long & Address
                                  will be permanently burned onto the photos as
                                  a watermark.
                                </Text>
                              </View>
                            ) : (
                              <View style={styles.gpsReadyBanner}>
                                <Text style={styles.gpsReadyText}>
                                  ✓ GPS ready — watermark will be burned into
                                  the photos
                                </Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.span2}>
                            <Text
                              style={[
                                styles.workStatusLabel,
                                styles.workStatusLabelTypo,
                              ]}>
                              Upload 4 Images
                            </Text>
                            <Text
                              style={[
                                styles.requiredIndicator,
                                styles.workStatusLabelTypo,
                              ]}>
                              {' '}
                              *
                            </Text>
                          </View>
                          <View style={[styles.col36, styles.liFlexBox]}>
                            {IMAGE_SLOTS.slice(0, 2).map(({key, label}) => (
                              <View key={key} style={styles.imageSlotWrapper}>
                                {gpsLat.trim() !== '' &&
                                gpsLong.trim() !== '' ? (
                                  <CaptureImageWatermark
                                    title={label}
                                    pic={images[key]}
                                    setPic={setImageForSlot(key)}
                                    lat={gpsLat}
                                    long={gpsLong}
                                    address={gpsAddress || ''}
                                  />
                                ) : (
                                  <View style={styles.imageGpsLock}>
                                    <Text style={styles.imageGpsLockTitle}>
                                      {label}
                                    </Text>
                                    <Text style={styles.imageGpsLockText}>
                                      Capture GPS first to enable this image.
                                    </Text>
                                  </View>
                                )}
                              </View>
                            ))}
                          </View>
                          <View style={[styles.col36, styles.liFlexBox]}>
                            {IMAGE_SLOTS.slice(2, 4).map(({key, label}) => (
                              <View key={key} style={styles.imageSlotWrapper}>
                                {gpsLat.trim() !== '' &&
                                gpsLong.trim() !== '' ? (
                                  <CaptureImageWatermark
                                    title={label}
                                    pic={images[key]}
                                    setPic={setImageForSlot(key)}
                                    lat={gpsLat}
                                    long={gpsLong}
                                    address={gpsAddress || ''}
                                  />
                                ) : (
                                  <View style={styles.imageGpsLock}>
                                    <Text style={styles.imageGpsLockTitle}>
                                      {label}
                                    </Text>
                                    <Text style={styles.imageGpsLockText}>
                                      Capture GPS first to enable this image.
                                    </Text>
                                  </View>
                                )}
                              </View>
                            ))}
                          </View>
                        </View>
                      )}

                      {/* Remark — Update/Pending always, Completed only if
                          Return Items = Yes. Mandatory whenever visible. */}
                      {showRemark && (
                        <View style={styles.span3}>
                          <View style={styles.span2}>
                            <Text
                              style={[
                                styles.workStatusLabel,
                                styles.workStatusLabelTypo,
                              ]}>
                              Remark
                            </Text>
                            <Text
                              style={[
                                styles.requiredIndicator,
                                styles.workStatusLabelTypo,
                              ]}>
                              {' '}
                              *
                            </Text>
                          </View>
                          <View style={styles.add}>
                            <TextInput
                              style={[
                                styles.pendingReasonInput,
                                styles.workStatusValueTypo,
                              ]}
                              placeholder="Enter Remarks"
                              placeholderTextColor={COLORS.colorSlategray}
                              value={remark}
                              onChangeText={setRemark}
                              multiline
                            />
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* ── Fixed bottom action bar — Start Working / Update /
            Mark as Pending / Submit always stay pinned to the bottom of
            the screen, outside the scrolling content. ── */}
        {(!started || isUpdateStatus || isPending || isCompleted) && (
          <View
            style={[
              styles.bottomBar,
              {paddingBottom: Math.max(insets.bottom, 12)},
            ]}>
            {!started && (
              <TouchableOpacity
                style={[styles.submitButton, styles.bottomBtn, styles.btnGreen]}
                onPress={handleStartWorking}>
                <Text style={styles.submitButtonText}>Start Working</Text>
              </TouchableOpacity>
            )}
            {started && isUpdateStatus && (
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  styles.bottomBtn,
                  styles.btnBlue,
                  submitting && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color={COLORS.colorWhite} />
                ) : (
                  <Text style={styles.submitButtonText}>Update</Text>
                )}
              </TouchableOpacity>
            )}
            {started && isPending && (
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  styles.bottomBtn,
                  styles.btnYellow,
                  submitting && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color={COLORS.colorWhite} />
                ) : (
                  <Text style={styles.submitButtonText}>Mark as Pending</Text>
                )}
              </TouchableOpacity>
            )}
            {started && isCompleted && (
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  styles.bottomBtn,
                  submitting && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color={COLORS.colorWhite} />
                ) : (
                  <Text style={styles.submitButtonText}>Submit</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
        <Modal
          visible={!!dropdownOpen}
          transparent
          animationType="fade"
          onRequestClose={closeDropdown}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={closeDropdown}>
            <View style={styles.modalContent}>
              {dropdownOptions.map(option => (
                <TouchableOpacity
                  key={option}
                  style={styles.modalOption}
                  onPress={() => selectDropdownValue(option)}>
                  <Text style={styles.modalOptionText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
        {/* ── Information modal (Invalid Return Quantity / Missing Information) ── */}
        <Modal
          visible={infoModal.visible}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={closeInfoModal}>
          <View style={styles.resultOverlay}>
            <View style={styles.infoCard}>
              <View style={styles.infoIconBox}>
                <View style={styles.infoIconCircle}>
                  <Text style={styles.infoIconText}>!</Text>
                </View>
              </View>
              <Text style={styles.infoTitle}>{infoModal.title}</Text>
              <Text style={styles.infoMessage}>{infoModal.message}</Text>
              <TouchableOpacity
                style={styles.infoButton}
                activeOpacity={0.85}
                onPress={closeInfoModal}>
                <Text style={styles.infoButtonText}>Ok</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        <Modal
          visible={resultModal.visible}
          transparent
          animationType="fade"
          onRequestClose={closeResultModal}>
          <View style={styles.resultOverlay}>
            <View style={styles.resultCard}>
              <View
                style={[
                  styles.resultIconCircle,
                  resultModal.type === 'success'
                    ? styles.resultIconCircleSuccess
                    : styles.resultIconCircleError,
                ]}>
                <Text
                  style={[
                    styles.resultIconText,
                    resultModal.type === 'success'
                      ? styles.resultIconTextSuccess
                      : styles.resultIconTextError,
                  ]}>
                  {resultModal.type === 'success' ? '✓' : '✕'}
                </Text>
              </View>
              <Text style={styles.resultTitle}>
                {resultModal.type === 'success'
                  ? 'Submission Successful'
                  : 'Submission Failed'}
              </Text>
              <Text style={styles.resultMessage}>{resultModal.message}</Text>
              <TouchableOpacity
                style={[
                  styles.resultButton,
                  resultModal.type === 'success'
                    ? styles.resultButtonSuccess
                    : styles.resultButtonError,
                ]}
                onPress={closeResultModal}>
                <Text style={styles.resultButtonText}>Back to list</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Screen>
  );
};

export default MaintenanceDetailScreen;

const styles = StyleSheet.create({
  // ── Information modal ──
  infoCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.colorWhite,
    borderRadius: 16,
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    elevation: 8,
  },
  infoIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#E8EEFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  infoIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2B67ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  infoTitle: {
    fontSize: 20,
    fontFamily: FONTS.SEMI_BOLD,
    fontWeight: '700',
    color: COLORS.BLACK,
    textAlign: 'center',
    marginBottom: 8,
  },
  infoMessage: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONTS.REGULAR,
    color: COLORS.colorDarkslategray,
    textAlign: 'center',
    marginBottom: 24,
  },
  infoButton: {
    alignSelf: 'center',
    minWidth: 90,
    height: 38,
    paddingHorizontal: 28,
    borderRadius: 8,
    backgroundColor: COLORS.PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: FONTS.MEDIUM,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: SIZE.MVS(24),
  },
  bottomBar: {
    width: '100%',
    paddingHorizontal: Padding.padding_16,
    paddingTop: 10,
    backgroundColor: COLORS.colorWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.colorLightsteelblue100,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  bottomBtn: {
    marginTop: 0,
  },
  btnGreen: {backgroundColor: '#3ec21e'},
  btnBlue: {backgroundColor: '#2B67ED'},
  btnYellow: {backgroundColor: '#E4B805'},
  imageGpsLock: {
    minHeight: SIZE.MVS(125),
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.colorSlategray,
    borderStyle: 'dashed',
    borderRadius: SIZE.MVS(8),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIZE.MS(10),
    paddingVertical: SIZE.MVS(14),
  },
  imageGpsLockTitle: {
    color: COLORS.colorDarkslategray,
    fontSize: SIZE.MS(12),
    fontFamily: FONTS.SEMI_BOLD,
    textAlign: 'center',
    marginBottom: SIZE.MVS(6),
  },
  imageGpsLockText: {
    color: COLORS.colorSlategray,
    fontSize: SIZE.MS(11),
    fontFamily: FONTS.REGULAR,
    textAlign: 'center',
  },
  body: {
    flex: 1,
    width: '100%',
  },
  ulFlexBox: {
    gap: Gap.gap_12,
    alignItems: 'flex-start',
    backgroundColor: COLORS.colorWhite,
  },
  liFlexBox: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  div2Layout: {
    height: '100%',
    width: '100%',
  },
  chamberTypo: {
    fontWeight: '500',
    fontSize: FontSize.fs_10,
    textAlign: 'left',
  },
  addressTypo: {
    fontWeight: '600',
    fontFamily: FONTS.SEMI_BOLD,
  },
  col2FlexBox: {
    gap: Gap.gap_4,
    alignItems: 'center',
    flexDirection: 'row',
  },
  tableItemClr: {
    letterSpacing: LetterSpacing.ls_0_2,
    color: COLORS.colorDarkslategray,
  },
  workStatusLabelTypo: {
    fontSize: FontSize.fs_14,
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
  },
  workStatusValueTypo: {
    lineHeight: LineHeight.lh_22,
    fontSize: FontSize.fs_14,
    textAlign: 'left',
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.MEDIUM,
    flex: 1,
  },
  placeholderText: {
    color: COLORS.colorSlategray,
  },
  checkboxLayout: {
    borderRadius: Border.br_3,
    width: Width.width_15,
    height: Height.height_15,
  },
  checkboxTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.colorDeepskyblue,
    borderColor: COLORS.colorDeepskyblue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxTick: {
    color: COLORS.colorWhite,
    fontSize: 10,
    fontWeight: '700',
  },
  colSpaceBlock2: {
    paddingLeft: Padding.padding_11,
    paddingBottom: Padding.padding_7,
    paddingTop: Padding.padding_7,
    flex: 1,
  },
  colSpaceBlock1: {
    paddingHorizontal: Padding.padding_0,
    paddingVertical: Padding.padding_7,
  },
  tableFlexBox: {
    alignSelf: 'center',
    fontFamily: FONTS.MEDIUM,
  },
  colFlexBox: {
    width: Width.width_85,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  chamberIconContainer: {
    width: 30,
    height: 30,
    flexShrink: 0,
  },

  chamberIcon: {
    width: 30,
    height: 30,
  },

  chamberInfoContainer: {
    flex: 1,
    minWidth: 0,
    maxWidth: '100%',
    marginLeft: SIZE.MS(10),
  },

  colSpaceBlock: {
    width: Width.width_58,
    paddingHorizontal: Padding.padding_0,
    paddingVertical: Padding.padding_7,
    justifyContent: 'center',
  },
  colLayout: {
    width: Width.width_52,
    alignItems: 'center',
  },
  colBorder: {
    borderColor: COLORS.colorLightsteelblue100,
    borderRightWidth: 1,
    borderStyle: 'solid',
    alignItems: 'center',
    flexDirection: 'row',
  },
  col37FlexBox: {
    gap: Gap.gap_3,
    alignItems: 'center',
    flex: 1,
  },
  rowBorder: {
    backgroundColor: COLORS.colorAliceblue100,
  },
  checkLayout: {
    width: Width.width_15,
    height: Height.height_15,
  },
  inner: {
    paddingHorizontal: Padding.padding_16,
    flex: 1,
    height: '100%',
    width: '100%',
  },
  li: {
    justifyContent: 'center',
    gap: Gap.gap_8,
  },
  li2: {
    justifyContent: 'center',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  col: {
    gap: Gap.gap_6,
    justifyContent: 'center',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  landmarkLabel: {
    textAlign: 'left',
    color: COLORS.colorDarkslategray,
    fontSize: FontSize.fs_12,
    alignSelf: 'stretch',
  },
  fullAddress: {
    alignSelf: 'stretch',
    flexShrink: 1,
    textAlign: 'left',
    color: COLORS.colorDarkslategray,
    fontSize: FontSize.fs_12,
    lineHeight: 18,
  },
  fullAddressTxtContainer: {
    width: '100%',
    maxWidth: '100%',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  // ============================================================
  // ITEM SUMMARY TABLE
  // ============================================================

  itemTableOuter: {
    width: '100%',
    alignSelf: 'stretch',
    marginTop: SIZE.MVS(4),
    borderRadius: SIZE.MS(8),
    overflow: 'hidden',
  },

  itemTableScrollContent: {
    paddingBottom: SIZE.MVS(4),
  },

  itemTable: {
    width: 620,
    minWidth: 620,
    backgroundColor: COLORS.colorWhite,
  },

  itemTableHeader: {
    width: 620,
    minHeight: 48,
    flexDirection: 'row',
    backgroundColor: COLORS.colorLightsteelblue100,
    borderWidth: 1,
    borderColor: COLORS.colorLightsteelblue200,
    borderTopLeftRadius: SIZE.MS(8),
    borderTopRightRadius: SIZE.MS(8),
    overflow: 'hidden',
  },

  itemTableRow: {
    width: 620,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: COLORS.colorWhite,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.colorLightsteelblue100,
  },

  itemTableLastRow: {
    borderBottomLeftRadius: SIZE.MS(8),
    borderBottomRightRadius: SIZE.MS(8),
  },

  // ------------------------------------------------------------
  // COMMON CELL
  // ------------------------------------------------------------

  tableHeaderCell: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SIZE.MS(6),
    borderRightWidth: 1,
    borderRightColor: COLORS.colorLightsteelblue200,
  },

  tableBodyCell: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: SIZE.MS(7),
    borderRightWidth: 1,
    borderRightColor: COLORS.colorLightsteelblue100,
  },

  tableHeaderText: {
    fontFamily: FONTS.MEDIUM,
    fontSize: SIZE.MS(12),
    lineHeight: SIZE.MS(16),
    color: COLORS.colorDarkslategray,
    textAlign: 'center',
  },

  centerText: {
    textAlign: 'center',
  },

  // ------------------------------------------------------------
  // COLUMN WIDTHS
  // ------------------------------------------------------------

  itemColCheckbox: {
    width: 48,
    minWidth: 48,
    maxWidth: 48,
    alignItems: 'center',
  },

  itemColItem: {
    width: 115,
    minWidth: 115,
    maxWidth: 115,
  },

  itemColType: {
    width: 90,
    minWidth: 90,
    maxWidth: 90,
  },

  itemColDesc: {
    width: 165,
    minWidth: 165,
    maxWidth: 165,
  },

  itemColReceived: {
    width: 90,
    minWidth: 90,
    maxWidth: 90,
    alignItems: 'center',
  },

  itemColReturnQty: {
    width: 112,
    minWidth: 112,
    maxWidth: 112,
    alignItems: 'center',
  },

  // ------------------------------------------------------------
  // RETURN QTYupdateReturnQty
  // ------------------------------------------------------------

  returnQtyInput: {
    width: 80,
    height: 36,
    borderWidth: 1,
    borderColor: COLORS.colorLightsteelblue100,
    borderRadius: Border.br_4,
    backgroundColor: COLORS.colorWhite,
    textAlign: 'center',
    paddingHorizontal: SIZE.MS(6),
    paddingVertical: 0,
  },
  returnQtyPlaceholder: {
    width: 80,
    height: 36,
  },
  latlong: {
    alignSelf: 'stretch',
  },
  col2: {
    flex: 1,
  },
  nearbyLatitudeLabel: {
    fontSize: FontSize.fs_10,
    letterSpacing: LetterSpacing.ls_0_2,
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
  },
  text2: {
    textDecorationLine: 'underline',
    fontSize: FontSize.fs_10,
    letterSpacing: LetterSpacing.ls_0_2,
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
  },
  imgIcon: {
    width: 17,
    height: 17,
  },
  chamberImagesSection: {
    alignSelf: 'stretch',
    marginTop: SIZE.MVS(8),
    padding: SIZE.MS(10),
    backgroundColor: '#f3f6f9',
    borderRadius: SIZE.MS(10),
  },
  chamberImagesTitle: {
    fontSize: FontSize.fs_14,
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.colorDarkslategray,
    marginBottom: SIZE.MVS(8),
  },
  chamberImagesEmpty: {
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.colorSlategray,
    textAlign: 'center',
    paddingVertical: SIZE.MVS(8),
  },
  chamberImagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SIZE.MVS(8),
  },
  chamberImageCell: {
    width: '48.5%',
    aspectRatio: 1.5,
    borderRadius: SIZE.MS(8),
    overflow: 'hidden',
    backgroundColor: COLORS.colorWhitesmoke,
  },
  chamberImageThumb: {
    width: '100%',
    height: '100%',
  },
  formBody: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  startWorkingWrapper: {
    alignSelf: 'stretch',
  },
  formCard: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  form: {
    overflow: 'hidden',
    paddingVertical: Padding.padding_16,
    maxWidth: 430,
    paddingHorizontal: Padding.padding_12,
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    alignItems: 'flex-start',
    flex: 1,
  },
  ul: {
    alignSelf: 'stretch',
  },
  col3: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  workStatusContainer: {
    gap: Gap.gap_6,
    alignItems: 'flex-start',
    flex: 1,
  },
  span2: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  workStatusLabel: {
    letterSpacing: LetterSpacing.ls_0_2,
    color: COLORS.colorDarkslategray,
  },
  requiredIndicator: {
    color: COLORS.colorRed,
  },
  add: {
    borderColor: COLORS.colorAliceblue200,
    paddingVertical: Padding.padding_7,
    borderWidth: 1,
    borderStyle: 'solid',
    paddingHorizontal: Padding.padding_12,
    backgroundColor: COLORS.colorWhite,
    alignItems: 'center',
    flexDirection: 'row',
    borderRadius: Border.br_8,
    alignSelf: 'stretch',
  },
  // Dropdown chevron (V) — pure View, koi image asset ki zarurat nahi.
  dropdownChevron: {
    width: 9,
    height: 9,
    marginLeft: 10,
    marginRight: 2,
    marginBottom: 4,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: COLORS.colorDarkslategray,
    transform: [{rotate: '45deg'}],
  },
  span3: {
    gap: Gap.gap_6,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  pendingReasonInput: {
    opacity: 1,
  },
  li3: {
    paddingBottom: 10,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  labelItemSummary: {
    fontSize: 13,
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
  },
  row3: {
    borderTopLeftRadius: Border.br_8,
    borderTopRightRadius: Border.br_8,
    backgroundColor: COLORS.colorLightsteelblue100,
    borderWidth: 1,
    borderColor: COLORS.colorLightsteelblue200,
    borderStyle: 'solid',
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  col6: {
    paddingBottom: Padding.padding_7,
    paddingTop: Padding.padding_7,
    paddingRight: Padding.padding_7_5,
    paddingLeft: Padding.padding_8,
    borderRightWidth: 1,
    borderColor: COLORS.colorLightsteelblue200,
    borderStyle: 'solid',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  checkbox: {
    borderColor: COLORS.colorDarkgray,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: Border.br_3,
  },
  col7: {
    borderRightWidth: 1,
    borderColor: COLORS.colorLightsteelblue200,
    borderStyle: 'solid',
    justifyContent: 'center',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  tableHeaderItem: {
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
    fontSize: FontSize.fs_12,
    alignSelf: 'flex-start',
  },
  col8: {
    width: Width.width_56,
    paddingHorizontal: Padding.padding_0,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderColor: COLORS.colorLightsteelblue200,
    borderStyle: 'solid',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  tableHeaderType: {
    letterSpacing: LetterSpacing.ls_0_2,
    color: COLORS.colorDarkslategray,
    textAlign: 'left',
    fontSize: FontSize.fs_12,
  },
  col9: {
    paddingHorizontal: Padding.padding_0,
    paddingVertical: Padding.padding_7,
    borderRightWidth: 1,
    borderColor: COLORS.colorLightsteelblue200,
    borderStyle: 'solid',
    alignItems: 'center',
  },
  pendingContainer: {
    marginLeft: 'auto',
    paddingLeft: SIZE.MS(6),
    flexShrink: 0,
    maxWidth: 60,
    alignItems: 'flex-end',
    paddingHorizontal: SIZE.MS(4),
    paddingVertical: SIZE.MS(4),
    borderRadius: SIZE.MS(4),
  },
  statusTxt: {
    marginLeft: 'auto',
    fontSize: SIZE.MS(8),
    backgroundColor: COLORS.WARNING,
    paddingVertical: SIZE.MS(4),
    paddingHorizontal: SIZE.MS(6),
    borderRadius: SIZE.MS(6),
    color: COLORS.WHITE,
    flexShrink: 0,
  },
  col10: {
    borderRightWidth: 1,
    borderColor: COLORS.colorLightsteelblue200,
    borderStyle: 'solid',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  tableHeaderType2: {
    textAlign: 'center',
    letterSpacing: LetterSpacing.ls_0_2,
    color: COLORS.colorDarkslategray,
    fontSize: FontSize.fs_12,
  },
  col11: {
    paddingHorizontal: Padding.padding_0,
    paddingVertical: Padding.padding_7,
  },
  row4: {
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.colorLightsteelblue100,
    borderRightWidth: 1,
    borderStyle: 'solid',
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  col12: {
    paddingTop: Padding.padding_7_5,
    paddingBottom: Padding.padding_7_5,
    paddingRight: Padding.padding_7_5,
    paddingLeft: Padding.padding_8,
    borderColor: COLORS.colorLightsteelblue100,
  },
  col13: {
    paddingLeft: Padding.padding_11,
    paddingBottom: Padding.padding_7,
    paddingTop: Padding.padding_7,
    flex: 1,
  },
  span7: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
  },
  tableRow1: {
    textAlign: 'left',
    fontFamily: FONTS.MEDIUM,
    fontSize: FontSize.fs_12,
  },
  col14: {
    paddingHorizontal: Padding.padding_0,
    paddingVertical: Padding.padding_7,
    width: Width.width_56,
    justifyContent: 'center',
  },
  // Desc. column uses the same box model as col13/col14/col16 (padding +
  // justify, no separate border/radius) so the row grid lines up cleanly.
  col15: {
    paddingHorizontal: Padding.padding_4,
    paddingVertical: Padding.padding_7,
    width: Width.width_85,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  col16: {
    width: Width.width_58,
    paddingHorizontal: Padding.padding_0,
    paddingVertical: Padding.padding_7,
    justifyContent: 'center',
  },
  col17: {
    paddingHorizontal: Padding.padding_4,
    flexDirection: 'row',
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingVertical: Padding.padding_0,
  },
  span11: {
    width: Width.width_52,
    height: 24,
  },
  span11Input: {
    width: Width.width_52,
    borderRadius: Border.br_4,
    borderColor: COLORS.colorLightsteelblue100,
    borderWidth: 1,
    borderStyle: 'solid',
    backgroundColor: COLORS.colorWhite,
    textAlign: 'center',
    paddingVertical: 3,
  },
  addressValue: {
    fontFamily: FONTS.MEDIUM,
    fontSize: FontSize.fs_12,
    lineHeight: 18,
    color: COLORS.colorDarkslategray,
  },
  row7: {
    borderBottomRightRadius: Border.br_8,
    borderBottomLeftRadius: Border.br_8,
  },
  li4: {
    gap: 10,
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
  col36: {
    flexDirection: 'row',
    gap: Gap.gap_8,
    alignSelf: 'stretch',
  },
  imageSlotWrapper: {
    flex: 1,
  },

  // ── Get GPS section ──
  gpsSection: {
    alignSelf: 'stretch',
    gap: 8,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  gpsCoordsWrap: {
    flex: 1,
  },
  gpsCoords: {
    fontSize: 12,
    color: COLORS.PRIMARY,
    fontFamily: FONTS.REGULAR,
  },
  gpsPlaceholder: {
    fontSize: 12,
    color: COLORS.colorSlategray,
    fontFamily: FONTS.REGULAR,
  },
  gpsBtn: {
    backgroundColor: '#2B67ED',
    borderRadius: Border.br_8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  gpsBtnText: {
    color: COLORS.colorWhite,
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.MEDIUM,
    fontWeight: '600',
  },
  gpsAddressInput: {
    minHeight: 50,
    textAlignVertical: 'top',
    paddingTop: 4,
  },
  gpsErrorText: {
    fontSize: 12,
    color: COLORS.ERROR ?? '#C62828',
    fontFamily: FONTS.REGULAR,
  },
  countdownWrap: {
    gap: 4,
  },
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
  },
  gpsWarningBanner: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  gpsReadyText: {
    fontSize: 12,
    color: '#2E7D32',
    fontFamily: FONTS.MEDIUM,
  },

  submitButton: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.PRIMARY,
    borderRadius: Border.br_8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Gap.gap_8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: COLORS.colorWhite,
    fontSize: FontSize.fs_14,
    fontWeight: '600',
    fontFamily: FONTS.MEDIUM,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  modalContent: {
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
    overflow: 'hidden',
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: COLORS.colorLightsteelblue100,
  },
  modalOptionText: {
    fontSize: FontSize.fs_14,
    fontFamily: FONTS.MEDIUM,
    color: COLORS.colorDarkslategray,
  },
  // ── Submit result modal (blue = success, red = error) ──
  resultOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  resultCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    elevation: 6,
  },
  resultIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  resultIconCircleSuccess: {
    backgroundColor: '#E6EDFF',
  },
  resultIconCircleError: {
    backgroundColor: '#FDE7E7',
  },
  resultIconText: {
    fontSize: 22,
    fontWeight: '700',
  },
  resultIconTextSuccess: {
    color: '#2B67ED',
  },
  resultIconTextError: {
    color: '#E03B3B',
  },
  resultTitle: {
    fontSize: FontSize.fs_16,
    fontFamily: FONTS.SEMI_BOLD,
    color: COLORS.BLACK,
    marginBottom: 6,
    textAlign: 'center',
  },
  resultMessage: {
    fontSize: FontSize.fs_12,
    fontFamily: FONTS.REGULAR,
    color: COLORS.colorDarkslategray,
    textAlign: 'center',
    marginBottom: 20,
  },
  resultButton: {
    alignSelf: 'stretch',
    borderRadius: Border.br_8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultButtonSuccess: {
    backgroundColor: '#2B67ED',
  },
  resultButtonError: {
    backgroundColor: '#E03B3B',
  },
  resultButtonText: {
    color: COLORS.colorWhite,
    fontSize: FontSize.fs_14,
    fontFamily: FONTS.MEDIUM,
    fontWeight: '600',
  },
  header: {
    gap: Gap.gap_12,
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 48,
    paddingHorizontal: Padding.padding_16,
    paddingBottom: 12,
    backgroundColor: COLORS.colorWhite,
    zIndex: 10,
    elevation: 10,
  },
  backBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backIcon: {
    width: 20,
    height: 20,
  },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.fs_16,
    fontWeight: '700',
    fontFamily: FONTS.MEDIUM,
    color: COLORS.BLACK,
    textAlign: 'left',
  },
  headerRightSpacer: {
    width: 28,
  },
  rowalign: {
    width: '100%',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    minWidth: 0,
    marginTop: SIZE.MS(20),
  },
  pt015084Parent: {
    gap: Gap.gap_5,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  needChamberRcc: {
    color: COLORS.colorDarkslategray,
    fontSize: FontSize.fs_14,
    fontFamily: FONTS.REGULAR,
  },
  topInfoRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    minWidth: 0,
  },
  chamberNumberText: {
    flexShrink: 0,
    fontSize: FontSize.fs_14,
    fontFamily: FONTS.SEMI_BOLD,
  },
  zoneText: {
    fontSize: FontSize.fs_10,
    marginLeft: SIZE.MS(8),
    color: '#426eff',
    flexShrink: 0,
    fontFamily: FONTS.REGULAR,
  },
});
