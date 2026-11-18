// import React, {FC} from 'react';
// import {
//   StyleSheet,
//   Image,
//   Pressable,
//   Text,
//   View,
//   ScrollView,
// } from 'react-native';
// import {ScreenProps} from '@types';
// import {Screen} from '@organisms';
// import {COLORS, IMAGES, FONTS} from '@res';
// import {Padding} from '../../res/globalStyle';

// type StockOption = {
//   key: string;
//   label: string;
//   icon: any;
//   onPress: () => void;
// };
// const ProjectToProjectScreen: FC<ScreenProps.ProjectToProjectScreen> = ({
//   navigation,
//   route,
// }) => {
//   const stockOptions: StockOption[] = [
//     {
//       key: 'requirement',
//       label: 'Requirement',
//       icon: IMAGES.InstallationIcon,
//       onPress: () => navigation.navigate('RequirementScreen'),
//     },
//     {
//       key: 'sending',
//       label: 'Sending',
//       icon: IMAGES.InstallationIcon,
//       onPress: () => navigation.navigate('SendingScreen'),
//     },
//     {
//       key: 'receiving',
//       label: 'Receiving',
//       icon: IMAGES.InstallationIcon,
//       onPress: () => navigation.navigate('ReceivingScreen'),
//     },
//   ];
//   return (
//     <Screen
//       preset="scroll"
//       statusBgColor={COLORS.BACKGROUND_DEFAULT}
//       statusBarStyle={'dark'}>
//       <ScrollView showsVerticalScrollIndicator={false}>
//         <View style={styles.body}>
//           <View style={styles.main}>
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
//               <Text style={styles.cutCss}>Select Stock Option</Text>
//               <View style={styles.rightPlaceholder} />
//             </View>

//             <View style={styles.illustrationWrap}>
//               <Image
//                 style={styles.illustration}
//                 resizeMode="contain"
//                 source={IMAGES.requirementIcon}
//               />
//               <Text style={styles.illustrationLabel}>Project to Project</Text>
//             </View>

//             <View style={styles.optionsWrap}>
//               {stockOptions.map(option => (
//                 <Pressable
//                   key={option.key}
//                   style={({pressed}) => [
//                     styles.optionBtn,
//                     pressed && styles.optionBtnPressed,
//                   ]}
//                   onPress={option.onPress}>
//                   <View style={styles.optionIconWrap}>
//                     <Image
//                       style={styles.optionIcon}
//                       resizeMode="contain"
//                       source={option.icon}
//                     />
//                   </View>
//                   <Text style={styles.optionLabel}>{option.label}</Text>
//                 </Pressable>
//               ))}
//             </View>
//           </View>
//         </View>
//       </ScrollView>
//     </Screen>
//   );
// };

// export default ProjectToProjectScreen;

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },
//   body: {
//     height: '100%',
//     paddingHorizontal: Padding.padding_16,
//     paddingTop: 12,
//     flex: 1,
//     width: '100%',
//   },
//   main: {
//     gap: 22,
//     alignSelf: 'stretch',
//     flex: 1,
//   },
//   header: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     height: 48,
//     alignSelf: 'stretch',
//   },
//   backBtn: {
//     width: 40,
//     height: 40,
//     justifyContent: 'center',
//     alignItems: 'flex-start',
//   },
//   backIcon: {
//     width: 24,
//     height: 24,
//   },
//   cutCss: {
//     flex: 1,
//     textAlign: 'center',
//     fontSize: 18,
//     letterSpacing: -0.4,
//     lineHeight: 23,
//     color: COLORS.colorDarkslategray,
//     fontFamily: FONTS.REGULAR,
//     fontWeight: '500',
//   },
//   rightPlaceholder: {
//     width: 40,
//   },
//   illustrationWrap: {
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginTop: 24,
//   },
//   illustration: {
//     width: 240,
//     height: 220,
//   },
//   illustrationLabel: {
//     marginTop: 16,
//     fontSize: 13,
//     letterSpacing: 0.6,
//     textTransform: 'uppercase',
//     color: COLORS.PRIMARY,
//     fontFamily: FONTS.MEDIUM,
//     fontWeight: '600',
//   },
//   optionsWrap: {
//     gap: 14,
//     marginTop: 'auto',
//     marginBottom: 24,
//   },
//   optionBtn: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     backgroundColor: COLORS.PRIMARY,
//     borderRadius: 10,
//     paddingVertical: 14,
//     paddingHorizontal: 16,
//     gap: 12,
//   },
//   optionBtnPressed: {
//     opacity: 0.85,
//   },
//   optionIconWrap: {
//     width: 28,
//     height: 28,
//     borderRadius: 6,
//     backgroundColor: COLORS.WHITE,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   optionIcon: {
//     width: 18,
//     height: 18,
//   },
//   optionLabel: {
//     flex: 1,
//     fontSize: 15,
//     letterSpacing: 0.4,
//     textTransform: 'uppercase',
//     color: COLORS.WHITE,
//     fontFamily: FONTS.MEDIUM,
//     fontWeight: '600',
//   },
// });
import {StyleSheet, Text, View} from 'react-native';
import React from 'react';
type Props = {};
const index = (props: Props) => {
  return (
    <View>
      <Text>Coming Soon</Text>
    </View>
  );
};

export default index;

const styles = StyleSheet.create({});
