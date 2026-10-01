import { describe, expect, it } from 'vitest';
import { getAppState, resetAppStore } from '../test/store';
import type { ExportTemplate } from '../types/export';
import { applyTemplateImport } from './templateImport';

const existing: ExportTemplate = {
  id: 't1',
  name: 'Mine',
  extension: 'yaml',
  suffix: '',
  content: 'old',
  engine: 'jinja',
  scope: 'global',
};
const data = { name: 'Mine', extension: 'json', suffix: '_new', content: 'new', engine: 'handlebars' as const };

describe('template import', () => {
  it('overwrites a template in place and keeps its id and scope', () => {
    resetAppStore({ exportTemplates: [existing], isDirty: false });

    applyTemplateImport(data, { action: 'overwrite', match: existing });

    const [template] = getAppState().exportTemplates;
    expect(template).toMatchObject({ id: 't1', scope: 'global', content: 'new', extension: 'json', suffix: '_new' });
    expect(template.engine).toBe('handlebars');
    expect(getAppState().isDirty).toBe(true);
  });

  it('adds a new template with the chosen name and scope', () => {
    resetAppStore({ exportTemplates: [existing] });

    applyTemplateImport(data, { action: 'add', name: 'Mine (Imported)', scope: 'local' });

    const templates = getAppState().exportTemplates;
    expect(templates).toHaveLength(2);
    expect(templates[1]).toMatchObject({ name: 'Mine (Imported)', scope: 'local', content: 'new' });
    expect(templates[1].id).not.toBe('t1');
    expect(templates[0].content).toBe('old');
  });
});
