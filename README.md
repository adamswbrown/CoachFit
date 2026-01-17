# CoachFit

> **Built with AI** — This project is developed in partnership with Claude (Anthropic), following a full-stack parallel execution operating contract. Every feature ships as a complete batch: frontend + backend + data + tests + docs.

A production-ready fitness coaching platform that connects coaches with clients for real-time health tracking and progress monitoring.

---

## 🤖 AI-Assisted Development

This project demonstrates modern AI-assisted software development at scale:

- **Architecture Partner**: Claude designs system architecture, data models, and API patterns
- **Full-Stack Implementation**: Every feature is implemented end-to-end in parallel batches
- **Code Quality**: AI assists with TypeScript types, Zod validation, security patterns, and error handling
- **Documentation**: Self-documenting through CLAUDE.md operating contract
- **GitHub Workflow**: Issue-first planning for complex features, PR-based delivery for everything

### Development Philosophy

We follow a **parallel execution operating contract** where sequential thinking is forbidden. Every feature slice includes:
- ✅ Product intent & scope
- ✅ Frontend components
- ✅ Backend APIs with auth/validation
- ✅ Database schema & migrations
- ✅ Tests (minimum viable coverage)
- ✅ Documentation updates
- ✅ Deployment considerations

See [CLAUDE.md](./CLAUDE.md) for the complete operating contract.

---

## 📚 Documentation

### For Users

- **[Complete User Guide](./docs/user-guide/README.md)** - Comprehensive guide for clients, coaches, and admins
- **[Getting Started](./docs/user-guide/getting-started.md)** - First time using CoachFit? Start here!
- **[Client Guide](./docs/user-guide/clients.md)** - Daily check-ins and working with your coach
- **[Coach Guide](./docs/user-guide/coaches.md)** - Managing cohorts and tracking client progress
- **[Admin Guide](./docs/user-guide/admins.md)** - User management and system administration
- **[Troubleshooting](./docs/user-guide/troubleshooting.md)** - Common issues and solutions

### For Developers

- **[Developer Guide](./docs/development/README.md)** - Complete guide for contributing
- **[Getting Started](./docs/development/getting-started.md)** - Set up your local development environment
- **[Architecture Overview](./docs/development/architecture.md)** - System design and patterns
- **[API Reference](./docs/development/api-reference.md)** - Complete API endpoint documentation
- **[Deployment Guide](./docs/development/deployment.md)** - Deploy to production (Vercel + Railway)
- **[Contributing Guide](./docs/misc/CONTRIBUTING.md)** - How to contribute to CoachFit

---

## 📍 Current State (v1.0)

### What's Built

#### For Clients
- ✅ **Daily Check-Ins**: Log weight, steps, calories, sleep quality, perceived effort, and notes
- ✅ **Personal Dashboard**: Quick stats and entry history with visual tracking
- ✅ **Self-Service Settings**: Change password, view OAuth connections, manage account
- ✅ **Seamless Onboarding**: Automatic coach assignment via email invitations

#### For Coaches
- ✅ **Cohort Management**: Create and manage multiple client cohorts
- ✅ **Two-Tier Invitations**: Global coach invites + cohort-specific invites
- ✅ **Client Assignment**: Assign existing clients to cohorts
- ✅ **Real-Time Search**: Search clients by name or email across dashboard and cohorts
- ✅ **Analytics Dashboard**: Cohort summaries with sparklines and trends
- ✅ **Individual Client View**: Detailed analytics per client with entry history
- ✅ **Weekly Notes**: Coach notes system for client progress tracking
- ✅ **Weekly Review Queue**: Centralized dashboard for reviewing all clients' weekly progress with copyable email drafts and Loom video responses
- ✅ **Custom Prompts**: Configure custom check-in questions per cohort

#### For Admins
- ✅ **User Management**: View all users, assign roles, reset passwords
- ✅ **Real-Time Search**: Search users by name, email, or role; search cohorts by name or coach
- ✅ **Coach Management**: Invite new coaches, assign coaches to cohorts
- ✅ **Attention Dashboard**: Auto-generated insights and attention scores
- ✅ **System Overview**: Platform-wide metrics and health monitoring
- ✅ **Audit Trail**: Complete action history for compliance

#### System Features
- ✅ **Multi-Provider Auth**: Google OAuth, Apple Sign-In, Email/Password
- ✅ **Role-Based Access Control**: CLIENT, COACH, ADMIN roles with proper authorization
- ✅ **Transactional Emails**: Automated invitations and welcome emails (via Resend)
- ✅ **Test User Support**: Email suppression for development/testing
- ✅ **Error Boundaries**: Graceful error handling throughout the app
- ✅ **Responsive Design**: Mobile-first UI with Tailwind CSS

