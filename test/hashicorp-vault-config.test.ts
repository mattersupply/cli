import { assert } from 'chai'
import * as fs from 'fs'
import * as sinon from 'sinon'
import * as yaml from 'js-yaml'
import {
  VaultClient,
  VaultRemoteConfigurationService,
  MappedSecret,
} from '../src/lib/config/hashicorp-vault'
import { Config, getMatterConfig } from '../src/lib/matter-config'
import { get, has, isEmpty, isObject, merge, pickBy, set, unset } from 'lodash'
import { RemoteConfigurationConfig, RemoteConfigurationEntry } from '../src/lib/config/config'
import { type } from 'os'

const testConfig = {
  app: {
    name: 'my-test',
  },

  remoteConfig: {
    source: 'vault',
    vault: {
      address: 'https://example.com',
      namespace: 'test',

      pathFormat: '{appName}/{stage}/{key}',
      secretMountPoint: 'secret',

      auth: {
        mountPoint: 'test',
        options: {
          test: 'test-option',
        },
      },
    },
  },

  stages: ['test-stage-one', 'test-stage-two'],
}

function removeMetadataFromConfigs(configs: RemoteConfigurationConfig[]) {
  return configs.map((c) => {
    c.entries = removeMetadata(c.entries) as RemoteConfigurationEntry[]
    return c
  })
}

function removeMetadata(entries: RemoteConfigurationEntry[] | undefined) {
  if (!entries) {
    return undefined
  }

  return entries.map((e) => {
    unset(e, 'type')
    unset(e, 'description')
    return e
  })
}

