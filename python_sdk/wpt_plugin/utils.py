import math
from typing import Dict, Any, Tuple

def normalize_yaw(yaw: float) -> float:
    """Normalize yaw to [-pi, pi]."""
    return math.atan2(math.sin(yaw), math.cos(yaw))

def quaternion_to_yaw(point_data: Dict[str, Any]) -> float:
    """Convert a quaternion (qx, qy, qz, qw) to yaw angle (radians)."""
    qx = float(point_data.get("qx", 0.0))
    qy = float(point_data.get("qy", 0.0))
    qz = float(point_data.get("qz", 0.0))
    qw = float(point_data.get("qw", 1.0))
    return math.atan2(2.0 * (qw * qz + qx * qy), 1.0 - 2.0 * (qy * qy + qz * qz))

def yaw_to_quaternion(yaw: float) -> Tuple[float, float, float, float]:
    """Convert a yaw angle (radians) to a quaternion tuple (qx, qy, qz, qw)."""
    half = yaw / 2.0
    return (0.0, 0.0, math.sin(half), math.cos(half))
