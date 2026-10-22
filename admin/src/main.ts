import { createApp } from 'vue'
import 'dayjs/locale/zh-cn'

import App from './App.vue'
import router from './router'
import './styles/main.css'

createApp(App).use(router).mount('#app')
