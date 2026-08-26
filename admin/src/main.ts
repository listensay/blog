import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import 'dayjs/locale/zh-cn'

import App from './App.vue'
import router from './router'
import './styles/main.css'

createApp(App).use(Antd).use(router).mount('#app')
