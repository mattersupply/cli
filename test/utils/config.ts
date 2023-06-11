import { unset } from 'lodash'
import { RemoteConfigurationConfig, RemoteConfigurationEntry } from '../../src/lib/config/config'

export function removeMetadataFromConfigs(configs: RemoteConfigurationConfig[]) {
  return configs.map((c) => {
    c.entries = removeMetadata(c.entries) as RemoteConfigurationEntry[]
    return c
  })
}

export function removeMetadata(entries: RemoteConfigurationEntry[] | undefined) {
  if (!entries) {
    return undefined
  }

  return entries.map((e) => {
    unset(e, 'type')
    unset(e, 'description')
    return e
  })
}
