import sys
import json
import math
import traceback
from typing import Dict, Any, List, Optional, TypedDict, Sequence, Union

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
        points = self.get_interaction_points(context, input_id)
        return points[0] if points else None

    def get_interaction_points(self, context: Dict[str, Any], input_id: str) -> List[Point]:
        data = self.get_interaction_data(context, input_id)
        if not data:
            return []
        if isinstance(data, list):
            points = []
            for item in data:
                if isinstance(item, dict) and "x" in item and "y" in item:
                    points.append(Point(
                        x=float(item.get("x", 0.0)),
                        y=float(item.get("y", 0.0)),
                        yaw=quaternion_to_yaw(item)
                    ))
            return points
        elif isinstance(data, dict) and "x" in data and "y" in data:
            return [Point(
                x=float(data.get("x", 0.0)),
                y=float(data.get("y", 0.0)),
                yaw=quaternion_to_yaw(data)
            )]
        return []

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

    def get_annotation(self, context: Dict[str, Any], input_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve single annotation object from interaction_data."""
        data = self.get_interaction_data(context, input_id)
        if not data:
            return None
        if isinstance(data, list):
            return data[0] if data else None
        return data

    def get_annotations(self, context: Dict[str, Any], input_id: str) -> List[Dict[str, Any]]:
        """Retrieve list of annotation objects from interaction_data."""
        data = self.get_interaction_data(context, input_id)
        if not data:
            return []
        if isinstance(data, list):
            return data
        return [data]

    def get_custom_layer(self, context: Dict[str, Any], input_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve single custom layer payload from interaction_data."""
        data = self.get_interaction_data(context, input_id)
        if not data:
            return None
        if isinstance(data, list):
            return data[0] if data else None
        return data

    def get_custom_layers(self, context: Dict[str, Any], input_id: str) -> List[Dict[str, Any]]:
        """Retrieve list of custom layer payloads from interaction_data."""
        data = self.get_interaction_data(context, input_id)
        if not data:
            return []
        if isinstance(data, list):
            return data
        return [data]

    def get_custom_layer_grid(self, custom_layer: Dict[str, Any]) -> Optional['OccupancyGrid']:
        """If custom layer contains occupancy_grid data, return an OccupancyGrid instance, else None."""
        if not custom_layer or not isinstance(custom_layer, dict):
            return None
        grid_data = custom_layer.get("occupancy_grid")
        if grid_data and isinstance(grid_data, dict):
            return OccupancyGrid(grid_data)
        return None

    def get_occupancy_grid(self, context: Dict[str, Any]) -> Optional['OccupancyGrid']:
        """context["occupancy_grid"] を OccupancyGrid インスタンスとして返す。
        needs に "occupancy_grid" / "occupancy_grid_in_region" を指定していない場合は None。"""
        data = context.get("occupancy_grid")
        if data is None:
            return None
        return OccupancyGrid(data)

    @staticmethod
    def get_plugin_data(obj: Any) -> Optional[Dict[str, Any]]:
        """Retrieve plugin_data dictionary from any object (layer, annotation, waypoint, etc.)."""
        if not obj or not isinstance(obj, dict):
            return None
        return obj.get("plugin_data")

    def get_robot_footprint(self, context: Dict[str, Any]) -> Optional[RobotFootprint]:
        """context["robot_footprint"] を RobotFootprint インスタンスとして返す。
        needs に "robot_footprint" を指定していない場合は None。"""
        data = context.get("robot_footprint")
        if data is None:
            return None
        return RobotFootprint.from_dict(data)

    def get_selected_points(self, context: Dict[str, Any]) -> List[Point]:
        """context["selected_points"] を Point のリストとして返す。
        needs に "selected_points" を指定していない場合や空の場合は空リストを返す。"""
        data = context.get("selected_points")
        if not data or not isinstance(data, list):
            return []
        points = []
        for item in data:
            if isinstance(item, dict) and "x" in item and "y" in item:
                points.append(Point(
                    x=float(item.get("x", 0.0)),
                    y=float(item.get("y", 0.0)),
                    yaw=quaternion_to_yaw(item)
                ))
        return points

    @staticmethod
    def log(message: str):
        print(f"[PLUGIN] {message}", file=sys.stderr)

    @staticmethod
    def quaternion_to_yaw(point_data: Dict[str, Any]) -> float:
        return quaternion_to_yaw(point_data)

    @staticmethod
    def yaw_to_quaternion(yaw: float) -> tuple:
        return yaw_to_quaternion(yaw)


class PluginResult:
    """Builder class for unified multi-object plugin outputs."""

    def __init__(self):
        self._waypoints: Optional[Dict[str, Any]] = None
        self._custom_layers: List[Dict[str, Any]] = []
        self._annotations: Optional[Dict[str, Any]] = None
        self._plugin_data: Optional[Dict[str, Any]] = None

    def add_waypoints(self,
                      items: Sequence[Any],
                      name: Optional[str] = None,
                      plugin_data: Optional[Dict[str, Any]] = None) -> 'PluginResult':
        """Add generated waypoints to output."""
        self._waypoints = {
            "items": list(items),
        }
        if name is not None:
            self._waypoints["name"] = name
        if plugin_data is not None:
            self._waypoints["plugin_data"] = plugin_data
        return self

    def add_custom_layer_dict(self,
                              layer_dict: Dict[str, Any],
                              plugin_data: Optional[Dict[str, Any]] = None) -> 'PluginResult':
        """Add a custom layer dictionary to output."""
        l = dict(layer_dict)
        if plugin_data is not None:
            l["plugin_data"] = plugin_data
        self._custom_layers.append(l)
        return self

    def add_custom_layer(self,
                         name: str,
                         mask: Sequence[Sequence[Any]],
                         origin: Sequence[float],
                         resolution: float,
                         blend_mode: str = "overwrite",
                         color_rgba: Any = (34, 197, 94, 180),
                         bg_rgba: Any = (0, 0, 0, 0),
                         plugin_data: Optional[Dict[str, Any]] = None) -> 'PluginResult':
        """Create and add a custom layer from a 2D mask."""
        from .layer import MapLayerGenerator
        layer_dict = MapLayerGenerator.create_layer_from_mask(
            mask_2d=mask,
            origin=origin,
            resolution=resolution,
            name=name,
            blend_mode=blend_mode,
            color_rgba=color_rgba,
            bg_rgba=bg_rgba,
        )
        return self.add_custom_layer_dict(layer_dict, plugin_data=plugin_data)

    def add_annotations(self,
                        items: Sequence[Dict[str, Any]],
                        name: Optional[str] = None,
                        plugin_data: Optional[Dict[str, Any]] = None) -> 'PluginResult':
        """Add generated annotations to output."""
        self._annotations = {
            "items": list(items),
        }
        if name is not None:
            self._annotations["name"] = name
        if plugin_data is not None:
            self._annotations["plugin_data"] = plugin_data
        return self

    def set_plugin_data(self, plugin_data: Dict[str, Any]) -> 'PluginResult':
        """Set root-level plugin_data."""
        self._plugin_data = plugin_data
        return self

    def to_dict(self) -> Dict[str, Any]:
        """Serialize into unified output JSON structure."""
        out: Dict[str, Any] = {}
        if self._waypoints is not None:
            out["waypoints"] = self._waypoints
        if self._custom_layers:
            out["custom_layers"] = self._custom_layers
        if self._annotations is not None:
            out["annotations"] = self._annotations
        if self._plugin_data is not None:
            out["plugin_data"] = self._plugin_data
        return out


class PluginGenerator(PluginBase):
    """Base class for all unified Waypoint Tool generators."""
    empty_output: Any = {}

    def generate(self, context: Dict[str, Any]) -> Union[PluginResult, List[Any], Dict[str, Any]]:
        """Generate outputs. MUST be overridden by subclasses."""
        raise NotImplementedError("Plugins must implement the 'generate' method.")

    def run_from_stdin(self):
        """Standard communication loop via stdin/stdout."""
        try:
            input_data = sys.stdin.read()
            if not input_data.strip():
                print(json.dumps(self.empty_output))
                return

            context = json.loads(input_data)
            result = self.generate(context)

            if isinstance(result, PluginResult):
                payload = result.to_dict()
                print(json.dumps(payload))
            elif isinstance(result, list):
                # Legacy / direct waypoint list return
                self._validate_waypoints(result)
                print(json.dumps(result))
            elif isinstance(result, dict):
                # Legacy / direct layer or unified dict return
                print(json.dumps(result))
            else:
                raise ValueError(f"Unexpected generator return type: {type(result)}")

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

    @staticmethod
    def make_annotation_point(x: float, y: float, name: str = "Point", color: Optional[str] = None) -> Dict[str, Any]:
        anno: Dict[str, Any] = {"type": "point", "x": x, "y": y, "name": name, "visible": True, "labelVisible": True}
        if color:
            anno["color"] = color
        return anno

    @staticmethod
    def make_annotation_oriented_point(x: float, y: float, yaw: float, name: str = "Oriented Point", color: Optional[str] = None) -> Dict[str, Any]:
        anno: Dict[str, Any] = {"type": "oriented_point", "x": x, "y": y, "yaw": yaw, "name": name, "visible": True, "labelVisible": True}
        if color:
            anno["color"] = color
        return anno

    @staticmethod
    def make_annotation_line(x1: float, y1: float, x2: float, y2: float, name: str = "Line", color: Optional[str] = None) -> Dict[str, Any]:
        anno: Dict[str, Any] = {"type": "line", "x1": x1, "y1": y1, "x2": x2, "y2": y2, "name": name, "visible": True, "labelVisible": True}
        if color:
            anno["color"] = color
        return anno

    @staticmethod
    def make_annotation_rect(cx: float, cy: float, width: float, height: float, angle: float = 0.0, name: str = "Rect", color: Optional[str] = None) -> Dict[str, Any]:
        anno: Dict[str, Any] = {"type": "rect", "cx": cx, "cy": cy, "width": width, "height": height, "angle": angle, "name": name, "visible": True, "labelVisible": True}
        if color:
            anno["color"] = color
        return anno

    @staticmethod
    def make_annotation_circle(cx: float, cy: float, radius: float, name: str = "Circle", color: Optional[str] = None) -> Dict[str, Any]:
        anno: Dict[str, Any] = {"type": "circle", "cx": cx, "cy": cy, "radius": radius, "name": name, "visible": True, "labelVisible": True}
        if color:
            anno["color"] = color
        return anno

    def _validate_waypoints(self, waypoints: List[Any]):
        for i, wp in enumerate(waypoints):
            if not isinstance(wp, dict):
                self.log(f"WARNING: Waypoint [{i}] is not a dict: {type(wp)}")
                continue
            if "transform" not in wp and ("x" not in wp or "y" not in wp):
                self.log(f"WARNING: Waypoint [{i}] has no positional data")


class WaypointGenerator(PluginGenerator):
    """Backward compatible class for Waypoint Generator plugins."""
    empty_output: Any = []


