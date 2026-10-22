import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, vi } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import * as neuro from "./neurosyncDb";
import * as gpu from "./gpuProvider";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });

  it("clears the preview bearer fallback before navigating away from the workspace", () => {
    const authSource = readFileSync(resolve(process.cwd(), "client/src/contexts/AuthContext.jsx"), "utf8");
    const menuSource = readFileSync(resolve(process.cwd(), "client/src/components/UserMenu.jsx"), "utf8");
    const profileSource = readFileSync(resolve(process.cwd(), "client/src/pages/Profile.jsx"), "utf8");
    expect(authSource).toContain("sessionStorage.removeItem('manus-cookie')");
    expect(authSource).toContain("utils.auth.me.setData(undefined, null)");
    expect(menuSource).toContain('await logout()');
    expect(profileSource).toContain('await logout()');
  });
});

describe("jobs.list", () => {
  it("does not advance the simulation after a real GPU provider has been configured", async () => {
    const { ctx } = createAuthContext();
    const advanceSimulation = vi.spyOn(neuro, "advanceSimulatedJobsForUser").mockResolvedValue(undefined);
    const listJobs = vi.spyOn(neuro, "listJobsForUser").mockResolvedValue([]);
    vi.spyOn(gpu, "gpuRuntimeMode").mockReturnValue("external");

    await expect(appRouter.createCaller(ctx).jobs.list()).resolves.toEqual([]);
    expect(advanceSimulation).not.toHaveBeenCalled();
    expect(listJobs).toHaveBeenCalledWith(ctx.user!.id);
  });
});

describe("workspace.updatePreferences", () => {
  it("writes the authenticated user's workspace preferences through the profile helper", async () => {
    const { ctx } = createAuthContext();
    const preferences = { defaultParams: { epochs: 5 }, cacheEnabled: false };
    const persistedProfile = { id: 1, userId: ctx.user!.id, workspaceRole: "sender", preferences };
    const updatePreferences = vi.spyOn(neuro, "updateProfilePreferences").mockResolvedValue(persistedProfile as never);

    await expect(appRouter.createCaller(ctx).workspace.updatePreferences({ preferences })).resolves.toEqual(persistedProfile);
    expect(updatePreferences).toHaveBeenCalledWith(ctx.user!.id, preferences);
  });
});

describe("jobs.settleFinal", () => {
  it("records completed-job final settlement through the authenticated server workflow", async () => {
    const { ctx } = createAuthContext();
    const completedJob = { id: "job_completed", userId: ctx.user!.id, status: "completed" };
    const settledRecord = { id: "settlement_1", jobId: completedJob.id, userId: ctx.user!.id, status: "settled" };
    vi.spyOn(neuro, "getJobForUser").mockResolvedValue(completedJob as never);
    const settleJob = vi.spyOn(neuro, "settleCompletedJob").mockResolvedValue(settledRecord as never);

    await expect(appRouter.createCaller(ctx).jobs.settleFinal({ jobId: completedJob.id })).resolves.toEqual(settledRecord);
    expect(settleJob).toHaveBeenCalledWith(completedJob.id, ctx.user!.id);
  });
});
