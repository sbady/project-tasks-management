import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { App } from "obsidian";
import { MockObsidian } from "../../__mocks__/obsidian";
import { GoalRepository } from "../../../src/goals/GoalRepository";
import { GoalPeriodService } from "../../../src/goals/GoalPeriodService";
import { GoalService } from "../../../src/goals/GoalService";

jest.mock("../../../src/utils/dateUtils", () => {
	const actual = jest.requireActual("../../../src/utils/dateUtils");
	return {
		...actual,
		getCurrentTimestamp: jest.fn(() => "2026-04-05T10:30:00Z"),
	};
});

describe("GoalService", () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	function createPlugin() {
		const app = new App();
		const settings = {
			goalsFolder: "Goals",
			goalFilenamePattern: "period-key" as const,
			goalDefaults: {
				weeklyFolder: "Weekly",
				monthlyFolder: "Monthly",
				quarterlyFolder: "Quarterly",
			},
		};

		const goalPeriodService = new GoalPeriodService();
		const plugin = {
			app,
			settings,
			emitter: {
				trigger: jest.fn(),
			},
			goalPeriodService,
			goalRepository: new GoalRepository(app, settings, goalPeriodService),
		};

		return {
			app,
			plugin,
			service: new GoalService(plugin as any),
		};
	}

	it("creates a goal note for the resolved period", async () => {
		const { app, service, plugin } = createPlugin();

		const result = await service.createGoal({
			title: "Stabilize weekly planning",
			periodType: "week",
			referenceDate: "2026-04-06",
			relatedProjects: ["[[Projects/vt-box/project]]"],
		});

		expect(result.created).toBe(true);
		expect(result.file.path).toBe("Goals/Weekly/2026-W15.md");
		expect(result.goal).toMatchObject({
			type: "goal",
			periodType: "week",
			periodKey: "2026-W15",
			periodStart: "2026-04-06",
			periodEnd: "2026-04-12",
			title: "Stabilize weekly planning",
			createdAt: "2026-04-05T10:30:00Z",
			updatedAt: "2026-04-05T10:30:00Z",
		});
		expect(plugin.emitter.trigger).toHaveBeenCalled();

		const fileContent = await app.vault.read(result.file);
		expect(fileContent).toContain("type: goal");
		expect(fileContent).toContain("periodKey: 2026-W15");
		expect(fileContent).toContain("periodType: week");
	});

	it("opens the existing goal for the same period instead of creating a duplicate", async () => {
		const { service } = createPlugin();

		const first = await service.createGoal({
			title: "Stabilize weekly planning",
			periodType: "week",
			referenceDate: "2026-04-06",
		});
		const second = await service.createGoal({
			title: "Another title",
			periodType: "week",
			referenceDate: "2026-04-06",
		});

		expect(first.created).toBe(true);
		expect(second.created).toBe(false);
		expect(second.file.path).toBe("Goals/Weekly/2026-W15.md");
	});

	it("updates goal metadata while preserving period identity", async () => {
		const { service } = createPlugin();

		const created = await service.createGoal({
			title: "Stabilize weekly planning",
			periodType: "week",
			referenceDate: "2026-04-06",
		});
		const updated = await service.updateGoal(created.goal, {
			title: "Ship the weekly plan",
			description: "Focus on active projects",
		});

		expect(updated.path).toBe("Goals/Weekly/2026-W15.md");
		expect(updated.periodType).toBe("week");
		expect(updated.periodKey).toBe("2026-W15");
		expect(updated.periodStart).toBe("2026-04-06");
		expect(updated.periodEnd).toBe("2026-04-12");
		expect(updated.title).toBe("Ship the weekly plan");
		expect(updated.description).toBe("Focus on active projects");
		expect(updated.updatedAt).toBe("2026-04-05T10:30:00Z");
	});
});
