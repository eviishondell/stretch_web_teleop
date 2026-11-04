import React from "react";
import { className, TapToGoStatus } from "shared/util";
import { ButtonPadButton } from "../function_providers/ButtonFunctionProvider";
import { tapToGoFunctionProvider } from "../function_providers/TapToGoFunctionProvider";
import { getIcon } from "../utils/svg";
import "operator/css/TapToGo.css";

/**
 * Tap to go: the head camera fills the screen. Tap a spot, check the plan,
 * confirm, and the robot turns and drives there. Nothing moves without the
 * confirm step, and Stop is the largest control while moving.
 *
 * Talks to nodes/tap_to_go.py through tapToGoFunctionProvider.
 */

type Phase = "idle" | "planning" | "planned" | "moving" | "arrived" | "failed";

/** No reply in this long means the robot side isn't running. */
const PLAN_TIMEOUT_MS = 6000;
const ARRIVED_CLEAR_MS = 2500;

export const TapToGoView = (props: {
    stream?: MediaStream;
    phaseLabel: string;
    showWords: boolean;
    onUseButtons: () => void;
}) => {
    const { stream, showWords } = props;
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const [aspect, setAspect] = React.useState(9 / 16);
    const [phase, setPhase] = React.useState<Phase>("idle");
    const [tap, setTap] = React.useState<{ u: number; v: number } | null>(
        null,
    );
    const [status, setStatus] = React.useState<TapToGoStatus | null>(null);
    const [error, setError] = React.useState<string>("");
    const requestId = React.useRef<number | null>(null);
    const phaseRef = React.useRef<Phase>("idle");
    phaseRef.current = phase;

    // Attach the stream and keep the picture's real shape
    React.useEffect(() => {
        const video = videoRef.current;
        if (!video || !stream) return;
        video.srcObject = stream;
        video.play().catch(() => undefined);
        const update = () => {
            if (video.videoWidth && video.videoHeight)
                setAspect(video.videoWidth / video.videoHeight);
        };
        video.addEventListener("loadedmetadata", update);
        video.addEventListener("resize", update);
        update();
        return () => {
            video.removeEventListener("loadedmetadata", update);
            video.removeEventListener("resize", update);
        };
    }, [stream]);

    // Statuses from the robot, for the current request only
    React.useEffect(
        () =>
            tapToGoFunctionProvider.subscribe((s) => {
                if (s.id !== requestId.current) return;
                setStatus(s);
                switch (s.state) {
                    case "planned":
                        setPhase("planned");
                        break;
                    case "moving":
                        setPhase("moving");
                        break;
                    case "arrived":
                        setPhase("arrived");
                        break;
                    case "failed":
                        setError(s.message);
                        setPhase("failed");
                        break;
                    case "cancelled":
                        setTap(null);
                        setPhase("idle");
                        break;
                }
            }),
        [],
    );

    // Planning watchdog
    React.useEffect(() => {
        if (phase !== "planning") return;
        const timer = window.setTimeout(() => {
            if (phaseRef.current !== "planning") return;
            setError(
                "No answer from the robot. Check that the tap_to_go node is " +
                    "running (look for “Tap to go is ready.” in the robot terminal).",
            );
            setPhase("failed");
        }, PLAN_TIMEOUT_MS);
        return () => window.clearTimeout(timer);
    }, [phase]);

    // Clear the marker a moment after arriving
    React.useEffect(() => {
        if (phase !== "arrived") return;
        const timer = window.setTimeout(() => {
            setTap(null);
            setPhase("idle");
        }, ARRIVED_CLEAR_MS);
        return () => window.clearTimeout(timer);
    }, [phase]);

    // Leaving the view drops any pending plan (never a motion: Stop does that)
    React.useEffect(
        () => () => {
            if (phaseRef.current === "planned" && requestId.current !== null)
                tapToGoFunctionProvider.cancel(requestId.current);
        },
        [],
    );

    function handleTap(event: React.PointerEvent<HTMLDivElement>) {
        if (phase === "moving" || phase === "planning") return;
        const video = videoRef.current;
        if (!video) return;
        const rect = video.getBoundingClientRect();
        const u = (event.clientX - rect.left) / rect.width;
        const v = (event.clientY - rect.top) / rect.height;
        if (u < 0 || u > 1 || v < 0 || v > 1) return;

        if (phase === "planned" && requestId.current !== null)
            tapToGoFunctionProvider.cancel(requestId.current);
        setTap({ u, v });
        setStatus(null);
        setError("");
        setPhase("planning");
        requestId.current = tapToGoFunctionProvider.plan(u, v);
    }

    function confirm() {
        if (phase !== "planned" || requestId.current === null) return;
        tapToGoFunctionProvider.execute(requestId.current);
        setPhase("moving");
    }

    function cancelPlan() {
        if (requestId.current !== null)
            tapToGoFunctionProvider.cancel(requestId.current);
        setTap(null);
        setPhase("idle");
    }

    function stop() {
        if (requestId.current !== null)
            tapToGoFunctionProvider.cancel(requestId.current);
    }

    const showPath = tap && (phase === "planned" || phase === "moving");

    return (
        <section
            className="tap-stage"
            aria-label="Tap to go"
            style={{ "--video-ar": aspect } as React.CSSProperties}
        >
            <div className="tap-stage__camera" onPointerDown={handleTap}>
                <div className="tap-stage__frame">
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="tap-stage__video"
                    />
                    {!stream && (
                        <p className="tap-stage__no-video">
                            Add the head camera (Realsense) to use tap to go.
                        </p>
                    )}
                    <svg
                        className="tap-stage__overlay"
                        viewBox="0 0 100 100"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                    >
                        {showPath && (
                            <line
                                x1={50}
                                y1={100}
                                x2={tap!.u * 100}
                                y2={tap!.v * 100}
                                className="tap-stage__path"
                                vectorEffect="non-scaling-stroke"
                            />
                        )}
                    </svg>
                    {tap && (
                        <span
                            className={className("tap-stage__marker", {
                                pending: phase === "planning",
                                failed: phase === "failed",
                            })}
                            style={{
                                left: `${tap.u * 100}%`,
                                top: `${tap.v * 100}%`,
                            }}
                            aria-hidden="true"
                        />
                    )}
                </div>
            </div>

            <aside className="tap-stage__panel">
                <h2 className="tap-stage__phase">{props.phaseLabel}</h2>

                {(phase === "idle" || phase === "planning") && (
                    <div className="tap-stage__prompt" role="status">
                        <TapIcon />
                        {showWords && (
                            <p>
                                {phase === "planning"
                                    ? "Measuring that spot…"
                                    : "Tap where you want the robot to go."}
                            </p>
                        )}
                    </div>
                )}

                {phase === "planned" && status && (
                    <>
                        <PlanSummary status={status} showWords={showWords} />
                        <div className="tap-stage__actions">
                            <button
                                type="button"
                                className="tap-btn tap-btn--go"
                                aria-label="Go"
                                onClick={confirm}
                            >
                                <CheckIcon />
                                {showWords && <span>Go</span>}
                            </button>
                            <button
                                type="button"
                                className="tap-btn tap-btn--cancel"
                                aria-label="Cancel"
                                onClick={cancelPlan}
                            >
                                <CrossIcon />
                                {showWords && <span>Cancel</span>}
                            </button>
                        </div>
                        {showWords && (
                            <p className="tap-stage__note">
                                It drives straight, without steering around
                                things. Check the path is clear.
                            </p>
                        )}
                    </>
                )}

                {phase === "moving" && (
                    <div className="tap-stage__actions">
                        <button
                            type="button"
                            className="tap-btn tap-btn--stop"
                            aria-label="Stop"
                            onClick={stop}
                        >
                            <StopIcon />
                            {showWords && <span>Stop</span>}
                        </button>
                    </div>
                )}

                {phase === "arrived" && (
                    <div className="tap-stage__prompt done" role="status">
                        <CheckIcon />
                        {showWords && <p>Arrived.</p>}
                    </div>
                )}

                {phase === "failed" && (
                    <div className="tap-stage__prompt failed" role="alert">
                        <CrossIcon />
                        <p>{error}</p>
                    </div>
                )}

                <div className="tap-stage__tools">
                    <button
                        type="button"
                        className="tap-btn tap-btn--tool"
                        aria-label="Look at the floor ahead"
                        title="Look at the floor ahead"
                        disabled={phase === "moving"}
                        onClick={() =>
                            tapToGoFunctionProvider.lookAtFloorAhead()
                        }
                    >
                        <LookDownIcon />
                        {showWords && <span>Look at floor</span>}
                    </button>
                    <button
                        type="button"
                        className="tap-btn tap-btn--tool"
                        aria-label="Use drive buttons instead"
                        title="Use drive buttons instead"
                        disabled={phase === "moving"}
                        onClick={props.onUseButtons}
                    >
                        <img
                            src={getIcon(ButtonPadButton.BaseForward)}
                            alt=""
                            className="tap-stage__icon-img"
                        />
                        {showWords && <span>Drive buttons</span>}
                    </button>
                </div>
            </aside>
        </section>
    );
};

