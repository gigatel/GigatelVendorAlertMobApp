import {COLORS, SIZE} from '@res';
import {Text, StyleSheet, View, Image} from 'react-native';
import {
  FontFamily,
  Padding,
  Border,
  LineHeight,
  FontSize,
  BoxShadow,
  Gap,
  Height,
  LetterSpacing,
  Width,
} from '../../res/globalStyle';
import {close} from 'src/res/images';
const styles = StyleSheet.create({
  ul2Layout: {
    maxWidth: 430,
    overflow: 'hidden',
    width: '100%',
  },
  projectNameTypo: {
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
  },
  addBorder: {
    paddingVertical: Padding.padding_8,
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderStyle: 'solid',
    borderRadius: Border.br_8,
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  selectProjectTypo: {
    lineHeight: LineHeight.lh_22,
    textAlign: 'left',
    fontSize: FontSize.fs_14,
    color: COLORS.colorDarkslategray,
  },
  add3Border: {
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderStyle: 'solid',
    borderRadius: Border.br_8,
    alignItems: 'center',
    flexDirection: 'row',
  },
  submitClr: {
    color: COLORS.colorWhite,
    textAlign: 'left',
  },
  textTypo: {
    color: COLORS.colorRed,
    textAlign: 'left',
    fontSize: FontSize.fs_14,
    fontFamily: FontFamily.switzer,
  },
  liFlexBox: {
    paddingVertical: Padding.padding_5,
    paddingHorizontal: Padding.padding_6,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: Border.br_5,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  text8Typo: {
    fontSize: FontSize.fs_13,
    textAlign: 'left',
    fontFamily: FontFamily.switzer,
  },
  li4FlexBox: {
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  li4ShadowBox: {
    borderRadius: Border.br_8,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
  },
  text7Typo: {
    fontWeight: '600',
    fontFamily: FontFamily.switzer,
  },
  body: {
    height: '100%',
    paddingHorizontal: Padding.padding_16,
    paddingTop: 12,
    flex: 1,
    width: '100%',
  },
  main: {
    gap: 22,
    alignSelf: 'stretch',
    flex: 1,
  },
  lanheader: {
    zIndex: 0,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
  },
  arrowBack24dp434343Fill0WIcon: {
    width: 24,
    top: 0,
    left: 0,
    zIndex: 1,
    position: 'absolute',
    height: Height.height_24,
  },
  holidaybody: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignSelf: 'stretch',
    flex: 1,
  },
  holiday: {
    gap: 16,
    flex: 1,
  },
  holidayitem: {
    paddingVertical: Padding.padding_16,
    paddingHorizontal: Padding.padding_12,
    backgroundColor: COLORS.colorWhite,
    borderRadius: Border.br_8,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
  },
  ul: {
    gap: Gap.gap_12,
    alignSelf: 'stretch',
  },
  span: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  projectName: {
    letterSpacing: LetterSpacing.ls_0_2,
    fontSize: FontSize.fs_14,
  },
  add: {
    paddingHorizontal: Padding.padding_12,
    backgroundColor: COLORS.colorWhite,
    alignItems: 'center',
  },
  selectProject: {
    fontFamily: FontFamily.switzer,
    flex: 1,
  },
  vectorIcon: {
    height: 6,
    width: 10,
    opacity: 1,
  },
  enterPitNumber: {
    opacity: 1,
    fontFamily: FontFamily.switzer,
    flex: 1,
  },
  checkAvailability: {
    fontSize: FontSize.fs_12,
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
  },
  span4: {
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  pitLocationGps: {
    letterSpacing: LetterSpacing.ls_0_2,
    fontSize: FontSize.fs_14,
    zIndex: 0,
  },
  text4: {
    zIndex: 1,
  },
  li2: {
    marginTop: -13,
    top: '50%',
    right: 0,
    zIndex: 2,
    position: 'absolute',
  },
  add4: {
    height: Height.height_60,
    paddingHorizontal: Padding.padding_12,
    backgroundColor: COLORS.colorWhite,
  },
  label: {
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  row: {
    gap: Gap.gap_12,
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  col: {
    gap: Gap.gap_12,
    flex: 1,
  },
  btn: {
    minHeight: 34,
    paddingHorizontal: 17,
    paddingVertical: 6,
    gap: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    borderRadius: Border.br_8,
  },
  vectorIcon3: {
    height: Height.height_15,
    width: 17,
  },
  image1: {
    lineHeight: LineHeight.lh_20,
    color: COLORS.colorDarkslategray,
  },
  imgcard: {
    height: 102,
    overflow: 'hidden',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  vectorIcon4: {
    height: Height.height_22,
    width: Width.width_22,
  },
  li4: {
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: Border.br_8,
    elevation: 3,
    boxShadow: BoxShadow.shadow_drop,
    alignSelf: 'stretch',
  },
  submit: {
    textTransform: 'uppercase',
    fontSize: FontSize.fs_14,
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
  },
  ul2: {
    gap: 8,
  },
  li5: {
    padding: Padding.padding_8,
    gap: Gap.gap_6,
    backgroundColor: COLORS.colorWhite,
    alignSelf: 'stretch',
  },
  col3: {
    justifyContent: 'space-between',
    gap: Gap.gap_20,
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  badge: {
    paddingHorizontal: Padding.padding_5,
    paddingVertical: Padding.padding_1,
    borderRadius: Border.br_5,
    backgroundColor: 'transparent',
  },
  pit001: {
    lineHeight: LineHeight.lh_18,
    color: COLORS.colorWhite,
    textAlign: 'left',
    fontSize: FontSize.fs_12,
  },
  vectorIcon7: {
    height: Height.height_20,
    width: Width.width_20,
  },
  pip: {
    alignSelf: 'stretch',
  },
  card: {
    gap: Gap.gap_4,
    alignSelf: 'stretch',
  },
  landmarkNearAlaknandaContainer: {
    alignSelf: 'stretch',
  },
  txtInputStyle: {
    paddingVertical: SIZE.MS(10),
    borderColor: COLORS.colorAliceblue,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: SIZE.MS(10),
  },
  disabledInput: {
    backgroundColor: '#F5F5F5',
    color: '#888',
    opacity: 0.9,
  },
  landmark: {
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
  },
  nearAlaknandaMarket: {
    fontFamily: FontFamily.switzer,
  },
  nearAlaknandaMarket2: {
    fontSize: FontSize.fs_12,
    alignSelf: 'stretch',
  },
  row2: {
    alignItems: 'center',
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  control: {
    gap: Gap.gap_5,
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
  },
  latitude: {
    letterSpacing: LetterSpacing.ls_0_2,
    color: COLORS.colorDarkslategray,
  },
  text8: {
    color: COLORS.colorDeepskyblue,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    alignSelf: 'stretch',
  },

  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  backIcon: {
    width: 24,
    height: 24,
  },
  pitLocationMaster: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    letterSpacing: -0.4,
    lineHeight: 23,
    color: COLORS.colorDarkslategray,
    fontFamily: FontFamily.switzer,
    fontWeight: '500',
  },
  rightPlaceholder: {
    width: 40,
  },
  add3: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.colorAliceblue,
    borderRadius: Border.br_8,
    paddingLeft: 12,
    paddingRight: 6,
    backgroundColor: COLORS.colorWhite,
    minHeight: 44,
  },

  pitInput: {
    flex: 1,
    fontSize: FontSize.fs_14,
    fontFamily: FontFamily.switzer,
    color: COLORS.colorDarkslategray,
  },

  checkBtn: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },

  checkBtnText: {
    color: COLORS.colorWhite,
    fontSize: 12,
    fontWeight: '500',
    fontFamily: FontFamily.switzer,
  },
  close: {
    color: 'red',
  },
});
export default styles;
