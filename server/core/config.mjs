import { defaultsDeep, get, isPlainObject } from 'lodash-es'
import chalk from 'chalk'
import cfgHelper from '../helpers/config.mjs'
import regexData from '../app/regex.mjs'
import fs from 'node:fs/promises'
import path from 'node:path'
import yaml from 'js-yaml'

export default {
  /**
   * Load root config from disk
   */
  async init(silent = false) {
    const confPaths = {
      config: path.join(WIKI.ROOTPATH, 'config.yml'),
      data: path.join(WIKI.SERVERPATH, 'app/data.yml')
    }

    if (process.env.dockerdev) {
      confPaths.config = path.join(WIKI.ROOTPATH, `dev/containers/config.yml`)
    }

    if (process.env.CONFIG_FILE) {
      confPaths.config = path.resolve(WIKI.ROOTPATH, process.env.CONFIG_FILE)
    }

    if (!silent) {
      process.stdout.write(chalk.blue(`Loading configuration from ${confPaths.config}... `))
    }

    let appconfig = {}
    let appdata = {}

    try {
      appconfig = yaml.load(
        cfgHelper.parseConfigValue(
          await fs.readFile(confPaths.config, 'utf8')
        )
      )
      appdata = yaml.load(await fs.readFile(confPaths.data, 'utf8'))
      appdata.regex = regexData
      if (!silent) {
        console.info(chalk.green.bold(`OK`))
      }
    } catch (err) {
      console.error(chalk.red.bold(`FAILED`))
      console.error(err.message)

      console.error(chalk.red.bold(`>>> Unable to read configuration file! Did you create the config.yml file?`))
      process.exit(1)
    }

    // Merge with defaults

    appconfig = defaultsDeep(appconfig, appdata.defaults.config)

    // Override port

    if (appconfig.port < 1 || process.env.HEROKU) {
      appconfig.port = process.env.PORT || 80
    }

    if (process.env.WIKI_PORT) {
      appconfig.port = process.env.WIKI_PORT || 80
    }

    // Load package info

    const packageInfo = JSON.parse(await fs.readFile(path.join(WIKI.SERVERPATH, 'package.json'), 'utf-8'))

    // Load DB Password from Docker Secret File
    if (process.env.DB_PASS_FILE) {
      if (!silent) {
        console.info(chalk.blue(`DB_PASS_FILE is defined. Will use secret from file.`))
      }
      try {
        appconfig.db.pass = await fs.readFile(process.env.DB_PASS_FILE, 'utf8').trim()
      } catch (err) {
        console.error(chalk.red.bold(`>>> Failed to read Docker Secret File using path defined in DB_PASS_FILE env variable!`))
        console.error(err.message)
        process.exit(1)
      }
    }

    WIKI.config = appconfig
    WIKI.data = appdata
    WIKI.version = packageInfo.version
    WIKI.releaseDate = packageInfo.releaseDate
    WIKI.devMode = (packageInfo.dev === true)
  },

  /**
   * Load config from DB
   */
  async loadFromDb() {
    const conf = await WIKI.db.settings.getConfig()
    if (conf) {
      WIKI.config = defaultsDeep(conf, WIKI.config)
    } else {
      WIKI.logger.warn('Missing DB Configuration!')
      process.exit(1)
    }
  },
  /**
   * Save config to DB
   *
   * @param {Array} keys Array of keys to save
   * @returns Promise
   */
  async saveToDb(keys, propagate = true) {
    try {
      for (const key of keys) {
        let value = get(WIKI.config, key, null)
        if (!isPlainObject(value)) {
          value = { v: value }
        }
        let affectedRows = await WIKI.db.settings.query().patch({ value }).where('key', key)
        if (affectedRows === 0 && value) {
          await WIKI.db.settings.query().insert({ key, value })
        }
      }
      if (propagate) {
        WIKI.events.outbound.emit('reloadConfig')
      }
    } catch (err) {
      WIKI.logger.error(`Failed to save configuration to DB: ${err.message}`)
      return false
    }

    return true
  },
  /**
   * Apply Dev Flags
   */
  async applyFlags() {
    WIKI.db.knex.client.config.debug = WIKI.config.flags.sqlLog
  },

  /**
   * Subscribe to HA propagation events
   */
  subscribeToEvents() {
    WIKI.events.inbound.on('reloadConfig', async () => {
      await WIKI.configSvc.loadFromDb()
      await WIKI.configSvc.applyFlags()
    })
  }
}
