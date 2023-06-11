export enum EntryType {
  string = 'string',
  secureString = 'secureString',
  stringList = 'stringList',
}

export enum OutputFormat {
  dotenv = 'dotenv',
  yaml = 'yaml',
}

export interface RemoteConfigurationEntry {
  key: string
  value: string | null | undefined
  type?: EntryType
  description?: string
}

export interface RemoteConfigurationEntryWithStage extends RemoteConfigurationEntry {
  stage: string
}

export interface RemoteConfigurationConfig {
  stage: string
  entries: RemoteConfigurationEntry[]
}

export interface RemoteConfigurationDeleteResult {
  stage: string
  deleted: string[]
  failed: string[]
}

export interface RemoteConfigurationService {
  getAllCombinedEntries(stages: string[]): Promise<RemoteConfigurationEntry[]>
  getAllEntries(stages: string[]): Promise<RemoteConfigurationConfig[]>
  getCombinedEntries(keys: string[], stages: string[]): Promise<RemoteConfigurationEntry[]>
  getEntries(keys: string[], stages: string[]): Promise<RemoteConfigurationConfig[]>
  setEntries(
    entries: RemoteConfigurationEntry[],
    stages: string[]
  ): Promise<RemoteConfigurationConfig[]>
  deleteEntries(keys: string[], stages: string[]): Promise<RemoteConfigurationDeleteResult[]>
}
