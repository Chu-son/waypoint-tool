"""
Waypoint Tool Python Plugin SDK (wpt_plugin.py)
================================================

Waypoint Tool 本体（Rust/Tauri デスクトップアプリ）と連携する Python プラグインを
開発するための SDK（ベースクラス）です。

Architecture / アーキテクチャ背景
---------------------------------
Waypoint Tool は外部の経路生成アルゴリズムを「プラグイン」として呼び出します。
通信方式には OS の標準入出力（stdin / stdout）を介した JSON メッセージングを採用しており、
HTTP サーバーや RPC ライブラリなどの重い依存を必要としません。

    ┌────────────────┐   JSON (stdin)    ┌──────────────────┐
    │  Waypoint Tool │ ── context ──────► │  Python Plugin   │
    │  (Rust/Tauri)  │                    │  (this script)   │
    │                │ ◄── waypoints ──── │                  │
    └────────────────┘   JSON (stdout)    └──────────────────┘

- **stdin**: ツールからプラグインへコンテキスト情報（プロパティ値、インタラクション
  データ、マップ情報など）を JSON 形式で送信します。
- **stdout**: プラグインから Waypoint 配列を JSON 形式で返却します。
- **stderr**: デバッグログやエラーメッセージの出力に使用します。stdout は通信チャネル
  として予約されているため、print() によるデバッグ出力は **必ず stderr** へ送る
  必要があります。

Usage / 使い方
--------------
1. `WaypointGenerator` を継承したクラスを作成します。
2. `generate(context)` メソッドをオーバーライドして、Waypoint リストを返します。
3. スクリプト末尾で `YourClass().run_from_stdin()` を呼び出します。

Example / 簡単な例::

    from wpt_plugin import WaypointGenerator

    class MyPlugin(WaypointGenerator):
        def generate(self, context):
            start = self.get_interaction_data(context, "start_point")
            if not start:
                return []
            spacing = self.get_property(context, "spacing", default=1.0)
            yaw = self.quaternion_to_yaw(start)
            return [self.make_waypoint(start["x"], start["y"], yaw)]

    if __name__ == "__main__":
        MyPlugin().run_from_stdin()
"""

import sys
import json
import math
from typing import Dict, Any, List, Optional, TypedDict

# SDK バージョン — Rust backend がプラグインディレクトリ内の wpt_plugin.py から
# このバージョンを読み取り、バンドル SDK との比較に使用します。
__version__ = "1.1.0"


# ===========================================================================
# 型定義 / Type Definitions
# ===========================================================================
# これらの TypedDict は、プラグインの入出力データ構造を明文化するために定義しています。
# 実行時に厳密な型強制は行いませんが、開発時の自己文書化・IDE 補完に役立ちます。

class Transform(TypedDict, total=False):
    """ROS 互換の 2D Transform（位置 + クォータニオン姿勢）。

    Waypoint の位置と向きを表現します。2D 平面での利用を想定しているため、
    qx / qy は通常 0 で、ヨー角（Z軸回転）のみを qz / qw で表します。

    Attributes:
        x:  X 座標 (メートル)
        y:  Y 座標 (メートル)
        qx: クォータニオン X 成分（通常 0）
        qy: クォータニオン Y 成分（通常 0）
        qz: クォータニオン Z 成分（sin(yaw/2)）
        qw: クォータニオン W 成分（cos(yaw/2)）
    """
    x: float
    y: float
    qx: float
    qy: float
    qz: float
    qw: float


class Waypoint(TypedDict, total=False):
    """プラグインが返す Waypoint の標準フォーマット。

    Attributes:
        transform: 位置・姿勢を表す Transform オブジェクト
        options:   任意のメタデータ辞書（generated_by, sweep_line_id 等）
    """
    transform: Transform
    options: Dict[str, Any]


# ===========================================================================
# ベースクラス / Base Class
# ===========================================================================

