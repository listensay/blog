<template>
  <svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">
    <ellipse v-for="angle in [0, 72, 144, 216, 288]" :key="angle" cx="32" cy="15" rx="9" ry="14" :transform="`rotate(${angle} 32 32)`" />
  </svg>
</template>
