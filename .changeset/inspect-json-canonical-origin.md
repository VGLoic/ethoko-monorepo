---
"@ethoko/cli-beacon": minor
---

`inspect --json` now emits canonical Origin values on `origin.kind` (`forge-v1-default`, `forge-v1-with-build-info-option`, `hardhat-v2`, `hardhat-v3`, `hardhat-v3-non-isolated-build`). The previous `origin.format` field has been renamed to `origin.kind`, and the `"forge"` value has been split into `"forge-v1-default"` and `"forge-v1-with-build-info-option"` to match the storage Origin classification. Consumers of the `inspect --json` output must update accordingly.
