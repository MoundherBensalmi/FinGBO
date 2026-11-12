import { hash, verify } from '@node-rs/argon2'

export const MIN_PASSWORD_LENGTH = 8

/** argon2id hash with the library's recommended settings. */
export function hashPassword(password: string): Promise<string> {
  return hash(password)
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password)
  } catch {
    return false
  }
}

let dummyHash: Promise<string> | undefined

/**
 * Checks the password against a throwaway hash when the username doesn't exist,
 * so a wrong username takes as long as a wrong password and can't be detected by timing.
 */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hash('fingbo-timing-equaliser')
  await verifyPassword(await dummyHash, password)
}
