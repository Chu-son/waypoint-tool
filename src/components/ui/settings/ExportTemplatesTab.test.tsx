import { screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ExportTemplatesTab } from './ExportTemplatesTab';
import { renderWithStore } from '../../../test/render';
import { getAppState } from '../../../test/store';

describe('ExportTemplatesTab engine selection', () => {
  it('creates a new template with the Jinja engine by default', async () => {
    const { user } = renderWithStore(<ExportTemplatesTab />);

    await user.click(screen.getByRole('button', { name: /New Template/ }));
    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    const templates = getAppState().exportTemplates;
    expect(templates).toHaveLength(1);
    expect(templates[0].engine).toBe('jinja');
    expect(templates[0].content).toContain('{% for wp in waypoints %}');
  });

  it('creates a Handlebars template with the matching default content when selected', async () => {
    const { user } = renderWithStore(<ExportTemplatesTab />);

    await user.click(screen.getByRole('button', { name: /New Template/ }));
    await user.selectOptions(screen.getByLabelText('Template Engine'), 'handlebars');
    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    const templates = getAppState().exportTemplates;
    expect(templates[0].engine).toBe('handlebars');
    expect(templates[0].content).toContain('{{#each waypoints}}');
  });

  it('lets an existing template switch engine, which changes the inserted core-field chip syntax', async () => {
    const { user } = renderWithStore(<ExportTemplatesTab />, {
      exportTemplates: [
        { id: 't1', name: 'My Template', extension: 'yaml', suffix: '', content: '', engine: 'handlebars' },
      ],
    });

    const engineSelect = screen.getByDisplayValue('Handlebars') as HTMLSelectElement;
    await user.selectOptions(engineSelect, 'jinja');
    expect(getAppState().exportTemplates[0].engine).toBe('jinja');

    // エンジンを切り替えた後は、挿入されるコアフィールドチップも Jinja 記法になる。
    const indexChip = screen.getByRole('button', { name: '{{ wp.index }}' });
    await user.click(indexChip);
    expect(getAppState().exportTemplates[0].content).toBe('{{ wp.index }}');
  });

  it('inserts globals/options chips using @root.globals / bare options for a Handlebars template', async () => {
    const { user } = renderWithStore(<ExportTemplatesTab />, {
      exportTemplates: [
        { id: 't1', name: 'My Template', extension: 'yaml', suffix: '', content: '', engine: 'handlebars' },
      ],
      optionsSchema: {
        options: [{ name: 'speed', label: 'Speed', type: 'float' }],
        globals: [{ name: 'frame_id', label: 'Frame', type: 'string', value: 'map' }],
      },
    });

    await user.click(screen.getByRole('button', { name: '{{@root.globals.frame_id}}' }));
    expect(getAppState().exportTemplates[0].content).toBe('{{@root.globals.frame_id}}');

    await user.click(screen.getByRole('button', { name: '{{options.speed}}' }));
    expect(getAppState().exportTemplates[0].content).toBe('{{@root.globals.frame_id}}{{options.speed}}');

    await user.click(screen.getByRole('button', { name: '{{raw_options.speed}}' }));
    expect(getAppState().exportTemplates[0].content).toBe(
      '{{@root.globals.frame_id}}{{options.speed}}{{raw_options.speed}}',
    );
  });

  it('inserts the map origin (geo) variables with the syntax of the template engine', async () => {
    const { user } = renderWithStore(<ExportTemplatesTab />, {
      exportTemplates: [
        { id: 't1', name: 'Handlebars', extension: 'yaml', suffix: '', content: '', engine: 'handlebars' },
        { id: 't2', name: 'Jinja', extension: 'yaml', suffix: '', content: '', engine: 'jinja' },
      ],
    });

    await user.click(screen.getAllByRole('button', { name: '{{@root.geo.lat}}' })[0]);
    await user.click(screen.getAllByRole('button', { name: '{{ geo.utm.zone }}' })[0]);

    const [handlebars, jinja] = getAppState().exportTemplates;
    expect(handlebars.content).toBe('{{@root.geo.lat}}');
    expect(jinja.content).toBe('{{ geo.utm.zone }}');
  });

  it('copying a template preserves its source engine without asking again', async () => {
    const { user } = renderWithStore(<ExportTemplatesTab />, {
      exportTemplates: [
        { id: 't1', name: 'Jinja Template', extension: 'yaml', suffix: '', content: 'x', engine: 'jinja' },
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Copy Template' }));
    // コピー時はエンジン選択欄自体を表示しない（コピー元の記法をそのまま引き継ぐ）。
    expect(screen.queryByLabelText('Template Engine')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Save$/ }));

    const templates = getAppState().exportTemplates;
    expect(templates).toHaveLength(2);
    expect(templates[1].engine).toBe('jinja');
  });

  it('sends Import to the import dialog, already on the template import screen', async () => {
    const { user } = renderWithStore(<ExportTemplatesTab />);

    await user.click(screen.getByRole('button', { name: /Import/ }));

    expect(getAppState().isImportModalOpen).toBe(true);
    expect(getAppState().importModalCategory).toBe('template');
  });
});
