import { App, ButtonComponent, Modal, Notice, Setting } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { GoalInfo } from "../types";
import { splitListPreservingLinksAndQuotes } from "../utils/stringSplit";

interface GoalEditModalOptions {
	goal: GoalInfo;
	onGoalUpdated?: (goal: GoalInfo) => void;
}

function normalizeOptionalString(value: string): string | undefined {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeLinkList(value: string): string[] | undefined {
	const entries = splitListPreservingLinksAndQuotes(value.replace(/\r?\n/g, ","))
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
	return entries.length > 0 ? entries : undefined;
}

export class GoalEditModal extends Modal {
	private title: string;
	private description: string;
	private relatedProjects: string;
	private relatedTasks: string;
	private relatedNotes: string;
	private saveButton: ButtonComponent | null = null;

	constructor(
		app: App,
		private plugin: TaskNotesPlugin,
		private options: GoalEditModalOptions
	) {
		super(app);
		this.title = options.goal.title;
		this.description = options.goal.description ?? "";
		this.relatedProjects = (options.goal.relatedProjects ?? []).join(", ");
		this.relatedTasks = (options.goal.relatedTasks ?? []).join(", ");
		this.relatedNotes = (options.goal.relatedNotes ?? []).join(", ");
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		new Setting(contentEl).setName("Edit goal").setHeading();

		new Setting(contentEl).setName("Period").setDesc(
			`${this.options.goal.periodType}: ${this.options.goal.periodKey}`
		);
		new Setting(contentEl)
			.setName("Range")
			.setDesc(`${this.options.goal.periodStart} to ${this.options.goal.periodEnd}`);

		new Setting(contentEl)
			.setName("Title")
			.setDesc("Period identity stays fixed in this milestone.")
			.addText((text) => {
				text.setPlaceholder("Goal title")
					.setValue(this.title)
					.onChange((value) => {
						this.title = value;
					});
				setTimeout(() => text.inputEl.focus(), 0);
			});

		new Setting(contentEl)
			.setName("Description")
			.addTextArea((text) => {
				text.setPlaceholder("Describe the goal")
					.setValue(this.description)
					.onChange((value) => {
						this.description = value;
					});
				text.inputEl.rows = 4;
			});

		new Setting(contentEl)
			.setName("Related projects")
			.setDesc("Comma-separated project note links.")
			.addTextArea((text) => {
				text.setPlaceholder("[[Projects/example/project]]")
					.setValue(this.relatedProjects)
					.onChange((value) => {
						this.relatedProjects = value;
					});
				text.inputEl.rows = 2;
			});

		new Setting(contentEl)
			.setName("Related tasks")
			.setDesc("Comma-separated task note links.")
			.addTextArea((text) => {
				text.setPlaceholder("[[Tasks/example-task]]")
					.setValue(this.relatedTasks)
					.onChange((value) => {
						this.relatedTasks = value;
					});
				text.inputEl.rows = 2;
			});

		new Setting(contentEl)
			.setName("Related notes")
			.setDesc("Comma-separated knowledge note links.")
			.addTextArea((text) => {
				text.setPlaceholder("[[Resources/example-note]]")
					.setValue(this.relatedNotes)
					.onChange((value) => {
						this.relatedNotes = value;
					});
				text.inputEl.rows = 2;
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

	private async handleSubmit(): Promise<void> {
		if (!this.title.trim()) {
			new Notice("Goal title is required.");
			return;
		}

		this.saveButton?.setDisabled(true);
		try {
			const updatedGoal = await this.plugin.goalService.updateGoal(this.options.goal, {
				title: this.title.trim(),
				description: normalizeOptionalString(this.description),
				relatedProjects: normalizeLinkList(this.relatedProjects),
				relatedTasks: normalizeLinkList(this.relatedTasks),
				relatedNotes: normalizeLinkList(this.relatedNotes),
			});

			new Notice(`Goal updated: ${updatedGoal.title}`);
			this.options.onGoalUpdated?.(updatedGoal);
			this.close();
		} catch (error) {
			console.error("Failed to update goal:", error);
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Failed to update goal: ${message}`);
			this.saveButton?.setDisabled(false);
		}
	}
}
