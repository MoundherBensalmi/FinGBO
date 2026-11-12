/**
 * Creates a user from the command line (used for the first admin).
 *
 *   pnpm --filter @fingbo/api user:create --username moundher
 *   pnpm --filter @fingbo/api user:create --username accountant --role viewer --full-name "Ali B."
 *
 * The password is asked for twice and is not shown while typing.
 */
import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'
import { USER_ROLES, loginInputSchema } from '@fingbo/shared/auth'
import { z } from 'zod'
import { client, db } from '../db'
import { users } from '../db/schema'
import { isUniqueViolation } from '../lib/pg-errors'
import { MIN_PASSWORD_LENGTH, hashPassword } from '../modules/auth/password'

const argsSchema = z.object({
  username: loginInputSchema.shape.username,
  role: z.enum(USER_ROLES).default('admin'),
  'full-name': z.string().trim().min(1).optional(),
})

// With piped input (not a terminal), lines are read in order from stdin.
const pipedLines = process.stdin.isTTY
  ? null
  : createInterface({ input: process.stdin })[Symbol.asyncIterator]()

async function askHidden(question: string): Promise<string> {
  process.stdout.write(question)

  if (pipedLines) {
    const line = await pipedLines.next()
    process.stdout.write('\n')
    return line.done ? '' : line.value
  }

  const stdin = process.stdin
  stdin.setRawMode(true)
  stdin.setEncoding('utf8')
  stdin.resume()

  return new Promise((resolve, reject) => {
    let value = ''
    const finish = (err?: Error) => {
      stdin.off('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
      process.stdout.write('\n')
      if (err) reject(err)
      else resolve(value)
    }
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return finish()
        if (ch === '\u0003') return finish(new Error('Cancelled'))
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1)
        else value += ch
      }
    }
    stdin.on('data', onData)
  })
}

async function main() {
  const { values } = parseArgs({
    options: {
      username: { type: 'string' },
      role: { type: 'string' },
      'full-name': { type: 'string' },
    },
  })

  const parsed = argsSchema.safeParse(values)
  if (!parsed.success) {
    console.error(z.prettifyError(parsed.error))
    console.error('\nUsage: user:create --username <name> [--role admin|viewer] [--full-name "<name>"]')
    process.exitCode = 1
    return
  }
  const args = parsed.data

  const password = await askHidden('Password: ')
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`The password must have at least ${MIN_PASSWORD_LENGTH} characters.`)
    process.exitCode = 1
    return
  }
  if ((await askHidden('Repeat password: ')) !== password) {
    console.error('The passwords do not match.')
    process.exitCode = 1
    return
  }

  try {
    const [user] = await db
      .insert(users)
      .values({
        username: args.username,
        passwordHash: await hashPassword(password),
        role: args.role,
        fullName: args['full-name'] ?? null,
      })
      .returning({ id: users.id, username: users.username, role: users.role })
    console.log(`Created ${user?.role} "${user?.username}" (id ${user?.id}).`)
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    console.error(`A user named "${args.username}" already exists.`)
    process.exitCode = 1
  }
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => client.end({ timeout: 5 }))
