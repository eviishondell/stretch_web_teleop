/**
 * Presentation settings: HOW an intent is shown, as opposed to WHAT the
 * user is trying to do (intent.ts). These are the knobs the ability
 * profile will set during onboarding; for now the operator toggles them and
 * the choice is remembered in this browser.
 */
import React from "react";
import { PrimitiveId } from "./primitives";

/**
 * How travel (navigate/align) is presented:
 * - "buttons": press-and-hold or click drive buttons in the task rail
 * - "tapToGo": the camera fills the screen; tap a spot, confirm, and the
 *   robot drives there (no sustained input needed)
 */
export type TravelPresentation = "buttons" | "tapToGo";

const STORAGE_KEY = "teleop.travelPresentation";

function readStored(): TravelPresentation {
    try {
        const v = window.localStorage.getItem(STORAGE_KEY);
        if (v === "buttons" || v === "tapToGo") return v;
    } catch {
        /* storage unavailable */
    }
    return "buttons";
}

export function useTravelPresentation() {
    const [travel, setTravelState] =
        React.useState<TravelPresentation>(readStored);
    const setTravel = React.useCallback((value: TravelPresentation) => {
        setTravelState(value);
        try {
            window.localStorage.setItem(STORAGE_KEY, value);
        } catch {
            /* non-fatal */
        }
    }, []);
    return { travel, setTravel };
}

/** Tap to go applies when the current phase is about moving the base. */
export function phaseSupportsTapToGo(active: PrimitiveId[]): boolean {
    return active.includes("navigate");
}
