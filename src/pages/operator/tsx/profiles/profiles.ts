/**
 * User profiles for task-optimized, progressive-disclosure layouts.
 *
 * A profile declares which control groups are "primary" (shown by default).
 * Everything else is "secondary" and only appears when the user expands
 * secondary controls. Tabs that don't belong to any control group
 * (Camera Views, Safety, etc.) are never hidden.
 */
import {
    ButtonPadId,
    ButtonPadIdMobile,
    ComponentDefinition,
    ComponentType,
    TabDefinition,
} from "operator/tsx/utils/component_definitions";

export type ControlGroup = "base" | "arm_lift" | "wrist_gripper";

export type ProfileId = "full" | "arthur" | "maya";

export interface UserProfile {
    id: ProfileId;
    label: string;
    summary: string;
    /** "all" disables filtering entirely (the stock layout). */
    primary: ReadonlySet<ControlGroup> | "all";
}

export const PROFILES: Record<ProfileId, UserProfile> = {
    full: {
        id: "full",
        label: "All Controls",
        summary: "Every control tab, unfiltered",
        primary: "all",
    },
    arthur: {
        id: "arthur",
        label: "Arthur",
        summary: "Switch scanning · base navigation",
        primary: new Set<ControlGroup>(["base"]),
    },
    maya: {
        id: "maya",
        label: "Maya",
        summary: "Eye gaze · precision manipulation",
        primary: new Set<ControlGroup>(["arm_lift", "wrist_gripper"]),
    },
};

export const PROFILE_ORDER: ProfileId[] = ["full", "arthur", "maya"];

/** Tab labels (case/whitespace-insensitive) → control group. */
const TAB_LABEL_GROUPS: Record<string, ControlGroup> = {
    base: "base",
    "arm & lift": "arm_lift",
    "wrist & gripper": "wrist_gripper",
};

/**
 * Button pads → control group. Used when a tab's label isn't recognized
 * (e.g. a tab renamed in Customize mode), so classification follows
 * what the tab actually controls.
 */
const BUTTON_PAD_GROUPS: Partial<Record<string, ControlGroup>> = {
    [ButtonPadId.Base]: "base",
    [ButtonPadIdMobile.Drive]: "base",
    [ButtonPadId.Arm]: "arm_lift",
    [ButtonPadIdMobile.Arm]: "arm_lift",
    [ButtonPadId.DexWrist]: "wrist_gripper",
    [ButtonPadId.GripperLift]: "wrist_gripper",
    [ButtonPadIdMobile.Gripper]: "wrist_gripper",
};

/**
 * Which control group a tab belongs to, or undefined for tabs that
 * should always stay visible (cameras, safety, mixed-purpose tabs).
 */
export function groupForTab(tab: TabDefinition): ControlGroup | undefined {
    const byLabel =
        TAB_LABEL_GROUPS[
            (tab.label ?? "").trim().toLowerCase().replace(/\s+/g, " ")
        ];
    if (byLabel) return byLabel;

    const groups = new Set<ControlGroup>();
    for (const child of tab.children ?? []) {
        const c = child as ComponentDefinition;
        if (c.type !== ComponentType.ButtonPad || !c.id) continue;
        const g = BUTTON_PAD_GROUPS[c.id];
        if (g) groups.add(g);
    }
    // Only classify when the tab is unambiguously one group.
    return groups.size === 1 ? [...groups][0] : undefined;
}

export function isPrimary(
    profile: UserProfile,
    group: ControlGroup | undefined,
): boolean {
    if (profile.primary === "all" || group === undefined) return true;
    return profile.primary.has(group);
}
