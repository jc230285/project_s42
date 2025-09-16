import { getServerSession } from "next-auth";
import { authOptions } from "../app/api/auth/[...nextauth]";

export async function getSession() {
  return await getServerSession(authOptions);
}
