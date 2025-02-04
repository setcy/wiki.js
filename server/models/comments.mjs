import { Model } from 'objection'
import validate from 'validate.js'

import { Page } from './pages.mjs'
import { User } from './users.mjs'

/**
 * Comments model
 */
export class Comment extends Model {
  static get tableName() { return 'comments' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: [],

      properties: {
        id: {type: 'integer'},
        content: {type: 'string'},
        render: {type: 'string'},
        name: {type: 'string'},
        email: {type: 'string'},
        ip: {type: 'string'},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      author: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'comments.authorId',
          to: 'users.id'
        }
      },
      page: {
        relation: Model.BelongsToOneRelation,
        modelClass: Page,
        join: {
          from: 'comments.pageId',
          to: 'pages.id'
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

  /**
   * Post New Comment
   */
  static async postNewComment ({ pageId, replyTo, content, guestName, guestEmail, user, ip }) {
    // -> Input validation
    if (user.id === 2) {
      const validation = validate({
        email: guestEmail.toLowerCase(),
        name: guestName
      }, {
        email: {
          email: true,
          length: {
            maximum: 255
          }
        },
        name: {
          presence: {
            allowEmpty: false
          },
          length: {
            minimum: 2,
            maximum: 255
          }
        }
      }, { format: 'flat' })

      if (validation && validation.length > 0) {
        throw new WIKI.Error.InputInvalid(validation[0])
      }
    }

    content = content.trim()
    if (content.length < 2) {
      throw new WIKI.Error.CommentContentMissing()
    }

    // -> Load Page
    const page = await WIKI.db.pages.getPageFromDb(pageId)
    if (page) {
      if (!WIKI.auth.checkAccess(user, ['write:comments'], {
        path: page.path,
        locale: page.locale
      })) {
        throw new WIKI.Error.CommentPostForbidden()
      }
    } else {
      throw new WIKI.Error.PageNotFound()
    }

    // -> Process by comment provider
    return WIKI.data.commentProvider.create({
      page,
      replyTo,
      content,
      user: {
        ...user,
        ...(user.id === 2) ? {
          name: guestName,
          email: guestEmail
        } : {},
        ip
      }
    })
  }

  /**
   * Update an Existing Comment
   */
  static async updateComment ({ id, content, user, ip }) {
    // -> Load Page
    const pageId = await WIKI.data.commentProvider.getPageIdFromCommentId(id)
    if (!pageId) {
      throw new WIKI.Error.CommentNotFound()
    }
    const page = await WIKI.db.pages.getPageFromDb(pageId)
    if (page) {
      if (!WIKI.auth.checkAccess(user, ['manage:comments'], {
        path: page.path,
        locale: page.locale
      })) {
        throw new WIKI.Error.CommentManageForbidden()
      }
    } else {
      throw new WIKI.Error.PageNotFound()
    }

    // -> Process by comment provider
    return WIKI.data.commentProvider.update({
      id,
      content,
      page,
      user: {
        ...user,
        ip
      }
    })
  }

  /**
   * Delete an Existing Comment
   */
  static async deleteComment ({ id, user, ip }) {
    // -> Load Page
    const pageId = await WIKI.data.commentProvider.getPageIdFromCommentId(id)
    if (!pageId) {
      throw new WIKI.Error.CommentNotFound()
    }
    const page = await WIKI.db.pages.getPageFromDb(pageId)
    if (page) {
      if (!WIKI.auth.checkAccess(user, ['manage:comments'], {
        path: page.path,
        locale: page.locale
      })) {
        throw new WIKI.Error.CommentManageForbidden()
      }
    } else {
      throw new WIKI.Error.PageNotFound()
    }

    // -> Process by comment provider
    await WIKI.data.commentProvider.remove({
      id,
      page,
      user: {
        ...user,
        ip
      }
    })
  }
}
