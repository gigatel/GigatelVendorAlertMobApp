//prod.gigatel.me - PROD
// //Base_url prod
export const BASE_URL = 'http://prod.gigatel.me:40102/api/';
export const BASE_URL_2 = 'http://prod.gigatel.me:40601/api/';
export const BASE_URL_3 = 'http://prod.gigatel.me:40101/api/';
export const BASE_URL_4 = 'http://prod.gigatel.me:40501/api/';
export const BASE_URL_5 = 'http://prod.gigatel.me:60104/api/';
export const BASE_URL_6 = 'http://prod.gigatel.me:40701/api/';
export const BASE_URL_7 = 'http://prod.gigatel.me:40902/api/';
export const BASE_URL_8 = 'http://prod.gigatel.me:60106/api/';
export const swagger = 'http://prod.gigatel.me:40101/';
export const Mode = "PROD";
//Base URL Dev
// export const BASE_URL = 'http://mob.gigatel.me:40102/api/';
// export const BASE_URL_2 = 'http://mob.gigatel.me:40601/api/';
// export const BASE_URL_3 = 'http://mob.gigatel.me:40101/api/';
// export const BASE_URL_4 = 'http://mob.gigatel.me:40501/api/';
// export const BASE_URL_5 = 'http://mob.gigatel.me:60104/api/';
// export const BASE_URL_6 = 'http://mob.gigatel.me:40701/api/';
// export const BASE_URL_7 = 'http://mob.gigatel.me:40902/api/';
// export const BASE_URL_8 = 'http://mob.gigatel.me:60106/api/';
// export const swagger = 'http://mob.gigatel.me:40101/';
// export const Mode = "DEV";
// // ! Accounts
export const DashboardList = BASE_URL + 'AppDashboard/DashboardList2';
export const getPwdEncription = BASE_URL + 'Account/GetPwdEncriptionKeyForUser';
export const getOtp = BASE_URL + 'Account/GetOtp2';
export const getOtp2 = BASE_URL_3 + 'Account/GetOtp';
export const getVendorOtp = BASE_URL_6 + 'Account/GetOtpForDssLogin';
export const UpdateProfileImage = BASE_URL + 'Employee/UpdateEmployeePhoto';
export const upadteGpsAddress = BASE_URL + 'Employee/UpdateEmpGPSAddress';
export const verifyOtp = BASE_URL + 'Account/AppLogin';
export const verifyVendorOtp = BASE_URL_6 + 'Account/Login';
export const selectCompany = BASE_URL + 'Account/SelectCompany';
export const getEmpDeviceList = BASE_URL + 'Account/GetEmpDeviceList';
export const dashboardList = BASE_URL + 'AppDashboard/DashboardList2';
export const getAppModules = BASE_URL + 'Policy/GetUserModuleAppModules?';
export const getDeviceList = BASE_URL_6 + 'Account/GetEmpDeviceList';
export const addDeviceListDetails = BASE_URL + 'Account/AddUserDeviceDetails';
//! Attendance
export const viewAttendance = BASE_URL + 'Attendance/ViewAttendance';
export const viewAttendanceInOutReport = BASE_URL + 'Attendance/ViewInOutReport';
export const todayAttendance = BASE_URL + 'Attendance/TodayAttendance';
export const getTodayWorkingOnBehalf = BASE_URL + 'Attendance/GetTodayWorkingOnBehalf';
export const getEmpZoneChambers = BASE_URL + 'Zone/GetEmpZoneChambers';
export const getEmpOfficeBranches = BASE_URL + 'Branch/GetEmpBranches';
export const markAttendance = BASE_URL + 'Attendance/MarkAttendance';
export const syncOfflineAttendance = BASE_URL + 'Attendance/SyncOfflineAttendance';
//! Payroll
export const monthlyEmpSalary = BASE_URL + 'EmpSalary/MonthalyEmpSalary';
export const apiURLS = BASE_URL + '';
//! Holidays | Contacts
export const getHolidayList = BASE_URL + 'Holiday/GetEmpOptionalHoliday';
export const insertUpdateEmpHolidayRequest = BASE_URL + 'Holiday/InsertUpdateEmpHolidayRequest';
export const getEmployeeListContact = BASE_URL + 'Employee/GetEmployeeListForContact';
//! Leave
export const leaveStatus = BASE_URL + 'LeaveMaster/LeaveStatus';
export const getEmpBalanceLeaves = BASE_URL + 'LeaveType/GetEmpBalanceLeaves';
export const getEmployeeLeaveRequestPaggi = BASE_URL + 'LeaveType/GetEmployeeLeaveRequestPaggi';
export const insertUpdateEmpLeaveRequest = BASE_URL + 'LeaveType/InsertUpdateEmpLeaveRequest';
export const getEmployeeLeaveTyepDd = BASE_URL + 'LeaveType/GetEmployeeLeaveTyepDd';
//! Employee
export const getEmployeeListForContact = BASE_URL + 'Employee/GetEmployeeListForContact';
export const updateMobileAddress = BASE_URL + 'Employee/UpdateMobileAddress';
//! Patroller Task        
export const getTaskList = BASE_URL_2 + 'TaskInfoes/GetTask';
export const getTypeOfWorkDD = BASE_URL_2 + 'TypeOfWork/GetTypeOfWorkDD';
export const submitDailyReport = BASE_URL_2 + 'TaskInfoes/SubmitDailyReport';
export const getChamberComplaintList = BASE_URL_2 + 'Chamber/GetComplaintPaggi';
export const getChamberComplaintAlert = BASE_URL_2 + 'Alert/GetAlertDD';
export const getNearestChambers = BASE_URL_2 + 'Chamber/GetNearestChambers';
export const getChamberComplaintPriority = BASE_URL_2 + 'TypeOfWork/GetPriorityDD';
export const submitChamberComplaint = BASE_URL_2 + 'Chamber/SubmitChamberComplaint';
export const getPrevNextChamberById = BASE_URL_2 + 'Chamber/PrevNextChamberById';
export const getChamberOtherMaintenance = BASE_URL_2 + 'TypeOfWork/GetTypeDD';
export const getEmpComplaintsOfDate = BASE_URL_4 + 'Complaint/GetEmpComplaintsOfDate';
export const updateTaskRFO = BASE_URL_4 + 'Complaint/UpdateTaskRFO';
export const getRFOMasterDD = BASE_URL_4 + 'RFOMaster/GetRFOMasterDD';
export const getComplaintById = BASE_URL_4 + 'Complaint/GetComplaintById?id=';
export const getTypeDD = BASE_URL_4 + 'TypeOfWork/GetTypeDD';
export const addComplaintFollowUp = BASE_URL_4 + 'Complaint/AddComplaintFollowUp';
export const addComplaintFollowUp2 = BASE_URL_2 + 'Complaint/AddComplaintFollowUp';
export const addFollowUps = BASE_URL_4 + 'Complaint/AddFollowUps';
export const addTicketsFollowUp = BASE_URL_4 + 'Tickets/AddFollowUp';
export const followUpList = BASE_URL_4 + 'Tickets/FollowUpList';
export const getCustomerList = BASE_URL_5 + 'Customer/CustomerList';
export const getCircuitListByCustomer = BASE_URL_5 + 'CircuitInfo/CircuitListByCustomer';
export const getChambersByCircuitId = BASE_URL_5 + 'CircuitInfo/GetChambersByCircuitId';
export const insertUpdateChamberInstallation = BASE_URL_6 + 'ChamberInstallation/InsertUpdateChamberInstallationV2';
//! Splicer Over Time
export const getSplicerEmpOverTimePaggi =
  BASE_URL_3 + 'OverTime/GetSplicerEmpOverTimePaggi';
