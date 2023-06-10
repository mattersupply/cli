import { assert } from 'chai'
import * as fs from 'fs'
import * as sinon from 'sinon'
import * as yaml from 'js-yaml'
import { AWSSSMRemoteConfigurationService } from '../src/lib/config/aws-ssm'
import { Config, getMatterConfig } from '../src/lib/matter-config'
import { get, has, merge, pickBy, set, unset } from 'lodash'
import { RemoteConfigurationEntry } from '../src/lib/config/config'
import {
  DeleteActivationCommand,
  DeleteParametersCommand,
  GetParametersByPathCommand,
  GetParametersCommand,
  PutParameterCommand,
  SSMClient,
} from '@aws-sdk/client-ssm'
import { removeMetadata, removeMetadataFromConfigs } from './utils/config'

const testConfig = {
  app: {
    name: 'my-test',
  },

  aws: {
    region: 'us-west-2',
  },

  remoteConfig: {
    source: 'awsSsm',
    awsSsm: {
      nullValue: 'NULL',
    },
  },

  stages: ['test-stage-one', 'test-stage-two'],
}

describe('AWS SSM Remote Config Provider', () => {
  let config: Config
  let configService: AWSSSMRemoteConfigurationService

  const testDataStageOne = {
    '/test-key-one': {
      key: '/test-key-one',
      value: 'test-value-one',
    },
    '/test-key-both-different': {
      key: '/test-key-both-different',
      value: 'test-value-both-one',
    },
    '/nested/test-key-nested': {
      key: '/nested/test-key-nested',
      value: 'test-value-nested',
    },
    '/nested/more/test-key-more-nested': {
      key: '/nested/more/test-key-more-nested',
      value: 'test-value-nested',
    },
  }

  const testDataStageTwo = {
    '/test-key-two': {
      key: '/test-key-two',
      value: 'test-value-two',
    },
    '/test-key-both-different': {
      key: '/test-key-both-different',
      value: 'test-value-both-two',
    },
  }

  const testDataBothStages = {
    '/test-key-both-same': {
      key: '/test-key-both-same',
      value: 'test-value-both-same',
    },
  }

  let database: { [stage: string]: { [key: string]: any } } = {}

  function parameterFromEntry(
    { key, value }: RemoteConfigurationEntry,
    app: string,
    stage: string
  ) {
    key = `/${app}/${stage}${key}`

    return {
      ARN: `arn:aws:ssm:invalid:1111:parameter${key}`,
      DataType: 'text',
      LastModifiedDate: new Date(),
      Name: key,
      Type: 'String',
      Value: value,
      Version: 1,
    }
  }

  function deleteParametersCommandMock(names: string[]) {
    names.forEach((name) => {
      const [app, stage] = name.split('/').filter((p) => p !== '')
      const key = name.replace(`/${app}/${stage}`, '')

      const keyPath = `${app}.${stage}.${key}`

      unset(database, keyPath)
    })

    return {
      DeletedParameters: names,
      FailedParameters: [],
    }
  }

  function putParameterCommandMock(name: string, value: string) {
    const [app, stage] = name.split('/').filter((p) => p !== '')
    const key = name.replace(`/${app}/${stage}`, '')

    const keyPath = `${app}.${stage}.${key}`

    set(database, keyPath, { key: key, value })
  }

  function getParametersByPathCommandMock(path: string, recursive: boolean = false) {
    const [app, stage] = path.split('/').filter((p) => p !== '')
    const key = path.replace(`/${app}/${stage}`, '')
    const stageSecrets = get(database, `${app}.${stage}`)

    if (!stageSecrets) {
      return null
    }

    const data = pickBy(stageSecrets, (v, k) => {
      const kSplit = k.split('/')
      kSplit.pop()
      const pathToKey = `/${kSplit.join('/')}`

      return pathToKey.startsWith(key)
    })

    return {
      Parameters: Object.values(data).map((v) => parameterFromEntry(v, app, stage)),
    }
  }

  function getParametersCommandMock(names: string[]) {
    const data = names.reduce<{ [key: string]: any }>((acc, name) => {
      const [app, stage] = name.split('/').filter((p) => p !== '')
      const key = name.replace(`/${app}/${stage}`, '')
      const value = get(database, `${app}.${stage}.${key}`)

      if (has(value, 'value')) {
        return { ...acc, [name]: parameterFromEntry(value as any, app, stage) }
      }

      return acc
    }, {})

    return {
      Parameters: Object.values(data),
    }
  }

  beforeEach(async function () {
    // We could just stub the config, but this is a good test to make sure it works end-to-end.
    sinon.stub(fs, 'existsSync').returns(true)
    sinon.stub(fs, 'readFileSync').returns(yaml.dump(testConfig))
    config = await getMatterConfig('fakepath.yml')
    sinon.restore()

    const ssmStub = sinon.createStubInstance(SSMClient)

    database = {
      'my-test': {
        'test-stage-one': merge({}, testDataStageOne, testDataBothStages),
        'test-stage-two': merge({}, testDataStageTwo, testDataBothStages),
      },
    }

    configService = new AWSSSMRemoteConfigurationService(config!, ssmStub as any)

    ssmStub.send.callsFake(async (command: any) => {
      if (command instanceof GetParametersByPathCommand) {
        return getParametersByPathCommandMock(command.input.Path!, command.input.Recursive || false)
      } else if (command instanceof GetParametersCommand) {
        return getParametersCommandMock(command.input.Names!)
      } else if (command instanceof PutParameterCommand) {
        return putParameterCommandMock(command.input.Name!, command.input.Value!)
      } else if (command instanceof DeleteParametersCommand) {
        return deleteParametersCommandMock(command.input.Names!)
      } else {
        console.log('Unhandled Command: ', command)
      }
    })
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
            {
              key: 'nested/test-key-nested',
              value: 'test-value-nested',
            },
            {
              key: 'nested/more/test-key-more-nested',
              value: 'test-value-nested',
            },
            {
              key: 'test-key-both-same',
              value: 'test-value-both-same',
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
            {
              key: 'test-key-both-same',
              value: 'test-value-both-same',
            },
          ],
        },
      ]
      assert.deepEqual(removeMetadataFromConfigs(entries), expectedResult)
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
