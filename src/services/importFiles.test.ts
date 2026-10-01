import { describe, expect, it, vi } from 'vitest';
import { BackendAPI, DialogAPI } from '../api';
import { getAppState, resetAppStore } from '../test/store';
import {
  ImportFileError,
  IMPORT_FILE_FILTERS,
  pickImportFile,
  readOptionsSchemaFile,
  readProjectFile,
  readTemplateFile,
} from './importFiles';

const textFile = (content: unknown) =>
  vi
    .spyOn(BackendAPI, 'readTextFile')
    .mockResolvedValue(typeof content === 'string' ? content : JSON.stringify(content));

describe('pickImportFile', () => {
  it('returns the chosen path and remembers its folder', async () => {
    resetAppStore();
    vi.spyOn(DialogAPI, 'open').mockResolvedValue('/work/maps/poses.yaml');

    const path = await pickImportFile(IMPORT_FILE_FILTERS.waypoints);

    expect(path).toBe('/work/maps/poses.yaml');
    expect(getAppState().lastDirectory).toBe('/work/maps');
  });

  it('returns null when the dialog is cancelled', async () => {
    resetAppStore({ lastDirectory: '/keep' });
    vi.spyOn(DialogAPI, 'open').mockResolvedValue(null);

    expect(await pickImportFile(IMPORT_FILE_FILTERS.waypoints)).toBeNull();
    expect(getAppState().lastDirectory).toBe('/keep');
  });
});

describe('readTemplateFile', () => {
  it('reads a template and treats a missing engine as handlebars', async () => {
    textFile({ name: 'T', extension: 'yaml', content: 'body' });

    expect(await readTemplateFile('/t.wpt_template')).toEqual({
      name: 'T',
      extension: 'yaml',
      suffix: '',
      content: 'body',
      engine: 'handlebars',
    });
  });

  it('keeps the jinja engine', async () => {
    textFile({ name: 'T', extension: 'yaml', content: 'body', engine: 'jinja', suffix: '_x' });

    expect(await readTemplateFile('/t.wpt_template')).toMatchObject({ engine: 'jinja', suffix: '_x' });
  });

  it('rejects text that is not JSON', async () => {
    textFile('not json');
    await expect(readTemplateFile('/t.wpt_template')).rejects.toBeInstanceOf(ImportFileError);
  });

  it('rejects JSON that is not a template', async () => {
    textFile({ name: 'T' });
    await expect(readTemplateFile('/t.wpt_template')).rejects.toThrow('テンプレート');
  });
});

describe('readOptionsSchemaFile', () => {
  it('normalizes a JSON schema', async () => {
    textFile({ options: [{ name: 'a', label: 'A', type: 'string' }] });

    const schema = await readOptionsSchemaFile('/s.json');

    expect(schema.options.map((o) => o.name)).toEqual(['a']);
    expect(schema.globals).toEqual([]);
    expect(schema.definitions).toEqual([]);
  });

  it('rejects JSON without an options list', async () => {
    textFile({ foo: 1 });
    await expect(readOptionsSchemaFile('/s.json')).rejects.toThrow('Options Schema');
  });

  it('reads a YAML schema through the backend', async () => {
    const load = vi
      .spyOn(BackendAPI, 'loadOptionsSchema')
      .mockResolvedValue({ options: [{ name: 'b', label: 'B', type: 'float' }] });

    const schema = await readOptionsSchemaFile('/s.yaml');

    expect(load).toHaveBeenCalledWith('/s.yaml');
    expect(schema.options[0].name).toBe('b');
  });
});

describe('readProjectFile', () => {
  it('returns normalized project data', async () => {
    vi.spyOn(BackendAPI, 'loadProject').mockResolvedValue({ version: 1, root_node_ids: [], nodes: {} });

    const data = await readProjectFile('/p.wptroj');

    expect(data.export_profiles.length).toBeGreaterThan(0);
    expect(data.nodes).toEqual({});
  });

  it('rejects a file that is not an object', async () => {
    vi.spyOn(BackendAPI, 'loadProject').mockResolvedValue('nope');
    await expect(readProjectFile('/p.wptroj')).rejects.toBeInstanceOf(ImportFileError);
  });
});
