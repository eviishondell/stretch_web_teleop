import React from "react";
import { PROFILES, PROFILE_ORDER, ProfileId } from "./profiles";
import "operator/css/ProfileBar.css";

export interface ProfileBarProps {
    profileId: ProfileId;
    onProfileChange: (id: ProfileId) => void;
    showSecondary: boolean;
    onToggleSecondary: () => void;
    /** Tabs hidden by the current profile; toggle hides itself at 0. */
    secondaryCount: number;
    /** Disable while customizing, since the full layout is shown then. */
    disabled?: boolean;
}

/**
 * Profile picker + secondary-controls toggle.
 * Large targets and native buttons so it works with switch scanning
 * (sequential focus) and eye-gaze dwell clicking.
 */
export const ProfileBar = (props: ProfileBarProps) => {
    const {
        profileId,
        onProfileChange,
        showSecondary,
        onToggleSecondary,
        secondaryCount,
        disabled,
    } = props;

    return (
        <div className="profile-bar">
            <div
                className="profile-bar__profiles"
                role="radiogroup"
                aria-label="User profile"
            >
                {PROFILE_ORDER.map((id) => {
                    const p = PROFILES[id];
                    const active = id === profileId;
                    return (
                        <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={disabled}
                            className={
                                "profile-bar__profile" +
                                (active ? " profile-bar__profile--active" : "")
                            }
                            onClick={() => onProfileChange(id)}
                        >
                            <span className="profile-bar__name">{p.label}</span>
                            <span className="profile-bar__summary">
                                {p.summary}
                            </span>
                        </button>
                    );
                })}
            </div>

            {secondaryCount > 0 && (
                <button
                    type="button"
                    className="profile-bar__toggle"
                    aria-expanded={showSecondary}
                    disabled={disabled}
                    onClick={onToggleSecondary}
                >
                    {showSecondary
                        ? "− Hide Secondary Controls"
                        : `+ Expand Secondary Controls (${secondaryCount})`}
                </button>
            )}
        </div>
    );
};
