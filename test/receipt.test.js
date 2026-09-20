import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createReceipt, verifyReceipt } from "../src/receipt.js";

test("creates and verifies an unsigned passing receipt", async () => {
  const root = await mkdtemp(join(tmpdir(), "runreceipt-"));
  const receipt = await createReceipt({ command: [process.execPath, "-e", "console.log('ok')"], cwd: root });
  assert.equal(receipt.result.exitCode, 0);
  assert.equal((await verifyReceipt(receipt)).valid, true);
});

test("detects a modified receipt", async () => {
  const root = await mkdtemp(join(tmpdir(), "runreceipt-"));
  const receipt = await createReceipt({ command: [process.execPath, "-e", "process.exit(0)"], cwd: root });
  receipt.result.exitCode = 1;
  assert.equal((await verifyReceipt(receipt)).valid, false);
});

test("signs and verifies with Ed25519", async () => {
  const root = await mkdtemp(join(tmpdir(), "runreceipt-"));
  const { privateKey } = generateKeyPairSync("ed25519");
  const keyPath = join(root, "private.pem");
  await writeFile(keyPath, privateKey.export({ type: "pkcs8", format: "pem" }));
  const receipt = await createReceipt({ command: [process.execPath, "-e", "process.exit(0)"], cwd: root, privateKeyPath: keyPath });
  assert.equal((await verifyReceipt(receipt)).valid, true);
  assert.equal(receipt.proof.signatureAlgorithm, "ed25519");
});
