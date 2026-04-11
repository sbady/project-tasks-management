import { Notice, TFile, normalizePath } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { GoalInfo, ProjectInfo, TaskInfo } from "../types";
import { normalizeEntityLink } from "../core/links/normalizeEntityLink";
import { ensureFolderExists } from "../utils/helpers";

interface CanvasNode {
	id: string;
	type: "file" | "text";
	x: number;
	y: number;
	width: number;
	height: number;
	file?: string;
	text?: string;
	color?: string;
}

interface CanvasEdge {
	id: string;
	fromNode: string;
	fromSide: "right" | "left" | "top" | "bottom";
	toNode: string;
	toSide: "right" | "left" | "top" | "bottom";
	color?: string;
}

interface CanvasDocument {
	nodes: CanvasNode[];
	edges: CanvasEdge[];
}

export class ProjectCanvasService {
	private nodeCounter = 0;
	private edgeCounter = 0;

	constructor(private plugin: TaskNotesPlugin) {}

	async createOrUpdateProjectCanvas(project: ProjectInfo): Promise<TFile> {
		this.nodeCounter = 0;
		this.edgeCounter = 0;

		const canvas = await this.buildProjectCanvas(project);
		const canvasPath = await this.getProjectCanvasPath(project);
		const content = JSON.stringify(canvas, null, "\t");
		await ensureFolderExists(this.plugin.app.vault, canvasPath.split("/").slice(0, -1).join("/"));

		const existing = this.plugin.app.vault.getAbstractFileByPath(canvasPath);
		if (existing instanceof TFile) {
			await this.plugin.app.vault.process(existing, () => content);
			new Notice(`Project canvas updated: ${project.title}`);
			return existing;
		}

		const file = await this.plugin.app.vault.create(canvasPath, content);
		new Notice(`Project canvas created: ${project.title}`);
		return file;
	}

	async openProjectCanvas(project: ProjectInfo): Promise<void> {
		const file = await this.createOrUpdateProjectCanvas(project);
		await this.plugin.app.workspace.getLeaf(false).openFile(file);
	}

	private async buildProjectCanvas(project: ProjectInfo): Promise<CanvasDocument> {
		const nodes: CanvasNode[] = [];
		const edges: CanvasEdge[] = [];
		const projectTasks = await this.plugin.projectService.getProjectTasks(project);
		const goals = this.getProjectGoals(project, projectTasks);
		const linkedTaskPaths = new Set<string>();

		const projectNode = this.createFileNode(project.path, 0, 0, 320, 180, "1");
		nodes.push(projectNode);

		for (const [goalIndex, goal] of goals.entries()) {
			const goalY = goalIndex * 360;
			const goalNode = this.createFileNode(goal.path, 430, goalY, 360, 180, "4");
			nodes.push(goalNode);
			edges.push(this.createEdge(projectNode.id, goalNode.id, "4"));

			const goalTasks = this.getGoalTasks(goal, projectTasks);
			for (const [taskIndex, task] of goalTasks.entries()) {
				linkedTaskPaths.add(task.path);
				const taskY = goalY + taskIndex * 210;
				const taskNode = this.createFileNode(task.path, 900, taskY, 360, 150, this.getTaskColor(task));
				nodes.push(taskNode);
				edges.push(this.createEdge(goalNode.id, taskNode.id, this.getTaskColor(task)));

				const steps = await this.extractTaskSteps(task);
				if (steps.length > 0) {
					const stepsNode = this.createTextNode(
						steps.join("\n"),
						1320,
						taskY,
						340,
						Math.min(220, 54 + steps.length * 24),
						"6"
					);
					nodes.push(stepsNode);
					edges.push(this.createEdge(taskNode.id, stepsNode.id, "6"));
				}
			}
		}

		const unlinkedTasks = projectTasks.filter((task) => !linkedTaskPaths.has(task.path));
		if (unlinkedTasks.length > 0) {
			const unlinkedY = Math.max(goals.length * 360, 360);
			const unlinkedNode = this.createTextNode(
				"Tasks without a goal",
				430,
				unlinkedY,
				360,
				100,
				"5"
			);
			nodes.push(unlinkedNode);
			edges.push(this.createEdge(projectNode.id, unlinkedNode.id, "5"));

			unlinkedTasks.forEach((task, taskIndex) => {
				const taskNode = this.createFileNode(
					task.path,
					900,
					unlinkedY + taskIndex * 190,
					360,
					150,
					this.getTaskColor(task)
				);
				nodes.push(taskNode);
				edges.push(this.createEdge(unlinkedNode.id, taskNode.id, this.getTaskColor(task)));
			});
		}

		return { nodes, edges };
	}