describe('Vault Remote Config Provider', () => {
  let config: Config
  let configService: VaultRemoteConfigurationService

  const defaultMetadata = {
    created_time: '2021-01-01T00:00:00.000000Z',
    deletion_time: '',
    destroyed: false,
    version: 1,
    custom_metadata: null,
  }

  const testDataStageOne = {
    'test-key-one': { key: 'test-key-one', value: 'test-value-one' },
    'test-key-both-different': {
      key: 'test-key-both-different',
      value: 'test-value-both-one',
    },
    nested: {
      'test-key-nested': {
        key: 'nested/test-key-nested',
        value: 'test-value-nested',
      },
      more: {
        'test-key-more-nested': {
          key: 'nested/more/test-key-more-nested',
          value: 'test-value-nested',
        },
      },
    },

    // 'test-key-path/': {
    //   key: 'test-key-path/',
    //   // value: {
    //   //   'test-key-path-one': 'test-value-path-one',
    //   // },
    // },'
  }

  const testDataStageTwo = {
    'test-key-two': { key: 'test-key-two', value: 'test-value-two' },
    'test-key-both-different': {
      key: 'test-key-both-different',
      value: 'test-value-both-two',
    },
  }

  const testDataBothStages = {
    'test-key-both-same': {
      key: 'test-key-both-same',
      value: 'test-value-both-same',
    },
  }

  let database: { [stage: string]: { [key: string]: any } } = {}

  beforeEach(async function () {
    // We could just stub the config, but this is a good test to make sure it works end-to-end.
    sinon.stub(fs, 'existsSync').returns(true)
    sinon.stub(fs, 'readFileSync').returns(yaml.dump(testConfig))
    config = await getMatterConfig('fakepath.yml')
    sinon.restore()

    const vaultClient = new VaultClient('fake', 'fake', { mountPoint: 'fake' })

    database = {
      'test-stage-one': merge({}, testDataStageOne, testDataBothStages),
      'test-stage-two': merge({}, testDataStageTwo, testDataBothStages),
    }

    sinon.stub(vaultClient, 'kvGet').callsFake(async (path: string) => {
      const [app] = path.split('/')
      const key = path.replace(`${app}`, '').replace(/^\//, '').replace(/\//g, '.')

      const secret = get(database, key)
      const secretValue = pickBy(secret, (v, k) => has(v, 'value'))

      if (isEmpty(secretValue)) {
        return null
      }

      const data = Object.entries(secretValue).reduce((acc, [k, v]) => {
        return { ...acc, [k]: v.value }
      }, {})

      return { data: data, metadata: defaultMetadata }
    })

    sinon.stub(vaultClient, 'kvMetadataDelete')
    sinon.stub(vaultClient, 'kvList').callsFake(async (path: string) => {
      const [app] = path.split('/')
      let key = path.replace(`${app}`, '').replace(/^\//, '').replace(/\//g, '.')
      const secret = get(database, key)
      const secretFilesOrDirectories = pickBy(secret, (v, k) => !has(v, 'value'))

      const list = {
        keys: Object.keys(secretFilesOrDirectories).flatMap((k) => {
          // Check if the object at this key contains objects with keys (i.e. is a directory)
          const isFile =
            Object.entries(get(secretFilesOrDirectories, k)).filter(
              ([k, v]) => has(v, 'value') && isObject(v)
            ).length > 0
          const isDir =
            Object.entries(get(secretFilesOrDirectories, k)).filter(
              ([k, v]) => !has(v, 'value') && isObject(v)
            ).length > 0

          let keys: string[] = []
          if (isFile) {
            keys.push(k)
          }

          if (isDir) {
            keys.push(`${k}/`)
          }

          return keys
        }),
      }

      return list
    })

    sinon
      .stub(vaultClient, 'kvPatch')
      .callsFake(async (path: string, entry: string, value: string | null) => {
        const [app] = path.split('/')
        const keyPath = path.replace(`${app}`, '').replace(/^\//, '') + '/' + entry
        const key = keyPath.replace(/\//g, '.')

        if (value === null) {
          unset(database, key)
        } else {
          set(database, key, { key: keyPath, value: value })
        }
      })

    sinon
      .stub(vaultClient, 'kvPut')
      .callsFake(async (path: string, entry: string, value: string | null) => {
        const [app] = path.split('/')
        const keyPath = path.replace(`${app}`, '').replace(/^\//, '') + '/' + entry
        const key = keyPath.replace(/\//g, '.')

        set(database, key, { key: keyPath, value: value })
      })

    configService = new VaultRemoteConfigurationService(config!, vaultClient)
  })

  afterEach(function () {
    sinon.restore()
  })

  describe('Setting entries', () => {
    it('setEntries should set new entries and override existing entries', async function () {
      const newData = [
        { key: 'test-key-both-different', value: 'new-value-now-the-same' },
        { key: 'new-nested/test-key-new', value: 'new-value' },
        { key: 'nested/more/test-key-more-nested', value: 'new-value-nested' },
      ]

      const expectedResult = [
        { key: 'test-key-one', value: 'test-value-one' },
        { key: 'test-key-both-same', value: 'test-value-both-same' },
        { key: 'test-key-both-different', value: 'new-value-now-the-same' },
        { key: 'nested/test-key-nested', value: 'test-value-nested' },
        { key: 'nested/more/test-key-more-nested', value: 'new-value-nested' },
        { key: 'new-nested/test-key-new', value: 'new-value' },
      ].sort((a, b) => a.key.localeCompare(b.key)) as RemoteConfigurationEntry[]

      await configService.setEntries(newData, ['test-stage-one'])

      const entries = await configService.getAllEntries(['test-stage-one'])
      const result = removeMetadata(
        entries.find((e) => e.stage === 'test-stage-one')?.entries
      )?.sort((a, b) => a.key.localeCompare(b.key))

      assert.deepEqual(expectedResult, result)
    })
  })

  describe('Retrieve entries', () => {
    it('getAllEntries should get all entries for multiple stages', async function () {
      const entries = await configService.getAllEntries(['test-stage-one', 'test-stage-two'])

      // const expectedResult = [
      //   { stage: 'test-stage-one', entries: testDataStageOne.concat(testDataBothStages) },
      //   { stage: 'test-stage-two', entries: testDataStageTwo.concat(testDataBothStages) },
      // ]

      // assert.deepEqual(entries, expectedResult)
    })

    it('getAllCombinedEntries should combine all entries for multiple stages', async function () {
      const entries = await configService.getAllCombinedEntries([
        'test-stage-one',
        'test-stage-two',
      ])

      const expectedResult = [
        { key: 'test-key-one', value: 'test-value-one' },
        { key: 'test-key-both-different', value: 'test-value-both-one' },
        { key: 'test-key-both-same', value: 'test-value-both-same' },
        { key: 'test-key-two', value: 'test-value-two' },
        { key: 'nested/test-key-nested', value: 'test-value-nested' },
        { key: 'nested/more/test-key-more-nested', value: 'test-value-nested' },
      ].sort((a, b) => a.key.localeCompare(b.key))

      assert.deepEqual(
        removeMetadata(entries.sort((a, b) => a.key.localeCompare(b.key))),
        expectedResult
      )

      const entriesReversed = await configService.getAllCombinedEntries([
        'test-stage-two',
        'test-stage-one',
      ])

      const expectedResultReversed = [
        { key: 'test-key-two', value: 'test-value-two' },
        { key: 'test-key-both-different', value: 'test-value-both-two' },
        { key: 'test-key-both-same', value: 'test-value-both-same' },
        { key: 'test-key-one', value: 'test-value-one' },
        { key: 'nested/test-key-nested', value: 'test-value-nested' },
        { key: 'nested/more/test-key-more-nested', value: 'test-value-nested' },
      ].sort((a, b) => a.key.localeCompare(b.key))

      assert.deepEqual(
        removeMetadata(entriesReversed.sort((a, b) => a.key.localeCompare(b.key))),
        expectedResultReversed
      )
    })

    it('getEntries should get entries for multiple stages', async function () {
      const entries = await configService.getEntries(
        ['test-key-one', 'test-key-two', 'test-key-both-different'],
        ['test-stage-one', 'test-stage-two']
      )

      const expectedResult = [
        {
          stage: 'test-stage-one',
          entries: [
            {
              key: 'test-key-one',
              value: 'test-value-one',
            },
            {
              key: 'test-key-both-different',
              value: 'test-value-both-one',
            },
          ],
        },
        {
          stage: 'test-stage-two',
          entries: [
            {
              key: 'test-key-two',
              value: 'test-value-two',
            },
            {
              key: 'test-key-both-different',
              value: 'test-value-both-two',
            },
          ],
        },
      ]

      assert.deepEqual(removeMetadataFromConfigs(entries), expectedResult)
    })

    it('getCombinedEntries should combine entries for multiple stages', async function () {
      const entries = await configService.getCombinedEntries(
        ['test-key-one', 'test-key-two', 'test-key-both-different'],
        ['test-stage-one', 'test-stage-two']
      )

      const expectedResult = [
        {
          key: 'test-key-one',
          value: 'test-value-one',
        },
        {
          key: 'test-key-both-different',
          value: 'test-value-both-one',
        },
        {
          key: 'test-key-two',
          value: 'test-value-two',
        },
      ]

      assert.deepEqual(removeMetadata(entries), expectedResult)
      // The reverse order of stages is covered in a previous test.
    })
  })

  describe('Delete entries', () => {
    it('deleteEntries should delete entries', async function () {
      await configService.deleteEntries(['test-key-two'], ['test-stage-two']) // Only delete "test-key-two" from stage two
      await configService.deleteEntries(['test-key-both-same'], ['test-stage-one']) // Only delete "both-same" from stage one

      await configService.deleteEntries(
        ['test-key-both-different'],
        ['test-stage-one', 'test-stage-two']
      ) // Delete "both-different" from both stages

      const entries = await configService.getAllEntries(['test-stage-one', 'test-stage-two'])

      const expectedResult = [
        {
          stage: 'test-stage-one',
          entries: [
            {
              key: 'test-key-one',
              value: 'test-value-one',
            },
            { key: 'nested/test-key-nested', value: 'test-value-nested' },
            { key: 'nested/more/test-key-more-nested', value: 'test-value-nested' },
          ],
        },
        {
          stage: 'test-stage-two',
          entries: [
            {
              key: 'test-key-both-same',
              value: 'test-value-both-same',
            },
          ],
        },
      ]

      assert.deepEqual(removeMetadataFromConfigs(entries), expectedResult)
    })
  })
})
