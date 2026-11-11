import "next-auth";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    username?: string;
    role?: "USER" | "ADMIN" | "CASHIER";
  }

  interface Session {
    user: {
      username?: string;
      role?: "USER" | "ADMIN" | "CASHIER";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username?: string;
    role?: "USER" | "ADMIN" | "CASHIER";
  }
}
