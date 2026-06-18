import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function fail(message, metadata = {}) {
  console.error(JSON.stringify({ status: "FAIL", message, ...metadata }, null, 2));
  process.exit(1);
}

function pass(message, metadata = {}) {
  console.log(JSON.stringify({ status: "PASS", message, ...metadata }, null, 2));
}

function readRelative(relativePath) {
  const absolutePath = path.join(root, relativePath);

  if (!fs.existsSync(absolutePath)) {
    fail("Required settlement boundary artifact is missing.", {
      path: relativePath,
    });
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function walkFiles(directory, files = []) {
  const absoluteDirectory = path.join(root, directory);

  for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const absolutePath = path.join(absoluteDirectory, entry.name);
    const relativePath = path.relative(root, absolutePath);

    if (entry.isDirectory()) {
      walkFiles(relativePath, files);
      continue;
    }

    if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      files.push(relativePath);
    }
  }

  return files;
}

function assertContains(relativePath, expectedValues) {
  const contents = readRelative(relativePath);
  const missing = expectedValues.filter((value) => !contents.includes(value));

  if (missing.length > 0) {
    fail("Settlement boundary artifact is missing expected content.", {
      path: relativePath,
      missing,
    });
  }

  pass("Settlement boundary artifact validated.", { path: relativePath });
}

function assertNoForbiddenSettlementImports() {
  const files = walkFiles("src/domains/settlement");
  const forbiddenPatterns = [
    {
      label: "ledger repository",
      pattern: /from\s+["'][^"']*ledger\/ledger\.repository["']/,
    },
    {
      label: "ledger helpers",
      pattern: /from\s+["'][^"']*ledger\/ledger\.helpers["']/,
    },
    {
      label: "ledger types shortcut",
      pattern: /from\s+["'][^"']*ledger\/ledger\.types["']/,
    },
    {
      label: "credit repository",
      pattern: /from\s+["'][^"']*credit\/credit-reservation\.repository["']/,
    },
    {
      label: "credit service shortcut",
      pattern: /from\s+["'][^"']*credit\/credit-reservation\.service["']/,
    },
  ];
  const violations = [];

  for (const file of files) {
    const contents = fs.readFileSync(path.join(root, file), "utf8");

    for (const forbidden of forbiddenPatterns) {
      if (forbidden.pattern.test(contents)) {
        violations.push({ file, type: forbidden.label });
      }
    }
  }

  if (violations.length > 0) {
    fail("Settlement imports a forbidden financial boundary dependency.", {
      violations,
    });
  }

  pass("No forbidden settlement financial imports found.", {
    scannedFileCount: files.length,
  });
}

function assertLegacyHelperRemoved() {
  const legacyPath = "src/domains/settlement/settlement-ledger.service.ts";

  if (fs.existsSync(path.join(root, legacyPath))) {
    fail("Legacy settlement ledger helper still exists.", { path: legacyPath });
  }

  pass("Legacy settlement ledger helper removed.", { path: legacyPath });
}

assertContains("docs/architecture/service-contract-settlement.md", [
  "Ledger effects",
  "Credit Wallet",
  "Idempotency",
  "Retry behavior",
  "Failure behavior",
]);

assertContains("src/domains/settlement/settlement-financial-effects.service.ts", [
  "ledger.entrypoints",
  "postLedgerEntry",
]);

assertContains("src/domains/settlement/settlement-credit.service.ts", [
  "credit.entrypoints",
  "applyCreditSettlement",
]);

assertNoForbiddenSettlementImports();
assertLegacyHelperRemoved();

pass("Settlement boundary hardening QA completed.");
