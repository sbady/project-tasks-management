import { App, TFile } from "obsidian";
import type { GoalInfo, GoalPeriodType } from "../types";
import type { GoalDefaultsSettings, TaskNotesSettings } from "../types/settings";
import { GoalPeriodService } from "./GoalPeriodService";
import { parseGoalFrontmatter } from "../core/validation/goalValidation";

export class GoalRepository {
	constructor(
		private app: App,
		private settings: Pick<TaskNotesSettings, "goalsFolder" | "goalDefaults" | "goalFilenamePattern">,
		private goalPeriodService: GoalPeriodService
	) {}

	listGoals(periodType?: GoalPeriodType): GoalInfo[] {
		const goalRoot = this.settings.goalsFolder;
		const goals = this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path.startsWith(`${goalRoot}/`) || file.path === goalRoot)
			.map((file) => this.readGoalFile(file))
			.filter((goal): goal is GoalInfo => goal !== null);

		return periodType ? goals.filter((goal) => goal.periodType === periodType) : goals;
	}

	getGoal(path: string): GoalInfo | null {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			return null;
		}

		return this.readGoalFile(file);
	}

	getGoalForPeriod(periodType: GoalPeriodType, periodKey: string): GoalInfo | null {
		return (
			this.listGoals(periodType).find(
				(goal) => goal.periodType === periodType && goal.periodKey === periodKey
			) ?? null
		);
	}

	listGoalsForPeriod(periodType: GoalPeriodType, periodKey: string): GoalInfo[] {
		return this.listGoals(periodType).filter(
			(goal) => goal.periodType === periodType && goal.periodKey === periodKey
		);
	}

	getCurrentGoal(periodType: GoalPeriodType, date: Date = new Date()): GoalInfo | null {
		const descriptor = this.goalPeriodService.getPeriodDescriptor(periodType, date);
		return this.getGoalForPeriod(periodType, descriptor.periodKey);
	}

	getGoalSubfolder(periodType: GoalPeriodType): string {
		return this.getSubfolderName(this.settings.goalDefaults, periodType);
	}

	private getSubfolderName(goalDefaults: GoalDefaultsSettings, periodType: GoalPeriodType): string {
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

	private readGoalFile(file: TFile): GoalInfo | null {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) {
			return null;
		}

		return parseGoalFrontmatter(cache.frontmatter, file.path);
	}
}
