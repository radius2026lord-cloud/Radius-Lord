#!/usr/bin/env bash
set -euo pipefail
# Deliberately not a successful no-op. Never replay all migrations on imported data.
# Implement the receipt contract in docs/system-releases.md after reviewing the
# approved central baseline and current tenant versions. The trusted host hook
# must return central + every targeted tenant result and backward compatibility.
echo 'Migration blocked: install the reviewed database migration adapter for this host.' >&2
exit 1
