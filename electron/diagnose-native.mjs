import { collectHardwareProfile } from './nativeTelemetry.mjs'

const profile = await collectHardwareProfile()
console.log(JSON.stringify(profile, null, 2))
