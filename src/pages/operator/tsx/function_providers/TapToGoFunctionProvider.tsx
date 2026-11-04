import { TapToGoStatus } from "shared/util";
import { FunctionProvider } from "./FunctionProvider";

type Listener = (status: TapToGoStatus) => void;

/**
 * Sends tap-to-go commands to the robot and fans its statuses out to any
 * mounted view. See nodes/tap_to_go.py for the protocol.
 */
export class TapToGoFunctionProvider extends FunctionProvider {
    private listeners = new Set<Listener>();
    private nextId = 1;

    constructor() {
        super();
        this.plan = this.plan.bind(this);
        this.execute = this.execute.bind(this);
        this.cancel = this.cancel.bind(this);
        this.setStatus = this.setStatus.bind(this);
    }

    /** Ask the robot to plan a move to a tapped spot. Returns the request id. */
    plan(scaled_u: number, scaled_v: number): number {
        const id = this.nextId++;
        FunctionProvider.remoteRobot?.tapToGo({
            action: "plan",
            id,
            scaled_u,
            scaled_v,
        });
        return id;
    }

    /** Run the plan with this id (the operator confirmed it). */
    execute(id: number) {
        FunctionProvider.remoteRobot?.tapToGo({ action: "execute", id });
    }

    /** Drop a pending plan, or stop a motion in progress. */
    cancel(id: number) {
        FunctionProvider.remoteRobot?.tapToGo({ action: "cancel", id });
    }

    /** Point the head camera at the floor ahead, where taps can be measured. */
    lookAtFloorAhead() {
        FunctionProvider.remoteRobot?.setRobotPose({
            joint_head_pan: 0.075,
            joint_head_tilt: -0.6,
        });
    }

    /** Called when a status arrives from the robot. */
    setStatus(status: TapToGoStatus) {
        this.listeners.forEach((listener) => listener(status));
    }

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}

export const tapToGoFunctionProvider = new TapToGoFunctionProvider();
