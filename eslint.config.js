import { globalIgnores } from 'eslint/config'
import pluginVue from 'eslint-plugin-vue'
import { withVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

export default withVueTs(
  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', 'dev-dist/**']),
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
)
