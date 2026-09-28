import { Select } from '../../common/Select';
import { Input } from '../../common/Input';
import { FieldLabel } from '../../common/FieldLabel';
import { SchemaFieldCell } from './SchemaFieldCell';
import { ChoicesEditor } from './ChoicesEditor';
import { FieldListEditor } from './FieldListEditor';
import { VariantListEditor } from './VariantListEditor';
import { PresetListEditor } from './PresetListEditor';
import type { TypeSpec, ValueType } from '../../../../types/options';

/**
 * 型仕様に対する更新を適用する。型そのものを変更した場合は、旧い型の付随データ
 * （fields/variants/item 等）を引き継がない（例: list → union に変えたら item は捨てる）。
 */
export function mergeTypeSpec(current: TypeSpec | undefined, updates: Partial<TypeSpec>): TypeSpec {
  const base: TypeSpec = current ?? { type: 'string' };
  if (updates.type && updates.type !== base.type) {
    return { type: updates.type };
  }
  return { ...base, ...updates };
}

export interface TypeSpecEditorProps {
  spec: TypeSpec;
  onChange: (spec: TypeSpec) => void;
  /** `ref` の選択肢に出す、定義済みの型名一覧。 */
  definitionNames: string[];
  /** aria-label の接頭辞（例: フィールド名、あるいは "on_reached_actions item"）。 */
  fieldName: string;
  /**
   * `spec` がスキーマ全体の中で占める位置を表す文字列（`optionPresets.ts` の走査と同じ形式。
   * 例: `options.tolerance`, `definitions.action.variants.wait.fields.countdown_ms`）。
   * `presets` の使用件数の集計・一括置換のスコープとして使う。
   */
  scope: string;
  /** Apply 済みのスキーマとローカルの編集内容が一致しているか（プリセットの使用件数・一括置換の可否）。 */
  isAppliedAndUnchanged: boolean;
}

/**
 * 値の型仕様を再帰的に編集する。list/object/map/union は、それぞれの中の型仕様を
 * 同じ `TypeSpecEditor` で編集するため、GUI 上のネストの深さに制限が無い。
 */
export function TypeSpecEditor({
  spec,
  onChange,
  definitionNames,
  fieldName,
  scope,
  isAppliedAndUnchanged,
}: TypeSpecEditorProps) {
  return (
    <div className="space-y-2">
      <SchemaFieldCell label="Type" className="w-56">
        <Select
          aria-label={`${fieldName} type`}
          value={spec.type}
          onChange={(e) => onChange(mergeTypeSpec(spec, { type: e.target.value as ValueType }))}
          className="h-8 text-[13px]"
        >
          <option value="string">String</option>
          <option value="float">Float</option>
          <option value="integer">Integer</option>
          <option value="boolean">Boolean</option>
          <option value="list">List (Array)</option>
          <option value="object">Object (fixed fields)</option>
          <option value="map">Map (free keys)</option>
          <option value="union">Union (type-dependent fields)</option>
          <option value="any">Any (JSON)</option>
          <option value="ref" disabled={definitionNames.length === 0}>
            Ref (reuse a definition)
          </option>
        </Select>
      </SchemaFieldCell>

      {spec.type === 'string' && (
        <SchemaFieldCell label="Choices (optional)" className="max-w-md">
          <ChoicesEditor
            values={spec.enum_values ?? []}
            onChange={(enum_values) => onChange({ ...spec, enum_values })}
            fieldName={fieldName}
          />
        </SchemaFieldCell>
      )}

      {spec.type === 'ref' && (
        <SchemaFieldCell label="Referenced Type" className="w-56">
          <Select
            aria-label={`${fieldName} ref target`}
            value={spec.ref || ''}
            onChange={(e) => onChange({ ...spec, ref: e.target.value })}
            className="h-8 text-[13px]"
          >
            <option value="" disabled hidden>
              (select)
            </option>
            {definitionNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </SchemaFieldCell>
      )}

      {spec.type === 'list' && (
        <div className="pl-3 border-l-2 border-border-base/30 space-y-2">
          <FieldLabel className="ml-1">List Item Type</FieldLabel>
          <TypeSpecEditor
            spec={spec.item ?? { type: 'string' }}
            onChange={(item) => onChange({ ...spec, item })}
            definitionNames={definitionNames}
            fieldName={`${fieldName} item`}
            scope={`${scope}.item`}
            isAppliedAndUnchanged={isAppliedAndUnchanged}
          />
        </div>
      )}

      {spec.type === 'object' && (
        <div className="pl-3 border-l-2 border-border-base/30">
          <FieldListEditor
            fields={spec.fields ?? []}
            onChange={(fields) => onChange({ ...spec, fields })}
            definitionNames={definitionNames}
            parentScope={scope}
            isAppliedAndUnchanged={isAppliedAndUnchanged}
          />
        </div>
      )}

      {spec.type === 'map' && (
        <div className="pl-3 border-l-2 border-border-base/30 space-y-2">
          <FieldLabel className="ml-1">Map Value Type</FieldLabel>
          <TypeSpecEditor
            spec={spec.value_type ?? { type: 'any' }}
            onChange={(value_type) => onChange({ ...spec, value_type })}
            definitionNames={definitionNames}
            fieldName={`${fieldName} value`}
            scope={`${scope}.value_type`}
            isAppliedAndUnchanged={isAppliedAndUnchanged}
          />
        </div>
      )}

      {spec.type === 'union' && (
        <div className="pl-3 border-l-2 border-accent-automation/30 space-y-2">
          <SchemaFieldCell label="Discriminator Key" className="w-48">
            <Input
              type="text"
              aria-label={`${fieldName} discriminator`}
              value={spec.discriminator || 'type'}
              onChange={(e) => onChange({ ...spec, discriminator: e.target.value.trim() || 'type' })}
              className="h-8 text-[13px] font-mono"
              placeholder="type"
            />
          </SchemaFieldCell>
          <VariantListEditor
            variants={spec.variants ?? []}
            onChange={(variants) => onChange({ ...spec, variants })}
            definitionNames={definitionNames}
            parentScope={scope}
            isAppliedAndUnchanged={isAppliedAndUnchanged}
          />
        </div>
      )}

      {spec.type !== 'ref' && (
        <PresetListEditor
          spec={spec}
          onChange={(updates) => onChange({ ...spec, ...updates })}
          scope={scope}
          isAppliedAndUnchanged={isAppliedAndUnchanged}
        />
      )}
    </div>
  );
}
