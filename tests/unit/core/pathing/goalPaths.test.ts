import { describe, expect, it } from '@jest/globals';
import {
	buildGoalFilename,
	getGoalFolderPath,
	getGoalNotePath,
} from '../../../../src/core/pathing/goalPaths';

describe('goal path helpers', () => {
	const settings = {
		goalsFolder: 'Goals',
		goalDefaults: {
			weeklyFolder: 'Weekly',
			monthlyFolder: 'Monthly',
			quarterlyFolder: 'Quarterly',
		},
	};

	it('builds weekly goal paths', () => {
		expect(getGoalFolderPath(settings, 'week')).toBe('Goals/Weekly');
		expect(buildGoalFilename('2026-W15')).toBe('2026-W15.md');
		expect(getGoalNotePath(settings, 'week', '2026-W15')).toBe(
			'Goals/Weekly/2026-W15.md'
		);
	});
});

