import type { Express, Request, Response } from "express";
import * as neuro from "./neurosyncDb";

export function registerProviderCallbacks(app: Express) {
  app.post("/api/gpu/runpod/callback/:executionId", async (req: Request, res: Response) => {
    const executionId = String(req.params.executionId ?? "");
    const callbackToken = typeof req.query.token === "string" ? req.query.token : "";
    const body = req.body ?? {};
    const providerStatus = typeof body.status === "string" ? body.status : typeof body?.output?.status === "string" ? body.output.status : "UNKNOWN";
    if (!executionId || !callbackToken) {
      res.status(400).json({ accepted: false });
      return;
    }
    try {
      const result = await neuro.applyProviderCallback({ executionId, callbackToken, providerStatus, payload: body });
      if (!result.accepted) {
        res.status(401).json(result);
        return;
      }
      res.status(200).json({ accepted: true, duplicate: result.duplicate });
    } catch (error) {
      console.error("[GPU callback] failed", error);
      res.status(500).json({ accepted: false });
    }
  });
}