const PlanSummary = (props: { status: TapToGoStatus; showWords: boolean }) => {
    const turn = props.status.turn_deg ?? 0;
    const drive = props.status.drive_m ?? 0;
    const left = turn > 0;
    const turnText =
        turn === 0
            ? "No turn"
            : `Turn ${Math.abs(Math.round(turn))}° ${left ? "left" : "right"}`;
    const driveText =
        drive === 0 ? "No driving" : `Drive ${drive.toFixed(1)} m`;
    return (
        <dl className="tap-plan" aria-label={`${turnText}. ${driveText}.`}>
            <div className="tap-plan__row">
                <dt>
                    <img
                        src={getIcon(
                            left
                                ? ButtonPadButton.BaseRotateLeft
                                : ButtonPadButton.BaseRotateRight,
                        )}
                        alt=""
                        className="tap-stage__icon-img"
                    />
                </dt>
                <dd>
                    {turn === 0
                        ? "0°"
                        : `${Math.abs(Math.round(turn))}°`}
                    {props.showWords && <span>{turnText}</span>}
                </dd>
            </div>
            <div className="tap-plan__row">
                <dt>
                    <img
                        src={getIcon(ButtonPadButton.BaseForward)}
                        alt=""
                        className="tap-stage__icon-img"
                    />
                </dt>
                <dd>
                    {`${drive.toFixed(1)} m`}
                    {props.showWords && (
                        <span>
                            {driveText}
                            {props.status.target === "object"
                                ? ", stopping in front of it"
                                : ""}
                        </span>
                    )}
                </dd>
            </div>
        </dl>
    );
};

