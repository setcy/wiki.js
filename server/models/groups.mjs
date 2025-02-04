import { Model } from 'objection'

import { User } from './users.mjs'

/**
 * Groups model
 */
export class Group extends Model {
  static get tableName() { return 'groups' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['name'],

      properties: {
        id: {type: 'integer'},
        name: {type: 'string'},
        isSystem: {type: 'boolean'},
        redirectOnLogin: {type: 'string'},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  static get jsonAttributes() {
    return ['permissions', 'pageRules']
  }

  static get relationMappings() {
    return {
      users: {
        relation: Model.ManyToManyRelation,
        modelClass: User,
        join: {
          from: 'groups.id',
          through: {
            from: 'userGroups.groupId',
            to: 'userGroups.userId'
          },
          to: 'users.id'
        }
      }
    }
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }
  $beforeInsert() {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }
}
