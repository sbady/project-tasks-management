import { describe, expect, it } from '@jest/globals';
import { App } from 'obsidian';
import { GoalRepository } from '../../../src/goals/GoalRepository';
import { GoalPeriodService } from '../../../src/goals/GoalPeriodService';

describe('GoalRepository', () => {
	it('lists goals and resolves the current period', async () => {
		const app = new App();
		await app.vault.create('Goals/Weekly/2026-W15.md', '# Goal');
		app.metadataCache.setCache('Goals/Weekly/2026-W15.md', {
			frontmatter: {
				type: 'goal',
				periodType: 'week',
				periodKey: '2026-W15',
				periodStart: '2026-04-06',
				periodEnd: '2026-04-12',
				title: 'Stabilize planning',
			},
		});

		const repository = new GoalRepository(
			app,
			{
				goalsFolder: 'Goals',
				goalDefaults: {
					weeklyFolder: 'Weekly',
					monthlyFolder: 'Monthly',
					quarterlyFolder: 'Quarterly',
				},
				goalFilenamePattern: 'period-key',
			},
			new GoalPeriodService()
		);

		expect(repository.listGoals('week')).toHaveLength(1);
		expect(repository.getGoalForPeriod('week', '2026-W15')?.title).toBe(
			'Stabilize planning'
		);
		expect(repository.getCurrentGoal('week', new Date(2026, 3, 6))?.path).toBe(
			'Goals/Weekly/2026-W15.md'
		);
	});
});
