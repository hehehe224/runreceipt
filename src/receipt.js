import { spawn } from "node:child_process";
import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};
const exec = (command, args, cwd, { stream = true } = {}) => new Promise((resolve) => {
  const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"], env: process.env });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; if (stream) process.stdout.write(chunk); });
  child.stderr.on("data", (chunk) => { stderr += chunk; if (stream) process.stderr.write(chunk); });
  child.on("error", (error) => resolve({ exitCode: 127, signal: null, stdout, stderr: `${stderr}${error.message}` }));
  child.on("close", (exitCode, signal) => resolve({ exitCode: exitCode ?? 1, signal, stdout, stderr }));
});
const git = async (cwd, args) => {
  const result = await exec("git", args, cwd, { stream: false });
  return result.exitCode === 0 ? result.stdout.trim() : null;
};

async function workspaceHash(cwd) {
  const listing = await git(cwd, ["ls-files", "-co", "--exclude-standard", "-z"]);
  if (listing === null) return sha256("no-git");
  const files = listing.split("\0").filter(Boolean).sort();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file).update("\0");
    try { hash.update(sha256(await readFile(join(cwd, file)))); }
    catch { hash.update("unreadable"); }
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function receiptPayload(receipt) {
  const { proof, ...payload } = receipt;
  return stable(payload);
}

export async function createReceipt({ command, cwd, privateKeyPath, now = () => new Date() }) {
  const started = now();
  const [commit, branch, statusBefore, treeHashBefore] = await Promise.all([
    git(cwd, ["rev-parse", "HEAD"]),
    git(cwd, ["branch", "--show-current"]),
    git(cwd, ["status", "--porcelain=v1"]),
    workspaceHash(cwd)
  ]);
  const result = await exec(command[0], command.slice(1), cwd);
  const finished = now();
  const [statusAfter, treeHashAfter] = await Promise.all([
    git(cwd, ["status", "--porcelain=v1"]),
    workspaceHash(cwd)
  ]);
  const base = {
    schema: "https://runreceipt.dev/schema/v1",
    createdAt: finished.toISOString(),
    durationMs: Math.max(0, finished.getTime() - started.getTime()),
    command,
    git: {
      commit,
      branch,
      dirtyBefore: Boolean(statusBefore),
      dirtyAfter: Boolean(statusAfter),
      treeHashBefore,
      treeHashAfter
    },
    result: {
      exitCode: result.exitCode,
      signal: result.signal,
      stdoutSha256: sha256(result.stdout),
      stderrSha256: sha256(result.stderr),
      stdoutBytes: Buffer.byteLength(result.stdout),
      stderrBytes: Buffer.byteLength(result.stderr)
    },
    runtime: { platform: process.platform, arch: process.arch, node: process.version }
  };
  const payloadHash = sha256(stable(base));
  const receipt = { id: `rr_${payloadHash.slice(0, 16)}`, ...base };
  const contentHash = sha256(receiptPayload(receipt));
  const proof = { algorithm: "sha256", contentHash };
  if (privateKeyPath) {
    const privateKey = createPrivateKey(await readFile(privateKeyPath));
    proof.signatureAlgorithm = "ed25519";
    proof.signature = sign(null, Buffer.from(contentHash), privateKey).toString("base64url");
    proof.publicKey = createPublicKey(privateKey).export({ type: "spki", format: "pem" }).toString();
    proof.keyFingerprint = sha256(proof.publicKey).slice(0, 16);
  }
  return { ...receipt, proof };
}

export async function verifyReceipt(receipt, publicKeyPath) {
  const actual = sha256(receiptPayload(receipt));
  if (actual !== receipt.proof?.contentHash) return { valid: false, message: "content hash mismatch; the receipt was changed" };
  if (!receipt.proof.signature) return { valid: true, message: "content hash matches (unsigned receipt)" };
  const publicKey = publicKeyPath ? await readFile(publicKeyPath) : receipt.proof.publicKey;
  if (!publicKey) return { valid: false, message: "signed receipt has no public key" };
  const valid = verify(null, Buffer.from(actual), createPublicKey(publicKey), Buffer.from(receipt.proof.signature, "base64url"));
  return { valid, message: valid ? `signature valid; key ${receipt.proof.keyFingerprint}` : "signature verification failed" };
}

export async function writeReceipt(path, receipt) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
}

export function renderReceipt(receipt) {
  const state = receipt.result.exitCode === 0 ? "PASS" : "FAIL";
  return [
    `## RunReceipt: ${state}`,
    "",
    `- Receipt: \`${receipt.id}\``,
    `- Command: \`${receipt.command.join(" ")}\``,
    `- Git commit: \`${receipt.git.commit ?? "not a Git repository"}\``,
    `- Exit code: \`${receipt.result.exitCode}\``,
    `- Duration: \`${receipt.durationMs} ms\``,
    `- Output hash: \`${receipt.result.stdoutSha256}\``,
    `- Proof: ${receipt.proof.signature ? `signed by key \`${receipt.proof.keyFingerprint}\`` : "content-hashed, unsigned"}`
  ].join("\n");
}
