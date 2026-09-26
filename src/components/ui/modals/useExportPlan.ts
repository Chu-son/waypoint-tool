import { useState, useMemo, useEffect, useRef, type SyntheticEvent } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { BackendAPI } from '../../../api';
import { v4 as uuidv4 } from 'uuid';
import { ExportProfile, ExportTargetItem, ExportTargetType } from '../../../types/store';
import { resolveExportFiles, buildExportTreePreview } from '../../../utils/exportTemplateEngine';
import { extractWaypointsForExport } from '../../../utils/exportWaypointUtils';
import { buildExportPackageItems, formatSessionTimestamp } from '../../../utils/exportPackage';
import { prepareLayersForExport } from '../../../services/mapRasterize';
import { DEFAULT_EXPORT_PROFILES, DEFAULT_ACTIVE_EXPORT_PROFILE_ID } from '../../../stores/migrations/projectMigration';
import { confirmAction, notify } from '../../../services/notify';

interface UseExportPlanOptions {
  isOpen: boolean;
  onClose: () => void;
}

/** State and actions behind the export dialog: profile/item editing, file preview, conflict check and execution. */
export function useExportPlan({ isOpen, onClose }: UseExportPlanOptions) {
  const rawExportProfiles = useAppStore((state) => state.exportProfiles);
  const storeProfiles =
    Array.isArray(rawExportProfiles) && rawExportProfiles.length > 0 ? rawExportProfiles : DEFAULT_EXPORT_PROFILES;
  const storeActiveProfileId =
    useAppStore((state) => state.activeExportProfileId) || DEFAULT_ACTIVE_EXPORT_PROFILE_ID;
  const replaceExportProfiles = useAppStore((state) => state.replaceExportProfiles);

  // Edits are kept in a draft and only reach the store on save; cancelling discards them.
  const [draft, setDraft] = useState<{ profiles: ExportProfile[]; activeId: string } | null>(null);
  useEffect(() => {
    setDraft(isOpen ? { profiles: storeProfiles, activeId: storeActiveProfileId } : null);
    // Re-seed only when the dialog is opened or closed, not on every store change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  const exportProfiles = draft?.profiles ?? storeProfiles;
  const activeExportProfileId = draft?.activeId ?? storeActiveProfileId;

  const updateExportProfile = (id: string, updates: Partial<ExportProfile>) =>
    setDraft((d) => d && { ...d, profiles: d.profiles.map((p) => (p.id === id ? { ...p, ...updates } : p)) });
  const setActiveExportProfileId = (id: string) => setDraft((d) => d && { ...d, activeId: id });
  const addExportProfile = (profile: ExportProfile) =>
    setDraft((d) => d && { profiles: [...d.profiles, profile], activeId: profile.id });
  const removeExportProfile = (id: string) =>
    setDraft((d) => {
      if (!d) return d;
      const profiles = d.profiles.filter((p) => p.id !== id);
      return { profiles, activeId: d.activeId === id ? (profiles[0]?.id ?? d.activeId) : d.activeId };
    });
  const duplicateExportProfile = (id: string) =>
    setDraft((d) => {
      const source = d?.profiles.find((p) => p.id === id);
      if (!d || !source) return d;
      const copy: ExportProfile = {
        ...source,
        id: uuidv4(),
        name: `${source.name} (Copy)`,
        items: source.items.map((item) => ({ ...item, id: uuidv4() })),
      };
      return { profiles: [...d.profiles, copy], activeId: copy.id };
    });

  const exportTemplates = useAppStore((state) => state.exportTemplates) || [];
  const defaultExportFormats = useAppStore((state) => state.defaultExportFormats) || [];
  const exportRegions = useAppStore((state) => state.exportRegions) || [];
  const mapLayers = useAppStore((state) => state.mapLayers) || [];
  const customLayers = useAppStore((state) => state.customLayers) || [];
  const rootNodeIds = useAppStore((state) => state.rootNodeIds) || [];
  const nodes = useAppStore((state) => state.nodes) || {};
  const optionsSchema = useAppStore((state) => state.optionsSchema);
  const indexStartIndex = useAppStore((state) => state.indexStartIndex);
  const currentProjectPath = useAppStore((state) => state.currentProjectPath);
  const lastDirectory = useAppStore((state) => state.lastDirectory);
  const setLastDirectory = useAppStore((state) => state.setLastDirectory);
  const runWithLoading = useAppStore((state) => state.runWithLoading);

  // Variable chip inserter input ref (must be called unconditionally before early returns)
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);

  // Active profile fallback
  const activeProfile = useMemo(() => {
    const found = exportProfiles.find((p) => p.id === activeExportProfileId);
    const profile = found || exportProfiles[0] || DEFAULT_EXPORT_PROFILES[0];
    return {
      ...profile,
      items: Array.isArray(profile.items) ? profile.items : [],
    };
  }, [exportProfiles, activeExportProfileId]);

  // Local state for UI
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [conflictFiles, setConflictFiles] = useState<Set<string>>(new Set());
  const [sessionDate] = useState<Date>(() => new Date());

  // Derive project name from project path
  const projectName = useMemo(() => {
    if (!currentProjectPath) return 'untitled';
    const filename = currentProjectPath.split(/[/\\]/).pop() || 'untitled';
    return filename.replace(/\.wptroj$/i, '');
  }, [currentProjectPath]);

  // Root directory: profile-specific or fallback to lastDirectory or project parent directory
  const rootDir = useMemo(() => {
    if (activeProfile.outputRootDir) return activeProfile.outputRootDir;
    if (currentProjectPath) {
      const lastSlash = Math.max(currentProjectPath.lastIndexOf('/'), currentProjectPath.lastIndexOf('\\'));
      if (lastSlash > -1) return currentProjectPath.substring(0, lastSlash);
    }
    return lastDirectory || '';
  }, [activeProfile.outputRootDir, currentProjectPath, lastDirectory]);

  const handleRootDirChange = (newDir: string) => {
    updateExportProfile(activeProfile.id, { outputRootDir: newDir });
    setLastDirectory(newDir);
  };

  // Resolve files for the tree preview
  const resolvedFiles = useMemo(() => {
    return resolveExportFiles(activeProfile.items, {
      now: sessionDate,
      projectName,
      rootDir,
      availableRegions: exportRegions.map((r) => ({ id: r.id, name: r.name })),
      templates: exportTemplates.map((t) => ({
        id: t.id,
        name: t.name,
        extension: t.extension,
      })),
      defaultFormats: defaultExportFormats.map((f) => ({
        id: f.id,
        name: f.name,
        extension: f.extension,
      })),
    });
  }, [activeProfile.items, sessionDate, projectName, rootDir, exportRegions, exportTemplates, defaultExportFormats]);

  // Build tree from resolved files
  const treeNodes = useMemo(() => {
    return buildExportTreePreview(resolvedFiles);
  }, [resolvedFiles]);

  // Check conflicts with debounce
  useEffect(() => {
    if (!isOpen || resolvedFiles.length === 0 || !rootDir) {
      setConflictFiles(new Set());
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const fullPaths = resolvedFiles.map((f) => f.fullPath);
        const existing = await BackendAPI.checkExportConflicts(fullPaths);
        setConflictFiles(new Set(existing));
      } catch (err) {
        console.error('Failed to check export conflicts:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isOpen, resolvedFiles, rootDir]);

  // Select first item if none selected
  useEffect(() => {
    if (activeProfile.items.length > 0 && !selectedItemId) {
      setSelectedItemId(activeProfile.items[0].id);
    }
  }, [activeProfile.items, selectedItemId]);

  // Profile actions
  const handleAddProfile = () => {
    const newProfile: ExportProfile = {
      id: uuidv4(),
      name: `新規プロファイル ${exportProfiles.length + 1}`,
      conflictResolution: 'backup_file',
      items: [
        {
          id: uuidv4(),
          type: 'waypoint_default',
          sourceId: '__default_yaml__',
          relativePathPattern: 'waypoints/{{yyyymmdd}}_waypoints.yaml',
          enabled: true,
        },
      ],
    };
    addExportProfile(newProfile);
    setSelectedItemId(newProfile.items[0].id);
  };

  const handleDuplicateProfile = () => {
    duplicateExportProfile(activeProfile.id);
  };

  const handleDeleteProfile = async () => {
    if (exportProfiles.length <= 1) {
      void notify('最後のプロファイルは削除できません。');
      return;
    }
    if (await confirmAction(`プロファイル「${activeProfile.name}」を削除しますか？`)) {
      removeExportProfile(activeProfile.id);
    }
  };

  // Item actions
  const handleAddItem = (type: ExportTargetType) => {
    let sourceId = '__default_yaml__';
    let pattern = 'waypoints/{{yyyymmdd}}_waypoints.yaml';

    if (type === 'map_all_regions') {
      sourceId = 'all';
      pattern = 'Map/{{name}}.pgm';
    } else if (type === 'map_region') {
      sourceId = exportRegions[0]?.id || 'default';
      pattern = 'Map/{{name}}.pgm';
    }

    const newItem: ExportTargetItem = {
      id: uuidv4(),
      type,
      sourceId,
      relativePathPattern: pattern,
      mapFormat: 'ros_standard',
      includeMapImage: false,
      enabled: true,
    };

    updateExportProfile(activeProfile.id, {
      items: [...activeProfile.items, newItem],
    });
    setSelectedItemId(newItem.id);
  };

  const handleDeleteItem = (itemId: string) => {
    const updated = activeProfile.items.filter((i) => i.id !== itemId);
    updateExportProfile(activeProfile.id, { items: updated });
    if (selectedItemId === itemId) {
      setSelectedItemId(updated[0]?.id || null);
    }
  };

  const handleToggleItemEnabled = (itemId: string, enabled: boolean) => {
    const updated = activeProfile.items.map((i) => (i.id === itemId ? { ...i, enabled } : i));
    updateExportProfile(activeProfile.id, { items: updated });
  };

  const handleUpdateItem = (itemId: string, updates: Partial<ExportTargetItem>) => {
    const updated = activeProfile.items.map((i) => (i.id === itemId ? { ...i, ...updates } : i));
    updateExportProfile(activeProfile.id, { items: updated });
  };

  // Selected item object
  const selectedItem = activeProfile.items.find((i) => i.id === selectedItemId);

  // Variable chip inserter
  const handleInsertVariable = (varName: string) => {
    if (!selectedItem) return;
    const currentPattern = selectedItem.relativePathPattern;
    const input = inputRef.current;
    const remembered = selectionRef.current;
    const start = Math.min(remembered?.start ?? currentPattern.length, currentPattern.length);
    const end = Math.min(remembered?.end ?? start, currentPattern.length);
    const newPattern = currentPattern.substring(0, start) + varName + currentPattern.substring(end);
    handleUpdateItem(selectedItem.id, { relativePathPattern: newPattern });
    const caret = start + varName.length;
    selectionRef.current = { start: caret, end: caret };
    setTimeout(() => {
      input?.focus();
      input?.setSelectionRange(caret, caret);
    }, 0);
  };

  // Remember the caret so chip clicks (which blur the input) still insert where the user left off
  const handlePatternSelect = (e: SyntheticEvent<HTMLInputElement>) => {
    const { selectionStart, selectionEnd } = e.currentTarget;
    if (selectionStart !== null && selectionEnd !== null) {
      selectionRef.current = { start: selectionStart, end: selectionEnd };
    }
  };

  const commitDraft = () => replaceExportProfiles(exportProfiles, activeProfile.id);

  const handleSaveOnly = () => {
    commitDraft();
    onClose();
  };

  const handleSaveAndExport = async () => {
    commitDraft();
    await handleExecuteExport();
  };

  // Execute export
  const handleExecuteExport = async () => {
    const enabledItems = activeProfile.items.filter((i) => i.enabled);
    if (enabledItems.length === 0) {
      void notify('エクスポート対象の項目が選択されていません。');
      return;
    }

    if (!rootDir) {
      void notify('出力先ルートフォルダを指定してください。');
      return;
    }

    try {
      const hasMapItems = enabledItems.some((i) => i.type === 'map_region' || i.type === 'map_all_regions');
      const hasMapShot = enabledItems.some((i) => i.includeMapImage);

      await runWithLoading(
        {
          message: 'エクスポートを実行中...',
          detail: `${enabledItems.length} 件の構成を出力中`,
          blocking: true,
        },
        async () => {
          // 1. Prepare map raster layers if map export is required
          let preparedLayers: any[] = [];
          if (hasMapItems) {
            preparedLayers = await prepareLayersForExport(mapLayers, customLayers);
          }

          // 2. Extract map shot canvas if requested
          let imageDataB64: string | undefined = undefined;
          if (hasMapShot) {
            useAppStore.getState().triggerFitToMaps();
            await new Promise((r) => setTimeout(r, 800));
            const canvas = document.querySelector('canvas');
            if (canvas) {
              imageDataB64 = canvas.toDataURL('image/png').split(',')[1];
            }
          }

          // 3. Resolve the package items (waypoint files and map regions)
          const resolvedTargetFiles = resolveExportFiles(enabledItems, {
            now: sessionDate,
            projectName,
            rootDir,
            availableRegions: exportRegions.map((r) => ({ id: r.id, name: r.name })),
            templates: exportTemplates.map((t) => ({
              id: t.id,
              name: t.name,
              extension: t.extension,
            })),
            defaultFormats: defaultExportFormats.map((f) => ({
              id: f.id,
              name: f.name,
              extension: f.extension,
            })),
          });

          const { waypointItems, mapItems } = buildExportPackageItems({
            enabledItems,
            resolvedFiles: resolvedTargetFiles,
            templates: exportTemplates,
            regions: exportRegions,
            waypoints: extractWaypointsForExport(rootNodeIds, nodes, optionsSchema, indexStartIndex),
            mapLayers: preparedLayers,
            mapImageB64: imageDataB64,
          });

          // 4. Invoke Backend API
          const result = await BackendAPI.executeExportPackage({
            root_dir: rootDir,
            conflict_resolution: activeProfile.conflictResolution,
            session_timestamp: formatSessionTimestamp(sessionDate),
            waypoint_items: waypointItems,
            map_items: mapItems,
          });

          let alertMsg = `エクスポートが完了しました。\n出力ファイル数: ${result.exported_files_count} 件`;
          if (result.backed_up_files && result.backed_up_files.length > 0) {
            alertMsg += `\nバックアップ作成: ${result.backed_up_files.length} 件 (.bak)`;
          }
          void notify(alertMsg);
          onClose();
        },
      );
    } catch (err) {
      console.error('Failed to execute export:', err);
      void notify(`エクスポートに失敗しました:\n${String(err)}`);
    }
  };

  return {
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
  };
}
