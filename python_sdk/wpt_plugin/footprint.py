import math
from typing import Dict, Any, List, Optional, Union, Tuple
from .geometry import Point


class RobotFootprint:
    """Represents a robot's physical dimensions (footprint).

    Supports three geometric shapes:
    - 'circular': radius (meters, > 0)
    - 'rectangular': length (> 0), width (> 0), offset_x, offset_y (meters)
    - 'polygon': list of at least 3 (x, y) vertices in robot frame (meters)
    """

    def __init__(
        self,
        footprint_type: str,
        radius: Optional[float] = None,
        length: Optional[float] = None,
        width: Optional[float] = None,
        offset_x: float = 0.0,
        offset_y: float = 0.0,
        points: Optional[List[Point]] = None,
    ):
        self.type = footprint_type.lower()
        if self.type == "circular":
            if radius is None or radius <= 0:
                raise ValueError("Radius must be a positive number for circular footprint.")
            self.radius = float(radius)
            self.length = 0.0
            self.width = 0.0
            self.offset_x = 0.0
            self.offset_y = 0.0
            self.points = []
        elif self.type == "rectangular":
            if length is None or length <= 0 or width is None or width <= 0:
                raise ValueError("Length and width must be positive numbers for rectangular footprint.")
            self.radius = 0.0
            self.length = float(length)
            self.width = float(width)
            self.offset_x = float(offset_x)
            self.offset_y = float(offset_y)
            self.points = []
        elif self.type == "polygon":
            if not points or len(points) < 3:
                raise ValueError("Polygon footprint requires at least 3 vertices.")
            self.radius = 0.0
            self.length = 0.0
            self.width = 0.0
            self.offset_x = 0.0
            self.offset_y = 0.0
            self.points = list(points)
        else:
            raise ValueError(f"Unsupported footprint type: '{footprint_type}'")

    @classmethod
    def circular(cls, radius: float) -> 'RobotFootprint':
        """Construct a circular footprint."""
        return cls("circular", radius=radius)

    @classmethod
    def rectangular(
        cls,
        length: float,
        width: float,
        offset_x: float = 0.0,
        offset_y: float = 0.0,
    ) -> 'RobotFootprint':
        """Construct a rectangular footprint."""
        return cls("rectangular", length=length, width=width, offset_x=offset_x, offset_y=offset_y)

    @classmethod
    def polygon(
        cls,
        points: List[Union[Point, Tuple[float, float], List[float]]],
    ) -> 'RobotFootprint':
        """Construct a polygon footprint from a list of vertices."""
        parsed_points: List[Point] = []
        if points:
            for pt in points:
                if isinstance(pt, Point):
                    parsed_points.append(pt)
                elif isinstance(pt, (tuple, list)) and len(pt) >= 2:
                    parsed_points.append(Point(float(pt[0]), float(pt[1])))
                else:
                    raise ValueError(f"Invalid vertex format: {pt}")
        return cls("polygon", points=parsed_points)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'RobotFootprint':
        """Construct a RobotFootprint instance from dictionary data (e.g. from context['robot_footprint']).

        Raises:
            TypeError: if data is not a dictionary.
            KeyError: if required keys are missing for the specified type.
            ValueError: if values or type are invalid.
        """
        if not isinstance(data, dict):
            raise TypeError(f"Footprint data must be a dictionary, got {type(data)}")
        if "type" not in data:
            raise KeyError("Footprint dictionary missing required key: 'type'")

        fp_type = str(data["type"]).lower()
        if fp_type == "circular":
            if "radius" not in data:
                raise KeyError("Circular footprint requires 'radius'")
            return cls.circular(float(data["radius"]))

        elif fp_type == "rectangular":
            if "length" not in data or "width" not in data:
                raise KeyError("Rectangular footprint requires 'length' and 'width'")
            return cls.rectangular(
                length=float(data["length"]),
                width=float(data["width"]),
                offset_x=float(data.get("offset_x", 0.0)),
                offset_y=float(data.get("offset_y", 0.0)),
            )

        elif fp_type == "polygon":
            if "points" not in data:
                raise KeyError("Polygon footprint requires 'points'")
            return cls.polygon(data["points"])

        else:
            raise ValueError(f"Unknown footprint type: '{fp_type}'")

    def to_polygon(self, num_circle_segments: int = 16) -> List[Point]:
        """Return the footprint vertices in the robot local frame."""
        if self.type == "circular":
            pts = []
            for i in range(num_circle_segments):
                angle = 2.0 * math.pi * i / num_circle_segments
                pts.append(Point(self.radius * math.cos(angle), self.radius * math.sin(angle)))
            return pts

        elif self.type == "rectangular":
            half_l = self.length / 2.0
            half_w = self.width / 2.0
            ox = self.offset_x
            oy = self.offset_y
            return [
                Point(ox + half_l, oy + half_w),
                Point(ox - half_l, oy + half_w),
                Point(ox - half_l, oy - half_w),
                Point(ox + half_l, oy - half_w),
            ]

        elif self.type == "polygon":
            return list(self.points)

        return []

    def to_world(self, x: float, y: float, yaw: float, num_circle_segments: int = 16) -> List[Point]:
        """Return the footprint polygon vertices transformed into the world frame at pose (x, y, yaw)."""
        local_pts = self.to_polygon(num_circle_segments=num_circle_segments)
        return [pt.to_world(x, y, yaw) for pt in local_pts]

    def is_point_inside(
        self,
        px: float,
        py: float,
        robot_x: float,
        robot_y: float,
        robot_yaw: float,
    ) -> bool:
        """Check if a world coordinate point (px, py) lies within the robot footprint at pose (robot_x, robot_y, robot_yaw)."""
        dx = px - robot_x
        dy = py - robot_y
        cos_yaw = math.cos(-robot_yaw)
        sin_yaw = math.sin(-robot_yaw)
        lx = dx * cos_yaw - dy * sin_yaw
        ly = dx * sin_yaw + dy * cos_yaw

        if self.type == "circular":
            return (lx ** 2 + ly ** 2) <= (self.radius ** 2)

        elif self.type == "rectangular":
            half_l = self.length / 2.0
            half_w = self.width / 2.0
            return (
                abs(lx - self.offset_x) <= half_l
                and abs(ly - self.offset_y) <= half_w
            )

        elif self.type == "polygon":
            pts = self.points
            if len(pts) < 3:
                return False
            inside = False
            j = len(pts) - 1
            for i in range(len(pts)):
                xi, yi = pts[i].x, pts[i].y
                xj, yj = pts[j].x, pts[j].y
                if ((yi > ly) != (yj > ly)) and (lx < (xj - xi) * (ly - yi) / (yj - yi + 1e-12) + xi):
                    inside = not inside
                j = i
            return inside

        return False

    def get_bounding_radius(self) -> float:
        """Return the maximum distance from the robot origin to any point on the footprint."""
        if self.type == "circular":
            return self.radius
        elif self.type == "rectangular":
            half_l = self.length / 2.0
            half_w = self.width / 2.0
            c1 = math.hypot(self.offset_x + half_l, self.offset_y + half_w)
            c2 = math.hypot(self.offset_x - half_l, self.offset_y + half_w)
            c3 = math.hypot(self.offset_x - half_l, self.offset_y - half_w)
            c4 = math.hypot(self.offset_x + half_l, self.offset_y - half_w)
            return max(c1, c2, c3, c4)
        elif self.type == "polygon":
            if not self.points:
                return 0.0
            return max(math.hypot(pt.x, pt.y) for pt in self.points)
        return 0.0

    def __repr__(self) -> str:
        if self.type == "circular":
            return f"RobotFootprint.circular(radius={self.radius})"
        elif self.type == "rectangular":
            return f"RobotFootprint.rectangular(length={self.length}, width={self.width}, offset_x={self.offset_x}, offset_y={self.offset_y})"
        elif self.type == "polygon":
            return f"RobotFootprint.polygon(points_count={len(self.points)})"
        return f"RobotFootprint(type='{self.type}')"