#### In Development
- 🧪 **HealthKit ingestion pipeline**: API endpoints for workouts, steps, sleep, and body metrics; coach-facing HealthKit data explorer and pairing flow
- 🧪 **iOS app integration**: Mobile app not shipped yet; current repo includes backend + UI scaffolding awaiting the iOS client

### Tech Stack

**Frontend/Backend**
- Next.js 16.1.1 (App Router) with React 19 Server Components
- TypeScript for type safety across the stack
- Tailwind CSS 4.1.18 for styling
- Turbopack for fast development builds

**Database & Auth**
- PostgreSQL via Railway (production-grade relational database)
- Prisma 6.19.1 ORM with type-safe queries
- NextAuth.js v5 with JWT sessions (1-hour duration)
- bcrypt password hashing (10 rounds)

**Infrastructure**
- Vercel for hosting and automatic deployments
- Railway for PostgreSQL database
- Resend for transactional emails
- GitHub for version control and PR workflow

**Data Visualization**
- Recharts 3.6.0 for analytics charts and sparklines

---

## 🎯 Where We're Going

### Phase 2: Enhanced Health Tracking (Q1 2025)

**Mobile App Integration**
- 📱 iOS app that pairs with CoachFit and syncs HealthKit data (workouts, steps, sleep, weight, height)
- 🔐 Secure pairing flow using one-time codes generated by coaches
- 🧭 Data source indicators (HealthKit vs manual) with manual check-ins still supported
- 📈 Expanded HealthKit coverage and richer workout metadata for analytics

**Advanced Analytics**
- 📉 Trend detection and anomaly alerts
- 🎯 Goal setting and progress tracking
- 📊 Comparative analytics across cohorts
- 🤖 AI-generated insights for coaches

**Coach Tools Enhancement**
- 📝 Rich text coach notes with tagging
- 📅 Workout plan templates
- 💬 In-app messaging between coaches and clients
- 📋 Client progress reports (PDF export)

### Phase 3: Platform Scale (Q2 2025)

**Multi-Coach Organizations**
- 👥 Organization accounts with multiple coaches
- 🔐 Org-level admin controls
- 💳 Subscription management and billing
- 📊 Organization-wide analytics

**Client Experience**
- 🎨 Customizable dashboard layouts
- 🏆 Achievement badges and milestones
- 📸 Photo progress tracking
- 🤝 Client community features (optional peer support)

**Integration Ecosystem**
- 🔌 Zapier integration for workflow automation
- 📧 Email marketing integrations (Mailchimp, ConvertKit)
- 💳 Payment processing (Stripe)
- 📱 Wearable device integrations (Fitbit, Garmin, Oura)

### Phase 4: AI & Automation (Q3 2025)

**AI-Powered Coaching**
- 🤖 Automated check-in responses with sentiment analysis
- 💡 Personalized recommendations based on client data
- ⚠️ Early warning system for client drop-off risk
- 📝 Auto-generated progress summaries

**Coach Efficiency**
- ⏱️ Time-saving automation for routine tasks
- 📊 Predictive analytics for client success
- 🎯 Smart cohort suggestions based on client profiles
- 📈 Automated reporting and insights

---

## 🚀 Getting Started

### Quick Start (Local Development)

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

