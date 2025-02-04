import _ from 'lodash-es'
import { generateError, generateSuccess } from '../../helpers/graph.mjs'

export default {
  Query: {
    async renderers(obj, args, context, info) {
      let renderers = await WIKI.db.renderers.getRenderers()
      renderers = renderers.map(rdr => {
        const rendererInfo = _.find(WIKI.data.renderers, ['key', rdr.key]) || {}
        return {
          ...rendererInfo,
          ...rdr,
          config: _.sortBy(_.transform(rdr.config, (res, value, key) => {
            const configData = _.get(rendererInfo.props, key, false)
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
      // if (args.filter) { renderers = graphHelper.filter(renderers, args.filter) }
      if (args.orderBy) { renderers = _.sortBy(renderers, [args.orderBy]) }
      return renderers
    }
  },
  Mutation: {
    async updateRenderers(obj, args, context) {
      try {
        for (let rdr of args.renderers) {
          await WIKI.db.renderers.query().patch({
            isEnabled: rdr.isEnabled,
            config: _.reduce(rdr.config, (result, value, key) => {
              _.set(result, `${value.key}`, _.get(JSON.parse(value.value), 'v', null))
              return result
            }, {})
          }).where('key', rdr.key)
        }
        return {
          responseResult: generateSuccess('Renderers updated successfully')
        }
      } catch (err) {
        return generateError(err)
      }
    }
  }
}
