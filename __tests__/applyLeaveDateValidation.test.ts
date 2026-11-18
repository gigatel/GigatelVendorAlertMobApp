import {
  getMinimumFromDate,
  getMinimumToDate,
  validateFromDate,
  validateLeaveDates,
} from '../src/screens/ApplyLeaveScreen/date-validation';

describe('Apply Leave date validation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 6, 12));
  });

  afterEach(() => jest.useRealTimers());

  test('sets the earliest From Date to exactly three calendar days after today', () => {
    expect(getMinimumFromDate()).toBe('2026-11-09');
    for (const date of [
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]) {
      expect(validateFromDate(date)).toContain('at least 3 days after today');
      expect(validateLeaveDates(date, '2026-11-10')).not.toBe('');
    }
    expect(validateFromDate('2026-11-09')).toBe('');
    expect(validateFromDate('2026-11-11')).toBe('');
  });

  test('accepts a same-day or later To Date and rejects an earlier To Date', () => {
    expect(getMinimumToDate('2026-11-09')).toBe('2026-11-09');
    expect(validateLeaveDates('2026-11-09', '2026-11-08')).toBe(
      'To Date must be the same as From Date or later.',
    );
    expect(validateLeaveDates('2026-11-09', '2026-11-09')).toBe('');
    expect(validateLeaveDates('2026-11-09', '2026-11-15')).toBe('');
  });

  test('recalculates the minimum To Date when From Date changes', () => {
    expect(getMinimumToDate('2026-11-11')).toBe('2026-11-11');
    expect(validateLeaveDates('2026-11-11', '2026-11-09')).not.toBe('');
    expect(validateLeaveDates('2026-11-11', '2026-11-11')).toBe('');
  });

  test.each([
    [2026, 0, 30, '2026-02-02'],
    [2026, 11, 30, '2027-01-02'],
    [2028, 1, 26, '2028-02-29'],
    [2028, 1, 27, '2028-03-01'],
    [2026, 1, 27, '2026-03-02'],
  ])(
    'handles the date boundary after %i-%i-%i',
    (year, month, day, minimum) => {
      jest.setSystemTime(new Date(year, month, day, 12));
      expect(getMinimumFromDate()).toBe(minimum);
      expect(getMinimumToDate(minimum)).toBe(minimum);
      expect(validateLeaveDates(minimum, minimum)).toBe('');
    },
  );

  test('rejects missing and malformed dates during submission', () => {
    expect(validateLeaveDates('', '2026-11-09')).toBe(
      'Please select a valid From Date.',
    );
    expect(validateLeaveDates('2026-11-09', '')).toBe(
      'Please select a To Date.',
    );
    expect(validateLeaveDates('2026-11-09', '2026-02-30')).toBe(
      'Please select a valid To Date.',
    );
    expect(validateLeaveDates('2026-02-30', '2026-03-06')).toBe(
      'Please select a valid From Date.',
    );
  });

  test('revalidates the From Date against today at submission time', () => {
    expect(validateLeaveDates('2026-11-09', '2026-11-09')).toBe('');
    jest.setSystemTime(new Date(2026, 10, 7, 12));
    expect(validateLeaveDates('2026-11-09', '2026-11-09')).toContain(
      'at least 3 days after today',
    );
  });
});
