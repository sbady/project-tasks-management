import { App, ButtonComponent, Modal, Notice, Setting } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { GoalCreationData, GoalInfo, GoalPeriodType } from "../types";
import { splitListPreservingLinksAndQuotes } from "../utils/stringSplit";
import { getTodayString, parseDateAsLocal } from "../utils/dateUtils";

interface GoalCreationModalOptions {
	initialValues?: Partial<GoalCreationData>;
	onGoalCreated?: (goal: GoalInfo) => void;
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

function getPeriodLabel(periodType: GoalPeriodType): string {
	switch (periodType) {
		case "week":
			return "Week";
		case "month":
			return "Month";
		case "quarter":
		default:
			return "Quarter";
	}
}

export class GoalCreationModal extends Modal {
	private title = "";
	private periodType: GoalPeriodType = "week";
	private referenceDate = getTodayString();
	private description = "";
	private relatedProjects = "";
	private relatedTasks = "";
	private relatedNotes = "";
	private periodPreviewEl: HTMLElement | null = null;
	private saveButton: ButtonComponent | null = null;

	constructor(
		app: App,
		private plugin: TaskNotesPlugin,
		private options: GoalCreationModalOptions = {}
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		this.title = this.options.initialValues?.title ?? "";
		this.periodType = this.options.initialValues?.periodType ?? "week";
		this.referenceDate = this.options.initialValues?.referenceDate ?? getTodayString();
		this.description = this.options.initialValues?.description ?? "";
		this.relatedProjects = (this.options.initialValues?.relatedProjects ?? []).join(", ");
		this.relatedTasks = (this.options.initialValues?.relatedTasks ?? []).join(", ");
		this.relatedNotes = (this.options.initialValues?.relatedNotes ?? []).join(", ");

		new Setting(contentEl).setName("Create goal").setHeading();

		new Setting(contentEl)
			.setName("Title")
			.setDesc("Use one clear focus statement for the selected period.")
			.addText((text) => {
				text.setPlaceholder("Goal title")
					.setValue(this.title)
					.onChange((value) => {
						this.title = value;
					});
				setTimeout(() => text.inputEl.focus(), 0);
			});

		new Setting(contentEl)
			.setName("Period")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("week", "Week")
					.addOption("month", "Month")
					.addOption("quarter", "Quarter")
					.setValue(this.periodType)
					.onChange((value) => {
						this.periodType = value as GoalPeriodType;
						this.updatePeriodPreview();
					});
			});

		new Setting(contentEl)
			.setName("Reference date")
			.setDesc("The plugin derives the period key and date range from this date.")
			.addText((text) => {
				text.setValue(this.referenceDate).onChange((value) => {
					this.referenceDate = value;
					this.updatePeriodPreview();
				});
				text.inputEl.type = "date";
			});

		this.periodPreviewEl = contentEl.createEl("p");
		this.updatePeriodPreview();

		new Setting(contentEl)
			.setName("Description")
			.addTextArea((text) => {
				text.setPlaceholder("Describe the outcome you want from this period")
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
				button.setButtonText("Create").setCta().onClick(() => {
					void this.handleSubmit();
				});
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private updatePeriodPreview(): void {
		if (!this.periodPreviewEl) {
			return;
		}

		const descriptor = this.plugin.goalPeriodService.getPeriodDescriptor(
			this.periodType,
			this.referenceDate ? parseDateAsLocal(this.referenceDate) : new Date()
		);
		this.periodPreviewEl.textContent =
			`${getPeriodLabel(descriptor.periodType)} ${descriptor.periodKey}: ${descriptor.periodStart} to ${descriptor.periodEnd}`
		;
	}

	private buildGoalData(): GoalCreationData {
		return {
			title: this.title.trim(),
			periodType: this.periodType,
			referenceDate: this.referenceDate,
			description: normalizeOptionalString(this.description),
			relatedProjects: normalizeLinkList(this.relatedProjects),
			relatedTasks: normalizeLinkList(this.relatedTasks),
			relatedNotes: normalizeLinkList(this.relatedNotes),
		};
	}

	private async handleSubmit(): Promise<void> {
		if (!this.title.trim()) {
			new Notice("Goal title is required.");
			return;
		}

		this.saveButton?.setDisabled(true);
		try {
			const result = await this.plugin.goalService.createGoal(this.buildGoalData());
			new Notice(
				result.created ? `Goal created: ${result.goal.title}` : `Goal opened: ${result.goal.title}`
			);
			this.options.onGoalCreated?.(result.goal);
			this.close();
		} catch (error) {
			console.error("Failed to create goal:", error);
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Failed to create goal: ${message}`);
			this.saveButton?.setDisabled(false);
		}
	}
}
