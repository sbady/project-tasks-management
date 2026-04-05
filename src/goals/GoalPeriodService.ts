import type { GoalPeriodType } from "../types";

export interface GoalPeriodDescriptor {
	periodType: GoalPeriodType;
	periodKey: string;
	periodStart: string;
	periodEnd: string;
}

function pad(value: number): string {
	return String(value).padStart(2, "0");
}

function toDateString(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function cloneDate(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getStartOfWeek(date: Date): Date {
	const local = cloneDate(date);
	const mondayOffset = (local.getDay() + 6) % 7;
	local.setDate(local.getDate() - mondayOffset);
	return local;
}

function getEndOfWeek(date: Date): Date {
	const start = getStartOfWeek(date);
	start.setDate(start.getDate() + 6);
	return start;
}

function getStartOfMonth(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getEndOfMonth(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getQuarter(date: Date): number {
	return Math.floor(date.getMonth() / 3) + 1;
}

function getStartOfQuarter(date: Date): Date {
	const quarter = getQuarter(date);
	return new Date(date.getFullYear(), (quarter - 1) * 3, 1);
}

function getEndOfQuarter(date: Date): Date {
	const quarter = getQuarter(date);
	return new Date(date.getFullYear(), quarter * 3, 0);
}

function getIsoWeekKey(date: Date): string {
	const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	const dayNumber = target.getUTCDay() || 7;
	target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
	const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
	const weekNumber = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

	return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

export class GoalPeriodService {
	getPeriodDescriptor(periodType: GoalPeriodType, date: Date = new Date()): GoalPeriodDescriptor {
		switch (periodType) {
			case "week": {
				const periodStart = getStartOfWeek(date);
				const periodEnd = getEndOfWeek(date);
				return {
					periodType,
					periodKey: getIsoWeekKey(date),
					periodStart: toDateString(periodStart),
					periodEnd: toDateString(periodEnd),
				};
			}
			case "month": {
				const periodStart = getStartOfMonth(date);
				const periodEnd = getEndOfMonth(date);
				return {
					periodType,
					periodKey: `${date.getFullYear()}-${pad(date.getMonth() + 1)}`,
					periodStart: toDateString(periodStart),
					periodEnd: toDateString(periodEnd),
				};
			}
			case "quarter":
			default: {
				const periodStart = getStartOfQuarter(date);
				const periodEnd = getEndOfQuarter(date);
				return {
					periodType: "quarter",
					periodKey: `${date.getFullYear()}-Q${getQuarter(date)}`,
					periodStart: toDateString(periodStart),
					periodEnd: toDateString(periodEnd),
				};
			}
		}
	}
}

