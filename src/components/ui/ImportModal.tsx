import { FolderOpen, Upload, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { BackendAPI, DialogAPI } from "../../api";
import { Modal, ModalHeader, ModalContent, ModalFooter } from "./common/Modal";
import { Button } from "./common/Button";
import { Checkbox } from "./common/Checkbox";
import { Label } from "./common/Label";
import { Input } from "./common/Input";
import { Select } from "./common/Select";
import { ExportTemplate, ImportFieldMapping } from "../../types/store";
import { buildWaypointsFromImport, DEFAULT_IMPORT_MAPPING } from "../../utils/importUtils";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PreviewState = {
  count: number;
  errors: string[];
} | null;

const MAPPING_FIELDS: { key: keyof ImportFieldMapping; label: string; hint: string }[] = [
  { key: "itemsPath", label: "Items Path", hint: "e.g. poses (leave empty if root is the array)" },
  { key: "x", label: "X", hint: "e.g. x or position.x" },
  { key: "y", label: "Y", hint: "e.g. y or position.y" },
  { key: "z", label: "Z", hint: "e.g. z or position.z" },
  { key: "yaw", label: "Yaw", hint: "leave empty to use quaternion fields instead" },
  { key: "qx", label: "Quaternion X", hint: "used only when Yaw is empty" },
  { key: "qy", label: "Quaternion Y", hint: "used only when Yaw is empty" },
  { key: "qz", label: "Quaternion Z", hint: "used only when Yaw is empty" },
  { key: "qw", label: "Quaternion W", hint: "used only when Yaw is empty" },
  { key: "optionsPath", label: "Options Path", hint: "only needed if the template outputs per-waypoint custom properties (e.g. options); leave empty otherwise" },
];

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const exportTemplates = useAppStore((state) => state.exportTemplates);
  const lastDirectory = useAppStore((state) => state.lastDirectory);
  const setLastDirectory = useAppStore((state) => state.setLastDirectory);
  const optionsSchema = useAppStore((state) => state.optionsSchema);
  const addNode = useAppStore((state) => state.addNode);

  const [filePath, setFilePath] = useState<string | null>(null);
  const [formatId, setFormatId] = useState<string>("__default_yaml__");
  const [applyOptionsSchema, setApplyOptionsSchema] = useState(true);
  const [mapping, setMapping] = useState<ImportFieldMapping>(DEFAULT_IMPORT_MAPPING);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>(null);
  const [isBusy, setIsBusy] = useState(false);

  const selectedTemplate = useMemo(
    () => exportTemplates.find((t) => t.id === formatId),
    [exportTemplates, formatId],
  );
  const isCustomTemplate = !!selectedTemplate;

  if (!isOpen) return null;

  const autoDetectMapping = async (t: ExportTemplate) => {
    setMappingError(null);
    try {
      setIsBusy(true);
      const detected = await BackendAPI.inferImportMapping(t.content);
      setMapping(detected);
    } catch (err) {
      setMappingError(String(err));
      setMapping(DEFAULT_IMPORT_MAPPING);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSelectFormat = async (id: string) => {
    setFormatId(id);
    setPreview(null);
    setMappingError(null);
    const t = exportTemplates.find((x) => x.id === id);
    if (!t) return;
    if (t.importMapping) {
      setMapping(t.importMapping);
    } else {
      await autoDetectMapping(t);
    }
  };

  const handleSelectFile = async () => {
    const selected = await DialogAPI.open({
      multiple: false,
      defaultPath: lastDirectory || undefined,
      filters: [{ name: "Waypoint File", extensions: ["yaml", "yml", "json"] }],
    });
    if (selected) {
      const pathStr = typeof selected === "string" ? selected : (selected as any).path;
      if (!pathStr) return;
      setFilePath(pathStr);
      setPreview(null);
      const lastSlash = Math.max(pathStr.lastIndexOf("/"), pathStr.lastIndexOf("\\"));
      if (lastSlash > -1) setLastDirectory(pathStr.substring(0, lastSlash));
    }
  };

  const runParse = async () => {
    if (!filePath) {
      alert("インポートするファイルを選択してください。");
      return null;
    }
    try {
      setIsBusy(true);
      const raw = await BackendAPI.importWaypointsRaw(filePath);
      const { nodes, errors } = buildWaypointsFromImport(
        raw,
        mapping,
        applyOptionsSchema ? optionsSchema : null,
      );
      return { nodes, errors };
    } catch (err) {
      alert(`ファイルの解析に失敗しました。\nエラー詳細: ${String(err)}`);
      return null;
    } finally {
      setIsBusy(false);
    }
  };

  const handlePreview = async () => {
    const result = await runParse();
    if (!result) return;
    setPreview({ count: result.nodes.length, errors: result.errors });
  };

  const handleImport = async () => {
    const result = await runParse();
    if (!result) return;

    useAppStore.getState().runInHistoryTransaction(() => {
      result.nodes.forEach((node) => addNode(node));
    });

    const errorSummary = result.errors.length > 0 ? `\n(${result.errors.length}件をスキップしました)` : "";
    alert(`${result.nodes.length}件のウェイポイントをインポートしました。${errorSummary}`);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalHeader onClose={onClose}>
        <div className="flex items-center gap-3">
          <Upload size={20} className="text-primary-base" />
          <span>Import Waypoints</span>
        </div>
      </ModalHeader>

      <ModalContent className="p-0">
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <div className="space-y-3">
            <Label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1 block">
              Source File
            </Label>
            <div className="flex items-center gap-3">
              <Input readOnly value={filePath ?? ""} placeholder="No file selected" className="flex-1" />
              <Button variant="ghost" onClick={handleSelectFile} className="shrink-0">
                <FolderOpen size={16} className="mr-2" />
                Browse...
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-bold text-text-muted uppercase tracking-widest ml-1 block">
              File Format / Template
            </Label>
            <Select value={formatId} onChange={(e) => void handleSelectFormat(e.target.value)}>
              {useAppStore
                .getState()
                .defaultExportFormats.filter((f) => f.enabled)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} (.{f.extension})
                  </option>
                ))}
              {exportTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (.{t.extension}) {t.scope === "local" ? "[Local]" : "[Global]"}
                </option>
              ))}
            </Select>
          </div>

          {isCustomTemplate && (
            <div className="space-y-4 bg-surface-base/30 p-4 rounded-xl border border-border-base/40 shadow-inner">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-text-muted uppercase tracking-widest block">
                  Field Mapping
                </Label>
                <Button
                  variant="ghost"
                  onClick={() => selectedTemplate && autoDetectMapping(selectedTemplate)}
                  disabled={isBusy}
                  className="text-[11px] px-3 py-1"
                >
                  <Wand2 size={14} className="mr-1.5" />
                  Auto-detect from Template
                </Button>
              </div>
              {mappingError && (
                <p className="text-[11px] text-danger-base/90 leading-relaxed">{mappingError}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                {MAPPING_FIELDS.map(({ key, label, hint }) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-[11px] text-text-muted">{label}</Label>
                    <Input
                      value={mapping[key] ?? ""}
                      placeholder={hint}
                      onChange={(e) =>
                        setMapping((prev) => ({ ...prev, [key]: e.target.value || undefined }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-border-base/30">
            <label className="flex items-start gap-4 p-4 rounded-xl bg-primary-base/5 border border-primary-base/10 hover:border-primary-base/30 hover:bg-primary-base/[0.08] transition-all cursor-pointer group">
              <div className="pt-1">
                <Checkbox
                  checked={applyOptionsSchema}
                  onChange={(e) => setApplyOptionsSchema(e.target.checked)}
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-text-base group-hover:text-primary-base transition-colors">
                  Apply Custom Option Schema
                </p>
                <p className="text-[11px] text-text-muted/80 leading-relaxed">
                  Coerces option values to the schema's declared types and fills in missing values with their defaults.
                </p>
              </div>
            </label>
          </div>

          {preview && (
            <div className="space-y-2 p-4 rounded-xl bg-surface-panel/40 border border-border-base/20">
              <p className="text-sm font-bold text-text-base">
                {preview.count} waypoint(s) ready to import
              </p>
              {preview.errors.length > 0 && (
                <ul className="text-[11px] text-danger-base/90 list-disc list-inside space-y-0.5">
                  {preview.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </ModalContent>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose} className="px-6 text-text-muted font-bold">
          Cancel
        </Button>
        <Button variant="ghost" onClick={handlePreview} disabled={!filePath || isBusy} className="px-6">
          Preview
        </Button>
        <Button onClick={handleImport} disabled={!filePath || isBusy}>
          Import
        </Button>
      </ModalFooter>
    </Modal>
  );
}
