import NextAuth from "next-auth/next"
import { authOptions } from "@/lib/auth"

// One shared login setup (src/lib/auth.ts) for both the sign-in handler and
// getServerSession() checks, so they can never drift apart.
const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
