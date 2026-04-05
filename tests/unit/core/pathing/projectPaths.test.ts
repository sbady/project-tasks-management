import { describe, expect, it } from '@jest/globals';
import {
	getCanonicalProjectNotePath,
	getProjectFolderFromNotePath,
	getProjectFolderPath,
	isCanonicalProjectNotePath,
} from '../../../../src/core/pathing/projectPaths';

describe('project path helpers', () => {
	const settings = {
		projectsFolder: 'Projects',
		projectNoteFilename: 'project',
	};

	it('builds canonical folder and note paths', () => {
		expect(getProjectFolderPath(settings, 'VT Box')).toBe('Projects/vt-box');
		expect(getCanonicalProjectNotePath(settings, 'VT Box')).toBe(
			'Projects/vt-box/project.md'
		);
	});

	it('resolves project folder from project note path', () => {
		expect(getProjectFolderFromNotePath('Projects/vt-box/project.md')).toBe(
			'Projects/vt-box'
		);
	});

	it('detects canonical project note paths', () => {
		expect(isCanonicalProjectNotePath('Projects/vt-box/project.md', settings)).toBe(true);
		expect(isCanonicalProjectNotePath('Projects/vt-box/overview.md', settings)).toBe(false);
	});
});

