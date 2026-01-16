// Define Role enum locally to avoid importing Prisma client in browser bundles
// This mirrors the Prisma schema definition
export enum Role {
  CLIENT = "CLIENT",
  COACH = "COACH",
  ADMIN = "ADMIN",
}
