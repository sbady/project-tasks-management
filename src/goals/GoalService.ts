import { Notice, TFile, stringifyYaml } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { GoalCreationData, GoalInfo } from "../types";
import { EVENT_DATA_CHANGED } from "../types";
import { getGoalFolderPath, getGoalNotePath } from "../core/pathing/goalPaths";
import type { GoalPeriodDescriptor } from "./GoalPeriodService";
import { getCurrentTimestamp, parseDateAsLocal } from "../utils/dateUtils";
import { ensureFolderExists } from "../utils/helpers";

export interface GoalCreateResult {
	file: TFile;
	goal: GoalInfo;
	created: boolean;
}

export class GoalService {
	constructor(private plugin: TaskNotesPlugin) {}

	async createGoal(
		goalData: GoalCreationData,
		options: { openAfterCreate?: boolean } = {}
	): Promise<GoalCreateResult> {
		const { openAfterCreate = true } = options;
		const title = goalData.title?.trim();
		if (!title) {
			throw new Error("Goal title is required.");
		}

		const referenceDate = goalData.referenceDate
			? parseDateAsLocal(goalData.referenceDate)
			: new Date();
		const descriptor = this.plugin.goalPeriodService.getPeriodDescriptor(
			goalData.periodType,
			referenceDate
		);
		const folderPath = getGoalFolderPath(this.plugin.settings, descriptor.periodType);
		const notePath = getGoalNotePath(
			this.plugin.settings,
			descriptor.periodType,
			descriptor.periodKey
		);
		const existingFile = this.plugin.app.vault.getAbstractFileByPath(notePath);
		if (existingFile instanceof TFile) {
			const goal =
				this.plugin.goalRepository.getGoal(existingFile.path) ??
				this.buildGoalInfo(goalData, existingFile.path, descriptor, getCurrentTimestamp(), getCurrentTimestamp());
			if (openAfterCreate) {
				await this.openFile(existingFile);
			}
			return { file: existingFile, goal, created: false };
		}

		const now = getCurrentTimestamp();
		await ensureFolderExists(this.plugin.app.vault, folderPath);
		const goal = this.buildGoalInfo(goalData, notePath, descriptor, now, now);
		const file = await this.plugin.app.vault.create(notePath, this.serializeGoal(goal));

		this.plugin.emitter.trigger(EVENT_DATA_CHANGED);
		if (openAfterCreate) {
			await this.openFile(file);
		}

		return { file, goal: { ...goal, path: file.path, id: file.path }, created: true };
	}

	async updateGoal(originalGoal: GoalInfo, updates: Partial<GoalInfo>): Promise<GoalInfo> {
		const file = this.plugin.app.vault.getAbstractFileByPath(originalGoal.path);
		if (!(file instanceof TFile)) {
			throw new Error(`Cannot find goal note: ${originalGoal.path}`);
		}

		const updatedGoal: GoalInfo = {
			...originalGoal,
			...updates,
			type: "goal",
			path: originalGoal.path,
			id: originalGoal.path,
			periodType: originalGoal.periodType,
			periodKey: originalGoal.periodKey,
			periodStart: originalGoal.periodStart,
			periodEnd: originalGoal.periodEnd,
			title: updates.title?.trim() || originalGoal.title,
			description: this.normalizeOptionalString(updates.description, originalGoal.description),
			relatedProjects: this.normalizeStringArray(
				updates.relatedProjects,
				originalGoal.relatedProjects
			),
			relatedTasks: this.normalizeStringArray(updates.relatedTasks, originalGoal.relatedTasks),
			relatedNotes: this.normalizeStringArray(updates.relatedNotes, originalGoal.relatedNotes),
			createdAt: originalGoal.createdAt,
			updatedAt: getCurrentTimestamp(),
		};

		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			frontmatter.type = "goal";
			frontmatter.periodType = updatedGoal.periodType;
			frontmatter.periodKey = updatedGoal.periodKey;
			frontmatter.periodStart = updatedGoal.periodStart;
			frontmatter.periodEnd = updatedGoal.periodEnd;
			frontmatter.title = updatedGoal.title;
			frontmatter.updatedAt = updatedGoal.updatedAt;
			frontmatter.createdAt = updatedGoal.createdAt || frontmatter.createdAt || updatedGoal.updatedAt;

			this.setOrDelete(frontmatter, "description", updatedGoal.description);
			this.setOrDelete(frontmatter, "relatedProjects", updatedGoal.relatedProjects);
			this.setOrDelete(frontmatter, "relatedTasks", updatedGoal.relatedTasks);
			this.setOrDelete(frontmatter, "relatedNotes", updatedGoal.relatedNotes);
		});

		this.plugin.emitter.trigger(EVENT_DATA_CHANGED);
		return updatedGoal;
	}

	private buildGoalInfo(
		goalData: Partial<GoalInfo>,
		path: string,
		descriptor: GoalPeriodDescriptor,
		createdAt: string,
		updatedAt: string
	): GoalInfo {
		return {
			id: path,
			type: "goal",
			path,
			periodType: descriptor.periodType,
			periodKey: descriptor.periodKey,
			periodStart: descriptor.periodStart,
			periodEnd: descriptor.periodEnd,
			title: goalData.title?.trim() || "Untitled goal",
			description: this.normalizeOptionalString(goalData.description),
			relatedProjects: this.normalizeStringArray(goalData.relatedProjects),
			relatedTasks: this.normalizeStringArray(goalData.relatedTasks),
			relatedNotes: this.normalizeStringArray(goalData.relatedNotes),
			createdAt,
			updatedAt,
		};
	}

	private serializeGoal(goal: GoalInfo): string {
		const frontmatter: Record<string, unknown> = {
			type: "goal",
			periodType: goal.periodType,
			periodKey: goal.periodKey,
			periodStart: goal.periodStart,
			periodEnd: goal.periodEnd,
			title: goal.title,
			createdAt: goal.createdAt,
			updatedAt: goal.updatedAt,
		};

		this.setOrDelete(frontmatter, "description", goal.description);
		this.setOrDelete(frontmatter, "relatedProjects", goal.relatedProjects);
		this.setOrDelete(frontmatter, "relatedTasks", goal.relatedTasks);
		this.setOrDelete(frontmatter, "relatedNotes", goal.relatedNotes);

		return `---\n${stringifyYaml(frontmatter)}---\n\n`;
	}

	private normalizeOptionalString(
		value: string | undefined,
		fallback?: string
	): string | undefined {
		if (value === undefined) {
			return fallback;
		}

		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	}

	private normalizeStringArray(
		value: string[] | undefined,
		fallback?: string[]
	): string[] | undefined {
		if (value === undefined) {
			return fallback;
		}

		const normalized = value
			.map((item) => item.trim())
			.filter((item) => item.length > 0);
		return normalized.length > 0 ? normalized : undefined;
	}

	private setOrDelete(
		target: Record<string, unknown>,
		key: string,
		value: unknown
	): void {
		if (Array.isArray(value)) {
			if (value.length > 0) {
				target[key] = value;
			} else {
				delete target[key];
			}
			return;
		}

		if (typeof value === "string") {
			if (value.length > 0) {
				target[key] = value;
			} else {
				delete target[key];
			}
			return;
		}

		if (value === undefined || value === null) {
			delete target[key];
			return;
		}

		target[key] = value;
	}

	private async openFile(file: TFile): Promise<void> {
		const leaf = this.plugin.app.workspace.getLeaf(true);
		if (leaf && typeof leaf.openFile === "function") {
			await leaf.openFile(file);
			return;
		}

		new Notice("Goal note created, but it could not be opened automatically.");
	}
}
