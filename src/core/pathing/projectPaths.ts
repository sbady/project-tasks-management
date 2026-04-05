import { normalizePath } from "obsidian";
import type { TaskNotesSettings } from "../../types/settings";
import { ensureMarkdownExtension, joinVaultPath, slugifyPathSegment } from "./shared";

export function getProjectFolderPath(
	settings: Pick<TaskNotesSettings, "projectsFolder">,
	projectTitle: string
): string {
	return joinVaultPath(settings.projectsFolder, slugifyPathSegment(projectTitle));
}

export function getCanonicalProjectNotePath(
	settings: Pick<TaskNotesSettings, "projectsFolder" | "projectNoteFilename">,
	projectTitle: string
): string {
	return joinVaultPath(
		getProjectFolderPath(settings, projectTitle),
		ensureMarkdownExtension(settings.projectNoteFilename)
	);
}

export function getProjectFolderFromNotePath(projectNotePath: string): string | null {
	const normalizedPath = normalizePath(projectNotePath);
	const lastSlash = normalizedPath.lastIndexOf("/");
	if (lastSlash === -1) {
		return null;
	}

	return normalizedPath.substring(0, lastSlash);
}

export function isCanonicalProjectNotePath(
	path: string,
	settings: Pick<TaskNotesSettings, "projectNoteFilename">
): boolean {
	const normalizedPath = normalizePath(path);
	return normalizedPath.endsWith(`/${ensureMarkdownExtension(settings.projectNoteFilename)}`);
}

