import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const overlay = JSON.parse(
  readFileSync(resolve(root, "product-overlay.json"), "utf8"),
);

function fail(message) {
  throw new Error(`discovery-watch source audit failed: ${message}`);
}

function requireText(text, fragment, description = fragment) {
  if (!text.includes(fragment)) {
    fail(`missing ${description}`);
  }
}

function requireOrder(text, first, second, description) {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);
  if (firstIndex < 0 || secondIndex < 0 || firstIndex >= secondIndex) {
    fail(description);
  }
}

for (const source of overlay.sources) {
  const directory = resolve(root, source.path);
  const actual = execFileSync("git", ["-C", directory, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  if (actual !== source.sha) {
    fail(`${source.fullName} expected ${source.sha}, observed ${actual}`);
  }
}

const nodeSource = resolve(root, "sources/fiducia-node.rs");
const discovery = readFileSync(resolve(nodeSource, "src/discovery.rs"), "utf8");
const cargo = readFileSync(resolve(nodeSource, "Cargo.toml"), "utf8");

requireText(
  cargo,
  'fiducia-routing = { path = "../fiducia-routing.rs" }',
  "the pinned sibling routing dependency",
);
requireText(
  cargo,
  'fiducia-interfaces = { path = "../fiducia-interfaces/generated/rust" }',
  "the pinned sibling interface dependency",
);

requireText(
  discovery,
  "const WATCH_QUEUE_CAPACITY: usize = 32;",
  "bounded per-client watch queue",
);
requireText(
  discovery,
  "const WATCH_MAX_RECONCILE_MS: u64 = 60_000;",
  "bounded lease reconciliation interval",
);
requireText(
  discovery,
  "node.watch(crate::state::SERVICE_DOMAIN).await",
  "the canonical service-domain committed-change subscription",
);
requireOrder(
  discovery,
  "let Some(changes) = node.watch(crate::state::SERVICE_DOMAIN).await",
  "let initial_instances = match read_service_instances",
  "watch must subscribe before its initial authoritative read",
);
requireText(
  discovery,
  "Err(broadcast::error::RecvError::Lagged(skipped_events))",
  "broadcast lag detection",
);
requireText(
  discovery,
  '"lagged",\n                        None,\n                        Some(skipped_events)',
  "lag-triggered authoritative snapshot repair",
);
requireText(
  discovery,
  '"change",\n                        Some(revision),',
  "authoritative snapshot after each matching committed delta",
);
requireText(
  discovery,
  '"lease_reconcile",',
  "lease-expiry reconciliation",
);
requireText(
  discovery,
  '.event(self.event)\n            .retry(WATCH_RETRY_AFTER)',
  "SSE retry contract",
);
requireText(
  discovery,
  "event = event.id(id.to_string());",
  "monotonic committed revision event IDs",
);
requireText(
  discovery,
  'HeaderValue::from_static("no-cache, no-transform")',
  "anti-buffering cache control",
);
requireText(
  discovery,
  "the broadcast itself is not a retained cross-restart event log",
  "the non-durable acceleration-channel boundary",
);
requireText(
  discovery,
  '"authoritative": true',
  "explicit authoritative snapshot marker",
);
requireText(
  discovery,
  '"retryable": true',
  "retryable unavailable envelope",
);

for (const testName of overlay.requiredRustTests) {
  const expression = new RegExp(`\\bfn\\s+${testName}\\s*\\(`, "u");
  if (!expression.test(discovery)) {
    fail(`required Rust test ${testName} is absent`);
  }
}

const report = {
  profile: overlay.profile,
  sourcePinsVerified: overlay.sources.length,
  requiredRustTestsVerified: overlay.requiredRustTests.length,
  reconnectContract: overlay.watchContract.reconnect,
  resumeSemantics: overlay.watchContract.resumeSemantics,
  durableReplayClaim: overlay.watchContract.durableReplayClaim,
};
console.log(JSON.stringify(report, null, 2));
