import { reject } from 'lodash-es'
import * as cheerio from 'cheerio'
import uslug from 'uslug'
import pageHelper from '../../../helpers/page'
import { URL } from 'node:url'

const mustacheRegExp = /(\{|&#x7b;?){2}(.+?)(\}|&#x7d;?){2}/i

export async function render () {
  const $ = cheerio.load(this.input, {
    decodeEntities: true
  })

  if ($.root().children().length < 1) {
    return ''
  }

  // --------------------------------
  // STEP: PRE
  // --------------------------------

  for (const child of reject(this.children, ['step', 'post'])) {
    const renderer = (await import(`../${kebabCase(child.key)}/renderer.mjs`)).render
    await renderer($, child.config)
  }

  // --------------------------------
  // Detect internal / external links
  // --------------------------------

  let internalRefs = []
  const reservedPrefixes = /^\/[a-z]\//i
  const exactReservedPaths = /^\/[a-z]$/i

  const hasHostname = this.site.hostname !== '*'

  $('a').each((i, elm) => {
    let href = $(elm).attr('href')

    // -> Ignore empty / anchor links, e-mail addresses, and telephone numbers
    if (!href || href.length < 1 || href.indexOf('#') === 0 ||
      href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) {
      return
    }

    // -> Strip host from local links
    if (hasHostname && href.indexOf(`${this.site.hostname}/`) === 0) {
      href = href.replace(this.site.hostname, '')
    }

    // -> Assign local / external tag
    if (href.indexOf('://') < 0) {
      // -> Remove trailing slash
      if (_.endsWith('/')) {
        href = href.slice(0, -1)
      }

      // -> Check for system prefix
      if (reservedPrefixes.test(href) || exactReservedPaths.test(href)) {
        $(elm).addClass(`is-system-link`)
      } else if (href.indexOf('.') >= 0) {
        $(elm).addClass(`is-asset-link`)
      } else {
        let pagePath = null

        // -> Add locale prefix if using namespacing
        if (this.site.config.localeNamespacing) {
          // -> Reformat paths
          if (href.indexOf('/') !== 0) {
            if (this.config.absoluteLinks) {
              href = `/${this.page.locale}/${href}`
            } else {
              href = (this.page.path === 'home') ? `/${this.page.locale}/${href}` : `/${this.page.locale}/${this.page.path}/${href}`
            }
          } else if (href.charAt(3) !== '/') {
            href = `/${this.page.locale}${href}`
          }

          try {
            const parsedUrl = new URL(`http://x${href}`)
            pagePath = pageHelper.parsePath(parsedUrl.pathname)
          } catch (err) {
            return
          }
        } else {
          // -> Reformat paths
          if (href.indexOf('/') !== 0) {
            if (this.config.absoluteLinks) {
              href = `/${href}`
            } else {
              href = (this.page.path === 'home') ? `/${href}` : `/${this.page.path}/${href}`
            }
          }

          try {
            const parsedUrl = new URL(`http://x${href}`)
            pagePath = pageHelper.parsePath(parsedUrl.pathname)
          } catch (err) {
            return
          }
        }
        // -> Save internal references
        internalRefs.push({
          locale: pagePath.locale,
          path: pagePath.path
        })

        $(elm).addClass(`is-internal-link`)
      }
    } else {
      $(elm).addClass(`is-external-link`)
      if (this.config.openExternalLinkNewTab) {
        $(elm).attr('target', '_blank')
        $(elm).attr('rel', this.config.relAttributeExternalLink)
      }
    }

    // -> Update element
    $(elm).attr('href', href)
  })

  // --------------------------------
  // Detect internal link states
  // --------------------------------

  const pastLinks = await this.page.$relatedQuery('links')

  if (internalRefs.length > 0) {
    // -> Find matching pages
    const results = await WIKI.db.pages.query().column('id', 'path', 'locale').where(builder => {
      internalRefs.forEach((ref, idx) => {
        if (idx < 1) {
          builder.where(ref)
        } else {
          builder.orWhere(ref)
        }
      })
    })

    // -> Apply tag to internal links for found pages
    $('a.is-internal-link').each((i, elm) => {
      const href = $(elm).attr('href')
      let hrefObj = {}
      try {
        const parsedUrl = new URL(`http://x${href}`)
        hrefObj = pageHelper.parsePath(parsedUrl.pathname)
      } catch (err) {
        return
      }
      if (_.some(results, r => {
        return r.locale === hrefObj.locale && r.path === hrefObj.path
      })) {
        $(elm).addClass(`is-valid-page`)
      } else {
        $(elm).addClass(`is-invalid-page`)
      }
    })

    // -> Add missing links
    const missingLinks = _.differenceWith(internalRefs, pastLinks, (nLink, pLink) => {
      return nLink.locale === pLink.locale && nLink.path === pLink.path
    })
    if (missingLinks.length > 0) {
      if (WIKI.config.db.type === 'postgres') {
        await WIKI.db.pageLinks.query().insert(missingLinks.map(lnk => ({
          pageId: this.page.id,
          path: lnk.path,
          locale: lnk.locale
        })))
      } else {
        for (const lnk of missingLinks) {
          await WIKI.db.pageLinks.query().insert({
            pageId: this.page.id,
            path: lnk.path,
            locale: lnk.locale
          })
        }
      }
    }
  }

  // -> Remove outdated links
  if (pastLinks) {
    const outdatedLinks = _.differenceWith(pastLinks, internalRefs, (nLink, pLink) => {
      return nLink.locale === pLink.locale && nLink.path === pLink.path
    })
    if (outdatedLinks.length > 0) {
      await WIKI.db.pageLinks.query().delete().whereIn('id', _.map(outdatedLinks, 'id'))
    }
  }

  // --------------------------------
  // Add header handles
  // --------------------------------

  let headers = []
  $('h1,h2,h3,h4,h5,h6').each((i, elm) => {
    let headerSlug = uslug($(elm).text())
    // -> If custom ID is defined, try to use that instead
    if ($(elm).attr('id')) {
      headerSlug = $(elm).attr('id')
    }

    // -> Cannot start with a number (CSS selector limitation)
    if (headerSlug.match(/^\d/)) {
      headerSlug = `h-${headerSlug}`
    }

    // -> Make sure header is unique
    if (headers.indexOf(headerSlug) >= 0) {
      let isUnique = false
      let hIdx = 1
      while (!isUnique) {
        const headerSlugTry = `${headerSlug}-${hIdx}`
        if (headers.indexOf(headerSlugTry) < 0) {
          isUnique = true
          headerSlug = headerSlugTry
        }
        hIdx++
      }
    }

    // -> Add anchor
    $(elm).attr('id', headerSlug).addClass('toc-header')
    $(elm).prepend(`<a class="toc-anchor" href="#${headerSlug}">&#xB6;</a> `)

    headers.push(headerSlug)
  })

  // --------------------------------
  // Wrap non-empty root text nodes
  // --------------------------------

  $('body').contents().toArray().forEach(item => {
    if (item && item.type === 'text' && item.parent.name === 'body' && item.data !== `\n` && item.data !== `\r`) {
      $(item).wrap('<div></div>')
    }
  })

  // --------------------------------
  // Escape mustache expresions
  // --------------------------------

  function iterateMustacheNode (node) {
    const list = $(node).contents().toArray()
    list.forEach(item => {
      if (item && item.type === 'text') {
        const rawText = $(item).text().replace(/\r?\n|\r/g, '')
        if (mustacheRegExp.test(rawText)) {
          $(item).parent().attr('v-pre', true)
        }
      } else {
        iterateMustacheNode(item)
      }
    })
  }
  iterateMustacheNode($.root())

  $('pre').each((idx, elm) => {
    $(elm).attr('v-pre', true)
  })

  // --------------------------------
  // STEP: POST
  // --------------------------------

  let output = decodeEscape($.html('body').replace('<body>', '').replace('</body>', ''))

  for (let child of _.sortBy(_.filter(this.children, ['step', 'post']), ['order'])) {
    const renderer = require(`../${_.kebabCase(child.key)}/renderer.js`)
    output = await renderer.init(output, child.config)
  }

  return output
}

function decodeEscape (string) {
  return string.replace(/&#x([0-9a-f]{1,6});/ig, (entity, code) => {
    code = parseInt(code, 16)

    // Don't unescape ASCII characters, assuming they're encoded for a good reason
    if (code < 0x80) return entity

    return String.fromCodePoint(code)
  })
}
