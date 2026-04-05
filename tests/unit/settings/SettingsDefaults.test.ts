import { DEFAULT_SETTINGS } from '../../../src/settings/defaults';

describe('Settings defaults', () => {
  test('viewsButtonAlignment defaults to right', () => {
    expect(DEFAULT_SETTINGS.viewsButtonAlignment).toBe('right');
  });

  test('task identification defaults to property based type detection', () => {
    expect(DEFAULT_SETTINGS.taskIdentificationMethod).toBe('property');
    expect(DEFAULT_SETTINGS.taskPropertyName).toBe('type');
    expect(DEFAULT_SETTINGS.taskPropertyValue).toBe('task');
  });

  test('project, task, goal, and system folders use product defaults', () => {
    expect(DEFAULT_SETTINGS.projectsFolder).toBe('Projects');
    expect(DEFAULT_SETTINGS.tasksFolder).toBe('Tasks');
    expect(DEFAULT_SETTINGS.goalsFolder).toBe('Goals');
    expect(DEFAULT_SETTINGS.systemFolder).toBe('System');
    expect(DEFAULT_SETTINGS.projectNoteFilename).toBe('project');
  });

  test('dashboard and heatmap defaults are defined for milestone 1', () => {
    expect(DEFAULT_SETTINGS.dashboardDefaults.sectionsOrder).toEqual([
      'goals',
      'today',
      'week',
      'active-projects',
      'deadlines',
      'mini-calendar',
      'quick-actions',
    ]);
    expect(DEFAULT_SETTINGS.heatmapSettings.rangeDays).toBe(365);
    expect(DEFAULT_SETTINGS.heatmapSettings.metric).toBe('completed');
  });
});

