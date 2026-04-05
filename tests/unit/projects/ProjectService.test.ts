import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { App } from "obsidian";
import { MockObsidian } from "../../__mocks__/obsidian";
import { ProjectRepository } from "../../../src/projects/ProjectRepository";
import { ProjectService } from "../../../src/projects/ProjectService";

jest.mock("../../../src/utils/dateUtils", () => {
	const actual = jest.requireActual("../../../src/utils/dateUtils");
	return {
		...actual,
		getCurrentTimestamp: jest.fn(() => "2026-04-05T10:30:00Z"),
	};
});

describe("ProjectService", () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	function createPlugin() {
		const app = new App();
		const settings = {
			projectsFolder: "Projects",
			projectNoteFilename: "project",
			projectStatuses: [
				{ value: "active", label: "Active", color: "#2563eb" },
				{ value: "done", label: "Done", color: "#16a34a", isClosed: true },
			],
		};

		const plugin = {
			app,
			settings,
			emitter: {
				trigger: jest.fn(),
			},
			projectRepository: new ProjectRepository(app, settings),
		};

		return {
			app,
			plugin,
			service: new ProjectService(plugin as any),
		};
	}

	it("creates a canonical project note inside a project folder", async () => {
		const { app, service, plugin } = createPlugin();

		const result = await service.createProject({
			title: "VT Box",
			description: "Launch planning",
			relatedNotes: ["[[Projects/vt-box/spec]]"],
			tags: ["planning", "client"],
		});

		expect(result.created).toBe(true);
		expect(result.file.path).toBe("Projects/vt-box/project.md");
		expect(result.project).toMatchObject({
			type: "project",
			title: "VT Box",
			status: "active",
			folder: "Projects/vt-box",
			createdAt: "2026-04-05T10:30:00Z",
			updatedAt: "2026-04-05T10:30:00Z",
		});
		expect(plugin.emitter.trigger).toHaveBeenCalled();

		const fileContent = await app.vault.read(result.file);
		expect(fileContent).toContain("type: project");
		expect(fileContent).toContain("folder: Projects/vt-box");
		expect(fileContent).toContain("title: VT Box");
	});

	it("opens an existing project instead of creating a duplicate", async () => {
		const { service } = createPlugin();

		const first = await service.createProject({ title: "VT Box" });
		const second = await service.createProject({ title: "VT Box" });

		expect(first.created).toBe(true);
		expect(second.created).toBe(false);
		expect(second.file.path).toBe("Projects/vt-box/project.md");
	});

	it("updates project metadata without changing the canonical file path", async () => {
		const { service } = createPlugin();

		const created = await service.createProject({ title: "VT Box" });
		const updated = await service.updateProject(created.project, {
			title: "VT Box Alpha",
			status: "done",
			description: "Wrapped up",
			dueDate: "2026-04-30",
		});

		expect(updated.path).toBe("Projects/vt-box/project.md");
		expect(updated.folder).toBe("Projects/vt-box");
		expect(updated.title).toBe("VT Box Alpha");
		expect(updated.status).toBe("done");
		expect(updated.description).toBe("Wrapped up");
		expect(updated.dueDate).toBe("2026-04-30");
		expect(updated.updatedAt).toBe("2026-04-05T10:30:00Z");
	});
});
