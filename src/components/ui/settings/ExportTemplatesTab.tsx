import { Plus, Trash2, Copy, Save, Upload, Download } from "lucide-react";
import { useAppStore } from "../../../stores/appStore";
import { v4 as uuidv4 } from "uuid";
import { Button } from "../common/Button";
import { Input } from "../common/Input";
import { Modal, ModalHeader, ModalContent, ModalFooter } from "../common/Modal";
import { Label } from "../common/Label";
import { Select } from "../common/Select";
import { useState, useEffect } from "react";
import { ExportTemplate } from "../../../types/store";
import { TabSectionHeader } from "./TabSectionHeader";
import { EmptyState } from "../common/EmptyState";
import { SectionDivider } from "../common/SectionDivider";
import { InlineFieldRow } from "../common/InlineFieldRow";
import { FieldLabel } from "../common/FieldLabel";
import { AlertBox } from "../common/AlertBox";

function TemplateCreateModal({
  isOpen, onClose, onSubmit, initialData
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; suffix: string; extension: string; scope: 'global' | 'local' }) => void;
  initialData?: { name: string; suffix: string; extension: string; scope: 'global' | 'local' };
}) {
  const [name, setName] = useState(initialData?.name || "New Template");
  const [suffix, setSuffix] = useState(initialData?.suffix || "");
  const [extension, setExtension] = useState(initialData?.extension || "txt");
  const [scope, setScope] = useState<'global'|'local'>(initialData?.scope || 'global');

  useEffect(() => {
    if (isOpen) {
      setName(initialData?.name || "New Template");
      setSuffix(initialData?.suffix || "");
      setExtension(initialData?.extension || "txt");
      setScope(initialData?.scope || 'global');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalHeader
        onClose={onClose}
        icon={<Save size={20} className="text-primary-base" />}
        title={initialData ? "Copy Template" : "New Template"}
      />
      <ModalContent className="space-y-4 p-4">
        <div className="space-y-1">
          <Label>Name</Label>
          <Input value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="flex gap-4">
          <div className="space-y-1 flex-1">
            <Label>Suffix</Label>
            <Input value={suffix} onChange={e => setSuffix(e.target.value)} placeholder="_custom" />
          </div>
          <div className="space-y-1 flex-1">
            <Label>Extension</Label>
            <Input value={extension} onChange={e => setExtension(e.target.value)} placeholder="txt" />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Scope</Label>
          <Select value={scope} onChange={e => setScope(e.target.value as any)}>
            <option value="global">Global (Available in all projects)</option>
            <option value="local">Local (This project only)</option>
          </Select>
          <p className="text-[10px] text-text-muted mt-1">Once created, the scope cannot be directly changed. You can copy the template later if needed.</p>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} className="text-text-muted">Cancel</Button>
        <Button onClick={() => onSubmit({ name, suffix, extension, scope })} className="bg-primary-base">Save</Button>
      </ModalFooter>
    </Modal>
  );
}

function TemplateImportModal({
  isOpen,
  onClose,
  onSubmit,
  importData,
  existingTemplate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; suffix: string; extension: string; scope: 'global' | 'local'; action: 'add' | 'overwrite' }) => void;
  importData: { name: string; suffix?: string; extension: string; content: string } | null;
  existingTemplate?: ExportTemplate;
}) {
  const [name, setName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [extension, setExtension] = useState("");
  const [scope, setScope] = useState<'global' | 'local'>('global');
  const [action, setAction] = useState<'add' | 'overwrite'>('add');

  useEffect(() => {
    if (isOpen && importData) {
      setName(importData.name || "Imported Template");
      setSuffix(importData.suffix || "");
      setExtension(importData.extension || "txt");
      setScope('global');
      setAction(existingTemplate ? 'overwrite' : 'add');
    }
  }, [isOpen, importData, existingTemplate]);

  if (!isOpen || !importData) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalHeader
        onClose={onClose}
        icon={<Upload size={20} className="text-primary-base" />}
        title="Import Export Template"
      />
      <ModalContent className="space-y-4 p-4">
        {existingTemplate && (
          <AlertBox variant="warning" title={`A template with the name "${importData.name}" already exists.`}>
            <div className="space-y-1 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importAction"
                  checked={action === 'overwrite'}
                  onChange={() => setAction('overwrite')}
                />
                <span>Overwrite existing template</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importAction"
                  checked={action === 'add'}
                  onChange={() => {
                    setAction('add');
                    setName(`${importData.name} (Imported)`);
                  }}
                />
                <span>Add as a new template</span>
              </label>
            </div>
          </AlertBox>
        )}
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
        <div className="space-y-1">
          <Label>Target Scope</Label>
          <Select value={scope} onChange={(e) => setScope(e.target.value as any)}>
            <option value="global">Global (Available in all projects)</option>
            <option value="local">Local (This project only)</option>
          </Select>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} className="text-text-muted">Cancel</Button>
        <Button onClick={() => onSubmit({ name, suffix, extension, scope, action })} className="bg-primary-base">Import</Button>
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
  const updateDefaultExportFormat = useAppStore(
    (state) => state.updateDefaultExportFormat,
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialData, setModalInitialData] = useState<any>(null);
  const [modalSourceContent, setModalSourceContent] = useState<string>("");

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importData, setImportData] = useState<any>(null);
  const [existingImportTemplate, setExistingImportTemplate] = useState<ExportTemplate | undefined>(undefined);

  const handleCreateOrCopy = (data: { name: string; suffix: string; extension: string; scope: 'global' | 'local' }) => {
    addExportTemplate({
      id: uuidv4(),
      name: data.name,
      extension: data.extension,
      suffix: data.suffix,
      scope: data.scope,
      content: modalSourceContent || "{{#each waypoints}}\nwp_{{index}}:\n  x: {{x}}\n  y: {{y}}\n  yaw: {{yaw}}\n{{/each}}"
    });
    setIsModalOpen(false);
  };

  const openNewModal = () => {
    setModalInitialData(null);
    setModalSourceContent("");
    setIsModalOpen(true);
  };

  const openCopyModal = (template: any) => {
    setModalInitialData({
      name: `Copy of ${template.name}`,
      suffix: template.suffix,
      extension: template.extension,
      scope: template.scope || 'global'
    });
    setModalSourceContent(template.content);
    setIsModalOpen(true);
  };

  const handleExportTemplate = async (template: ExportTemplate) => {
    try {
      const { DialogAPI, BackendAPI } = await import("../../../api");
      const safeName = template.name.replace(/[^a-zA-Z0-9_\-]/g, "_") || "template";
      const savePath = await DialogAPI.save({
        defaultPath: `${safeName}.wpt_template`,
        filters: [{ name: "Waypoint Export Template", extensions: ["wpt_template"] }],
      });
      if (!savePath) return;

      const dataToExport = {
        name: template.name,
        extension: template.extension,
        suffix: template.suffix || "",
        content: template.content,
      };

      await BackendAPI.writeTextFile(savePath, JSON.stringify(dataToExport, null, 2));
      alert("テンプレートをエクスポートしました。");
    } catch (err) {
      console.error("Failed to export template:", err);
      alert(`エクスポートに失敗しました。\n詳細: ${String(err)}`);
    }
  };

  const handleImportTemplate = async () => {
    try {
      const { DialogAPI, BackendAPI } = await import("../../../api");
      const selectedPath = await DialogAPI.open({
        multiple: false,
        filters: [{ name: "Waypoint Export Template", extensions: ["wpt_template"] }],
      });
      if (!selectedPath) return;

      const pathStr = typeof selectedPath === "string" ? selectedPath : (selectedPath as any).path;
      if (!pathStr) return;

      const fileContent = await BackendAPI.readTextFile(pathStr);
      let parsed: any;
      try {
        parsed = JSON.parse(fileContent);
      } catch {
        alert("ファイルの形式が不正です（JSONではありません）。");
        return;
      }

      if (!parsed || typeof parsed !== "object" || !parsed.name || !parsed.extension || typeof parsed.content !== "string") {
        alert("有効な Waypoint テンプレートファイルではありません。");
        return;
      }

      const existing = globalExportTemplates.find((t) => t.name === parsed.name);
      setImportData(parsed);
      setExistingImportTemplate(existing);
      setIsImportModalOpen(true);
    } catch (err) {
      console.error("Failed to import template:", err);
      alert(`インポートに失敗しました。\n詳細: ${String(err)}`);
    }
  };

  const handleImportSubmit = (data: { name: string; suffix: string; extension: string; scope: 'global' | 'local'; action: 'add' | 'overwrite' }) => {
    if (!importData) return;

    if (data.action === 'overwrite' && existingImportTemplate) {
      updateExportTemplate(existingImportTemplate.id, {
        name: data.name,
        suffix: data.suffix,
        extension: data.extension,
        scope: data.scope,
        content: importData.content,
      });
    } else {
      addExportTemplate({
        id: uuidv4(),
        name: data.name,
        suffix: data.suffix,
        extension: data.extension,
        scope: data.scope,
        content: importData.content,
      });
    }

    setIsImportModalOpen(false);
    alert("テンプレートのインポートが完了しました。");
  };

  const insertTemplateVar = (templateId: string, text: string) => {
    const el = document.getElementById(
      `template-${templateId}`,
    ) as HTMLTextAreaElement;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const template = globalExportTemplates.find((t) => t.id === templateId);
      if (template) {
        const newContent =
          template.content.substring(0, start) +
          text +
          template.content.substring(end);
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
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleImportTemplate}
            >
              <Upload size={14} className="mr-1" /> Import
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={openNewModal}
            >
              <Plus size={14} className="mr-1" /> New Template
            </Button>
          </>
        }
      />

      <div className="space-y-3">
        <SectionDivider title="Default Formats" />
        <div className="grid gap-3">
          {defaultExportFormats.map((format) => (
            <div
              key={format.id}
              className="bg-surface-panel/30 rounded-xl border border-border-base/30 flex items-center justify-between p-4 px-5 hover:border-border-base/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-text-base">
                  {format.name}
                </span>
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

      <AlertBox variant="info" title="Handlebars Iteration Syntax">
        Wrap your logic inside{" "}
        <code className="bg-surface-base/50 text-primary-base px-1.5 py-0.5 rounded border border-primary-base/20 font-mono font-bold">
          {"{{#each waypoints}}"} ... {"{{/each}}"}
        </code>{" "}
        to render all elements.
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
                className="h-9 text-sm font-semibold flex-1 border-transparent hover:border-border-base focus:border-primary-base bg-transparent focus:bg-surface-base shadow-none hover:shadow-subtle"
                placeholder="Template Name"
              />
              <div className="flex items-center gap-4">
                <InlineFieldRow label="Suffix">
                  <Input
                    type="text"
                    value={template.suffix || ""}
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
                placeholder="{{#each waypoints}}..."
                spellCheck="false"
              />
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5 items-center">
                  <FieldLabel className="mr-2">Core Fields</FieldLabel>
                  {[
                    "{{index}}",
                    "{{id}}",
                    "{{type}}",
                    "{{x}}",
                    "{{y}}",
                    "{{z}}",
                    "{{yaw}}",
                    "{{qx}}",
                    "{{qy}}",
                    "{{qz}}",
                    "{{qw}}",
                  ].map((v) => (
                    <button
                      key={v}
                      onClick={() => insertTemplateVar(template.id, v)}
                      className="bg-surface-base hover:bg-surface-hover hover:scale-105 active:scale-95 px-2 py-1 rounded-md text-[10px] font-mono text-primary-base border border-border-base/50 transition-all font-bold shadow-sm"
                    >
                      {v}
                    </button>
                  ))}
                </div>
                {globalOptionsSchema?.options &&
                  globalOptionsSchema.options.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 items-center pt-1 border-t border-border-base/20">
                      <FieldLabel className="mr-2">Custom Options</FieldLabel>
                      {globalOptionsSchema.options.map((o) => (
                        <button
                          key={o.name}
                          onClick={() =>
                            insertTemplateVar(
                              template.id,
                              `{{options.${o.name}}}`,
                            )
                          }
                          className="bg-surface-base hover:bg-surface-hover hover:scale-105 active:scale-95 px-2 py-1 rounded-md text-[10px] font-mono text-accent-automation border border-border-base/50 transition-all font-bold shadow-sm"
                        >
                          {`{{options.${o.name}}}`}
                        </button>
                      ))}
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
      <TemplateImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSubmit={handleImportSubmit}
        importData={importData}
        existingTemplate={existingImportTemplate}
      />
    </div>
  );
}
