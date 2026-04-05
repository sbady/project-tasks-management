import { describe, expect, it } from '@jest/globals';
import {
	detectTaskFrontmatter,
	getPrimaryProject,
	isEntityFrontmatter,
	validateTaskFrontmatter,
} from '../../../../src/core/validation/taskValidation';

const defaultSettings = {
	taskIdentificationMethod: 'property' as const,
	taskTag: 'task',
	taskPropertyName: 'type',
	taskPropertyValue: 'task',
};

describe('task validation helpers', () => {
	it('recognizes canonical task entity type', () => {
		expect(isEntityFrontmatter({ type: 'task' }, 'task')).toBe(true);
		expect(detectTaskFrontmatter({ type: 'task' }, defaultSettings)).toBe(true);
	});

	it('keeps legacy tag tasks readable when property mode is active', () => {
		expect(
			detectTaskFrontmatter(
				{
					tags: ['#task'],
				},
				defaultSettings
			)
		).toBe(true);
	});

	it('uses first linked project as primary project', () => {
		expect(
			getPrimaryProject([
				'[[Projects/vt-box/project]]',
				'[[Projects/secondary/project]]',
			])
		).toBe('[[Projects/vt-box/project]]');
	});

	it('marks multi-project legacy tasks as needing normalization', () => {
		expect(
			validateTaskFrontmatter({
				type: 'task',
				projects: [
					'[[Projects/vt-box/project]]',
					'[[Projects/secondary/project]]',
				],
			})
		).toEqual({
			valid: true,
			isLegacy: false,
			needsProjectNormalization: true,
			primaryProject: '[[Projects/vt-box/project]]',
		});
	});
});

