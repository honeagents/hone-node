# Contributing to Hone SDK

Thank you for your interest in contributing to the Hone SDK! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/hone-sdk.git
   cd hone-sdk
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build the project:
   ```bash
   npm run build
   ```

## Development Workflow

### Running Tests

```bash
# Run all tests
npm test

# Run tests once (no watch)
npm run test:unit

# Run type checking
npm run typecheck
```

### Building

```bash
# Build for production
npm run build

# Build in watch mode for development
npm run dev
```

### Code Style

- We use TypeScript with strict mode enabled
- Run linting before committing:
  ```bash
  npm run lint
  ```

## Making Changes

### Branching

1. Create a new branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes
3. Ensure tests pass and code is linted
4. Commit with clear, descriptive messages

### Commit Messages

Use clear, descriptive commit messages:

- `feat: add support for new provider`
- `fix: handle timeout errors correctly`
- `docs: update README examples`
- `test: add tests for tool tracking`

### Pull Requests

1. Push your branch to your fork
2. Create a Pull Request against the `main` branch
3. Fill out the PR template with:
   - Description of changes
   - Related issues (if any)
   - Testing performed
4. Wait for review and address any feedback

## Reporting Issues

### Bug Reports

When reporting bugs, please include:

- SDK version
- Node.js version
- Operating system
- Minimal reproduction steps
- Expected vs actual behavior
- Any error messages or stack traces

### Feature Requests

For feature requests, please describe:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

## Questions?

If you have questions about contributing, feel free to:

- Open a GitHub issue
- Contact us at team@honeagents.ai

Thank you for contributing!
