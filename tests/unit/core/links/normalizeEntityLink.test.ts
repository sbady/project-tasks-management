import { describe, expect, it } from '@jest/globals';
import {
	normalizeEntityLink,
	unwrapEntityLink,
} from '../../../../src/core/links/normalizeEntityLink';

describe('normalizeEntityLink', () => {
	it('unwraps wikilinks and strips aliases', () => {
		expect(unwrapEntityLink('[[Projects/vt-box/project|VT Box]]')).toBe(
			'Projects/vt-box/project|VT Box'
		);
		expect(normalizeEntityLink('[[Projects/vt-box/project|VT Box]]')).toBe(
			'Projects/vt-box/project.md'
		);
	});

	it('normalizes markdown links to canonical markdown paths', () => {
		expect(normalizeEntityLink('[VT Box](Projects/vt-box/project)')).toBe(
			'Projects/vt-box/project.md'
		);
	});
});

