import type { DeviceHints } from '@fingbo/shared/auth'
import Bowser from 'bowser'

const major = (version: string | undefined) => version?.split('.')[0] ?? ''

/** OS name from client hints, more precise than the User-Agent (which is frozen). */
function systemName(hints: DeviceHints | undefined): string | null {
  if (!hints?.platformVersion) return null
  const version = Number(major(hints.platformVersion))
  if (hints.platform === 'Android') return `Android ${version}`
  // Every Windows browser says "Windows NT 10.0"; the hint is 13+ on Windows 11.
  if (hints.platform === 'Windows') return version >= 13 ? 'Windows 11' : 'Windows 10'
  return null
}

/**
 * Builds a readable device label such as "Samsung SM-A546E · Android 14 · Chrome 131".
 *
 * Chrome on Android hides the phone model in the User-Agent (it sends "Android 10; K"),
 * so the model and Android version come from the hints the web app reads with
 * navigator.userAgentData. Safari never exposes the model: iPhones show as "Apple iPhone".
 */
export function describeDevice(userAgent: string | null, hints?: DeviceHints): string | null {
  if (!userAgent) return null

  const { browser, os, platform } = Bowser.parse(userAgent)

  const model =
    hints?.model?.trim() ||
    [platform.vendor, platform.model].filter(Boolean).join(' ') ||
    (platform.type ? platform.type[0]!.toUpperCase() + platform.type.slice(1) : '')

  const system = systemName(hints) ?? [os.name, os.versionName ?? major(os.version)].filter(Boolean).join(' ')

  const app = [browser.name, major(browser.version)].filter(Boolean).join(' ')

  const label = [model, system, app].filter(Boolean).join(' · ')
  return label ? label.slice(0, 200) : null
}
