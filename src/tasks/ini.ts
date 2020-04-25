import * as fs from 'fs'

async function readFile(path: string): Promise<string> {
  return new Promise(function(resolve, reject) {
    fs.readFile(path, 'utf8', function (err: any, data: string) {
      if (err) {
        reject(err)
      }
      resolve(data)
    })
  })
}


const REGEX = {
  section: /^\s*\[\s*([^\]]*)\s*\]\s*$/,
  param: /^\s*([^=]+?)\s*=\s*(.*?)\s*$/,
  comment: /^\s*;.*$/
}

export type Pair = {
  key: string
  value: string
}

export class Ini {
  readonly path: string

  constructor(path: string) {
    this.path = path
  }

  async allValues(): Promise<Pair[]> {
    let result: Pair[] = []
    const content = await readFile(this.path)

    const lines = content.split(/[\r\n]+/);
    lines.forEach(function (line) {
      const isParam = REGEX.param.test(line)
      if (isParam) {
        const match = line.match(REGEX.param)
        if (match) {
          result.push({
            key: match[1] || '',
            value: match[2],
          })
        }
      }
    })
    return result
  }
}
