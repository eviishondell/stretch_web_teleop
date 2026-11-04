"""
Pure planning helpers for tap-to-go (no ROS imports, so they can be unit
tested anywhere).

Given the tapped point in the robot's base frame (x forward, y left, z up,
origin on the floor under the base), plan a "turn in place, then drive
straight" motion. This is deliberately simple and predictable: no path
planning and no obstacle avoidance, which is why the operator must confirm
every plan before it runs.
"""

import math
from dataclasses import dataclass
from typing import Dict, Optional, Tuple

# A tapped point higher than this is treated as an object (table, cup,
# person), not floor: stop short of it instead of driving onto it.
OBJECT_HEIGHT_M = 0.12
# How far short of a tapped object to stop (base center to object).
OBJECT_STANDOFF_M = 0.45
# Refuse targets closer than this (base center to point).
MIN_DISTANCE_M = 0.25
# Refuse drives longer than this. Keep conservative while testing.
MAX_DRIVE_M = 2.0
# Below these, skip the turn / the drive.
MIN_TURN_RAD = math.radians(1.5)
MIN_DRIVE_M = 0.02


@dataclass
class BasePlan:
    turn_rad: float  # positive = counter-clockwise (left)
    drive_m: float  # forward distance after turning
    target: str  # "floor" or "object"


def plan_base_motion(x: float, y: float, z: float) -> Tuple[Optional[BasePlan], str]:
    """
    Plan a turn-then-drive motion to a point in the base frame.

    Returns (plan, message). plan is None when the target is rejected, and
    message then explains why in words the operator can act on.
    """
    if not all(math.isfinite(v) for v in (x, y, z)):
        return None, "Couldn't find that spot in 3D. Try tapping a different spot."

    distance = math.hypot(x, y)
    if distance < MIN_DISTANCE_M:
        return None, "That spot is right next to the robot."

    is_object = z > OBJECT_HEIGHT_M
    standoff = OBJECT_STANDOFF_M if is_object else 0.0
    drive = max(0.0, distance - standoff)
    turn = math.atan2(y, x)

    if drive > MAX_DRIVE_M:
        return None, (
            f"That spot is {drive:.1f} m away; the limit is {MAX_DRIVE_M:.1f} m. "
            "Tap somewhere closer."
        )

    if abs(turn) < MIN_TURN_RAD:
        turn = 0.0
    if drive < MIN_DRIVE_M:
        drive = 0.0

    plan = BasePlan(
        turn_rad=turn, drive_m=drive, target="object" if is_object else "floor"
    )
    return plan, "ok"


def inverse_transform_pixel(
    scaled_u: float,
    scaled_v: float,
    params: Optional[Dict],
    width: int,
    height: int,
) -> Tuple[float, float]:
    """
    Map a tap on the streamed image (u, v in [0, 1]) back to pixel
    coordinates of the raw camera image, undoing the crop and rotation that
    configure_video_streams.py applies before streaming.

    Same logic as MoveToPregraspNode.inverse_transform_pixel, but tolerant of
    params being None.
    """
    params = params or {}
    rotate = params.get("rotate")
    crop = params.get("crop")
    w, h = width, height

    if rotate is not None and "ROTATE_90" in rotate:
        u = scaled_u * h
        v = scaled_v * w
    else:
        u = scaled_u * w
        v = scaled_v * h

    if crop is not None:
        u += crop.get("x_min", 0) or 0
        v += crop.get("y_min", 0) or 0

    if rotate is not None:
        if rotate == "ROTATE_90_CLOCKWISE":
            u, v = v, h - u
        elif rotate == "ROTATE_180":
            u, v = w - u, h - v
        elif rotate == "ROTATE_90_COUNTERCLOCKWISE":
            u, v = w - v, u
        else:
            raise ValueError(f"Invalid rotate value: {rotate}")

    return u, v
