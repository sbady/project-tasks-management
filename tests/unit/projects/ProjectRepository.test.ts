import { describe, expect, it } from '@jest/globals';
import { App } from 'obsidian';
import { ProjectRepository } from '../../../src/projects/ProjectRepository';

describe('ProjectRepository', () => {
	it('lists and resolves project notes', async () => {
		const app = new App();
		await app.vault.create('Projects/vt-box/project.md', '# Project');
		app.metadataCache.setCache('Projects/vt-box/project.md', {
			frontmatter: {
				type: 'project',
				title: 'VT Box',
				status: 'active',
				folder: 'Projects/vt-box',
				relatedNotes: ['[[Projects/vt-box/Specs/overview]]'],
			},
		});

		const repository = new ProjectRepository(app, {
			projectsFolder: 'Projects',
			projectNoteFilename: 'project',
		});

		const projects = repository.listProjects();
		expect(projects).toHaveLength(1);
		expect(projects[0]).toMatchObject({
			type: 'project',
			path: 'Projects/vt-box/project.md',
			title: 'VT Box',
			status: 'active',
			folder: 'Projects/vt-box',
		});
		expect(repository.getProjectForFolder('Projects/vt-box')?.path).toBe(
			'Projects/vt-box/project.md'
		);
	});
});

