/**
 * Whether the user has dismissed the setup wizard.
 *
 * Deliberately client-side: this is a preference about being shown a screen,
 * not a fact about the account. Actual progress is derived server-side from
 * real data (`onboarding.status`), so skipping never marks anything complete
 * and the dashboard keeps offering the remaining steps.
 */
export const ONBOARDING_SKIPPED_KEY = "closelooper.onboarding.skipped";

export type OnboardingStepId = "gmail" | "senderProfile" | "voice" | "contacts";

export function hasSkippedOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_SKIPPED_KEY) === "1";
  } catch {
    // Private browsing or blocked storage — treat as "not skipped".
    return false;
  }
}
