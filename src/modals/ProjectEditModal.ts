import { App, ButtonComponent, Modal, Notice, Setting } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { ProjectInfo } from "../types";
import { splitListPreservingLinksAndQuotes } from "../utils/stringSplit";

interface ProjectEditModalOptions {
	project: ProjectInfo;
	onProjectUpdated?: (project: ProjectInfo) => void;
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

export class ProjectEditModal extends Modal {
	private title: string;
	private status: string;
	private description: string;
	private relatedNotes: string;
	private tags: string;
	private startDate: string;
	private dueDate: string;
	private completedDate: string;
	private saveButton: ButtonComponent | null = null;

	constructor(
		app: App,
		private plugin: TaskNotesPlugin,
		private options: ProjectEditModalOptions
	) {
		super(app);
		this.title = options.project.title;
		this.status = options.project.status;
		this.description = options.project.description ?? "";
		this.relatedNotes = (options.project.relatedNotes ?? []).join(", ");
		this.tags = (options.project.tags ?? []).join(", ");
		this.startDate = options.project.startDate ?? "";
		this.dueDate = options.project.dueDate ?? "";
		this.completedDate = options.project.completedDate ?? "";
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		new Setting(contentEl).setName("Edit project").setHeading();

		new Setting(contentEl).setName("Project folder").setDesc(this.options.project.folder);
		new Setting(contentEl).setName("Project note").setDesc(this.options.project.path);

		new Setting(contentEl)
			.setName("Title")
			.setDesc("Changing the title does not rename the folder in this milestone.")
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
				button.setButtonText("Save").setCta().onClick(() => {
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

	private async handleSubmit(): Promise<void> {
		if (!this.title.trim()) {
			new Notice("Project title is required.");
			return;
		}

		this.saveButton?.setDisabled(true);
		try {
			const updatedProject = await this.plugin.projectService.updateProject(this.options.project, {
				title: this.title.trim(),
				status: this.status,
				description: normalizeOptionalString(this.description),
				relatedNotes: normalizeLinkList(this.relatedNotes),
				tags: normalizeTagList(this.tags),
				startDate: normalizeOptionalString(this.startDate),
				dueDate: normalizeOptionalString(this.dueDate),
				completedDate: normalizeOptionalString(this.completedDate),
			});

			new Notice(`Project updated: ${updatedProject.title}`);
			this.options.onProjectUpdated?.(updatedProject);
			this.close();
		} catch (error) {
			console.error("Failed to update project:", error);
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Failed to update project: ${message}`);
			this.saveButton?.setDisabled(false);
		}
	}
}
