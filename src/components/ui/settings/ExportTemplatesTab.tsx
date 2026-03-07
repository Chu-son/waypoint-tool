import { Plus, Trash2 } from "lucide-react";
import { useAppStore } from "../../../stores/appStore";
import { v4 as uuidv4 } from "uuid";

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-md font-bold text-slate-200">
            Custom Export Templates
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Define Handlebars templates for custom waypoint export formats.
          </p>
        </div>
        <button
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
          className="ui-btn ui-btn-secondary ui-btn-sm"
        >
          <Plus size={14} /> New Template
        </button>
      </div>

      <div className="space-y-4">
        <h4 className="font-bold text-slate-200 text-sm border-b border-slate-700 pb-1">
          Default Formats
        </h4>
        {defaultExportFormats.map((format) => (
          <div
            key={format.id}
            className="bg-slate-900 rounded-lg border border-slate-700/50 flex items-center justify-between p-3"
          >
            <div className="flex items-center gap-3 w-1/2">
              <span className="text-sm font-bold text-slate-200">
                {format.name}
              </span>
            </div>
            <div className="flex items-center gap-4 w-1/2 justify-end">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">
                  Auto-Suffix :
                </span>
                <input
                  type="text"
                  value={format.suffix}
                  onChange={(e) =>
                    updateDefaultExportFormat(format.id, {
                      suffix: e.target.value,
                    } as any)
                  }
                  className="ui-input w-24"
                  placeholder="_yaml"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">
                  Ext :
                </span>
                <span className="w-16 text-slate-300 text-sm">
                  .{format.extension}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-700/50 p-3 rounded-lg text-xs text-slate-300 mt-6 mt-4">
        <h4 className="font-bold text-slate-200 mb-1">
          Handlebars Iteration Syntax
        </h4>
        <p>
          Wrap your logic inside{" "}
          <code className="bg-slate-800 text-primary px-1 rounded">
            {"{{#each waypoints}}"} ... {"{{/each}}"}
          </code>{" "}
          to render all elements.
        </p>
      </div>

      <div className="space-y-4">
        {globalExportTemplates.map((template) => (
          <div
            key={template.id}
            className="bg-slate-900 rounded-lg border border-slate-700/50 flex flex-col overflow-hidden"
          >
            <div className="flex items-center gap-3 p-3 border-b border-slate-800 bg-slate-800/30">
              <input
                type="text"
                value={template.name}
                onChange={(e) =>
                  updateExportTemplate(template.id, {
                    name: e.target.value,
                  } as any)
                }
                className="ui-input"
                placeholder="Template Name"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">
                  Auto-Suffix:
                </span>
                <input
                  type="text"
                  value={template.suffix || ""}
                  onChange={(e) =>
                    updateExportTemplate(template.id, {
                      suffix: e.target.value,
                    } as any)
                  }
                  className="ui-input w-24"
                  placeholder="_custom"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">
                  Ext:
                </span>
                <input
                  type="text"
                  value={template.extension}
                  onChange={(e) =>
                    updateExportTemplate(template.id, {
                      extension: e.target.value,
                    } as any)
                  }
                  className="ui-input w-16"
                  placeholder="yaml"
                />
              </div>
              <button
                onClick={() => removeExportTemplate(template.id)}
                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors ml-2"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="p-3">
              <textarea
                id={`template-${template.id}`}
                value={template.content}
                onChange={(e) =>
                  updateExportTemplate(template.id, {
                    content: e.target.value,
                  })
                }
                className="ui-textarea h-40 bg-slate-950 border-slate-800 p-3 text-xs font-mono text-slate-300 focus:border-primary/50"
                placeholder="{{#each waypoints}}..."
                spellCheck="false"
              />
              <div className="mt-2 flex flex-wrap gap-1 items-center">
                <span className="text-xs font-bold text-slate-500 mr-2">
                  Core:
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
                    className="bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono text-blue-300 border border-slate-700 transition-colors"
                  >
                    {v}
                  </button>
                ))}
              </div>
              {globalOptionsSchema?.options &&
                globalOptionsSchema.options.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1 items-center">
                    <span className="text-xs font-bold text-slate-500 mr-2">
                      Options ({globalOptionsSchema.options.length}):
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
                        className="bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono text-purple-300 border border-slate-700 transition-colors"
                      >
                        {`{{options.${o.name}}}`}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          </div>
        ))}
        {globalExportTemplates.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm bg-slate-900 rounded-lg border border-dashed border-slate-700">
            No custom templates defined.
          </div>
        )}
      </div>
    </div>
  );
}
