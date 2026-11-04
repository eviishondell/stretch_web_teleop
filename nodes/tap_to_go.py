#!/usr/bin/env python3
"""
Tap to go.

The operator taps a spot on the head (Realsense) camera feed. This node finds
that spot in 3D, plans a "turn in place, then drive straight" base motion to
it, and reports the plan back. The robot only moves after the operator
confirms. There is no path planning or obstacle avoidance: the confirmation
step is the operator's chance to check the way is clear.

Interface (std_msgs/String carrying JSON, so no custom ROS interfaces):

  /tap_to_go/command  (in)
      {"id": 3, "action": "plan", "scaled_u": 0.52, "scaled_v": 0.81}
      {"id": 3, "action": "execute"}
      {"id": 3, "action": "cancel"}

  /tap_to_go/status   (out)
      {"id": 3, "state": "planned" | "moving" | "arrived" | "failed" | "cancelled",
       "turn_deg": 12.0, "drive_m": 1.3, "target": "floor" | "object",
       "message": "..."}

Usage: tap_to_go.py <configure_video_streams_params.yaml>
"""

import json
import math
import sys
import threading
import time
from typing import Dict, Optional, Tuple

import numpy as np
import rclpy
import tf2_ros
import yaml
from builtin_interfaces.msg import Duration as DurationMsg
from control_msgs.action import FollowJointTrajectory
from cv_bridge import CvBridge
from geometry_msgs.msg import Point
from rclpy.action import ActionClient
from rclpy.callback_groups import ReentrantCallbackGroup
from rclpy.duration import Duration
from rclpy.executors import MultiThreadedExecutor
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy
from rclpy.time import Time
from rclpy.utilities import remove_ros_args
from sensor_msgs.msg import CameraInfo, CompressedImage
from std_msgs.msg import String
from std_srvs.srv import Trigger
from tf2_geometry_msgs import PoseStamped
from trajectory_msgs.msg import JointTrajectoryPoint

from stretch_web_teleop_helpers.conversions import (
    deproject_pixel_to_pointcloud_point,
    depth_img_to_pointcloud,
    ros_msg_to_cv2_image,
    tf2_transform,
)
from stretch_web_teleop_helpers.tap_to_go_plan import (
    BasePlan,
    inverse_transform_pixel,
    plan_base_motion,
)

BASE_FRAME = "base_link"
ODOM_FRAME = "odom"
# A confirmed plan is only valid if the robot hasn't moved since planning.
MAX_PLAN_AGE_S = 120.0
MAX_MOVED_M = 0.05
MAX_TURNED_RAD = math.radians(3.0)
# Per-motion timeout (turn or drive).
MOTION_TIMEOUT_S = 40.0


