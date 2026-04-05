import { App, ButtonComponent, Modal, Notice, Setting } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { ProjectCreationData, ProjectInfo } from "../types";
import { splitListPreservingLinksAndQuotes } from "../utils/stringSplit";

interface ProjectCreationModalOptions {
	initialValues?: Partial<ProjectCreationData>;
	onProjectCreated?: (project: ProjectInfo) => void;
}

function normalizeOptionalString(value: string): string | undefined {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeTagList(value: string): string[] | undefined {
	const tags = value
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
	return tags.length > 0 ? tags : undefined;
}

function normalizeLinkList(value: string): string[] | undefined {
	const entries = splitListPreservingLinksAndQuotes(value.replace(/\r?\n/g, ","))
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
	return entries.length > 0 ? entries : undefined;
}

export class ProjectCreationModal extends Modal {
	private title = "";
	private status: string;
	private description = "";
	private relatedNotes = "";
	private tags = "";
	private startDate = "";
	private dueDate = "";
	private completedDate = "";
	private saveButton: ButtonComponent | null = null;

	constructor(
		app: App,
		private plugin: TaskNotesPlugin,
		private options: ProjectCreationModalOptions = {}
	) {
		super(app);
		this.status = plugin.settings.projectStatuses[0]?.value || "active";
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		this.title = this.options.initialValues?.title ?? "";
		this.status =
			this.options.initialValues?.status ??
			this.plugin.settings.projectStatuses[0]?.value ??
			"active";
		this.description = this.options.initialValues?.description ?? "";
		this.relatedNotes = (this.options.initialValues?.relatedNotes ?? []).join(", ");
		this.tags = (this.options.initialValues?.tags ?? []).join(", ");
		this.startDate = this.options.initialValues?.startDate ?? "";
		this.dueDate = this.options.initialValues?.dueDate ?? "";
		this.completedDate = this.options.initialValues?.completedDate ?? "";

		new Setting(contentEl).setName("Create project").setHeading();

		new Setting(contentEl)
			.setName("Title")
			.setDesc("This title is used for the project note and project folder.")
			.addText((text) => {
				text.setPlaceholder("Project title")
					.setValue(this.title)
					.onChange((value) => {
						this.title = value;
					});
				setTimeout(() => text.inputEl.focus(), 0);
			});

		new Setting(contentEl)
			.setName("Status")
			.setDesc("The initial project status.")
			.addDropdown((dropdown) => {
				for (const option of this.plugin.settings.projectStatuses) {
					dropdown.addOption(option.value, option.label);
				}
				dropdown.setValue(this.status).onChange((value) => {
					this.status = value;
				});
			});

		new Setting(contentEl)
			.setName("Description")
			.setDesc("Optional summary for the project note.")
			.addTextArea((text) => {
				text.setPlaceholder("Describe the project")
					.setValue(this.description)
					.onChange((value) => {
						this.description = value;
					});
				text.inputEl.rows = 4;
			});

		new Setting(contentEl)
			.setName("Related notes")
			.setDesc("Comma-separated note links.")
			.addTextArea((text) => {
				text.setPlaceholder("[[Projects/example/spec]]")
					.setValue(this.relatedNotes)
					.onChange((value) => {
						this.relatedNotes = value;
					});
				text.inputEl.rows = 2;
			});

		new Setting(contentEl)
			.setName("Tags")
			.setDesc("Comma-separated tags without extra formatting.")
			.addText((text) => {
				text.setPlaceholder("client, planning")
					.setValue(this.tags)
					.onChange((value) => {
						this.tags = value;
					});
			});

		this.createDateSetting(contentEl, "Start date", this.startDate, (value) => {
			this.startDate = value;
		});
		this.createDateSetting(contentEl, "Due date", this.dueDate, (value) => {
			this.dueDate = value;
		});
		this.createDateSetting(contentEl, "Completed date", this.completedDate, (value) => {
			this.completedDate = value;
		});

		new Setting(contentEl)
			.addButton((button) => {
				button.setButtonText("Cancel").onClick(() => this.close());
			})
			.addButton((button) => {
				this.saveButton = button;
				button.setButtonText("Create").setCta().onClick(() => {
					void this.handleSubmit();
				});
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private createDateSetting(
		container: HTMLElement,
		name: string,
		value: string,
		onChange: (value: string) => void
	): void {
		new Setting(container).setName(name).addText((text) => {
			text.setValue(value).onChange(onChange);
			text.inputEl.type = "date";
		});
	}

	private buildProjectData(): ProjectCreationData {
		return {
			title: this.title.trim(),
			status: this.status,
			description: normalizeOptionalString(this.description),
			relatedNotes: normalizeLinkList(this.relatedNotes),
			tags: normalizeTagList(this.tags),
			startDate: normalizeOptionalString(this.startDate),
			dueDate: normalizeOptionalString(this.dueDate),
			completedDate: normalizeOptionalString(this.completedDate),
		};
	}

	private async handleSubmit(): Promise<void> {
		if (!this.title.trim()) {
			new Notice("Project title is required.");
			return;
		}

		this.saveButton?.setDisabled(true);
		try {
			const result = await this.plugin.projectService.createProject(this.buildProjectData());
			new Notice(
				result.created ? `Project created: ${result.project.title}` : `Project opened: ${result.project.title}`
			);
			this.options.onProjectCreated?.(result.project);
			this.close();
		} catch (error) {
			console.error("Failed to create project:", error);
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Failed to create project: ${message}`);
			this.saveButton?.setDisabled(false);
		}
	}
}
