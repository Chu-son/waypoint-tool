import { useCallback, useMemo, useState } from 'react';
import { getProjectImportContext } from '../../../../services/projectImport';
import type { StrictProjectData } from '../../../../types/project';
import { validateSchema } from '../../../../utils/optionSchema';
import { defaultAcceptedIds, diffOptionsSchema, type SchemaItemDiff } from '../../../../utils/import/optionSchemaMerge';
import {
  buildProjectImportPlan,
  countIncoming,
  defaultTemplateAction,
  diffProfiles,
  diffTemplates,
  getProjectImportCategory,
  isPlanEmpty,
  valueCategoryDiffers,
  type ProjectImportCategoryId,
  type ProjectImportContext,
  type TemplateAction,
  type TemplateImportItem,
} from '../../../../utils/import/projectImportPlan';

interface LoadedProject {
  incoming: StrictProjectData;
  /** ファイルを読んだ時点の今のプロジェクト。差分はこれと比べる。 */
  ctx: ProjectImportContext;
  schemaDiffs: SchemaItemDiff[];
  templateItems: TemplateImportItem[];
  profileDiffs: ReturnType<typeof diffProfiles>;
}

const isChange = (d: { status: string }) => d.status !== 'unchanged';

/**
 * 他のプロジェクト（.wptroj）から取り込む内容の選択状態と、そこから組み立てる取り込み計画。
 * `load` で取り込み元を渡すと、差分を計算して既定の選択（追加・変更を取り込む）に初期化する。
 */
export function useProjectImport() {
  const [loaded, setLoaded] = useState<LoadedProject | null>(null);
  const [categories, setCategories] = useState<ReadonlySet<ProjectImportCategoryId>>(new Set());
  const [schemaAccepted, setSchemaAccepted] = useState<ReadonlySet<string>>(new Set());
  const [acceptedTemplateIds, setAcceptedTemplateIds] = useState<ReadonlySet<string>>(new Set());
  const [acceptedProfileIds, setAcceptedProfileIds] = useState<ReadonlySet<string>>(new Set());

  const load = useCallback((incoming: StrictProjectData) => {
    const ctx = getProjectImportContext();
    const schemaDiffs = incoming.options_schema
      ? diffOptionsSchema(ctx.current.options_schema, incoming.options_schema)
      : [];
    const templateItems = diffTemplates(ctx.currentTemplates, incoming.export_templates);
    const profileDiffs = diffProfiles(ctx.current.export_profiles, incoming.export_profiles);

    setLoaded({ incoming, ctx, schemaDiffs, templateItems, profileDiffs });
    setCategories(new Set());
    setSchemaAccepted(defaultAcceptedIds(schemaDiffs));
    setAcceptedTemplateIds(new Set(templateItems.filter(isChange).map((t) => t.incoming.id)));
    setAcceptedProfileIds(new Set(profileDiffs.filter(isChange).map((d) => d.incoming!.id)));
  }, []);

  /** そのカテゴリに取り込めるものがあるか（無いカテゴリは選べない）。 */
  const isAvailable = useCallback(
    (id: ProjectImportCategoryId): boolean => {
      if (!loaded) return false;
      const category = getProjectImportCategory(id);
      if (id === 'optionSchema') return loaded.schemaDiffs.some(isChange);
      if (id === 'templates') return loaded.templateItems.some(isChange);
      if (id === 'exportProfiles') return loaded.profileDiffs.some(isChange);
      if (category.mode === 'value') return valueCategoryDiffers(category, loaded.ctx.current, loaded.incoming);
      return countIncoming(id, loaded.incoming) > 0;
    },
    [loaded],
  );

  const toggleCategory = useCallback((id: ProjectImportCategoryId, checked: boolean) => {
    setCategories((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const plan = useMemo(() => {
    if (!loaded) return null;
    const templateActions: Record<string, TemplateAction> = {};
    loaded.templateItems.forEach((item) => {
      templateActions[item.incoming.id] = acceptedTemplateIds.has(item.incoming.id)
        ? defaultTemplateAction(item)
        : 'skip';
    });
    return buildProjectImportPlan(loaded.ctx, loaded.incoming, {
      categories,
      schemaAccepted,
      templateActions,
      acceptedProfileIds,
    });
  }, [loaded, categories, schemaAccepted, acceptedTemplateIds, acceptedProfileIds]);

  const schemaErrors = useMemo(() => (plan?.optionsSchema ? validateSchema(plan.optionsSchema) : []), [plan]);
  const canImport = !!plan && !isPlanEmpty(plan) && schemaErrors.length === 0;

  return {
    loaded,
    load,
    categories,
    toggleCategory,
    isAvailable,
    schemaAccepted,
    setSchemaAccepted,
    acceptedTemplateIds,
    setAcceptedTemplateIds,
    acceptedProfileIds,
    setAcceptedProfileIds,
    plan,
    schemaErrors,
    canImport,
  };
}

export type ProjectImportState = ReturnType<typeof useProjectImport>;
