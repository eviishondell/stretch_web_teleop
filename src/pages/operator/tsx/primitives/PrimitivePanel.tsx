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
import { IntentPayload, TASK_PHASES } from "./intent";
import { PRIMITIVES, PRIMITIVE_ORDER, PrimitiveId } from "./primitives";
import "operator/css/PrimitivePanel.css";

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

    return (
        <section className="primitive-panel" aria-label="Task controls">
            <header className="primitive-panel__header">
                <span className="primitive-panel__eyebrow">Current task</span>
                <h2 className="primitive-panel__phase">{payload.phaseLabel}</h2>
            </header>

            <div className="primitive-panel__active">
                {active.map((id) => (
                    <PrimitiveCard
                        key={id}
                        id={id}
                        sharedState={sharedState}
                        size="large"
                    />
                ))}
            </div>

            {payload.suggestion && (
                <button
                    type="button"
                    className="primitive-panel__suggestion"
                    onClick={() =>
                        props.onAcceptSuggestion(payload.suggestion!.id)
                    }
                >
                    Done? Switch to <strong>{payload.suggestion.label}</strong>
                    {payload.likelyNext.length > 0 && (
                        <span className="primitive-panel__suggestion-detail">
                            {payload.likelyNext
                                .map((id) => PRIMITIVES[id].label)
                                .join(" · ")}
                        </span>
                    )}
                </button>
            )}

            {secondary.length > 0 && (
                <button
                    type="button"
                    className="primitive-panel__toggle"
                    aria-expanded={showSecondary}
                    onClick={() => setShowSecondary(!showSecondary)}
                >
                    {showSecondary
                        ? "− Hide other controls"
                        : `+ Other controls (${secondary.length})`}
                </button>
            )}

            {showSecondary && (
                <div className="primitive-panel__secondary">
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
    return (
        <div className={`primitive-card primitive-card--${props.size}`}>
            <h3 className="primitive-card__title">{primitive.label}</h3>
            <p className="primitive-card__goal">{primitive.goal}</p>
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
                            className={className("primitive-command", {
                                [state]: true,
                            })}
                            onPointerDown={functs.onClick}
                            onPointerUp={functs.onRelease}
                            onPointerLeave={functs.onLeave}
                        >
                            {label}
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
