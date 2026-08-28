import type { FastifyPluginAsync } from "fastify";
import { kbPlugin } from "./kb.js";
import { gitPlugin } from "./git.js";
import { agentPlugin } from "./agent.js";

export const apiPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(kbPlugin, { prefix: "/kb" });
  await fastify.register(gitPlugin, { prefix: "/git" });
  await fastify.register(agentPlugin, { prefix: "/agent" });
};
