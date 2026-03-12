#!/usr/bin/env bun

type Target = {
  archLabel: string;
  target: string;
  extension?: string;
};

const TARGETS: Target[] = [
  { archLabel: 'x86_64-unknown-linux-gnu', target: 'bun-linux-x64' },
  { archLabel: 'aarch64-unknown-linux-gnu', target: 'bun-linux-arm64' },
  { archLabel: 'x86_64-pc-windows-msvc', target: 'bun-windows-x64', extension: '.exe' },
  { archLabel: 'x86_64-apple-darwin', target: 'bun-darwin-x64' },
  { archLabel: 'aarch64-apple-darwin', target: 'bun-darwin-arm64' },
];

async function main() {
  for (const target of TARGETS) {
    await buildTarget(target);
  }
}

async function buildTarget({ archLabel, target, extension }: Target) {
  const outputDir = `./dist/${archLabel}`;
  await Bun.$`mkdir -p ${outputDir}`;
  const outfile = `${outputDir}/invoke-agent${extension ?? ''}`;
  await Bun.$`bun build --compile --target=${target} ./src/cmd/main.ts --outfile ${outfile}`;
  console.log(`Built ${outfile}`);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('Build failed', error);
    process.exit(1);
  });
}
