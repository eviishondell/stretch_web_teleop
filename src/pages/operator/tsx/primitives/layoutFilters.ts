import {
    ButtonPadId,
    ButtonPadIdMobile,
    ComponentDefinition,
    ComponentType,
    LayoutDefinition,
    PanelDefinition,
    TabDefinition,
} from "operator/tsx/utils/component_definitions";

const normalize = (label?: string) =>
    (label ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const CONTROL_TAB_LABELS = new Set(["base", "arm & lift", "wrist & gripper"]);

const CONTROL_PADS = new Set<string>([
    ButtonPadId.Base,
    ButtonPadId.Arm,
    ButtonPadId.DexWrist,
    ButtonPadId.GripperLift,
    ButtonPadId.ManipRealsense,
    ButtonPadIdMobile.Arm,
    ButtonPadIdMobile.Drive,
    ButtonPadIdMobile.Gripper,
]);

const SAFETY_TYPES = new Set<ComponentType>([
    ComponentType.RunStopButton,
    ComponentType.BatteryGuage,
]);

/** Children of a tab, if they are all of an accepted kind. */
function allChildren(
    tab: TabDefinition,
    test: (c: ComponentDefinition) => boolean,
): boolean {
    const children = (tab.children ?? []) as ComponentDefinition[];
    return children.length > 0 && children.every(test);
}

/**
 * A hardware-grouped control tab (Base, Arm & Lift, Wrist & Gripper),
 * recognized by label or, if renamed, by the button pads it contains.
 */
export function isHardwareControlTab(tab: TabDefinition): boolean {
    if (CONTROL_TAB_LABELS.has(normalize(tab.label))) return true;
    return allChildren(
        tab,
        (c) =>
            c.type === ComponentType.ButtonPad &&
            !!c.id &&
            CONTROL_PADS.has(c.id),
    );
}

/** The Safety tab (run stop + battery), which moves to the header. */
export function isSafetyTab(tab: TabDefinition): boolean {
    if (normalize(tab.label) === "safety") return true;
    return allChildren(tab, (c) => SAFETY_TYPES.has(c.type));
}

/**
 * Pure: a copy of the layout for operating (not customizing).
 * - The Safety tab is always removed; run stop and battery live in the header.
 * - With a task phase active, hardware control tabs are removed too, and
 *   the primitive panel takes their place.
 * Panels and grids left empty are dropped. The stored layout is untouched.
 */
export function layoutForOperation(
    layout: LayoutDefinition,
    opts: { hideHardwareControls: boolean },
): LayoutDefinition {
    const keep = (tab: TabDefinition) =>
        !isSafetyTab(tab) &&
        !(opts.hideHardwareControls && isHardwareControlTab(tab));

    return {
        ...layout,
        children: layout.children
            .map((grid) => ({
                ...grid,
                children: grid.children
                    .map(
                        (panel): PanelDefinition => ({
                            ...panel,
                            children: panel.children.filter(keep),
                        }),
                    )
                    .filter((panel) => panel.children.length > 0),
            }))
            .filter((grid) => grid.children.length > 0),
    };
}
