<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

import type { TrendPoint } from '@/types'

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

const props = defineProps<{ points: TrendPoint[] }>()

const host = ref<HTMLDivElement | null>(null)

let chart: echarts.ECharts | null = null
let observer: ResizeObserver | null = null

/** 2026-09 → 26/09，同一年的后续月份只留月份 */
function labelOf(month: string, index: number, all: TrendPoint[]): string {
  const [year, mm] = month.split('-')
  const previous = index > 0 ? all[index - 1]!.month.slice(0, 4) : ''
  return year === previous ? `${mm}月` : `${year?.slice(2)}/${mm}`
}

function render() {
  if (!chart) return

  const theme = getComputedStyle(host.value!)
  const color = (token: string) => theme.getPropertyValue(`--color-${token}`).trim()
  const points = props.points
  const max = Math.max(...points.map((point) => point.count), 0)

  chart.setOption(
    {
      animation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      aria: { enabled: true },
      grid: { top: 16, right: 8, bottom: 24, left: 32 },
      tooltip: {
        trigger: 'axis',
        renderMode: 'richText',
        confine: true,
        backgroundColor: color('panel'),
        borderColor: color('panel-line'),
        textStyle: { color: color('panel-text') },
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const [first] = params as Array<{ dataIndex: number }>
          const point = points[first?.dataIndex ?? 0]
          return point ? `${point.month}\n${point.count} 篇` : ''
        },
      },
      xAxis: {
        type: 'category',
        data: points.map((point, index) => labelOf(point.month, index, points)),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: color('panel-line') } },
        axisLabel: { color: color('panel-muted'), fontSize: 12 },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        max: max < 4 ? 4 : null,
        splitLine: { lineStyle: { color: color('panel-line') } },
        axisLabel: { color: color('panel-muted'), fontSize: 12 },
      },
      series: [
        {
          type: 'bar',
          data: points.map((point) => point.count),
          barMaxWidth: 32,
          itemStyle: { color: color('interactive'), borderRadius: [4, 4, 0, 0] },
        },
      ],
    },
    { notMerge: true },
  )
}

onMounted(() => {
  if (!host.value) return

  chart = echarts.init(host.value, undefined, { renderer: 'canvas' })
  render()

  observer = new ResizeObserver(() => {
    chart?.dispatchAction({ type: 'hideTip' })
    chart?.resize()
  })
  observer.observe(host.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  chart?.dispose()
  chart = null
})

watch(() => props.points, render)
</script>

<template>
  <div
    ref="host"
    class="h-56 w-full"
    role="img"
    :aria-label="`发文趋势：${points.map((point) => `${point.month}，${point.count} 篇`).join('；')}`"
  />
</template>
