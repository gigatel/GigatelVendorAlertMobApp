//screen-props.tsx
import { TabRootParamList } from '@navigation/bottom-tabs';
import { NativeStackScreenProps, NativeStackView } from '@react-navigation/native-stack';
import { } from './data-types';
import { RootStackParamList } from '@navigation/navigator';
import { DataType } from '@types';
import ProfileScreen from '@screens/ProfileScreen';
//! Common Screen Props
interface Loading {
  loading?: boolean
}
//!=============== PrivacyPolicy ===============!//
export interface PrivacyPolicyParams extends Loading { }
export type PrivacyPolicy = NativeStackScreenProps<
  RootStackParamList,
  'PrivacyPolicy'
> & PrivacyPolicyParams
export interface DeveloperPKPScreenParams extends Loading {
}
export interface ChamberMaintenanceScreenParams extends Loading {
  
}
export interface MaintenanceDetailScreenParams extends Loading {

}
export type DeveloperPKPScreen = NativeStackScreenProps<
  RootStackParamList,
  'DeveloperPKPScreen'
> & DeveloperPKPScreenParams
export interface TicketListParams extends Loading {
    empData: DataType.EmployeeDetails | null;
}
export interface DssProjectPickerScreenParams extends Loading {
  
}
export interface AddLocatingScreenParams extends Loading {
  
}
export interface ApplyLeaveScreenParams extends Loading {
  
}

export interface LeaveStatusScreenParams extends Loading {
  
}
export interface LeaveDetailScreenParams extends Loading {
  
}

export type LeaveDetailScreen = NativeStackScreenProps<
  RootStackParamList,
  'LeaveDetailScreen'
> & LeaveDetailScreenParams;
export type ApplyLeaveScreen = NativeStackScreenProps<
  RootStackParamList,
  'ApplyLeaveScreen'
> & ApplyLeaveScreenParams;
export type LeaveStatusScreen = NativeStackScreenProps<
  RootStackParamList,
  'LeaveStatusScreen'
> & LeaveStatusScreenParams;

export interface EmployeeVehicleScreenParams extends Loading {
  
}
export type EmployeeVehicleScreen = NativeStackScreenProps<
'RootStackParamList',
"EmployeeVehicleScreen",
> & EmployeeVehicleScreenParams;
export type AddLocatingScreen = NativeStackScreenProps<
  'RootStackParamList',
  'AddLocatingScreen'
>  & AddLocatingScreenParams;
export type ChamberMaintenanceScreen = NativeStackScreenProps<
'RootStackParamList',
'ChamberMaintenanceScreen'
> & ChamberMaintenanceScreenParams;
export interface HotoProjectPickerScreenParams extends Loading {

}
export interface SearchCustomerParams extends Loading {

}
export interface ChamberReportParams extends Loading {
  
}
export interface ABDProjectPickerScreenParams extends Loading {

}
export interface ABDMasterScreenParams extends Loading {

}
export interface AlertScreenParams extends Loading {

} 
export interface ProjectToProjectScreenParams extends Loading {

}
export interface AddABDMasterParams extends Loading {
  
}
export interface AddCutScreenParams extends Loading {
  
}
export type AddCutScreen = NativeStackScreenProps<
  'RootStackParamList',
  'AddCutScreen'
> & AddCutScreenParams;
export type ProjectToProjectScreen = NativeStackScreenProps<
'RootStackParamList',
'ProjectToProjectScreen'
> & ProjectToProjectScreenParams;
export type AddABDMasterScreen = NativeStackScreenProps<
  'RootStackParamList',
  'AddABDMasterScreen'
> & AddABDMasterParams;
export type MaintenanceDetailScreen = NativeStackScreenProps<
'RootStackParamList',
'MaintenanceDetailScreen'
> & MaintenanceDetailScreenParams;
export type ABDMasterScreen = NativeStackScreenProps<
  'RootStackParamList',
  'ABDMasterScreen'
> & ABDMasterScreenParams;
export type ABDProjectPickerScreen = NativeStackScreenProps<
  'RootStackParamList',
  'ABDProjectPickerScreen'
> & ABDProjectPickerScreenParams;
export type TicketsList = NativeStackScreenProps<
  RootStackParamList,
  'TicketsList'
> & TicketListParams;
export type AlertScreen = NativeStackScreenProps<
  RootStackParamList,
  'AlertScreen'> & AlertScreenParams;
export type DssProjectPickerScreen = NativeStackScreenProps<
  RootStackParamList,
  'DssProjectPickerScreen'> & DssProjectPickerScreenParams;
export type HotoProjectPickerScreen = NativeStackScreenProps<
RootStackParamList,
'HotoProjectPickerScreen'> & HotoProjectPickerScreenParams;
  export type SearchCustomer = NativeStackScreenProps<
  RootStackParamList,
  'SearchCustomer'> & SearchCustomerParams;
