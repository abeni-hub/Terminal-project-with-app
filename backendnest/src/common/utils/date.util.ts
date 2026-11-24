/**
 * Calculate the ISO 8601 week number for a given date (defaults to now).
 */
export function getCurrentWeekNumber(date: Date = new Date()): number {
  const jan1 = new Date(date.getFullYear(), 0, 1);
  const dayOffset = jan1.getDay() === 0 ? 6 : jan1.getDay() - 1; // Monday = 0
  return Math.ceil(((date.getTime() - jan1.getTime()) / 86400000 + dayOffset + 1) / 7);
}

/**
 * Get the Monday start date and Sunday end date for a given ISO week number.
 */
export function getWeekDateRange(weekNumber: number, year: number = new Date().getFullYear()): { weekStart: string; weekEnd: string } {
  const jan1 = new Date(year, 0, 1);
  const dayOffset = jan1.getDay() === 0 ? 6 : jan1.getDay() - 1;
  const weekStart = new Date(jan1.getTime() + (weekNumber - 1) * 7 * 86400000 - dayOffset * 86400000);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
  weekEnd.setHours(23, 59, 59, 999);

  return {
    weekStart: weekStart.toISOString().split('T')[0],
    weekEnd: weekEnd.toISOString().split('T')[0],
  };
}

/**
 * Calculate the 3-Month Quarter / Period number for a given date (1 = Q1, 2 = Q2, 3 = Q3, 4 = Q4).
 */
export function getCurrentQuarter(date: Date = new Date()): number {
  return Math.floor(date.getMonth() / 3) + 1;
}

/**
 * Get the 3-month date range and period label for a given quarter (1 to 4) and year.
 * Q1: Jan 1 - Mar 31
 * Q2: Apr 1 - Jun 30
 * Q3: Jul 1 - Sep 30
 * Q4: Oct 1 - Dec 31
 */
export function getQuarterDateRange(quarter: number, year: number = new Date().getFullYear()): {
  quarterNumber: number;
  periodLabel: string;
  weekStart: string;
  weekEnd: string;
} {
  const q = Math.max(1, Math.min(4, quarter));
  const startMonth = (q - 1) * 3;
  const startDate = new Date(year, startMonth, 1);
  startDate.setHours(0, 0, 0, 0);

  // End of quarter: day 0 of (startMonth + 3) gives last day of the 3rd month
  const endDate = new Date(year, startMonth + 3, 0);
  endDate.setHours(23, 59, 59, 999);

  const quarterLabels = ['Q1 (Jan - Mar)', 'Q2 (Apr - Jun)', 'Q3 (Jul - Sep)', 'Q4 (Oct - Dec)'];

  return {
    quarterNumber: q,
    periodLabel: `${year} ${quarterLabels[q - 1]}`,
    weekStart: startDate.toISOString().split('T')[0],
    weekEnd: endDate.toISOString().split('T')[0],
  };
}
