import { ItemView, Notice, TFile, WorkspaceLeaf, normalizePath, setIcon } from "obsidian";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import TaskNotesPlugin from "../main";
import { createTaskCard } from "../ui/TaskCard";
import { PropertyVisibilityDropdown } from "../ui/PropertyVisibilityDropdown";
import {
	DASHBOARD_VIEW_TYPE,
	type DashboardCaptureOption,
	type DashboardData,
	type DashboardGoalGroupsPayload,
	type DashboardGoalProgressItem,
	type DashboardPlannerDayGroup,
	type DashboardPlannerMode,
	type DashboardProgressScope,
	type DashboardProjectSort,
	type DashboardProjectsListItem,
	type GoalInfo,
	type GoalPeriodType,
	type TaskSortKey,
	type TaskInfo,
} from "../types";
import { getTodayString, parseDateAsLocal } from "../utils/dateUtils";
import { ensureFolderExists } from "../utils/helpers";
import { convertInternalToUserProperties } from "../utils/propertyMapping";
import { normalizeEntityLink } from "../core/links/normalizeEntityLink";

type DashboardGoalScopeLocal = "today" | "week" | "month";
type TaskVisibilityFilter = "open" | "done" | "all";
type DashboardProjectFilter = "all" | string;

interface DashboardViewPreferences {
	plannerSortKey?: TaskSortKey;
	plannerProjectFilter?: DashboardProjectFilter;
	plannerVisibleProperties?: string[];
	plannerGoalFilterPath?: string;
}

export class DashboardView extends ItemView {
	private dashboardData: DashboardData | null = null;
	private refreshTimeout: number | null = null;
	private selectedDate = getTodayString();
	private focusTaskPath = "";
	private plannerMode: DashboardPlannerMode = "today";
	private progressScope: DashboardProgressScope = "today";
	private goalScope: DashboardGoalScopeLocal = "week";
	private projectSort: DashboardProjectSort = "due";
	private projectStatusFilter = "all";
	private taskVisibilityFilter: TaskVisibilityFilter = "open";
	private plannerSortKey: TaskSortKey = "priority";
	private plannerProjectFilter: DashboardProjectFilter = "all";
	private plannerGoalFilterPath = "";
	private plannerVisibleProperties = ["status", "priority", "projects", "scheduled", "due"];
	private quickActionsOpen = false;
	private captureValue = "";
	private captureProject = "";
	private captureGoal = "";
	private goalsExpanded = false;
	private goalListOffset = 0;

	constructor(leaf: WorkspaceLeaf, private plugin: TaskNotesPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return DASHBOARD_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Dashboard";
	}

	getIcon(): string {
		return "layout-dashboard";
	}

	async onOpen(): Promise<void> {
		await this.plugin.onReady();
		this.loadViewPreferences();
		this.registerEvent(this.plugin.emitter.on("data-changed", () => this.scheduleRefresh()));
		this.registerEvent(this.plugin.emitter.on("task-updated", () => this.scheduleRefresh()));
		this.registerEvent(this.plugin.emitter.on("date-changed", () => this.scheduleRefresh()));
		this.registerEvent(this.plugin.emitter.on("pomodoro-start", () => this.scheduleRefresh()));
		this.registerEvent(this.plugin.emitter.on("pomodoro-stop", () => this.scheduleRefresh()));
		this.registerEvent(this.plugin.emitter.on("pomodoro-state-changed", () => this.scheduleRefresh()));
		this.registerEvent(this.plugin.emitter.on("pomodoro-tick", () => this.scheduleRefresh()));
		await this.refresh();
	}

	async onClose(): Promise<void> {
		if (this.refreshTimeout !== null) {
			window.clearTimeout(this.refreshTimeout);
			this.refreshTimeout = null;
		}
		this.contentEl.empty();
	}

	private scheduleRefresh(): void {
		if (this.refreshTimeout !== null) {
			window.clearTimeout(this.refreshTimeout);
		}

		this.refreshTimeout = window.setTimeout(() => {
			this.refreshTimeout = null;
			void this.refresh();
		}, 150);
	}

	private async refresh(): Promise<void> {
		this.dashboardData = await this.plugin.dashboardService.getDashboardData(this.selectedDate);
		await this.syncFocusSelection();
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		const container = contentEl.createDiv({
			cls: "tasknotes-plugin tasknotes-container dashboard-v2",
		});

		this.renderHeader(container);

		if (!this.dashboardData) {
			container.createEl("p", {
				cls: "dashboard-v2__empty",
				text: "Dashboard data is not available yet.",
			});
			return;
		}

		this.renderTopRow(container);
		this.renderPlannerSection(container);
		this.renderProjectsSection(container);
		this.renderCaptureSection(container);
	}

	private renderHeader(container: HTMLElement): void {
		const header = container.createDiv({ cls: "dashboard-v2__header" });
		const copy = header.createDiv({ cls: "dashboard-v2__header-copy" });
		copy.createEl("h1", { cls: "dashboard-v2__title", text: "Project Tasks Management" });
		copy.createEl("p", {
			cls: "dashboard-v2__subtitle",
			text: "A calm command center for goals, plans, projects, and daily work.",
		});

		const actions = header.createDiv({ cls: "dashboard-v2__header-actions" });
		const refreshButton = this.createIconButton(actions, "refresh-cw", "Refresh dashboard");
		this.registerDomEvent(refreshButton, "click", () => {
			void this.refresh();
		});

		const quickButton = actions.createEl("button", {
			cls: "dashboard-v2__quick-trigger",
			attr: { "aria-label": "Open quick actions", "aria-expanded": this.quickActionsOpen ? "true" : "false" },
		});
		const quickLabel = quickButton.createSpan({ cls: "dashboard-v2__quick-trigger-label", text: "Quick actions" });
		void quickLabel;
		const quickIcon = quickButton.createSpan({ cls: "dashboard-v2__quick-trigger-icon" });
		setIcon(quickIcon, "sparkles");
		this.registerDomEvent(quickButton, "click", () => {
			this.quickActionsOpen = !this.quickActionsOpen;
			this.render();
		});

		if (this.quickActionsOpen && this.dashboardData) {
			const panel = header.createDiv({ cls: "dashboard-v2__quick-panel" });
			for (const action of this.dashboardData.quickActions.actions) {
				const actionButton = panel.createEl("button", {
					cls: "dashboard-v2__quick-action",
					text: action.label,
					attr: { "aria-label": action.label },
				});
				this.registerDomEvent(actionButton, "click", () => {
					this.quickActionsOpen = false;
					void this.executeQuickAction(action.commandId);
				});
			}
		}
	}

