import { createContext, useContext } from 'react';
import type { GlobalFieldDef } from '../../../../types/options';

export interface SchemaGlobalsContextValue {
  /** 編集中（未 Apply を含む）のグローバル変数。フィールドの「既定値をグローバルに連動」の選択肢と現在値の表示に使う。 */
  globals: GlobalFieldDef[];
  /** グローバル名 → それに既定値を連動させているフィールドのパス一覧（例: `options.is_through_point`）。 */
  linkedFields: Map<string, string[]>;
}

/**
 * スキーマ設定画面の深い入れ子（object のフィールド、union のバリアント等）にある `FieldEditor` からも
 * グローバル変数の一覧を参照できるようにするためのコンテキスト。props で全階層に通すと
 * `TypeSpecEditor` 経由の再帰全体に引数が増えるため、コンテキストにしている。
 */
export const SchemaGlobalsContext = createContext<SchemaGlobalsContextValue>({ globals: [], linkedFields: new Map() });

export const useSchemaGlobals = () => useContext(SchemaGlobalsContext);
