import { useAppStore } from '../stores/appStore';
import { buildProjectData } from '../stores/serialization/projectSerializer';
import type { ProjectImportContext, ProjectImportPlan } from '../utils/import/projectImportPlan';
import { applyOptionsSchema } from './optionSchemaApply';

/** 取り込み先となる今のプロジェクトの状態。差分の計算と取り込み計画の組み立てに渡す。 */
export function getProjectImportContext(): ProjectImportContext {
  const state = useAppStore.getState();
  return {
    current: buildProjectData(state),
    currentTemplates: state.exportTemplates,
    installedPluginIds: new Set(Object.keys(state.plugins)),
  };
}

/**
 * 取り込み計画を今のプロジェクトへ適用する。
 * オプションスキーマは検証と確認（消えるプリセットの展開）が要るので先に適用し、断られたら何も変えずに終わる。
 *
 * @returns 適用したかどうか。
 */
export async function applyProjectImportPlan(plan: ProjectImportPlan): Promise<boolean> {
  if (plan.optionsSchema) {
    const applied = await applyOptionsSchema(plan.optionsSchema);
    if (!applied) return false;
  }
  useAppStore.getState().applyProjectImport(plan);
  return true;
}
