import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import WindiCSS from 'vite-plugin-windicss'

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [vue(), vueJsx(), WindiCSS()],
  build:{
    outDir:"../web"
  }
})
