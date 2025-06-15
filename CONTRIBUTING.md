# Contributing to Trade Republic Connector

Thank you for your interest in contributing to the Trade Republic Connector! This project aims to provide a secure, TypeScript-based API connector for Trade Republic.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/trade-republic-connector.git
   cd trade-republic-connector
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Set up environment** (optional, for testing):
   ```bash
   cp .env.example .env
   # Edit .env with your test credentials (keep them secure!)
   ```

## Development Workflow

### Before You Start
- Check existing [issues](https://github.com/carlosdamken/trade-republic-connector/issues) and [pull requests](https://github.com/carlosdamken/trade-republic-connector/pulls)
- Create or comment on an issue to discuss your proposed changes
- For large features, consider opening a discussion first

### Making Changes
1. **Create a new branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-fix-name
   ```

2. **Follow coding standards**:
   ```bash
   npm run lint        # Check linting
   npm run lint:fix    # Auto-fix linting issues
   npm run format      # Format code with Prettier
   ```

3. **Write/update tests**:
   ```bash
   npm run test        # Run tests in watch mode
   npm run test:run    # Run tests once
   npm run test:coverage # Run tests with coverage
   ```

4. **Build and verify**:
   ```bash
   npm run build       # Build the project
   npm run type-check  # Check TypeScript types
   ```

### Submitting Changes
1. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add new feature" # or "fix: resolve issue"
   ```
   
   Use [conventional commits](https://www.conventionalcommits.org/):
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation
   - `test:` for tests
   - `refactor:` for code refactoring
   - `style:` for formatting changes

2. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create a pull request** on GitHub

## Code Guidelines

### TypeScript Standards
- Use strict TypeScript configuration
- Provide proper type definitions
- Avoid `any` types when possible
- Document complex types and interfaces

### Security Guidelines
- Never commit real credentials or API keys
- Use environment variables for sensitive data
- Follow secure coding practices
- Review security implications of changes

### Testing Standards
- Write unit tests for new features
- Maintain or improve test coverage
- Test edge cases and error scenarios
- Mock external dependencies appropriately

### Documentation
- Update README.md for user-facing changes
- Add JSDoc comments for public APIs
- Include examples for new features
- Update type definitions

## Project Structure

```
src/
├── index.ts              # Main entry point
├── types/               # TypeScript type definitions
├── config/              # Configuration management
├── auth/                # Authentication handling
├── api/                 # API client and HTTP handling
├── utils/               # Utility functions
tests/                   # Test files
examples/                # Usage examples
scripts/                 # Development scripts
```

## Release Process

This project follows semantic versioning (SemVer):
- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality
- **PATCH** version for backwards-compatible bug fixes

## Security

### Reporting Security Issues
Please report security vulnerabilities via email to: carlos@damken.com

Do **NOT** open public issues for security vulnerabilities.

### Security Best Practices
- Keep dependencies updated
- Use secure authentication methods
- Validate all inputs
- Follow OWASP guidelines

## Legal and Compliance

### Disclaimer
This is an **unofficial** API connector. Use at your own risk.

- Not affiliated with Trade Republic Bank GmbH
- No warranty or guarantees provided
- Users are responsible for compliance with Terms of Service
- Trading involves financial risk

### License
This project is licensed under the MIT License. By contributing, you agree that your contributions will be licensed under the same license.

## Questions and Support

- **Issues**: Use GitHub Issues for bugs and feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas
- **Email**: carlos@damken.com for private matters

## Recognition

Contributors will be acknowledged in:
- README.md contributor list
- Release notes for significant contributions
- GitHub contributor graph

Thank you for helping make this project better! 🚀

---

*Author: Carlos Damken (carlos@damken.com)*
