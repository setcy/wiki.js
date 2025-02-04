import _ from 'lodash-es'
import { generateError, generateSuccess } from '../../helpers/graph.mjs'

export default {
  Query: {
    /**
     * Fetch list of Comments Providers
     */
    async commentsProviders(obj, args, context, info) {
      const providers = await WIKI.db.commentProviders.getProviders()
      return providers.map(provider => {
        const providerInfo = _.find(WIKI.data.commentProviders, ['key', provider.key]) || {}
        return {
          ...providerInfo,
          ...provider,
          config: _.sortBy(_.transform(provider.config, (res, value, key) => {
            const configData = _.get(providerInfo.props, key, false)
            if (configData) {
              res.push({
                key,
                value: JSON.stringify({
                  ...configData,
                  value
                })
              })
            }
          }, []), 'key')
        }
      })
    },
    /**
     * Fetch list of comments for a page
     */
    async comments (obj, args, context) {
      const page = await WIKI.db.pages.query().select('id').findOne({ locale: args.locale, path: args.path })
      if (page) {
        if (WIKI.auth.checkAccess(context.req.user, ['read:comments'], args)) {
          const comments = await WIKI.db.comments.query().where('pageId', page.id).orderBy('createdAt')
          return comments.map(c => ({
            ...c,
            authorName: c.name,
            authorEmail: c.email,
            authorIP: c.ip
          }))
        } else {
          throw new WIKI.Error.CommentViewForbidden()
        }
      } else {
        return []
      }
    },
    /**
     * Fetch a single comment
     */
    async commentById (obj, args, context) {
      const cm = await WIKI.data.commentProvider.getCommentById(args.id)
      if (!cm || !cm.pageId) {
        throw new WIKI.Error.CommentNotFound()
      }
      const page = await WIKI.db.pages.query().select('locale', 'path').findById(cm.pageId)
      if (page) {
        if (WIKI.auth.checkAccess(context.req.user, ['read:comments'], {
          path: page.path,
          locale: page.locale
        })) {
          return {
            ...cm,
            authorName: cm.name,
            authorEmail: cm.email,
            authorIP: cm.ip
          }
        } else {
          throw new WIKI.Error.CommentViewForbidden()
        }
      } else {
        WIKI.logger.warn(`Comment #${cm.id} is linked to a page #${cm.pageId} that doesn't exist! [ERROR]`)
        throw new WIKI.Error.CommentGenericError()
      }
    }
  },
  Mutation: {
    /**
     * Create New Comment
     */
    async createComment (obj, args, context) {
      try {
        const cmId = await WIKI.db.comments.postNewComment({
          ...args,
          user: context.req.user,
          ip: context.req.ip
        })
        return {
          responseResult: generateSuccess('New comment posted successfully'),
          id: cmId
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * Update an Existing Comment
     */
    async updateComment (obj, args, context) {
      try {
        const cmRender = await WIKI.db.comments.updateComment({
          ...args,
          user: context.req.user,
          ip: context.req.ip
        })
        return {
          responseResult: generateSuccess('Comment updated successfully'),
          render: cmRender
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * Delete an Existing Comment
     */
    async deleteComment (obj, args, context) {
      try {
        await WIKI.db.comments.deleteComment({
          id: args.id,
          user: context.req.user,
          ip: context.req.ip
        })
        return {
          responseResult: generateSuccess('Comment deleted successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    },
    /**
     * Update Comments Providers
     */
    async updateCommentsProviders(obj, args, context) {
      try {
        for (let provider of args.providers) {
          await WIKI.db.commentProviders.query().patch({
            isEnabled: provider.isEnabled,
            config: _.reduce(provider.config, (result, value, key) => {
              _.set(result, `${value.key}`, _.get(JSON.parse(value.value), 'v', null))
              return result
            }, {})
          }).where('key', provider.key)
        }
        await WIKI.db.commentProviders.initProvider()
        return {
          responseResult: generateSuccess('Comment Providers updated successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    }
  }
}
