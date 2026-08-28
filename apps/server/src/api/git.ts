import type { FastifyPluginAsync } from "fastify";

export const gitPlugin: FastifyPluginAsync = async (fastify) => {
  // Git operation routes — implemented in Phase 2
  fastify.get("/status", async (_request, reply) => {
    return reply.notImplemented("Git routes not yet implemented");
  });
};
