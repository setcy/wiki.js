<template lang="pug">
q-layout(view='hHh Lpr lff')
  header-nav
  q-page-container.layout-search
    .layout-search-card
      q-btn.layout-search-back(
        icon='las la-arrow-circle-left'
        color='white'
        flat
        round
        @click='goBack'
        )
        q-tooltip(anchor='center left', self='center right') {{ t('common.actions.goback') }}
      .layout-search-sd
        .text-header {{ t('search.sortBy') }}
        q-list(dense, padding)
          q-item(
            v-for='item of orderByOptions'
            clickable
            :active='item.value === state.params.orderBy'
            @click='setOrderBy(item.value)'
            )
            q-item-section(side)
              q-icon(:name='item.icon', :color='item.value === state.params.orderBy ? `primary` : ``')
            q-item-section
              q-item-label {{ item.label }}
            q-item-section(
              v-if='item.value === state.params.orderBy'
              side
              )
              q-icon(
                :name='state.params.orderByDirection === `desc` ? `mdi-transfer-down` : `mdi-transfer-up`'
                size='sm'
                color='primary'
                )
        .text-header {{ t('search.filters') }}
        .q-pa-sm
          q-input(
            outlined
            dense
            :placeholder='t(`search.filterPath`)'
            prefix='/'
            v-model='state.params.filterPath'
            )
            template(v-slot:prepend)
              q-icon(name='las la-caret-square-right', size='xs')
          q-select.q-mt-sm(
            outlined
            v-model='state.selectedTags'
            :options='state.filteredTags'
            dense
            options-dense
            use-input
            use-chips
            multiple
            hide-dropdown-icon
            :input-debounce='0'
            @update:model-value='v => syncTags(v)'
            @filter='filterTags'
            :placeholder='state.selectedTags.length < 1 ? t(`search.filterTags`) : ``'
            :loading='state.loading > 0'
            )
            template(v-slot:prepend)
              q-icon(name='las la-hashtag', size='xs')
            template(v-slot:option='scope')
              q-item(v-bind='scope.itemProps')
                q-item-section(side)
                  q-checkbox(:model-value='scope.selected', @update:model-value='scope.toggleOption(scope.opt)', size='sm')
                q-item-section
                  q-item-label(v-html='scope.opt')
          //- q-input.q-mt-sm(
          //-   outlined
          //-   dense
          //-   placeholder='Last updated...'
          //-   )
          //-   template(v-slot:prepend)
          //-     q-icon(name='las la-calendar', size='xs')
          //- q-input.q-mt-sm(
          //-   outlined
          //-   dense
          //-   placeholder='Last edited by...'
          //-   )
          //-   template(v-slot:prepend)
          //-     q-icon(name='las la-user-edit', size='xs')
          q-select.q-mt-sm(
            outlined
            v-model='state.params.filterLocale'
            emit-value
            map-options
            dense
            :aria-label='t(`search.filterLocale`)'
            :options='siteStore.locales.active'
            option-value='code'
            option-label='name'
            options-dense
            multiple
            :display-value='t(`search.filterLocaleDisplay`, { n: state.params.filterLocale.length > 0 ? state.params.filterLocale[0].toUpperCase() : state.params.filterLocale.length }, state.params.filterLocale.length)'
            )
            template(v-slot:prepend)
              q-icon(name='las la-language', size='xs')
            template(v-slot:option='scope')
              q-item(v-bind='scope.itemProps')
                q-item-section(side)
                  q-checkbox(:model-value='scope.selected', @update:model-value='scope.toggleOption(scope.opt)')
                q-item-section
                  q-item-label(v-html='scope.opt.name')
          q-select.q-mt-sm(
            outlined
            v-model='state.params.filterEditor'
            emit-value
            map-options
            dense
            :aria-label='t(`search.filterEditor`)'
            :options='editors'
            )
            template(v-slot:prepend)
              q-icon(name='las la-pen-nib', size='xs')
          q-select.q-mt-sm(
            outlined
            v-model='state.params.filterPublishState'
            emit-value
            map-options
            dense
            :aria-label='t(`search.filterPublishState`)'
            :options='publishStates'
            )
            template(v-slot:prepend)
              q-icon(name='las la-traffic-light', size='xs')
      q-page(:style-fn='pageStyle')
        .text-header.flex
          span {{t('search.results')}}
          q-space
          transition(name='slide-up', mode='out-in')
            i18n-t(
              v-if='!siteStore.searchIsLoading'
              keypath='search.totalResults'
              tag='span'
              class='text-caption'
              :plural='state.total'
              )
              strong {{ state.total }}
        .q-pa-lg(v-if='state.results.length < 1')
          i18n-t(keypath='search.noResults', tag='span', v-if='siteStore.search && siteStore.searchLastQuery')
            strong {{ siteStore.searchLastQuery }}
          span(v-else): em {{ t('search.emptyQuery') }}
        q-list(separator)
          q-item(
            v-for='item of state.results'
            clickable
            :to='`/` + item.path'
            )
            q-item-section(avatar)
              q-avatar(color='primary' text-color='white' rounded :icon='item.icon')
            q-item-section
              q-item-label {{ item.title }}
              q-item-label(v-if='item.description', caption) {{ item.description }}
              q-item-label.text-highlight(v-if='item.highlight', caption, v-html='item.highlight')
            q-item-section(side)
              .flex.layout-search-itemtags
                q-chip(
                  v-for='tag of item.tags'
                  square
                  color='secondary'
                  text-color='white'
                  icon='las la-hashtag'
                  size='sm'
                  ) {{ tag }}
              .flex
                .text-caption.q-mr-sm.text-grey /{{ item.path }}
                .text-caption {{ humanizeDate(item.updatedAt) }}

      q-inner-loading(:showing='state.loading > 0')
  main-overlay-dialog
  footer-nav
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { computed, onMounted, onUnmounted, reactive, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import gql from 'graphql-tag'
import { cloneDeep, debounce, difference } from 'lodash-es'
import { DateTime } from 'luxon'

import { useFlagsStore } from 'src/stores/flags'
import { useSiteStore } from 'src/stores/site'
import { useUserStore } from 'src/stores/user'

import HeaderNav from 'src/components/HeaderNav.vue'
import FooterNav from 'src/components/FooterNav.vue'
import MainOverlayDialog from 'src/components/MainOverlayDialog.vue'

const tagsInQueryRgx = /#[a-z0-9-\u3400-\u4DBF\u4E00-\u9FFF]+(?=(?:[^"]*(?:")[^"]*(?:"))*[^"]*$)/g

// QUASAR

const $q = useQuasar()

// STORES

const flagsStore = useFlagsStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// META

useMeta({
  titleTemplate: title => `${title} - ${t('profile.title')} - Wiki.js`
})

// DATA

const state = reactive({
  loading: 0,
  params: {
    filterPath: '',
    filterLocale: [],
    filterEditor: '',
    filterPublishState: '',
    orderBy: 'relevancy',
    orderByDirection: 'desc'
  },
  selectedTags: [],
  filteredTags: [],
  results: [],
  total: 0
})

const orderByOptions = computed(() => {
  return [
    { label: t('search.sortByRelevance'), value: 'relevancy', icon: 'las la-stream' },
    { label: t('search.sortByTitle'), value: 'title', icon: 'las la-heading' },
    { label: t('search.sortByLastUpdated'), value: 'updatedAt', icon: 'las la-calendar' }
  ]
})

const editors = computed(() => {
  return [
    { label: t('search.editorAny'), value: '' },
    { label: 'AsciiDoc', value: 'asciidoc' },
    { label: 'Markdown', value: 'markdown' },
    { label: 'Visual Editor', value: 'wysiwyg' }
  ]
})

const publishStates = computed(() => {
  return [
    { label: t('search.publishStateAny'), value: '' },
    { label: t('search.publishStateDraft'), value: 'draft' },
    { label: t('search.publishStatePublished'), value: 'published' },
    { label: t('search.publishStateScheduled'), value: 'scheduled' }
  ]
})

const tags = computed(() => siteStore.tags.map(t => t.tag))

// WATCHERS

watch(() => route.query, async (newQueryObj) => {
  if (newQueryObj.q) {
    siteStore.search = newQueryObj.q.trim()
    syncTags()
    performSearch()
  }
}, { immediate: true })

watch(() => state.params, debounce(performSearch, 500), { deep: true })

// METHODS

function pageStyle (offset, height) {
  return {
    'min-height': `${height - 100 - offset}px`
  }
}

function humanizeDate (val) {
  return DateTime.fromISO(val).toFormat(userStore.preferredDateFormat)
}

function setOrderBy (val) {
  if (val === state.params.orderBy) {
    state.params.orderByDirection = state.params.orderByDirection === 'desc' ? 'asc' : 'desc'
  } else {
    state.params.orderBy = val
    state.params.orderByDirection = val === 'title' ? 'asc' : 'desc'
  }
}

function filterTags (val, update) {
  update(() => {
    if (val === '') {
      state.filteredTags = tags.value
    } else {
      const tagSearch = val.toLowerCase()
      state.filteredTags = tags.value.filter(
        v => v.toLowerCase().indexOf(tagSearch) >= 0
      )
    }
  })
}

function syncTags (newSelection) {
  const queryTags = Array.from(siteStore.search.matchAll(tagsInQueryRgx)).map(t => t[0].substring(1))
  if (!newSelection) {
    state.selectedTags = queryTags
  } else {
    let newQuery = siteStore.search
    for (const tag of newSelection) {
      if (!newQuery.includes(`#${tag}`)) {
        newQuery = `${newQuery} #${tag}`
      }
    }
    for (const tag of difference(queryTags, newSelection)) {
      newQuery = newQuery.replaceAll(`#${tag}`, '')
    }
    newQuery = newQuery.replaceAll('  ', ' ').trim()
    router.replace({ path: '/_search', query: { q: newQuery } })
  }
}

async function performSearch () {
  siteStore.searchIsLoading = true
  try {
    let q = siteStore.search

    // -> Extract tags
    const queryTags = Array.from(q.matchAll(tagsInQueryRgx)).map(t => t[0].substring(1))
    for (const tag of queryTags) {
      q = q.replaceAll(`#${tag}`, '')
    }
    q = q.trim().replaceAll(/\s\s+/g, ' ')

    const resp = await APOLLO_CLIENT.query({
      query: gql`
        query searchPages (
          $siteId: UUID!
          $query: String!
          $path: String
          $locale: [String]
          $tags: [String]
          $editor: String
          $publishState: PagePublishState
          $orderBy: PageSearchSort
          $orderByDirection: OrderByDirection
          $offset: Int
          $limit: Int
        ) {
          searchPages(
            siteId: $siteId
            query: $query
            path: $path
            locale: $locale
            tags: $tags
            editor: $editor
            publishState: $publishState
            orderBy: $orderBy
            orderByDirection: $orderByDirection
            offset: $offset
            limit: $limit
          ) {
            results {
              id
              path
              locale
              title
              description
              icon
              tags
              updatedAt
              relevancy
              highlight
            }
            totalHits
          }
        }
      `,
      variables: {
        siteId: siteStore.id,
        query: q,
        path: state.params.filterPath,
        tags: queryTags,
        locale: state.params.filterLocale,
        editor: state.params.filterEditor,
        publishState: state.params.filterPublishState || null,
        orderBy: state.params.orderBy,
        orderByDirection: state.params.orderByDirection
      },
      fetchPolicy: 'network-only'
    })
    if (!resp?.data?.searchPages) {
      throw new Error('Unexpected error')
    }
    state.results = cloneDeep(resp.data.searchPages.results).map(r => { r.tags.sort(); return r })
    state.total = resp.data.searchPages.totalHits
    siteStore.searchLastQuery = siteStore.search
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to perform search query.',
      caption: err.message
    })
  }
  siteStore.searchIsLoading = false
}

