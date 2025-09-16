import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import prisma from "../../../lib/prisma";

const statedDomains = ["scale42.com", "s42.io"];

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  adapter: PrismaAdapter(prisma),
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const domain = user.email.split("@")[1];
      let groupName = statedDomains.includes(domain) ? domain : "Guests";
      let group = await prisma.group.upsert({
        where: { domain: groupName },
        update: {},
        create: { name: groupName, domain: groupName },
      });
      await prisma.user.update({
        where: { email: user.email },
        data: {
          groups: {
            create: [{ groupId: group.id }],
          },
        },
      });
      return true;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
