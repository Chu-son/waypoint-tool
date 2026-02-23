import sys
import json
from typing import Dict, Any, List

class WaypointGenerator:
    """
    Base class for Waypoint Tool Python generator plugins.
    To create a plugin, inherit from this class and implement the `generate` method.
    At the end of your script, call `YourPluginClass().run_from_stdin()`.
    
    [アーキテクチャ背景]
    Waypoint Tool本体（Rust/Tauri）とは、OSの標準入出力（stdin/stdout）を介して通信します。
    これにより、Python側に重いHTTPサーバーやRPCライブラリを用意する必要がなく、
    スクリプトが単一のプレーンなプロセスとして非常に軽量に実行・終了できる設計となっています。
    """

    def generate(self, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Generate waypoints based on the provided context.
        
        Args:
            context: A dictionary containing:
                - 'map_info': dict with resolution and origin
                - 'map_image': (optional) base64 string of the map
                - 'waypoints': (optional) list of existing waypoints
                - 'interaction_data': data from user UI inputs (e.g. paths, rectangles)
                - 'properties': custom parameters provided via the UI
                
        Returns:
            A list of dictionary objects representing the generated waypoints.
            Each waypoint should have 'x', 'y', and an optional 'yaw'.
            It can also include an 'options' dictionary for custom schema properties.
        """
        raise NotImplementedError("Plugins must implement the 'generate' method.")

    def run_from_stdin(self):
        """
        Reads JSON context from standard input, calls the `generate` method,
        and prints the result as JSON to standard output.
        """
        try:
            # Read input from waypoint-tool (via stdin)
            input_data = sys.stdin.read()
            if not input_data.strip():
                # Provide an empty context if strictly running for testing
                print("[]")
                return

            context = json.loads(input_data)
            
            # Execute plugin logic
            result = self.generate(context)
            
            # Ensure the result is a list
            if not isinstance(result, list):
                result = [result]

            # Output result to waypoint-tool (via stdout)
            print(json.dumps(result))

        except Exception as e:
            # Print exceptions to stderr so waypoint-tool can display the error
            import traceback
            print(traceback.format_exc(), file=sys.stderr)
            sys.exit(1)
