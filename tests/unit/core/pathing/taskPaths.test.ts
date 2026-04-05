import { describe, expect, it } from '@jest/globals';
import {
	buildTaskFilename,
	getTaskFolderPath,
	getTaskNotePath,
} from '../../../../src/core/pathing/taskPaths';

describe('task path helpers', () => {
	const date = new Date(2026, 3, 5, 12, 30, 45);

	it('builds date-slug filenames and yearly folders', () => {
		expect(buildTaskFilename('Plan VT box Q2', 'date-slug', date)).toBe(
			'2026-04-05-plan-vt-box-q2'
		);
		expect(getTaskFolderPath({ tasksFolder: 'Tasks' }, date)).toBe('Tasks/2026');
		expect(
			getTaskNotePath(
				{
					tasksFolder: 'Tasks',
					taskFilenamePattern: 'date-slug',
				},
				'Plan VT box Q2',
				date
			)
		).toBe('Tasks/2026/2026-04-05-plan-vt-box-q2.md');
	});

	it('supports slug and zettel filename patterns', () => {
		expect(buildTaskFilename('Inbox review', 'slug', date)).toBe('inbox-review');
		expect(buildTaskFilename('Inbox review', 'zettel', date)).toBe('20260405123045');
	});
});