	private getProjectGoals(project: ProjectInfo, projectTasks: TaskInfo[]): GoalInfo[] {
		const normalizedProjectPath = normalizePath(project.path);
		const projectTaskPaths = new Set(projectTasks.map((task) => normalizePath(task.path)));

		return this.plugin.goalRepository.listGoals().filter((goal) => {
			const hasProjectLink = (goal.relatedProjects ?? []).some(
				(link) => this.resolveLinkedPath(link) === normalizedProjectPath
			);
			if (hasProjectLink) {
				return true;
			}

			return (goal.relatedTasks ?? []).some((link) =>
				projectTaskPaths.has(this.resolveLinkedPath(link))
			);
		});
	}

	private getGoalTasks(goal: GoalInfo, projectTasks: TaskInfo[]): TaskInfo[] {
		const projectTasksByPath = new Map(
			projectTasks.map((task) => [normalizePath(task.path), task] as const)
		);
		const tasks: TaskInfo[] = [];

		for (const taskLink of goal.relatedTasks ?? []) {
			const task = projectTasksByPath.get(this.resolveLinkedPath(taskLink));
			if (task) {
				tasks.push(task);
			}
		}

		return tasks;
	}

	private async extractTaskSteps(task: TaskInfo): Promise<string[]> {
		const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
		if (!(file instanceof TFile)) {
			return [];
		}

		const content = await this.plugin.app.vault.cachedRead(file);
		const details = this.stripFrontmatter(content);
		if (!details.trim()) {
			return [];
		}

		return details
			.split(/\r?\n/)
			.map((line) => line.match(/^\s*[-*]\s+\[[ xX-]\]\s+(.+)$/)?.[1]?.trim())
			.filter((step): step is string => !!step)
			.slice(0, 8)
			.map((step) => `- ${step}`);
	}

	private stripFrontmatter(content: string): string {
		if (!content.startsWith("---")) {
			return content;
		}

		const frontmatterEnd = content.indexOf("\n---", 3);
		if (frontmatterEnd < 0) {
			return content;
		}

		return content.slice(frontmatterEnd + 4);
	}

	private createFileNode(
		file: string,
		x: number,
		y: number,
		width: number,
		height: number,
		color?: string
	): CanvasNode {
		return {
			id: this.nextNodeId(),
			type: "file",
			file,
			x,
			y,
			width,
			height,
			color,
		};
	}

	private createTextNode(
		text: string,
		x: number,
		y: number,
		width: number,
		height: number,
		color?: string
	): CanvasNode {
		return {
			id: this.nextNodeId(),
			type: "text",
			text,
			x,
			y,
			width,
			height,
			color,
		};
	}

	private createEdge(fromNode: string, toNode: string, color?: string): CanvasEdge {
		return {
			id: this.nextEdgeId(),
			fromNode,
			fromSide: "right",
			toNode,
			toSide: "left",
			color,
		};
	}

	private getTaskColor(task: TaskInfo): string {
		if (this.plugin.statusManager.isCompletedStatus(task.status)) {
			return "6";
		}

		switch (task.status) {
			case "blocked":
				return "1";
			case "in_progress":
				return "2";
			case "backlog":
				return "5";
			default:
				return "3";
		}
	}

	private async getProjectCanvasPath(project: ProjectInfo): Promise<string> {
		const folder = normalizePath(project.folder || this.plugin.settings.systemFolder);
		const slug = this.slugify(project.title || "project");
		return normalizePath(`${folder}/${slug} project map.canvas`);
	}

	private resolveLinkedPath(link: string): string {
		const normalized = normalizeEntityLink(link);
		if (!normalized) {
			return "";
		}

		const file = this.plugin.app.vault.getAbstractFileByPath(normalized);
		if (file instanceof TFile) {
			return normalizePath(file.path);
		}

		const destination = this.plugin.app.metadataCache.getFirstLinkpathDest(
			normalized.replace(/\.md$/i, ""),
			""
		);
		return destination ? normalizePath(destination.path) : normalizePath(normalized);
	}

	private slugify(value: string): string {
		return value
			.trim()
			.toLowerCase()
			.replace(/[\\/:*?"<>|#^[\]]+/g, "")
			.replace(/\s+/g, "-")
			.slice(0, 80) || "project";
	}

	private nextNodeId(): string {
		this.nodeCounter += 1;
		return `node-${this.nodeCounter}`;
	}

	private nextEdgeId(): string {
		this.edgeCounter += 1;
		return `edge-${this.edgeCounter}`;
	}
}