Open [http://localhost:3000](http://localhost:3000) and login with:
- Coach: `coach@test.local` / `coach123`
- Client: `client@test.local` / `client123`

### Environment Variables

Create `.env.local` with:

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

See [CLAUDE.md](./CLAUDE.md) for detailed setup instructions and architecture documentation.

---

## 📚 Key Scripts

```bash
# Development
npm run dev              # Start dev server with Turbopack
npm run build            # Production build
npm run start            # Start production server
npm run lint             # Run ESLint

# Database
npm run db:generate      # Generate Prisma Client (after schema changes)
npm run db:migrate       # Run migrations (for production)
npm run db:push          # Push schema changes (for prototyping)
npm run db:studio        # Open Prisma Studio (database GUI)

# Test Data
npm run db:seed          # Create basic test users
npm run test:generate    # Generate full test dataset (15 clients, 5 cohorts, entries)
npm run test:cleanup     # Remove all test data

# Admin Utilities
npm run admin:set [email]              # Grant admin role to user
npm run password:set [email] [password] # Set password for user

# Email Setup (Resend)
npm run email:setup-templates    # Setup email templates
npm run email:verify             # Verify Resend API key
```

---

## 🏗️ Architecture Highlights

### Database Schema (Prisma)

**Core Models**:
- `User` - Central entity with roles array (CLIENT, COACH, ADMIN)
- `Cohort` - Groups of clients managed by a coach
- `CohortMembership` - Join table linking clients to cohorts
- `Entry` - Daily fitness data (weight, steps, calories, sleep, effort, notes, custom responses)
- `CoachInvite` - Global coach invitations (links user to coach)
- `CohortInvite` - Cohort-specific invitations (auto-assigns on signup)
- `CoachNote` - Weekly coach notes for client progress
- `CohortCheckInConfig` - Custom prompts per cohort
- `AdminInsight` - Auto-generated insights for admin dashboard
- `AttentionScore` - Calculated attention scores for prioritization
- `AdminAction` - Audit trail for admin operations

### Authentication Flow

1. **Multi-Provider Support**: Google OAuth, Apple Sign-In, Email/Password
2. **Invitation Processing**: On sign-in, both CoachInvite and CohortInvite are processed automatically
3. **JWT Sessions**: 1-hour duration with role data embedded in token
4. **Middleware**: Lightweight JWT parsing to avoid Edge Function size limits
5. **Role-Based Authorization**: Every protected route validates user roles

### API Design Patterns

- **Consistent Response Structure**: `{ data }` for success, `{ error }` for failures
- **Zod Validation**: All inputs validated with type-safe schemas
- **Ownership Checks**: Routes verify user owns resources or has appropriate role
- **Error Handling**: Graceful degradation with user-friendly messages
- **Security First**: Authentication, authorization, input validation on every route

---

## 🤝 Contributing

This project follows a **batch-based development workflow**:

### Small/Medium Features (Direct PR)
1. Create feature branch: `git checkout -b feature/[name]`
2. Implement full batch (frontend + backend + data + tests)
3. Create PR with complete description
4. Merge after review

### Large/Complex Features (Issue First)
1. Create GitHub issue with implementation guide
2. Discuss architectural approach
3. Refine plan based on feedback
4. Implement as batches
5. Create PR referencing issue

See [CLAUDE.md](./CLAUDE.md) for the complete development workflow and operating contract.

---

## 📖 Additional Resources

- **[Documentation Hub](./docs/README.md)** - Central documentation index
- **[CLAUDE.md](./CLAUDE.md)** - AI-assisted development operating contract
- **[CONTRIBUTING.md](./docs/misc/CONTRIBUTING.md)** - How to contribute to CoachFit
- **[Database Schema](./prisma/schema.prisma)** - Full Prisma schema with relationships

---

## 🔒 Security

- **Input Validation**: Zod schemas for all API inputs
- **SQL Injection Protection**: Prisma ORM with parameterized queries
- **XSS Protection**: React automatic escaping
- **Password Security**: bcrypt hashing (10 rounds)
- **JWT Tokens**: 1-hour expiration with secure signing
- **Role-Based Access**: Strict authorization checks on all protected routes
- **Secrets Management**: Environment variables only, never hard-coded
- **Test User Safety**: Email suppression for development accounts

---

## 📊 Project Stats

- **Lines of Code**: ~15,000+ (TypeScript + React + Prisma)
- **API Endpoints**: 40+ RESTful routes
- **Database Tables**: 11 core models
- **User Roles**: 3 (CLIENT, COACH, ADMIN)
- **Development Time**: ~3 months (with AI assistance)
- **Deployment**: Continuous (Vercel auto-deploy on merge to main)

---

## 🎓 What We've Learned

### Key Technical Decisions

1. **Next.js 16 App Router**: Server Components + streaming for optimal performance
2. **Prisma ORM**: Type-safe database queries with excellent migration tools
3. **NextAuth.js v5**: Flexible authentication with multiple providers
4. **Lightweight Middleware**: Manual JWT parsing to stay under Edge Function limits
5. **Invitation Flow**: Two-tier system (global + cohort) for flexible onboarding
6. **Role Arrays**: Users can have multiple roles (COACH + ADMIN) for flexibility
7. **Entry Upsert**: One entry per user per day via unique constraint
8. **Test User Pattern**: `isTestUser` flag for email suppression in development

### AI Collaboration Insights

- **Parallel Thinking**: AI excels at designing full-stack features in complete batches
- **Pattern Recognition**: AI quickly adapts to project conventions and replicates patterns
- **Documentation**: AI maintains comprehensive docs alongside code changes
- **Security**: AI proactively implements security best practices
- **Trade-offs**: AI clearly articulates architectural trade-offs for decision-making

---

## 📝 License

ISC

---

## 🙏 Acknowledgments

**Built with Claude** (Anthropic) - AI pair programming at its finest.

This project demonstrates what's possible when human product vision meets AI technical execution, following a disciplined full-stack parallel development workflow.

---

**Last Updated**: January 2026
**Version**: 1.0.0
**Next.js**: 16.1.1
**Development Partner**: Claude (Anthropic)
