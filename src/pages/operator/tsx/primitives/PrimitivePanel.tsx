import React from "react";
import { className } from "shared/util";
import { buttonFunctionProvider } from "operator/tsx/index";
import {
    ButtonFunctions,
    ButtonState,
} from "../function_providers/ButtonFunctionProvider";
import { SharedState } from "../layout_components/CustomizableComponent";
import { notHomedDisabledFunctions } from "../layout_components/ButtonPad";
import { Dropdown } from "../basic_components/Dropdown";
import { getIcon } from "../utils/svg";
import { ButtonPadButton } from "../function_providers/ButtonFunctionProvider";
import { IntentPayload, TASK_PHASES } from "./intent";
import { PRIMITIVES, PRIMITIVE_ORDER, PrimitiveId } from "./primitives";
import "operator/css/PrimitivePanel.css";

/**
 * Symbol for a command. Decorative to assistive tech: the owning button
 * always carries the spoken name via aria-label.
 */
const Symbol = (props: { command: ButtonPadButton; className?: string }) => {
    const src = getIcon(props.command);
    return src ? (
        <img
            src={src}
            alt=""
            aria-hidden="true"
            draggable={false}
            className={className("primitive-symbol", {
                [props.className ?? ""]: !!props.className,
            })}
        />
    ) : null;
};

/**
 * Label display. Symbols are always shown; words are added only when the
 * layout's "Display button text labels" option is on. That option is the
 * hook onboarding will set from the person's ability profile — some users
 * can't read, so symbols-first is the default.
 */
const showWords = (sharedState: SharedState) => !sharedState.hideLabels;

/**
 * Layout renderer for task primitives. It only reads an IntentPayload —
 * it does not know whether intent came from a manual picker or an
 * inference model.
 */
export const PrimitivePanel = (props: {
    payload: IntentPayload;
    sharedState: SharedState;
    onAcceptSuggestion: (id: string) => void;
}) => {
    const { payload, sharedState } = props;
    const [showSecondary, setShowSecondary] = React.useState(false);

    // Collapse the drawer whenever the task phase changes.
    React.useEffect(() => setShowSecondary(false), [payload.phaseLabel]);

    const active = payload.activePrimitives;
    const secondary = PRIMITIVE_ORDER.filter((id) => !active.includes(id));
    const words = showWords(sharedState);

    return (
        <section
            className={className("primitive-panel", { "symbols-only": !words })}
            aria-label="Task controls"
        >
            <div className="primitive-panel__heading">
                <h2 className="primitive-panel__phase">{payload.phaseLabel}</h2>
                <span className="primitive-panel__phase-symbols">
                    {active.map((id) => (
                        <Symbol key={id} command={PRIMITIVES[id].symbol} />
                    ))}
                </span>
            </div>

            {/* Columns = number of active primitives, so the rail fills the
                screen without scrolling. NOTE: the camera/controls split and
                these sizes are fixed for now; later they should adapt to the
                ability profile (e.g. low vision needs a bigger camera view)
                and to the task. */}
            <div
                className="primitive-panel__active"
                style={{ "--cols": active.length } as React.CSSProperties}
            >
                {active.map((id) => (
                    <PrimitiveCard
                        key={id}
                        id={id}
                        sharedState={sharedState}
                        size="large"
                    />
                ))}
            </div>

            {showSecondary && (
                <div
                    className="primitive-panel__secondary"
                    style={{ "--cols": secondary.length } as React.CSSProperties}
                >
                    {secondary.map((id) => (
                        <PrimitiveCard
                            key={id}
                            id={id}
                            sharedState={sharedState}
                            size="small"
                        />
                    ))}
                </div>
            )}

            <div className="primitive-panel__footer">
            {payload.suggestion && (
                <button
                    type="button"
                    className="primitive-panel__suggestion"
                    aria-label={`Done here? Go to ${payload.suggestion.label}`}
                    onClick={() =>
                        props.onAcceptSuggestion(payload.suggestion!.id)
                    }
                >
                    <span
                        className="primitive-panel__suggestion-go"
                        aria-hidden="true"
                    />
                    <span className="primitive-panel__suggestion-symbols">
                        {payload.likelyNext.map((id) => (
                            <Symbol key={id} command={PRIMITIVES[id].symbol} />
                        ))}
                    </span>
                    {words && (
                        <span className="primitive-panel__suggestion-title">
                            Done here? Go to {payload.suggestion.label}
                        </span>
                    )}
                </button>
            )}

            {secondary.length > 0 && (
                <button
                    type="button"
                    className="primitive-panel__toggle"
                    aria-expanded={showSecondary}
                    aria-label={
                        showSecondary
                            ? "Hide other controls"
                            : `Show ${secondary.length} other controls`
                    }
                    onClick={() => setShowSecondary(!showSecondary)}
                >
                    <span
                        className="primitive-panel__toggle-mark"
                        aria-hidden="true"
                    >
                        {showSecondary ? "−" : "+"}
                    </span>
                    {words &&
                        (showSecondary
                            ? "Hide other controls"
                            : `Other controls (${secondary.length})`)}
                </button>
            )}
            </div>
        </section>
    );
};

/** One primitive: its goal plus the commands that achieve it. */
const PrimitiveCard = (props: {
    id: PrimitiveId;
    sharedState: SharedState;
    size: "large" | "small";
}) => {
    const primitive = PRIMITIVES[props.id];
    const words = showWords(props.sharedState);
    return (
        <div className={`primitive-card primitive-card--${props.size}`}>
            <h3 className="primitive-card__title">
                <Symbol command={primitive.symbol} className="title" />
                {primitive.label}
            </h3>
            {words && <p className="primitive-card__goal">{primitive.goal}</p>}
            <div className="primitive-card__commands">
                {primitive.commands.map(({ command, label }) => {
                    const functs: ButtonFunctions =
                        buttonFunctionProvider.provideFunctions(command);
                    const state: ButtonState =
                        props.sharedState.buttonStateMap?.get(command) ||
                        ButtonState.Inactive;
                    const disabled =
                        props.sharedState.robotNotHomed &&
                        notHomedDisabledFunctions.has(command);
                    return (
                        <button
                            key={command}
                            type="button"
                            disabled={disabled}
                            aria-label={label}
                            title={label}
                            className={className("primitive-command", {
                                [state]: true,
                            })}
                            onPointerDown={functs.onClick}
                            onPointerUp={functs.onRelease}
                            onPointerLeave={functs.onLeave}
                        >
                            <Symbol command={command} />
                            {words && (
                                <span className="primitive-command__label">
                                    {label}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

/** Header dropdown: the manual intent source's input. */
export const TaskPhaseDropdown = (props: {
    phaseId: string;
    onChange: (id: string) => void;
    disabled?: boolean;
}) => (
    <div
        className={className("task-phase-dropdown", {
            disabled: !!props.disabled,
        })}
        aria-disabled={props.disabled}
        title={
            props.disabled
                ? "Task phases are paused while customizing"
                : "Current task"
        }
    >
        <Dropdown
            onChange={(idx) => props.onChange(TASK_PHASES[idx].id)}
            selectedIndex={Math.max(
                0,
                TASK_PHASES.findIndex((p) => p.id === props.phaseId),
            )}
            possibleOptions={TASK_PHASES.map((p) => p.label)}
            showActive
            placement="bottom"
        />
    </div>
);
