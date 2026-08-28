// Core engine
export { CoreEngine } from "./CoreEngine.js";
export type { CoreEngineConfig } from "./CoreEngine.js";

// Adapter interfaces
export type { StoreAdapter } from "./store/StoreAdapter.js";
export type { ForgeAdapter, WebhookConfig, WebhookRecord } from "./forge/ForgeAdapter.js";
export type { AgentKeyProvider } from "./agent/types.js";
export type { GitBackend } from "./git/GitBackend.js";

// Containment check
export { checkContainment, ContainmentError } from "./agent/PathContainmentCheck.js";
