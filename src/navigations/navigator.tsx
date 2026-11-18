// navigator.tsx
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import Login from '@screens/login';
import OtpVerification from '@screens/otp-verification';
import PrivacyPolicy from '@screens/privacy-policy';
import Splash from '@screens/splash';
import {Common, Preferences} from '@utils';
import React, {FC, useEffect, useState} from 'react';
import BottomTab from './bottom-tabs';
import {navigationRef} from './services';
import AttendanceDashboard from '@screens/attendance/attendance-dashboard';
import AttendanceInOut from '@screens/attendance/attendance-mark-inout';
import viewAttendanceReport from '@screens/attendance/view-attendance-report';
import DDAttendanceDashboard from '@screens/attendance/dd-attendance-dashboard';
import DDViewAttendanceReport from '@screens/attendance/dd-view-attendance-report';
import MonthlySalary from '@screens/attendance/payroll/monthly-salary';
import SalaryPaySlip from '@screens/attendance/payroll/salary-pay-slip';
import HolidaysList from '@screens/attendance/holidays-list';
import ContactsList from '@screens/attendance/contacts-list';
import SubmitPatrollerTask from '@screens/patroller-task/submit-patroller-task';
import PatrollerTask from '@screens/patroller-task/patroller-task';
import ChamberComplaintsList from '@screens/chamber-complaint/chamber-complaints-list';
import AddChamberComplaint from '@screens/chamber-complaint/add-chamber-complaint';
import DeveloperPKPScreen from '@screens/dev-pkp';
import CloseTicketScreen from '@screens/tickets/CloseTicketScreen';
import FollowUpScreen from '@screens/tickets/FollowUpScreen';
import TicketDetailsEnhanced from '@screens/tickets/TicketDetails';
import TicketsList from '@screens/tickets/TicketsList';
import {DataType} from '@types';
import {TicketData} from 'src/types/ticket.types';
import OldIRScreen from '@screens/tickets/OldIRScreen';
import NewIRScreen from '@screens/tickets/NewIRScreen';
import MapViewScreen from '@screens/tickets/MapViewScreen';
import {StartTicketScreen} from '@screens/tickets/StartTicketScreen';
import RoadProjectSurvey from '@screens/road-project-survey';
import DistanceCovered from '@screens/distance-covered';
import VideoRecorder from '@screens/VideoRecording';
import ActivityVideoRecorder from '@screens/ActivityVideoRecording';
import TubeCoreDetailsScreen from '@screens/tickets/TubeCoreDetailsScreen';
import ChamberDetailsScreen from '@screens/tickets/ChamberDetailsScreen';
import CustomerPickerScreen from '@screens/CustomerPickerScreen';
import CustomerSearchScreen from '@screens/CustomerSearchScreen';
//import /CustomerPickerScreenNew
import SearchCustomer from '@screens/SearchCustomer';
import ChamberReport from '@screens/ChamberReport';
import ChamberDetails from '@screens/ChamberDetails';
import ProfileScreen from '@screens/ProfileScreen';
import AppModulesScreen from '@screens/AppModulesScreen';
import PitInstallation from '@screens/PitInstallationScreen';
import ChamberListScreen from '@screens/ChamberListScreen';
import ChamberDetailCorrection from '@screens/ChamberDetailCorrection';
import MarkOverTime from '@screens/MarkOverTime';
import OverTime from '@screens/overtime';
import ChamberCouplerInstallation from '@screens/ChamberCouplerInstallation';
import AddNewPIT from '../screens/AddNewPit';
import OverTimeSelect from '@screens/OverTimeSelect';
import ShotInstallation from '@screens/ShotIInstallation';
import AddInstallationFrom from '@screens/AddInstallionFrom';
import AddInstallationToScreen from '@screens/AddInstallationToScreen';
import DssProjectPickerScreen from '@screens/DssProjectPickerScreen';
import ShotIstallationProjectScreen from '@screens/ShotInstallationProjectScreen';
import FiberProjectPickerScreen from '@screens/FiberProjectPickerScreen';
import FiberBlowing from '@screens/FiberBlowing';
import ChamberProjectPickerScreen from '@screens/ChamberProjectPicker';
import AddChamberCouplerInstallation from '@screens/AddChamberandCouplerInstallation';
import AddFiberBlowing from '@screens/AddFiberBlowing';
import StockProjectPickerScreen from '@screens/StockProjectPickerScreen';
import RequirementStockScreen from '@screens/RequirementStockScreen';
import ReceivingStockScreen from '@screens/ReceivingStockScreen';
import ReturnStockScreen from '@screens/ReturnStockScreen';
import EmployeeSelectionScreen from './../components/molecules/EmployeeSelectionScreen';
import {StockNavParams} from '@screens/StockProjectPickerScreen';
import ABDProjectPickerScreen from '@screens/ABDProjectPickerScreen';
import ABDMasterScreen from '@screens/ABDMasterScreen';
import AddABDMasterScreen from '@screens/AddABDMasterScreen';
import HotoCheckList from '@screens/HotoCheckList';
import HotoProjectPickerScreen from '@screens/HotoProjectPickerScreen';
import HotoChamberListScreen from '@screens/HotoChamberListScreen';
import AddCutScreen from '@screens/AddCutScreen';
import TicketChamberReport from '@screens/tickets/TicketChamberReport';
import AlertScreen from '@screens/AlertScreen';
import ContunityScreen from '@screens/ContunityScreen';
import AddLocatingScreen from '@screens/AddLocatingScreen';
import ProjectToProjectScreen from '@screens/ProjectToProjectScreen';
import ChamberMaintenanceScreen from '@screens/ChamberMaintenanceScreen';
import MaintenanceDetailScreen from '@screens/MaintenanceDetailScreen';
import EmployeeVehicleScreen from '@screens/EmployeeVehicleScreen';
import ApplyLeaveScreen from '@screens/ApplyLeaveScreen';
import LeaveStatusScreen from '@screens/LeaveStatusScreen';
import LeaveDetailScreen from '@screens/LeaveDetailScreen';
import type {LeaveDetailRequest} from '@screens/LeaveDetailScreen';
import RequestSubMissionScreen from '@screens/RequestSubMissonScreen';
type VideoRecorderRouteParams = {
  projectId: string;
  latLng: string;
  directionResult: string;
};
type ActivityVideoRecorderRouteParams = {
  projectId: string;
  latLng: string;
  directionResult: string;
};
export interface RootStackParamList {
  Splash: undefined;
  BottomTab: undefined;
  PrivacyPolicy: undefined;
  Login: undefined;
  ChamberReport: undefined;
  SearchCustomer: undefined;
  ProfileScreen: undefined;
  HotoProjectPickerScreen: undefined;
  AlertScreen: undefined;
  AddLocatingScreen: undefined;
  AddInstallationToScreen: {
    projectId: string | number;
    toPitLocationId: number;
    toPitNo: string | number;
    openShotId: number;
    distanceFromToPit: number | null;
    distanceFromToPitLabel: string;
    ductCountData: number | null;
  };
  AddCutScreen: {
    cutAlertLocatingType: string;
  };
  ContunityScreen: {
    id: string;
  };
  ProjectToProjectScreen: undefined;
  ApplyLeaveScreen: undefined;
  LeaveStatusScreen: undefined;
  LeaveDetailScreen: {request: LeaveDetailRequest} | undefined;
  MaintenanceDetailScreen: {
    id: string;
    chamberId: string;
    chamberName: string;
    complaintNo: string;
    ptCode: string;
    routeName: string;
    typeOfWork: string;
    status: string;
    zone: string;
    address: string;
    landmark: string;
    lat: number;
    long: number;
    distanceM: number | null;
    outOfRange?: boolean;
    chamber?: any;
    // Keeps all additional API fields passed using ...item.rawData
    [key: string]: any;
  };
  PitInstallation: {
    pitNo: string | number;
    projectId: number;
    projectCode: string;
    projectName: string;
    vendorID?: string;
    vendorCode?: string;
    vendorName?: string;
    distanceBetweenPits?: number;
    distanceBetweenPitsLabel?: string;
    userLat?: number | null;
    userLng?: number | null;
    prevPitNo?: string;
    nextPitNo?: string;
    prevPitLat?: number | null;
    prevPitLng?: number | null;
    nextPitLat?: number | null;
    nextPitLng?: number | null;
    nextPitId?: number;
    distanceFromNextPit?: number;
    distanceFromNextPitLabel?: string;
  };
  AddInstallationFrom: {
    pitLocationId: string | number;
    pitNo: string | number;
    startPitLat: number | null;
    projectName: string;
    projectCode: string;
    startPitId: number;
    startPitLng: number | null;
    startPitNo: string | number;
    endPitId: number;
    endPitNo: string | number;
    endPitLat: number | null;
    endPitLng: number | null;
    vendorName: string;
    vendorCode?: string;
    distanceFromStartPit: string | number | null;
    distanceFromEndPit: string | number | null;
    distanceFromPrevPit: string | number | null;
    projectId: string | number;
    epRoute: string;
    spRoute: string;
    distanceBetweenPits: number | null;
    distanceBetweenPitsLabel: string;
    userLat: number;
    userLng: number;
  };
  ABDProjectPickerScreen: undefined;
  EmployeeVehicleScreen: undefined;
  AppModulesScreen: undefined;
  ChamberProjectPickerScreen: undefined;
  ShotInstallation: {
    projectId: string;
    projectCode: string;
    projectName: string;
    vendorCode?: string;
    vendorName?: string;
    vendorID?: string;
    distanceFromUser: number;
    spRoute: string;
    epRoute: string;
    //
    operatorId: string;
    locatorId: string;
    machineId: string;
    startPoint: string;
    endPoint: string;
  };
  AddNewPIT: {
    projectId: string;
    projectCode: string;
    projectName: string;
    vendorID: string;
    vendorCode?: string;
    vendorName?: string;
    distanceFromUser: number;
    spRoute: string;
    epRoute: string;
    startPoint: string;
    endPoint: string;
    //
    // operatorId: string;
    // locatorId: string;
    // machineId: string;
  };
  ABDMasterScreen: {
    projectId: string;
    projectCode: string;
    projectName: string;
    vendorID: string;
    vendorCode?: string;
    vendorName?: string;
    distanceFromUser: number;
    spRoute: string;
    epRoute: string;
    startPoint: string;
    endPoint: string;
  };
  //only For Testing
  // AddABDMasterScreen: undefined;
  AddABDMasterScreen: {
    vendorID: string;
    projectId: string;
    fromPitLocationID: string;
    toPitLocationID: string;
    orderNumber: number;
    openShotId: number;
    abdLat: number | null;
    abdLng: number | null;
    distanceFromLastABD: number;
  };
  RequirementStockScreen: {
    projectId: string;
    projectCode: string;
    projectName: string;
    vendorCode?: string;
    vendorName?: string;
    vendorID?: string;
    distanceFromUser: number;
    spRoute: string;
    epRoute: string;
  };
  ReturnStockScreen: {
    projectId: string;
    projectCode: string;
    projectName: string;
    vendorCode?: string;
    vendorName?: string;
    vendorID?: string;
    distanceFromUser: number;
    spRoute: string;
    epRoute: string;
  };
  DssProjectPickerButton: undefined;
  ChamberCouplerInstallation: {
    projectId: string;
    projectCode: string;
    projectName: string;
    vendorID: string;
    vendorCode?: string;
    vendorName?: string;
    distanceFromUser: number;
    spRoute: string;
    epRoute: string;
    startPoint: string;
    endPoint: string;
  };
  HotoChamberListScreen: {
    projectId: string;
    projectCode: string;
    projectName: string;
    vendorID: string;
    vendorCode?: string;
    vendorName?: string;
    distanceFromUser: number;
    spRoute: string;
    epRoute: string;
    startPoint: string;
    endPoint: string;
  };
  FiberBlowing: {
    projectId: string;
    projectCode: string;
    projectName: string;
    vendorID: string;
    vendorCode?: string;
    vendorName?: string;
    distanceFromUser: number;
    spRoute: string;
    epRoute: string;
    startPoint: string;
    endPoint: string;
  };
  AddFiberBlowing: {
    pitType: string;
    projectId: string;
    projectCode: string;
    projectName: string;
    vendorId: string;
    vendorCode?: string;
    vendorName?: string;
    distanceFromUser: number;
    pitLocationId: number | null;
    pitId: number | null;
    pitNo: string | number;
    sldeReportData: any;
    // colorId: number;
    loopData: number; // FIXED
    // colorName: string;
    ductNo: number;
    vendorStoreId: number;
    fibreTypeId: number;
    fromChamberInstallationId: number | null;
    toChamberInstallationId: number | null;
    CurrentChamberInstallationId: number | null;
    previousPitInstallationId: number | null; // FIXED
    nextPitInstallationId: number | null; // FIXED
  };
  AddChamberCouplerInstallation: {
    projectId: string;
    pitLocationId: string | number;
    pitNo: string | number;
    projectName: string;
    projectCode: string;
    vendorId: string | number;
    vendorCode?: string;
    vendorName?: string;
    shotId: string | number;
    //newly added
    // lat: number | null;
    // lng: number | null;
  };
  HotoCheckList: {
    projectId: string;
    pitLocationId: string | number;
    pitNo: string | number;
    projectName: string;
    projectCode: string;
    // vendorId: string | number;
    vendorCode?: string;
    vendorName?: string;
    shotId: string | number;
    chamberId: string | number;
    fiberType: string | number;
    //newly added
    // lat: number | null;
    // lng: number | null;
  };
  ChamberDetails: {
    chamberId: string;
    chamberName: string;
    latitude: number;
    longitude: number;
    address?: string;
  };
  OtpVerification: {userId: string; password: string; appType: string};
  AttendanceDashboard: {
    shiftType: DataType.ShiftType;
    isViewAllow: boolean;
    isMarkAllow: boolean;
  };
  RoadProject: {};
  AttendanceInOut: {
    from: 'in' | 'out';
    shiftType: DataType.ShiftType;
    behalfOfData: DataType.TodayBehalfOf | null;
  };
  ViewAttendanceReport: undefined;
  TicketChamberReport: {
    routeId: string;
    chamberNo: number;
  };
  DDAttendanceDashboard: {
    shiftType: DataType.ShiftType;
    isViewAllow: boolean;
    isMarkAllow: boolean;
  };
  DDViewAttendanceReport: undefined;
  RequestSubMissionScreen:
    | {
        request: LeaveDetailRequest;
        leaveRequestType: 'Emergency Leave' | 'Planned Leave';
      }
    | undefined;
  MonthlySalary: undefined;
  SalaryPaySlip: undefined;
  HolidaysList: undefined;
  ContactsList: undefined;
  OverTimeSelect: undefined;
  //
  PatrollerTask: undefined;
  SubmitPatrollerTask: {
    empID: number;
    selectedChamber: DataType.Chamber | null;
    currentPosition: DataType.Coords | null;
  };
  ChamberComplaintsList: undefined;
  AddChamberComplaint: undefined;
  DeveloperPKPScreen: undefined;
  ChamberMaintenanceScreen: undefined;
  TicketsList: {
    empData: DataType.EmployeeDetails | null;
  };
  ChamberDetailsScreen: {
    customerName?: string;
    circuitName?: string;
    companyCode?: string;
  };
  EmployeeSelectionScreen: {
    selected: any[];
    onSelect: (data: any[]) => void;
  };
  OverTime: undefined;
  MarkOverTime: {
    from?: 'in' | 'out';
    shiftType?: DataType.ShiftType;
    selectedTickets?: string[];
    behalfOfData?: DataType.TodayBehalfOf | null;
  };
  StockProjectPickerScreen: undefined;
  TicketDetails: {
    ticketId: string;
    priority: string;
    comingFrom: string;
    empData: DataType.EmployeeDetails | null;
  };
  TicketFollowUp: {
    ticketId: string;
    ticketData: TicketData;
  };
  FollowUpScreen: {
    ticketId: string;
    ticketData: TicketData;
    onReturn?: () => void;
  };
  ChamberSelection: {
    ticketId: string;
    currentLocation: {lat: number; lng: number};
  };
  CloseTicketScreen: {
    ticketId: string;
    ticketData: any;
  };
  FiberProjectPickerScreen: undefined;
  ChamberListScreen: undefined;
  ChamberDetailCorrection: {
    chamberData: any;
  };
  // CustomerPickerScreen: {
  //   data: {label: string; value: string; icon?: any}[];
  //   selectedValue: string | null;
  //   onSelect: (v: string) => void;
  // };
  CustomerPickerScreen: {
    data: any[];
    selectedValue: string;
    onSelect: (val: string) => void;
  };
  CustomerSearchScreen: {
    data: any[];
    selectedValue: string;
    onSelect: (val: string) => void;
  };
  OldIRScreen: {ticketId: string};
  NewIRScreen: {ticketId: string; chamberDetails?: any};
  TubeCoreDetailsScreen: {issueTypeId: string; ticketId: string};
  MapViewScreen: {latitude: number; longitude: number; title: string};
  IRDetailsScreen: {irId: string; ticketId: string; irData: any};
  VideoRecorder: VideoRecorderRouteParams;
  ActivityVideoRecording: ActivityVideoRecorderRouteParams;
  [key: string]: any;
}
const Stack = createNativeStackNavigator<RootStackParamList>();
// Recursively read the deepest active route name (works for nested navigators)
const RootStack: FC<{initialRoute: string}> = ({initialRoute}) => {
  return (
    <Stack.Navigator
      screenOptions={{headerShown: false}}
      initialRouteName={initialRoute}>
      <Stack.Screen name="Splash" component={Splash} />
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="BottomTab" component={BottomTab} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicy} />
      <Stack.Screen name="OtpVerification" component={OtpVerification} />
      <Stack.Screen name="AttendanceInOut" component={AttendanceInOut} />
      <Stack.Screen
        name="ViewAttendanceReport"
        component={viewAttendanceReport}
      />
      <Stack.Screen
        name="AttendanceDashboard"
        component={AttendanceDashboard}
      />
      <Stack.Screen
        name="ABDProjectPickerScreen"
        component={ABDProjectPickerScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ABDMasterScreen"
        component={ABDMasterScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="AddABDMasterScreen"
        component={AddABDMasterScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="DDAttendanceDashboard"
        component={DDAttendanceDashboard}
      />
      <Stack.Screen
        name="DDViewAttendanceReport"
        component={DDViewAttendanceReport}
      />
      <Stack.Screen
        name="CustomerPickerScreen"
        component={CustomerPickerScreen}
        options={{
          headerShown: false,
          animation: 'fade',
        }}
      />
      <Stack.Screen
        name="CustomerSearchScreen"
        component={CustomerSearchScreen}
      />
      <Stack.Screen name="MonthlySalary" component={MonthlySalary} />
      <Stack.Screen name="SalaryPaySlip" component={SalaryPaySlip} />
      <Stack.Screen name="HolidaysList" component={HolidaysList} />
      <Stack.Screen name="ContactsList" component={ContactsList} />
      <Stack.Screen name="VideoRecorder" component={VideoRecorder} />
      <Stack.Screen
        name="ActivityVideoRecorder"
        component={ActivityVideoRecorder}
      />
      <Stack.Screen name="PatrollerTask" component={PatrollerTask} />
      <Stack.Screen
        name="SubmitPatrollerTask"
        component={SubmitPatrollerTask}
      />
      <Stack.Screen name="ChamberDetails" component={ChamberDetails} />
      <Stack.Screen
        name="ChamberComplaintsList"
        component={ChamberComplaintsList}
      />
      <Stack.Screen
        name="AddChamberComplaint"
        component={AddChamberComplaint}
      />
      <Stack.Screen name="SearchCustomer" component={SearchCustomer} />
      <Stack.Screen name="RoadProject" component={RoadProjectSurvey} />
      <Stack.Screen name="DistanceCovered" component={DistanceCovered} />
      <Stack.Screen name="PitInstallation" component={PitInstallation} />
      <Stack.Screen name="DeveloperPKPScreen" component={DeveloperPKPScreen} />
      <Stack.Screen name="MarkOverTime" component={MarkOverTime} />
      <Stack.Screen name="OverTimeSelect" component={OverTimeSelect} />
      <Stack.Screen
        name="ChamberCouplerInstallation"
        component={ChamberCouplerInstallation}
      />
      <Stack.Screen
        name="HotoChamberListScreen"
        component={HotoChamberListScreen}
      />
      <Stack.Screen
        name="RequestSubMissionScreen"
        component={RequestSubMissionScreen}
      />
      <Stack.Screen
        name="AddChamberCouplerInstallation"
        component={AddChamberCouplerInstallation}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="TicketsList"
        component={TicketsList}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ChamberDetailsScreen"
        component={ChamberDetailsScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ChamberReport"
        component={ChamberReport}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="HotoProjectPickerScreen"
        component={HotoProjectPickerScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen name="StartTicketScreen" component={StartTicketScreen} />
      <Stack.Screen
        name="TicketDetails"
        component={TicketDetailsEnhanced}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="FollowUpScreen"
        component={FollowUpScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ProfileScreen"
        component={ProfileScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="AppModulesScreen"
        component={AppModulesScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="CloseTicketScreen"
        component={CloseTicketScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="OldIRScreen"
        component={OldIRScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="AddCutScreen"
        component={AddCutScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="NewIRScreen"
        component={NewIRScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="TubeCoreDetailsScreen"
        component={TubeCoreDetailsScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="MapViewScreen"
        component={MapViewScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ChamberListScreen"
        component={ChamberListScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="MaintenanceDetailScreen"
        component={MaintenanceDetailScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="OverTime"
        component={OverTime}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ChamberDetailCorrection"
        component={ChamberDetailCorrection}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="EmployeeVehicleScreen"
        component={EmployeeVehicleScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="AddNewPIT"
        component={AddNewPIT}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ShotInstallation"
        component={ShotInstallation}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="DssProjectPickerScreen"
        component={DssProjectPickerScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ShotIstallationProjectScreen"
        component={ShotIstallationProjectScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="AddInstallationFrom"
        component={AddInstallationFrom}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="AddInstallationToScreen"
        component={AddInstallationToScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="FiberProjectPickerScreen"
        component={FiberProjectPickerScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="FiberBlowing"
        component={FiberBlowing}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="AddFiberBlowing"
        component={AddFiberBlowing}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ChamberProjectPickerScreen"
        component={ChamberProjectPickerScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="HotoCheckList"
        component={HotoCheckList}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="StockProjectPickerScreen"
        component={StockProjectPickerScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="RequirementStockScreen"
        component={RequirementStockScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ProjectToProjectScreen"
        component={ProjectToProjectScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ReceivingStockScreen"
        component={ReceivingStockScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="ReturnStockScreen"
        component={ReturnStockScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="EmployeeSelectionScreen"
        component={EmployeeSelectionScreen}
      />
      <Stack.Screen
        name="TicketChamberReport"
        component={TicketChamberReport}
      />
      <Stack.Screen
        name="ChamberMaintenanceScreen"
        component={ChamberMaintenanceScreen}
      />
      <Stack.Screen name="ContunityScreen" component={ContunityScreen} />
      <Stack.Screen name="AlertScreen" component={AlertScreen} />
      <Stack.Screen name="AddLocatingScreen" component={AddLocatingScreen} />
      <Stack.Screen name="ApplyLeaveScreen" component={ApplyLeaveScreen} />
      <Stack.Screen name="LeaveStatusScreen" component={LeaveStatusScreen} />
      <Stack.Screen name="LeaveDetailScreen" component={LeaveDetailScreen} />
    </Stack.Navigator>
  );
};

const RootNavigator = ({}) => {
  const [initialRoute, setInitialRoute] = useState('');
  const getActiveRouteName = (state: any): string | undefined => {
    if (!state) return undefined;
    const route = state.routes?.[state.index ?? 0];
    if (route?.state) return getActiveRouteName(route.state);
    return route?.name;
  };
  // const getActiveRouteName = (state: any): string | undefined => {
  //   if (!state) return undefined;
  //   const route = state.routes?.[state.index ?? 0];
  //   if (route?.state) return getActiveRouteName(route.state);
  //   return route?.name;
  // };
  useEffect(() => {
    const token = Preferences.getData('API_AUTH_TOKEN') ?? null;
    const timer = setTimeout(() => {
      if (token === null || token === undefined) {
        console.log('token', token);
        setInitialRoute('Login');
      } else {
        setInitialRoute('BottomTab');
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, []);
  if (initialRoute === '') {
    return <Splash />;
  }
  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        // Common.log('RootNavigator is ready');
      }}
      onStateChange={state => {
        try {
          const forced = Preferences.getData('FORCE_UPDATE_REQUIRED') === 'yes';
          if (!forced) return;
          const active = getActiveRouteName(state);
          const BLOCKED_TABS = new Set(['Account', 'Settings']);
          if (active && BLOCKED_TABS.has(active)) {
            Common.showToast(
              'Update to Latest App version to access other Tabs',
            );
            navigationRef.current?.navigate('BottomTab', {screen: 'Home'});
          }
        } catch (e) {}
      }}>
      <RootStack initialRoute={initialRoute} />
    </NavigationContainer>
  );
};
export default RootNavigator;
// eslint-disable-next-line no-lone-blocks
{
  /*
  <Button onPress={() => navigation.goBack()}>Go back</Button>
  <Button onPress={() => navigation.popTo('Home')}>Go to Home</Button>
  <Button onPress={() => navigation.popToTop()}>
    Go back to first screen in stack
  </Button>
      */
}
