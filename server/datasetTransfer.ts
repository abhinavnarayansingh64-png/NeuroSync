import type { Express, Request, Response } from "express";
import express from "express";
import { Readable } from "node:stream";
import { sdk } from "./_core/sdk";
import { dispatchTrainingJob } from "./gpuProvider";
import * as neuro from "./neurosyncDb";
import { storageGetSignedUrl, storagePut } from "./storage";

export const MAX_DATASET_BYTES = 500 * 1024 * 1024;
const EXTENSION_TO_CONTENT_TYPE: Record<string, string> = {
  json: "application/json",
  jsonl: "application/x-ndjson",
  csv: "text/csv",
};

function safeDatasetName(value: unknown) {
  const decoded = typeof value === "string" ? decodeURIComponent(value) : "dataset.json";
  const name = decoded.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180) || "dataset.json";
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  if (!EXTENSION_TO_CONTENT_TYPE[extension]) throw new Error("Datasets must be JSON, JSONL, or CSV files.");
  return { name, extension };
}

export function ownsDatasetKey(userId: number, datasetKey: string) {
  return datasetKey.startsWith(`datasets/${userId}/`);
}

export function registerDatasetTransferRoutes(app: Express) {
  app.post("/api/datasets/upload", express.raw({ type: "application/octet-stream", limit: "500mb" }), async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) return res.status(401).json({ error: "Sign in before uploading a dataset." });
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: "Dataset content is required." });
      if (req.body.length > MAX_DATASET_BYTES) return res.status(413).json({ error: "Dataset exceeds the 500 MB limit." });

      const { name, extension } = safeDatasetName(req.headers["x-dataset-name"]);
      const upload = await storagePut(`datasets/${user.id}/${Date.now()}-${name}`, req.body, EXTENSION_TO_CONTENT_TYPE[extension]);
      return res.status(201).json({ key: upload.key, url: upload.url, name, sizeBytes: req.body.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Dataset upload could not be completed.";
      return res.status(400).json({ error: message });
    }
  });

  /**
   * The receiver browser receives the original S3 object through this
   * authenticated stream. A delivery is only recorded as complete after the
   * response finishes; merely opening the download route cannot start work.
   */
  app.get("/api/receiver-datasets/:jobId", async (req: Request, res: Response) => {
    let streamFailed = false;
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) return res.status(401).json({ error: "Sign in before requesting a receiver dataset." });
      const receiverId = typeof req.query.receiverId === "string" ? req.query.receiverId : "";
      const jobId = typeof req.params.jobId === "string" ? req.params.jobId : "";
      if (!receiverId || !jobId) return res.status(400).json({ error: "Receiver and job identifiers are required." });

      const started = await neuro.markReceiverDatasetDownloadStarted({ userId: user.id, receiverId, jobId });
      const assignment = started.assignment;
      if (!assignment?.job.datasetKey) return res.status(409).json({ error: "This job has no stored dataset available for receiver delivery." });

      const upstream = await fetch(await storageGetSignedUrl(assignment.job.datasetKey));
      if (!upstream.ok || !upstream.body) throw new Error(`The dataset storage stream failed (${upstream.status}).`);

      const filename = safeDatasetName(assignment.job.datasetName ?? "dataset.json").name;
      res.status(200);
      res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Cache-Control", "no-store");
      const contentLength = upstream.headers.get("content-length");
      if (contentLength) res.setHeader("Content-Length", contentLength);

      const stream = Readable.fromWeb(upstream.body as any);
      stream.on("error", error => {
        streamFailed = true;
        if (!res.headersSent) res.status(502).json({ error: error instanceof Error ? error.message : "Dataset stream failed." });
        else res.destroy(error instanceof Error ? error : undefined);
      });
      res.on("finish", async () => {
        if (streamFailed) return;
        try {
          const completed = await neuro.markReceiverDatasetDownloadCompleted({ userId: user.id, receiverId, jobId });
          if (!completed.dispatchReady || !completed.job) return;
          try {
            await dispatchTrainingJob(completed.job);
          } catch (error) {
            await neuro.setJobStatus({
              jobId,
              userId: completed.job.userId,
              status: "failed",
              type: "job.dispatch_failed",
              message: error instanceof Error ? error.message : "Training dispatch failed after dataset delivery.",
            });
          }
        } catch {
          // The dataset response is already complete. Durable state is exposed
          // by polling, and a retry cannot double-dispatch due to DB guards.
        }
      });
      stream.pipe(res);
    } catch (error) {
      if (!res.headersSent) {
        const message = error instanceof Error ? error.message : "Receiver dataset delivery could not be started.";
        return res.status(400).json({ error: message });
      }
      res.destroy(error instanceof Error ? error : undefined);
    }
  });
}
