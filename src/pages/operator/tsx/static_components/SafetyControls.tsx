import React from "react";
import { className } from "shared/util";
import { batteryVoltageFunctionProvider, runStopFunctionProvider } from "..";

/** Battery colors reported by BatteryVoltageFunctionProvider → wording. */
const BATTERY_LEVELS: Record<string, { label: string; level: number }> = {
    green: { label: "Battery good", level: 4 },
    "yellow-green": { label: "Battery fair", level: 3 },
    yellow: { label: "Battery low", level: 2 },
    "orange-yellow": { label: "Battery very low", level: 1 },
    red: { label: "Charge now", level: 0 },
};

/**
 * Compact run stop + battery for the header. Replaces the full Safety
 * panel while operating, so the body has room for task controls.
 * The run stop stays a large target and is the only red element.
 */
export const SafetyControls = () => {
    const [stopped, setStopped] = React.useState<boolean>(
        runStopFunctionProvider.isEnabled,
    );
    const [battery, setBattery] = React.useState("green");

    // Providers hold a single callback, so (re)claim it on every render.
    runStopFunctionProvider.setRunStopStateChangeCallback(setStopped);
    batteryVoltageFunctionProvider.setVoltageChangeCallback(setBattery);

    const { onClick } = runStopFunctionProvider.provideFunctions();
    const level = BATTERY_LEVELS[battery] ?? BATTERY_LEVELS.green;

    return (
        <div className="safety-controls">
            <div
                className={className("battery-chip", {
                    low: level.level <= 1,
                })}
                role="status"
                aria-label={level.label}
                title={level.label}
            >
                <span className="battery-chip__cells" aria-hidden="true">
                    {[0, 1, 2, 3].map((i) => (
                        <span
                            key={i}
                            className={className("battery-chip__cell", {
                                on: i < level.level,
                            })}
                        />
                    ))}
                </span>
                <span className="battery-chip__label">{level.label}</span>
            </div>
            <button
                type="button"
                className={className("run-stop", { stopped })}
                aria-pressed={stopped}
                onClick={onClick}
            >
                <span className="run-stop__icon" aria-hidden="true" />
                {stopped ? "Resume robot" : "Stop robot"}
            </button>
        </div>
    );
};
