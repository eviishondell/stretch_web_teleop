/**
 * Intent engine contract (MARLUI-style decoupling).
 *
 * The intent engine decides WHAT the user is trying to do and emits an
 * IntentPayload. The layout renderer decides HOW to show it. Neither
 * knows about the other's internals, so the manual source below can be
 * replaced by an inferred one (CASPER/TASC-style) without touching the
 * renderer or any robot control code.
 */
import React from "react";
import { PrimitiveId } from "./primitives";

export interface IntentPayload {
    /** Human-readable name of the current task phase. */
    phaseLabel: string;
    /** Primitives shown front and center. */
    activePrimitives: PrimitiveId[];
    /** Primitives the user is likely to need next (shown on the pill). */
    likelyNext: PrimitiveId[];
    /** Proposed next phase; the user confirms it, it is never automatic. */
    suggestion?: { id: string; label: string };
    /** 0–1. Manual phases are 1; an inferred source would vary this. */
    confidence: number;
    source: "manual" | "inferred";
}

// ---------------------------------------------------------------------
// Manual (Wizard-of-Oz) intent source
// ---------------------------------------------------------------------

export interface TaskPhase {
    id: string;
    label: string;
    active: PrimitiveId[];
    /** Phase suggested once this one is done. */
    next?: string;
}

/**
 * Task phases for the manual source. These are research decisions —
 * edit freely. "all" is the unfiltered stock interface.
 */
export const TASK_PHASES: TaskPhase[] = [
    { id: "all", label: "All Controls", active: [] },
    { id: "travel", label: "Travel", active: ["navigate", "align"], next: "lineup" },
    { id: "lineup", label: "Line Up", active: ["align", "lift", "reach"], next: "grasp" },
    { id: "grasp", label: "Grasp", active: ["orient", "grip"], next: "carry" },
    { id: "carry", label: "Carry", active: ["lift", "reach", "navigate"], next: "travel" },
];

const ALL_PHASE_ID = "all";
const STORAGE_KEY = "teleop.taskPhase";

function phaseById(id: string): TaskPhase | undefined {
    return TASK_PHASES.find((p) => p.id === id);
}

function readStoredPhase(): string {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored && phaseById(stored)) return stored;
    } catch {
        /* storage unavailable */
    }
    return ALL_PHASE_ID;
}

/** Pure: builds the payload the renderer consumes. Null = no filtering. */
export function payloadForPhase(id: string): IntentPayload | null {
    const phase = phaseById(id);
    if (!phase || phase.id === ALL_PHASE_ID) return null;
    const next = phase.next ? phaseById(phase.next) : undefined;
    return {
        phaseLabel: phase.label,
        activePrimitives: phase.active,
        likelyNext: next ? next.active : [],
        suggestion: next ? { id: next.id, label: next.label } : undefined,
        confidence: 1,
        source: "manual",
    };
}

export function useManualIntent() {
    const [phaseId, setPhaseIdState] = React.useState<string>(readStoredPhase);

    const setPhaseId = React.useCallback((id: string) => {
        setPhaseIdState(id);
        try {
            window.localStorage.setItem(STORAGE_KEY, id);
        } catch {
            /* non-fatal */
        }
    }, []);

    const payload = React.useMemo(() => payloadForPhase(phaseId), [phaseId]);
    return { phaseId, setPhaseId, payload };
}
