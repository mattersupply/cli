import { safeDump } from 'js-yaml'
import { snakeCase, toLower, toUpper } from 'lodash'
import { RemoteConfigEntry } from './provider'
import { unflatten } from 'flat'

const DOTENV_SEPARATOR = '__'

export namespace RemoteConfigEntryFormatter {
  export function dotenv(values: RemoteConfigEntry[]) {
    let output = ''
    values.map((value) => {
      const keySegments = value.key.split(/[\/\.]/).map((v) => toUpper(snakeCase(v)))

      output += `# ${value.description || ''}\n`
      output += `${keySegments.join(DOTENV_SEPARATOR)}=${value.value}\n`
    })

    return output
  }

  export function yaml(values: RemoteConfigEntry[]) {
    const keyedValues = Object.assign(
      {},
      ...values.map((value) => ({ [value.key.split('/').join('.')]: value.value }))
    )
    return safeDump(unflatten(keyedValues))
  }
}

export namespace DotenvFormatter {
  export function entries(dotenv: { [key: string]: string }) {
    return Object.entries(dotenv).map(([key, value]) => ({
      key: key
        .split(DOTENV_SEPARATOR)
        .map((v) => toLower(snakeCase(v)))
        .join('/'),
      value,
    }))
  }
}