export const getSplicerOverTimeList = BASE_URL_3 + 'OverTime/GetSplicerEmpLastOpenTicket';
export const insertUpdateSplicerOverTimeMob =
  BASE_URL_3 + 'OverTime/InsertUpdateSplicerOverTimeMob';
export const updateMobileLocationUrl = BASE_URL_7 + 'Location/PostLocation';
//Project_List APi
export const getProjectList = 'Project/GetProjectList';
//location_Api
export const postLocationAPI = BASE_URL_7 + 'Location/PostLocation';
//Approve_Project_Path_list_Api
export const getApproveProjectPathList = BASE_URL_6 + 'Project/GetProjectApprovePath';
export const getDashboardList = 'AppDashboard/DashboardList2';
export const getMobileAppVersionForVendor = BASE_URL + 'AppDashboard/GetLatestMobileAppVersionForVendor';
//customer_list_Mob
export const getCustomerListMob = BASE_URL_8 + 'ChamberInfoMob/GetCustomerListMob';
export const getCircuitListByCustomerMob = BASE_URL_8 + 'ChamberInfoMob/GetCircuitListByCustomerCompanyId';
//customer_search_byName
export const getCustomerSearchByName = BASE_URL_8 + 'Customer/CustomerDetailsByName';
//Project List By ProjectName and range
export const getProjectListByProjectNameAndRange = BASE_URL_6 + 'ProjectList/GetProjectListByNameAndRange';
//Vendor_API
export const InsertUpdateProjectPathByVendor = BASE_URL_6 + 'Project/InsertUpdateProjectPathByVendor';
export const VendorModulesAccess = BASE_URL_6 + 'Account/GetUserModulePolicyMappingMapping';
//get Nearest Chamberlist API
export const getNearestChamberListAPI = BASE_URL_8 + 'ChamberInfoMob/GetChambersByCircuitId';
//getNearestChambers
export const getTicketDropDown = BASE_URL_4 + 'TicketDropDown/GetNearestChambers';
//GetChamberListBy Name
export const getChamberListByName = BASE_URL_8 + 'Chamber/GetChamberNameListByName';
//Chamber_report
export const getChamberReport = BASE_URL_8 + 'Report/GetChamberReport';
//getcircuitInfoList
export const getcircuitInfoList = BASE_URL_8 + 'Circuit/GetCircuitInfoList';
//getoldirlist  
export const getOldIRList = BASE_URL_4 + 'Complaint/GetOldIRList';
export const createNewIR = BASE_URL_4 + 'Complaint/CreateNewIR';
//
export const ChamberMobRequest = BASE_URL_8 + 'ChamberInfoMob/InsertChamberCorrectionRequestMob';
export const ChamberInfoMobList = BASE_URL_8 + 'ChamberInfoMob/GetNearestChamberandTiffinDDMob';
//LTC API URL
export const getLTCCustomerList = BASE_URL_4 + 'Customer/GetCustomerList';
export const getLTCCircuitList = BASE_URL_4 + 'CircuitInfo/GetCircuitListByCustomer';
//
export const getLTCChamberInfoList = BASE_URL_4 + 'CircuitInfo/GetChambersByCircuitId';
export const getDSSProjectListAPI = BASE_URL_6 + 'ProjectList/ProjectListOfTypeByNameV2';
export const getDSSProjectListAPI2 = BASE_URL_6 + 'ProjectList/ProjectListOfTypeByName';
//
export const getPitListAPI = BASE_URL_6 + 'PitLocation/PitLocationListV2';
export const getPitListAPIWithShotStatus = BASE_URL_6 + 'PitLocation/PitLocationListWithShotStatus';
export const getPitListWithChamberStatus = BASE_URL_6 + 'ChamberInstallation/GetPitListWithChamberStatus';
//
export const insertupdatePitLocationMaster = BASE_URL_6 + 'PitLocation/InsertUpdatePitLocationV2';
export const checkPitLocation = BASE_URL_6 + 'PitLocation/CheckPitLocationNo';
//
export const vendorListForShotAPI = BASE_URL_6 + 'VendorProjectAccess/VendorListForShot';
export const machineListForShotAPI = BASE_URL_6 + 'VendorProjectAccess/MachineList';
export const vendorLocatorName = BASE_URL_6 + 'VendorProjectAccess/GetVendorLocatorNameDD';
export const getShotTypeDD = BASE_URL_6 + 'Master/GetShotTypeDD';
export const getSpecificationsList = BASE_URL_6 + 'Stock/GetItemSpecificationByProjectVendor';
//vendor store id
export const getVendorStoreForShot = BASE_URL_6 + 'VendorProjectStoreMapping/GetStoreByVendorProjectIdDD';
//
export const insertUpdateShotFrom = BASE_URL_6 + 'ProjectShotDetails/InsertUpdateProjectShotDetailsFrom';
export const insertUpdateShotTo = BASE_URL_6 + 'ProjectShotDetails/InsertUpdateProjectShotDetailsTo';
//
export const ductSizeDD = BASE_URL_6 + 'Stock/GetItemTypeByProjectVendor';
export const colorSpecificationDD = BASE_URL_6 + 'Stock/GetItemSpecificationByProjectVendor';
export const GetProjectIDuctCount = BASE_URL_6 + 'Project/GetProjectIDuctCount';
export const getOpenShotByPidId = BASE_URL_6 + 'PitLocation/GetOpenShotByPitId';
export const GetOpenShotDetailsById = BASE_URL_6 + 'PitLocation/GetOpenShotByPitId';
//
export const getMasterItemType = BASE_URL_6 + 'Master/GetItemTypeChamber';
export const getLastPitDetails = BASE_URL_6 + 'PitLocation/GetNearestPitByLatLng';
export const getPitListBySLDId = BASE_URL_6 + 'Reports/GetSLDReportGenerateList';
export const getProjectDuctColorDDV2 = BASE_URL_6 + 'Fiber/GetProjectDuctColorDDV2';
export const insertFiberBlowingDetails = BASE_URL_6 + 'Fiber/InsertFibreBlowingDetailsV2';
//new dss fiberblowing api
export const getProjectDuctNumber = BASE_URL_6 + 'Reports/GetProjectsDuctNoDetailsDD';
//master dd for stock Movement
export const gerMasterDD = BASE_URL_6 + 'Master/GetItems';
export const getProjectStoreItemTypeDD = BASE_URL_6 + 'Stock/GetProjectStoreItemTypeDD';
export const getDrumNumberList = BASE_URL_6 + 'Stock/GetProjectStoreItemQtyDD';
export const getProjectItems = BASE_URL_6 + 'Stock/GetProjectItems';
export const getEmployeeDetailsDD = BASE_URL_6 + 'StockRequest/GetAlertEmployeeDD';
export const insertUpdateStockRequest = BASE_URL_6 + 'StockRequest/InsertUpdateStockRequest';
//vendor store dd
export const getVendorStoreDD2 = BASE_URL_6 + 'VendorMaster/GetVendorStoreDD2';
//vendor store  
export const getCompanyStoreDD = BASE_URL_6 + 'Store/GetStoreDD';
export const getVendorStoreItemSpecificationDD = BASE_URL_6 + 'Stock/GetVendorStoreItemSpecificationDD';
export const insertUpdateStockReturn = BASE_URL_6 + 'StockReturn/InsertUpdateStockReturn';
//stock return
export const getStockRequests = BASE_URL_6 + 'StockRequest/GetStockRequestsIdsDD';
export const getRequestById = BASE_URL_6 + 'StockRequest/GetStockRequestById';
export const insertUpdateStockReceive = BASE_URL_6 + 'StockRequest/InsertUpdateStockReceive';
export const PitLocationListWithABDShotStatus = BASE_URL_6 + 'PitLocation/PitLocationListWithShotStatusWithABD';
export const insertUpdateAbdMaster = BASE_URL_6 + 'ABDMaster/InsertUpdateABDMaster';
//Hoto List API_URL
export const HotoListAPI = BASE_URL_6 + 'HOTO/GetPitListWithHotoStatus';
export const insertUpdateHotoMaster = BASE_URL_6 + 'HOTO/InsertUpdateHotoCheckList';
export const getHotoDatagetbyId = BASE_URL_6 + 'HOTO/GetHotoReportByProjectId';
export const getAddCutDownMaster = BASE_URL_6 + 'AddCut/GetAddCutDropdownMaster';
export const getCutVendors = BASE_URL_6 + 'AddCut/GetCutVendors';
export const getNearestChamberByLatLong = BASE_URL_6 + 'AddCut/GetNearestChamberByLatlng';
//Event Plannings
export const getEventPlanningChamberReport = BASE_URL_4 + 'EventPlanning/GetChamberReport';
//Maintenance 
export const getMaintenanceList = BASE_URL_2 + 'MaintenanceActivity/GetMaintenanceActivityDD';
export const GetMaintenanceActivityVendors = BASE_URL_2 + 'MaintenanceActivity/GetMaintenanceActivityVendors';
export const getMaintenanceNearestChamberByLatLong = BASE_URL_2 + 'MaintenanceActivity/GetNearestChamberByLatlng';
export const insertUpdateMaintenance = BASE_URL_2 + 'MaintenanceActivity/InsertMaintenanceActivity';
export const getMaintenanceReport = BASE_URL_2 + 'MaintenanceActivity/GetMaintenanceActivityReport';
export const getMaintenanceActivityDetails = BASE_URL_2 + 'MaintenanceActivity/GetMaintenanceActivityDetails';
export const getMaintenanceActivityDetailsById = BASE_URL_2 + 'MaintenanceActivity/GetMaintenanceActivityListById';
export const getMaintenanceZonewiseActivity = BASE_URL_2 + 'MaintenanceActivity/GetZonewiseEmpForActivity';
export const getMaintenanceInsertActivityStatus = BASE_URL_2 + 'MaintenanceActivity/InsertActivityStatus';
export const getNearestRouteByLatLong = BASE_URL_2 + 'MaintenanceActivity/GetNearestRouteByLatlng';
export const getAssignedChamberComplaints = BASE_URL_2 + 'Complaint/GetAssignedChamberComplaints';
export const getAssignedChamberComplaintsById = BASE_URL_2 + 'Complaint/GetAssignedChamberComplaintById';
export const getListOfItemChamberComplaint = BASE_URL_2 + 'Complaint/GetListOfItemsChamberComplaint';
export const insertUpdateChamberComplaint = BASE_URL_2 + 'Complaint/InsertUpdateAssignedChamberComplaint';
export const getProjectServiceKeyAPI = BASE_URL_3 + 'ProjectCredentialConfiguration/GetProjectServiceKey';
export const getEmployeeTrackingAPI = BASE_URL_2 + 'Patroller/GetEmployeeTracking';
export const getNearestChamberByLatlngForVendor = BASE_URL_2 + 'MaintenanceActivity/GetNearestChamberByLatlngForVendor';
