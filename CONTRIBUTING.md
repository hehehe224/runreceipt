# Contributing to RunReceipt

RunReceipt is intentionally small, evidence-oriented, and conservative about security claims. Focused bug fixes, portability improvements, tests, and documentation corrections are welcome.

## Before opening a pull request

1. Open an issue for large behavior or schema changes so the design can be discussed first.
2. Run `npm run check` and `npm test` on Node.js 20 or newer.
3. Add tests for behavior changes and failure paths.
4. Keep receipt output deterministic and backward-compatible with schema `v1`.
5. Explain the threat model for any change involving signatures, Git-state capture, command execution, or verification.

Do not include private keys, real secrets, proprietary logs, or third-party source code in fixtures.

## Reporting security issues

Do not open a public issue for a suspected vulnerability. Follow [SECURITY.md](SECURITY.md) to report it privately.

By contributing, you agree that your contribution is licensed under AGPL-3.0-only. The project name and artwork remain covered by [TRADEMARKS.md](TRADEMARKS.md).
