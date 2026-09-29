# Option Schema サンプル集

Option Schema の再帰的な型（`object`/`map`/`union`）と、エクスポートテンプレートの Jinja エンジンを
組み合わせた実例です。`Settings > Option Schema` の **Import** から `*.schema.json` を読み込み、
`Settings > Export Templates` で `*.j2` の内容を貼り付けて Engine を `Jinja` にすると、そのまま使えます。
両サンプルの出力は `src-tauri/src/templating.rs` のテストで検証されています。

## mg_robot_v2 (`mg_robot_v2.schema.json` / `mg_robot_v2.yaml.j2`)

`mg_waypoint_navigation`（`~/ros_workspace/mg_robot/mg_waypoint_navigation/doc/waypoint_format.md`）の
v2.0 ウェイポイント YAML を出力する例です。

- `on_reached_actions` は `type` によってフィールド構成が変わるタグ付きユニオン（`service`, `publish`,
  `load_map`, `amcl_reset`, `wait`, `wait_trigger`, `set_navigation_mode` の7種類）を要素とするリスト。
  ユニオン自体は `definitions.action` として1箇所だけ定義し、`on_reached_actions` からは
  `{ "type": "ref", "ref": "action" }` で参照している。同じ `action` 型を `on_departure_actions` のような
  別のフィールドからも再利用できる。
  `service`/`publish` の `request`/`data` は自由なキーを持つ `map` 型。`service`/`topic` 等の
  必須フィールドには `required: true` を付けている（値が無くエクスポートすると確認ダイアログが出る）。
- テンプレートは `raw_options.on_reached_actions` を参照しており、アクションを設定していない
  ウェイポイントでは `on_reached_actions` フィールド自体を出力しない（受け側の `defaults` 適用に委ねる）。
- `toyaml(6)` フィルタで、アクション配列をブロック形式 YAML として正しい字下げで埋め込んでいる。
- `through_tolerance` には小 (1.5m) / 大 (3.0m) の2値をプリセットとして定義しており、`definitions.action`
  には「前方LiDARの有効化/無効化」という定型のサービス呼び出しアクションを丸ごとプリセットとして
  定義している。`on_reached_actions`/`on_departure_actions` のどちらから使っても、`definitions.action`
  のプリセットは共有される。プリセットの値を1箇所変えれば、参照している全ウェイポイントに反映される。

このサンプルは mg_robot 専用のコードを一切含まない。Option Schema と Jinja テンプレートだけで
表現できることを示す（=「タグ付きユニオンのリスト」という一般的なパターンへの対応）。

## generic_speed_report (`generic_speed_report.schema.json` / `generic_speed_report.csv.j2`)

mg_robot とは無関係な、CSV レポート出力の例です。ウェイポイントごとの基準速度 (`base_speed`) に
プロジェクト全体の係数 (`speed_factor`, Global Field) を掛けた実効速度を計算し、任意のメタデータ
(`metadata`, `map` 型) を JSON として書き出します。四則演算・`round`・`tojson`・`default` フィルタの
使用例です。

```
index,x,y,effective_speed,zone,metadata
0,1.0,2.0,3.0,normal,{}
1,3.0,4.0,1.5,slow,{"shelf":"A1"}
```
