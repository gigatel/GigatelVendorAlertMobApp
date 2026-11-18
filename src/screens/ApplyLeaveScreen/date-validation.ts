import moment from 'moment';

const DATE_FORMAT = 'YYYY-MM-DD';

export const getMinimumFromDate = () => {
  const currentDate = new Date();
  currentDate.setDate(currentDate.getDate() + 3);
  return moment(currentDate).format(DATE_FORMAT);
};

export const getMinimumToDate = (fromDate: string) =>
  moment(fromDate, DATE_FORMAT, true).format(DATE_FORMAT);

export const validateFromDate = (fromDate: string): string => {
  if (!moment(fromDate, DATE_FORMAT, true).isValid()) {
    return 'Please select a valid From Date.';
  }
  if (fromDate < getMinimumFromDate()) {
    return `From Date must be at least 3 days after today. Select ${moment(
      getMinimumFromDate(),
      DATE_FORMAT,
    ).format('DD MMM YYYY')} or later.`;
  }
  return '';
};

export const validateLeaveDates = (
  fromDate: string,
  toDate: string,
): string => {
  const fromError = validateFromDate(fromDate);
  if (fromError) {
    return fromError;
  }
  if (!toDate) {
    return 'Please select a To Date.';
  }
  if (!moment(toDate, DATE_FORMAT, true).isValid()) {
    return 'Please select a valid To Date.';
  }
  if (toDate < getMinimumToDate(fromDate)) {
    return 'To Date must be the same as From Date or later.';
  }
  return '';
};
