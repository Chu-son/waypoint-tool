import { Plus, Trash2, Copy, Save, Upload, Download, FolderOpen, FileCode } from 'lucide-react';
import { useAppStore } from '../../../stores/appStore';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../common/Modal';
import { Label } from '../common/Label';
import { Select } from '../common/Select';
import { useState, useEffect } from 'react';
import { ExportTemplate, TemplateEngine } from '../../../types/store';
import { TabSectionHeader } from './TabSectionHeader';
import { EmptyState } from '../common/EmptyState';
import { SectionDivider } from '../common/SectionDivider';
import { InlineFieldRow } from '../common/InlineFieldRow';
import { FieldLabel } from '../common/FieldLabel';
import { AlertBox } from '../common/AlertBox';
import { notify } from '../../../services/notify';

/** 新規テンプレートの既定の雛形。新規作成の既定エンジンは Jinja。 */
const DEFAULT_TEMPLATE_CONTENT: Record<TemplateEngine, string> = {
  jinja:
    '{% for wp in waypoints %}\nwp_{{ wp.index }}:\n  x: {{ wp.x }}\n  y: {{ wp.y }}\n  yaw: {{ wp.yaw }}\n{% endfor %}',
  handlebars: '{{#each waypoints}}\nwp_{{index}}:\n  x: {{x}}\n  y: {{y}}\n  yaw: {{yaw}}\n{{/each}}',
};

/** テンプレート挿入チップに使う、waypoint 1件分の基本フィールド（engine ごとの記法）。 */
function coreFieldChips(engine: TemplateEngine): string[] {
  const fields = ['index', 'id', 'type', 'x', 'y', 'z', 'yaw', 'qx', 'qy', 'qz', 'qw'];
  return engine === 'jinja' ? fields.map((f) => `{{ wp.${f} }}`) : fields.map((f) => `{{${f}}}`);
}

function globalFieldChip(engine: TemplateEngine, name: string): string {
  return engine === 'jinja' ? `{{ globals.${name} }}` : `{{@root.globals.${name}}}`;
}

/** マップ原点（位置合わせ後のワールド座標 (0,0)）の地理座標を参照する `geo` 変数のチップ。 */
const GEO_FIELD_PATHS = [
  'lat',
  'lon',
  'utm.zone',
  'utm.hemisphere',
  'utm.easting',
  'utm.northing',
  'heading_deg',
  'heading',
];

function geoFieldChips(engine: TemplateEngine): string[] {
  return GEO_FIELD_PATHS.map((path) => (engine === 'jinja' ? `{{ geo.${path} }}` : `{{@root.geo.${path}}}`));
}

function optionChip(engine: TemplateEngine, name: string): string {
  return engine === 'jinja' ? `{{ wp.options.${name} }}` : `{{options.${name}}}`;
}

function rawOptionChip(engine: TemplateEngine, name: string): string {
  return engine === 'jinja' ? `{{ wp.raw_options.${name} }}` : `{{raw_options.${name}}}`;
}

function TemplateCreateModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    suffix: string;
    extension: string;
    scope: 'global' | 'local';
    engine: TemplateEngine;
  }) => void;
  initialData?: { name: string; suffix: string; extension: string; scope: 'global' | 'local'; engine?: TemplateEngine };
}) {
  const [name, setName] = useState(initialData?.name || 'New Template');
  const [suffix, setSuffix] = useState(initialData?.suffix || '');
  const [extension, setExtension] = useState(initialData?.extension || 'txt');
  const [scope, setScope] = useState<'global' | 'local'>(initialData?.scope || 'global');
  const [engine, setEngine] = useState<TemplateEngine>(initialData?.engine || 'jinja');

  useEffect(() => {
    if (isOpen) {
      setName(initialData?.name || 'New Template');
      setSuffix(initialData?.suffix || '');
      setExtension(initialData?.extension || 'txt');
      setScope(initialData?.scope || 'global');
      setEngine(initialData?.engine || 'jinja');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalHeader
        onClose={onClose}
        icon={<Save size={20} className="text-primary-base" />}
        title={initialData ? 'Copy Template' : 'New Template'}
      />
      <ModalContent className="space-y-4 p-4">
        <div className="space-y-1">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex gap-4">
          <div className="space-y-1 flex-1">
            <Label>Suffix</Label>
            <Input value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="_custom" />
          </div>
          <div className="space-y-1 flex-1">
            <Label>Extension</Label>
            <Input value={extension} onChange={(e) => setExtension(e.target.value)} placeholder="txt" />
          </div>
        </div>
        {!initialData && (
          <div className="space-y-1">
            <Label htmlFor="new-template-engine">Template Engine</Label>
            <Select
              id="new-template-engine"
              aria-label="Template Engine"
              value={engine}
              onChange={(e) => setEngine(e.target.value as TemplateEngine)}
            >
              <option value="jinja">Jinja (if/for, arithmetic, filters)</option>
              <option value="handlebars">Handlebars ({'{{#each}}'})</option>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label>Scope</Label>
          <Select value={scope} onChange={(e) => setScope(e.target.value as any)}>
            <option value="global">Global (Available in all projects)</option>
            <option value="local">Local (This project only)</option>
          </Select>
          <p className="text-[10px] text-text-muted mt-1">
            Once created, the scope cannot be directly changed. You can copy the template later if needed.
          </p>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} className="text-text-muted">
          Cancel
        </Button>
        <Button onClick={() => onSubmit({ name, suffix, extension, scope, engine })} className="bg-primary-base">
          Save
        </Button>
      </ModalFooter>
    </Modal>
  );
}

export function ExportTemplatesTab() {
  const globalOptionsSchema = useAppStore((state) => state.optionsSchema);
  const globalExportTemplates = useAppStore((state) => state.exportTemplates);
  const addExportTemplate = useAppStore((state) => state.addExportTemplate);
  const updateExportTemplate = useAppStore((state) => state.updateExportTemplate);
  const removeExportTemplate = useAppStore((state) => state.removeExportTemplate);
  const defaultExportFormats = useAppStore((state) => state.defaultExportFormats);
  const updateDefaultExportFormat = useAppStore((state) => state.updateDefaultExportFormat);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialData, setModalInitialData] = useState<any>(null);
  const [modalSourceContent, setModalSourceContent] = useState<string>('');

  const setImportModalOpen = useAppStore((state) => state.setImportModalOpen);

  const handleCreateOrCopy = (data: {
    name: string;
    suffix: string;
    extension: string;
    scope: 'global' | 'local';
    engine: TemplateEngine;
  }) => {
    addExportTemplate({
      id: uuidv4(),
      name: data.name,
      extension: data.extension,
      suffix: data.suffix,
      scope: data.scope,
      engine: data.engine,
      content: modalSourceContent || DEFAULT_TEMPLATE_CONTENT[data.engine],
    });
    setIsModalOpen(false);
  };

  const openNewModal = () => {
    setModalInitialData(null);
    setModalSourceContent('');
    setIsModalOpen(true);
  };

  const openCopyModal = (template: ExportTemplate) => {
    setModalInitialData({
      name: `Copy of ${template.name}`,
      suffix: template.suffix,
      extension: template.extension,
      scope: template.scope || 'global',
      // コピー元のエンジンをそのまま引き継ぐ（コピーなので記法を変えない）。
      engine: template.engine || 'handlebars',
    });
    setModalSourceContent(template.content);
    setIsModalOpen(true);
  };

  const handleExportTemplate = async (template: ExportTemplate) => {
    try {
      const { DialogAPI, BackendAPI } = await import('../../../api');
      const safeName = template.name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'template';
      const savePath = await DialogAPI.save({
        defaultPath: `${safeName}.wpt_template`,
        filters: [{ name: 'Waypoint Export Template', extensions: ['wpt_template'] }],
      });
      if (!savePath) return;

      const dataToExport = {
        name: template.name,
        extension: template.extension,
        suffix: template.suffix || '',
        content: template.content,
        engine: template.engine,
      };

      await BackendAPI.writeTextFile(savePath, JSON.stringify(dataToExport, null, 2));
      void notify('テンプレートをエクスポートしました。');
    } catch (err) {
      console.error('Failed to export template:', err);
      void notify(`エクスポートに失敗しました。\n詳細: ${String(err)}`);
    }
  };

  const handleImportTemplate = () => setImportModalOpen(true, 'template');

  const insertTemplateVar = (templateId: string, text: string) => {
    const el = document.getElementById(`template-${templateId}`) as HTMLTextAreaElement;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const template = globalExportTemplates.find((t) => t.id === templateId);
      if (template) {
        const newContent = template.content.substring(0, start) + text + template.content.substring(end);
        updateExportTemplate(templateId, { content: newContent });
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(start + text.length, start + text.length);
        }, 10);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <TabSectionHeader
        title="Custom Export Templates"
        subtitle="Define Handlebars templates for custom waypoint export formats."
        icon={FileCode}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={handleImportTemplate}>
              <Upload size={14} className="mr-1" /> Import
            </Button>
            <Button variant="secondary" size="sm" onClick={openNewModal}>
              <Plus size={14} className="mr-1" /> New Template
            </Button>
          </>
        }
      />

      {/* Export Configuration Info Card */}
      <div className="bg-primary-base/5 border border-primary-base/25 rounded-xl p-4 flex items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-primary-base">エクスポート構成（プロファイル）の設定について</span>
          </div>
          <p className="text-xs text-text-muted">
            どのテンプレートやマップを、どのフォルダ階層（例:{' '}
            <code>waypoints/&#123;&#123;yyyymmdd&#125;&#125;_waypoints.yaml</code>
            ）や名称・変数で出力するかという構成設定は、エクスポート画面で直接設定・編集・保存できます。
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            useAppStore.setState({ isExportModalOpen: true });
          }}
          className="shrink-0 text-xs flex items-center gap-1.5"
        >
          <FolderOpen size={14} className="text-primary-base" />
          エクスポート画面を開く
        </Button>
      </div>

      <div className="space-y-3">
        <SectionDivider title="Default Formats" />
        <div className="grid gap-3">
          {defaultExportFormats.map((format) => (
            <div
              key={format.id}
              className="bg-surface-panel/30 rounded-xl border border-border-base/30 flex items-center justify-between p-4 px-5 hover:border-border-base/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-text-base">{format.name}</span>
                <span className="text-[10px] bg-surface-base/50 px-2 py-0.5 rounded-full border border-border-base/50 text-text-muted font-mono">
                  .{format.extension}
                </span>
              </div>
              <div className="flex items-center gap-6">
                <InlineFieldRow label="Suffix">
                  <Input
                    type="text"
                    value={format.suffix}
                    onChange={(e) =>
                      updateDefaultExportFormat(format.id, {
                        suffix: e.target.value,
                      } as any)
                    }
                    className="h-8 text-[11px] w-28 font-mono"
                    placeholder="_yaml"
                  />
                </InlineFieldRow>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AlertBox variant="info" title="Template Engines">
        <span className="font-bold text-primary-base">Jinja</span> (recommended for new templates) supports{' '}
        <code className="bg-surface-base/50 px-1 py-0.5 rounded font-mono">{'{% for wp in waypoints %}'}</code>,{' '}
        <code className="bg-surface-base/50 px-1 py-0.5 rounded font-mono">{'{% if %}'}</code>, arithmetic and filters
        such as <code className="bg-surface-base/50 px-1 py-0.5 rounded font-mono">tojson</code> /{' '}
        <code className="bg-surface-base/50 px-1 py-0.5 rounded font-mono">toyaml</code>.{' '}
        <span className="font-bold">Handlebars</span> templates keep working with{' '}
        <code className="bg-surface-base/50 px-1 py-0.5 rounded font-mono">{'{{#each waypoints}}'}</code> for backward
        compatibility.
      </AlertBox>

      <div className="space-y-5">
        <SectionDivider title="Custom Templates" />
        {globalExportTemplates.map((template) => (
          <div
            key={template.id}
            className="bg-surface-panel/40 rounded-xl border border-border-base/30 flex flex-col overflow-hidden shadow-subtle hover:border-border-base/60 transition-all group"
          >
            <div className="flex items-center gap-3 p-3 px-4 border-b border-border-base/30 bg-surface-base/30">
              <Input
                type="text"
                value={template.name}
                onChange={(e) =>
                  updateExportTemplate(template.id, {
                    name: e.target.value,
                  } as any)
                }
                className="h-8 text-[13px] font-medium flex-1 border-transparent hover:border-border-base focus:border-primary-base bg-transparent focus:bg-surface-base shadow-none hover:shadow-subtle"
                placeholder="Template Name"
              />
              <div className="flex items-center gap-4">
                <InlineFieldRow label="Suffix">
                  <Input
                    type="text"
                    value={template.suffix || ''}
                    onChange={(e) =>
                      updateExportTemplate(template.id, {
                        suffix: e.target.value,
                      } as any)
                    }
                    className="h-8 text-[11px] w-24 font-mono"
                    placeholder="_custom"
                  />
                </InlineFieldRow>
                <InlineFieldRow label="Ext">
                  <Input
                    type="text"
                    value={template.extension}
                    onChange={(e) =>
                      updateExportTemplate(template.id, {
                        extension: e.target.value,
                      } as any)
                    }
                    className="h-8 text-[11px] w-16 font-mono"
                    placeholder="yaml"
                  />
                </InlineFieldRow>
                <InlineFieldRow label="Engine">
                  <Select
                    value={template.engine || 'handlebars'}
                    onChange={(e) => updateExportTemplate(template.id, { engine: e.target.value as TemplateEngine })}
                    className="h-8 text-[11px] w-28"
                  >
                    <option value="jinja">Jinja</option>
                    <option value="handlebars">Handlebars</option>
                  </Select>
                </InlineFieldRow>
                <div className="flex items-center gap-1 bg-surface-base px-2 py-1 rounded border border-border-base/50 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  {template.scope === 'local' ? '[Local]' : '[Global]'}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openCopyModal(template)}
                  className="h-8 w-8 text-text-muted hover:text-primary-base hover:bg-primary-base/10"
                  title="Copy Template"
                >
                  <Copy size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleExportTemplate(template)}
                  className="h-8 w-8 text-text-muted hover:text-primary-base hover:bg-primary-base/10"
                  title="Export Template"
                >
                  <Download size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeExportTemplate(template.id)}
                  className="h-8 w-8 text-text-muted hover:text-danger-base hover:bg-danger-base/10"
                  title="Delete Template"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
            <div className="p-4 space-y-4 bg-surface-base/10">
              <textarea
                id={`template-${template.id}`}
                value={template.content}
                onChange={(e) =>
                  updateExportTemplate(template.id, {
                    content: e.target.value,
                  })
                }
                className="w-full h-48 bg-surface-base/50 border border-border-base/50 rounded-lg p-4 text-[11px] font-mono text-text-base focus:ring-2 focus:ring-primary-base/20 focus:border-primary-base outline-none transition-all resize-none shadow-inner"
                placeholder={
                  (template.engine || 'handlebars') === 'jinja'
                    ? '{% for wp in waypoints %}...{% endfor %}'
                    : '{{#each waypoints}}...'
                }
                spellCheck="false"
              />
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5 items-center">
                  <FieldLabel className="mr-2">Core Fields</FieldLabel>
                  {coreFieldChips(template.engine || 'handlebars').map((v) => (
                    <button
                      key={v}
                      onClick={() => insertTemplateVar(template.id, v)}
                      className="bg-surface-base hover:bg-surface-hover hover:scale-105 active:scale-95 px-2 py-1 rounded-md text-[10px] font-mono text-primary-base border border-border-base/50 transition-all font-bold shadow-sm"
                    >
                      {v}
                    </button>
                  ))}
                </div>
                {globalOptionsSchema && globalOptionsSchema.globals.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center pt-1 border-t border-border-base/20">
                    <FieldLabel className="mr-2">Global Fields</FieldLabel>
                    {globalOptionsSchema.globals.map((g) => {
                      const chip = globalFieldChip(template.engine || 'handlebars', g.name);
                      return (
                        <button
                          key={g.name}
                          onClick={() => insertTemplateVar(template.id, chip)}
                          className="bg-surface-base hover:bg-surface-hover hover:scale-105 active:scale-95 px-2 py-1 rounded-md text-[10px] font-mono text-accent-automation border border-border-base/50 transition-all font-bold shadow-sm"
                        >
                          {chip}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 items-center pt-1 border-t border-border-base/20">
                  <FieldLabel
                    className="mr-2"
                    title="位置合わせ後のマップ原点（ワールド座標 (0,0)）の緯度経度・UTM。heading はワールド X 軸が東から反時計回りに何度回っているか"
                  >
                    Geo Origin
                  </FieldLabel>
                  {geoFieldChips(template.engine || 'handlebars').map((chip) => (
                    <button
                      key={chip}
                      onClick={() => insertTemplateVar(template.id, chip)}
                      className="bg-surface-base hover:bg-surface-hover hover:scale-105 active:scale-95 px-2 py-1 rounded-md text-[10px] font-mono text-accent-automation border border-border-base/50 transition-all font-bold shadow-sm"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                {globalOptionsSchema?.options && globalOptionsSchema.options.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center pt-1 border-t border-border-base/20">
                    <FieldLabel className="mr-2">Custom Options</FieldLabel>
                    {globalOptionsSchema.options.map((o) => {
                      const chip = optionChip(template.engine || 'handlebars', o.name);
                      return (
                        <button
                          key={o.name}
                          onClick={() => insertTemplateVar(template.id, chip)}
                          className="bg-surface-base hover:bg-surface-hover hover:scale-105 active:scale-95 px-2 py-1 rounded-md text-[10px] font-mono text-accent-automation border border-border-base/50 transition-all font-bold shadow-sm"
                        >
                          {chip}
                        </button>
                      );
                    })}
                  </div>
                )}
                {globalOptionsSchema?.options && globalOptionsSchema.options.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center pt-1 border-t border-border-base/20">
                    <FieldLabel className="mr-2" title="値を明示的に入力したフィールドのみ（未設定は含まない）">
                      Raw Options
                    </FieldLabel>
                    {globalOptionsSchema.options.map((o) => {
                      const chip = rawOptionChip(template.engine || 'handlebars', o.name);
                      return (
                        <button
                          key={o.name}
                          onClick={() => insertTemplateVar(template.id, chip)}
                          className="bg-surface-base hover:bg-surface-hover hover:scale-105 active:scale-95 px-2 py-1 rounded-md text-[10px] font-mono text-text-muted border border-border-base/50 transition-all font-bold shadow-sm"
                        >
                          {chip}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {globalExportTemplates.length === 0 && (
          <EmptyState message="No custom templates defined. Click 'New Template' to start." />
        )}
      </div>
      <TemplateCreateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateOrCopy}
        initialData={modalInitialData}
      />
    </div>
  );
}