	private renderTopRow(container: HTMLElement): void {
		if (!this.dashboardData) return;

		const topRow = container.createDiv({ cls: "dashboard-v2__top-grid" });
		const leftColumn = topRow.createDiv({ cls: "dashboard-v2__top-stack" });
		this.renderProgressCard(leftColumn);
		this.renderFocusCard(leftColumn);
		this.renderGoalsCard(topRow);
	}

	private renderFocusCard(container: HTMLElement): void {
		if (!this.dashboardData) return;
		const card = container.createDiv({ cls: "dashboard-v2__panel dashboard-v2__panel--focus" });
		const top = card.createDiv({ cls: "dashboard-v2__panel-top dashboard-v2__panel-top--focus" });
		top.createDiv({ cls: "dashboard-v2__eyebrow", text: "Focus" });

		const pomodoroState = this.plugin.pomodoroService.getState();
		const timer = top.createDiv({ cls: "dashboard-v2__focus-timer" });
		timer.createDiv({
			cls: "dashboard-v2__focus-time",
			text: this.formatPomodoroTime(pomodoroState.timeRemaining),
		});
		timer.createDiv({
			cls: "dashboard-v2__focus-session",
			text: pomodoroState.currentSession?.type === "work" ? "Work session" : pomodoroState.currentSession?.type ?? "Ready",
		});

		const content = card.createDiv({ cls: "dashboard-v2__focus-content" });
		content.appendChild(
			this.createSelectControl(
				[
					{ label: "Choose focus task", value: "" },
					...this.getFocusTaskOptions(),
				],
				this.focusTaskPath,
				(value) => {
					this.focusTaskPath = value;
					void this.plugin.pomodoroService.saveLastSelectedTask(value || undefined);
					this.render();
				},
				"dashboard-v2__select dashboard-v2__select--compact"
			)
		);

		const selectedTask = this.getSelectedFocusTask();
		const summary = content.createDiv({ cls: "dashboard-v2__focus-summary" });
		const titleButton = summary.createEl("button", {
			cls: "dashboard-v2__focus-title",
			text: selectedTask?.title || "No focus task selected",
			attr: { "aria-label": selectedTask ? `Open task ${selectedTask.title}` : "No focus task selected" },
		});
		this.registerDomEvent(titleButton, "click", () => {
			if (selectedTask) {
				void this.openPath(selectedTask.path);
			}
		});
		summary.createEl("p", {
			cls: "dashboard-v2__focus-subtitle",
			text: selectedTask ? this.getFocusMetaLabel(selectedTask) : "Pick a task and start a focus session.",
		});

		const actions = card.createDiv({ cls: "dashboard-v2__focus-actions" });
		const startButton = actions.createEl("button", {
			cls: "mod-cta dashboard-v2__primary-button",
			text: pomodoroState.isRunning ? "Running" : pomodoroState.currentSession ? "Resume" : "Start",
			attr: { "aria-label": "Start focus session" },
		});
		if (pomodoroState.isRunning) {
			startButton.disabled = true;
		}
		this.registerDomEvent(startButton, "click", () => {
			void this.handleFocusPrimaryAction();
		});

		if (pomodoroState.isRunning) {
			const pauseButton = actions.createEl("button", {
				cls: "dashboard-v2__subtle-button",
				text: "Pause",
				attr: { "aria-label": "Pause focus session" },
			});
			this.registerDomEvent(pauseButton, "click", () => {
				void this.plugin.pomodoroService.pausePomodoro();
			});
		}

		if (pomodoroState.currentSession) {
			const stopButton = actions.createEl("button", {
				cls: "dashboard-v2__subtle-button",
				text: "Stop",
				attr: { "aria-label": "Stop focus session" },
			});
			this.registerDomEvent(stopButton, "click", () => {
				void this.plugin.pomodoroService.stopPomodoro();
			});
		}
	}

	private renderProgressCard(container: HTMLElement): void {
		if (!this.dashboardData) return;
		const card = container.createDiv({ cls: "dashboard-v2__panel dashboard-v2__panel--progress" });
		const top = card.createDiv({ cls: "dashboard-v2__panel-top" });
		top.createDiv({ cls: "dashboard-v2__eyebrow", text: "Progress" });
		top.appendChild(
			this.createSelectControl(
				[
					{ value: "today", label: "Сегодня" },
					{ value: "week", label: "Неделя" },
				],
				this.progressScope,
				(value) => {
					this.progressScope = value as DashboardProgressScope;
					this.render();
				},
				"dashboard-v2__select dashboard-v2__select--compact"
			)
		);

		const completed =
			this.progressScope === "today"
				? this.dashboardData.progress.todayCompleted
				: this.dashboardData.progress.weekCompleted;
		const remaining =
			this.progressScope === "today"
				? this.dashboardData.progress.todayRemaining
				: this.dashboardData.progress.weekRemaining;
		const total = completed + remaining;
		const progress = total > 0 ? completed / total : 0;

		const stats = card.createDiv({ cls: "dashboard-v2__progress-stats" });
		this.renderMetric(stats, "Готово", String(completed));
		this.renderMetric(stats, "Осталось", String(remaining));
		this.renderMetric(stats, "Всего", String(total));

		const bar = card.createDiv({ cls: "dashboard-v2__progress-bar" });
		const fill = bar.createDiv({ cls: "dashboard-v2__progress-fill" });
		fill.style.width = `${Math.round(progress * 100)}%`;
	}

