import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
// DatePicker 底层是 dayjs，中文月份/星期要靠这个 locale
import 'dayjs/locale/zh-cn'

import App from './App.vue'
import router from './router'
import './styles/main.css'

createApp(App).use(Antd).use(router).mount('#app')
