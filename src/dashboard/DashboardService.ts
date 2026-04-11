import { normalizePath } from "obsidian";
import {
	addDays,
	endOfMonth,
	endOfWeek,
	format,
	isAfter,
	isBefore,
	isEqual,
	isSameDay,
	startOfMonth,
	startOfWeek,
} from "date-fns";
import type TaskNotesPlugin from "../main";
import type {
	DashboardActiveProjectItem,
	DashboardActiveProjectsPayload,
	DashboardCaptureOption,
	DashboardData,
	DashboardBacklogProjectGroup,
	DashboardDeadlinesPayload,
	DashboardFocusPayload,
	DashboardGoalGroupsPayload,
	DashboardGoalProgressItem,
	DashboardGoalsPayload,
	DashboardMiniCalendarPayload,
	DashboardPlannerDayGroup,
	DashboardProjectsListItem,
	DashboardProjectsPayload,
	DashboardProgressPayload,
	DashboardQuickAction,
	DashboardQuickActionsPayload,
	DashboardSection,
	DashboardSectionId,
	DashboardTodayPayload,
	DashboardWeekPayload,
	GoalInfo,
	ProjectInfo,
	TaskInfo,
} from "../types";
import {
	getCurrentTimestamp,
	getDatePart,
	getTodayLocal,
	getTodayString,
	parseDateAsLocal,
} from "../utils/dateUtils";
import { normalizeEntityLink } from "../core/links/normalizeEntityLink";

const UPCOMING_DEADLINE_WINDOW_DAYS = 7;
const MAX_DEADLINES = 8;

export class DashboardService {
	constructor(private plugin: TaskNotesPlugin) {}

	async getDashboardData(selectedDate = getTodayString()): Promise<DashboardData> {
		const today = getTodayLocal();
		const plannerReferenceDate = selectedDate ? parseDateAsLocal(selectedDate) : today;
		const weekStartsOn = (this.plugin.settings.calendarViewSettings.firstDay || 1) as
			| 0
			| 1
			| 2
			| 3
			| 4
			| 5
			| 6;
		const weekStart = startOfWeek(today, { weekStartsOn });
		const weekEnd = endOfWeek(today, { weekStartsOn });
		const weekDescriptor = this.plugin.goalPeriodService.getPeriodDescriptor("week", today);
		const monthDescriptor = this.plugin.goalPeriodService.getPeriodDescriptor("month", today);
		const quarterDescriptor = this.plugin.goalPeriodService.getPeriodDescriptor("quarter", today);
		const tasks = await this.plugin.cacheManager.getAllTasks();
		const incompleteTasks = tasks.filter((task) => !this.isTaskCompleted(task));
		const activeTasks = incompleteTasks.filter((task) => task.status !== "backlog");
		const todayTasks = this.getTasksForDate(activeTasks, today);
		const plannerWeekStart = startOfWeek(plannerReferenceDate, { weekStartsOn: 1 });
		const weekGroups = this.buildWeekGroups(activeTasks, plannerWeekStart);
		const currentGoals = {
			week: this.plugin.goalRepository.listGoalsForPeriod("week", weekDescriptor.periodKey),
			month: this.plugin.goalRepository.listGoalsForPeriod("month", monthDescriptor.periodKey),
			quarter: this.plugin.goalRepository.listGoalsForPeriod("quarter", quarterDescriptor.periodKey),
		};

		const sectionsById = new Map<DashboardSectionId, DashboardSection>([
			["goals", this.buildGoalsSection(today)],
			["today", this.buildTodaySection(tasks, today)],
			["week", this.buildWeekSection(tasks, today)],
			["active-projects", this.buildActiveProjectsSection(tasks, today)],
			["deadlines", this.buildDeadlinesSection(tasks, today)],
			["mini-calendar", this.buildMiniCalendarSection(tasks, selectedDate)],
			["quick-actions", this.buildQuickActionsSection()],
		]);

		const sections = this.getOrderedSectionIds()
			.map((id) => sectionsById.get(id))
			.filter((section): section is DashboardSection => section !== undefined)
			.filter((section) => section.visible);

		return {
			generatedAt: getCurrentTimestamp(),
			currentDate: format(plannerReferenceDate, "yyyy-MM-dd"),
			currentWeekKey: weekDescriptor.periodKey,
			currentMonthKey: monthDescriptor.periodKey,
			currentQuarterKey: quarterDescriptor.periodKey,
			focus: this.buildFocusPayload(todayTasks, currentGoals.week[0] ?? null, currentGoals.month[0] ?? null),
			progress: this.buildProgressPayload(tasks, today, weekStart, weekEnd),
			goalGroups: this.buildGoalGroupsPayload(tasks, today, weekStart, weekEnd),
			planner: {
				todayTasks,
				weekGroups,
				backlogGroups: this.buildBacklogGroups(incompleteTasks),
				calendar: this.buildCalendarPayload(tasks, selectedDate),
			},
			projectsBoard: this.buildProjectsBoardPayload(tasks, today),
			quickActions: this.buildQuickActionsPayload(),
			capture: this.buildCapturePayload(today),
			sections,
		};
	}

