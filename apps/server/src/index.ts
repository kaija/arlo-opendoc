import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { EngineRegistry } from "./repos/EngineRegistry.js";
import { apiPlugin } from "./api/index.js";

// Extend FastifyInstance to include the registry decoration
declare module "fastify" {
  interface FastifyInstance {
    registry: EngineRegistry;
  }
}

const app = Fastify({ logger: true });

// ── Plugin registrations ───────────────────────────────────────────────────

await app.register(cors, {
  origin: process.env["CORS_ORIGIN"] ?? "http://localhost:3000",
});

await app.register(sensible);

// Decorate the app with the engine registry (default: 30 min idle timeout)
const registry = new EngineRegistry({
  idleTimeoutMs: parseInt(process.env["ENGINE_IDLE_TIMEOUT_MS"] ?? "1800000", 10),
});

app.decorate("registry", registry);

// Register the API plugin under /api prefix
await app.register(apiPlugin, { prefix: "/api" });

// ── Start ──────────────────────────────────────────────────────────────────

const port = parseInt(process.env["PORT"] ?? "3001", 10);
const host = process.env["HOST"] ?? "0.0.0.0";

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
