# Developer Getting Started Guide

Set up your local development environment for CoachFit.

---

## Prerequisites

- **Node.js 18+** and npm
- **PostgreSQL** database (Railway recommended, or local)
- **Google Cloud Console** account (for OAuth)
- **Resend** account (for emails)
- **Git** for version control

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/adamswbrown/CoachFit.git
cd CoachFit/Web

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Set up database
npm run db:migrate
npm run db:generate

# Seed test data
npm run db:seed
npm run test:generate

# Set passwords for test users
npm run password:set coach@test.local coach123
npm run password:set client@test.local client123

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and login with test credentials.

---

## Detailed Setup

### 1. Clone the Repository

```bash
git clone https://github.com/adamswbrown/CoachFit.git
cd CoachFit/Web
```

### 2. Install Dependencies

```bash
npm install
```

This installs all required packages including Next.js, React, Prisma, and more.

### 3. Environment Variables

Create `.env.local` in the project root:

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here  # Generate with: openssl rand -base64 32

# Google OAuth (Required)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email Service (Resend)
RESEND_API_KEY=re_your-resend-api-key

# Apple Sign-In (Optional)
APPLE_CLIENT_ID=your-apple-client-id
APPLE_CLIENT_SECRET=your-apple-client-secret
NEXT_PUBLIC_APPLE_CLIENT_ID=your-apple-client-id
```

### 4. Database Setup

#### Option A: Railway (Recommended)

1. Go to [Railway](https://railway.app/)
2. Create a new project
3. Add a PostgreSQL database
4. Copy the connection string
5. Add to `.env.local` as `DATABASE_URL`

#### Option B: Local PostgreSQL

```bash
# Create database
createdb coachsync

# Use local connection string
DATABASE_URL=postgresql://localhost:5432/coachsync
```

### 5. Run Database Migrations

```bash
# Run migrations to create tables
npm run db:migrate

# Generate Prisma Client
npm run db:generate
```

### 6. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google+ API**
4. Navigate to **APIs & Services** → **Credentials**
5. Create **OAuth 2.0 Client ID**
6. Set application type to **Web application**
7. Add authorized redirect URI:
   - `http://localhost:3000/api/auth/callback/google`
8. Copy Client ID and Client Secret to `.env.local`

### 7. Resend Email Setup (Optional)

1. Go to [Resend](https://resend.com/)
2. Create an account
3. Create an API key
4. Add to `.env.local` as `RESEND_API_KEY`

**Note**: Emails are suppressed for test users by default.

### 8. Seed Test Data

```bash
# Create basic test users
npm run db:seed

# Generate comprehensive test data (15 clients, 5 cohorts, entries)
npm run test:generate

# Set passwords for test users
npm run password:set coach@test.local coach123
npm run password:set client@test.local client123
```

### 9. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Test User Credentials

After seeding and setting passwords:

**Coach Account**:
- Email: `coach@test.local`
- Password: `coach123`

**Client Account**:
- Email: `client@test.local`
- Password: `client123`

---

## Development Tools

### Prisma Studio

Visual database browser:

```bash
npm run db:studio
```

Opens at [http://localhost:5555](http://localhost:5555).

### ESLint

```bash
npm run lint
```

### Build Test

```bash
npm run build
```

Verify production build works.

---

## Common Development Tasks

### Creating a Feature

1. **Create branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Implement batch**:
   - Frontend components
   - API routes
   - Database changes (if needed)
   - Tests (minimum)
   - Documentation

3. **Test locally**:
   ```bash
   npm run build
   npm run lint
   ```

4. **Commit and push**:
   ```bash
   git add .
   git commit -m "Feature: [description]"
   git push -u origin feature/your-feature-name
   ```

5. **Create PR**:
   ```bash
   gh pr create --title "Feature: [name]" --body "[description]"
   ```

### Database Schema Changes

1. **Update schema**:
   ```typescript
   // prisma/schema.prisma
   model NewModel {
     id String @id @default(uuid())
     // ... fields
   }
   ```

2. **Create migration**:
   ```bash
   npm run db:migrate
   ```

3. **Generate client**:
   ```bash
   npm run db:generate
   ```

4. **Update types and validations**:
   - `lib/types.ts`
   - `lib/validations.ts`

### Adding API Route

1. **Create route file**:
   ```typescript
   // app/api/your-route/route.ts
   import { NextResponse } from "next/server"
   import { auth } from "@/lib/auth"

   export async function GET(request: Request) {
     const session = await auth()
     if (!session?.user?.id) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
     }

     // Your logic here
     return NextResponse.json({ data: result })
   }
   ```

2. **Add validation**:
   ```typescript
   // lib/validations.ts
   export const yourSchema = z.object({
     field: z.string()
   })
   ```

3. **Test the route**:
   - Use Postman or curl
   - Or create frontend component

---

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000
npx kill-port 3000

# Or use different port
npm run dev -- -p 3001
```

### Database Connection Issues

- Verify `DATABASE_URL` is correct
- Check SSL mode for Railway: `?sslmode=require`
- Ensure database is running
- Check firewall settings

### Prisma Client Issues

```bash
# Regenerate Prisma Client
npm run db:generate

# Reset database (warning: deletes all data)
npx prisma migrate reset
```

### Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

---

## Next Steps

- **[Learn the architecture](./architecture.md)**
- **[Review API reference](./api-reference.md)**
- **[Read operating contract](../../CLAUDE.md)**
- **[Start contributing](../misc/CONTRIBUTING.md)**

---

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

**Last Updated**: January 2025
