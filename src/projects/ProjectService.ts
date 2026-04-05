import { Notice, TFile, normalizePath, stringifyYaml } from "obsidian";
import type TaskNotesPlugin from "../main";
import type {
	ProjectCreationData,
	ProjectInfo,
	ProjectSummary,
	TaskInfo,
} from "../types";
import { EVENT_DATA_CHANGED } from "../types";
import { getCanonicalProjectNotePath, getProjectFolderPath } from "../core/pathing/projectPaths";
import { normalizeEntityLink } from "../core/links/normalizeEntityLink";
import { ensureFolderExists } from "../utils/helpers";
import { getCurrentTimestamp, getTodayString, isBeforeDateSafe } from "../utils/dateUtils";

export interface ProjectCreateResult {
	file: TFile;
	project: ProjectInfo;
	created: boolean;
}

export class ProjectService {
	constructor(private plugin: TaskNotesPlugin) {}

	async createProject(
		projectData: ProjectCreationData,
		options: { openAfterCreate?: boolean } = {}
	): Promise<ProjectCreateResult> {
		const { openAfterCreate = true } = options;
		const title = projectData.title?.trim();
		if (!title) {
			throw new Error("Project title is required.");
		}

		const now = getCurrentTimestamp();
		const folderPath = getProjectFolderPath(this.plugin.settings, title);
		const notePath = getCanonicalProjectNotePath(this.plugin.settings, title);
		const existingFile = this.plugin.app.vault.getAbstractFileByPath(notePath);
		if (existingFile instanceof TFile) {
			const project =
				this.plugin.projectRepository.getProject(existingFile.path) ??
				this.buildProjectInfo({
					title,
					status: projectData.status,
					description: projectData.description,
					relatedNotes: projectData.relatedNotes,
					tags: projectData.tags,
					startDate: projectData.startDate,
					dueDate: projectData.dueDate,
					completedDate: projectData.completedDate,
				}, existingFile.path, folderPath, now, now);
			if (openAfterCreate) {
				await this.openFile(existingFile);
			}
			return { file: existingFile, project, created: false };
		}

		await ensureFolderExists(this.plugin.app.vault, folderPath);

		const project = this.buildProjectInfo(
			projectData,
			notePath,
			folderPath,
			now,
			now
		);
		const file = await this.plugin.app.vault.create(
			notePath,
			this.serializeProject(project)
		);

		this.plugin.emitter.trigger(EVENT_DATA_CHANGED);
		if (openAfterCreate) {
			await this.openFile(file);
		}

		return { file, project: { ...project, path: file.path, id: file.path }, created: true };
	}

	async updateProject(
		originalProject: ProjectInfo,
		updates: Partial<ProjectInfo>
	): Promise<ProjectInfo> {
		const file = this.plugin.app.vault.getAbstractFileByPath(originalProject.path);
		if (!(file instanceof TFile)) {
			throw new Error(`Cannot find project note: ${originalProject.path}`);
		}

		const updatedProject: ProjectInfo = {
			...originalProject,
			...updates,
			type: "project",
			path: originalProject.path,
			id: originalProject.path,
			folder: originalProject.folder,
			title: updates.title?.trim() || originalProject.title,
			status: updates.status || originalProject.status,
			description: this.normalizeOptionalString(updates.description, originalProject.description),
			relatedNotes: this.normalizeStringArray(updates.relatedNotes, originalProject.relatedNotes),
			tags: this.normalizeStringArray(updates.tags, originalProject.tags),
			startDate: this.normalizeOptionalString(updates.startDate, originalProject.startDate),
			dueDate: this.normalizeOptionalString(updates.dueDate, originalProject.dueDate),
			completedDate: this.normalizeOptionalString(
				updates.completedDate,
				originalProject.completedDate
			),
			createdAt: originalProject.createdAt,
			updatedAt: getCurrentTimestamp(),
		};

		await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			frontmatter.type = "project";
			frontmatter.title = updatedProject.title;
			frontmatter.status = updatedProject.status;
			frontmatter.folder = updatedProject.folder;
			frontmatter.updatedAt = updatedProject.updatedAt;
			frontmatter.createdAt = updatedProject.createdAt || frontmatter.createdAt || updatedProject.updatedAt;

			this.setOrDelete(frontmatter, "description", updatedProject.description);
			this.setOrDelete(frontmatter, "relatedNotes", updatedProject.relatedNotes);
			this.setOrDelete(frontmatter, "tags", updatedProject.tags);
			this.setOrDelete(frontmatter, "startDate", updatedProject.startDate);
			this.setOrDelete(frontmatter, "dueDate", updatedProject.dueDate);
			this.setOrDelete(frontmatter, "completedDate", updatedProject.completedDate);
		});

		this.plugin.emitter.trigger(EVENT_DATA_CHANGED);
		return updatedProject;
	}

	async getProjectTasks(project: ProjectInfo): Promise<TaskInfo[]> {
		const normalizedProjectPath = normalizeEntityLink(project.path);
		const allTasks = await this.plugin.cacheManager.getAllTasks();
		return allTasks.filter((task) =>
			(task.projects || []).some((projectLink) => normalizeEntityLink(projectLink) === normalizedProjectPath)
		);
	}

	async getProjectSummary(project: ProjectInfo): Promise<ProjectSummary> {
		const tasks = await this.getProjectTasks(project);
		const today = getTodayString();
		const completedTaskCount = tasks.filter((task) =>
			this.plugin.statusManager.isCompletedStatus(task.status)
		).length;
		const openTaskCount = tasks.length - completedTaskCount;
		const overdueTaskCount = tasks.filter(
			(task) =>
				!!task.due &&
				!this.plugin.statusManager.isCompletedStatus(task.status) &&
				isBeforeDateSafe(task.due, today)
		).length;

		return {
			project,
			totalTasks: tasks.length,
			openTaskCount,
			completedTaskCount,
			overdueTaskCount,
		};
	}

	private buildProjectInfo(
		projectData: Partial<ProjectInfo>,
		path: string,
		folder: string,
		createdAt: string,
		updatedAt: string
	): ProjectInfo {
		return {
			id: path,
			type: "project",
			path,
			title: projectData.title?.trim() || "Untitled project",
			status: projectData.status || this.plugin.settings.projectStatuses[0]?.value || "active",
			folder,
			description: this.normalizeOptionalString(projectData.description),
			relatedNotes: this.normalizeStringArray(projectData.relatedNotes),
			tags: this.normalizeStringArray(projectData.tags),
			startDate: this.normalizeOptionalString(projectData.startDate),
			dueDate: this.normalizeOptionalString(projectData.dueDate),
			completedDate: this.normalizeOptionalString(projectData.completedDate),
			createdAt,
			updatedAt,
		};
	}

	private serializeProject(project: ProjectInfo): string {
		const frontmatter: Record<string, unknown> = {
			type: "project",
			title: project.title,
			status: project.status,
			folder: normalizePath(project.folder),
			createdAt: project.createdAt,
			updatedAt: project.updatedAt,
		};

		this.setOrDelete(frontmatter, "description", project.description);
		this.setOrDelete(frontmatter, "relatedNotes", project.relatedNotes);
		this.setOrDelete(frontmatter, "tags", project.tags);
		this.setOrDelete(frontmatter, "startDate", project.startDate);
		this.setOrDelete(frontmatter, "dueDate", project.dueDate);
		this.setOrDelete(frontmatter, "completedDate", project.completedDate);

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

		new Notice("Project note created, but it could not be opened automatically.");
	}
}

