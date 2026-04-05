import type { ProjectInfo } from "../../types";
import { getProjectFolderFromNotePath } from "../pathing/projectPaths";

interface ProjectFrontmatterRecord extends Record<string, unknown> {
	type: "project";
	title: string;
	status: string;
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

export function isProjectFrontmatter(
	frontmatter: unknown
): frontmatter is ProjectFrontmatterRecord {
	if (!isObjectRecord(frontmatter)) {
		return false;
	}

	return (
		frontmatter.type === "project" &&
		typeof frontmatter.title === "string" &&
		typeof frontmatter.status === "string"
	);
}

export function parseProjectFrontmatter(
	frontmatter: unknown,
	path: string
): ProjectInfo | null {
	if (!isProjectFrontmatter(frontmatter)) {
		return null;
	}

	const folder =
		readOptionalString(frontmatter.folder) ?? getProjectFolderFromNotePath(path) ?? undefined;
	if (!folder) {
		return null;
	}

	return {
		id: path,
		type: "project",
		path,
		title: frontmatter.title,
		status: frontmatter.status,
		folder,
		description: readOptionalString(frontmatter.description),
		relatedNotes: readStringArray(frontmatter.relatedNotes),
		tags: readStringArray(frontmatter.tags),
		startDate: readOptionalString(frontmatter.startDate),
		dueDate: readOptionalString(frontmatter.dueDate),
		completedDate: readOptionalString(frontmatter.completedDate),
		createdAt: readOptionalString(frontmatter.createdAt),
		updatedAt: readOptionalString(frontmatter.updatedAt),
	};
}