export type ChamberReport = NativeStackScreenProps<
  RootStackParamList,
  'ChamberReport'> & ChamberReportParams;
//!=============== Login ===============!//
export interface LoginParams extends Loading {
}
export type Login = NativeStackScreenProps<
  RootStackParamList,
  'Login'
> & LoginParams
//!=============== OtpVerification ===============!//
export interface OtpVerificationParams extends Loading {
}
export interface ChamberListParams extends Loading {
  
} 
export type  ChamberListScreen = NativeStackScreenProps< 
   RootStackParamList,
   'ChamberListScreen'
   > & ChamberListParams
export interface ChamberCorrectionDetailParams extends Loading {

};
export interface ContunityScreenParams extends Loading {
  
}
export type ContunityScreen = NativeStackScreenProps<
  RootStackParamList,
  'ContunityScreen'
> & ContunityScreenParams;
export type ChamberCorrectionDetail = NativeStackScreenProps<
RootStackParamList,
'ChamberDetailCorrection'
> & ChamberCorrectionDetailParams;
export type OtpVerification = NativeStackScreenProps<
  RootStackParamList,
  'OtpVerification'
> & OtpVerificationParams
//! ******** Chamber Complaint **********\\
export interface AddChamberComplaintParams extends Loading {
  data: DataType.ChamberComplaint[]
  totalPage: number
  nextChamberData: DataType.NearestChamber[] | null
  chamberAlerts: DataType.IdName[] | null
  empData: DataType.EmployeeDetails | null
}
export type AddChamberComplaint = NativeStackScreenProps<
  RootStackParamList,
  'AddChamberComplaint'
> & AddChamberComplaintParams

export interface ChamberComplaintsListParams extends Loading {
  data: DataType.ChamberComplaint[]
  totalPage: number
}
export type ChamberComplaintsList = NativeStackScreenProps<
  RootStackParamList,
  'ChamberComplaintsList'
> & ChamberComplaintsListParams

//! ******** Patroller Task **********\\
export interface SubmitPatrollerTaskParams extends Loading {
  taskData: DataType.SubmitPatrollerTask | null
}
export type SubmitPatrollerTask = NativeStackScreenProps<
  RootStackParamList,
  'SubmitPatrollerTask'
> & SubmitPatrollerTaskParams

export interface RoadProjectSurveyParams extends Loading {
  taskData: DataType.PatrollerTask | null
  empData: DataType.EmployeeDetails | null
  tdd: DataType.TodayDoubleDuty | null
  isAllTaskSubmitted: boolean
}
export interface DetailsChamberParams extends Loading {
  
}
export interface DssProjectPickerParams extends Loading {

}
export interface DetailsChamberParams extends Loading {
  
}
export interface RequirementStockParams extends Loading {
  
}
export interface ReturnStockParams extends Loading {
  
}
export type StockRequirement = NativeStackScreenProps<
'RootStackParamList',
"StockRequirement"> & RequirementStockParams;
export type StockReturn = NativeStackScreenProps<
'RootStackParamList',
"ReturnStockScreen"> & ReturnStockParams;

export interface DistanceCoveredParams extends Loading {
//
}
export interface PatrollerTaskParams extends Loading {
  taskData: DataType.PatrollerTask | null
  empData: DataType.EmployeeDetails | null
  tdd: DataType.TodayDoubleDuty | null
  isAllTaskSubmitted: boolean
}
export interface ChamberCouplerInstallationParams extends Loading {
  
}

export interface HotoChamberListScreenParams extends Loading {
  
}

export interface FiberInstallationParams extends Loading {
  
}
export interface ReceivingStockParams extends Loading {

}
export interface ReturnStockParams extends Loading {

}

export interface FiberBlowingParams extends Loading {
  
}

export interface AddFiberBlowingParams extends Loading {
  
}
export type AddFiberBlowing = NativeStackScreenProps<
RootStackParamList,
"AddFiberBlowing"> & AddFiberBlowingParams; 

export type FiberBlowing = NativeStackScreenProps<
RootStackParamList,
"FiberBlowing"> & FiberBlowingParams;

export type FiberInstallationProjectPicker = NativeStackScreenProps<
RootStackParamList,
"FiberProjectPickerScreen"> & FiberInstallationParams;
 
export type ReceivingStockScreen = NativeStackScreenProps<
RootStackParamList,
"ReceivingStockScreen"> & ReceivingStockParams;

export type ReturnStockScreen = NativeStackScreenProps<
RootStackParamList,
> & ReturnStockParams;
export interface AddNewPitParams extends Loading {
  
}