	private getOrderedSectionIds(): DashboardSectionId[] {
		const defaults: DashboardSectionId[] = [
			"goals",
			"today",
			"week",
			"active-projects",
			"deadlines",
			"mini-calendar",
			"quick-actions",
		];
		const configured = this.plugin.settings.dashboardDefaults.sectionsOrder ?? [];
		const result: DashboardSectionId[] = [];

		for (const id of [...configured, ...defaults]) {
			if (!result.includes(id)) {
				result.push(id);
			}
		}

		return result;
	}

	private buildFocusPayload(
		todayTasks: TaskInfo[],
		weekGoal: GoalInfo | null,
		monthGoal: GoalInfo | null
	): DashboardFocusPayload {
		const focusTask = todayTasks[0];
		if (focusTask) {
			return {
				title: focusTask.title,
				subtitle: "Current focus",
				taskPath: focusTask.path,
			};
		}

		if (weekGoal) {
			return {
				title: weekGoal.title,
				subtitle: "Weekly goal in focus",
				taskPath: weekGoal.path,
			};
		}

		if (monthGoal) {
			return {
				title: monthGoal.title,
				subtitle: "Monthly direction",
				taskPath: monthGoal.path,
			};
		}

		return {
			title: "No active focus yet",
			subtitle: "Pick a task, project, or goal to anchor the day.",
		};
	}

	private buildProgressPayload(
		tasks: TaskInfo[],
		today: Date,
		weekStart: Date,
		weekEnd: Date
	): DashboardProgressPayload {
		const todayCompleted = tasks.filter(
			(task) => this.isTaskCompleted(task) && getDatePart(task.completedDate || "") === format(today, "yyyy-MM-dd")
		).length;
		const todayRemaining = tasks.filter(
			(task) => !this.isTaskCompleted(task) && this.taskMatchesDate(task, today)
		).length;
		const weekCompleted = tasks.filter((task) => {
			if (!this.isTaskCompleted(task)) return false;
			return this.isDateWithinRange(task.completedDate, weekStart, weekEnd);
		}).length;
		const weekRemaining = tasks.filter(
			(task) => !this.isTaskCompleted(task) && this.taskMatchesRange(task, weekStart, weekEnd)
		).length;

		return {
			todayCompleted,
			todayRemaining,
			weekCompleted,
			weekRemaining,
		};
	}

	private buildGoalGroupsPayload(
		tasks: TaskInfo[],
		today: Date,
		weekStart: Date,
		weekEnd: Date
	): DashboardGoalGroupsPayload {
		const allGoals = this.plugin.goalRepository.listGoals();
		const currentWeekKey = this.plugin.goalPeriodService.getPeriodDescriptor("week", today).periodKey;
		const currentMonthKey = this.plugin.goalPeriodService.getPeriodDescriptor("month", today).periodKey;
		const weekGoals = this.plugin.goalRepository.listGoalsForPeriod("week", currentWeekKey);
		const monthGoals = this.plugin.goalRepository.listGoalsForPeriod("month", currentMonthKey);

		return {
			today: allGoals
				.map((goal) => this.buildGoalProgressItem(goal, tasks, today, weekStart, weekEnd))
				.filter((item) => item && item.activeTasksToday > 0) as DashboardGoalProgressItem[],
			week: weekGoals.map((goal) => this.buildGoalProgressItem(goal, tasks, today, weekStart, weekEnd)),
			month: monthGoals.map((goal) => this.buildGoalProgressItem(goal, tasks, today, weekStart, weekEnd)),
		};
	}

