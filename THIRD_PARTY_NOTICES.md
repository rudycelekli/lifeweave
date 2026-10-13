# Third party notices

LifeWeave's core and normal runtime renderer have no third-party runtime dependency beyond the LifeWeave packages and Node/platform APIs. The optional React adapter requires the host's React installation. Development dependencies, versions and integrity hashes are recorded in pnpm-lock.yaml; retain their own licenses when distributing their code.

A built macOS bundle may include a host-supplied Node binary. The build requires its matching complete notice file or marks the artifact local QA only. The retained official v24.19.0 notice file is under apps/desktop/vendor for the runtime used during local QA. Architecture, runtime provenance, notice matching, Developer ID signing and notarization require artifact-specific release review.

The upstream research snapshots are not redistributed. Projects without an inspected tracked license were treated as idea references. Rakazo integration-provider resale rights are separate from Rakazo's Apache-2.0 source license.
