import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { analyzeWebsite } from "./lib/analyze";
import { answerWithGemini } from "./lib/gemini";
import type { DBTIResult } from "../shared/dbti";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  analysis: router({
    scan: publicProcedure
      .input(z.object({ query: z.string().trim().min(1).max(500) }))
      .mutation(async ({ input }) => analyzeWebsite(input.query)),
    assistedScan: publicProcedure
      .input(z.object({
        query: z.string().trim().min(1).max(500),
        content: z.string().trim().min(80).max(100_000),
        googleScreenshotDataUrl: z.string().max(4_000_000).optional(),
      }))
      .mutation(async ({ input }) => analyzeWebsite(input.query, input.content, input.googleScreenshotDataUrl)),
  }),

  ai: router({
    assist: publicProcedure
      .input(z.object({ question: z.string().trim().min(1).max(1_000), scan: z.unknown() }))
      .mutation(async ({ input }) => answerWithGemini(input.question, input.scan as DBTIResult)),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
