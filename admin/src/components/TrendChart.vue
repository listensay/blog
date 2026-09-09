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

  const points = props.points
  const max = Math.max(...points.map((point) => point.count), 0)

  chart.setOption(
    {
      grid: { top: 16, right: 8, bottom: 24, left: 32 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const [first] = params as Array<{ dataIndex: number }>
          const point = points[first?.dataIndex ?? 0]
          return point ? `${point.month}<br/>${point.count} 篇` : ''
        },
      },
      xAxis: {
        type: 'category',
        data: points.map((point, index) => labelOf(point.month, index, points)),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#f0f0f0' } },
        axisLabel: { color: '#8c8c8c', fontSize: 12 },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        max: max < 4 ? 4 : null,
        splitLine: { lineStyle: { color: '#f5f5f5' } },
        axisLabel: { color: '#8c8c8c', fontSize: 12 },
      },
      series: [
        {
          type: 'bar',
          data: points.map((point) => point.count),
          barMaxWidth: 32,
          itemStyle: { color: '#1677ff', borderRadius: [4, 4, 0, 0] },
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

  observer = new ResizeObserver(() => chart?.resize())
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
  <div ref="host" class="chart" />
</template>

<style scoped>
.chart {
  width: 100%;
  height: 220px;
}
</style>
