# Contributing to CoachFit

Thank you for your interest in contributing to CoachFit! This guide will help you get started.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Contribution Guidelines](#contribution-guidelines)
5. [Pull Request Process](#pull-request-process)
6. [Code Style](#code-style)
7. [Testing](#testing)
8. [Documentation](#documentation)

---

## Code of Conduct

### Our Standards

- **Be respectful** and inclusive
- **Welcome newcomers** and help them learn
- **Focus on what is best** for the community and project
- **Show empathy** towards other community members

### Unacceptable Behavior

- Harassment, discrimination, or trolling
- Publishing others' private information
- Spam or off-topic discussions
- Any conduct that would be inappropriate in a professional setting

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (local or Railway)
- Git
- GitHub account
- Basic knowledge of Next.js, React, TypeScript, and Prisma

### Setting Up Your Development Environment

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/CoachFit.git
   cd CoachFit/Web
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/adamswbrown/CoachFit.git
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Set up environment**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```

6. **Set up database**:
   ```bash
   npm run db:migrate
   npm run db:generate
   npm run db:seed
   ```

7. **Start development server**:
   ```bash
   npm run dev
   ```

See [Developer Guide](./docs/development/getting-started.md) for detailed setup instructions.

---

## Development Workflow

CoachFit follows a **full-stack parallel execution workflow**. Read [CLAUDE.md](../../CLAUDE.md) for the complete operating contract.

### Small/Medium Features (Direct PR)

For clear, straightforward features (<4 hours):

1. **Create feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Implement full batch**:
   - Frontend components
   - Backend API routes
   - Database schema changes (if needed)
   - Tests (minimum viable)
   - Documentation updates

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

5. **Create Pull Request** on GitHub

### Large/Complex Features (Issue First)

For complex features (>4 hours, architectural decisions):

1. **Create GitHub Issue** with implementation guide (see [Issue #7](https://github.com/adamswbrown/CoachFit/issues/7) for template)

2. **Discuss approach** with maintainers

3. **Get approval** before implementing

4. **Follow steps 1-5 above** once approved

5. **Reference issue** in PR description

---

## Contribution Guidelines

### What We're Looking For

- **Bug fixes** - Help us squash bugs!
- **Feature implementations** - From our roadmap or your ideas
- **Documentation improvements** - Typos, clarity, examples
- **Performance optimizations** - Make it faster
- **Test coverage** - Improve reliability
- **Accessibility improvements** - Make it usable for everyone

### Before You Start

1. **Check existing issues and PRs** - Avoid duplicate work
2. **Discuss large changes first** - Open an issue before starting
3. **Follow the roadmap** - See [README.md](./README.md) for planned features
4. **Read the docs** - Understand the architecture and patterns

---

## Pull Request Process

### PR Checklist

Before submitting your PR, ensure:

- [ ] Code follows project style (ESLint passes)
- [ ] Build completes successfully (`npm run build`)
- [ ] Tests pass (when implemented)
- [ ] Documentation is updated (if needed)
- [ ] PR description follows template
- [ ] Commits are clear and descriptive
- [ ] Branch is up to date with main

### PR Description Template

```markdown
## Batch Summary
[One-line description of what ships]

## Changes
- Frontend: [what was built]
- Backend: [what was built]
- Data: [schema changes, if any]
- Tests: [what was tested]
- Security: [auth/validation added]

## Deployment Notes
- [ ] Environment variables needed: [yes/no]
- [ ] Database migration required: [yes/no]
- [ ] Breaking changes: [yes/no]

## Testing Done
- [ ] Tested with seed data
- [ ] Build passes locally
- [ ] Verified all user roles (CLIENT/COACH/ADMIN as applicable)

## Rollback Plan
[How to undo this if needed]
```

### Review Process

1. **Automated checks** run (build, lint)
2. **Maintainer review** (usually within 48 hours)
3. **Feedback and iteration** (if needed)
4. **Approval and merge** by maintainer
5. **Automatic deployment** to production (via Vercel)

---

## Code Style

### TypeScript

- Use TypeScript for all files
- Prefer type inference over explicit types (when clear)
- Use Zod schemas for runtime validation
- No `any` types (use `unknown` if necessary)

### React/Next.js

- Default to Server Components
- Use Client Components (`"use client"`) only when needed
- Use App Router conventions
- Follow Next.js best practices

### Code Formatting

```bash
# Run ESLint
npm run lint

# Auto-fix issues
npm run lint -- --fix
```

### Naming Conventions

- **Files**: `kebab-case.ts` or `PascalCase.tsx` (for components)
- **Components**: `PascalCase`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Types/Interfaces**: `PascalCase`

### Database

- Use Prisma for all database operations
- Never write raw SQL
- Always create migrations for schema changes
- Follow Prisma naming conventions

---

## Testing

### Manual Testing

Always test your changes manually:

```bash
# Use seed data
npm run db:seed
npm run test:generate

# Set passwords
npm run password:set coach@test.local coach123
npm run password:set client@test.local client123

# Test in browser
npm run dev
```

### Test User Credentials

- Coach: `coach@test.local` / `coach123`
- Client: `client@test.local` / `client123`

### Automated Testing (Future)

We're working on adding automated tests. Contributions welcome!

---

## Documentation

### When to Update Docs

Update documentation when you:
- Add new features
- Change existing behavior
- Add/modify API endpoints
- Update environment variables
- Change deployment process

### Documentation Structure

- **User docs**: `docs/user-guide/`
- **Developer docs**: `docs/development/`
- **API reference**: `docs/development/api-reference.md`
- **Operating contract**: `CLAUDE.md`

### Documentation Style

- Use clear, concise language
- Include code examples
- Add screenshots when helpful
- Keep it up to date

---

## Reporting Bugs

### Bug Report Template

When reporting a bug, include:

**Describe the bug**: Clear description of what's wrong

**To Reproduce**:
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

**Expected behavior**: What should happen

**Screenshots**: If applicable

**Environment**:
- OS: [e.g. macOS, Windows, Linux]
- Browser: [e.g. Chrome 120, Safari 17]
- Node version: [e.g. 18.17.0]

**Additional context**: Any other relevant information

---

## Requesting Features

### Feature Request Template

When requesting a feature:

**Is your feature request related to a problem?**
Clear description of the problem

**Describe the solution you'd like**
What you want to happen

**Describe alternatives you've considered**
Other approaches you've thought about

**Additional context**
Any other relevant information, mockups, examples

---

## Questions?

- **Documentation**: Check [docs/](./docs/)
- **Issues**: Open a [GitHub Issue](https://github.com/adamswbrown/CoachFit/issues)
- **Discussions**: Start a [GitHub Discussion](https://github.com/adamswbrown/CoachFit/discussions)

---

## Recognition

Contributors are recognized in:
- GitHub contributors list
- Release notes (for significant contributions)
- Project documentation (for major features)

---

## License

By contributing to CoachFit, you agree that your contributions will be licensed under the ISC License.

---

## Thank You!

Your contributions make CoachFit better for everyone. We appreciate your time and effort!

---

**Last Updated**: January 2025
