import { useState, useEffect } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { AnnotationGroup } from '../../../types/store';
import { Label } from '../common/Label';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { PluginPropertyEditor } from '../plugins/PluginPropertyEditor';
import { PluginInputEditor } from '../plugins/PluginInputEditor';
import { PluginDataViewer } from '../common/PluginDataViewer';
import { Trash2, Wand2, Folder, Unlink, RefreshCcw, Code2, Maximize2 } from 'lucide-react';

export function AnnotationGroupPanel({ group }: { group: AnnotationGroup }) {
  const plugins = useAppStore((state) => state.plugins);
  const explodeAnnotationGroup = useAppStore((state) => state.explodeAnnotationGroup);
  const removeAnnotationObjects = useAppStore((state) => state.removeAnnotationObjects);
  const updateAnnotationGroup = useAppStore((state) => state.updateAnnotationGroup);
  const runWithLoading = useAppStore((state) => state.runWithLoading);
  const pluginInteractionData = useAppStore((state) => state.pluginInteractionData);
  const updatePluginInteractionData = useAppStore((state) => state.updatePluginInteractionData);

  const [genParams, setGenParams] = useState<Record<string, any>>({});
  const [isExecuting, setIsExecuting] = useState(false);

  const pluginId = group.plugin_id || '';
  const plugin = plugins[pluginId];
  const isGenerator = group.type === 'generator';

  useEffect(() => {
    if (group.generator_params?.properties) {
      setGenParams({ ...group.generator_params.properties });
    }
    if (group.generator_params?.interaction_data) {
      Object.entries(group.generator_params.interaction_data).forEach(([key, val]) => {
        updatePluginInteractionData(key, val);
      });
    }
  }, [group.id]);

  useEffect(() => {
    useAppStore.getState().setPluginActiveProperties(genParams);
  }, [genParams, group.id]);

  const handleRegenerate = async () => {
    if (!plugin) return;
    setIsExecuting(true);
    try {
      await runWithLoading(
        {
          message: 'アノテーションを再生成中...',
          detail: plugin.manifest.name || plugin.id,
          blocking: true,
        },
        async () => {
          const filteredInteractionData: Record<string, any> = {};
          plugin.manifest.inputs?.forEach((inp) => {
            const key = inp.name || inp.id;
            if (key && pluginInteractionData[key]) {
              filteredInteractionData[key] = pluginInteractionData[key];
            }
          });

          await useAppStore.getState().executeGeneratorPlugin({
            plugin,
            properties: genParams,
            interactionData: filteredInteractionData,
            existingExecutionId: group.source_execution_id,
            targetAnnotationGroupId: group.id,
          });
        },
      );
    } catch (err: any) {
      console.error('Annotation group regeneration failed:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border-base/40">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary-base/10 text-primary-base border border-primary-base/20">
            {isGenerator ? <Wand2 size={18} /> : <Folder size={18} />}
          </div>
          <div>
            <h3 className="font-bold text-sm text-text-base leading-tight">{group.name}</h3>
            <span className="text-[11px] text-text-muted font-mono">
              {isGenerator ? 'Generator Group' : 'Manual Group'} ({group.children_ids?.length || 0} items)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="danger"
            size="sm"
            onClick={() => removeAnnotationObjects([group.id])}
            className="w-7 h-7 p-0"
            title="グループ削除"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Name Edit */}
      <div className="space-y-2">
        <Label>グループ名</Label>
        <Input
          type="text"
          value={group.name}
          onChange={(e) => updateAnnotationGroup(group.id, { name: e.target.value })}
        />
      </div>

      {/* Generator Controls */}
      {isGenerator && plugin && (
        <div className="space-y-5 bg-surface-panel/40 p-3.5 rounded-xl border border-border-base/30">
          <div className="space-y-1">
            <span className="text-xs font-bold text-text-base flex items-center gap-1.5">
              <Wand2 size={13} className="text-primary-base" />
              プラグイン: {plugin.manifest.name}
            </span>
            {plugin.manifest.description && (
              <p className="text-[11px] text-text-muted">{plugin.manifest.description}</p>
            )}
          </div>

          {plugin.manifest.inputs?.map((inp, idx) => {
            const key = inp.name || inp.id;
            if (!key) return null;
            return (
              <PluginInputEditor
                key={`input-${idx}`}
                input={inp}
                interactionData={pluginInteractionData[key]}
                onUpdate={(data) => updatePluginInteractionData(key, data)}
                mode="edit"
                decimalPrecision={2}
              />
            );
          })}

          {plugin.manifest.properties?.map((prop, idx) => {
            const key = prop.name;
            if (!key) return null;
            return (
              <PluginPropertyEditor
                key={`prop-${idx}`}
                property={prop}
                value={genParams[key]}
                onChange={(val) => setGenParams((prev) => ({ ...prev, [key]: val }))}
              />
            );
          })}

          <Button
            variant="primary"
            onClick={handleRegenerate}
            disabled={isExecuting}
            className="w-full gap-2 shadow-xs text-xs font-bold"
          >
            <RefreshCcw size={14} className={isExecuting ? 'animate-spin' : ''} />
            <span>{isExecuting ? '再生成中...' : 'アノテーションを再生成'}</span>
          </Button>
        </div>
      )}

      {/* Internal Properties (Read-only Metadata) */}
      <div className="space-y-2 pt-3 border-t border-border-base/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Code2 size={13} className="text-accent-automation" />
            <span className="text-[11px] font-bold text-text-base">内部プロパティ (Internal Properties)</span>
          </div>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-surface-hover text-text-muted border border-border-base/30 font-mono">
            Read-only
          </span>
        </div>

        {group.plugin_data && Object.keys(group.plugin_data).length > 0 ? (
          <div className="space-y-1.5">
            <PluginDataViewer data={group.plugin_data} title="Annotation Group Plugin Data" defaultExpanded={true} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                useAppStore
                  .getState()
                  .openPluginDataModal(
                    `アノテーショングループ: ${group.name}`,
                    group.plugin_data,
                    `プラグイン: ${group.plugin_id || 'Manual'} • 内部メタデータ (Read-only)`,
                  )
              }
              className="w-full text-[10px] text-accent-automation hover:bg-accent-automation/10 gap-1 h-6"
            >
              <Maximize2 size={11} />
              <span>全画面ダイアログで開く</span>
            </Button>
          </div>
        ) : (
          <p className="text-[10px] text-text-muted/60 bg-surface-base/30 p-2 rounded-lg border border-border-base/20 italic">
            内部プロパティ（plugin_data）はありません。
          </p>
        )}
      </div>

      {/* Group Operations */}
      <div className="space-y-2 pt-2 border-t border-border-base/30">
        <Button variant="secondary" onClick={() => explodeAnnotationGroup(group.id)} className="w-full gap-2 text-xs">
          <Unlink size={13} className="text-accent-anchor" />
          <span>グループ解除 (Explode)</span>
        </Button>
      </div>
    </div>
  );
}
