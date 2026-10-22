import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const settingsSource = readFileSync(resolve(process.cwd(), "client/src/contexts/SettingsContext.jsx"), "utf8");
const persistenceSource = readFileSync(resolve(process.cwd(), "server/neurosyncDb.ts"), "utf8");
const layoutSource = readFileSync(resolve(process.cwd(), "client/src/layouts/AppLayout.jsx"), "utf8");
const landingSource = readFileSync(resolve(process.cwd(), "client/src/pages/Landing.jsx"), "utf8");
const loginSource = readFileSync(resolve(process.cwd(), "client/src/pages/Login.jsx"), "utf8");
const routeSource = readFileSync(resolve(process.cwd(), "client/src/utils/workspaceRoute.js"), "utf8");

describe("workspace role persistence", () => {
  it("updates cached profile state after selecting a role before role-route navigation", () => {
    expect(settingsSource).toContain("const utils = trpc.useUtils()");
    expect(settingsSource).toContain("persistedProfile = await setRole.mutateAsync");
    expect(settingsSource).toContain("utils.workspace.profile.setData(undefined, persistedProfile)");
  });

  it("creates new workspace profiles with sender routing rather than an onboarding loop", () => {
    expect(persistenceSource).toContain('await db.insert(userProfiles).values({ userId, workspaceRole: "sender" })');
    expect(layoutSource).not.toContain('Navigate to="/choose-role"');
  });

  it("routes returning users to the workspace matching their saved role", () => {
    expect(routeSource).toContain("if (workspaceRole === 'receiver') return '/receiver'");
    expect(routeSource).toContain("if (workspaceRole === 'sender' || workspaceRole === 'both') return '/dashboard'");
    expect(landingSource).toContain('workspaceRouteForRole(profileQuery.data?.workspaceRole)');
    expect(loginSource).toContain('workspaceRouteForRole(profileQuery.data?.workspaceRole)');
    expect(landingSource).not.toContain('Navigate to="/dashboard" replace');
  });
});
