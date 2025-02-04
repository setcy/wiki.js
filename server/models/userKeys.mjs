/* global WIKI */

import { Model } from 'objection'
import { DateTime } from 'luxon'
import { nanoid } from 'nanoid'

import { User } from './users.mjs'

/**
 * Users model
 */
export class UserKey extends Model {
  static get tableName() { return 'userKeys' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['kind', 'token', 'validUntil'],

      properties: {
        id: {type: 'string'},
        kind: {type: 'string'},
        token: {type: 'string'},
        createdAt: {type: 'string'},
        validUntil: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      user: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'userKeys.userId',
          to: 'users.id'
        }
      }
    }
  }

  async $beforeInsert(context) {
    await super.$beforeInsert(context)

    this.createdAt = DateTime.utc().toISO()
  }

  static async generateToken ({ userId, kind, meta }, context) {
    WIKI.logger.debug(`Generating ${kind} token for user ${userId}...`)
    const token = await nanoid()
    await WIKI.db.userKeys.query().insert({
      kind,
      token,
      meta,
      validUntil: DateTime.utc().plus({ days: 1 }).toISO(),
      userId
    })
    return token
  }

  static async validateToken ({ kind, token, skipDelete }, context) {
    const res = await WIKI.db.userKeys.query().findOne({ kind, token }).withGraphJoined('user')
    if (res) {
      if (skipDelete !== true) {
        await WIKI.db.userKeys.query().deleteById(res.id)
      }
      if (DateTime.utc() > DateTime.fromISO(res.validUntil)) {
        throw new Error('ERR_EXPIRED_VALIDATION_TOKEN')
      }
      return {
        ...res.meta,
        user: res.user
      }
    } else {
      throw new Error('ERR_INVALID_VALIDATION_TOKEN')
    }
  }

  static async destroyToken ({ token }) {
    return WIKI.db.userKeys.query().findOne({ token }).delete()
  }
}
