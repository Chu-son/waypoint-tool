import { Plus, Trash2 } from "lucide-react";
import { useAppStore } from "../../../stores/appStore";
import { v4 as uuidv4 } from "uuid";
import { Button } from "../common/Button";
import { Input } from "../common/Input";

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
      <div className="flex justify-between items-center bg-surface-panel p-4 rounded-xl border border-border-base/50 shadow-sm">
        <div>
          <h3 className="text-lg font-bold text-text-base tracking-tight">
            Custom Export Templates
          </h3>
          <p className="text-xs text-text-muted mt-0.5 font-medium">
            Define Handlebars templates for custom waypoint export formats.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            addExportTemplate({
              id: uuidv4(),
              name: "New Template",
              extension: "txt",
              suffix: "",
              content:
                "{{#each waypoints}}\nwp_{{index}}:\n  x: {{x}}\n  y: {{y}}\n  yaw: {{yaw}}\n{{/each}}",
            })
          }
        >
          <Plus size={14} className="mr-1" /> New Template
        </Button>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1 px-1 flex items-center gap-2">
          <span>Default Formats</span>
          <div className="h-px flex-1 bg-border-base/30" />
        </h4>
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
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-text-muted font-bold uppercase tracking-tight">
                    Suffix
                  </span>
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
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-primary-base/5 border border-primary-base/20 p-4 rounded-xl flex gap-3 items-start animate-in zoom-in-95 duration-500 delay-150">
        <div className="w-8 h-8 rounded-lg bg-primary-base/10 flex items-center justify-center shrink-0">
          <code className="text-primary-base font-bold">#</code>
        </div>
        <div className="text-xs text-text-base leading-relaxed">
          <h4 className="font-bold text-primary-base mb-1">
            Handlebars Iteration Syntax
          </h4>
          <p>
            Wrap your logic inside{" "}
            <code className="bg-surface-base/50 text-primary-base px-1.5 py-0.5 rounded border border-primary-base/20 font-mono font-bold">
              {"{{#each waypoints}}"} ... {"{{/each}}"}
            </code>{" "}
            to render all elements.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider ml-1 px-1 flex items-center gap-2">
          <span>Custom Templates</span>
          <div className="h-px flex-1 bg-border-base/30" />
        </h4>
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
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-tight">Suffix</span>
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
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-tight">Ext</span>
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
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeExportTemplate(template.id)}
                  className="h-8 w-8 text-text-muted hover:text-danger-base hover:bg-danger-base/10"
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
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mr-2">
                    Core Fields
                  </span>
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
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mr-2">
                        Custom Options
                      </span>
                      {globalOptionsSchema.options.map((o) => (
                        <button
                          key={o.name}
                          onClick={() =>
                            insertTemplateVar(
                              template.id,
                              `{{options.${o.name}}}`,
                            )
                          }
                          className="bg-surface-base hover:bg-surface-hover hover:scale-105 active:scale-95 px-2 py-1 rounded-md text-[10px] font-mono text-accent-cyan-400 border border-border-base/50 transition-all font-bold shadow-sm"
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
          <div className="text-center py-12 text-text-muted/60 text-sm bg-surface-panel/30 rounded-2xl border-2 border-dashed border-border-base/50 animate-pulse">
            No custom templates defined. Click "New Template" to start.
          </div>
        )}
      </div>
    </div>
  );
}
