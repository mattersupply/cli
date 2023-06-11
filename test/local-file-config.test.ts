import { assert } from 'chai'
import * as fs from 'fs'
import * as sinon from 'sinon'
import * as yaml from 'js-yaml'
import { LocalFileConfigurationService } from '../src/lib/config/local-file'
import { Config, getMatterConfig } from '../src/lib/matter-config'
import { merge } from 'lodash'

const testConfig = {
  app: {
    name: 'my-test',
  },

  remoteConfig: {
    source: 'local',
    local: {
      path: 'test/.out/',
      password: 'god',
    },
  },

  stages: ['test-stage-one', 'test-stage-two'],
}

describe('Local File Config Provider', () => {
  let config: Config

  let configService: LocalFileConfigurationService

  let encryptedContentStageOne = Buffer.from('')
  let encryptedContentStageTwo = Buffer.from('')

  const testDataStageOne = [
    { key: 'test-key-one', value: 'test-value-one' },
    { key: 'test-key-both-different', value: 'test-value-both-one' },
  ]

  const testDataStageTwo = [
    { key: 'test-key-two', value: 'test-value-two' },
    { key: 'test-key-both-different', value: 'test-value-both-two' },
  ]

  const testDataBothStages = [{ key: 'test-key-both-same', value: 'test-value-both-same' }]

  beforeEach(async function () {
    // We could just stub the config, but this is a good test to make sure it works end-to-end.
    sinon.stub(fs, 'existsSync').returns(true)
    sinon.stub(fs, 'readFileSync').returns(yaml.dump(testConfig))
    config = await getMatterConfig('fakepath.yml')
    sinon.restore()

    configService = new LocalFileConfigurationService(config!)

    const stubWrite = sinon.stub(fs, 'writeFileSync')
    const stubRead = sinon.stub(fs, 'readFileSync')

    stubWrite.callsFake((path: any, content: any) => {
      if (path.includes('test-stage-one')) {
        encryptedContentStageOne = content
      } else if (path.includes('test-stage-two')) {
        encryptedContentStageTwo = content
      }
    })

    await configService.setEntries(testDataStageOne, ['test-stage-one'])
    await configService.setEntries(testDataStageTwo, ['test-stage-two'])

    // Making sure that the files "exist" as to not override the previous config entries
    sinon.stub(fs, 'existsSync').returns(true)
    stubRead.callsFake((path: any) => {
      if (path.includes('test-stage-one')) {
        return encryptedContentStageOne
      } else if (path.includes('test-stage-two')) {
        return encryptedContentStageTwo
      }

      return Buffer.from('')
    })

    await configService.setEntries(testDataBothStages, ['test-stage-one', 'test-stage-two'])
  })

  afterEach(function () {
    sinon.restore()
  })

  describe('Setting entries', () => {
    it('setEntries should set new entries and override existing entries', async function () {
      const newData = [
        { key: 'test-key-one', value: 'new-value' },
        { key: 'test-key-both-different', value: 'new-value-now-the-same' },
      ]

      const expectedResult = [
        { key: 'test-key-both-same', value: 'test-value-both-same' },
        { key: 'test-key-one', value: 'new-value' },
        { key: 'test-key-both-different', value: 'new-value-now-the-same' },
      ]

      await configService.setEntries(newData, ['test-stage-one'])

      const entries = await configService.getAllEntries(['test-stage-one'])
      assert.deepEqual(entries.find((e) => e.stage === 'test-stage-one')?.entries, expectedResult)
    })
  })

  describe('Retrieve entries', () => {
    it('getAllEntries should get all entries for multiple stages', async function () {
      const entries = await configService.getAllEntries(['test-stage-one', 'test-stage-two'])

      const expectedResult = [
        { stage: 'test-stage-one', entries: testDataStageOne.concat(testDataBothStages) },
        { stage: 'test-stage-two', entries: testDataStageTwo.concat(testDataBothStages) },
      ]

      assert.deepEqual(entries, expectedResult)
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
      ]

      assert.deepEqual(entries, expectedResult)

      const entriesReversed = await configService.getAllCombinedEntries([
        'test-stage-two',
        'test-stage-one',
      ])

      const expectedResultReversed = [
        { key: 'test-key-two', value: 'test-value-two' },
        { key: 'test-key-both-different', value: 'test-value-both-two' },
        { key: 'test-key-both-same', value: 'test-value-both-same' },
        { key: 'test-key-one', value: 'test-value-one' },
      ]

      assert.deepEqual(entriesReversed, expectedResultReversed)
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

      assert.deepEqual(entries, expectedResult)
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

      assert.deepEqual(entries, expectedResult)
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

      assert.deepEqual(entries, expectedResult)
    })
  })
})
