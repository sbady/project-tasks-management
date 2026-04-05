import { normalizePath } from "obsidian";
import { ensureMarkdownExtension } from "../pathing/shared";

function isExternalLink(link: string): boolean {
	return /^[a-z]+:\/\//i.test(link);
}

export function unwrapEntityLink(link: string): string {
	const trimmed = link.trim();

	if (trimmed.startsWith("[[") && trimmed.endsWith("]]")) {
		return trimmed.slice(2, -2);
	}

	const markdownLinkMatch = trimmed.match(/^\[[^\]]*]\((.+)\)$/);
	if (markdownLinkMatch) {
		return markdownLinkMatch[1];
	}

	return trimmed;
}

export function normalizeEntityLink(link: string): string {
	const unwrapped = unwrapEntityLink(link);
	const withoutAlias = unwrapped.split("|")[0] ?? "";
	const withoutHeading = withoutAlias.split("#")[0] ?? "";
	const trimmed = withoutHeading.trim();

	if (!trimmed || isExternalLink(trimmed)) {
		return trimmed;
	}

	return ensureMarkdownExtension(normalizePath(trimmed));
}

