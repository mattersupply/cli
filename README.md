# @mattersupply/cli

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/@mattersupply/cli.svg)](https://npmjs.org/package/@mattersupply/cli)
[![Downloads/week](https://img.shields.io/npm/dw/@mattersupply/cli.svg)](https://npmjs.org/package/@mattersupply/cli)
[![License](https://img.shields.io/npm/l/@mattersupply/cli.svg)](https://github.com/mattersupply/cli/blob/master/package.json)

## Matter Supply CLI

The Matter Supply CLI is a tool that is used for Matter Supply Projects to:

- Manage Environment Configurations via AWS SSM: `matter config`
- ... more.

At the core is a configuration structure for every project. Every project should have a `matter.yml` file.
If your config file is somewhere else, you can always set the path via `matter -c path/to/config.yml`.

<!-- toc -->
* [@mattersupply/cli](#mattersupplycli)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->
```sh-session
$ npm install -g @mattersupply/cli
$ matter COMMAND
running command...
$ matter (--version)
@mattersupply/cli/1.0.1-pre.73 linux-x64 node-v16.20.2
$ matter --help [COMMAND]
USAGE
  $ matter COMMAND
...
```
<!-- usagestop -->

# Commands

<!-- commands -->
* [`matter config:delete`](#matter-configdelete)
* [`matter config:export`](#matter-configexport)
* [`matter config:get`](#matter-configget)
* [`matter config:import`](#matter-configimport)
* [`matter config:list`](#matter-configlist)
* [`matter config:set`](#matter-configset)
* [`matter help [COMMANDS]`](#matter-help-commands)

## `matter config:delete`

Deletes configuration entries across multiple stages.

```
USAGE
  $ matter config:delete -e <value> -s <value> [-c <value>]

FLAGS
  -c, --config=<value>    [default: matter.yml] Path to config file.
  -e, --entry=<value>...  (required) Entry/Entries to delete.
  -s, --stage=<value>...  (required) Stage(s) (environment).

DESCRIPTION
  Deletes configuration entries across multiple stages.

EXAMPLES
  $ matter config:delete -s develop -s local -e foo -e baz
   ... Deleting values for stages develop and local
```

_See code: [src/commands/config/delete.ts](https://github.com/mattersupply/cli/blob/v1.0.1-pre.73/src/commands/config/delete.ts)_

## `matter config:export`

Exports configuration values for one or multiple stages.

```
USAGE
  $ matter config:export [-c <value>] [-e <value>] [--format yaml|dotenv] [-s <value>] [-o <value>] [-d]

FLAGS
  -c, --config=<value>    [default: matter.yml] Path to config file.
  -d, --description       Add description to output file
  -e, --entry=<value>...  Entry/Entries to fetch.
  -o, --output=<value>    Output file path
  -s, --stage=<value>...  Stage (environment) to print.
  --format=<option>       [default: dotenv] Output parameters as dotenv or yaml file.
                          <options: yaml|dotenv>

DESCRIPTION
  Exports configuration values for one or multiple stages.

EXAMPLES
  $ matter config:export -s develop
    ... Exports merged configuration values in dotenv format

  $ matter config:export -s develop -e foo bar
    ... Exports merged configuration values in dotenv format, filtering for foo and bar

  $ matter config:export -s common develop --format yaml
    ... Exports merged configuration values for stages common and develop in YAML format.

  $ matter config:export -s common develop --format yaml --output config.yml
    ... Exports merged configuration values for stages common and develop in YAML format to config.yml
```

_See code: [src/commands/config/export.ts](https://github.com/mattersupply/cli/blob/v1.0.1-pre.73/src/commands/config/export.ts)_

## `matter config:get`

Get configuration entries from multiple stages.

```
USAGE
  $ matter config:get -e <value> -s <value> [-c <value>]

FLAGS
  -c, --config=<value>    [default: matter.yml] Path to config file.
  -e, --entry=<value>...  (required) Entry/Entries to fetch.
  -s, --stage=<value>...  (required) Stage(s) (environment).

DESCRIPTION
  Get configuration entries from multiple stages.

EXAMPLES
  $ matter config:get -s develop -s local -e foo bar
    ... Getting values for stages develop and local
```

_See code: [src/commands/config/get.ts](https://github.com/mattersupply/cli/blob/v1.0.1-pre.73/src/commands/config/get.ts)_

## `matter config:import`

Imports configuration values for one or multiple stages.

```
USAGE
  $ matter config:import -i <value> [-c <value>] [--format yaml|dotenv] [-s <value>] [--preferSecure]

FLAGS
  -c, --config=<value>    [default: matter.yml] Path to config file.
  -i, --input=<value>     (required) Import file path
  -s, --stage=<value>...  Stage (environment) to import.
  --format=<option>       [default: dotenv] Import file as dotenv or yaml file.
                          <options: yaml|dotenv>
  --preferSecure          Prefer secure (encrypted) type for values where possible.

DESCRIPTION
  Imports configuration values for one or multiple stages.

EXAMPLES
  $ matter config:import -s develop -i env.yaml --format yaml
    ... Imports configuration values from env.yaml for stage develop in YAML format.

  $ matter config:import -s common develop -i .env
    ... Imports configuration values from .env for stages common and develop in dotenv format.
```

_See code: [src/commands/config/import.ts](https://github.com/mattersupply/cli/blob/v1.0.1-pre.73/src/commands/config/import.ts)_

## `matter config:list`

Print configuration values for one or multiple stages.

```
USAGE
  $ matter config:list [-c <value>] [-s <value>]

FLAGS
  -c, --config=<value>    [default: matter.yml] Path to config file.
  -s, --stage=<value>...  Stage (environment) to print.

DESCRIPTION
  Print configuration values for one or multiple stages.

EXAMPLES
  $ matter config:list -s develop
    ... Prints all SSM configuration values

  $ matter config:list -s common develop
    ... Prints configuration values for stages common and develop
```

_See code: [src/commands/config/list.ts](https://github.com/mattersupply/cli/blob/v1.0.1-pre.73/src/commands/config/list.ts)_

## `matter config:set`

Set configuration entries from multiple stages.

```
USAGE
  $ matter config:set -e <value> -s <value> [-c <value>] [--preferSecure]

FLAGS
  -c, --config=<value>    [default: matter.yml] Path to config file.
  -e, --entry=<value>...  (required) Entry/Entries to set as `key=value`.
  -s, --stage=<value>...  (required) Stage(s) (environment).
  --preferSecure          Prefer secure (encrypted) type for values where possible.

DESCRIPTION
  Set configuration entries from multiple stages.

EXAMPLES
  $ matter config:set -s develop -s local -e foo=bar -e baz=boz
    ... Setting values for stages develop and local
```

_See code: [src/commands/config/set.ts](https://github.com/mattersupply/cli/blob/v1.0.1-pre.73/src/commands/config/set.ts)_

## `matter help [COMMANDS]`

Display help for matter.

```
USAGE
  $ matter help [COMMANDS] [-n]

ARGUMENTS
  COMMANDS  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for matter.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.2.15/src/commands/help.ts)_
<!-- commandsstop -->
