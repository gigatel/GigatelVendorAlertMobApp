import {
  Text,
  StyleSheet,
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import React, {FC, useState, useEffect, useCallback} from 'react';
import {ScreenProps} from '@types';
import {FontFamily} from '../../res/globalStyle';
import {COLORS, IMAGES} from '@res';
import {Screen} from '@organisms';
import {useDispatch, useSelector} from 'react-redux';
import DatePicker from 'react-native-date-picker';
import DssCustomPicker from '../../components/molecules/DsscustomPicker';
import {
  getStockRequestsAPI,
  getStockRequestbyIdAPI,
  insertUpdateStockReceiveAPI,
} from '../../store/slices/dss.slice';
// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface ReceivedItem {
  sendId: string;
  requestId: string;
  qty: string;
  status: '1' | '2'; // "1" = Receive, "2" = Receive with Dispute
  lotNo: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const isValidSendId = (sendId: any) => {
  return (
    sendId !== null &&
    sendId !== undefined &&
    String(sendId).trim() !== '' &&
    String(sendId).toLowerCase() !== 'null'
  );
};
/**
 * Mirrors the Java logic:
 * - If every item's qtyRcvd == qtySent  →  show "Receive" (status "1")
 * - If any item differs / empty         →  show "Receive with Dispute" (status "2")
 */
const resolveReceiveStatus = (items: any[]): {isFullReceive: boolean} => {
  if (items.length === 0) return {isFullReceive: true};

  for (const item of items) {
    const rcvd = item._qtyRcvd ?? item.qtyReceived ?? '0';
    const sent = item.qtySent ?? '0';
    if (!rcvd || rcvd === '' || String(rcvd) !== String(sent)) {
      return {isFullReceive: false};
    }
  }
  return {isFullReceive: true};
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
const ReceivingStockScreen: FC<ScreenProps.ReceivingStockScreen> = ({
  navigation,
}) => {
  const dispatch = useDispatch<any>();

  // ── Redux selectors ──────────────────────────────────────
  const stockRequests = useSelector(
    (state: any) => state.dss.stockRequestListData,
  );
  const requestDetails = useSelector(
    (state: any) => state.dss.stockRequestByIdData,
  );
  const receiveLoading = useSelector(
    (state: any) => state.dss.insertUpdateStockReceiveLoading ?? false,
  );

  // ── Local state ──────────────────────────────────────────
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [openFromPicker, setOpenFromPicker] = useState(false);
  const [openToPicker, setOpenToPicker] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  /**
   * localItems mirrors the itemList from API but carries an extra
   * `_qtyRcvd` field that the user can edit (editable quantity cells).
   * Initialised / reset every time requestDetails changes.
   */
  const [localItems, setLocalItems] = useState<any[]>([]);

  // ── Date helpers ─────────────────────────────────────────
  const formatDate = (date: Date) => date.toLocaleDateString('en-GB');
  const formatAPIDate = (date: Date) => date.toISOString().split('T')[0];

  // ── Fetch request IDs whenever date range changes ────────
  useEffect(() => {
    dispatch(
      getStockRequestsAPI({
        fromDate: formatAPIDate(fromDate),
        toDate: formatAPIDate(toDate),
      }),
    );
    setSelectedRequest(null);
  }, [fromDate, toDate]);

  // ── Auto-select first request when list loads ────────────
  useEffect(() => {
    if (stockRequests?.length > 0) {
      const firstItem = stockRequests[0];
      setSelectedRequest(firstItem);
      dispatch(getStockRequestbyIdAPI({id: firstItem?.id}));
    }
  }, [stockRequests]);

  // ── Sync localItems whenever API returns new details ─────
  useEffect(() => {
    const apiItems: any[] = requestDetails?.itemList ?? [];
    // Seed _qtyRcvd from whatever the API already has (qtyReceived)
    setLocalItems(
      apiItems.map(item => ({
        ...item,
        _qtyRcvd:
          item.qtyReceived && item.qtyReceived !== 'null'
            ? String(item.qtyReceived)
            : '',
      })),
    );
  }, [requestDetails]);
  // ── Determine button mode ────────────────────────────────
  const stockStatus: string = requestDetails?.status ?? '';
  const alreadyReceived =
    stockStatus.toLowerCase() === 'received' ||
    stockStatus.toLowerCase() === 'received with dispute';
  const isPending = stockStatus.toLowerCase() === 'pending';
  const {isFullReceive} = resolveReceiveStatus(localItems);
  // ── Update qty for a row (mirrors mMessageReceiverAddQuantity) ──
  const handleQtyChange = useCallback((index: number, qty: string) => {
    setLocalItems(prev => {
      const updated = [...prev];
      updated[index] = {...updated[index], _qtyRcvd: qty};
      return updated;
    });
  }, []);
  // ── Build payload and call API (mirrors receiveStockRequest) ──
  const handleReceive = (status: '1' | '2') => {
    const receivedItemList: ReceivedItem[] = [];
    for (const item of localItems) {
      if (!isValidSendId(item.sendId)) continue;
      receivedItemList.push({
        sendId: item.sendId,
        requestId: item.id,
        qty: item._qtyRcvd ?? '0',
        status,
        lotNo: item.lotNo ?? '',
      });
    }
    if (receivedItemList.length === 0) {
      Alert.alert('Error', 'No valid items to receive.');
      return;
    }
    dispatch(insertUpdateStockReceiveAPI({receivedItemList}))
      .unwrap()
      .then(() => {
        Alert.alert('Success', 'Stock received successfully.', [
          {text: 'OK', onPress: () => navigation?.goBack()},
        ]);
      })
      .catch((err: string) => {
        Alert.alert('Error', err ?? 'Something went wrong.');
      });
  };
  // ── Info rows ────────────────────────────────────────────
  const infoRows = [
    {label: 'Project Name', value: requestDetails?.projectName || '-'},
    {label: 'Vendor Name', value: requestDetails?.vendorName || '-'},
    {label: 'From Vendor Store', value: requestDetails?.vendorStoreName || '-'},
    {label: 'Store From', value: requestDetails?.fromStoreName || '-'},
    {label: 'Required on', value: requestDetails?.requiredOn || '-'},
    {label: 'Location', value: requestDetails?.gpsLocation || '-'},
  ];

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────
  return (
    <Screen statusBarStyle="light" statusBgColor={COLORS.BACKGROUND_DEFAULT}>
      <View style={styles.container}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation?.goBack()}>
            <Image source={IMAGES.arrowBack} />
          </TouchableOpacity>
          <Text style={styles.title}>Receive Stock</Text>
        </View>

        {/* ── Scrollable Content ── */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* ── Card 1 – Date range + Request ID ── */}
          <View style={styles.card}>
            <View style={styles.dateRow}>
              {/* From */}
              <View style={styles.dateCol}>
                <Text style={styles.dateLabel}>From</Text>
                <TouchableOpacity
                  style={styles.dateBox}
                  onPress={() => setOpenFromPicker(true)}>
                  <Text style={styles.dateText}>{formatDate(fromDate)}</Text>
                  <Image source={IMAGES.calendar} style={styles.calendarIcon} />
                </TouchableOpacity>
              </View>
              {/* To */}
              <View style={styles.dateCol}>
                <Text style={styles.dateLabel}>To</Text>
                <TouchableOpacity
                  style={styles.dateBox}
                  onPress={() => setOpenToPicker(true)}>
                  <Text style={styles.dateText}>{formatDate(toDate)}</Text>
                  <Image source={IMAGES.calendar} style={styles.calendarIcon} />
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Request ID Picker ── */}
            <Text style={styles.fieldLabel}>
              Request ID <Text style={styles.required}>*</Text>
            </Text>
            <DssCustomPicker
              data={stockRequests ?? []}
              value={selectedRequest}
              placeholder="Select Request ID"
              labelKey="id"
              onSelect={item => {
                setSelectedRequest(item);
                dispatch(getStockRequestbyIdAPI({id: item?.id}));
              }}
            />
            {selectedRequest ? (
              <Text style={styles.selectedName} numberOfLines={2}>
                {selectedRequest.name}
              </Text>
            ) : null}
          </View>

          {/* ── Card 2 – Info + Remarks + Table ── */}
          <View style={styles.card}>
            {/* Info rows */}
            <View style={styles.infoSection}>
              {infoRows.map((row, i) => (
                <View key={i} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoColon}>:</Text>
                  <Text style={styles.infoValue}>{row.value}</Text>
                </View>
              ))}
            </View>

            {/* Remarks */}
            <Text style={styles.remarksLabel}>Remarks</Text>
            <View style={styles.remarksBox}>
              <TextInput
                style={styles.remarksText}
                value={requestDetails?.remarks ?? ''}
                editable={false}
                multiline
              />
            </View>

            {/* ── Table ── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.table}>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.thText, styles.cSNo]}>S.No.</Text>
                  <Text style={[styles.thText, styles.cItem]}>Item</Text>
                  <Text style={[styles.thText, styles.cType]}>Type</Text>
                  <Text style={[styles.thText, styles.cDesc]}>
                    Specification
                  </Text>
                  <Text style={[styles.thText, styles.cLotNo]}>Lot No.</Text>
                  <Text style={[styles.thText, styles.cQty]}>Qty</Text>
                  <Text style={[styles.thText, styles.cQtySent]}>Sent</Text>
                  {/* "Qty Rcvd" column is editable unless already received / pending */}
                  <Text style={[styles.thText, styles.cQtyRcvd]}>Rcvd</Text>
                </View>

                {/* Table Rows */}
                {localItems.length === 0 ? (
                  <View style={styles.emptyRow}>
                    <Text style={styles.emptyText}>No items found</Text>
                  </View>
                ) : (
                  localItems.map((row: any, i: number) => (
                    <View
                      key={`item-${row.id}-${i}`}
                      style={[
                        styles.tableRow,
                        i % 2 === 1 && styles.tableRowAlt,
                        i === localItems.length - 1 && styles.tableRowLast,
                      ]}>
                      <Text style={[styles.tdText, styles.cSNo]}>{i + 1}</Text>
                      <Text style={[styles.tdText, styles.cItem]}>
                        {row.itemName ?? '-'}
                      </Text>
                      <Text style={[styles.tdText, styles.cType]}>
                        {row.itemType ?? '-'}
                      </Text>
                      <View style={[styles.cDesc, styles.descCell]}>
                        {row.color ? (
                          <View
                            style={[
                              styles.colorDot,
                              {backgroundColor: row.color},
                            ]}
                          />
                        ) : null}
                        <Text style={styles.tdText}>
                          {row.itemSpecification ?? '-'}
                        </Text>
                      </View>
                      <Text style={[styles.tdText, styles.cLotNo]}>
                        {row.lotNo ?? '-'}
                      </Text>
                      <Text style={[styles.tdText, styles.cQty]}>
                        {row.qty ?? '-'}
                      </Text>
                      <Text style={[styles.tdText, styles.cQtySent]}>
                        {row.qtySent ?? '-'}
                      </Text>

                      {/* ── Editable qty received cell ── */}
                      {alreadyReceived || isPending ? (
                        // Read-only when stock already received or pending
                        <Text style={[styles.tdText, styles.cQtyRcvd]}>
                          {row._qtyRcvd || row.qtyReceived || '-'}
                        </Text>
                      ) : (
                        <TextInput
                          style={[styles.tdInput, styles.cQtyRcvd]}
                          keyboardType="numeric"
                          value={row._qtyRcvd}
                          placeholder="0"
                          placeholderTextColor="#9DB5C8"
                          onChangeText={text => handleQtyChange(i, text)}
                        />
                      )}
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        </ScrollView>

        {/* ── Footer buttons – mirrors Java button logic ── */}
        <View style={styles.footer}>
          {alreadyReceived ? (
            // Already received → disabled success button
            <View style={[styles.actionButton, styles.receivedButton]}>
              <Text style={styles.receivedButtonText}>
                {stockStatus.toLowerCase() === 'received with dispute'
                  ? '✓ Stock received with dispute'
                  : '✓ Stock has been received'}
              </Text>
            </View>
          ) : isPending ? (
            // Pending → no buttons (matches Java: both GONE)
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingText}>Status: Pending</Text>
            </View>
          ) : isFullReceive ? (
            // All qtySent == qtyRcvd → "Receive" button (status "1")
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.receiveButton,
                receiveLoading && styles.buttonDisabled,
              ]}
              disabled={receiveLoading}
              onPress={() => handleReceive('1')}>
              <Text style={styles.actionButtonText}>
                {receiveLoading ? 'Processing…' : 'RECEIVE'}
              </Text>
            </TouchableOpacity>
          ) : (
            // Any mismatch → "Receive with Dispute" button (status "2")
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.disputeButton,
                receiveLoading && styles.buttonDisabled,
              ]}
              disabled={receiveLoading}
              onPress={() => handleReceive('2')}>
              <Text style={styles.actionButtonText}>
                {receiveLoading ? 'Processing…' : 'RECEIVE WITH DISPUTE'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.indicator} />
      </View>

      {/* FROM DATE PICKER */}
      <DatePicker
        modal
        open={openFromPicker}
        date={fromDate}
        mode="date"
        onConfirm={date => {
          setOpenFromPicker(false);
          setFromDate(date);
        }}
        onCancel={() => setOpenFromPicker(false)}
      />

      {/* TO DATE PICKER */}
      <DatePicker
        modal
        open={openToPicker}
        date={toDate}
        mode="date"
        onConfirm={date => {
          setOpenToPicker(false);
          setToDate(date);
        }}
        onCancel={() => setOpenToPicker(false)}
      />
    </Screen>
  );
};

