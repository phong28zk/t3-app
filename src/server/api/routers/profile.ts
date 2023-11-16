import { Prisma, PrismaClient } from "@prisma/client";
import { inferAsyncReturnType } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  createTRPCContext,
} from "~/server/api/trpc";

export const profileRouter = createTRPCRouter({
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input: { id }, ctx }) => {
      const currentUserId = ctx.session?.user.id;
      const profile = await ctx.db.user.findUnique({
        where: { id },
        select: {
          name: true,
          image: true,
          _count: {
            select: {
              followers: true,
              follows: true,
              threads: true,
            },
          },
          followers:
            currentUserId == null
              ? undefined
              : { where: { id: currentUserId } },
        },
      });
      if (profile == null) return;
      return {
        name: profile.name,
        image: profile.image,
        followersCount: profile._count.followers,
        followsCount: profile._count.follows,
        threadsCount: profile._count.threads,
        isFollowing: profile.followers.length > 0,
      };
    }),

  toggleFollow: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input: { userId }, ctx }) => {
      const currentUserId = ctx.session?.user.id;

      const existingFollow = await ctx.db.user.findFirst({
        where: {
          id: userId,
          followers: {
            some: {
              id: currentUserId,
            },
          },
        },
      });

      let addedFollow 

      if (existingFollow == null) {
        await ctx.db.user.update({
          where: { id: userId },
          data: {
            followers: {
              connect: {
                id: currentUserId,
              },
            },
          },
        });
        addedFollow  = true
      } else {
        await ctx.db.user.update({
          where: { id: userId },
          data: {
            followers: {
              disconnect: {
                id: currentUserId,
              },
            },
          },
        });
        addedFollow  = false
      }

      // Revalidation
      

      return { addedFollow };
    }),
});