	private buildGoalProgressItem(
		goal: GoalInfo,
		tasks: TaskInfo[],
		today: Date,
		weekStart: Date,
		weekEnd: Date
	): DashboardGoalProgressItem {
		const relatedTaskPaths = new Set(
			(goal.relatedTasks || [])
				.map((link) => this.resolveEntityPath(link))
				.filter((value): value is string => !!value)
		);
		const relatedTasks = tasks.filter((task) => relatedTaskPaths.has(normalizePath(task.path)));
		const completedTasks = relatedTasks.filter((task) => this.isTaskCompleted(task)).length;
		const totalTasks = relatedTasks.length;
		const activeTasksToday = relatedTasks.filter((task) => !this.isTaskCompleted(task) && this.taskMatchesDate(task, today)).length;
		const activeTasksThisWeek = relatedTasks.filter((task) => !this.isTaskCompleted(task) && this.taskMatchesRange(task, weekStart, weekEnd)).length;

		return {
			goal,
			totalTasks,
			completedTasks,
			progress: totalTasks > 0 ? completedTasks / totalTasks : 0,
			activeTasksToday,
			activeTasksThisWeek,
		};
	}

	private buildProjectsBoardPayload(tasks: TaskInfo[], today: Date): DashboardProjectsPayload {
		const projects = this.plugin.projectRepository
			.listProjects()
			.map((project) => this.buildProjectBoardItem(project, tasks))
			.filter((item) => item.totalTasks > 0);

		const availableStatuses = Array.from(
			new Set(projects.map((item) => item.project.status).filter((value) => !!value))
		).sort((left, right) => left.localeCompare(right));

		return {
			projects: projects.sort((left, right) => {
				const leftDue = left.nextDueDate || "9999-99-99";
				const rightDue = right.nextDueDate || "9999-99-99";
				if (leftDue !== rightDue) {
					return leftDue.localeCompare(rightDue);
				}
				if (right.progress !== left.progress) {
					return right.progress - left.progress;
				}
				return left.project.title.localeCompare(right.project.title);
			}),
			availableStatuses,
		};
	}

	private buildProjectBoardItem(project: ProjectInfo, tasks: TaskInfo[]): DashboardProjectsListItem {
		const projectTasks = tasks.filter((task) => this.taskBelongsToProject(task, project));
		const completedTaskCount = projectTasks.filter((task) => this.isTaskCompleted(task)).length;
		const openTasks = projectTasks.filter((task) => !this.isTaskCompleted(task));
		const nextDueDate = openTasks
			.map((task) => getDatePart(task.due || ""))
			.filter((value): value is string => !!value)
			.sort((left, right) => left.localeCompare(right))[0];

		return {
			project,
			totalTasks: projectTasks.length,
			completedTaskCount,
			openTaskCount: openTasks.length,
			progress: projectTasks.length > 0 ? completedTaskCount / projectTasks.length : 0,
			nextDueDate,
		};
	}

	private buildCapturePayload(referenceDate: Date): { placeholder: string; projects: DashboardCaptureOption[]; goals: DashboardCaptureOption[] } {
		const projectOptions = this.plugin.projectRepository
			.listProjects()
			.map((project) => ({
				label: project.title,
				value: `[[${project.path.replace(/\.md$/i, "")}]]`,
			}))
			.sort((left, right) => left.label.localeCompare(right.label));

		const goalOptions = this.plugin.goalRepository
			.listGoals()
			.filter((goal) => {
				const start = this.parseTaskDate(goal.periodStart);
				const end = this.parseTaskDate(goal.periodEnd);
				if (!start || !end) return true;
				return (
					(isAfter(referenceDate, start) || isEqual(referenceDate, start) || isSameDay(referenceDate, start)) &&
					(isBefore(referenceDate, end) || isEqual(referenceDate, end) || isSameDay(referenceDate, end))
				);
			})
			.map((goal) => ({
				label: `${goal.periodType}: ${goal.title}`,
				value: `[[${goal.path.replace(/\.md$/i, "")}]]`,
			}))
			.sort((left, right) => left.label.localeCompare(right.label));

		return {
			placeholder: "Capture a task or note without leaving the dashboard",
			projects: projectOptions,
			goals: goalOptions,
		};
	}

	private buildGoalsSection(referenceDate: Date): DashboardSection<DashboardGoalsPayload> {
		return {
			id: "goals",
			title: "Goals",
			visible: true,
			payload: {
				week: this.plugin.goalRepository.getCurrentGoal("week", referenceDate),
				month: this.plugin.goalRepository.getCurrentGoal("month", referenceDate),
				quarter: this.plugin.goalRepository.getCurrentGoal("quarter", referenceDate),
			},
		};
	}