export default ReceivingStockScreen;

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#EEF3F8'},

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF3F8',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  backButton: {position: 'absolute', left: 16, zIndex: 1, padding: 4},
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    fontFamily: FontFamily.switzer,
    color: '#1C2B3A',
    textAlign: 'center',
  },

  scrollView: {flex: 1},
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
    gap: 12,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  dateRow: {flexDirection: 'row', gap: 12, marginBottom: 16},
  dateCol: {flex: 1},
  dateLabel: {
    fontSize: 13,
    fontFamily: FontFamily.switzer,
    color: '#4A6070',
    fontWeight: '500',
    marginBottom: 6,
  },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C8D8E8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
  },
  dateText: {
    flex: 1,
    fontSize: 13,
    fontFamily: FontFamily.switzer,
    color: '#1C2B3A',
  },
  calendarIcon: {width: 18, height: 18, tintColor: '#1A86D0'},

  fieldLabel: {
    fontSize: 13,
    fontFamily: FontFamily.switzer,
    color: '#4A6070',
    marginBottom: 8,
    fontWeight: '500',
  },
  required: {color: '#E53935'},

  selectedName: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: FontFamily.switzer,
    color: '#1A86D0',
    lineHeight: 18,
  },

  infoSection: {gap: 9, marginBottom: 12},
  infoRow: {flexDirection: 'row', alignItems: 'flex-start'},
  infoLabel: {
    width: 118,
    fontSize: 13,
    fontFamily: FontFamily.switzer,
    color: '#4A6070',
  },
  infoColon: {
    fontSize: 13,
    fontFamily: FontFamily.switzer,
    color: '#4A6070',
    marginHorizontal: 4,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    fontFamily: FontFamily.switzer,
    color: '#1C2B3A',
    fontWeight: '500',
  },

  remarksLabel: {
    fontSize: 13,
    fontFamily: FontFamily.switzer,
    color: '#4A6070',
    marginBottom: 6,
    fontWeight: '500',
  },
  remarksBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C8D8E8',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  remarksText: {
    fontSize: 13,
    fontFamily: FontFamily.switzer,
    color: '#1C2B3A',
    lineHeight: 20,
  },

  // ── Table ────────────────────────────────────────────────
  table: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#C8D8E8',
    minWidth: 600,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#D6E4F0',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  thText: {
    fontSize: 12,
    fontFamily: FontFamily.switzer,
    color: '#1C2B3A',
    fontWeight: '600',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#D8E6F0',
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  tableRowAlt: {backgroundColor: '#F4F9FD'},
  tableRowLast: {},
  tdText: {
    fontSize: 12,
    fontFamily: FontFamily.switzer,
    color: '#1C2B3A',
    textAlign: 'center',
  },
  tdInput: {
    fontSize: 12,
    fontFamily: FontFamily.switzer,
    color: '#1C2B3A',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#C8D8E8',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: '#F0F7FF',
  },

  emptyRow: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#D8E6F0',
  },
  emptyText: {
    fontSize: 13,
    fontFamily: FontFamily.switzer,
    color: '#9DB5C8',
  },

  // ── Column widths ────────────────────────────────────────
  cSNo: {width: 42},
  cItem: {width: 72},
  cType: {width: 52},
  cDesc: {width: 90},
  cLotNo: {width: 62},
  cQty: {width: 38},
  cQtySent: {width: 44},
  cQtyRcvd: {width: 66},

  descCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  colorDot: {width: 10, height: 10, borderRadius: 5},

  // ── Footer ──────────────────────────────────────────────
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#EEF3F8',
  },

  actionButton: {
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  receiveButton: {
    backgroundColor: COLORS.PRIMARY,
    shadowColor: '#0FC4AE',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.28,
    shadowRadius: 6,
  },
  disputeButton: {
    backgroundColor: '#E67E22',
    shadowColor: '#E67E22',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.28,
    shadowRadius: 6,
  },
  receivedButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#27AE60',
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonDisabled: {opacity: 0.6},
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
    fontFamily: FontFamily.switzer,
    letterSpacing: 0.3,
  },
  receivedButtonText: {
    color: '#27AE60',
    fontWeight: '600',
    fontSize: 15,
    fontFamily: FontFamily.switzer,
  },

  pendingBadge: {
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  pendingText: {
    color: '#856404',
    fontWeight: '600',
    fontSize: 14,
    fontFamily: FontFamily.switzer,
  },

  indicator: {
    width: 134,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#B0BEC5',
    alignSelf: 'center',
    marginBottom: 8,
  },
});
