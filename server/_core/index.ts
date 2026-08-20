import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { AnalysisInputError, analyzeWebsite } from "../lib/analyze";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

const ANALYSIS_ENDPOINT_DEADLINE_MS = 45_000;

function withinEndpointDeadline<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AnalysisInputError("TIMEOUT", "The analysis did not complete in time.")), ANALYSIS_ENDPOINT_DEADLINE_MS);
  });
  return Promise.race([operation, deadline]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.post("/api/analyze", async (req, res) => {
    const query = typeof req.body?.query === "string" ? req.body.query : "";
    if (!query.trim()) {
      res.status(400).json({ ok: false, error: { code: "INVALID_INPUT", message: "Provide a business website or domain to analyze." } });
      return;
    }
    try {
      const result = await withinEndpointDeadline(analyzeWebsite(query));
      res.status(200).json({ ok: true, data: result });
    } catch (error) {
      const known = error instanceof AnalysisInputError;
      res.status(known ? 400 : 502).json({
        ok: false,
        error: {
          code: known ? error.code : "ANALYSIS_FAILED",
          message: known ? error.message : "The website could not be analyzed during this scan. Please try again.",
        },
      });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
