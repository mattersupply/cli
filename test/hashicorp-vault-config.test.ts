import { assert } from 'chai'
import { VaultRemoteConfigurationService } from '../src/lib/config/hashicorp-vault'
import { getMatterConfig } from '../src/lib/matter-config'

describe('HashiCorp Vault Config Provider', () => {
  describe('Userpass Login', function () {
    it('Should parse username/password from the config', async function () {
      process.env.VAULT_USERNAME = 'test-user'
      process.env.VAULT_PASSWD = 'test-password'
      const vaultConfig = await getMatterConfig('./test/assets/config/vault-github.yml')
      console.log(vaultConfig)

      const remoteConfigService = new VaultRemoteConfigurationService(vaultConfig!)
      await remoteConfigService.init()

      await remoteConfigService.deleteEntries(['test-key'], ['develop'])

      // await remoteConfigService.getEntries(['test-key'], ['develop'])
    })
  })
})
