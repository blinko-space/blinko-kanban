# Blinko App rules

Use only the public @blinko-cloud/cli/sdk, @blinko-cloud/cli/ui, and @blinko-cloud/cli/custom-view interfaces. Never import host stores, tRPC, server, database, or undeclared network clients. The signed Custom View may use DOM, React, and CSS only inside its sandbox. Keep manifest permissions minimal and all visible text localized. Store every board as a versioned App Entity, preserve optimistic concurrency, and never add polling or background timers.
