import { Config } from '../matter-config'
import { AWSSSMRemoteConfigurationService } from './aws-ssm'
import { RemoteConfigurationService } from './config'
import { VaultRemoteConfigurationService } from './hashicorp-vault'
import { LocalFileConfigurationService } from './local-file'

// Factory to return the config service
enum RemoteConfigSource {
  awsSsm = 'awsSsm',
  vault = 'vault',
  local = 'local',
}

export async function createRemoteConfigService(
  config: Config
): Promise<RemoteConfigurationService> {
  const source = config.get('remoteConfig.source')

  switch (source) {
    case RemoteConfigSource.awsSsm:
      return new AWSSSMRemoteConfigurationService(config)
    case RemoteConfigSource.vault: {
      const s = new VaultRemoteConfigurationService(config)
      await s.init()
      return s
    }
    case RemoteConfigSource.local:
      return new LocalFileConfigurationService(config)
    default:
      throw new Error(`Unknown remote config source: ${source}`)
  }
}
