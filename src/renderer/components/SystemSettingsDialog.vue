<template>
  <el-dialog 
    v-model="visible" 
    title="常规设置" 
    width="600px" 
    append-to-body
    custom-class="settings-dialog"
  >
    <el-tabs v-model="activeTab" class="settings-tabs">
      <!-- General Settings -->
      <el-tab-pane label="常规" name="general">
        <el-form label-position="top" class="settings-form">
          <el-form-item label="文件保存路径">
            <div class="path-input-group">
              <el-input 
                v-model="configStore.fileSavePath" 
                placeholder="选择日志导出默认保存路径" 
                readonly
              >
                <template #prefix>
                  <el-icon><FolderOpened /></el-icon>
                </template>
              </el-input>
              <el-button type="primary" plain @click="onBrowseDirectory">选择</el-button>
            </div>
            <div class="setting-desc">日志、截图和报告的默认保存目录。</div>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- AI Settings (List only names) -->
      <el-tab-pane label="AI 诊断" name="ai">
        <div class="ai-list-panel">
          <div class="list-header">
            <span>已配置的模型</span>
            <el-button type="primary" size="small" :icon="Plus" @click="openAddProvider">添加模型</el-button>
          </div>
          
          <div class="provider-table">
            <div v-for="p in configStore.aiProviders" :key="p.id" class="provider-row">
              <div class="provider-info">
                <el-tag size="small" :type="getTagType(p.type)" class="type-tag">{{ p.type.toUpperCase() }}</el-tag>
                <span class="name">{{ p.name }}</span>
                <span class="model-name">({{ p.model }})</span>
              </div>
              <div class="provider-actions">
                <el-button link :icon="Edit" @click="editProvider(p)" />
                <el-button link type="danger" :icon="Delete" @click="configStore.removeAIProvider(p.id)" />
              </div>
            </div>
            <div v-if="!configStore.aiProviders.length" class="empty-list">
              暂无模型，请点击右上方添加
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- Interaction Settings -->
      <el-tab-pane label="交互" name="interaction">
        <el-form label-width="120px" class="settings-form compact-form">
          <el-form-item label="二级页面关闭">
            <el-switch v-model="configStore.skipExitConfirmation" active-text="不再弹出确认框" />
          </el-form-item>

          <el-form-item label="主程序关闭">
            <el-switch v-model="configStore.skipHomeCloseConfirmation" active-text="不再弹出确认框" />
          </el-form-item>

          <el-form-item label="默认退出行为">
            <el-radio-group v-model="configStore.closeAction">
              <el-radio value="minimize">最小化到托盘</el-radio>
              <el-radio value="exit">彻底退出程序</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>

    <!-- Add/Edit Provider Dialog -->
    <el-dialog
      v-model="providerDialogVisible"
      :title="isEditing ? '编辑 AI 模型' : '添加 AI 模型'"
      width="460px"
      append-to-body
      custom-class="provider-dialog"
    >
      <el-form :model="providerForm" label-position="top" size="default">
        <el-form-item label="模型名称" required>
          <el-input v-model="providerForm.name" placeholder="例如: Gemini 1.5 Pro" />
        </el-form-item>
        <el-form-item label="接口类型">
          <el-select v-model="providerForm.type" style="width: 100%" @change="onProviderTypeChange">
            <el-option label="Google Gemini" value="gemini" />
            <el-option label="OpenAI" value="openai" />
            <el-option label="Claude" value="claude" />
            <el-option label="Custom (OpenAI Compatible)" value="custom" />
          </el-select>
        </el-form-item>
        <el-form-item label="API Key" required>
          <el-input v-model="providerForm.apiKey" type="password" show-password placeholder="API 密钥" />
        </el-form-item>
        <el-form-item label="API URL" required>
          <el-input v-model="providerForm.apiUrl" placeholder="请求地址" />
        </el-form-item>
        <el-form-item label="模型 ID" required>
          <el-input v-model="providerForm.model" placeholder="例如: gemini-1.5-pro" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="providerDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveProvider">确定</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useConfigStore } from '../stores/configStore'