class TapToGoNode(Node):
    def __init__(self, image_params_file: str):
        super().__init__("tap_to_go")
        with open(image_params_file, "r") as f:
            image_params = yaml.safe_load(f) or {}
        self.realsense_params = image_params.get("realsense", {}).get("default")

        self.cb_group = ReentrantCallbackGroup()
        self.tf_timeout = Duration(seconds=0.5)
        self.tf_buffer = tf2_ros.Buffer()
        self.tf_listener = tf2_ros.TransformListener(self.tf_buffer, self)
        self.cv_bridge = CvBridge()

        # Latest head-camera depth + intrinsics (same topics as pregrasp)
        self.lock = threading.Lock()
        self.latest_depth: Optional[CompressedImage] = None
        self.latest_info: Optional[CameraInfo] = None
        best_effort = QoSProfile(depth=1, reliability=ReliabilityPolicy.BEST_EFFORT)
        self.create_subscription(
            CompressedImage,
            "/camera/aligned_depth_to_color/image_raw/compressedDepth",
            self.depth_cb,
            qos_profile=best_effort,
            callback_group=self.cb_group,
        )
        self.create_subscription(
            CameraInfo,
            "/camera/aligned_depth_to_color/camera_info",
            self.info_cb,
            qos_profile=best_effort,
            callback_group=self.cb_group,
        )

        # Operator interface
        self.status_pub = self.create_publisher(String, "/tap_to_go/status", 10)
        self.create_subscription(
            String,
            "/tap_to_go/command",
            self.command_cb,
            10,
            callback_group=self.cb_group,
        )

        # Robot motion
        self.trajectory_client = ActionClient(
            self,
            FollowJointTrajectory,
            "/stretch_controller/follow_joint_trajectory",
            callback_group=self.cb_group,
        )
        self.position_mode_client = self.create_client(
            Trigger, "/switch_to_position_mode", callback_group=self.cb_group
        )

        # State: at most one plan, at most one motion
        self.plan: Optional[Dict] = None
        self.motion_lock = threading.Lock()
        self.cancel_event = threading.Event()
        self.active_goal_handle = None

        self.get_logger().info("Tap to go is ready.")

    # ------------------------------------------------------------------ io
    def depth_cb(self, msg: CompressedImage) -> None:
        with self.lock:
            self.latest_depth = msg

    def info_cb(self, msg: CameraInfo) -> None:
        with self.lock:
            self.latest_info = msg

    def send_status(self, request_id: int, state: str, message: str = "", **extra):
        payload = {"id": request_id, "state": state, "message": message, **extra}
        self.status_pub.publish(String(data=json.dumps(payload)))
        self.get_logger().info(f"status: {payload}")

    def command_cb(self, msg: String) -> None:
        try:
            cmd = json.loads(msg.data)
            request_id = int(cmd.get("id", -1))
            action = cmd.get("action")
        except (ValueError, TypeError) as e:
            self.get_logger().error(f"Malformed tap_to_go command {msg.data!r}: {e}")
            return

        if action == "plan":
            self.handle_plan(request_id, cmd)
        elif action == "execute":
            # Run in a thread so this callback returns and the executor keeps
            # spinning (action futures, TF, cancel commands).
            threading.Thread(
                target=self.handle_execute, args=(request_id,), daemon=True
            ).start()
        elif action == "cancel":
            self.handle_cancel(request_id)
        else:
            self.send_status(request_id, "failed", f"Unknown action {action!r}.")

    # ---------------------------------------------------------------- plan
    def handle_plan(self, request_id: int, cmd: Dict) -> None:
        if self.motion_lock.locked():
            self.send_status(request_id, "failed", "The robot is already moving.")
            return
        try:
            u = float(cmd["scaled_u"])
            v = float(cmd["scaled_v"])
        except (KeyError, TypeError, ValueError):
            self.send_status(request_id, "failed", "The tap had no position.")
            return

        point = self.deproject(u, v)
        if point is None:
            self.send_status(
                request_id,
                "failed",
                "Couldn't measure that spot. Point the head camera at the floor "
                "ahead and tap again.",
            )
            return

        x, y, z = point
        plan, message = plan_base_motion(x, y, z)
        if plan is None:
            self.send_status(request_id, "failed", message)
            return

        odom_pose = self.base_pose_in_odom()
        self.plan = {
            "id": request_id,
            "plan": plan,
            "time": time.monotonic(),
            "odom": odom_pose,
        }
        self.send_status(
            request_id,
            "planned",
            "Ready. Confirm to move.",
            turn_deg=round(math.degrees(plan.turn_rad), 1),
            drive_m=round(plan.drive_m, 2),
            target=plan.target,
        )

    def deproject(self, scaled_u: float, scaled_v: float) -> Optional[Tuple]:
        """Tapped point in the base frame (x, y, z), or None."""
        with self.lock:
            depth_msg, info = self.latest_depth, self.latest_info
        if depth_msg is None or info is None:
            self.get_logger().error("No head-camera depth or camera info yet.")
            return None

        depth_image = ros_msg_to_cv2_image(depth_msg, self.cv_bridge)
        pointcloud = depth_img_to_pointcloud(
            depth_image, f_x=info.k[0], f_y=info.k[4], c_x=info.k[2], c_y=info.k[5]
        )
        u, v = inverse_transform_pixel(
            scaled_u, scaled_v, self.realsense_params, info.width, info.height
        )
        cam_point = deproject_pixel_to_pointcloud_point(
            u, v, pointcloud, np.array(info.p).reshape(3, 4)
        )
        if cam_point is None:
            return None

        pose = PoseStamped()
        pose.header.frame_id = depth_msg.header.frame_id
        pose.header.stamp = Time().to_msg()  # use the latest transform
        pose.pose.position = Point(
            x=float(cam_point[0]), y=float(cam_point[1]), z=float(cam_point[2])
        )
        pose.pose.orientation.w = 1.0
        ok, base_pose = tf2_transform(
            self.tf_buffer, pose, BASE_FRAME, self.tf_timeout
        )
        if not ok:
            self.get_logger().error("Couldn't transform the tapped point to base_link.")
            return None
        p = base_pose.pose.position
        return p.x, p.y, p.z

    def base_pose_in_odom(self) -> Optional[Tuple[float, float, float]]:
        try:
            t = self.tf_buffer.lookup_transform(
                ODOM_FRAME, BASE_FRAME, Time(), timeout=self.tf_timeout
            )
        except tf2_ros.TransformException:
            return None
        q = t.transform.rotation
        yaw = math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y**2 + q.z**2))
        return t.transform.translation.x, t.transform.translation.y, yaw

    # ------------------------------------------------------------- execute
    def handle_execute(self, request_id: int) -> None:
        stored = self.plan
        if stored is None or stored["id"] != request_id:
            self.send_status(request_id, "failed", "Nothing to confirm. Tap a spot first.")
            return
        if time.monotonic() - stored["time"] > MAX_PLAN_AGE_S:
            self.plan = None
            self.send_status(request_id, "failed", "That plan expired. Tap again.")
            return
        if self.robot_moved_since(stored["odom"]):
            self.plan = None
            self.send_status(
                request_id, "failed", "The robot moved since you tapped. Tap again."
            )
            return
        if not self.motion_lock.acquire(blocking=False):
            self.send_status(request_id, "failed", "The robot is already moving.")
            return

        plan: BasePlan = stored["plan"]
        self.plan = None
        self.cancel_event.clear()
        try:
            self.switch_to_position_mode()
            self.send_status(
                request_id,
                "moving",
                "Moving.",
                turn_deg=round(math.degrees(plan.turn_rad), 1),
                drive_m=round(plan.drive_m, 2),
                target=plan.target,
            )
            for joint, value in (
                ("rotate_mobile_base", plan.turn_rad),
                ("translate_mobile_base", plan.drive_m),
            ):
                if value == 0.0:
                    continue
                ok, why = self.move_base_joint(joint, value)
                if self.cancel_event.is_set():
                    self.send_status(request_id, "cancelled", "Stopped.")
                    return
                if not ok:
                    self.send_status(request_id, "failed", why)
                    return
            self.send_status(request_id, "arrived", "Arrived.")
        finally:
            self.active_goal_handle = None
            self.motion_lock.release()

    def robot_moved_since(self, then: Optional[Tuple[float, float, float]]) -> bool:
        now = self.base_pose_in_odom()
        if then is None or now is None:
            # Can't verify; allow it (the operator confirmed after seeing the view).
            return False
        moved = math.hypot(now[0] - then[0], now[1] - then[1])
        turned = abs(math.atan2(math.sin(now[2] - then[2]), math.cos(now[2] - then[2])))
        return moved > MAX_MOVED_M or turned > MAX_TURNED_RAD

    def switch_to_position_mode(self) -> None:
        if not self.position_mode_client.wait_for_service(timeout_sec=1.0):
            self.get_logger().warn("/switch_to_position_mode unavailable; continuing.")
            return
        future = self.position_mode_client.call_async(Trigger.Request())
        self.wait_for(future, 3.0)

    def move_base_joint(self, joint: str, value: float) -> Tuple[bool, str]:
        """Relative base move via the Stretch driver (position mode)."""
        if not self.trajectory_client.wait_for_server(timeout_sec=2.0):
            return False, "The robot's motion controller isn't available."

        goal = FollowJointTrajectory.Goal()
        goal.trajectory.joint_names = [joint]
        point = JointTrajectoryPoint()
        point.positions = [float(value)]
        # Matches what the web interface sends for base increments.
        point.time_from_start = DurationMsg(sec=1, nanosec=0)
        goal.trajectory.points = [point]

        send_future = self.trajectory_client.send_goal_async(goal)
        if not self.wait_for(send_future, 5.0):
            return False, "The robot didn't accept the motion."
        handle = send_future.result()
        if handle is None or not handle.accepted:
            return False, "The robot rejected the motion."
        self.active_goal_handle = handle

        result_future = handle.get_result_async()
        if not self.wait_for(result_future, MOTION_TIMEOUT_S):
            handle.cancel_goal_async()
            return False, "The motion took too long and was stopped."
        if self.cancel_event.is_set():
            return False, "Stopped."
        result = result_future.result()
        code = result.result.error_code if result is not None else -1
        if code != FollowJointTrajectory.Result.SUCCESSFUL:
            msg = result.result.error_string if result is not None else ""
            return False, f"The robot stopped early ({msg or code})."
        return True, ""

    def wait_for(self, future, timeout_s: float) -> bool:
        deadline = time.monotonic() + timeout_s
        while not future.done():
            if time.monotonic() > deadline:
                return False
            time.sleep(0.05)
        return True

    # -------------------------------------------------------------- cancel
    def handle_cancel(self, request_id: int) -> None:
        if self.plan is not None and self.plan["id"] == request_id:
            self.plan = None
        if self.motion_lock.locked():
            self.cancel_event.set()
            handle = self.active_goal_handle
            if handle is not None:
                handle.cancel_goal_async()
            # handle_execute reports "cancelled" when the motion ends.
        else:
            self.send_status(request_id, "cancelled", "Cancelled.")


def main(args=None):
    rclpy.init()
    argv = remove_ros_args(sys.argv)[1:]
    if len(argv) < 1:
        print("Usage: tap_to_go.py <configure_video_streams_params.yaml>")
        sys.exit(1)
    node = TapToGoNode(argv[0])
    executor = MultiThreadedExecutor()
    try:
        rclpy.spin(node, executor=executor)
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
