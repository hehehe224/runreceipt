#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createReceipt, renderReceipt, verifyReceipt, writeReceipt } from "../src/receipt.js";

const args = process.argv.slice(2);
const action = args.shift();
const help = `runreceipt\n\n  run [--out receipt.json] [--sign private.pem] -- <command>\n  verify <receipt.json> [--key public.pem]\n  render <receipt.json>\n\nReceipts store hashes, not command output. Private keys and logs are never copied.`;
const option = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };

if (!action || ["help", "--help", "-h"].includes(action)) {
  console.log(help);
  process.exit(0);
}

try {
  if (action === "run") {
    const split = args.indexOf("--");
    const command = split >= 0 ? args.slice(split + 1) : args.filter((arg, index) => !["--out", "--sign"].includes(args[index - 1]) && !["--out", "--sign"].includes(arg));
    if (!command.length) throw new Error("Missing command. Example: runreceipt run -- npm test");
    const receipt = await createReceipt({ command, cwd: process.cwd(), privateKeyPath: option("--sign") });
    const output = resolve(option("--out") ?? `.runreceipt/${receipt.id}.json`);
    await writeReceipt(output, receipt);
    console.log(`\nreceipt  ${output}\nstatus   ${receipt.result.exitCode === 0 ? "verified pass" : "verified failure"}\nid       ${receipt.id}`);
    process.exitCode = receipt.result.exitCode;
  } else if (action === "verify") {
    const file = args.find((arg) => !arg.startsWith("-") && arg !== option("--key"));
    if (!file) throw new Error("Missing receipt path.");
    const receipt = JSON.parse(await readFile(resolve(file), "utf8"));
    const result = await verifyReceipt(receipt, option("--key"));
    console.log(`${result.valid ? "VALID" : "INVALID"}  ${result.message}`);
    process.exitCode = result.valid ? 0 : 1;
  } else if (action === "render") {
    const file = args[0];
    if (!file) throw new Error("Missing receipt path.");
    console.log(renderReceipt(JSON.parse(await readFile(resolve(file), "utf8"))));
  } else {
    throw new Error(`Unknown command: ${action}`);
  }
} catch (error) {
  console.error(`runreceipt: ${error.message}`);
  process.exitCode = 2;
}
