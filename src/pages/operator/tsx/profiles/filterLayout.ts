import {
    LayoutDefinition,
    LayoutGridDefinition,
    PanelDefinition,
    TabDefinition,
} from "operator/tsx/utils/component_definitions";
import { UserProfile, groupForTab, isPrimary } from "./profiles";

/**
 * Pure function: returns a NEW layout for rendering, with each panel's
 * secondary tabs removed — or moved after the primary tabs when
 * showSecondary is true. The stored layout is never mutated, so saving,
 * Customize mode and path-based editing are unaffected.
 *
 * Layout shape: Layout → LayoutGrid[] → Panel[] → Tab[]
 */
export function applyProfile(
    layout: LayoutDefinition,
    profile: UserProfile,
    showSecondary: boolean,
): LayoutDefinition {
    if (profile.primary === "all") return layout;

    const grids: LayoutGridDefinition[] = layout.children.map((grid) => ({
        ...grid,
        children: grid.children
            .map((panel) => filterPanel(panel, profile, showSecondary))
            .filter((panel): panel is PanelDefinition => panel !== null),
    }));

    return { ...layout, children: grids };
}

/** Number of tabs the profile hides — labels the toggle, hides it at 0. */
export function countSecondaryTabs(
    layout: LayoutDefinition,
    profile: UserProfile,
): number {
    if (profile.primary === "all") return 0;
    let count = 0;
    for (const grid of layout.children)
        for (const panel of grid.children)
            for (const tab of panel.children)
                if (!isPrimary(profile, groupForTab(tab))) count++;
    return count;
}

function filterPanel(
    panel: PanelDefinition,
    profile: UserProfile,
    showSecondary: boolean,
): PanelDefinition | null {
    const primaryTabs: TabDefinition[] = [];
    const secondaryTabs: TabDefinition[] = [];
    for (const tab of panel.children) {
        (isPrimary(profile, groupForTab(tab))
            ? primaryTabs
            : secondaryTabs
        ).push(tab);
    }
    // Primary tabs keep their order and come first, so a panel's default
    // tab is always task-relevant.
    const children = showSecondary
        ? [...primaryTabs, ...secondaryTabs]
        : primaryTabs;

    // A panel whose every tab is secondary disappears entirely.
    return children.length === 0 ? null : { ...panel, children };
}
