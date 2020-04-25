import { Ini, Pair } from './ini'

export class LoadFileTask {
  async exec(path: string, type: string): Promise<Pair[]> {
    switch(type) {
      case 'dotfile':
        return new Ini(path).allValues()
      default:
        throw  new Error('Type not implemented')
    }
  }
}
