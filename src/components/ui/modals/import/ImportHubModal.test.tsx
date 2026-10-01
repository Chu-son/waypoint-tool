import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { ImportHubModal } from './ImportHubModal';
import { BackendAPI, DialogAPI } from '../../../../api';
import { renderWithStore } from '../../../../test/render';
import { getAppState, PAST_WELCOME } from '../../../../test/store';
import { makeWaypoint } from '../../../../test/fixtures';
import type { ExportTemplate } from '../../../../types/export';
import type { OptionsSchema } from '../../../../types/options';

const RAW_POSES = [
  { x: 1, y: 2, yaw: 0 },
  { x: 3, y: 4, yaw: 0 },
];

const str = (name: string, label = name) => ({ name, label, type: 'string' as const });
const schemaOf = (...names: string[]): OptionsSchema => ({
  options: names.map((n) => str(n)),
  globals: [],
  definitions: [],
});

beforeEach(() => {
  vi.spyOn(DialogAPI, 'message').mockResolvedValue(undefined);
});

describe('ImportHubModal: choosing what to import', () => {
  it('renders nothing while closed', () => {
    const { container } = renderWithStore(<ImportHubModal isOpen={false} onClose={vi.fn()} />, PAST_WELCOME);
    expect(container).toBeEmptyDOMElement();
  });

  it('first asks what to import, offering every kind of import', () => {
    renderWithStore(<ImportHubModal isOpen onClose={vi.fn()} />, PAST_WELCOME);

    expect(screen.getByText('What would you like to import?')).toBeInTheDocument();
    ['Waypoints', 'From Another Project', 'Option Schema', 'Export Template', 'Map', 'Plugins'].forEach((label) => {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}`) })).toBeInTheDocument();
    });
  });

  it('goes back from a kind to the list of kinds', async () => {
    const { user } = renderWithStore(<ImportHubModal isOpen onClose={vi.fn()} />, PAST_WELCOME);

    await user.click(screen.getByRole('button', { name: /^Option Schema/ }));
    expect(screen.queryByText('What would you like to import?')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to import types' }));

    expect(screen.getByText('What would you like to import?')).toBeInTheDocument();
  });

  it('starts at the requested kind when opened from somewhere else', () => {
    renderWithStore(<ImportHubModal isOpen onClose={vi.fn()} />, { ...PAST_WELCOME, importModalCategory: 'template' });

    expect(screen.getByText('Import Export Template')).toBeInTheDocument();
    expect(screen.queryByText('What would you like to import?')).not.toBeInTheDocument();
  });

  it('remembers the requested kind only for one opening', () => {
    renderWithStore(<ImportHubModal isOpen onClose={vi.fn()} />, PAST_WELCOME);
    getAppState().setImportModalOpen(true, 'map');
    expect(getAppState().importModalCategory).toBe('map');

    getAppState().setImportModalOpen(true);
    expect(getAppState().importModalCategory).toBeNull();
  });
});

describe('ImportHubModal: waypoints', () => {
  const openWaypoints = async (onClose = vi.fn()) => {
    const rendered = renderWithStore(<ImportHubModal isOpen onClose={onClose} />, PAST_WELCOME);
    await rendered.user.click(screen.getByRole('button', { name: /^Waypoints/ }));
    return rendered;
  };

  it('keeps Import disabled until a file is chosen', async () => {
    await openWaypoints();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('adds the waypoints of the chosen file to the project and closes', async () => {
    vi.spyOn(DialogAPI, 'open').mockResolvedValue('/tmp/poses.yaml');
    vi.spyOn(BackendAPI, 'importWaypointsRaw').mockResolvedValue(RAW_POSES);
    const onClose = vi.fn();
    const { user } = await openWaypoints(onClose);

    await user.click(screen.getByRole('button', { name: 'Browse' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const state = getAppState();
    const positions = state.rootNodeIds.map((id) => [state.nodes[id].transform?.x, state.nodes[id].transform?.y]);
    expect(positions).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('previews the number of waypoints without adding them', async () => {
    vi.spyOn(DialogAPI, 'open').mockResolvedValue('/tmp/poses.yaml');
    vi.spyOn(BackendAPI, 'importWaypointsRaw').mockResolvedValue(RAW_POSES);
    const { user } = await openWaypoints();

    await user.click(screen.getByRole('button', { name: 'Browse' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Preview' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Preview' }));

    expect(await screen.findByText('2 waypoint(s) ready to import')).toBeInTheDocument();
    expect(getAppState().rootNodeIds).toHaveLength(0);
  });
});

describe('ImportHubModal: option schema', () => {
  const openSchema = async (current: OptionsSchema | null, file: unknown, onClose = vi.fn()) => {
    vi.spyOn(DialogAPI, 'open').mockResolvedValue('/tmp/schema.json');
    vi.spyOn(BackendAPI, 'readTextFile').mockResolvedValue(JSON.stringify(file));
    const rendered = renderWithStore(<ImportHubModal isOpen onClose={onClose} />, {
      ...PAST_WELCOME,
      importModalCategory: 'optionSchema',
      optionsSchema: current,
    });
    await rendered.user.click(screen.getByRole('button', { name: 'Browse' }));
    return rendered;
  };

  it('shows what the file adds and changes, and takes both by default', async () => {
    const onClose = vi.fn();
    const { user } = await openSchema(
      { ...schemaOf('keep', 'edit'), options: [str('keep'), str('edit', 'Old')] },
      { options: [str('keep'), str('edit', 'New'), str('fresh')] },
      onClose,
    );

    expect(await screen.findByText('fresh')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Changed')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Import options:fresh' })).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Import 2 item(s)' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const options = getAppState().optionsSchema!.options;
    expect(options.map((o) => o.name)).toEqual(['keep', 'edit', 'fresh']);
    expect(options.find((o) => o.name === 'edit')?.label).toBe('New');
  });

  it('leaves out an item the user unticks', async () => {
    const { user } = await openSchema(schemaOf('a'), { options: [str('a'), str('b'), str('c')] });
    await screen.findByText('b');

    await user.click(screen.getByRole('checkbox', { name: 'Import options:c' }));
    await user.click(screen.getByRole('button', { name: 'Import 1 item(s)' }));

    await waitFor(() => expect(getAppState().optionsSchema!.options.map((o) => o.name)).toEqual(['a', 'b']));
  });

  it('shows the lines that changed when a changed item is expanded', async () => {
    const { user } = await openSchema(
      { ...schemaOf('edit'), options: [str('edit', 'Old label')] },
      { options: [str('edit', 'New label')] },
    );
    await screen.findByText('Changed');

    await user.click(screen.getByRole('button', { name: 'Show changes of edit' }));

    const diff = screen.getByRole('group', { name: 'Changes of edit' });
    expect(diff).toHaveTextContent('Old label');
    expect(diff).toHaveTextContent('New label');
  });

  it('says there is nothing to import when the file matches', async () => {
    await openSchema(schemaOf('a'), { options: [str('a')] });

    expect(await screen.findByText('The file matches the current schema')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('refuses to import a selection whose merged schema is invalid', async () => {
    await openSchema(null, {
      options: [{ name: 'p', label: 'P', type: 'ref', ref: 'Missing' }],
    });

    expect(await screen.findByText('The merged schema is not valid')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Import/ })).toBeDisabled();
  });
});

describe('ImportHubModal: export template', () => {
  const existing: ExportTemplate = {
    id: 't1',
    name: 'Mine',
    extension: 'yaml',
    suffix: '',
    content: 'line one\nold line',
    engine: 'jinja',
    scope: 'global',
  };

  const openTemplate = async (file: unknown, templates: ExportTemplate[], onClose = vi.fn()) => {
    vi.spyOn(DialogAPI, 'open').mockResolvedValue('/tmp/mine.wpt_template');
    vi.spyOn(BackendAPI, 'readTextFile').mockResolvedValue(JSON.stringify(file));
    const rendered = renderWithStore(<ImportHubModal isOpen onClose={onClose} />, {
      ...PAST_WELCOME,
      importModalCategory: 'template',
      exportTemplates: templates,
    });
    await rendered.user.click(screen.getByRole('button', { name: 'Browse' }));
    return rendered;
  };

  it('adds a template that does not exist yet, as a new one', async () => {
    const onClose = vi.fn();
    const { user } = await openTemplate(
      { name: 'Fresh', extension: 'csv', content: 'c', engine: 'jinja' },
      [],
      onClose,
    );
    expect(await screen.findByText('"Fresh" is a new template')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Import' }));

    expect(onClose).toHaveBeenCalled();
    expect(getAppState().exportTemplates).toHaveLength(1);
    expect(getAppState().exportTemplates[0]).toMatchObject({ name: 'Fresh', scope: 'global', content: 'c' });
  });

  it('shows how a same-name template differs and overwrites it in place', async () => {
    const onClose = vi.fn();
    const { user } = await openTemplate(
      { name: 'Mine', extension: 'yaml', content: 'line one\nnew line', engine: 'jinja' },
      [existing],
      onClose,
    );

    expect(await screen.findByText(/A global template named "Mine" already exists/)).toBeInTheDocument();
    const content = screen.getByRole('group', { name: 'Content changes' });
    expect(content).toHaveTextContent('old line');
    expect(content).toHaveTextContent('new line');

    await user.click(screen.getByRole('button', { name: 'Import' }));

    expect(onClose).toHaveBeenCalled();
    expect(getAppState().exportTemplates).toHaveLength(1);
    expect(getAppState().exportTemplates[0]).toMatchObject({
      id: 't1',
      content: 'line one\nnew line',
      scope: 'global',
    });
  });

  it('can add a same-name template as a separate one instead', async () => {
    const { user } = await openTemplate({ name: 'Mine', extension: 'yaml', content: 'changed', engine: 'jinja' }, [
      existing,
    ]);
    await screen.findByText(/already exists/);

    await user.click(screen.getByRole('radio', { name: 'Add as a new template' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Mine (Imported)');
    await user.click(screen.getByRole('button', { name: 'Import' }));

    expect(getAppState().exportTemplates.map((t) => [t.name, t.content])).toEqual([
      ['Mine', 'line one\nold line'],
      ['Mine (Imported)', 'changed'],
    ]);
  });

  it('does not offer to overwrite a template that is already identical', async () => {
    await openTemplate({ name: 'Mine', extension: 'yaml', content: existing.content, engine: 'jinja' }, [existing]);

    expect(await screen.findByText('"Mine" is already up to date')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('rejects a file that is not a template', async () => {
    await openTemplate({ nope: true }, []);

    await waitFor(() =>
      expect(DialogAPI.message).toHaveBeenCalledWith(expect.stringContaining('テンプレート'), expect.anything()),
    );
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });
});

describe('ImportHubModal: from another project', () => {
  const project = {
    version: 1,
    root_node_ids: ['a'],
    nodes: { a: makeWaypoint('a', { name: 'theirs' }) },
    options_schema: schemaOf('speed'),
    path_color: '#abcdef',
  };

  const openProject = async (onClose = vi.fn(), state = {}) => {
    vi.spyOn(DialogAPI, 'open').mockResolvedValue('/tmp/other.wptroj');
    vi.spyOn(BackendAPI, 'loadProject').mockResolvedValue(project);
    const rendered = renderWithStore(<ImportHubModal isOpen onClose={onClose} />, {
      ...PAST_WELCOME,
      importModalCategory: 'project',
      ...state,
    });
    await rendered.user.click(screen.getByRole('button', { name: 'Browse' }));
    await screen.findByText('Settings');
    return rendered;
  };

  it('lists what the other project has, and nothing is selected to begin with', async () => {
    await openProject();

    expect(screen.getByRole('checkbox', { name: 'Import Option Schema' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Import Waypoints' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('disables a category when there is nothing to take or it matches this project', async () => {
    await openProject();

    expect(screen.getByRole('checkbox', { name: 'Import Annotations' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Import Robot Footprint' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Import Path Settings' })).toBeEnabled();
  });

  it('imports only the ticked categories', async () => {
    const onClose = vi.fn();
    const { user } = await openProject(onClose, { rootNodeIds: [], nodes: {}, pathColor: '#111111' });

    await user.click(screen.getByRole('checkbox', { name: 'Import Waypoints' }));
    await user.click(screen.getByRole('checkbox', { name: 'Import Option Schema' }));
    await user.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const state = getAppState();
    expect(Object.values(state.nodes).map((n) => n.name)).toEqual(['theirs']);
    expect(state.optionsSchema?.options.map((o) => o.name)).toEqual(['speed']);
    expect(state.pathColor).toBe('#111111');
  });

  it('shows the differences of a settings category when it is opened', async () => {
    const { user } = await openProject(vi.fn(), { pathColor: '#111111' });

    await user.click(screen.getByRole('button', { name: 'Show details of Path Settings' }));

    const diff = screen.getByRole('group', { name: 'Changes of Path Settings' });
    expect(diff).toHaveTextContent('#111111');
    expect(diff).toHaveTextContent('#abcdef');
  });

  it('ticks the category when an item inside it is chosen', async () => {
    const { user } = await openProject();

    await user.click(screen.getByRole('button', { name: 'Show details of Option Schema' }));
    await user.click(screen.getByRole('checkbox', { name: 'Import options:speed' }));
    expect(screen.getByRole('checkbox', { name: 'Import Option Schema' })).not.toBeChecked();

    await user.click(screen.getByRole('checkbox', { name: 'Import options:speed' }));
    expect(screen.getByRole('checkbox', { name: 'Import Option Schema' })).toBeChecked();
  });

  it('warns that Undo only covers the imported waypoints and annotations', async () => {
    const { user } = await openProject();
    expect(screen.queryByText('About Undo')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Import Waypoints' }));

    expect(screen.getByText('About Undo')).toBeInTheDocument();
  });
});
