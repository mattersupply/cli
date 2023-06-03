import { Config } from '../matter-config'
import { AWSSSMRemoteConfigurationService } from './aws-ssm'
import { RemoteConfigurationService } from './config'

// Factory to return the config service
enum RemoteConfigSource {
  awsSsm = 'awsSsm',
}

export function createRemoteConfigService(config: Config): RemoteConfigurationService {
  const source = config.get('remoteConfig.source')

  switch (source) {
    case RemoteConfigSource.awsSsm:
      return new AWSSSMRemoteConfigurationService(config)
    default:
      throw new Error(`Unknown remote config source: ${source}`)
  }
}
