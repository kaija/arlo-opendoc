import type { FastifyPluginAsync } from "fastify";

export const agentPlugin: FastifyPluginAsync = async (fastify) => {
  // Agent chat + SSE routes — implemented in Phase 3
  fastify.get("/chat", async (_request, reply) => {
    return reply.notImplemented("Agent routes not yet implemented");
  });
};
