<template lang='pug'>
q-layout(view='hHh Lpr lff')
  header-nav
  q-drawer.bg-sidebar(
    :modelValue='isSidebarShown'
    :show-if-above='siteStore.theme.sidebarPosition !== `off`'
    :width='isSidebarMini ? 56 : 255'
    :side='siteStore.theme.sidebarPosition === `right` ? `right` : `left`'
    )
    .sidebar-mini.column.items-stretch(v-if='isSidebarMini')
      q-btn.q-py-md(
        flat
        icon='las la-globe'
        color='white'
        aria-label='Switch Locale'
        @click=''
        )
        locale-selector-menu(anchor='top right' self='top left')
        q-tooltip(anchor='center right' self='center left') Switch Locale
      q-btn.q-py-md(
        flat
        icon='las la-sitemap'
        color='white'
        aria-label='Browse'
        @click='notImplemented'
        )
        q-tooltip(anchor='center right' self='center left') Browse
      q-separator.q-my-sm(inset, dark)
      q-btn.q-py-md(
        flat
        icon='las la-bookmark'
        color='white'
        aria-label='Bookmarks'
        @click='notImplemented'
        )
        q-tooltip(anchor='center right' self='center left') Bookmarks
      q-space
      q-btn.q-py-xs(
        flat
        icon='las la-dharmachakra'
        color='white'
        aria-label='Edit Nav'
        size='sm'
        )
        q-menu(
          ref='navEditMenuMini'
          anchor='top right'
          self='bottom left'
          )
          nav-edit-menu(
            :menu-hide-handler='navEditMenuMini.hide'
            :update-position-handler='navEditMenuMini.updatePosition'
            )
        q-tooltip(anchor='center right' self='center left') Edit Nav
    template(v-else)
      .sidebar-actions.flex.items-stretch
        q-btn.q-px-sm.col(
          flat
          dense
          icon='las la-globe'
          color='blue-7'
          text-color='custom-color'
          :label='commonStore.locale'
          :aria-label='commonStore.locale'
          size='sm'
          )
          locale-selector-menu(:offset="[-5, 5]")
        q-separator(vertical)
        q-btn.q-px-sm.col(
          flat
          dense
          icon='las la-sitemap'
          color='blue-7'
          text-color='custom-color'
          label='Browse'
          aria-label='Browse'
          size='sm'
          @click='notImplemented'
          )
      nav-sidebar
      q-bar.sidebar-footerbtns.text-white(
        v-if='userStore.authenticated'
        dense
        )
        q-btn.col(
          icon='las la-dharmachakra'
          label='Edit Nav'
          flat
          )
          q-menu(
            ref='navEditMenu'
            anchor='top left'
            self='bottom left'
            :offset='[0, 10]'
            )
            nav-edit-menu(
              :menu-hide-handler='navEditMenu.hide'
              :update-position-handler='navEditMenu.updatePosition'
              )
        q-separator(vertical)
        q-btn.col(
          icon='las la-bookmark'
          label='Bookmarks'
          flat
          @click='notImplemented'
        )
  q-page-container
    router-view
    q-page-scroller(
      position='bottom-right'
      :scroll-offset='150'
      :offset='[15, 15]'
      )
      q-btn(
        icon='las la-arrow-up'
        color='primary'
        round
        size='md'
      )
  main-overlay-dialog
  footer-nav(v-if='!editorStore.isActive')
</template>

<script setup>
import { useMeta, useQuasar } from 'quasar'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { useCommonStore } from 'src/stores/common'
import { useEditorStore } from 'src/stores/editor'
import { useFlagsStore } from 'src/stores/flags'
import { usePageStore } from 'src/stores/page'
import { useSiteStore } from 'src/stores/site'
import { useUserStore } from 'src/stores/user'

// COMPONENTS

import FooterNav from 'src/components/FooterNav.vue'
import HeaderNav from 'src/components/HeaderNav.vue'
import LocaleSelectorMenu from 'src/components/LocaleSelectorMenu.vue'
import NavSidebar from 'src/components/NavSidebar.vue'
import NavEditMenu from 'src/components/NavEditMenu.vue'
import MainOverlayDialog from 'src/components/MainOverlayDialog.vue'

// QUASAR

const $q = useQuasar()

// STORES

const commonStore = useCommonStore()
const editorStore = useEditorStore()
const flagsStore = useFlagsStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// META

useMeta({
  titleTemplate: title => `${title} - ${siteStore.title}`
})

// REFS

const navEditMenu = ref(null)
const navEditMenuMini = ref(null)

// COMPUTED

const isSidebarShown = computed(() => {
  return siteStore.showSideNav && !siteStore.sideNavIsDisabled && !(editorStore.isActive && editorStore.hideSideNav)
})

const isSidebarMini = computed(() => {
  return ['hide', 'hideExact'].includes(pageStore.navigationMode) || !pageStore.navigationId
})

// METHODS

function notImplemented () {
  $q.notify({
    type: 'negative',
    message: 'Not implemented'
  })
}

</script>

<style lang="scss">
.sidebar-actions {
  background: linear-gradient(to bottom, rgba(255,255,255,.1) 0%, rgba(0,0,0, .05) 100%);
  border-bottom: 1px solid rgba(0,0,0,.2);
  height: 38px;

  .q-btn {
    color: rgba(255,255,255,.8);
  }
}

.sidebar-mini {
  height: 100%;
}

.sidebar-footerbtns {
  background-color: rgba(255,255,255,.1);
}

body.body--dark {
  background-color: $dark-6;
}

.main-overlay {
  > .q-dialog__backdrop {
    background-color: rgba(0,0,0,.6);
    backdrop-filter: blur(5px) saturate(180%);
  }
  > .q-dialog__inner {
    padding: 24px 64px;

    @media (max-width: $breakpoint-sm-max) {
      padding: 0;
    }

    > .q-layout-container {
      @at-root .body--light & {
        background-image: linear-gradient(to bottom, $dark-5 10px, $grey-3 11px, $grey-4);
      }
      @at-root .body--dark & {
        background-image: linear-gradient(to bottom, $dark-4 10px, $dark-4 11px, $dark-3);
      }
      border-radius: 6px;
      box-shadow: 0 0 30px 0 rgba(0,0,0,.3);
    }
  }
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

.syncing-enter-active {
  animation: syncing-anim .1s;
}
.syncing-leave-active {
  animation: syncing-anim 1s reverse;
}
@keyframes syncing-anim {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
</style>
