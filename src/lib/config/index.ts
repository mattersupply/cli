import { Config } from '../matter-config'
import { AWSSSMRemoteConfigurationService } from './aws-ssm'
import { RemoteConfigurationService } from './config'
import { VaultRemoteConfigurationService } from './hashicorp-vault'

// Factory to return the config service
enum RemoteConfigSource {
  awsSsm = 'awsSsm',
  vault = 'vault',
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
    default:
      throw new Error(`Unknown remote config source: ${source}`)
  }
}
