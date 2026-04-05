import { normalizePath } from "obsidian";

export function slugifyPathSegment(input: string): string {
	const normalized = input
		.trim()
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[\\/:*?"<>|#^]/g, " ")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^\.+|\.+$/g, "")
		.replace(/^[-.]+|[-.]+$/g, "");

	return normalized || "untitled";
}

export function joinVaultPath(...segments: Array<string | undefined | null>): string {
	return normalizePath(
		segments
			.filter((segment): segment is string => typeof segment === "string" && segment.length > 0)
			.join("/")
	);
}

export function ensureMarkdownExtension(filename: string): string {
	return filename.toLowerCase().endsWith(".md") ? filename : `${filename}.md`;
}

export function stripMarkdownExtension(path: string): string {
	return path.replace(/\.md$/i, "");
}

