import type { FastifyPluginAsync } from "fastify";

export const kbPlugin: FastifyPluginAsync = async (fastify) => {
  // KB CRUD routes — implemented in Phase 2
  fastify.get("/document", async (_request, reply) => {
    return reply.notImplemented("KB document routes not yet implemented");
  });
};
