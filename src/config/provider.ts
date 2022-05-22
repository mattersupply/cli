import { Config } from '../config-file'

export interface RemoteConfigEntry {
  key: string
  value: string
  type?: string
  description?: string
}

export abstract class ConfigProvider {
  abstract cfg: Config

  abstract getValues(
    stages: string[],
    keys: string[]
  ): Promise<{ [stage: string]: RemoteConfigEntry[] }>

  abstract setValues(
    stages: string[],
    entries: RemoteConfigEntry[]
  ): Promise<{ [stage: string]: RemoteConfigEntry[] }>

  abstract exportValues(stages: string[]): Promise<RemoteConfigEntry[]>

  abstract describeValues(
    stages: string[],
    raw: boolean
  ): Promise<{ [stage: string]: RemoteConfigEntry[] }>

  abstract deleteValues(
    stages: string[],
    keys: string[]
  ): Promise<{ [key: string]: Pick<RemoteConfigEntry, 'key'>[] }>
}
