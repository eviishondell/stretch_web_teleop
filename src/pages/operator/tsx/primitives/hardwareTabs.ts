import {
    ButtonPadId,
    ButtonPadIdMobile,
    ComponentDefinition,
    ComponentType,
    LayoutDefinition,
    PanelDefinition,
    TabDefinition,
} from "operator/tsx/utils/component_definitions";

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

/**
 * A hardware-grouped control tab (Base, Arm & Lift, Wrist & Gripper),
 * recognized by label or, if renamed, by the button pads it contains.
 */
export function isHardwareControlTab(tab: TabDefinition): boolean {
    const label = (tab.label ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    if (CONTROL_TAB_LABELS.has(label)) return true;
    const children = (tab.children ?? []) as ComponentDefinition[];
    return (
        children.length > 0 &&
        children.every(
            (c) =>
                c.type === ComponentType.ButtonPad &&
                !!c.id &&
                CONTROL_PADS.has(c.id),
        )
    );
}

/**
 * Pure: a copy of the layout with hardware control tabs removed, so the
 * primitive panel replaces them. Cameras, safety, etc. are kept. The
 * stored layout is never mutated.
 */
export function withoutHardwareControlTabs(
    layout: LayoutDefinition,
): LayoutDefinition {
    return {
        ...layout,
        children: layout.children.map((grid) => ({
            ...grid,
            children: grid.children
                .map(
                    (panel): PanelDefinition => ({
                        ...panel,
                        children: panel.children.filter(
                            (tab) => !isHardwareControlTab(tab),
                        ),
                    }),
                )
                .filter((panel) => panel.children.length > 0),
        })),
    };
}
