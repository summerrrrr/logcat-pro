<template>
  <el-dialog v-model="visible" title="日志高亮规则设置" width="600px" append-to-body>
    <div style="margin-top: 16px; margin-bottom: 8px; display: flex; justify-content: flex-end;">
      <el-button type="primary" size="small" @click="onAddRule">添加规则</el-button>
    </div>
    <el-table :data="configStore.highlightRules" style="width: 100%" size="small">
      <el-table-column label="启用" width="60">
        <template #default="{ row }">
          <el-switch v-model="row.enabled" size="small" />
        </template>
      </el-table-column>
      <el-table-column prop="pattern" label="关键字/正则" width="180">
        <template #default="{ row }">
          <el-input v-model="row.pattern" size="small" />
        </template>
      </el-table-column>
      <el-table-column label="正则" width="60">
        <template #default="{ row }">
          <el-checkbox v-model="row.isRegex" />
        </template>
      </el-table-column>
      <el-table-column label="颜色" width="100">
        <template #default="{ row }">
          <el-color-picker v-model="row.color" size="small" show-alpha />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80" fixed="right">
        <template #default="{ row }">
          <el-button type="danger" link @click="configStore.removeRule(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useConfigStore } from '../stores/configStore'

const configStore = useConfigStore()
const visible = ref(false)

function onAddRule() {
  configStore.addRule({ pattern: '', color: '#ff0000', isRegex: false, enabled: true })
}

defineExpose({
  open: () => { visible.value = true }
})
</script>