/* Small inline icons (decorative; buttons carry aria-labels) */
const TapIcon = () => (
    <svg viewBox="0 0 48 48" className="tap-icon" aria-hidden="true">
        <circle cx="24" cy="18" r="9" fill="none" strokeWidth="3" />
        <circle cx="24" cy="18" r="3" />
        <path d="M24 30v12M18 36l6 6 6-6" fill="none" strokeWidth="3" />
    </svg>
);
const CheckIcon = () => (
    <svg viewBox="0 0 48 48" className="tap-icon" aria-hidden="true">
        <path d="M10 25l9 9 19-20" fill="none" strokeWidth="5" />
    </svg>
);
const CrossIcon = () => (
    <svg viewBox="0 0 48 48" className="tap-icon" aria-hidden="true">
        <path d="M13 13l22 22M35 13L13 35" fill="none" strokeWidth="5" />
    </svg>
);
const StopIcon = () => (
    <svg viewBox="0 0 48 48" className="tap-icon" aria-hidden="true">
        <rect x="12" y="12" width="24" height="24" rx="3" />
    </svg>
);
const LookDownIcon = () => (
    <svg viewBox="0 0 48 48" className="tap-icon" aria-hidden="true">
        <ellipse cx="24" cy="16" rx="13" ry="8" fill="none" strokeWidth="3" />
        <circle cx="24" cy="16" r="3.5" />
        <path d="M24 28v13M18 35l6 6 6-6" fill="none" strokeWidth="3" />
    </svg>
);
