import { useExportPlan } from './useExportPlan';
import {
  Save,
  FolderOpen,
  Plus,
  Copy,
  Trash2,
  FileText,
  Map as MapIcon,
  AlertTriangle,
  Folder,
  Image as ImageIcon,
} from 'lucide-react';
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../common/Modal';
import { Button } from '../common/Button';
import { Checkbox } from '../common/Checkbox';
import { Input } from '../common/Input';
import { Label } from '../common/Label';
import { BrowseInput } from '../common/BrowseInput';
import { cn } from '../../../utils/cn';
import { TreeDirectoryNode, TreeFileNode } from '../../../utils/exportTemplateEngine';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const {
    activeProfile,
    defaultExportFormats,
    exportTemplates,
    conflictFiles,
    exportProfiles,
    exportRegions,
    handleAddItem,
    handleAddProfile,
    handleDeleteItem,
    handleDeleteProfile,
    handleDuplicateProfile,
    handleInsertVariable,
    handlePatternSelect,
    handleRootDirChange,
    handleSaveAndExport,
    handleSaveOnly,
    handleToggleItemEnabled,
    handleUpdateItem,
    inputRef,
    rootDir,
    selectedItem,
    selectedItemId,
    setActiveExportProfileId,
    setSelectedItemId,
    treeNodes,
    updateExportProfile,
  } = useExportPlan({ isOpen, onClose });

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" className="h-[85vh]">
      <ModalHeader
        onClose={onClose}
        icon={<Save size={20} className="text-primary-base" />}
        title="統合エクスポート (Integrated Export)"
      />

      <ModalContent className="p-0 flex flex-col flex-1 overflow-hidden">
        {/* Profile & Root Bar */}
        <div className="p-4 border-b border-border-base/40 bg-surface-base/60 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Label className="text-xs font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">
                プロファイル:
              </Label>
              <select
                value={activeProfile.id}
                onChange={(e) => setActiveExportProfileId(e.target.value)}
                className="h-8 text-xs font-semibold px-2 rounded-md bg-surface-panel border border-border-base/40 text-text-base focus:outline-none focus:border-primary-base"
              >
                {exportProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Input
                value={activeProfile.name}
                onChange={(e) => updateExportProfile(activeProfile.id, { name: e.target.value })}
                placeholder="プロファイル名"
                className="h-8 text-xs w-48 font-medium"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddProfile}
                title="新規プロファイル追加"
                className="h-8 px-2 text-xs flex items-center gap-1 text-text-muted hover:text-text-base"
              >
                <Plus size={14} />
                新規
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDuplicateProfile}
                title="プロファイルを複製"
                className="h-8 px-2 text-xs flex items-center gap-1 text-text-muted hover:text-text-base"
              >
                <Copy size={14} />
                複製
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteProfile}
                title="プロファイルを削除"
                className="h-8 px-2 text-xs flex items-center gap-1 text-text-danger hover:bg-status-danger/10"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </div>

          {/* Root Directory Picker */}
          <div className="flex items-center gap-2">
            <Label className="text-xs font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">
              出力ルート:
            </Label>
            <div className="flex-1">
              <BrowseInput
                value={rootDir}
                onChange={handleRootDirChange}
                placeholder="エクスポート先ルートフォルダを選択..."
                dialogOptions={{ directory: true }}
                size="sm"
              />
            </div>
          </div>
        </div>

        {/* 2-Pane Main Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Pane: Tree View */}
          <div className="w-1/2 border-r border-border-base/40 flex flex-col bg-surface-base/20">
            <div className="p-3 border-b border-border-base/30 flex items-center justify-between bg-surface-panel/40">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <FolderOpen size={14} />
                出力ツリープレビュー (Virtual Directory)
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-6 text-[10px] px-1.5"
                  onClick={() => {
                    const allEnabled = activeProfile.items.every((i) => i.enabled);
                    const updated = activeProfile.items.map((i) => ({
                      ...i,
                      enabled: !allEnabled,
                    }));
                    updateExportProfile(activeProfile.id, { items: updated });
                  }}
                >
                  {activeProfile.items.every((i) => i.enabled) ? '全解除' : '全選択'}
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1 text-xs">
              {activeProfile.items.length === 0 ? (
                <div className="p-6 text-center text-text-muted/60 text-xs">
                  エクスポート項目がありません。下部のボタンから追加してください。
                </div>
              ) : (
                renderTreeNodes(treeNodes, selectedItemId, setSelectedItemId, handleToggleItemEnabled, conflictFiles)
              )}
            </div>

            {/* Add Item Bar */}
            <div className="p-2.5 border-t border-border-base/30 bg-surface-panel/30 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddItem('waypoint_default')}
                className="flex-1 text-xs h-7 flex items-center justify-center gap-1"
              >
                <FileText size={12} className="text-primary-base" />＋ Waypoint出力
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddItem('map_all_regions')}
                className="flex-1 text-xs h-7 flex items-center justify-center gap-1"
              >
                <MapIcon size={12} className="text-accent-generator" />＋ マップ領域出力
              </Button>
            </div>
          </div>

          {/* Right Pane: Item Inspector */}
          <div className="w-1/2 flex flex-col overflow-y-auto p-5 bg-surface-panel/20">
            {selectedItem ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-border-base/30">
                  <div className="flex items-center gap-2">
                    {selectedItem.type.startsWith('map') ? (
                      <MapIcon size={16} className="text-accent-generator" />
                    ) : (
                      <FileText size={16} className="text-primary-base" />
                    )}
                    <span className="font-bold text-sm text-text-base">
                      {selectedItem.type.startsWith('map') ? 'マップ出力設定' : 'ウェイポイント出力設定'}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteItem(selectedItem.id)}
                    className="h-7 text-xs text-text-danger hover:bg-status-danger/10 px-2"
                  >
                    <Trash2 size={13} className="mr-1" />
                    この項目を削除
                  </Button>
                </div>

                {/* Source Selection */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-text-muted">出力ソース (データ元)</Label>
                  {selectedItem.type.startsWith('map') ? (
                    <div className="flex flex-col gap-2">
                      <select
                        value={selectedItem.type === 'map_all_regions' ? '__all__' : selectedItem.sourceId}
                        onChange={(e) => {
                          if (e.target.value === '__all__') {
                            handleUpdateItem(selectedItem.id, {
                              type: 'map_all_regions',
                              sourceId: 'all',
                            });
                          } else {
                            handleUpdateItem(selectedItem.id, {
                              type: 'map_region',
                              sourceId: e.target.value,
                            });
                          }
                        }}
                        className="h-8 text-xs rounded-md bg-surface-base border border-border-base/40 text-text-base px-2"
                      >
                        <option value="__all__">{'全マップ領域を一括出力 ({{name}}置換)'}</option>
                        {exportRegions.map((r) => (
                          <option key={r.id} value={r.id}>
                            マップ領域: {r.name}
                          </option>
                        ))}
                      </select>
                      {exportRegions.length === 0 && (
                        <p className="text-[11px] text-accent-generator/80">
                          ※ マップ領域が未作成です。ツールバーの「Export Region」ツールで領域を作成してください。
                        </p>
                      )}
                    </div>
                  ) : (
                    <select
                      value={
                        selectedItem.type === 'waypoint_template'
                          ? `tmpl:${selectedItem.sourceId}`
                          : `def:${selectedItem.sourceId}`
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.startsWith('tmpl:')) {
                          const id = val.replace('tmpl:', '');
                          handleUpdateItem(selectedItem.id, {
                            type: 'waypoint_template',
                            sourceId: id,
                          });
                        } else {
                          const id = val.replace('def:', '');
                          handleUpdateItem(selectedItem.id, {
                            type: 'waypoint_default',
                            sourceId: id,
                          });
                        }
                      }}
                      className="h-8 text-xs rounded-md bg-surface-base border border-border-base/40 text-text-base px-2"
                    >
                      <optgroup label="標準フォーマット">
                        {defaultExportFormats.map((f) => (
                          <option key={f.id} value={`def:${f.id}`}>
                            {f.name} (.{f.extension})
                          </option>
                        ))}
                      </optgroup>
                      {exportTemplates.length > 0 && (
                        <optgroup label="カスタムテンプレート">
                          {exportTemplates.map((t) => (
                            <option key={t.id} value={`tmpl:${t.id}`}>
                              {t.name} (.{t.extension})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  )}
                </div>

                {/* Relative Path Pattern */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-text-muted">
                    相対出力パスパターン (サブフォルダ/ファイル名)
                  </Label>
                  <Input
                    ref={inputRef}
                    onSelect={handlePatternSelect}
                    value={selectedItem.relativePathPattern}
                    onChange={(e) =>
                      handleUpdateItem(selectedItem.id, {
                        relativePathPattern: e.target.value,
                      })
                    }
                    placeholder="waypoints/{{yyyymmdd}}_waypoints.yaml"
                    className="h-8 text-xs font-mono"
                  />

                  {/* Variable Chips */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-text-muted block">
                        クリックして変数を挿入 (大文字MM=月, 小文字mm=分):
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { var: '{{YYYYMMDD}}', label: '年月日' },
                        { var: '{{HHmmss}}', label: '時分秒' },
                        { var: '{{YYYYMMDD_HHmmss}}', label: '日時一括' },
                        { var: '{{YYYY}}', label: '年' },
                        { var: '{{MM}}', label: '月' },
                        { var: '{{dd}}', label: '日' },
                        { var: '{{HH}}', label: '時' },
                        { var: '{{mm}}', label: '分' },
                        { var: '{{ss}}', label: '秒' },
                        { var: '{{project_name}}', label: 'プロジェクト' },
                        { var: '{{name}}', label: '名称' },
                      ].map((chip) => (
                        <button
                          key={chip.var}
                          type="button"
                          onClick={() => handleInsertVariable(chip.var)}
                          title={`${chip.var} (${chip.label})`}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-panel hover:bg-primary-base/20 border border-border-base/40 hover:border-primary-base/40 text-text-muted hover:text-primary-base transition-colors flex items-center gap-1"
                        >
                          <span>{chip.var}</span>
                          <span className="text-[9px] opacity-60 font-sans">({chip.label})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Map Format Options */}
                {selectedItem.type.startsWith('map') && (
                  <div className="space-y-1.5 pt-2 border-t border-border-base/30">
                    <Label className="text-xs font-bold text-text-muted">マップ出力フォーマット</Label>
                    <div className="flex gap-4 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name={`mapFormat-${selectedItem.id}`}
                          checked={(selectedItem.mapFormat || 'ros_standard') === 'ros_standard'}
                          onChange={() =>
                            handleUpdateItem(selectedItem.id, {
                              mapFormat: 'ros_standard',
                            })
                          }
                          className="accent-primary-base"
                        />
                        ROS Standard (.pgm + .yaml)
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name={`mapFormat-${selectedItem.id}`}
                          checked={selectedItem.mapFormat === 'png_only'}
                          onChange={() =>
                            handleUpdateItem(selectedItem.id, {
                              mapFormat: 'png_only',
                            })
                          }
                          className="accent-primary-base"
                        />
                        Image Only (.png)
                      </label>
                    </div>
                  </div>
                )}

                {/* Waypoint High-Res Image Option */}
                {!selectedItem.type.startsWith('map') && (
                  <div className="pt-2 border-t border-border-base/30">
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <Checkbox
                        checked={selectedItem.includeMapImage || false}
                        onChange={(e) =>
                          handleUpdateItem(selectedItem.id, {
                            includeMapImage: e.target.checked,
                          })
                        }
                      />
                      <span className="font-semibold text-text-base">High-Res Map Shot (.png) を同梱出力</span>
                    </label>
                    <p className="text-[11px] text-text-muted mt-1 ml-6">
                      ウェイポイントが配置されたキャンバス画像（.png）を同名で出力します。
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
                左側のツリーから項目を選択して設定を編集してください。
              </div>
            )}
          </div>
        </div>
      </ModalContent>

      <ModalFooter className="flex items-center justify-between">
        {/* Conflict Resolution Strategy */}
        <div className="flex items-center gap-4 text-xs">
          <span className="font-bold text-text-muted">既存ファイルの競合:</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="conflictResolution"
              checked={activeProfile.conflictResolution === 'backup_file'}
              onChange={() =>
                updateExportProfile(activeProfile.id, {
                  conflictResolution: 'backup_file',
                })
              }
              className="accent-primary-base"
            />
            リネームバックアップ (.bak)
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="conflictResolution"
              checked={activeProfile.conflictResolution === 'overwrite'}
              onChange={() =>
                updateExportProfile(activeProfile.id, {
                  conflictResolution: 'overwrite',
                })
              }
              className="accent-primary-base"
            />
            上書き
          </label>

          {conflictFiles.size > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-status-warning bg-status-warning/10 px-2 py-0.5 rounded border border-status-warning/30">
              <AlertTriangle size={12} />
              {conflictFiles.size} 件の同名ファイルが存在
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onClose} className="px-5 text-text-muted font-bold text-xs">
            キャンセル
          </Button>
          <Button variant="outline" onClick={handleSaveOnly} className="px-4 text-xs font-bold">
            保存のみ
          </Button>
          <Button
            onClick={handleSaveAndExport}
            disabled={activeProfile.items.filter((i) => i.enabled).length === 0}
            className="min-w-36 bg-primary-base hover:bg-primary-hover shadow-lg text-xs font-bold"
          >
            <Save size={14} className="mr-1.5" />
            保存してエクスポート ({activeProfile.items.filter((i) => i.enabled).length}件)
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}

/**
 * ツリーノードの再帰描画
 */
function renderTreeNodes(
  nodes: (TreeDirectoryNode | TreeFileNode)[],
  selectedItemId: string | null,
  onSelectItem: (id: string) => void,
  onToggleEnabled: (id: string, enabled: boolean) => void,
  conflictFiles: Set<string>,
  depth = 0,
) {
  return nodes.map((node) => {
    if (node.type === 'directory') {
      return (
        <div key={node.relativePath} className="space-y-0.5">
          <div
            className="flex items-center gap-1.5 py-1 px-2 rounded hover:bg-surface-panel/50 text-text-muted select-none"
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            <Folder size={14} className="text-primary-base/80" />
            <span className="font-semibold text-text-base">{node.name}/</span>
          </div>
          <div>
            {renderTreeNodes(node.children, selectedItemId, onSelectItem, onToggleEnabled, conflictFiles, depth + 1)}
          </div>
        </div>
      );
    }

    const isConflict = conflictFiles.has(node.fullPath);
    const isSelected = selectedItemId === node.item.id;

    return (
      <div
        key={node.relativePath}
        onClick={() => onSelectItem(node.item.id)}
        className={cn(
          'flex items-center justify-between py-1 px-2 rounded cursor-pointer transition-colors select-none group',
          isSelected
            ? 'bg-primary-base/15 text-primary-base font-semibold border border-primary-base/30'
            : 'hover:bg-surface-panel/40 text-text-base border border-transparent',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {!node.isPairSecondary ? (
            <Checkbox
              checked={node.item.enabled}
              onChange={(e) => {
                e.stopPropagation();
                onToggleEnabled(node.item.id, e.target.checked);
              }}
            />
          ) : (
            <div className="w-4" />
          )}

          {node.name.endsWith('.png') ? (
            <ImageIcon size={13} className="text-text-muted shrink-0" />
          ) : node.name.endsWith('.pgm') ? (
            <MapIcon size={13} className="text-accent-generator shrink-0" />
          ) : (
            <FileText size={13} className="text-primary-base shrink-0" />
          )}

          <span className="font-mono text-[11px] truncate" title={node.fullPath}>
            {node.name}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {isConflict && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-status-warning/20 text-status-warning font-bold">
              既存
            </span>
          )}
          <span className="text-[10px] text-text-muted font-normal">{node.sourceLabel}</span>
        </div>
      </div>
    );
  });
}