class WaypointGenerator:
    """Waypoint Tool Python プラグインのベースクラス。

    プラグイン開発者はこのクラスを継承し、`generate()` メソッドを実装してください。
    スクリプト末尾で `YourPluginClass().run_from_stdin()` を呼び出すことで、
    stdin/stdout 経由の JSON 通信が自動的に処理されます。

    [Architecture Background / アーキテクチャ背景]
    Waypoint Tool本体（Rust/Tauri）とは、OSの標準入出力（stdin/stdout）を介して通信します。
    これにより、Python側に重いHTTPサーバーやRPCライブラリを用意する必要がなく、
    スクリプトが単一のプレーンなプロセスとして非常に軽量に実行・終了できる設計です。
    """

    # -------------------------------------------------------------------
    # Core Method: generate (must be overridden)
    # -------------------------------------------------------------------

    def generate(self, context: Dict[str, Any]) -> List[Waypoint]:
        """Waypoint を生成して返すメインロジック。サブクラスで必ず実装してください。

        Generate waypoints based on the provided context.
        Subclasses MUST override this method.

        Args:
            context: Waypoint Tool から渡されるコンテキスト辞書。以下のキーを含みます:
                - ``properties`` (dict): manifest.json の properties で宣言したパラメータ値。
                  ユーザーが PluginParamsPanel 上で入力した値がそのまま渡されます。
                - ``interaction_data`` (dict): manifest.json の inputs で宣言した
                  インタラクション入力データ。キーは各 input の ``id``。
                  例: ``{"start_point": {"x": 1.0, "y": 2.0, "qz": 0, "qw": 1}}``
                - ``map_info`` (dict, optional): マップのメタデータ（resolution, origin 等）。
                  manifest.json の ``needs`` に ``"map_image"`` を含めた場合のみ提供。
                - ``map_image`` (str, optional): マップ画像の Base64 文字列。
                - ``waypoints`` (list, optional): 既存の Waypoint リスト。

        Returns:
            Waypoint 辞書のリスト。各要素は以下の形式を推奨:
            ``{"transform": {"x": ..., "y": ..., "qx": 0, "qy": 0, "qz": ..., "qw": ...}, "options": {...}}``

        Raises:
            NotImplementedError: ベースクラスのまま呼ばれた場合
        """
        raise NotImplementedError("Plugins must implement the 'generate' method.")

    # -------------------------------------------------------------------
    # Entry Point: run_from_stdin
    # -------------------------------------------------------------------

    def run_from_stdin(self):
        """stdin から JSON を読み取り、generate() を呼び、結果を stdout へ JSON 出力する。

        Reads JSON context from standard input, calls the `generate` method,
        validates the output, and prints the result as JSON to standard output.

        このメソッドはスクリプトの ``if __name__ == "__main__"`` ブロックから
        呼び出してください。例::

            if __name__ == "__main__":
                MyPlugin().run_from_stdin()
        """
        try:
            # ── Step 1: stdin からコンテキスト JSON を読み取る ──
            input_data = sys.stdin.read()
            if not input_data.strip():
                # 空入力の場合は空リストを返す（テスト実行時など）
                print("[]")
                return

            context = json.loads(input_data)

            # ── Step 2: generate() を実行して Waypoint リストを取得 ──
            result = self.generate(context)

            # ── Step 3: 結果をリスト形式に正規化 ──
            if not isinstance(result, list):
                result = [result]

            # ── Step 4: 出力バリデーション ──
            self._validate_output(result)

            # ── Step 5: stdout へ JSON を出力（ツール本体が受け取る） ──
            print(json.dumps(result))

        except Exception as e:
            # ── エラー時: stderr にトレースバックを出力して非ゼロ終了 ──
            # stdout は JSON 通信チャネルのため、エラー情報は必ず stderr へ。
            import traceback
            print(traceback.format_exc(), file=sys.stderr)
            sys.exit(1)

    # -------------------------------------------------------------------
    # Input Helpers: コンテキストからデータを安全に取得
    # -------------------------------------------------------------------

    @staticmethod
    def get_property(context: Dict[str, Any], name: str, default: Any = None) -> Any:
        """コンテキストからプロパティ値を取得する。

        Safely retrieve a property value from the context.

        Args:
            context: generate() に渡されるコンテキスト辞書
            name:    プロパティ名（manifest.json の properties[].name に対応）
            default: プロパティが存在しない場合のデフォルト値

        Returns:
            プロパティ値。存在しない場合は default。

        Example::

            pitch = self.get_property(context, "pitch_x", default=10.0)
        """
        return context.get("properties", {}).get(name, default)

    @staticmethod
    def get_interaction_data(context: Dict[str, Any], input_id: str) -> Optional[Dict[str, Any]]:
        """コンテキストからインタラクション入力データを取得する。

        Safely retrieve interaction data for a specified input ID.

        インタラクション入力とは、ユーザーが MapCanvas 上で直接操作して定義する
        入力データです (例: クリックで点を配置、ドラッグで矩形を描画)。
        manifest.json の ``inputs`` 配列で宣言した ``id`` をキーとして取得します。

        対応する入力タイプ:
            - ``point``:      ``{"x", "y", "qx", "qy", "qz", "qw"}``
            - ``rectangle``:  ``{"center": {"x", "y"}, "width", "height", "yaw"}``
            - ``polygon``:    (将来対応) 頂点リスト
            - ``path``:       (将来対応) 連続ポイント列
            - ``node_select``:(将来対応) 既存 Waypoint の選択

        Args:
            context:  generate() に渡されるコンテキスト辞書
            input_id: 入力 ID（manifest.json の inputs[].id に対応）

        Returns:
            インタラクションデータ辞書。未設定の場合は None。

        Example::

            start = self.get_interaction_data(context, "start_point")
            if not start:
                return []  # ユーザー入力なし
        """
        return context.get("interaction_data", {}).get(input_id)

    # -------------------------------------------------------------------
    # Quaternion / Yaw Conversion Utilities
    # -------------------------------------------------------------------

    @staticmethod
    def quaternion_to_yaw(point_data: Dict[str, Any]) -> float:
        """クォータニオン (qx, qy, qz, qw) からヨー角 (Z軸回転, ラジアン) を算出する。

        Convert a quaternion to yaw angle (radians).

        ROS の 2D ナビゲーションでは姿勢を Z 軸回りの回転（ヨー角）で表現します。
        この関数は、インタラクション入力の点データ等に含まれるクォータニオンから
        ヨー角を計算します。

        Args:
            point_data: ``qx``, ``qy``, ``qz``, ``qw`` キーを含む辞書

        Returns:
            ヨー角（ラジアン）、範囲 [-π, π]

        Example::

            start = self.get_interaction_data(context, "start_point")
            yaw = self.quaternion_to_yaw(start)
        """
        qx = float(point_data.get("qx", 0.0))
        qy = float(point_data.get("qy", 0.0))
        qz = float(point_data.get("qz", 0.0))
        qw = float(point_data.get("qw", 1.0))
        return math.atan2(2.0 * (qw * qz + qx * qy), 1.0 - 2.0 * (qy * qy + qz * qz))

    @staticmethod
    def yaw_to_quaternion(yaw: float) -> tuple:
        """ヨー角 (ラジアン) からクォータニオン (qx, qy, qz, qw) を算出する。

        Convert a yaw angle (radians) to a quaternion tuple.

        2D 平面ロボットでは Z 軸回転のみなので qx = qy = 0 です。

        Args:
            yaw: ヨー角（ラジアン）

        Returns:
            (qx, qy, qz, qw) のタプル

        Example::

            qx, qy, qz, qw = self.yaw_to_quaternion(math.pi / 2)
        """
        half = yaw / 2.0
        return (0.0, 0.0, math.sin(half), math.cos(half))

    # -------------------------------------------------------------------
    # Output Helper: Waypoint 構築
    # -------------------------------------------------------------------

    @staticmethod
    def make_waypoint(x: float, y: float, yaw: float,
                      options: Optional[Dict[str, Any]] = None,
                      precision: int = 6) -> Waypoint:
        """標準フォーマットの Waypoint 辞書を構築する。

        Build a Waypoint dictionary in the standard transform format.

        この関数を使うことで、出力フォーマット（transform 形式）を手作業で
        組み立てる必要がなくなり、フォーマットの一貫性が保証されます。

        Args:
            x:         X 座標（メートル）
            y:         Y 座標（メートル）
            yaw:       ヨー角（ラジアン）
            options:   任意のメタデータ辞書
            precision: 座標値の丸め桁数（デフォルト 6）

        Returns:
            標準フォーマットの Waypoint 辞書

        Example::

            wp = self.make_waypoint(1.0, 2.0, math.pi / 4, options={"line_id": 0})
        """
        half = yaw / 2.0
        wp: Waypoint = {
            "transform": {
                "x": round(x, precision),
                "y": round(y, precision),
                "qx": 0.0,
                "qy": 0.0,
                "qz": round(math.sin(half), precision),
                "qw": round(math.cos(half), precision),
            },
        }
        if options is not None:
            wp["options"] = options
        return wp

    # -------------------------------------------------------------------
    # Logging Helper
    # -------------------------------------------------------------------

    @staticmethod
    def log(message: str):
        """デバッグメッセージを stderr に出力する。

        Print a debug message to stderr.

        **重要**: stdout は Waypoint Tool との JSON 通信チャネルとして予約されています。
        デバッグ出力には必ずこのメソッド（または ``print(..., file=sys.stderr)``）を
        使用してください。通常の ``print()`` を使うと JSON パースエラーの原因になります。

        Args:
            message: 出力するメッセージ文字列

        Example::

            self.log(f"Processing {len(waypoints)} waypoints")
        """
        print(f"[PLUGIN] {message}", file=sys.stderr)

    # -------------------------------------------------------------------
    # Internal: Output Validation
    # -------------------------------------------------------------------

    def _validate_output(self, waypoints: List[Any]):
        """generate() の出力を検証する（内部メソッド）。

        Validate that the output matches the expected format.

        バリデーションに失敗した場合は stderr に警告を出力しますが、
        プラグインの実行は中断しません（フロントエンド側が両形式に対応しているため）。
        """
        for i, wp in enumerate(waypoints):
            if not isinstance(wp, dict):
                self.log(f"WARNING: Waypoint [{i}] is not a dict: {type(wp)}")
                continue

            if "transform" in wp:
                t = wp["transform"]
                for key in ("x", "y"):
                    if key not in t:
                        self.log(f"WARNING: Waypoint [{i}].transform missing '{key}'")
            elif "x" in wp and "y" in wp:
                # フラットフォーマット（後方互換）— transform 形式の使用を推奨
                self.log(
                    f"INFO: Waypoint [{i}] uses legacy flat format. "
                    f"Consider using make_waypoint() for the standard transform format."
                )
            else:
                self.log(f"WARNING: Waypoint [{i}] has no positional data (x/y or transform)")
