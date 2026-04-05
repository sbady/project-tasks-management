import type { GoalInfo, GoalPeriodType } from "../../types";

interface GoalFrontmatterRecord extends Record<string, unknown> {
	type: "goal";
	periodType: GoalPeriodType;
	periodKey: string;
	periodStart: string;
	periodEnd: string;
	title: string;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function readOptionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
	if (Array.isArray(value)) {
		const normalized = value.filter(
			(entry): entry is string => typeof entry === "string" && entry.length > 0
		);
		return normalized.length > 0 ? normalized : undefined;
	}

	const single = readOptionalString(value);
	return single ? [single] : undefined;
}

function isGoalPeriodType(value: unknown): value is GoalPeriodType {
	return value === "week" || value === "month" || value === "quarter";
}

export function isGoalFrontmatter(frontmatter: unknown): frontmatter is GoalFrontmatterRecord {
	if (!isObjectRecord(frontmatter)) {
		return false;
	}

	return (
		frontmatter.type === "goal" &&
		isGoalPeriodType(frontmatter.periodType) &&
		typeof frontmatter.periodKey === "string" &&
		typeof frontmatter.periodStart === "string" &&
		typeof frontmatter.periodEnd === "string" &&
		typeof frontmatter.title === "string"
	);
}

export function parseGoalFrontmatter(frontmatter: unknown, path: string): GoalInfo | null {
	if (!isGoalFrontmatter(frontmatter)) {
		return null;
	}

	return {
		id: path,
		type: "goal",
		path,
		periodType: frontmatter.periodType,
		periodKey: frontmatter.periodKey,
		periodStart: frontmatter.periodStart,
		periodEnd: frontmatter.periodEnd,
		title: frontmatter.title,
		description: readOptionalString(frontmatter.description),
		relatedProjects: readStringArray(frontmatter.relatedProjects),
		relatedTasks: readStringArray(frontmatter.relatedTasks),
		relatedNotes: readStringArray(frontmatter.relatedNotes),
		createdAt: readOptionalString(frontmatter.createdAt),
		updatedAt: readOptionalString(frontmatter.updatedAt),
	};
}
