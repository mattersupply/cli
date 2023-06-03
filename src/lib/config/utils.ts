import { defaults } from 'lodash'
import { RemoteConfigurationConfig, RemoteConfigurationEntry } from './config'

export function combineEntries(
  configs: RemoteConfigurationConfig[],
  stages: string[]
): RemoteConfigurationEntry[] {
  configs.sort((a, b) => {
    return stages.indexOf(a.stage) - stages.indexOf(b.stage)
  })

  const keyedSortedValues = configs.map((config) => {
    return config.entries.reduce<{ [key: string]: RemoteConfigurationEntry }>((acc, entry) => {
      acc[entry.key] = entry
      return acc
    }, {})
  })

  const merged = defaults(keyedSortedValues[0], ...keyedSortedValues) as {
    [key: string]: RemoteConfigurationEntry
  }

  return Object.values(merged)
}
