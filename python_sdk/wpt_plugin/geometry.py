import math
from typing import List, Optional, Tuple, Dict, Any
from .utils import normalize_yaw

class Point:
    def __init__(self, x: float, y: float, yaw: Optional[float] = None):
        self.x = float(x)
        self.y = float(y)
        self.yaw = float(yaw) if yaw is not None else None

    def distance_to(self, other: 'Point') -> float:
        return math.sqrt((self.x - other.x)**2 + (self.y - other.y)**2)

    def offset(self, dx: float, dy: float) -> 'Point':
        return Point(self.x + dx, self.y + dy, self.yaw)

    def vector_to(self, other: 'Point') -> Tuple[float, float]:
        return (other.x - self.x, other.y - self.y)

    def to_world(self, base_x: float, base_y: float, base_yaw: float) -> 'Point':
        """Transform local point to world coordinates."""
        cos_y = math.cos(base_yaw)
        sin_y = math.sin(base_yaw)
        wx = base_x + (self.x * cos_y - self.y * sin_y)
        wy = base_y + (self.x * sin_y + self.y * cos_y)
        w_yaw = (self.yaw + base_yaw) if self.yaw is not None else None
        if w_yaw is not None:
            w_yaw = normalize_yaw(w_yaw)
        return Point(wx, wy, w_yaw)

    def to_dict(self) -> Dict[str, Any]:
        d = {"x": self.x, "y": self.y}
        if self.yaw is not None:
            d["yaw"] = self.yaw
        return d

    def __repr__(self):
        return f"Point(x={self.x}, y={self.y}, yaw={self.yaw})"

class Line:
    def __init__(self, p1: Point, p2: Point):
        self.p1 = p1
        self.p2 = p2

    def length(self) -> float:
        return self.p1.distance_to(self.p2)

    def yaw(self) -> float:
        """Get the angle of the line from p1 to p2."""
        return math.atan2(self.p2.y - self.p1.y, self.p2.x - self.p1.x)

    def perpendicular_yaw(self, clockwise: bool = False) -> float:
        """Get the angle perpendicular to the line."""
        angle = self.yaw()
        offset = -math.pi / 2.0 if clockwise else math.pi / 2.0
        return normalize_yaw(angle + offset)

    def midpoint(self) -> Point:
        return Point((self.p1.x + self.p2.x) / 2.0, (self.p1.y + self.p2.y) / 2.0)

    def intersect_line(self, other: 'Line') -> Optional[Point]:
        """Find intersection of two finite lines. Returns None if no intersection."""
        x1, y1 = self.p1.x, self.p1.y
        x2, y2 = self.p2.x, self.p2.y
        x3, y3 = other.p1.x, other.p1.y
        x4, y4 = other.p2.x, other.p2.y

        denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)
        if denom == 0:
            return None  # Parallel

        ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom
        ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom

        eps = 1e-9
        if -eps <= ua <= 1 + eps and -eps <= ub <= 1 + eps:
            return Point(x1 + ua * (x2 - x1), y1 + ua * (y2 - y1))
        return None

class Ray:
    def __init__(self, origin: Point, yaw: float, bidirectional: bool = False):
        self.origin = origin
        self.yaw = yaw
        self.bidirectional = bidirectional

    def intersect_line(self, target: Line) -> Optional[Point]:
        """Intersection of an infinite (or semi-infinite) line with a finite line segment."""
        # Ray as p + t*v
        px, py = self.origin.x, self.origin.y
        vx, vy = math.cos(self.yaw), math.sin(self.yaw)

        # Line segment as q + u*w
        qx, qy = target.p1.x, target.p1.y
        wx, wy = target.p2.x - qx, target.p2.y - qy

        # Solve p + t*v = q + u*w
        # t*vx - u*wx = qx - px
        # t*vy - u*wy = qy - py
        
        det = -vx * wy + vy * wx
        if abs(det) < 1e-9:
            return None
        
        t = (-(qx - px) * wy + (qy - py) * wx) / det
        u = (vx * (qy - py) - vy * (qx - px)) / det

        eps = 1e-9
        if -eps <= u <= 1 + eps:
            if self.bidirectional or t >= -eps:
                return Point(px + t * vx, py + t * vy)
        return None

class Rectangle:
    def __init__(self, center: Point, width: float, height: float, yaw: float):
        self.center = center
        self.width = width
        self.height = height
        self.yaw = yaw

    def get_corners(self) -> List[Point]:
        """Get 4 corners in world coordinates."""
        hw = self.width / 2.0
        hh = self.height / 2.0
        
        # Corners in local coords (relative to center)
        local_corners = [
            Point(-hw, -hh),
            Point(hw, -hh),
            Point(hw, hh),
            Point(-hw, hh)
        ]
        
        return [p.to_world(self.center.x, self.center.y, self.yaw) for p in local_corners]

    def contains(self, p: Point) -> bool:
        """Check if point is inside the rectangle."""
        # Convert P to local coordinates of the rectangle
        dx = p.x - self.center.x
        dy = p.y - self.center.y
        cos_y = math.cos(-self.yaw)
        sin_y = math.sin(-self.yaw)
        lx = dx * cos_y - dy * sin_y
        ly = dx * sin_y + dy * cos_y
        
        return abs(lx) <= self.width / 2.0 and abs(ly) <= self.height / 2.0

    def intersect_ray(self, r: Ray) -> List[Point]:
        """Find intersections of a ray with the rectangle edges."""
        corners = self.get_corners()
        edges = [
            Line(corners[0], corners[1]),
            Line(corners[1], corners[2]),
            Line(corners[2], corners[3]),
            Line(corners[3], corners[0])
        ]
        
        intersections = []
        for edge in edges:
            ipt = r.intersect_line(edge)
            if ipt:
                # Avoid duplicate points at corners
                if not any(ipt.distance_to(existing) < 1e-6 for existing in intersections):
                    intersections.append(ipt)
        return intersections

    def intersect_line(self, l: Line) -> List[Point]:
        """Find intersections of a line segment with the rectangle edges."""
        corners = self.get_corners()
        edges = [
            Line(corners[0], corners[1]),
            Line(corners[1], corners[2]),
            Line(corners[2], corners[3]),
            Line(corners[3], corners[0])
        ]
        
        intersections = []
        for edge in edges:
            ipt = l.intersect_line(edge)
            if ipt:
                if not any(ipt.distance_to(existing) < 1e-6 for existing in intersections):
                    intersections.append(ipt)
        return intersections

class Circle:
    def __init__(self, center: Point, radius: float):
        self.center = center
        self.radius = float(radius)

    def contains(self, p: Point) -> bool:
        return self.center.distance_to(p) <= self.radius

    def __repr__(self):
        return f"Circle(center={self.center}, radius={self.radius})"
