# Vulnerable Cache Target - GitHub Actions Cache Poisoning Demo

⚠️ **This repository is intentionally vulnerable for educational purposes!**

## Vulnerability Overview

This repository demonstrates **GitHub Actions cache poisoning** attack vector that bypasses npm 2FA using OIDC Trusted Publishing.

## Attack Surface

### 1. Vulnerable Workflow Configuration

**File:** `.github/workflows/vulnerable-pr-check.yml`

```yaml
on: pull_request_target  # ⚠️ Runs in base repo context with secrets

steps:
  - uses: actions/checkout@v4
    with:
      ref: ${{ github.event.pull_request.head.sha }}  # ⚠️ Executes PR code
  
  - uses: actions/cache@v3
    with:
      path: ~/.local/share/pnpm/store
      key: pnpm-v10-${{ hashFiles('pnpm-lock.yaml') }}  # ⚠️ Predictable key
  
  - run: pnpm install  # ⚠️ Uses cached binaries
  - run: pnpm run build  # ⚠️ Executes esbuild from cache
```

### 2. Cache Key Prediction

The cache key is **predictable** and **stable**:

```bash
# Anyone can calculate the exact key:
cache_key="pnpm-v10-$(sha256sum pnpm-lock.yaml | cut -d' ' -f1)"
```

### 3. Cache Scope

- Cache written by `pull_request_target` from forked PR
- Same cache accessible to `release` workflow on `main` branch
- Cache lives for **7 days** by default

## Attack Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: Cache Poisoning (from forked repository)              │
└─────────────────────────────────────────────────────────────────┘

1. Attacker forks this repository
2. Attacker creates malicious PR with:
   - Modified esbuild binary in pnpm store
   - Same pnpm-lock.yaml (cache key unchanged)
3. PR triggers pull_request_target workflow
4. Workflow writes POISONED cache under key:
   pnpm-v10-<hash-of-pnpm-lock.yaml>
5. PR can be closed immediately (cache already written)

┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: Cache Activation (on main branch)                     │
└─────────────────────────────────────────────────────────────────┘

6. Maintainer merges DIFFERENT PR (days later)
7. Release workflow runs on main branch
8. actions/cache restores POISONED cache (cache hit!)
9. pnpm install uses cached (malicious) esbuild binary
10. pnpm run build executes MALICIOUS esbuild
11. Malicious binary:
    - Reads /proc/<pid>/mem to extract OIDC token
    - Calls npm OIDC endpoint for publish token
    - Publishes to npm registry (bypassing 2FA)

┌─────────────────────────────────────────────────────────────────┐
│ Result: Package published to npm without any credentials!      │
└─────────────────────────────────────────────────────────────────┘
```

## Technical Details

### Why This Works

1. **pull_request_target** runs in base repo context:
   - Has access to `secrets.*`
   - Has `GITHUB_TOKEN` with write permissions
   - Has OIDC `id-token: write` capability

2. **Cache sharing** between workflows:
   - PR workflow writes cache
   - Release workflow reads same cache
   - No integrity verification

3. **OIDC Trusted Publishing**:
   - npm trusts GitHub's OIDC identity
   - No npm token required
   - 2FA doesn't apply to OIDC flow

### Cache Key Calculation

```bash
# The cache key is deterministic:
$ sha256sum pnpm-lock.yaml
abc123def456... pnpm-lock.yaml

# Cache key becomes:
pnpm-v10-abc123def456...
```

## Requirements for Attack

| Required | Not Required |
|----------|--------------|
| GitHub account (free) | npm credentials |
| Ability to open PR | PR to be merged |
| Knowledge of pnpm-lock.yaml | Maintainer access |
| Wait for another merge | Repository secrets |

## Mitigation

### 1. Never use pull_request_target with cache + code execution

**BAD:**
```yaml
on: pull_request_target
steps:
  - uses: actions/checkout@v4
    ref: ${{ github.event.pull_request.head.sha }}
  - uses: actions/cache@v3
  - run: pnpm install && pnpm build
```

**GOOD:**
```yaml
on: pull_request  # NOT pull_request_target
steps:
  - uses: actions/checkout@v4
  - uses: actions/cache@v3
  - run: pnpm install && pnpm build
```

### 2. Separate cache keys for PRs vs main

```yaml
key: ${{ github.event_name }}-pnpm-v10-${{ hashFiles('pnpm-lock.yaml') }}
# PR:   pull_request_target-pnpm-v10-abc123...
# Main: push-pnpm-v10-abc123...
```

### 3. Verify cache integrity

```yaml
- name: Verify esbuild binary
  run: |
    sha256sum node_modules/.pnpm/esbuild*/node_modules/esbuild/bin/esbuild
    # Compare with known good hash
```

### 4. Use lockfile integrity checks

```bash
pnpm install --frozen-lockfile --ignore-scripts
# Then verify installed binaries match expected hashes
```

## Testing This Repository

### Setup

```bash
# Clone
git clone https://github.com/sparkfinderoven/vulnerable-cache-target.git
cd vulnerable-cache-target

# Install (clean)
pnpm install
pnpm run build
pnpm run test
```

### Simulate Attack

See `ATTACK-DEMO.md` for step-by-step attack simulation.

## References

- [GitHub Actions Security Hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [npm Trusted Publishing](https://docs.npmjs.com/generating-provenance-statements)
- [OIDC Security Considerations](https://openid.net/specs/openid-connect-core-1_0.html)

## License

MIT - Educational purposes only

---

**⚠️ DO NOT USE THIS PATTERN IN PRODUCTION!**
# Test update
