import chalk = require('chalk')
import { RemoteConfigurationConfig } from './config'

export function logConfigurations(
  results: RemoteConfigurationConfig[],
  log: (message: string, ...args: any[]) => void
) {
  return results.forEach((result) => {
    if (result.entries.length > 0) {
      log(`  Stage: ${chalk.bold(result.stage)}:`)

      result.entries.forEach((entry) => {
        log(`    - ${chalk.bold(entry.key)}: ${chalk.green(entry.value)}`)
      })
    } else {
      log(`  Stage: ${chalk.bold(result.stage)}: ${chalk.red('No entries found')}`)
    }
  })
}
