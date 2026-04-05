import { App, TFile, normalizePath } from "obsidian";
import type { ProjectInfo } from "../types";
import type { TaskNotesSettings } from "../types/settings";
import { getProjectFolderFromNotePath } from "../core/pathing/projectPaths";
import { parseProjectFrontmatter } from "../core/validation/projectValidation";

export class ProjectRepository {
	constructor(
		private app: App,
		private settings: Pick<TaskNotesSettings, "projectsFolder" | "projectNoteFilename">
	) {}

	listProjects(): ProjectInfo[] {
		const projectRoot = normalizePath(this.settings.projectsFolder);
		return this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path.startsWith(`${projectRoot}/`) || file.path === projectRoot)
			.map((file) => this.readProjectFile(file))
			.filter((project): project is ProjectInfo => project !== null);
	}

	getProject(path: string): ProjectInfo | null {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			return null;
		}

		return this.readProjectFile(file);
	}

	getProjectForFolder(folderPath: string): ProjectInfo | null {
		const normalizedFolderPath = normalizePath(folderPath);
		return (
			this.listProjects().find((project) => normalizePath(project.folder) === normalizedFolderPath) ??
			null
		);
	}

	resolveProjectFolder(path: string): string | null {
		return getProjectFolderFromNotePath(path);
	}

	private readProjectFile(file: TFile): ProjectInfo | null {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) {
			return null;
		}

		return parseProjectFrontmatter(cache.frontmatter, file.path);
	}
}
