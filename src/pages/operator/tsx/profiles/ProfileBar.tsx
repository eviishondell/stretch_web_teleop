import React from "react";
import { className } from "shared/util";
import { Dropdown } from "../basic_components/Dropdown";
import { PROFILES, PROFILE_ORDER, ProfileId } from "./profiles";
import "operator/css/ProfileBar.css";

/**
 * Header dropdown for choosing the active profile. Reuses the same
 * Dropdown component as the action-mode picker so it matches the header.
 */
export const ProfileDropdown = (props: {
    profileId: ProfileId;
    onProfileChange: (id: ProfileId) => void;
    /** Disabled while customizing, since the full layout is shown then. */
    disabled?: boolean;
}) => {
    return (
        <div
            className={className("profile-dropdown", {
                disabled: !!props.disabled,
            })}
            aria-disabled={props.disabled}
            title={
                props.disabled
                    ? "Profiles are paused while customizing"
                    : "User profile"
            }
        >
            <Dropdown
                onChange={(idx) => props.onProfileChange(PROFILE_ORDER[idx])}
                selectedIndex={PROFILE_ORDER.indexOf(props.profileId)}
                possibleOptions={PROFILE_ORDER.map((id) => PROFILES[id].label)}
                showActive
                placement="bottom"
            />
        </div>
    );
};

/**
 * "+ Expand Secondary Controls" toggle. Renders nothing when the active
 * profile hides no tabs. Large target for switch scanning and eye-gaze dwell.
 */
export const SecondaryControlsToggle = (props: {
    showSecondary: boolean;
    onToggle: () => void;
    /** Tabs hidden by the current profile. */
    secondaryCount: number;
    disabled?: boolean;
}) => {
    if (props.secondaryCount === 0) return null;
    return (
        <button
            type="button"
            className="profile-bar__toggle"
            aria-expanded={props.showSecondary}
            disabled={props.disabled}
            onClick={props.onToggle}
        >
            {props.showSecondary
                ? "− Hide Secondary Controls"
                : `+ Expand Secondary Controls (${props.secondaryCount})`}
        </button>
    );
};
