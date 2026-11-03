/**
 * Task primitive registry.
 *
 * A primitive is defined by the user's goal ("lift", "grip"), not by a
 * hardware joint group. Each primitive is grounded in the existing
 * ButtonPadButton commands, so no robot-side code changes are needed.
 * A command may belong to more than one primitive (e.g. base rotation is
 * used to both navigate and align).
 */
import { ButtonPadButton as B } from "../function_providers/ButtonFunctionProvider";

export type PrimitiveId =
    | "navigate"
    | "align"
    | "lift"
    | "reach"
    | "orient"
    | "grip";

export interface PrimitiveCommand {
    command: B;
    /** Plain-language label shown on the button. */
    label: string;
}

export interface Primitive {
    id: PrimitiveId;
    label: string;
    /** One-line description of the goal, shown under the title. */
    goal: string;
    /** Command whose icon represents the primitive as a whole. */
    symbol: B;
    commands: PrimitiveCommand[];
}

export const PRIMITIVES: Record<PrimitiveId, Primitive> = {
    navigate: {
        id: "navigate",
        label: "Navigate",
        goal: "Move the base to the target area",
        symbol: B.BaseForward,
        commands: [
            { command: B.BaseForward, label: "Forward" },
            { command: B.BaseReverse, label: "Backward" },
        ],
    },
    align: {
        id: "align",
        label: "Align",
        goal: "Turn to face the task",
        symbol: B.BaseRotateLeft,
        commands: [
            { command: B.BaseRotateLeft, label: "Turn left" },
            { command: B.BaseRotateRight, label: "Turn right" },
        ],
    },
    lift: {
        id: "lift",
        label: "Lift",
        goal: "Raise or lower to line up with the object",
        symbol: B.ArmLift,
        commands: [
            { command: B.ArmLift, label: "Raise" },
            { command: B.ArmLower, label: "Lower" },
        ],
    },
    reach: {
        id: "reach",
        label: "Reach",
        goal: "Extend toward or pull back from a space",
        symbol: B.ArmExtend,
        commands: [
            { command: B.ArmExtend, label: "Extend" },
            { command: B.ArmRetract, label: "Retract" },
        ],
    },
    orient: {
        id: "orient",
        label: "Orient",
        goal: "Adjust the gripper angle",
        symbol: B.WristPitchUp,
        commands: [
            { command: B.WristRotateIn, label: "Rotate in" },
            { command: B.WristRotateOut, label: "Rotate out" },
            { command: B.WristPitchUp, label: "Pitch up" },
            { command: B.WristPitchDown, label: "Pitch down" },
            { command: B.WristRollLeft, label: "Roll left" },
            { command: B.WristRollRight, label: "Roll right" },
        ],
    },
    grip: {
        id: "grip",
        label: "Grip",
        goal: "Open or close the gripper",
        symbol: B.GripperClose,
        commands: [
            { command: B.GripperOpen, label: "Open" },
            { command: B.GripperClose, label: "Close" },
        ],
    },
};

/** Display order for primitives that aren't active (secondary drawer). */
export const PRIMITIVE_ORDER: PrimitiveId[] = [
    "navigate",
    "align",
    "lift",
    "reach",
    "orient",
    "grip",
];