function goBack () {
  if (history.length > 0) {
    router.back()
  } else {
    router.push('/')
  }
}

// MOUNTED

onMounted(() => {
  if (!siteStore.search) {
    siteStore.searchIsLoading = false
  }
})

onUnmounted(() => {
  siteStore.search = ''
  siteStore.searchLastQuery = ''
  siteStore.searchIsLoading = false
})

</script>

<style lang="scss">
.layout-search {
  @at-root .body--light & {
    background-color: $grey-3;
  }
  @at-root .body--dark & {
    background-color: $dark-6;
  }

  &:before {
    content: '';
    height: 200px;
    position: fixed;
    top: 0;
    width: 100%;
    background: radial-gradient(ellipse at bottom, $dark-3, $dark-6);
    border-bottom: 1px solid #FFF;

    @at-root .body--dark & {
      border-bottom-color: $dark-3;
    }
  }

  &:after {
    content: '';
    height: 1px;
    position: fixed;
    top: 64px;
    width: 100%;
    background: linear-gradient(to right, transparent 0%, rgba(255,255,255,.1) 50%, transparent 100%);
  }

  &-back {
    position: absolute;
    left: -50px;
  }

  &-card {
    position: relative;
    width: 90%;
    max-width: 1400px;
    margin: 50px auto;
    box-shadow: $shadow-2;
    border-radius: 7px;
    display: flex;
    align-items: stretch;
    height: 100%;

    @at-root .body--light & {
      background-color: #FFF;
    }
    @at-root .body--dark & {
      background-color: $dark-3;
    }
  }

  &-sd {
    flex: 0 0 300px;
    border-radius: 8px 0 0 8px;
    overflow: hidden;

    @at-root .body--light & {
      background-color: $grey-1;
      border-right: 1px solid rgba($dark-3, .1);
      box-shadow: inset -1px 0 0 #FFF;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
      border-right: 1px solid rgba(#FFF, .12);
      box-shadow: inset -1px 0 0 rgba($dark-6, .5);
    }
  }

  .text-header {
    padding: .75rem 1rem;
    font-weight: 500;

    @at-root .body--light & {
      background-color: $grey-1;
      border-bottom: 1px solid $grey-3;
    }
    @at-root .body--dark & {
      background-color: $dark-3;
      border-bottom: 1px solid $dark-2;
    }
  }

  .text-highlight {
    font-style: italic;

    > b {
      background-color: rgba($yellow-7, .5);
      border-radius: 3px;
    }
  }

  .q-page {
    flex: 1 1;

    .text-header:first-child {
      border-top-right-radius: 7px;
    }

    @at-root .body--light & {
      border-left: 1px solid #FFF;
    }
    @at-root .body--dark & {
      border-left: 1px solid rgba($dark-6, .75);
    }
  }

  &-itemtags {
    .q-chip:last-child {
      margin-right: 0;
    }
  }
}

body.body--dark {
  background-color: $dark-6;
}

.q-footer {
  .q-bar {
    @at-root .body--light & {
      background-color: $grey-3;
      color: $grey-7;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
      color: rgba(255,255,255,.3);
    }
  }
}
</style>
