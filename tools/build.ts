#!/usr/bin/env -S deno run --allow-all

import $ from "@david/dax";

const SUPPORTED_ARCHS = [
  "x86_64-unknown-linux-gnu",
  "aarch64-unknown-linux-gnu",
  "x86_64-pc-windows-msvc",
  "x86_64-apple-darwin",
  "aarch64-apple-darwin",
];

async function main() {
  for (const arch of SUPPORTED_ARCHS) {
    await build(arch);
  }
}

async function build(arch: string) {
  let output = `./dist/${arch}/invoke-agent`;
  if (arch.includes("windows")) {
    output += ".exe";
  }

  await $`deno compile --allow-all --output ${output} --target ${arch} ./src/cmd/main.ts`;
  console.log(`Built ${output}`);
}

if (import.meta.main) {
  main();
}