	private buildTodaySection(tasks: TaskInfo[], today: Date): DashboardSection<DashboardTodayPayload> {
		const todayTasks = this.getTasksForDate(tasks.filter((task) => !this.isTaskCompleted(task)), today);
		const todayString = format(today, "yyyy-MM-dd");
		return {
			id: "today",
			title: "Today",
			visible: true,
			payload: {
				scheduledTasks: todayTasks.filter((task) => getDatePart(task.scheduled || "") === todayString),
				dueTasks: todayTasks.filter((task) => getDatePart(task.due || "") === todayString),
				overdueTasks: tasks.filter((task) => !this.isTaskCompleted(task) && !!getDatePart(task.due || "") && getDatePart(task.due || "")! < todayString),
			},
		};
	}

	private buildWeekSection(tasks: TaskInfo[], today: Date): DashboardSection<DashboardWeekPayload> {
		const weekStartsOn = (this.plugin.settings.calendarViewSettings.firstDay || 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
		const weekStart = startOfWeek(today, { weekStartsOn });
		const weekEnd = endOfWeek(today, { weekStartsOn });
		const groups = this.buildWeekGroups(tasks.filter((task) => !this.isTaskCompleted(task)), weekStart);
		return {
			id: "week",
			title: "This week",
			visible: true,
			payload: {
				scheduledTasks: groups.flatMap((group) => group.tasks.filter((task) => this.isDateWithinRange(task.scheduled, weekStart, weekEnd))),
				dueTasks: groups.flatMap((group) => group.tasks.filter((task) => this.isDateWithinRange(task.due, weekStart, weekEnd))),
			},
		};
	}

	private buildActiveProjectsSection(tasks: TaskInfo[], today: Date): DashboardSection<DashboardActiveProjectsPayload> {
		const dueSoonLimit = addDays(today, UPCOMING_DEADLINE_WINDOW_DAYS);
		const projects = this.plugin.projectRepository
			.listProjects()
			.filter((project) => !this.isProjectClosed(project))
			.map((project) => this.buildActiveProjectItem(project, tasks, today, dueSoonLimit))
			.filter((item) => item.openTaskCount > 0 || item.blockedTaskCount > 0 || item.dueSoonTaskCount > 0);

		return {
			id: "active-projects",
			title: "Active projects",
			visible: true,
			payload: { projects },
		};
	}

	private buildDeadlinesSection(tasks: TaskInfo[], today: Date): DashboardSection<DashboardDeadlinesPayload> {
		const dueSoonLimit = addDays(today, UPCOMING_DEADLINE_WINDOW_DAYS);
		const deadlineTasks = tasks
			.filter((task) => {
				if (this.isTaskCompleted(task)) return false;
				const dueDate = this.parseTaskDate(task.due);
				if (!dueDate) return false;
				return (
					(isAfter(dueDate, today) || isEqual(dueDate, today)) &&
					(isBefore(dueDate, dueSoonLimit) || isEqual(dueDate, dueSoonLimit))
				);
			})
			.sort((left, right) => (left.due || "").localeCompare(right.due || ""))
			.slice(0, MAX_DEADLINES);

		return {
			id: "deadlines",
			title: "Upcoming deadlines",
			visible: true,
			payload: { tasks: deadlineTasks },
		};
	}

	private buildMiniCalendarSection(tasks: TaskInfo[], selectedDate: string): DashboardSection<DashboardMiniCalendarPayload> {
		return {
			id: "mini-calendar",
			title: "Mini calendar",
			visible: this.plugin.settings.dashboardDefaults.showMiniCalendar,
			payload: this.buildCalendarPayload(tasks, selectedDate),
		};
	}

	private buildCalendarPayload(tasks: TaskInfo[], selectedDate: string): DashboardMiniCalendarPayload {
		const calendarDate = selectedDate ? parseDateAsLocal(selectedDate) : getTodayLocal();
		const monthStart = startOfMonth(calendarDate);
		const monthEnd = endOfMonth(calendarDate);
		const markers: Record<string, number> = {};
		const incompleteTasks = tasks.filter((task) => !this.isTaskCompleted(task) && task.status !== "backlog");

		for (const task of incompleteTasks) {
			for (const taskDate of [task.scheduled, task.due]) {
				const parsed = this.parseTaskDate(taskDate);
				if (!parsed) continue;
				if (
					(isAfter(parsed, monthStart) || isEqual(parsed, monthStart) || isSameDay(parsed, monthStart)) &&
					(isBefore(parsed, monthEnd) || isEqual(parsed, monthEnd) || isSameDay(parsed, monthEnd))
				) {
					const key = format(parsed, "yyyy-MM-dd");
					markers[key] = (markers[key] ?? 0) + 1;
				}
			}
		}

		return {
			selectedDate,
			markers,
			selectedTasks: this.getTasksForDate(incompleteTasks, calendarDate),
		};
	}

	private buildQuickActionsSection(): DashboardSection<DashboardQuickActionsPayload> {
		return {
			id: "quick-actions",
			title: "Quick actions",
			visible: this.plugin.settings.dashboardDefaults.showQuickActions,
			payload: this.buildQuickActionsPayload(),
		};
	}

	private buildQuickActionsPayload(): DashboardQuickActionsPayload {
		const actions: DashboardQuickAction[] = [
			{ id: "create-task", label: "Create task", commandId: "create-new-task" },
			{ id: "create-project", label: "Create project", commandId: "create-project" },
			{ id: "create-goal", label: "Create goal", commandId: "create-goal" },
			{ id: "open-calendar", label: "Open calendar", commandId: "open-advanced-calendar-view" },
			{ id: "open-tasks", label: "Open tasks", commandId: "open-tasks-view" },
			{ id: "open-kanban", label: "Open kanban", commandId: "open-kanban-view" },
		];

		return { actions };
	}

	private buildActiveProjectItem(
		project: ProjectInfo,
		tasks: TaskInfo[],
		today: Date,
		dueSoonLimit: Date
	): DashboardActiveProjectItem {
		const projectTasks = tasks.filter((task) => this.taskBelongsToProject(task, project));
		const openTasks = projectTasks.filter((task) => !this.isTaskCompleted(task));
		const blockedTaskCount = openTasks.filter((task) => task.status === "blocked").length;
		const dueSoonTaskCount = openTasks.filter((task) => {
			const dueDate = this.parseTaskDate(task.due);
			if (!dueDate) return false;
			return (
				(isAfter(dueDate, today) || isEqual(dueDate, today)) &&
				(isBefore(dueDate, dueSoonLimit) || isEqual(dueDate, dueSoonLimit))
			);
		}).length;

		return {
			project,
			openTaskCount: openTasks.length,
			blockedTaskCount,
			dueSoonTaskCount,
		};
	}

	private buildBacklogGroups(tasks: TaskInfo[]): DashboardBacklogProjectGroup[] {
		const backlogTasks = tasks.filter((task) => task.status === "backlog");
		const groups = new Map<string, DashboardBacklogProjectGroup>();

		for (const task of backlogTasks) {
			const project = this.getTaskPrimaryProject(task);
			const projectPath = project?.path ?? "";
			const projectTitle = project?.title ?? "No project";

			if (!groups.has(projectPath)) {
				groups.set(projectPath, {
					projectPath,
					projectTitle,
					tasks: [],
				});
			}

			groups.get(projectPath)!.tasks.push(task);
		}

		return [...groups.values()]
			.map((group) => ({
				...group,
				tasks: this.sortTasksByPriorityAndDate(group.tasks),
			}))
			.sort((left, right) => {
				if (left.projectPath === "" && right.projectPath !== "") return 1;
				if (right.projectPath === "" && left.projectPath !== "") return -1;
				return left.projectTitle.localeCompare(right.projectTitle);
			});
	}

	private getTaskPrimaryProject(task: TaskInfo): ProjectInfo | null {
		const projectLink = task.projects?.[0];
		if (!projectLink) {
			return null;
		}

		const projectPath = this.resolveProjectPath(projectLink);
		return this.plugin.projectRepository.getProject(projectPath) ?? null;
	}

	private isTaskCompleted(task: TaskInfo): boolean {
		return this.plugin.statusManager.isCompletedStatus(task.status);
	}

	private isProjectClosed(project: ProjectInfo): boolean {
		const statusOption = this.plugin.settings.projectStatuses.find(
			(option) => option.value === project.status
		);
		return statusOption?.isClosed === true;
	}

	private taskMatchesDate(task: TaskInfo, date: Date): boolean {
		const dateKey = format(date, "yyyy-MM-dd");
		return getDatePart(task.scheduled || "") === dateKey || getDatePart(task.due || "") === dateKey;
	}

	private taskMatchesRange(task: TaskInfo, rangeStart: Date, rangeEnd: Date): boolean {
		return this.isDateWithinRange(task.scheduled, rangeStart, rangeEnd) || this.isDateWithinRange(task.due, rangeStart, rangeEnd);
	}

	private isDateWithinRange(dateValue: string | undefined, rangeStart: Date, rangeEnd: Date): boolean {
		const parsed = this.parseTaskDate(dateValue);
		if (!parsed) return false;
		return (
			(isAfter(parsed, rangeStart) || isEqual(parsed, rangeStart) || isSameDay(parsed, rangeStart)) &&
			(isBefore(parsed, rangeEnd) || isEqual(parsed, rangeEnd) || isSameDay(parsed, rangeEnd))
		);
	}

	private parseTaskDate(dateValue?: string): Date | null {
		const datePart = getDatePart(dateValue || "");
		if (!datePart) return null;

		try {
			return parseDateAsLocal(datePart);
		} catch {
			return null;
		}
	}

	private getTasksForDate(tasks: TaskInfo[], date: Date): TaskInfo[] {
		const dateKey = format(date, "yyyy-MM-dd");
		const seen = new Set<string>();
		const result: TaskInfo[] = [];

		for (const task of this.sortTasksByPriorityAndDate(tasks)) {
			const matchesScheduled = getDatePart(task.scheduled || "") === dateKey;
			const matchesDue = getDatePart(task.due || "") === dateKey;
			if ((matchesScheduled || matchesDue) && !seen.has(task.path)) {
				result.push(task);
				seen.add(task.path);
			}
		}

		return result;
	}

	private buildWeekGroups(tasks: TaskInfo[], weekStart: Date): DashboardPlannerDayGroup[] {
		const groups: DashboardPlannerDayGroup[] = [];

		for (let index = 0; index < 7; index += 1) {
			const day = addDays(weekStart, index);
			groups.push({
				date: format(day, "yyyy-MM-dd"),
				label: format(day, "EEEE, d MMM"),
				tasks: this.getTasksForDate(tasks, day),
			});
		}

		return groups;
	}


	private sortTasksByPriorityAndDate(tasks: TaskInfo[]): TaskInfo[] {
		return [...tasks].sort((left, right) => {
			const leftRank = this.getPriorityRank(left.priority);
			const rightRank = this.getPriorityRank(right.priority);
			if (leftRank !== rightRank) {
				return rightRank - leftRank;
			}

			const leftDate = left.scheduled || left.due || "9999-99-99";
			const rightDate = right.scheduled || right.due || "9999-99-99";
			if (leftDate !== rightDate) {
				return leftDate.localeCompare(rightDate);
			}

			return left.title.localeCompare(right.title);
		});
	}

	private getPriorityRank(priority: string): number {
		const priorities = [...(this.plugin.settings.customPriorities || [])].sort(
			(left, right) => left.weight - right.weight
		);
		const index = priorities.findIndex((item) => item.value === priority);
		return index === -1 ? priorities.length + 1 : index;
	}

	private taskBelongsToProject(task: TaskInfo, project: ProjectInfo): boolean {
		const projectPath = normalizePath(project.path);
		return (task.projects || []).some((projectLink) => this.resolveProjectPath(projectLink) === projectPath);
	}

	private resolveProjectPath(projectLink: string): string {
		const normalized = normalizeEntityLink(projectLink);
		if (!normalized) {
			return normalized;
		}

		const linkPath = normalized.replace(/\.md$/i, "");
		const metadataCache = this.plugin.app.metadataCache as {
			getFirstLinkpathDest?: (linkpath: string, sourcePath: string) => { path: string } | null;
		};
		const resolved = metadataCache.getFirstLinkpathDest?.(linkPath, "");
		return normalizePath(resolved?.path ?? normalized);
	}

	private resolveEntityPath(link: string): string {
		const normalized = normalizeEntityLink(link);
		if (!normalized) return "";

		const linkPath = normalized.replace(/\.md$/i, "");
		const metadataCache = this.plugin.app.metadataCache as {
			getFirstLinkpathDest?: (linkpath: string, sourcePath: string) => { path: string } | null;
		};
		const resolved = metadataCache.getFirstLinkpathDest?.(linkPath, "");
		return normalizePath(resolved?.path ?? normalized);
	}
}
