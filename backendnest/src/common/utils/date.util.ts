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
