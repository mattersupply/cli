import { Config } from '../matter-config'
import { AWSSSMRemoteConfigurationService } from './aws-ssm'
import { RemoteConfigurationService } from './config'
import { VaultClient, VaultRemoteConfigurationService } from './hashicorp-vault'
import { LocalFileConfigurationService } from './local-file'
import { createSSMConfigManager } from './aws'

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
    case RemoteConfigSource.awsSsm: {
      const ssmClient = createSSMConfigManager(config)
      return new AWSSSMRemoteConfigurationService(config, ssmClient)
    }
    case RemoteConfigSource.vault: {
      const vaultClient = new VaultClient(
        config.get('remoteConfig.vault.address', ''),
        config.get('remoteConfig.vault.namespace', ''),
        {
          mountPoint: config.get('remoteConfig.vault.secretMountPoint'),
        }
      )
      const s = new VaultRemoteConfigurationService(config, vaultClient)
      await s.init()
      return s
    }
    case RemoteConfigSource.local:
      return new LocalFileConfigurationService(config)
    default:
      throw new Error(`Unknown remote config source: ${source}`)
  }
}
