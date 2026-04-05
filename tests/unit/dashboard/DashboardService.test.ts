import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { App } from "obsidian";
import { MockObsidian } from "../../__mocks__/obsidian";
import { DashboardService } from "../../../src/dashboard/DashboardService";
import { GoalPeriodService } from "../../../src/goals/GoalPeriodService";
import { GoalRepository } from "../../../src/goals/GoalRepository";
import { ProjectRepository } from "../../../src/projects/ProjectRepository";
import type { TaskInfo } from "../../../src/types";

describe("DashboardService", () => {
	beforeEach(() => {
		MockObsidian.reset();
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-04-05T10:00:00Z"));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	function createPlugin(tasks: TaskInfo[], overrides?: Partial<any>) {
		const app = new App();
		const settings = {
			projectsFolder: "Projects",
			projectNoteFilename: "project",
			goalsFolder: "Goals",
			goalFilenamePattern: "period-key" as const,
			goalDefaults: {
				weeklyFolder: "Weekly",
				monthlyFolder: "Monthly",
				quarterlyFolder: "Quarterly",
			},
			projectStatuses: [
				{ value: "active", label: "Active", color: "#2563eb" },
				{ value: "archived", label: "Archived", color: "#6b7280", isClosed: true },
			],
			dashboardDefaults: {
				openOnStartup: false,
				sectionsOrder: [
					"goals",
					"today",
					"week",
					"active-projects",
					"deadlines",
					"mini-calendar",
					"quick-actions",
				],
				showMiniCalendar: true,
				showQuickActions: true,
			},
			calendarViewSettings: {
				firstDay: 1,
			},
			...overrides,
		};

		const goalPeriodService = new GoalPeriodService();
		const plugin = {
			app,
			settings,
			goalPeriodService,
			goalRepository: new GoalRepository(app, settings, goalPeriodService),
			projectRepository: new ProjectRepository(app, settings),
			cacheManager: {
				getAllTasks: jest.fn().mockResolvedValue(tasks),
			},
			statusManager: {
				isCompletedStatus: jest.fn((status: string) => status === "done"),
			},
		};

		return { app, plugin, service: new DashboardService(plugin as any) };
	}

	async function seedProject(app: App, path: string, title: string, status = "active") {
		await app.vault.create(path, "# Project");
		app.metadataCache.setCache(path, {
			frontmatter: {
				type: "project",
				title,
				status,
				folder: path.replace(/\/project\.md$/, ""),
			},
		});
	}

	async function seedGoal(
		app: App,
		path: string,
		periodType: "week" | "month" | "quarter",
		periodKey: string,
		periodStart: string,
		periodEnd: string,
		title: string
	) {
		await app.vault.create(path, "# Goal");
		app.metadataCache.setCache(path, {
			frontmatter: {
				type: "goal",
				periodType,
				periodKey,
				periodStart,
				periodEnd,
				title,
			},
		});
	}

	it("builds the main dashboard sections from goals, tasks, and projects", async () => {
		const tasks: TaskInfo[] = [
			{
				path: "Tasks/2026/today-scheduled.md",
				title: "Today scheduled",
				status: "planned",
				priority: "normal",
				archived: false,
				scheduled: "2026-04-05",
				projects: ["[[Projects/vt-box/project]]"],
			},
			{
				path: "Tasks/2026/today-due.md",
				title: "Today due",
				status: "planned",
				priority: "high",
				archived: false,
				due: "2026-04-05",
				projects: ["[[Projects/atlas/project]]"],
			},
			{
				path: "Tasks/2026/overdue.md",
				title: "Overdue task",
				status: "planned",
				priority: "high",
				archived: false,
				due: "2026-04-04",
				projects: ["[[Projects/vt-box/project]]"],
			},
			{
				path: "Tasks/2026/blocked.md",
				title: "Blocked task",
				status: "blocked",
				priority: "normal",
				archived: false,
				due: "2026-04-08",
				projects: ["[[Projects/vt-box/project]]"],
			},
			{
				path: "Tasks/2026/completed.md",
				title: "Completed task",
				status: "done",
				priority: "normal",
				archived: false,
				due: "2026-04-07",
				projects: ["[[Projects/vt-box/project]]"],
			},
		];
		const { app, service } = createPlugin(tasks);

		await seedProject(app, "Projects/vt-box/project.md", "VT Box");
		await seedProject(app, "Projects/atlas/project.md", "Atlas");
		await seedGoal(
			app,
			"Goals/Weekly/2026-W14.md",
			"week",
			"2026-W14",
			"2026-03-30",
			"2026-04-05",
			"Close the week cleanly"
		);
		await seedGoal(
			app,
			"Goals/Monthly/2026-04.md",
			"month",
			"2026-04",
			"2026-04-01",
			"2026-04-30",
			"Stabilize April planning"
		);
		await seedGoal(
			app,
			"Goals/Quarterly/2026-Q2.md",
			"quarter",
			"2026-Q2",
			"2026-04-01",
			"2026-06-30",
			"Ship Q2 priorities"
		);

		const dashboard = await service.getDashboardData("2026-04-05");

		expect(dashboard.currentDate).toBe("2026-04-05");
		expect(dashboard.currentWeekKey).toBe("2026-W14");
		expect(dashboard.currentMonthKey).toBe("2026-04");
		expect(dashboard.currentQuarterKey).toBe("2026-Q2");
		expect(dashboard.sections.map((section) => section.id)).toEqual([
			"goals",
			"today",
			"week",
			"active-projects",
			"deadlines",
			"mini-calendar",
			"quick-actions",
		]);

		const goalsSection = dashboard.sections[0];
		expect((goalsSection.payload as any).week?.title).toBe("Close the week cleanly");
		expect((goalsSection.payload as any).month?.title).toBe("Stabilize April planning");
		expect((goalsSection.payload as any).quarter?.title).toBe("Ship Q2 priorities");

		const todaySection = dashboard.sections[1];
		expect((todaySection.payload as any).scheduledTasks).toHaveLength(1);
		expect((todaySection.payload as any).dueTasks).toHaveLength(1);
		expect((todaySection.payload as any).overdueTasks).toHaveLength(1);

		const activeProjectsSection = dashboard.sections[3];
		expect((activeProjectsSection.payload as any).projects[0]).toMatchObject({
			openTaskCount: 3,
			blockedTaskCount: 1,
			dueSoonTaskCount: 1,
		});

		const deadlinesSection = dashboard.sections[4];
		expect((deadlinesSection.payload as any).tasks.map((task: TaskInfo) => task.title)).toEqual([
			"Today due",
			"Blocked task",
		]);

		const miniCalendarSection = dashboard.sections[5];
		expect((miniCalendarSection.payload as any).selectedDate).toBe("2026-04-05");
		expect((miniCalendarSection.payload as any).markers["2026-04-05"]).toBe(2);

		const quickActionsSection = dashboard.sections[6];
		expect((quickActionsSection.payload as any).actions).toHaveLength(6);
	});

	it("respects dashboard section ordering and visibility settings", async () => {
		const { service } = createPlugin([], {
			dashboardDefaults: {
				openOnStartup: false,
				sectionsOrder: ["week", "goals", "quick-actions", "mini-calendar"],
				showMiniCalendar: false,
				showQuickActions: false,
			},
		});

		const dashboard = await service.getDashboardData("2026-04-05");

		expect(dashboard.sections.map((section) => section.id)).toEqual([
			"week",
			"goals",
			"today",
			"active-projects",
			"deadlines",
		]);
	});
});