	private renderGoalsCard(container: HTMLElement): void {
		if (!this.dashboardData) return;
		const card = container.createDiv({ cls: "dashboard-v2__panel dashboard-v2__panel--goals" });
		const top = card.createDiv({ cls: "dashboard-v2__panel-top" });
		const topLeft = top.createDiv({ cls: "dashboard-v2__goals-top-left" });
		topLeft.createDiv({ cls: "dashboard-v2__eyebrow", text: "Goals" });
		topLeft.appendChild(
			this.createSelectControl(
				[
					{ value: "today", label: "Цели на сегодня" },
					{ value: "week", label: "Цели недели" },
					{ value: "month", label: "Цели месяца" },
				],
				this.goalScope,
				(value) => {
					this.goalScope = value as DashboardGoalScopeLocal;
					this.render();
				},
				"dashboard-v2__select dashboard-v2__select--compact"
			)
		);
		const topRight = top.createDiv({ cls: "dashboard-v2__goals-top-right" });
		const createTopButton = topRight.createEl("button", {
			cls: "dashboard-v2__subtle-button",
			text: "РќРѕРІР°СЏ С†РµР»СЊ",
			attr: { "aria-label": "Create goal" },
		});
		this.registerDomEvent(createTopButton, "click", () => {
			const periodType: GoalPeriodType = this.goalScope === "today" ? "week" : this.goalScope;
			this.plugin.openGoalCreationModal({
				periodType,
				referenceDate: this.selectedDate,
			});
		});

		const goals = this.getGoalItemsForScope(this.dashboardData.goalGroups, this.goalScope);
		if (goals.length === 0) {
			card.createEl("p", {
				cls: "dashboard-v2__empty",
				text: "В этом периоде пока нет целей.",
			});
		} else {
			const controls = card.createDiv({ cls: "dashboard-v2__goal-list-controls" });
			if (goals.length > 3) {
				const cycleButton = controls.createEl("button", {
					cls: "dashboard-v2__subtle-button",
					text: "Другие",
					attr: { "aria-label": "Show other goals" },
				});
				this.registerDomEvent(cycleButton, "click", () => {
					const nextOffset = this.goalListOffset + 3;
					this.goalListOffset = nextOffset >= goals.length ? 0 : nextOffset;
					this.render();
				});
			}

			const expandButton = controls.createEl("button", {
				cls: "dashboard-v2__subtle-button",
				text: this.goalsExpanded ? "Свернуть" : "Все цели",
				attr: { "aria-label": this.goalsExpanded ? "Collapse goals" : "Expand goals" },
			});
			this.registerDomEvent(expandButton, "click", () => {
				this.goalsExpanded = !this.goalsExpanded;
				if (!this.goalsExpanded) {
					this.goalListOffset = 0;
				}
				this.render();
			});

			const list = card.createDiv({ cls: "dashboard-v2__goal-list" });
			for (const item of this.getVisibleGoalItems(goals)) {
				this.renderGoalItem(list, item);
			}
		}

		const actions = card.createDiv({ cls: "dashboard-v2__panel-actions" });
		const createButton = actions.createEl("button", {
			cls: "dashboard-v2__subtle-button",
			text: "Новая цель",
			attr: { "aria-label": "Create goal" },
		});
		this.registerDomEvent(createButton, "click", () => {
			const periodType: GoalPeriodType = this.goalScope === "today" ? "week" : this.goalScope;
			this.plugin.openGoalCreationModal({
				periodType,
				referenceDate: this.selectedDate,
			});
		});
	}

	private renderGoalItem(container: HTMLElement, item: DashboardGoalProgressItem): void {
		const row = container.createDiv({ cls: "dashboard-v2__goal-item" });
		row.tabIndex = 0;
		row.setAttribute("role", "button");
		row.setAttribute("aria-label", `Open goal ${item.goal.title}`);
		this.registerDomEvent(row, "click", () => {
			void this.openPath(item.goal.path);
		});
		this.registerDomEvent(row, "keydown", (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				void this.openPath(item.goal.path);
			}
		});

		const header = row.createDiv({ cls: "dashboard-v2__goal-head" });
		header.createDiv({
			cls: "dashboard-v2__goal-title",
			text: item.goal.title,
		});
		header.createDiv({
			cls: "dashboard-v2__goal-ratio",
			text: `${item.completedTasks}/${item.totalTasks || 0}`,
		});

		const meta = row.createDiv({ cls: "dashboard-v2__goal-meta" });
		meta.createDiv({
			cls: "dashboard-v2__pill",
			text: `${Math.round(item.progress * 100)}%`,
		});
		if (item.activeTasksToday > 0) {
			const todayButton = meta.createEl("button", {
				cls: "dashboard-v2__pill dashboard-v2__pill--accent dashboard-v2__goal-pill-button",
				text: `${item.activeTasksToday} сегодня`,
			});
			this.registerDomEvent(todayButton, "click", (event) => {
				event.stopPropagation();
				this.applyGoalPlannerFilter(item.goal.path, "today");
			});
		}
		if (item.activeTasksThisWeek > 0) {
			const weekButton = meta.createEl("button", {
				cls: "dashboard-v2__pill dashboard-v2__goal-pill-button",
				text: `${item.activeTasksThisWeek} на неделе`,
			});
			this.registerDomEvent(weekButton, "click", (event) => {
				event.stopPropagation();
				this.applyGoalPlannerFilter(item.goal.path, "week");
			});
		}

