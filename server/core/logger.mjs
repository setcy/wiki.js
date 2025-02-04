import chalk from 'chalk'
import EventEmitter from 'node:events'

const LEVELS = ['error', 'warn', 'info', 'debug']
const LEVELSIGNORED = ['verbose', 'silly']
const LEVELCOLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'cyan'
}

class Logger extends EventEmitter {}

export default {
  loggers: {},
  init () {
    const primaryLogger = new Logger()

    let ignoreNextLevels = false

    primaryLogger.ws = new EventEmitter()

    LEVELS.forEach(lvl => {
      primaryLogger[lvl] = (...args) => {
        primaryLogger.emit(lvl, ...args)
      }

      if (!ignoreNextLevels) {
        primaryLogger.on(lvl, (msg) => {
          let formatted = ''
          if (WIKI.config.logFormat === 'json') {
            formatted = JSON.stringify({
              timestamp: new Date().toISOString(),
              instance: WIKI.INSTANCE_ID,
              level: lvl,
              message: msg
            })
          } else {
            if (msg instanceof Error) {
              msg = msg.stack
            }
            formatted = `${new Date().toISOString()} ${chalk.dim('[' + WIKI.INSTANCE_ID + ']')} ${chalk[LEVELCOLORS[lvl]].bold(lvl)}: ${msg}`
          }

          console.log(formatted)
          primaryLogger.ws.emit('log', formatted)
        })
      }
      if (lvl === WIKI.config.logLevel) {
        ignoreNextLevels = true
      }
    })

    LEVELSIGNORED.forEach(lvl => {
      primaryLogger[lvl] = () => {}
    })

    return primaryLogger
  }
}
