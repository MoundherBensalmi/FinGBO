import type { DeviceHints } from '@fingbo/shared/auth'

// User-Agent Client Hints (Chrome, Edge, Samsung Internet). Not in every TS DOM lib yet.
type UADataValues = { model?: string; platform?: string; platformVersion?: string; mobile?: boolean }
type NavigatorUAData = { getHighEntropyValues(hints: string[]): Promise<UADataValues> }

/**
 * Reads the phone model and OS version so the session shows e.g. "SM-A546E · Android 14".
 * Chrome on Android no longer puts the model in the User-Agent, so this is the only way.
 * Returns undefined on browsers that don't support it (Safari, Firefox).
 */
export async function getDeviceHints(): Promise<DeviceHints | undefined> {
  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData
  if (!uaData) return undefined

  try {
    const v = await uaData.getHighEntropyValues(['model', 'platformVersion'])
    const hints: DeviceHints = {}
    if (v.model) hints.model = v.model.slice(0, 100)
    if (v.platform) hints.platform = v.platform.slice(0, 50)
    if (v.platformVersion) hints.platformVersion = v.platformVersion.slice(0, 50)
    if (typeof v.mobile === 'boolean') hints.mobile = v.mobile
    return hints
  } catch {
    return undefined
  }
}
