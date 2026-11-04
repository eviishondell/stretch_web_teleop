"""
Checks for tap-to-go planning geometry. No ROS needed:
    python3 tests/test_tap_to_go_plan.py
"""
import math
import os
import sys

sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), "..", "stretch_web_teleop_helpers")
)
from tap_to_go_plan import plan_base_motion, inverse_transform_pixel, MAX_DRIVE_M, OBJECT_STANDOFF_M
# floor point straight ahead
p,m=plan_base_motion(1.5,0,0.01); assert p and abs(p.turn_rad)<1e-9 and abs(p.drive_m-1.5)<1e-9 and p.target=="floor",(p,m)
# floor point to the left: turn +90 deg
p,m=plan_base_motion(0,1.0,0.0); assert abs(math.degrees(p.turn_rad)-90)<1e-6 and abs(p.drive_m-1.0)<1e-9
# right: negative turn
p,m=plan_base_motion(1,-1,0); assert abs(math.degrees(p.turn_rad)+45)<1e-6
# object (table height): stop short
p,m=plan_base_motion(1.2,0,0.75); assert p.target=="object" and abs(p.drive_m-(1.2-OBJECT_STANDOFF_M))<1e-9
# object closer than standoff: turn only
p,m=plan_base_motion(0.3,0.1,0.8); assert p.drive_m==0.0 and p.turn_rad!=0
# too close / too far / nan
assert plan_base_motion(0.1,0,0)[0] is None
p,m=plan_base_motion(MAX_DRIVE_M+0.5,0,0); assert p is None and "limit" in m
assert plan_base_motion(float("nan"),0,0)[0] is None
# tiny turn zeroed
p,m=plan_base_motion(1.0,0.01,0); assert p.turn_rad==0.0
# pixel inverse: rotate 90 CW, 640x480 raw -> stream is 480 wide x 640 tall
prm={"rotate":"ROTATE_90_CLOCKWISE","crop":None}
u,v=inverse_transform_pixel(0.5,0.5,prm,640,480); assert (u,v)==(320.0,240.0),(u,v)
# top-left of rotated stream = bottom-left of raw image
u,v=inverse_transform_pixel(0,0,prm,640,480); assert (u,v)==(0.0,480.0),(u,v)
u,v=inverse_transform_pixel(0.25,0.75,None,640,480); assert (u,v)==(160.0,360.0)
print("all plan tests passed")
