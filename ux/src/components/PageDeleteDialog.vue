<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 550px; max-width: 850px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-delete-bin.svg', left, size='sm')
      span {{t(`pageDeleteDialog.title`)}}
    q-card-section
      .text-body2
        i18n-t(keypath='pageDeleteDialog.confirm')
          template(v-slot:name)
            strong {{pageName}}
      .text-caption.text-grey.q-mt-sm {{t('pageDeleteDialog.pageId', { id: pageId })}}
    q-card-actions.card-actions
      q-space
      q-btn.acrylic-btn(
        flat
        :label='t(`common.actions.cancel`)'
        color='grey'
        padding='xs md'
        @click='onDialogCancel'
        )
      q-btn(
        unelevated
        :label='t(`common.actions.delete`)'
        color='negative'
        padding='xs md'
        @click='confirm'
        :loading='state.isLoading'
        )
</template>

<script setup>
import gql from 'graphql-tag'
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { reactive } from 'vue'

// PROPS

const props = defineProps({
  pageId: {
    type: String,
    required: true
  },
  pageName: {
    type: String,
    required: true
  }
})

// EMITS

defineEmits([
  ...useDialogPluginComponent.emits
])

// QUASAR

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
const $q = useQuasar()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  isLoading: false
})

// METHODS

async function confirm () {
  state.isLoading = true
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation deletePage ($id: UUID!) {
          deletePage(id: $id) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        id: props.pageId
      }
    })
    if (resp?.data?.deletePage?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('pageDeleteDialog.deleteSuccess')
      })
      onDialogOK()
    } else {
      throw new Error(resp?.data?.deletePage?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
  state.isLoading = false
}
</script>
