import type { DomainEntityType, TaskEntityType } from "../../types";
import { FilterUtils } from "../../utils/FilterUtils";

export interface TaskEntityDetectionSettings {
	taskIdentificationMethod: "tag" | "property";
	taskTag: string;
	taskPropertyName?: string;
	taskPropertyValue?: string;
}

export interface TaskContractValidationResult {
	valid: boolean;
	isLegacy: boolean;
	needsProjectNormalization: boolean;
	primaryProject?: string;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function comparePropertyValue(frontmatterValue: unknown, expectedValue: string): boolean {
	if (typeof frontmatterValue === "boolean") {
		const lower = expectedValue.toLowerCase();
		if (lower === "true" || lower === "false") {
			return frontmatterValue === (lower === "true");
		}
	}

	return frontmatterValue === expectedValue;
}

export function isEntityFrontmatter(
	frontmatter: unknown,
	expectedType: DomainEntityType
): boolean {
	if (!isObjectRecord(frontmatter)) {
		return false;
	}

	const typeValue = frontmatter.type;
	if (Array.isArray(typeValue)) {
		return typeValue.includes(expectedType);
	}

	return typeValue === expectedType;
}

export function matchesTaskTag(frontmatter: unknown, taskTag: string): boolean {
	if (!isObjectRecord(frontmatter) || !Array.isArray(frontmatter.tags)) {
		return false;
	}

	return frontmatter.tags.some((tag) => {
		if (typeof tag !== "string") {
			return false;
		}

		const cleanTag = tag.startsWith("#") ? tag.slice(1) : tag;
		return FilterUtils.matchesHierarchicalTagExact(cleanTag, taskTag);
	});
}

export function matchesConfiguredTaskProperty(
	frontmatter: unknown,
	settings: Pick<
		TaskEntityDetectionSettings,
		"taskPropertyName" | "taskPropertyValue"
	>
): boolean {
	if (!isObjectRecord(frontmatter)) {
		return false;
	}

	const propName = settings.taskPropertyName;
	const propValue = settings.taskPropertyValue;
	if (!propName || !propValue) {
		return false;
	}

	const currentValue = frontmatter[propName];
	if (currentValue === undefined) {
		return false;
	}

	if (Array.isArray(currentValue)) {
		return currentValue.some((value) => comparePropertyValue(value, propValue));
	}

	return comparePropertyValue(currentValue, propValue);
}

export function detectTaskFrontmatter(
	frontmatter: unknown,
	settings: TaskEntityDetectionSettings
): boolean {
	if (isEntityFrontmatter(frontmatter, "task")) {
		return true;
	}

	if (settings.taskIdentificationMethod === "property") {
		if (matchesConfiguredTaskProperty(frontmatter, settings)) {
			return true;
		}

		return matchesTaskTag(frontmatter, settings.taskTag);
	}

	return matchesTaskTag(frontmatter, settings.taskTag);
}

export function getPrimaryProject(projectsValue: unknown): string | undefined {
	if (Array.isArray(projectsValue)) {
		return projectsValue.find(
			(project): project is string => typeof project === "string" && project.length > 0
		);
	}

	return typeof projectsValue === "string" && projectsValue.length > 0
		? projectsValue
		: undefined;
}

export function validateTaskFrontmatter(frontmatter: unknown): TaskContractValidationResult {
	if (!isObjectRecord(frontmatter)) {
		return {
			valid: false,
			isLegacy: false,
			needsProjectNormalization: false,
		};
	}

	const hasTaskType = isEntityFrontmatter(frontmatter, "task");
	const primaryProject = getPrimaryProject(frontmatter.projects);
	const projectCount = Array.isArray(frontmatter.projects)
		? frontmatter.projects.filter((project) => typeof project === "string" && project.length > 0)
				.length
		: primaryProject
			? 1
			: 0;

	return {
		valid: hasTaskType || matchesTaskTag(frontmatter, "task"),
		isLegacy: !hasTaskType,
		needsProjectNormalization: projectCount > 1,
		primaryProject,
	};
}

export const TASK_ENTITY_TYPE: TaskEntityType = "task";

