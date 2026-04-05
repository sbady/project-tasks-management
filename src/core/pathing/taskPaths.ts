import type { TaskNotesSettings } from "../../types/settings";
import { ensureMarkdownExtension, joinVaultPath, slugifyPathSegment } from "./shared";

function pad(value: number): string {
	return String(value).padStart(2, "0");
}

function formatDate(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatZettel(date: Date): string {
	return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function buildTaskFilename(
	title: string,
	pattern: TaskNotesSettings["taskFilenamePattern"],
	date: Date = new Date()
): string {
	const slug = slugifyPathSegment(title);

	switch (pattern) {
		case "slug":
			return slug;
		case "zettel":
			return formatZettel(date);
		case "date-slug":
		default:
			return `${formatDate(date)}-${slug}`;
	}
}

export function getTaskFolderPath(
	settings: Pick<TaskNotesSettings, "tasksFolder">,
	date: Date = new Date()
): string {
	return joinVaultPath(settings.tasksFolder, String(date.getFullYear()));
}

export function getTaskNotePath(
	settings: Pick<TaskNotesSettings, "tasksFolder" | "taskFilenamePattern">,
	title: string,
	date: Date = new Date()
): string {
	return joinVaultPath(
		getTaskFolderPath(settings, date),
		ensureMarkdownExtension(buildTaskFilename(title, settings.taskFilenamePattern, date))
	);
}

