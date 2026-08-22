import sys
import json
import math
import traceback
from typing import Dict, Any, List, Optional, TypedDict

from .geometry import Point, Rectangle, Line
from .utils import normalize_yaw, quaternion_to_yaw, yaw_to_quaternion
from .occupancy_grid import OccupancyGrid
from .footprint import RobotFootprint

class Transform(TypedDict, total=False):
    x: float
    y: float
    qx: float
    qy: float
    qz: float
    qw: float

class Waypoint(TypedDict, total=False):
    transform: Transform
    options: Dict[str, Any]

class PluginBase:
    """Base class for all Waypoint Tool Python plugins."""

    @staticmethod
    def get_property(context: Dict[str, Any], name: str, default: Any = None) -> Any:
        return context.get("properties", {}).get(name, default)

    @staticmethod
    def get_interaction_data(context: Dict[str, Any], input_id: str) -> Optional[Dict[str, Any]]:
        return context.get("interaction_data", {}).get(input_id)

    def get_interaction_point(self, context: Dict[str, Any], input_id: str) -> Optional[Point]:
        data = self.get_interaction_data(context, input_id)
        if not data:
            return None
        return Point(
            x=data.get("x", 0.0),
            y=data.get("y", 0.0),
            yaw=quaternion_to_yaw(data)
        )

    def get_interaction_rect(self, context: Dict[str, Any], input_id: str) -> Optional[Rectangle]:
        data = self.get_interaction_data(context, input_id)
        if not data:
            return None
        center_data = data.get("center", {})
        center = Point(center_data.get("x", 0.0), center_data.get("y", 0.0))
        return Rectangle(
            center=center,
            width=data.get("width", 1.0),
            height=data.get("height", 1.0),
            yaw=data.get("yaw", 0.0)
        )

    def get_occupancy_grid(self, context: Dict[str, Any]) -> Optional['OccupancyGrid']:
        """context["occupancy_grid"] を OccupancyGrid インスタンスとして返す。
        needs に "occupancy_grid" / "occupancy_grid_in_region" を指定していない場合は None。"""
        data = context.get("occupancy_grid")
        if data is None:
            return None
        return OccupancyGrid(data)

    def get_robot_footprint(self, context: Dict[str, Any]) -> Optional[RobotFootprint]:
        """context["robot_footprint"] を RobotFootprint インスタンスとして返す。
        needs に "robot_footprint" を指定していない場合は None。"""
        data = context.get("robot_footprint")
        if data is None:
            return None
        return RobotFootprint.from_dict(data)

    @staticmethod
    def log(message: str):
        print(f"[PLUGIN] {message}", file=sys.stderr)

    @staticmethod
    def quaternion_to_yaw(point_data: Dict[str, Any]) -> float:
        return quaternion_to_yaw(point_data)

    @staticmethod
    def yaw_to_quaternion(yaw: float) -> tuple:
        return yaw_to_quaternion(yaw)


class WaypointGenerator(PluginBase):
    """Base class for Waypoint Generator plugins."""

    def generate(self, context: Dict[str, Any]) -> List[Waypoint]:
        """Generate waypoints. MUST be overridden by subclasses."""
        raise NotImplementedError("Plugins must implement the 'generate' method.")

    def run_from_stdin(self):
        """Standard communication loop via stdin/stdout."""
        try:
            input_data = sys.stdin.read()
            if not input_data.strip():
                print("[]")
                return

            context = json.loads(input_data)
            result = self.generate(context)

            if not isinstance(result, list):
                result = [result]

            self._validate_output(result)
            print(json.dumps(result))

        except Exception:
            print(traceback.format_exc(), file=sys.stderr)
            sys.exit(1)

    @staticmethod
    def make_waypoint(x: float, y: float, yaw: float,
                       options: Optional[Dict[str, Any]] = None,
                       precision: int = 6) -> Waypoint:
        qx, qy, qz, qw = yaw_to_quaternion(yaw)
        wp: Waypoint = {
            "transform": {
                "x": round(x, precision),
                "y": round(y, precision),
                "qx": qx,
                "qy": qy,
                "qz": round(qz, precision),
                "qw": round(qw, precision),
            },
        }
        if options is not None:
            wp["options"] = options
        return wp

    def _validate_output(self, waypoints: List[Any]):
        for i, wp in enumerate(waypoints):
            if not isinstance(wp, dict):
                self.log(f"WARNING: Waypoint [{i}] is not a dict: {type(wp)}")
                continue
            if "transform" not in wp and ("x" not in wp or "y" not in wp):
                self.log(f"WARNING: Waypoint [{i}] has no positional data")

