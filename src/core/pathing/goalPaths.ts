import type { GoalPeriodType } from "../../types";
import type { GoalDefaultsSettings, TaskNotesSettings } from "../../types/settings";
import { ensureMarkdownExtension, joinVaultPath } from "./shared";

function getGoalSubfolder(
	goalDefaults: GoalDefaultsSettings,
	periodType: GoalPeriodType
): string {
	switch (periodType) {
		case "week":
			return goalDefaults.weeklyFolder;
		case "month":
			return goalDefaults.monthlyFolder;
		case "quarter":
		default:
			return goalDefaults.quarterlyFolder;
	}
}

export function getGoalFolderPath(
	settings: Pick<TaskNotesSettings, "goalsFolder" | "goalDefaults">,
	periodType: GoalPeriodType
): string {
	return joinVaultPath(settings.goalsFolder, getGoalSubfolder(settings.goalDefaults, periodType));
}

export function buildGoalFilename(periodKey: string): string {
	return ensureMarkdownExtension(periodKey);
}

export function getGoalNotePath(
	settings: Pick<TaskNotesSettings, "goalsFolder" | "goalDefaults">,
	periodType: GoalPeriodType,
	periodKey: string
): string {
	return joinVaultPath(getGoalFolderPath(settings, periodType), buildGoalFilename(periodKey));
}