import { FolderOpened, Plus, Delete, Edit } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { AIProviderType, AIProviderConfig } from '../../shared/types'

const configStore = useConfigStore()
const visible = ref(false)
const activeTab = ref('general')

// Provider Dialog State
const providerDialogVisible = ref(false)
const isEditing = ref(false)
const editingId = ref('')
const providerForm = reactive({
  name: '',
  type: 'gemini' as AIProviderType,
  apiKey: '',
  apiUrl: '',
  model: ''
})

async function onBrowseDirectory() {
  const path = await window.electronAPI.storage.selectDirectory()
  if (path) {
    configStore.fileSavePath = path
  }
}

function getTagType(type: string) {
  const types: Record<string, string> = {
    gemini: 'primary',
    openai: 'success',
    claude: 'warning',
    custom: 'info'
  }
  return types[type] || 'info'
}

function openAddProvider() {
  isEditing.value = false
  editingId.value = ''
  Object.assign(providerForm, {
    name: '',
    type: 'gemini',
    apiKey: '',
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
    model: 'gemini-pro'
  })
  providerDialogVisible.value = true
}

function onProviderTypeChange(type: AIProviderType) {
  if (type === 'gemini') {
    providerForm.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent'
    providerForm.model = 'gemini-pro'
  } else if (type === 'openai') {
    providerForm.apiUrl = 'https://api.openai.com/v1/chat/completions'
    providerForm.model = 'gpt-4o'
  } else if (type === 'claude') {
    providerForm.apiUrl = 'https://api.anthropic.com/v1/messages'
    providerForm.model = 'claude-3-5-sonnet-20240620'
  }
}

function editProvider(p: AIProviderConfig) {
  isEditing.value = true
  editingId.value = p.id
  Object.assign(providerForm, {
    name: p.name,
    type: p.type,
    apiKey: p.apiKey,
    apiUrl: p.apiUrl,
    model: p.model
  })
  providerDialogVisible.value = true
}

function saveProvider() {
  if (!providerForm.name || !providerForm.apiKey || !providerForm.apiUrl || !providerForm.model) {
    ElMessage.warning('请填写完整信息')
    return
  }

  if (isEditing.value) {
    configStore.updateAIProvider(editingId.value, { ...providerForm })
  } else {
    configStore.addAIProvider({ ...providerForm, enabled: true })
  }
  
  providerDialogVisible.value = false
}

defineExpose({
  open: (tab = 'general') => { 
    activeTab.value = tab
    visible.value = true 
  }
})
</script>

<style scoped>
.settings-tabs {
  margin-top: -10px;
}

.settings-form {
  padding: 16px 8px;
}

.compact-form {
  margin-top: 10px;
}

.path-input-group {
  display: flex;
  gap: 8px;
  width: 100%;
}

.setting-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
}

.setting-desc a {
  color: var(--accent);
  text-decoration: none;
}

/* AI List Panel */
.ai-list-panel {
  padding: 12px 4px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.provider-table {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.provider-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.2s;
}

.provider-row:last-child {
  border-bottom: none;
}

.provider-row:hover {
  background: var(--bg-hover);
}

.provider-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.type-tag {
  min-width: 60px;
  text-align: center;
}

.provider-info .name {
  font-weight: 600;
  color: var(--text-primary);
}

.provider-info .model-name {
  font-size: 12px;
  color: var(--text-muted);
}

.empty-list {
  padding: 40px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

:deep(.settings-dialog), :deep(.provider-dialog) {
  background: var(--bg-secondary) !important;
  border-radius: 12px;
}

:deep(.el-form-item__label) {
  color: var(--text-primary) !important;
  font-weight: 500 !important;
}

:deep(.el-tabs__nav-wrap::after) {
  background-color: var(--border-color);
}
</style>