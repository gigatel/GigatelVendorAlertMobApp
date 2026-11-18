// PitComponents.tsx
// ─── Pit number helpers, PitCard component, dashed-line helpers ──────────────
import React, {FC, useState} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import {COLORS, FONTS, IMAGES, SIZE} from '@res';
import {
  FontFamily,
  FontSize,
  Border,
  Gap,
  Padding,
  LetterSpacing,
  Width,
  Height,
} from '../../../res/globalStyle';
// ─── Constants ────────────────────────────────────────────────────────────────
export const DASH_COL_WIDTH = 32;
export const CARD_GAP = 8;
export const BETWEEN_ROW_H = 44;
export const PIN_SIZE = 32;
const DASH_H = 5;
const DASH_GAP = 4;
export const DASH_W = 1.5;
export const displayPitNo = (pitNo: string | number): string => {
  const s = String(pitNo ?? '').trim();
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '') || '0';
};

const isChildOf = (aDisp: string, bDisp: string): boolean =>
  bDisp.startsWith(aDisp + '.');

export const getBetweenLabel = (pitList: any[], index: number): string => {
  if (!pitList || index >= pitList.length - 1) return '';
  const cur = displayPitNo(pitList[index]?.pitNo ?? String(index + 1));
  const nxt = displayPitNo(pitList[index + 1]?.pitNo ?? String(index + 2));
  return `Add Pit between ${cur} - ${nxt}`;
};

export const getNextNewPitNo = (pitList: any[]): number => {
  if (!pitList || pitList.length === 0) return 1;
  const maxBase = Math.max(
    ...pitList.map((it: any) =>
      parseInt(displayPitNo(String(it?.pitNo ?? '0')).split('.')[0], 10),
    ),
  );
  return maxBase + 1;
};

