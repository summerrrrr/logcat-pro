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
        <el-form-item label="接口类型">
          <el-select v-model="providerForm.type" style="width: 100%" @change="onProviderTypeChange">
            <el-option label="Google Gemini" value="gemini" />
            <el-option label="OpenAI" value="openai" />
            <el-option label="Claude" value="claude" />
            <el-option label="Codex" value="codex" />
            <el-option label="Custom (OpenAI Compatible)" value="custom" />
          </el-select>
        </el-form-item>
        <el-form-item label="API Key" required>
          <el-input v-model="providerForm.apiKey" type="password" show-password placeholder="粘贴你的 API 密钥" />
        </el-form-item>
        <el-form-item label="模型">
          <div class="model-fetch-group">
            <el-select
              v-model="providerForm.model"
              style="flex: 1"
              filterable
              allow-create
              default-first-option
              :placeholder="fetchingModels ? '正在获取...' : '请先点击获取模型列表'"
              :loading="fetchingModels"
            >
              <el-option
                v-for="m in modelList"
                :key="m.id"
                :label="`${m.name}${m.name !== m.id ? ' (' + m.id + ')' : ''}`"
                :value="m.id"
              />
            </el-select>
            <el-button
              :icon="Refresh"
              :loading="fetchingModels"
              @click="onFetchModels"
              :disabled="!providerForm.apiKey"
              title="获取模型列表"
            />
          </div>
          <div class="setting-desc" v-if="!providerForm.apiKey">填写 API Key 后可获取模型列表，也可直接输入模型 ID</div>
        </el-form-item>
        <div class="advanced-toggle" @click="showAdvanced = !showAdvanced">
          <el-icon class="toggle-arrow" :class="{ expanded: showAdvanced }"><ArrowRight /></el-icon>
          <span>高级设置</span>
          <span class="toggle-hint">自定义名称、URL</span>
        </div>
        <template v-if="showAdvanced">
          <el-form-item label="显示名称">
            <el-input v-model="providerForm.name" :placeholder="defaultProviderName" />
          </el-form-item>
          <el-form-item label="API URL">
            <el-input v-model="providerForm.apiUrl" placeholder="请求地址（使用代理时修改）" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="providerDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveProvider">确定</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useConfigStore } from '../stores/configStore'
import { FolderOpened, Plus, Delete, Edit, ArrowRight, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { AIProviderType, AIProviderConfig } from '../../shared/types'

const configStore = useConfigStore()
const visible = ref(false)
const activeTab = ref('general')

// Provider Dialog State
const providerDialogVisible = ref(false)
const isEditing = ref(false)
const editingId = ref('')
const showAdvanced = ref(false)
const providerForm = reactive({
  name: '',
  type: 'gemini' as AIProviderType,
  apiKey: '',
  apiUrl: '',
  model: ''
})

const providerPresets: Record<string, { name: string; url: string; model: string }> = {
  gemini: { name: 'Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', model: 'gemini-pro' },
  openai: { name: 'OpenAI', url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o' },
  claude: { name: 'Claude', url: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-20250514' },
  codex: { name: 'Codex', url: 'https://api.openai.com/v1/responses', model: 'codex-mini-latest' },
  custom: { name: 'Custom', url: '', model: '' }
}

const defaultProviderName = computed(() => {
  const preset = providerPresets[providerForm.type]
  return preset ? `${preset.name} (${providerForm.model || '自定义'})` : ''
})

const modelList = ref<{ id: string; name: string }[]>([])
const fetchingModels = ref(false)

async function onFetchModels() {
  if (!providerForm.apiKey) {
    ElMessage.warning('请先填写 API Key')
    return
  }
  fetchingModels.value = true
  try {
    const apiUrl = providerForm.apiUrl || providerPresets[providerForm.type]?.url || ''
    const models = await window.electronAPI.config.fetchModels(providerForm.type, providerForm.apiKey, apiUrl)
    modelList.value = models || []
    if (models.length === 0) {
      ElMessage.info('未获取到可用模型')
    } else {
      ElMessage.success(`获取到 ${models.length} 个模型`)
    }
  } catch (e: any) {
    console.error('Fetch models failed:', e)
    ElMessage.error(`获取模型列表失败: ${e.message || e}`)
  } finally {
    fetchingModels.value = false
  }
}

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
    codex: 'danger',
    custom: 'info'
  }
  return types[type] || 'info'
}

function openAddProvider() {
  isEditing.value = false
  editingId.value = ''
  showAdvanced.value = false
  modelList.value = []
  const preset = providerPresets['gemini']
  Object.assign(providerForm, {
    name: '',
    type: 'gemini',
    apiKey: '',
    apiUrl: preset.url,
    model: ''
  })
  providerDialogVisible.value = true
}

function onProviderTypeChange(type: AIProviderType) {
  const preset = providerPresets[type]
  if (preset) {
    providerForm.apiUrl = preset.url
    providerForm.model = preset.model
    providerForm.name = ''
  }
  modelList.value = []
}

function editProvider(p: AIProviderConfig) {
  isEditing.value = true
  editingId.value = p.id
  showAdvanced.value = true
  modelList.value = p.model ? [{ id: p.model, name: p.model }] : []
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
  if (!providerForm.apiKey) {
    ElMessage.warning('请填写 API Key')
    return
  }

  const preset = providerPresets[providerForm.type]
  const finalData = {
    name: providerForm.name || preset?.name || providerForm.type,
    type: providerForm.type,
    apiKey: providerForm.apiKey,
    apiUrl: providerForm.apiUrl || preset?.url || '',
    model: providerForm.model || preset?.model || ''
  }

  if (!finalData.apiUrl || !finalData.model) {
    ElMessage.warning('请在高级设置中填写 API URL 和模型 ID')
    showAdvanced.value = true
    return
  }

  if (isEditing.value) {
    configStore.updateAIProvider(editingId.value, finalData)
  } else {
    configStore.addAIProvider({ ...finalData, enabled: true })
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

.model-fetch-group {
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

.advanced-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  user-select: none;
  transition: color 0.2s;
}

.advanced-toggle:hover {
  color: var(--accent);
}

.toggle-arrow {
  transition: transform 0.2s;
  font-size: 12px;
}

.toggle-arrow.expanded {
  transform: rotate(90deg);
}

.toggle-hint {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
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