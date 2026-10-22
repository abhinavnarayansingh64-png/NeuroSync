# Browser Receiver Handoff Notes

The supplied receiver-dashboard screenshot contains the browser-only messages: “Browser diagnostic: WebGPU is available, but Chrome did not expose an exact physical GPU model.” and “Optional local agent: Verified by the Electron main process through nvidia-smi.” These messages are contradictory in a browser workspace because Electron-native diagnostics cannot originate there.

The browser Receiver revision will remove this diagnostic block and browser hardware enrollment. Browser Receiver will retain Job History and Earnings & Analytics, use a desktop-app handoff for job acceptance, and surface an assigned desktop receiver job at the top only when shared backend state and desktop-reported telemetry are available.