export type AddNewPIT = NativeStackScreenProps<
RootStackParamList,
'AddNewPIT'
> & AddNewPitParams;
export type DssProjectPickerButton = NativeStackScreenProps<
  RootStackParamList,
  'DssProjectPickerButton'
  > & DssProjectPickerButtonParams;
export interface StockProjectPickerParams extends Loading {

} 
export type StockProjectPickerScreen = NativeStackScreenProps<
RootStackParamList,
'StockProjectPickerScreen'
> & StockProjectPickerParams
export interface ShotInstallationParams extends Loading {
  
}
export type ShotInstallation = NativeStackScreenProps<
  RootStackParamList,
  'ShotInstallation'
> & ShotInstallationParams;  

export type ChamberCouplerInstallation = NativeStackScreenProps<
  RootStackParamList,
  'ChamberCouplerInstallation'
> & ChamberCouplerInstallationParams;

export type HotoChamberListScreen = NativeStackScreenProps<
RootStackParamList,
'HotoChamberListScreen'
> & HotoChamberListScreenParams;
export type PatrollerTask = NativeStackScreenProps<
  RootStackParamList,
  'PatrollerTask'
> & PatrollerTaskParams

export type RoadProjectTask = NativeStackScreenProps<
  RootStackParamList,
  'RoadProjectTask'
> & RoadProjectSurveyParams;
export type ChamberDetails = NativeStackScreenProps<
RootStackParamList,
  'ChamberDetails'
  > & DetailsChamberParams
export type DetailsChamberScreen = NativeStackScreenProps<
  RootStackParamList,
  'DetailsChamberScreen'
> & DetailsChamberParams;
export interface ChamberProjectPickerParams extends Loading {
//
}
export interface RequestSubmissionParams extends Loading {

}
export type RequestSubmissionScreen = NativeStackScreenProps<
 RootStackParamList,
 'RequestSubMissionScreen'
> & RequestSubmissionParams;
export type ChamberProjectPickerScreen = NativeStackScreenProps<
  RootStackParamList,
  'ChamberProjectPickerScreen'
> & ChamberProjectPickerParams;
export type DistanceCoveredTask = NativeStackScreenProps<
  RootStackParamList,
  'DistanceCoveredTask'
> & DistanceCoveredParams
//! ******** Payroll **********\\
export interface SalaryPaySlipParams extends Loading {
  compId: number | null,
  data: DataType.MonthlySalary | null,

}
export type SalaryPaySlip = NativeStackScreenProps<
  RootStackParamList,
  'SalaryPaySlip'
> & SalaryPaySlipParams

export interface MonthlySalaryParams extends Loading {
  empId: number | null,
  data: DataType.MonthlySalary | null,

}
export type MonthlySalary = NativeStackScreenProps<
  RootStackParamList,
  'MonthlySalary'
> & MonthlySalaryParams


//! ******** Attendance Module **********\\
export interface AttendanceDashboardParams extends Loading {
  calenderAttData: DataType.AttendanceData[] | null
  empData: DataType.EmployeeDetails | null
  todayAttData: DataType.AttendanceData | null
  todayDuty: DataType.TodayDuty | null
  employeeShift: DataType.EmployeeShift | null
  todayDoubleDuty: DataType.TodayDoubleDuty | null
  todayWorkingOnBehalfData?: DataType.TodayBehalfOf[] | null
  attendancePolicy?: DataType.AttendancePolicy | null
}
export type AttendanceDashboard = NativeStackScreenProps<
  RootStackParamList,
  'AttendanceDashboard'
> & AttendanceDashboardParams

export interface AttendanceInOutParams extends Loading {
  todayAttData: DataType.AttendanceData | null
  empData: DataType.EmployeeDetails | null
  attData?: DataType.Attendance | null
  todayDoubleDuty: DataType.TodayDoubleDuty | null
  todayWorkingOnBehalfData: DataType.TodayBehalfOf[] | null
  todayDuty?: DataType.TodayDuty | null
  allowedShifts: DataType.AllowedShift[] | []
}
export type AttendanceInOut = NativeStackScreenProps<
  RootStackParamList,
  'AttendanceInOut'
> & AttendanceInOutParams

export interface ViewAttendanceReportParams extends Loading {
  data: DataType.AttendanceInOutReport[] | null
}

export type ViewAttendanceReport = NativeStackScreenProps<
  RootStackParamList,
  'ViewAttendanceReport'
> & ViewAttendanceReportParams

export interface DDAttendanceDashboardParams extends Loading {
  calenderAttData: DataType.AttendanceData[] | null
  empData: DataType.EmployeeDetails | null
  todayAttData: DataType.AttendanceData | null
  todayDuty: DataType.TodayDuty | null
  employeeShift: DataType.EmployeeShift | null
  allowedShifts?: DataType.AllowedShift[] | null
  todayDoubleDuty: DataType.TodayDoubleDuty | null
  todayWorkingOnBehalfData?: DataType.TodayBehalfOf[] | null
  attendancePolicy?: DataType.AttendancePolicy | null
}
export type DDAttendanceDashboard = NativeStackScreenProps<
  RootStackParamList,
  'DDAttendanceDashboard'
