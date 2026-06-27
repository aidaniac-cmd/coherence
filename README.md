# Coherence

The behavior pack clones Reality 0 into Realities 1-100, then runs the
declarative post-clone recipe in `scripts/realityCatalog.js`. Runtime behavior
(fog, camera cleanup, mob filtering, and safe arrival) lives in
`scripts/realityAdapter.js`.

Install/activate both this behavior pack and the companion `resource_pack`
folder. The behavior-pack manifest declares the resource-pack dependency so
the scoped fog definitions load with the world.

Reality 23 uses Bedrock's closest supported inverted-view approximation.
Bedrock camera presets expose pitch and yaw, but do not expose camera roll.
