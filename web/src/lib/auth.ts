import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

interface SessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  username?: string;
  displayName?: string;
  cfHandle?: string;
  role?: string;
  needsCfLink?: boolean;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.displayName || user.username,
          image: user.avatarUrl || user.discordAvatar,
        };
      },
    }),
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { username: true, displayName: true, avatarUrl: true, discordAvatar: true, cfHandle: true, role: true },
        });
        if (dbUser) {
          const u = session.user as SessionUser;
          u.id = token.id as string;
          u.username = dbUser.username;
          u.displayName = dbUser.displayName ?? undefined;
          u.image = dbUser.avatarUrl || dbUser.discordAvatar || undefined;
          u.cfHandle = dbUser.cfHandle;
          u.role = dbUser.role;
          u.needsCfLink = !dbUser.cfHandle;
        }
      }
      return session;
    },
    async signIn({ user, account }) {
      if (account?.provider === "discord" && account.providerAccountId) {
        const existingUser = await prisma.user.findUnique({
          where: { discordId: account.providerAccountId },
        });

        if (existingUser) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { discordAvatar: user.image },
          });
          (user as SessionUser).id = existingUser.id;
          return true;
        }

        const baseUsername = (user.name || "user").toLowerCase().replace(/[^a-z0-9]/g, "");
        let username = baseUsername || "user";
        let counter = 1;
        while (await prisma.user.findUnique({ where: { username } })) {
          username = `${baseUsername}${counter}`;
          counter++;
        }

        const newUser = await prisma.user.create({
          data: {
            email: account.providerAccountId + "@discord",
            username,
            displayName: user.name || username,
            discordId: account.providerAccountId,
            discordAvatar: user.image,
            avatarUrl: user.image,
            cfHandle: "pending-" + account.providerAccountId,
          },
        });
        (user as SessionUser).id = newUser.id;
        return `/auth/setup`;
      }
      return true;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
};
