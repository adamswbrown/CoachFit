import { Role } from "../lib/types"
import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      roles: Role[]
      isTestUser: boolean
    }
  }

  interface User {
    id: string
    roles: Role[]
    isTestUser?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    roles: Role[]
    isTestUser: boolean
    adminOverride?: boolean
  }
}