> & DDAttendanceDashboardParams

export interface DDAttendanceInOutParams extends Loading {
}
export type DDAttendanceInOut = NativeStackScreenProps<
  RootStackParamList,
  'DDAttendanceInOut'
> & DDAttendanceInOutParams

export interface DDViewAttendanceReportParams extends Loading {
  data: DataType.AttendanceInOutReport[] | null
}

export type DDViewAttendanceReport = NativeStackScreenProps<
  RootStackParamList,
  'DDViewAttendanceReport'
> & DDViewAttendanceReportParams

export interface HolidaysListParams extends Loading {
  data: DataType.HolidayList[] | []
}
export type HolidaysList = NativeStackScreenProps<
  RootStackParamList,
  'HolidaysList'
> & HolidaysListParams
export interface ContactsListParams extends Loading {
  data: DataType.EmployeeDetails[] | []
}
export type ContactsList = NativeStackScreenProps<
  RootStackParamList,
  'ContactsList'
> & ContactsListParams

export interface OverTimeParams extends Loading {
  OverTimeList: DataType.OverTimeResponse | null
}
export interface MarkOverTimeParams extends Loading {
  
}
export interface OverTimeSelectParams extends Loading {
  
}
export type OverTimeSelect = NativeStackScreenProps<
  RootStackParamList,
  'OverTimeSelect'
> & OverTimeSelectParams;
export type MarkOverTime = NativeStackScreenProps<
  RootStackParamList,
  'MarkOverTime'  
> & MarkOverTimeParams
export type OverTime = NativeStackScreenProps<
RootStackParamList,
'OverTime'
> & OverTimeParams;
//! ******** Bottom Tabs **********\\
//?=============== Home ===============?//
export interface HomeParams extends Loading {
  dashboardList: DataType.DasboardResponse | null,
  employeeDetails: DataType.EmployeeDetails | undefined
}
export type Home = NativeStackScreenProps<
  TabRootParamList & RootStackParamList,
  'Home'
> & HomeParams

//?=============== Account ===============?//
export interface AccountParams extends Loading {
  employeeDetails: DataType.EmployeeDetails | undefined
  appModules: DataType.AllowedModule | null
}
export interface ShotInstallationProjectScreenParams extends Loading {
  
}
export type ShotInstallationProjectScreen = NativeStackScreenProps<
 RootStackParamList,
'ShotIstallationProjectScreen'
> & ShotInstallationProjectScreenParams;

export interface ProfileParams extends Loading {
  employeeDetails: DataType.EmployeeDetails | undefined
  appModules: DataType.AllowedModule | null
}
export interface HotoCheckListParams extends Loading {
    employeeDetails: DataType.EmployeeDetails | undefined
}

export interface AppModuleParams extends Loading {
 employeeDetails: DataType.EmployeeDetails | undefined
 appModules: DataType.AllowedModule | null
}
export interface PitInstallationParams extends Loading {
  
}
export interface AddInstallationFromParams extends Loading {
  
}
export interface AddInstallationToParams extends Loading {
  
}
export interface addChamberCouplerInstallationParams extends Loading {
  
}
export type AddChamberCouplerInstallation = NativeStackScreenProps<
 RootStackParamList,
 'AddChamberCouplerInstallation'> & addChamberCouplerInstallationParams;
export type HotoCheckList = NativeStackScreenProps<
RootStackParamList,
'HotoCheckList'> & HotoCheckListParams;
export type AddInstallationFrom = NativeStackScreenProps<
  RootStackParamList,
  'AddInstallationFrom'
> & AddInstallationFromParams;
export type AddInstallationTo = NativeStackScreenProps<
  RootStackParamList,
  'AddInstallationToScreen'
  > & AddInstallationToParams;

export type Account = NativeStackScreenProps<
  TabRootParamList & RootStackParamList,
  'Account'
> & AccountParams
export type ProfileScreen = NativeStackScreenProps<
RootStackParamList,
'ProfileScreen'
> & ProfileParams;
export type AppModuleScreen = NativeStackScreenProps<
RootStackParamList,
'AppModulesScreen'
> & AppModuleParams;
export type PitInstallationScreen = NativeStackScreenProps<
RootStackParamList,
'PitInstallation'
> & PitInstallationParams;

//?=============== Settings ===============?//
export interface SettingsParams extends Loading {
}
export type Settings = NativeStackScreenProps<
  TabRootParamList & RootStackParamList,
  'Settings'
> & SettingsParams