export const getNextBetweenPitNo = (pitList: any[], index: number): string => {
  if (!pitList || pitList.length === 0) return '1';
  const curRaw = String(pitList[index]?.pitNo ?? '0');
  const nxtRaw =
    index + 1 < pitList.length
      ? String(pitList[index + 1]?.pitNo ?? '0')
      : null;
  const curDisp = displayPitNo(curRaw);
  const nxtDisp = nxtRaw ? displayPitNo(nxtRaw) : null;
  if (nxtDisp && isChildOf(curDisp, nxtDisp)) {
    const nxtAfterParent = nxtDisp.slice(curDisp.length + 1);
    const nxtFirstChildStr = nxtAfterParent.split('.')[0];
    const nxtFirstChildSeg = parseInt(nxtFirstChildStr, 10);
    const existingInSlot = pitList
      .map((it: any) => displayPitNo(String(it?.pitNo ?? '0')))
      .filter((d: string) => {
        if (!d.startsWith(curDisp + '.')) return false;
        const seg = parseInt(d.slice(curDisp.length + 1).split('.')[0], 10);
        return seg > 0 && seg < nxtFirstChildSeg;
      })
      .map((d: string) =>
        parseInt(d.slice(curDisp.length + 1).split('.')[0], 10),
      );
    const maxInSlot =
      existingInSlot.length > 0 ? Math.max(...existingInSlot) : 0;
    const padded = String(maxInSlot + 1).padStart(
      nxtFirstChildStr.length + 1,
      '0',
    );
    return `${curDisp}.${padded}`;
  }
  const curParts = curDisp.split('.');
  if (curParts.length > 1 && nxtDisp) {
    const curParentDisp = curParts.slice(0, -1).join('.');
    const curLastStr = curParts[curParts.length - 1];
    const curLastSeg = parseInt(curLastStr, 10);
    if (isChildOf(curParentDisp, nxtDisp)) {
      const nxtAfterParent = nxtDisp.slice(curParentDisp.length + 1);
      const nxtFirstChildSeg = parseInt(nxtAfterParent.split('.')[0], 10);
      if (nxtFirstChildSeg >= curLastSeg) {
        const existingInSlot = pitList
          .map((it: any) => displayPitNo(String(it?.pitNo ?? '0')))
          .filter((d: string) => {
            if (!d.startsWith(curParentDisp + '.')) return false;
            const afterParent = d.slice(curParentDisp.length + 1);
            if (afterParent.includes('.')) return false;
            const seg = parseInt(afterParent, 10);
            return seg > curLastSeg && seg < nxtFirstChildSeg;
          })
          .map((d: string) => parseInt(d.slice(curParentDisp.length + 1), 10));
        const maxInSlot =
          existingInSlot.length > 0 ? Math.max(...existingInSlot) : curLastSeg;
        const padded = String(maxInSlot + 1).padStart(curLastStr.length, '0');
        return `${curParentDisp}.${padded}`;
      }
    }
  }
  if (curParts.length === 1) {
    const existingChildren = pitList
      .map((it: any) => displayPitNo(String(it?.pitNo ?? '0')))
      .filter((d: string) => d.startsWith(curDisp + '.'))
      .map((d: string) =>
        parseInt(d.slice(curDisp.length + 1).split('.')[0], 10),
      )
      .filter((n: number) => !isNaN(n) && n > 0);
    const maxChild =
      existingChildren.length > 0 ? Math.max(...existingChildren) : 0;
    return `${curDisp}.${maxChild + 1}`;
  }
  const parentPart = curParts.slice(0, -1).join('.');
  const lastSeg = parseInt(curParts[curParts.length - 1], 10);
  const nxtParts = nxtDisp ? nxtDisp.split('.') : null;
  const nxtLastSeg =
    nxtParts &&
    nxtParts.length === curParts.length &&
    nxtParts.slice(0, -1).join('.') === parentPart
      ? parseInt(nxtParts[nxtParts.length - 1], 10)
      : Infinity;
  const existingInRange = pitList
    .map((it: any) => displayPitNo(String(it?.pitNo ?? '0')))
    .filter((d: string) => {
      const parts = d.split('.');
      if (parts.length !== curParts.length) return false;
      if (parts.slice(0, -1).join('.') !== parentPart) return false;
      const last = parseInt(parts[parts.length - 1], 10);
      return last > lastSeg && last < nxtLastSeg;
    })
    .map((d: string) => parseInt(d.split('.').pop()!, 10));
  const maxInRange =
    existingInRange.length > 0 ? Math.max(...existingInRange) : lastSeg;
  return `${parentPart}.${maxInRange + 1}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Dashed line UI helpers
// ─────────────────────────────────────────────────────────────────────────────
export const VerticalDashedLine: FC<{
  height: number;
  color?: string;
  opacity?: number;
}> = ({height, color = COLORS.colorDimgray ?? '#888', opacity = 0.5}) => {
  if (Platform.OS === 'android') {
    return (
      <View
        style={{
          width: DASH_W,
          height,
          borderLeftWidth: DASH_W,
          borderStyle: 'dashed',
          borderColor: color,
          opacity,
        }}
      />
    );
  }
  const count = Math.floor(height / (DASH_H + DASH_GAP)) + 1;
  return (
    <View style={{width: DASH_W, height, overflow: 'hidden', opacity}}>
      {Array.from({length: count}).map((_, i) => (
        <View
          key={i}
          style={{
            width: DASH_W,
            height: DASH_H,
            backgroundColor: color,
            marginBottom: DASH_GAP,
          }}
        />
      ))}
    </View>
  );
};

export const VerticalDashedLineAutoHeight: FC<{
  left: number;
  color?: string;
  opacity?: number;
}> = ({left, color, opacity}) => {
  const [h, setH] = useState(0);
  return (
    <View
      style={StyleSheet.absoluteFillObject}
      pointerEvents="none"
      onLayout={e => setH(e.nativeEvent.layout.height)}>
      <View style={{position: 'absolute', top: 0, left}}>
        {h > 0 && (
          <VerticalDashedLine height={h} color={color} opacity={opacity} />
        )}
      </View>
    </View>
  );
};

export const ShortDashedConnector: FC<{color?: string}> = ({
  color = COLORS.colorDarkslategray ?? '#555',
}) => {
  if (Platform.OS === 'android') {
    return (
      <View style={compStyles.dashedWrap}>
        <View
          style={{
            width: 0,
            height: 8,
            borderLeftWidth: DASH_W,
            borderStyle: 'dashed',
            borderColor: color,
            opacity: 0.45,
          }}
        />
      </View>
    );
  }
  return (
    <View style={compStyles.dashedWrap}>
      <View style={{width: DASH_W, opacity: 0.45}}>
        <View
          style={{
            width: DASH_W,
            height: 3,
            backgroundColor: color,
            marginBottom: 2,
          }}
        />
        <View style={{width: DASH_W, height: 3, backgroundColor: color}} />
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PitCard
// ─────────────────────────────────────────────────────────────────────────────
export type PitCardProps = {
  pitId: string;
  lat: string;
  long: string;
  landmark: string;
  address: string;
  pic1Url: string | null;
  pic2Url: string | null;
  isNearest: boolean;
  onLayout: (h: number) => void;
  distanceToNext?: string | null;
  onViewImages: () => void;
};

export const PitCard: FC<PitCardProps> = ({
  pitId,
  lat,
  long,
  landmark,
  address,
  pic1Url,
  pic2Url,
  isNearest,
  onLayout,
  onViewImages,
}) => {
  const hasImages = !!(pic1Url || pic2Url);
  return (
    <View
      style={[compStyles.pitCard, isNearest && compStyles.pitCardNearest]}
      onLayout={(e: LayoutChangeEvent) =>
        onLayout(e.nativeEvent.layout.height)
      }>
      <View style={compStyles.pitCardHeader}>
        <View
          style={[
            compStyles.pitBadge,
            isNearest && {backgroundColor: COLORS.SUCCESS ?? '#3EC21E'},
          ]}>
          <Text style={compStyles.pitBadgeText}>{pitId}</Text>
        </View>
        {isNearest && (
          <Animatable.View
            animation="pulse"
            iterationCount="infinite"
            duration={1200}
            style={compStyles.nearestTag}>
            <Text style={compStyles.nearestTagText}>📍 You are here</Text>
          </Animatable.View>
        )}
      </View>
      <Text style={compStyles.pitMetaText}>
        <Text style={compStyles.metaLabel}>Landmark: </Text>
        <Text style={compStyles.metaValue}>{landmark}</Text>
      </Text>
      <Text style={compStyles.pitAddress}>{address}</Text>
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <View style={compStyles.pitLatLong}>
          <Text style={compStyles.latLongText}>Lat: {lat}</Text>
          <Text style={compStyles.latLongText}>Long: {long}</Text>
        </View>
        <TouchableOpacity
          style={[
            compStyles.viewImagesRow,
            !hasImages && compStyles.viewImagesDisabled,
          ]}
          onPress={onViewImages}
          disabled={!hasImages}
          activeOpacity={0.7}>
          <Text
            style={[
              compStyles.viewImagesText,
              !hasImages && compStyles.viewImagesTextDimmed,
            ]}>
            View Images
          </Text>
          <Image
            style={[compStyles.pitThumb, !hasImages && {opacity: 0.35}]}
            source={IMAGES.galleryIcon}
            resizeMode="contain"
          />
          {hasImages && (
            <View style={compStyles.imgCountBadge}>
              <Text style={compStyles.imgCountText}>
                {pic1Url && pic2Url ? '2' : '1'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const compStyles = StyleSheet.create({
  dashedWrap: {paddingLeft: 12, height: 8, justifyContent: 'center'},
  pitCard: {
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
  pitCardNearest: {
    borderWidth: 2,
    borderColor: COLORS.SUCCESS ?? '#3EC21E',
    backgroundColor: '#F0FFF4',
  },
  pitCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Gap.gap_4,
  },
  pitBadge: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: Border.br_5,
    paddingHorizontal: Padding.padding_5,
    paddingVertical: Padding.padding_2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pitBadgeText: {
    color: COLORS.colorWhite,
    fontSize: FontSize.fs_10,
    fontFamily: FONTS.REGULAR,
  },
  nearestTag: {
    backgroundColor: '#E6F9EE',
    borderRadius: Border.br_5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.SUCCESS ?? '#3EC21E',
  },
  nearestTagText: {
    fontSize: FontSize.fs_10,
    color: COLORS.SUCCESS ?? '#3EC21E',
    fontFamily: FONTS.SEMI_BOLD,
  },
  pitMetaText: {
    fontSize: FontSize.fs_12,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
  },
  pitAddress: {
    fontSize: FontSize.fs_11,
    color: COLORS.colorDarkslategray,
    fontFamily: FONTS.REGULAR,
    lineHeight: 15,
  },
  pitLatLong: {
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
  viewImagesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    position: 'relative',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  viewImagesDisabled: {opacity: 0.38},
  viewImagesText: {
    fontSize: FontSize.fs_10,
    color: COLORS.colorMediumslateblue ?? '#6C63FF',
    fontFamily: FONTS.MEDIUM,
    textDecorationLine: 'underline',
  },
  viewImagesTextDimmed: {
    color: COLORS.colorDarkslategray,
    textDecorationLine: 'none',
  },
  pitThumb: {width: 17, height: 17},
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
  metaLabel: {fontFamily: FONTS.SEMI_BOLD},
  metaValue: {fontFamily: FONTS.REGULAR},
});
