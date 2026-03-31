import type { PolicyProfileControls } from "../shared/api/pilot.js";
import type { SessionContext } from "../shared/auth/session.js";
import { canAccessRoute, type AppRoute } from "./routes.js";

const hashString = (input: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const stableSerialize = (value: unknown): string => {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? String(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
    .join(",")}}`;
};

export const isDemoIdentitiesEnabled = () =>
  (globalThis as typeof globalThis & { __ENABLE_DEMO_IDENTITIES__?: boolean }).__ENABLE_DEMO_IDENTITIES__ === true;

export const canAccessRouteWithAssurance = (session: SessionContext | undefined, route: AppRoute): boolean => {
  if (!session) return route.path === "/setup";
  if (!canAccessRoute(session, route)) return false;
  if (!route.requireStepUpMfa) return true;
  return session.assuranceLevel === "aal3";
};

export const buildPolicyDraftHash = (profileName: string, controls: PolicyProfileControls) =>
  `preview-${hashString(
    stableSerialize({
      profileName: profileName.trim(),
      controls
    })
  )}`;

export const hasFreshPreviewHash = (
  previewHash: string | undefined,
  profileName: string,
  controls: PolicyProfileControls
) => previewHash === buildPolicyDraftHash(profileName, controls);
