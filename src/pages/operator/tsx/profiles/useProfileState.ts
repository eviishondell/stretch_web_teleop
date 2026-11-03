import React from "react";
import { PROFILES, ProfileId, UserProfile } from "./profiles";

const STORAGE_KEY = "teleop.activeProfile";

function readStoredProfile(): ProfileId {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored && stored in PROFILES) return stored as ProfileId;
    } catch {
        /* storage unavailable — fall through to default */
    }
    return "full";
}

export interface ProfileState {
    profileId: ProfileId;
    profile: UserProfile;
    setProfileId: (id: ProfileId) => void;
    showSecondary: boolean;
    setShowSecondary: (show: boolean) => void;
}

/**
 * Owns the active profile and the secondary-controls toggle.
 * Switching profiles always collapses secondary controls, so every
 * profile starts in its optimized view.
 */
export function useProfileState(): ProfileState {
    const [profileId, setProfileIdState] =
        React.useState<ProfileId>(readStoredProfile);
    const [showSecondary, setShowSecondary] = React.useState(false);

    const setProfileId = React.useCallback((id: ProfileId) => {
        setProfileIdState(id);
        setShowSecondary(false);
        try {
            window.localStorage.setItem(STORAGE_KEY, id);
        } catch {
            /* non-fatal */
        }
    }, []);

    return {
        profileId,
        profile: PROFILES[profileId],
        setProfileId,
        showSecondary,
        setShowSecondary,
    };
}
