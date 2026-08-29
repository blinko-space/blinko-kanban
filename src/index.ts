import { defineExtension } from "@blinko-cloud/cli/sdk";

defineExtension({
  activate: async () => {
    // The signed sidebar Custom View owns the board UI. Persistence stays capability-scoped
    // through the Blinko App Entity bridge.
  },
});
