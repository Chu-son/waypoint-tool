import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../../../utils/cn';
import { diffValues } from '../../../../utils/diff/itemDiff';
import {
  countIncoming,
  getProjectImportCategory,
  pickCategoryValue,
  type ProjectImportCategoryId,
} from '../../../../utils/import/projectImportPlan';
import { Button } from '../../common/Button';
import { Checkbox } from '../../common/Checkbox';
import { ItemDiffList } from '../../common/ItemDiffList';
import { TextDiffView } from '../../common/TextDiffView';
import { profileDiffRows, schemaDiffRows, templateDiffRows } from './diffRows';
import type { ProjectImportState } from './useProjectImport';

interface ProjectImportCategoryRowProps {
  id: ProjectImportCategoryId;
  state: ProjectImportState;
}

/** 取り込み候補の要約（バッジに出す文言）。 */
function summarize(id: ProjectImportCategoryId, state: ProjectImportState): string {
  const { loaded } = state;
  if (!loaded) return '';
  const category = getProjectImportCategory(id);
  if (!state.isAvailable(id)) {
    return category.mode === 'additive' ? 'None in this project' : 'Same as current';
  }
  switch (id) {
    case 'optionSchema':
      return `${loaded.schemaDiffs.filter((d) => d.status !== 'unchanged').length} difference(s)`;
    case 'templates':
      return `${loaded.templateItems.filter((t) => t.status !== 'unchanged').length} difference(s)`;
    case 'exportProfiles':
      return `${loaded.profileDiffs.filter((d) => d.status !== 'unchanged').length} difference(s)`;
    default:
      return category.mode === 'value' ? 'Differs' : `${countIncoming(id, loaded.incoming)} item(s)`;
  }
}

/** 1 つのカテゴリ：取り込むかどうかのチェックと、展開すると見られる差分。 */
export function ProjectImportCategoryRow({ id, state }: ProjectImportCategoryRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { loaded } = state;
  if (!loaded) return null;

  const category = getProjectImportCategory(id);
  const available = state.isAvailable(id);
  const hasDetails = available && category.mode !== 'additive';

  // 項目を選んだらカテゴリも取り込み対象にする（何も選ばなければ外す）。
  const syncCategory = (next: ReadonlySet<string>) => state.toggleCategory(id, next.size > 0);

  return (
    <li className="rounded-lg border border-border-base bg-surface-panel/40">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <Checkbox
          checked={state.categories.has(id)}
          disabled={!available}
          onChange={(e) => state.toggleCategory(id, e.target.checked)}
          aria-label={`Import ${category.label}`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-text-base">{category.label}</p>
          <p className="truncate text-[11px] text-text-muted">{category.description}</p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold',
            available
              ? 'border-primary-base/30 bg-primary-base/10 text-primary-base'
              : 'border-border-base bg-surface-hover text-text-muted',
          )}
        >
          {summarize(id, state)}
        </span>
        {hasDetails && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-label={`${isOpen ? 'Hide' : 'Show'} details of ${category.label}`}
            title={isOpen ? 'Hide details' : 'Show details'}
          >
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </Button>
        )}
      </div>

      {isOpen && hasDetails && (
        <div className="border-t border-border-base/60 p-3">
          {id === 'optionSchema' && (
            <ItemDiffList
              rows={schemaDiffRows(loaded.schemaDiffs)}
              accepted={state.schemaAccepted}
              onChange={(next) => {
                state.setSchemaAccepted(next);
                syncCategory(next);
              }}
            />
          )}
          {id === 'templates' && (
            <ItemDiffList
              rows={templateDiffRows(loaded.templateItems)}
              accepted={state.acceptedTemplateIds}
              onChange={(next) => {
                state.setAcceptedTemplateIds(next);
                syncCategory(next);
              }}
            />
          )}
          {id === 'exportProfiles' && (
            <ItemDiffList
              rows={profileDiffRows(loaded.profileDiffs)}
              accepted={state.acceptedProfileIds}
              onChange={(next) => {
                state.setAcceptedProfileIds(next);
                syncCategory(next);
              }}
            />
          )}
          {category.mode === 'value' && (
            <TextDiffView
              lines={diffValues(
                pickCategoryValue(category, loaded.ctx.current),
                pickCategoryValue(category, loaded.incoming),
              )}
              aria-label={`Changes of ${category.label}`}
            />
          )}
        </div>
      )}
    </li>
  );
}