		const bar = row.createDiv({ cls: "dashboard-v2__progress-bar dashboard-v2__progress-bar--thin" });
		const fill = bar.createDiv({ cls: "dashboard-v2__progress-fill" });
		fill.style.width = `${Math.round(item.progress * 100)}%`;
	}

	private renderPlannerSection(container: HTMLElement): void {
		if (!this.dashboardData) return;
		const section = container.createDiv({ cls: "dashboard-v2__panel dashboard-v2__panel--planner" });
		const top = section.createDiv({ cls: "dashboard-v2__panel-top dashboard-v2__panel-top--planner" });
		top.createDiv({ cls: "dashboard-v2__section-title", text: "Planning" });

		const controls = top.createDiv({ cls: "dashboard-v2__planner-controls" });
		controls.appendChild(
			this.createSelectControl(
				[
					{ value: "today", label: "Today" },
					{ value: "week", label: "Week" },
					{ value: "calendar", label: "Calendar" },
				],
				this.plannerMode,
				(value) => {
					this.plannerMode = value as DashboardPlannerMode;
					this.render();
				},
				"dashboard-v2__select dashboard-v2__select--compact"
			)
		);
		controls.appendChild(
			this.createSelectControl(
				[
					{ value: "open", label: "Open tasks" },
					{ value: "done", label: "Completed tasks" },
					{ value: "all", label: "All tasks" },
				],
				this.taskVisibilityFilter,
				(value) => {
					this.taskVisibilityFilter = value as TaskVisibilityFilter;
					this.render();
				},
				"dashboard-v2__select dashboard-v2__select--compact"
			)
		);
		controls.appendChild(
			this.createSelectControl(
				[
					{ value: "priority", label: "Sort by priority" },
					{ value: "scheduled", label: "Sort by plan" },
					{ value: "due", label: "Sort by deadline" },
					{ value: "status", label: "Sort by status" },
					{ value: "title", label: "Sort by title" },
				],
				this.plannerSortKey,
				(value) => {
					this.plannerSortKey = value as TaskSortKey;
					this.saveViewPreferences();
					this.render();
				},
				"dashboard-v2__select dashboard-v2__select--compact"
			)
		);
		controls.appendChild(
			this.createSelectControl(
				[
					{ value: "all", label: "All projects" },
					...this.getPlannerProjectOptions(),
				],
				this.plannerProjectFilter,
				(value) => {
					this.plannerProjectFilter = value;
					this.saveViewPreferences();
					this.render();
				},
				"dashboard-v2__select dashboard-v2__select--compact"
			)
		);
		if (this.plannerGoalFilterPath) {
			const goalFilter = this.getPlannerGoalFilter();
			const goalIndicator = controls.createEl("button", {
				cls: "dashboard-v2__subtle-button dashboard-v2__planner-goal-indicator",
				text: goalFilter ? `Цель: ${goalFilter.title}` : "Фильтр по цели",
				attr: { "aria-label": "Clear goal filter" },
			});
			this.registerDomEvent(goalIndicator, "click", () => {
				this.plannerGoalFilterPath = "";
				this.saveViewPreferences();
				this.render();
			});
		}
		const propertiesButton = controls.createEl("button", {
			cls: "dashboard-v2__subtle-button",
			text: "Properties",
			attr: { "aria-label": "Choose visible task properties" },
		});
		this.registerDomEvent(propertiesButton, "click", (event) => {
			new PropertyVisibilityDropdown(
				this.plannerVisibleProperties,
				this.plugin,
				(properties) => {
					this.plannerVisibleProperties = properties;
					this.saveViewPreferences();
					this.render();
				}
			).show(event);
		});

		if (this.plannerMode === "today") {
			this.renderTodayPlanner(section, this.preparePlannerTasks(this.dashboardData.planner.todayTasks));
			return;
		}

		if (this.plannerMode === "week") {
			this.renderPlannerWeekHeader(section);
			this.renderWeekPlanner(section, this.dashboardData.planner.weekGroups);
			return;
		}

		this.renderCalendarPlanner(section);
	}

	private renderTodayPlanner(container: HTMLElement, tasks: TaskInfo[]): void {
		if (tasks.length === 0) {
			container.createEl("p", { cls: "dashboard-v2__empty", text: "Nothing planned for today." });
			return;
		}

		this.renderPlannerTaskCards(container, tasks, parseDateAsLocal(this.dashboardData?.currentDate || getTodayString()));
	}

	private renderWeekPlanner(container: HTMLElement, groups: DashboardPlannerDayGroup[]): void {
		const stream = container.createDiv({ cls: "dashboard-v2__week-stream" });
		const visibleGroups = groups
			.map((group) => ({
				...group,
				tasks: this.preparePlannerTasks(group.tasks),
			}))
			.filter((group) => group.tasks.length > 0);

		if (visibleGroups.length === 0) {
			container.createEl("p", { cls: "dashboard-v2__empty", text: "The week is clear for now." });
			return;
		}

		for (const group of visibleGroups) {
			const dayBlock = stream.createDiv({ cls: "dashboard-v2__day-block" });
			const dayHeader = dayBlock.createDiv({ cls: "dashboard-v2__day-header" });
			dayHeader.createDiv({ cls: "dashboard-v2__day-title", text: group.label });
			dayHeader.createDiv({ cls: "dashboard-v2__pill", text: String(group.tasks.length) });

			const dayList = dayBlock.createDiv({ cls: "dashboard-v2__task-stream" });
			this.renderPlannerTaskCards(dayList, group.tasks, parseDateAsLocal(group.date));
		}
	}

	private renderPlannerWeekHeader(container: HTMLElement): void {
		if (!this.dashboardData) return;
		const groups = this.dashboardData.planner.weekGroups;
		if (groups.length === 0) return;

		const header = container.createDiv({ cls: "dashboard-v2__planner-range" });
		const nav = header.createDiv({ cls: "dashboard-v2__planner-range-nav" });
		const previousButton = this.createIconButton(nav, "chevron-left", "Previous week");
		this.registerDomEvent(previousButton, "click", () => {
			this.selectedDate = format(addDays(parseDateAsLocal(this.selectedDate), -7), "yyyy-MM-dd");
			void this.refresh();
		});

		const nextButton = this.createIconButton(nav, "chevron-right", "Next week");
		this.registerDomEvent(nextButton, "click", () => {
			this.selectedDate = format(addDays(parseDateAsLocal(this.selectedDate), 7), "yyyy-MM-dd");
			void this.refresh();
		});

		header.createDiv({
			cls: "dashboard-v2__planner-range-label",
			text: this.formatPlannerWeekRange(groups[0].date, groups[groups.length - 1].date),
		});
	}

	private renderCalendarPlanner(container: HTMLElement): void {
		if (!this.dashboardData) return;
		const calendar = this.dashboardData.planner.calendar;
		const selectedDate = parseDateAsLocal(calendar.selectedDate);
		const currentMonth = startOfMonth(selectedDate);
		const weekStartsOn = (this.plugin.settings.calendarViewSettings.firstDay || 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6;

		const header = container.createDiv({ cls: "dashboard-v2__calendar-header" });
		const prev = this.createIconButton(header, "chevron-left", "Previous month");
		this.registerDomEvent(prev, "click", () => {
			this.selectedDate = format(addMonths(selectedDate, -1), "yyyy-MM-dd");
			void this.refresh();
		});

		header.createDiv({
			cls: "dashboard-v2__calendar-title",
			text: format(currentMonth, "LLLL yyyy"),
		});

		const next = this.createIconButton(header, "chevron-right", "Next month");
		this.registerDomEvent(next, "click", () => {
			this.selectedDate = format(addMonths(selectedDate, 1), "yyyy-MM-dd");
			void this.refresh();
		});

		const openCalendarButton = header.createEl("button", {
			cls: "dashboard-v2__subtle-button",
			text: "Open full calendar",
			attr: { "aria-label": "Open full calendar" },
		});
		this.registerDomEvent(openCalendarButton, "click", () => {
			void this.plugin.openBasesFileForCommand("open-advanced-calendar-view");
		});

		const weekdays = container.createDiv({ cls: "dashboard-v2__calendar-weekdays" });
		const weekdayStart = startOfWeek(currentMonth, { weekStartsOn });
		for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
			weekdays.createDiv({
				cls: "dashboard-v2__calendar-weekday",
				text: format(addDays(weekdayStart, dayIndex), "EE"),
			});
		}

		const grid = container.createDiv({ cls: "dashboard-v2__calendar-grid" });
		const gridStart = startOfWeek(currentMonth, { weekStartsOn });
		const gridEnd = endOfWeek(endOfMonth(currentMonth), { weekStartsOn });

		for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor = addDays(cursor, 1)) {
			const cellDate = new Date(cursor);
			const dateKey = format(cellDate, "yyyy-MM-dd");
			const cell = grid.createEl("button", {
				cls: "dashboard-v2__calendar-day",
				attr: { "aria-label": `Select ${dateKey}` },
			});
			if (!isSameMonth(cellDate, currentMonth)) cell.addClass("is-outside");
			if (dateKey === getTodayString()) cell.addClass("is-today");
			if (dateKey === calendar.selectedDate) cell.addClass("is-selected");

			cell.createDiv({ cls: "dashboard-v2__calendar-day-label", text: format(cellDate, "d") });
			const markerCount = calendar.markers[dateKey] ?? 0;
			if (markerCount > 0) {
				cell.createDiv({ cls: "dashboard-v2__calendar-marker", text: String(markerCount) });
			}

			this.registerDomEvent(cell, "click", () => {
				this.selectedDate = dateKey;
				void this.refresh();
			});
		}

		const selectedTasks = this.preparePlannerTasks(calendar.selectedTasks);

		const detail = container.createDiv({ cls: "dashboard-v2__calendar-detail" });
		detail.createDiv({
			cls: "dashboard-v2__calendar-detail-title",
			text: format(parseDateAsLocal(calendar.selectedDate), "EEEE, d MMMM"),
		});

		if (selectedTasks.length === 0) {
			detail.createEl("p", { cls: "dashboard-v2__empty", text: "No tasks on this day." });
		} else {
			this.renderPlannerTaskCards(detail, selectedTasks, parseDateAsLocal(calendar.selectedDate));
		}
	}

	private renderProjectsSection(container: HTMLElement): void {
		if (!this.dashboardData) return;
		const section = container.createDiv({ cls: "dashboard-v2__panel dashboard-v2__panel--projects" });
		const top = section.createDiv({ cls: "dashboard-v2__panel-top dashboard-v2__panel-top--projects" });
		top.createDiv({ cls: "dashboard-v2__section-title", text: "Projects" });

		const controls = top.createDiv({ cls: "dashboard-v2__project-controls" });
		controls.appendChild(
			this.createSelectControl(
				[
					{ label: "All statuses", value: "all" },
					...this.dashboardData.projectsBoard.availableStatuses.map((status) => ({
						label: status,
						value: status,
					})),
				],
				this.projectStatusFilter,
				(value) => {
					this.projectStatusFilter = value;
					this.render();
				},
				"dashboard-v2__select dashboard-v2__select--compact"
			)
		);
		controls.appendChild(
			this.createSelectControl(
				[
					{ label: "Sort by deadline", value: "due" },
					{ label: "Sort by progress", value: "progress" },
					{ label: "Sort by title", value: "title" },
					{ label: "Sort by status", value: "status" },
				],
				this.projectSort,
				(value) => {
					this.projectSort = value as DashboardProjectSort;
					this.render();
				},
				"dashboard-v2__select dashboard-v2__select--compact"
			)
		);

		const createButton = controls.createEl("button", {
			cls: "dashboard-v2__subtle-button",
			text: "New project",
			attr: { "aria-label": "Create project" },
		});
		this.registerDomEvent(createButton, "click", () => {
			this.plugin.openProjectCreationModal();
		});

		const projects = this.getVisibleProjects();
		if (projects.length === 0) {
			section.createEl("p", { cls: "dashboard-v2__empty", text: "No projects match the current filter." });
			return;
		}

		const list = section.createDiv({ cls: "dashboard-v2__project-list" });
		for (const item of projects) {
			this.renderProjectRow(list, item);
		}
	}

	private renderProjectRow(container: HTMLElement, item: DashboardProjectsListItem): void {
		const row = container.createDiv({ cls: "dashboard-v2__project-row" });
		const line = row.createDiv({ cls: "dashboard-v2__project-line" });

		const titleButton = line.createEl("button", {
			cls: "dashboard-v2__project-title",
			text: item.project.title,
			attr: { "aria-label": `Open project ${item.project.title}` },
		});
		this.registerDomEvent(titleButton, "click", () => {
			void this.openPath(item.project.path);
		});

		const meta = line.createDiv({ cls: "dashboard-v2__project-meta" });
		meta.createDiv({ cls: "dashboard-v2__pill", text: item.project.status });
		meta.createDiv({ cls: "dashboard-v2__pill", text: `${item.completedTaskCount}/${item.totalTasks || 0}` });
		if (item.nextDueDate) {
			meta.createDiv({ cls: "dashboard-v2__pill dashboard-v2__pill--accent", text: `Deadline ${item.nextDueDate}` });
		}

		const actions = line.createDiv({ cls: "dashboard-v2__project-actions" });
		const newTaskButton = actions.createEl("button", {
			cls: "dashboard-v2__subtle-button",
			text: "Add task",
			attr: { "aria-label": `Add task to ${item.project.title}` },
		});
		this.registerDomEvent(newTaskButton, "click", () => {
			this.plugin.openTaskCreationModal({
				projects: [`[[${item.project.path.replace(/\.md$/i, "")}]]`],
			});
		});

		const editButton = actions.createEl("button", {
			cls: "dashboard-v2__subtle-button",
			text: "Edit",
			attr: { "aria-label": `Edit project ${item.project.title}` },
		});
		this.registerDomEvent(editButton, "click", () => {
			this.plugin.openProjectEditModal(item.project);
		});

		const bar = row.createDiv({ cls: "dashboard-v2__progress-bar dashboard-v2__progress-bar--project" });
		const fill = bar.createDiv({ cls: "dashboard-v2__progress-fill" });
		fill.style.width = `${Math.round(item.progress * 100)}%`;
	}

	private renderCaptureSection(container: HTMLElement): void {
		if (!this.dashboardData) return;
		const section = container.createDiv({ cls: "dashboard-v2__capture" });
		const top = section.createDiv({ cls: "dashboard-v2__capture-top" });
		top.createDiv({ cls: "dashboard-v2__section-title", text: "Quick capture" });
		top.createDiv({ cls: "dashboard-v2__capture-hint", text: "Tasks are created directly. Notes are saved to Inbox." });

		const input = section.createEl("textarea", {
			cls: "dashboard-v2__capture-input",
			attr: {
				rows: "2",
				placeholder: "Write a task title or a quick note...",
				"aria-label": "Quick capture input",
			},
			text: this.captureValue,
		});
		this.registerDomEvent(input, "input", () => {
			this.captureValue = input.value;
		});

		const controls = section.createDiv({ cls: "dashboard-v2__capture-controls" });
		const selectors = controls.createDiv({ cls: "dashboard-v2__capture-selectors" });
		selectors.appendChild(
			this.createSelectControl(
				[{ label: "No project", value: "" }, ...this.dashboardData.capture.projects],
				this.captureProject,
				(value) => {
					this.captureProject = value;
				}
			)
		);
		selectors.appendChild(
			this.createSelectControl(
				[{ label: "No goal", value: "" }, ...this.dashboardData.capture.goals],
				this.captureGoal,
				(value) => {
					this.captureGoal = value;
				}
			)
		);

		const actions = controls.createDiv({ cls: "dashboard-v2__capture-actions" });
		const noteButton = actions.createEl("button", {
			cls: "dashboard-v2__subtle-button",
			text: "Save to Inbox",
			attr: { "aria-label": "Save note to inbox" },
		});
		this.registerDomEvent(noteButton, "click", () => {
			void this.handleQuickNote();
		});

		const taskButton = actions.createEl("button", {
			cls: "mod-cta dashboard-v2__primary-button",
			text: "Create task",
			attr: { "aria-label": "Create quick task" },
		});
		this.registerDomEvent(taskButton, "click", () => {
			void this.handleQuickTask();
		});
	}

	private renderPlannerTaskCards(container: HTMLElement, tasks: TaskInfo[], targetDate: Date): void {
		const list = container.createDiv({ cls: "dashboard-v2__task-stream dashboard-v2__task-stream--cards" });
		const visibleProperties = this.getPlannerVisibleProperties();

		for (const task of tasks) {
			const card = createTaskCard(task, this.plugin, visibleProperties, {
				layout: "compact",
				targetDate,
			});
			card.addClass("dashboard-v2__planner-card");
			list.appendChild(card);
		}
	}

	private getVisibleProjects(): DashboardProjectsListItem[] {
		if (!this.dashboardData) return [];
		const filtered = this.dashboardData.projectsBoard.projects.filter((item) => {
			if (this.projectStatusFilter === "all") return true;
			return item.project.status === this.projectStatusFilter;
		});

		return [...filtered].sort((left, right) => {
			switch (this.projectSort) {
				case "progress":
					return right.progress - left.progress;
				case "title":
					return left.project.title.localeCompare(right.project.title);
				case "status":
					return left.project.status.localeCompare(right.project.status);
				case "due":
				default: {
					const leftDue = left.nextDueDate || "9999-99-99";
					const rightDue = right.nextDueDate || "9999-99-99";
					if (leftDue !== rightDue) {
						return leftDue.localeCompare(rightDue);
					}
					return left.project.title.localeCompare(right.project.title);
				}
			}
		});
	}

	private getGoalItemsForScope(
		groups: DashboardGoalGroupsPayload,
		scope: DashboardGoalScopeLocal
	): DashboardGoalProgressItem[] {
		const items = scope === "today" ? groups.today : scope === "week" ? groups.week : groups.month;
		return [...items].sort((left, right) => {
			if (right.activeTasksToday !== left.activeTasksToday) {
				return right.activeTasksToday - left.activeTasksToday;
			}
			if (right.activeTasksThisWeek !== left.activeTasksThisWeek) {
				return right.activeTasksThisWeek - left.activeTasksThisWeek;
			}
			if (right.progress !== left.progress) {
				return right.progress - left.progress;
			}
			return left.goal.title.localeCompare(right.goal.title);
		});
	}

	private getVisibleGoalItems(goals: DashboardGoalProgressItem[]): DashboardGoalProgressItem[] {
		if (this.goalsExpanded || goals.length <= 3) {
			return goals;
		}

		return goals.slice(0, 3);
	}

	private applyTaskVisibilityFilter(tasks: TaskInfo[]): TaskInfo[] {
		return tasks.filter((task) => {
			const isDone = this.plugin.statusManager.isCompletedStatus(task.status);
			if (this.taskVisibilityFilter === "all") return true;
			if (this.taskVisibilityFilter === "done") return isDone;
			return !isDone;
		});
	}

	private preparePlannerTasks(tasks: TaskInfo[]): TaskInfo[] {
		return this.sortPlannerTasks(
			this.applyGoalFilter(this.applyProjectFilter(this.applyTaskVisibilityFilter(tasks)))
		);
	}

	private applyProjectFilter(tasks: TaskInfo[]): TaskInfo[] {
		if (this.plannerProjectFilter === "all") {
			return tasks;
		}

		return tasks.filter((task) =>
			(task.projects || []).some((projectLink) => this.resolveLinkedEntityPath(projectLink) === this.plannerProjectFilter)
		);
	}

	private applyGoalFilter(tasks: TaskInfo[]): TaskInfo[] {
		if (!this.plannerGoalFilterPath) {
			return tasks;
		}

		const goal = this.plugin.goalRepository.getGoal(this.plannerGoalFilterPath);
		if (!goal) {
			return tasks;
		}

		const relatedTaskPaths = new Set(
			(goal.relatedTasks || [])
				.map((link) => this.resolveLinkedEntityPath(link))
				.filter((value): value is string => value.length > 0)
		);

		return tasks.filter((task) => relatedTaskPaths.has(normalizePath(task.path)));
	}

	private sortPlannerTasks(tasks: TaskInfo[]): TaskInfo[] {
		return [...tasks].sort((left, right) => {
			let comparison = 0;

			switch (this.plannerSortKey) {
				case "due":
					comparison = this.compareOptionalDates(left.due, right.due);
					break;
				case "scheduled":
					comparison = this.compareOptionalDates(left.scheduled, right.scheduled);
					break;
				case "status":
					comparison = this.compareStatuses(left.status, right.status);
					break;
				case "title":
					comparison = left.title.localeCompare(right.title);
					break;
				case "priority":
				default:
					comparison = this.comparePriorities(left.priority, right.priority);
					break;
			}

			if (comparison !== 0) {
				return comparison;
			}

			const leftDate = left.scheduled || left.due || "9999-99-99";
			const rightDate = right.scheduled || right.due || "9999-99-99";
			if (leftDate !== rightDate) {
				return leftDate.localeCompare(rightDate);
			}

			return left.title.localeCompare(right.title);
		});
	}

	private getTaskProjectTitle(task: TaskInfo): string | null {
		const projectLink = task.projects?.[0];
		if (!projectLink) return null;
		const normalized = projectLink.replace(/\[\[|\]\]/g, "");
		const resolved = this.plugin.projectRepository.getProject(`${normalized.endsWith(".md") ? normalized : `${normalized}.md`}`);
		if (resolved) return resolved.title;
		const fallback = normalized.split("/").pop() || normalized;
		return fallback.replace(/\.md$/i, "");
	}

	private getPlannerVisibleProperties(): string[] {
		return convertInternalToUserProperties(this.plannerVisibleProperties, this.plugin);
	}

	private getPlannerProjectOptions(): DashboardCaptureOption[] {
		if (!this.dashboardData) return [];
		return this.dashboardData.projectsBoard.projects
			.map((item) => ({
				label: item.project.title,
				value: item.project.path,
			}))
			.sort((left, right) => left.label.localeCompare(right.label));
	}

	private getPlannerGoalFilter(): GoalInfo | null {
		if (!this.plannerGoalFilterPath) {
			return null;
		}

		return this.plugin.goalRepository.getGoal(this.plannerGoalFilterPath);
	}

	private applyGoalPlannerFilter(goalPath: string, scope: "today" | "week"): void {
		this.plannerGoalFilterPath = goalPath;
		this.plannerMode = scope;
		this.saveViewPreferences();
		this.render();
	}

	private createSegmentedControl(
		options: Array<{ value: string; label: string }>,
		activeValue: string,
		onSelect: (value: string) => void
	): HTMLElement {
		const wrapper = this.contentEl.ownerDocument.createElement("div");
		wrapper.className = "dashboard-v2__segment";

		for (const option of options) {
			const button = wrapper.createEl("button", {
				cls: `dashboard-v2__segment-button${option.value === activeValue ? " is-active" : ""}`,
				text: option.label,
				attr: { "aria-pressed": option.value === activeValue ? "true" : "false" },
			});
			this.registerDomEvent(button, "click", () => onSelect(option.value));
		}

		return wrapper;
	}

	private createSelectControl(
		options: DashboardCaptureOption[],
		value: string,
		onChange: (value: string) => void,
		className = "dashboard-v2__select"
	): HTMLElement {
		const select = this.contentEl.ownerDocument.createElement("select");
		select.className = className;
		for (const option of options) {
			select.createEl("option", {
				value: option.value,
				text: option.label,
			});
		}
		select.value = value;
		this.registerDomEvent(select, "change", () => {
			onChange(select.value);
		});
		return select;
	}

	private createIconButton(container: HTMLElement, icon: string, label: string): HTMLButtonElement {
		const button = container.createEl("button", {
			cls: "dashboard-v2__icon-button",
			attr: { "aria-label": label, title: label },
		});
		const iconEl = button.createSpan({ cls: "dashboard-v2__icon" });
		setIcon(iconEl, icon);
		return button;
	}

	private renderMetric(container: HTMLElement, label: string, value: string): void {
		const metric = container.createDiv({ cls: "dashboard-v2__metric" });
		metric.createDiv({ cls: "dashboard-v2__metric-value", text: value });
		metric.createDiv({ cls: "dashboard-v2__metric-label", text: label });
	}

	private async handleQuickNote(): Promise<void> {
		const content = this.captureValue.trim();
		if (!content) {
			new Notice("Write a note first.");
			return;
		}

		const folder = normalizePath(this.plugin.settings.inboxFolder);
		await ensureFolderExists(this.plugin.app.vault, folder);
		const filename = `${format(new Date(), "yyyy-MM-dd-HHmmss")}-${this.slugify(content).slice(0, 48) || "capture"}.md`;
		const path = normalizePath(`${folder}/${filename}`);
		const body = `# ${content}\n\n${this.captureProject ? `Project: ${this.captureProject}\n` : ""}${this.captureGoal ? `Goal: ${this.captureGoal}\n` : ""}`;
		const file = await this.plugin.app.vault.create(path, body);
		this.captureValue = "";
		this.captureProject = "";
		this.captureGoal = "";
		await this.openPath(file.path);
		new Notice(`Saved to ${folder}.`);
	}

	private async handleQuickTask(): Promise<void> {
		const title = this.captureValue.trim();
		if (!title) {
			new Notice("Write a task title first.");
			return;
		}

		const projects = this.captureProject ? [this.captureProject] : undefined;
		const relatedNotes = this.captureGoal ? [this.captureGoal] : undefined;
		const result = await this.plugin.taskService.createTask({
			title,
			projects,
			relatedNotes,
			creationContext: "manual-creation",
		});
		await this.plugin.goalService.syncTaskGoal(result.file.path, this.captureGoal || undefined);
		this.captureValue = "";
		this.captureProject = "";
		this.captureGoal = "";
		await this.openPath(result.file.path);
		await this.refresh();
	}

	private async executeQuickAction(commandId: string): Promise<void> {
		switch (commandId) {
			case "create-new-task":
				this.plugin.openTaskCreationModal();
				return;
			case "create-project":
				this.plugin.openProjectCreationModal();
				return;
			case "create-goal":
				this.plugin.openGoalCreationModal();
				return;
			case "open-advanced-calendar-view":
				await this.plugin.openBasesFileForCommand("open-advanced-calendar-view");
				return;
			case "open-tasks-view":
				await this.plugin.openBasesFileForCommand("open-tasks-view");
				return;
			case "open-kanban-view":
				await this.plugin.openBasesFileForCommand("open-kanban-view");
				return;
		}
	}

	private async openPath(path: string): Promise<void> {
		const file = this.plugin.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			new Notice("File not found.");
			return;
		}

		const leaf = this.plugin.app.workspace.getLeaf(true);
		await leaf.openFile(file);
	}

	private async syncFocusSelection(): Promise<void> {
		const state = this.plugin.pomodoroService.getState();
		if (state.currentSession?.taskPath) {
			this.focusTaskPath = state.currentSession.taskPath;
			return;
		}

		if (this.focusTaskPath) {
			return;
		}

		const lastSelected = await this.plugin.pomodoroService.getLastSelectedTaskPath();
		if (lastSelected) {
			this.focusTaskPath = lastSelected;
			return;
		}

		this.focusTaskPath = this.dashboardData?.focus.taskPath ?? "";
	}

	private getFocusTaskOptions(): DashboardCaptureOption[] {
		const options = new Map<string, DashboardCaptureOption>();
		const plannerTasks = this.dashboardData ? this.getAllPlannerTasksForFocus() : [];

		for (const task of plannerTasks) {
			if (!options.has(task.path)) {
				options.set(task.path, { label: task.title, value: task.path });
			}
		}

		return [...options.values()];
	}

	private getSelectedFocusTask(): TaskInfo | null {
		if (!this.dashboardData) return null;
		const selectedPath = this.plugin.pomodoroService.getState().currentSession?.taskPath || this.focusTaskPath;
		if (!selectedPath) return null;

		const tasks = this.getAllPlannerTasksForFocus();
		return tasks.find((task) => task.path === selectedPath) ?? null;
	}

	private getFocusMetaLabel(task: TaskInfo): string {
		const state = this.plugin.pomodoroService.getState();
		const bits: string[] = [];
		const projectTitle = this.getTaskProjectTitle(task);
		if (projectTitle) bits.push(projectTitle);
		bits.push(task.status);
		if (state.currentSession?.taskPath === task.path) {
			bits.push(state.isRunning ? "Timer running" : "Timer paused");
		}
		return bits.join(" - ");
	}

	private async handleFocusPrimaryAction(): Promise<void> {
		const state = this.plugin.pomodoroService.getState();
		if (state.currentSession && !state.isRunning) {
			await this.plugin.pomodoroService.resumePomodoro();
			return;
		}

		const task = this.getSelectedFocusTask();
		if (!task) {
			new Notice("Choose a task for focus first.");
			return;
		}

		await this.plugin.pomodoroService.saveLastSelectedTask(task.path);
		await this.plugin.pomodoroService.startPomodoro(task);
	}

	private formatPomodoroTime(timeRemaining: number): string {
		const safeTime = Math.max(0, Math.floor(timeRemaining));
		const minutes = Math.floor(safeTime / 60);
		const seconds = safeTime % 60;
		return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
	}

	private formatPlannerWeekRange(startDate: string, endDate: string): string {
		const selected = parseDateAsLocal(this.selectedDate);
		const start = parseDateAsLocal(startDate);
		const end = parseDateAsLocal(endDate);
		const selectedMonthStart = startOfMonth(selected);
		const weekNumber = start < selectedMonthStart ? 0 : Math.min(4, Math.floor((start.getDate() - 1) / 7) + 1);
		const monthYear = format(selected, "LLLL yyyy");
		const rangeLabel =
			format(start, "yyyy-MM") === format(end, "yyyy-MM")
				? `${format(start, "d")} - ${format(end, "d MMM")}`
				: `${format(start, "d MMM")} - ${format(end, "d MMM")}`;

		return `Week #${weekNumber} - ${rangeLabel} - ${monthYear}`;
	}

	private getAllPlannerTasksForFocus(): TaskInfo[] {
		if (!this.dashboardData) return [];

		const seen = new Map<string, TaskInfo>();
		for (const task of [
			...this.dashboardData.planner.todayTasks,
			...this.dashboardData.planner.weekGroups.flatMap((group) => group.tasks),
			...this.dashboardData.planner.calendar.selectedTasks,
		]) {
			if (!seen.has(task.path)) {
				seen.set(task.path, task);
			}
		}

		return this.preparePlannerTasks([...seen.values()]);
	}

	private loadViewPreferences(): void {
		const prefs = this.plugin.viewStateManager.getViewPreferences<DashboardViewPreferences>(DASHBOARD_VIEW_TYPE);
		if (!prefs) {
			return;
		}

		this.plannerSortKey = prefs.plannerSortKey || this.plannerSortKey;
		this.plannerProjectFilter = prefs.plannerProjectFilter || this.plannerProjectFilter;
		this.plannerGoalFilterPath = prefs.plannerGoalFilterPath || this.plannerGoalFilterPath;
		if (prefs.plannerVisibleProperties?.length) {
			this.plannerVisibleProperties = [...prefs.plannerVisibleProperties];
		}
	}

	private saveViewPreferences(): void {
		this.plugin.viewStateManager.setViewPreferences<DashboardViewPreferences>(DASHBOARD_VIEW_TYPE, {
			plannerSortKey: this.plannerSortKey,
			plannerProjectFilter: this.plannerProjectFilter,
			plannerGoalFilterPath: this.plannerGoalFilterPath,
			plannerVisibleProperties: [...this.plannerVisibleProperties],
		});
	}

	private comparePriorities(left: string, right: string): number {
		const priorities = [...(this.plugin.settings.customPriorities || [])].sort(
			(a, b) => a.weight - b.weight
		);
		const leftIndex = priorities.findIndex((item) => item.value === left);
		const rightIndex = priorities.findIndex((item) => item.value === right);
		const leftRank = leftIndex === -1 ? priorities.length + 1 : leftIndex;
		const rightRank = rightIndex === -1 ? priorities.length + 1 : rightIndex;
		return rightRank - leftRank;
	}

	private compareStatuses(left: string, right: string): number {
		const statuses = this.plugin.settings.customStatuses || [];
		const leftIndex = statuses.findIndex((item) => item.value === left);
		const rightIndex = statuses.findIndex((item) => item.value === right);
		const leftRank = leftIndex === -1 ? statuses.length + 1 : leftIndex;
		const rightRank = rightIndex === -1 ? statuses.length + 1 : rightIndex;
		return leftRank - rightRank;
	}

	private compareOptionalDates(left?: string, right?: string): number {
		if (!left && !right) return 0;
		if (!left) return 1;
		if (!right) return -1;
		return left.localeCompare(right);
	}

	private resolveLinkedEntityPath(link: string): string {
		const normalized = normalizeEntityLink(link);
		if (!normalized) {
			return "";
		}

		const linkPath = normalized.replace(/\.md$/i, "");
		const metadataCache = this.plugin.app.metadataCache as {
			getFirstLinkpathDest?: (linkpath: string, sourcePath: string) => { path: string } | null;
		};
		const resolved = metadataCache.getFirstLinkpathDest?.(linkPath, "");
		return normalizePath(resolved?.path ?? normalized);
	}

	private slugify(value: string): string {
		return value
			.toLowerCase()
			.replace(/[^a-zа-я0-9]+/gi, "-")
			.replace(/^-+|-+$/g, "");
	}
}
