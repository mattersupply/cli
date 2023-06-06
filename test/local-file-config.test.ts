import { assert } from 'chai'
import { LocalFileConfigurationService } from '../src/lib/config/local-file'
import { getMatterConfig } from '../src/lib/matter-config'

describe('Local File Config Provider', () => {
  // describe('Userpass Login', function () {
  it('Should parse username/password from the config', async function () {
    process.env.CONFIG_PASSWORD = 'god'
    const config = await getMatterConfig('./test/assets/config/local-file.yml')

    const stage = 'test-stage'
    const configService = new LocalFileConfigurationService(config!)
    await configService.getAllEntries([stage])

    // await remoteConfigService.getEntries(['test-key'], ['develop'])
  })
  // })
})
