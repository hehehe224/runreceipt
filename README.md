<p align="center"><img src="assets/cover.svg" alt="RunReceipt - the command ran, here is the proof" width="100%" /></p>

# RunReceipt

Coding agents are excellent at reporting success. RunReceipt makes success verifiable.

It runs a command, binds the result to the current Git state, hashes stdout and stderr, and writes a portable receipt. Receipts can be signed with Ed25519 and verified later without storing command output or sending source code anywhere.

## Thirty-second demo

```bash
npx --yes github:hehehe224/runreceipt run -- npm test
npx --yes github:hehehe224/runreceipt verify .runreceipt/rr_*.json
```

The command still streams normally. At the end, RunReceipt writes evidence containing:

- exact command and exit status
- Git commit, branch, dirty state, and before/after hashes of tracked plus untracked files
- start time and duration
- SHA-256 hashes and byte counts for stdout and stderr
- runtime platform, architecture, and Node version
- an optional Ed25519 signature

It does **not** treat a receipt as proof that tests are good. It proves that this command produced this result against this repository state.

## Signed receipts

Generate an Ed25519 key with OpenSSL:

```bash
openssl genpkey -algorithm Ed25519 -out runreceipt-private.pem
openssl pkey -in runreceipt-private.pem -pubout -out runreceipt-public.pem
```

Run and sign:

```bash
npx --yes github:hehehe224/runreceipt run --sign runreceipt-private.pem --out test-receipt.json -- npm test
npx --yes github:hehehe224/runreceipt verify test-receipt.json --key runreceipt-public.pem
```

The public key is embedded for portable verification. Passing `--key` pins verification to a trusted key.

## Put the proof in a pull request

```bash
npx --yes github:hehehe224/runreceipt render test-receipt.json >> "$GITHUB_STEP_SUMMARY"
```

Example:

```text
RunReceipt: PASS
Receipt: rr_31a9a62cde5ee9f0
Command: npm test
Git commit: 8d342f...
Exit code: 0
Proof: signed by key 36d4f9f1a14d2d07
```

## Why hashes instead of logs?

Build output often contains paths, test data, URLs, or secrets. RunReceipt streams it to the current terminal but stores only its hash and byte count. Teams can retain logs in their existing CI system and use the hash to show which output belongs to the receipt.

## Common questions

### How can I verify an AI coding agent actually ran the tests?

Run the agent's test command through `runreceipt run -- <command>`. The resulting receipt records the command, exit status, duration, Git state, and output hashes. Signing the receipt lets another machine detect later edits and verify it against a trusted public key.

That proves the recorded command produced the recorded result for that repository state. It does not prove the tests were meaningful, the machine was trustworthy, or the agent did not run a different command elsewhere.

### How is RunReceipt different from CI logs or build attestations?

CI logs are useful evidence, but they are usually tied to one provider and can expose sensitive output. RunReceipt creates a small, portable artifact that can also be produced during local or agent-driven work and verified offline. Supply-chain attestations cover broader build provenance and artifact identity; RunReceipt is deliberately narrower and optimized for command execution evidence.

### Does RunReceipt upload or store logs and source code?

No. It runs locally, sends nothing to a service, and stores hashes plus metadata rather than stdout, stderr, or source contents. The receipt does include the command and Git metadata, so review it before sharing if those details are sensitive.

## Threat model

RunReceipt detects edited receipts and proves possession of a signing key. It does not sandbox the command, verify the honesty of the test suite, secure a compromised machine, or prove who controlled an unsigned run. For high-trust workflows, pin a public key in CI and protect the private key with the same care as a release-signing credential.

## Status

The receipt schema is intentionally small and currently versioned `v1`. Before `1.0`, new fields may be added, but existing v1 verification semantics will remain stable.

## License

Code is licensed under AGPL-3.0-only. The RunReceipt name and original artwork are reserved; see [TRADEMARKS.md](TRADEMARKS.md).

Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Security-sensitive changes must describe their threat model.
