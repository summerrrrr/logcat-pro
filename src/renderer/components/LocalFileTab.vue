<template>
  <div class="local-file-container">
    <div class="local-file-header" v-if="showSearchBar || appliedSearchQuery">
      <div class="file-info">
        <!-- Search Input shown on Ctrl+F -->
        <div class="header-search-container">
          <el-input 
            ref="searchInputRef"
            v-model="searchQuery" 
            placeholder="搜索..." 
            size="small" 
            clearable
            style="width: 200px"
            @keyup.enter="handleSearchEnter"
            @keyup.esc="clearSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>

          <template v-if="appliedSearchQuery && searchResults.length > 0">
            <div class="header-search-status">
              <span class="search-count-badge">
                <span class="curr">{{ searchIndex + 1 }}</span>
                <span class="divider">/</span>
                <span class="total">{{ searchResults.length }}</span>
              </span>
              <div class="header-search-nav">
                <button class="nav-btn" @click="findPrev" title="上一个"><el-icon><ArrowUp /></el-icon></button>
                <button class="nav-btn" @click="findNext" title="下一个"><el-icon><ArrowDown /></el-icon></button>
                <button class="nav-btn clear" @click="clearSearch" title="清除搜索"><el-icon><Close /></el-icon></button>
              </div>
            </div>
          </template>
          <span v-else-if="appliedSearchQuery && searchResults.length === 0" class="no-results-hint">
            <el-icon><Warning /></el-icon>
            未找到结果
          </span>
        </div>
      </div>
      <div class="header-actions">
      </div>
    </div>
    
    <div class="file-viewer-split" v-loading="file.loading" ref="containerRef">
      <!-- Stable Floating Action Button -->
      <el-tooltip 
        :content="showLocalErrorPanel ? '关闭分析结果' : '自动分析文件 (Crash/ANR)'" 
        placement="left"
        :hide-after="0"
      >
        <div 
          class="floating-action-btn" 
          :class="{ 'close-action': showLocalErrorPanel }"
          @click="handleFloatingBtnClick"
        >
          <el-icon v-if="!showLocalErrorPanel"><MagicStick /></el-icon>
          <el-icon v-else><Close /></el-icon>
        </div>
      </el-tooltip>

      <!-- Main Viewer Area -->
      <div 
        class="main-content-area" 
        ref="scrollRef"
        tabindex="0"
      >
        <div 
          v-if="virtualizer"
          :style="{ 
            height: `${totalSize}px`, 
            position: 'relative', 
            width: '100%' 
          }"
        >
          <div
            v-for="row in virtualRows"
            :key="row.index"
            :data-index="row.index"
            class="virtual-row"
            :style="{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${row.size}px`,
              transform: `translateY(${row.start}px)`
            }"
            :class="{ 
              'search-highlight-row': isSearchHighlight(row.index),
              'error-highlight-row': isErrorHighlight(row.index),
              'error-marker-row': isErrorLine(row.index)
            }"
          >
            <span class="row-num">{{ row.index + 1 }}</span>
            <span class="row-text" v-html="highlightResultLine(file.lines[row.index], appliedSearchQuery)"></span>
          </div>
        </div>
      </div>

      <!-- Local Error Results Panel -->
      <div 
        class="search-results-panel error-panel" 
        v-if="showLocalErrorPanel"
        :style="{ height: panelHeight + 'px' }"
      >
        <div class="panel-resizer" @mousedown="startResizing">
          <div class="resizer-knob"></div>
        </div>
        <div class="results-header">
          <div class="results-header-title danger-text">
            <el-icon><WarningFilled /></el-icon>
            <span>检测到 {{ localErrorResults.length }} 处异常</span>
          </div>
          <div class="results-header-actions">
            <el-dropdown trigger="click" @command="startAIDiagnosis">
              <el-button type="primary" size="small" :loading="isAnalyzing">
                <el-icon><MagicStick /></el-icon> AI 深度诊断
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-for="p in configStore.aiProviders" :key="p.id" :command="p">
                    {{ p.name }}
                  </el-dropdown-item>
                  <el-dropdown-item v-if="!configStore.aiProviders.length" disabled>
                    请先在设置中配置模型
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
        <div class="results-list">
          <div 
            v-for="(result, idx) in localErrorResults" 
            :key="idx"
            class="result-item error-item"
            :class="{ 'current-result': errorIndex === idx }"
            @click="jumpToError(idx)"
          >
            <el-tag size="small" type="danger" class="error-tag">{{ result.type }}</el-tag>
            <span class="line-number">{{ result.lineIndex + 1 }}</span>
            <span class="line-text">{{ result.text }}</span>
          </div>
        </div>
      </div>

      <!-- Normal Search Results Panel -->
      <div 
        class="search-results-panel" 
        v-else-if="appliedSearchQuery && searchResults.length > 0"
        :style="{ height: panelHeight + 'px' }"
      >
        <div class="panel-resizer" @mousedown="startResizing">
          <div class="resizer-knob"></div>
        </div>
        <div class="results-header">
          <div class="results-header-title">
            <el-icon><List /></el-icon>
            <span>包含 "{{ truncatedSearchQuery }}" 的行</span>
          </div>
        </div>
        <div class="results-list">
          <div 
            v-for="(result, idx) in searchResults" 
            :key="idx"
            class="result-item"
            :class="{ 'current-result': searchIndex === idx }"
            @click="jumpToLine(idx)"
          >
            <span class="line-number">{{ result.lineIndex + 1 }}</span>
            <span class="line-text" v-html="highlightResultLine(result.text, appliedSearchQuery)"></span>
          </div>
        </div>
      </div>
    </div>

    <!-- AI Analysis Dialog -->
    <el-dialog v-model="showAnalysisDialog" title="AI 诊断分析" width="700px" append-to-body>
      <div v-if="analysisResult" class="ai-result">
        <div class="ai-section">
          <div class="markdown-body" v-html="renderMarkdown(analysisResult.rawText)"></div>
        </div>
        <div class="ai-footer">
          <el-button type="success" size="small" @click="exportDiagnosisPDF">
            <el-icon><Download /></el-icon> 导出 PDF 报告
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { 
  ArrowUp, ArrowDown, Close, Search, Document, Warning, List, 
  MagicStick, Download, WarningFilled 
} from '@element-plus/icons-vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { ElMessage } from 'element-plus'
import { useConfigStore } from '../stores/configStore'
import { marked } from 'marked'

const props = defineProps<{
  file: {
    id: string
    name: string
    path: string
    lines: string[]
    loading: boolean
  }
}>()

const configStore = useConfigStore()
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

const scrollRef = ref<HTMLElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<any>(null)

const showSearchBar = ref(false)
const searchQuery = ref('')
const appliedSearchQuery = ref('')
const searchIndex = ref(-1)
const searchResults = ref<{ lineIndex: number, text: string }[]>([])
const panelHeight = ref(180)
const isResizing = ref(false)

// Local Scan State
const showLocalErrorPanel = ref(false)
const localErrorResults = ref<{ lineIndex: number, text: string, type: string }[]>([])
const errorIndex = ref(-1)

// AI Analysis State
const isAnalyzing = ref(false)
const showAnalysisDialog = ref(false)
const analysisResult = ref<any>(null)
let currentDiagnosisContext: { errorLog: any, contextLogs: any[] } | null = null

function handleFloatingBtnClick() {
  if (showLocalErrorPanel.value) showLocalErrorPanel.value = false
  else performLocalScan()
}

function isSearchHighlight(idx: number) {
  return !showLocalErrorPanel.value && searchResults.value[searchIndex.value]?.lineIndex === idx
}

function isErrorHighlight(idx: number) {
  return showLocalErrorPanel.value && localErrorResults.value[errorIndex.value]?.lineIndex === idx
}

function isErrorLine(idx: number) {
  return localErrorResults.value.some(e => e.lineIndex === idx)
}

function startResizing(e: MouseEvent) {
  isResizing.value = true
  const startY = e.clientY
  const startHeight = panelHeight.value
  function onMouseMove(mv: MouseEvent) {
    if (!isResizing.value) return
    const delta = mv.clientY - startY
    panelHeight.value = Math.max(80, Math.min(startHeight - delta, window.innerHeight * 0.7))
  }
  function onMouseUp() {
    isResizing.value = false
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
  }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  document.body.style.cursor = 'ns-resize'
}

const rowCount = computed(() => props.file.lines.length)
const truncatedSearchQuery = computed(() => {
  if (appliedSearchQuery.value.length <= 15) return appliedSearchQuery.value
  return appliedSearchQuery.value.substring(0, 15) + '...'
})

const virtualizer = useVirtualizer(
  computed(() => ({
    count: rowCount.value,
    getScrollElement: () => scrollRef.value,
    estimateSize: () => 22,
    overscan: 25,
  }))
)

const virtualRows = computed(() => virtualizer.value.getVirtualItems())
const totalSize = computed(() => virtualizer.value.getTotalSize())

function handleGlobalKeydown(e: KeyboardEvent) {
  const isF = e.code === 'KeyF' || e.key === 'f' || e.key === 'F'
  if ((e.ctrlKey || e.metaKey) && isF) {
    const rect = containerRef.value?.getBoundingClientRect()
    if (rect && rect.width > 0 && rect.height > 0) {
      e.preventDefault()
      if (showSearchBar.value) clearSearch()
      else {
        showSearchBar.value = true
        nextTick(() => {
          if (searchInputRef.value) {
            searchInputRef.value.focus()
            searchInputRef.value.select()
          }
        })
      }
    }
  }
}

function handleSearchEnter() {
  if (searchQuery.value.trim()) {
    appliedSearchQuery.value = searchQuery.value.trim()
    updateSearchResults()
    showSearchBar.value = true
    showLocalErrorPanel.value = false
    if (searchResults.value.length > 0) scrollToIndex(searchResults.value[0].lineIndex)
  }
}

function clearSearch() {
  searchQuery.value = ''
  appliedSearchQuery.value = ''
  searchResults.value = []
  searchIndex.value = -1
  showSearchBar.value = false
}

function handleCopy(e: ClipboardEvent) {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) return
  const selectedIndices: number[] = []
  const rowElements = document.querySelectorAll('.virtual-row')
  rowElements.forEach(row => {
    if (selection.containsNode(row, true)) {
      const idx = parseInt(row.getAttribute('data-index') || '-1')
      if (idx !== -1) selectedIndices.push(idx)
    }
  })
  if (selectedIndices.length > 0) {
    const min = Math.min(...selectedIndices)
    const max = Math.max(...selectedIndices)
    const logsText = []
    for (let i = min; i <= max; i++) if (props.file.lines[i]) logsText.push(props.file.lines[i])
    if (e.clipboardData && logsText.length > 0) {
      e.clipboardData.setData('text/plain', logsText.join('\n'))
      e.preventDefault()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('copy', handleCopy)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('copy', handleCopy)
})

function updateSearchResults() {
  const term = appliedSearchQuery.value
  if (!term) { searchResults.value = []; searchIndex.value = -1; return; }
  const queryLower = term.toLowerCase()
  const results: { lineIndex: number, text: string }[] = []
  for (let i = 0; i < props.file.lines.length; i++) {
    if (props.file.lines[i].toLowerCase().includes(queryLower)) {
      results.push({ lineIndex: i, text: props.file.lines[i] })
    }
  }
  searchResults.value = results
  searchIndex.value = results.length > 0 ? 0 : -1
}

function performLocalScan() {
  const results: { lineIndex: number, text: string, type: string }[] = []
  for (let i = 0; i < props.file.lines.length; i++) {
    const lowerLine = props.file.lines[i].toLowerCase()
    let type = ''
    if (lowerLine.includes('fatal exception')) type = 'CRASH'
    else if (lowerLine.includes('anr in')) type = 'ANR'
    else if (lowerLine.includes('caused by:')) type = 'CAUSE'
    if (type) results.push({ lineIndex: i, text: props.file.lines[i].trim(), type })
  }
  if (results.length > 0) {
    localErrorResults.value = results
    showLocalErrorPanel.value = true
    appliedSearchQuery.value = ''
    jumpToError(0)
  } else {
    showLocalErrorPanel.value = false
    ElMessage.info('未发现明显异常关键字')
  }
}

function jumpToError(idx: number) { errorIndex.value = idx; scrollToIndex(localErrorResults.value[idx].lineIndex) }
function scrollToIndex(idx: number) { virtualizer.value.scrollToIndex(idx, { align: 'center' }) }
function jumpToLine(resultIndex: number) { searchIndex.value = resultIndex; scrollToIndex(searchResults.value[resultIndex].lineIndex) }
function findNext() { if (searchResults.value.length === 0) return; searchIndex.value = (searchIndex.value + 1) % searchResults.value.length; scrollToIndex(searchResults.value[searchIndex.value].lineIndex) }
function findPrev() { if (searchResults.value.length === 0) return; searchIndex.value = (searchIndex.value - 1 + searchResults.value.length) % searchResults.value.length; scrollToIndex(searchResults.value[searchIndex.value].lineIndex) }

function highlightResultLine(text: string, query: string) {
  if (!text) return ''
  if (!query) return escapeHtml(text)
  const safeText = escapeHtml(text)
  const regex = new RegExp(`(${escapeRegExp(escapeHtml(query))})`, 'gi')
  return safeText.replace(regex, `<mark class="search-highlight">$1</mark>`)
}

function escapeHtml(unsafe: string) { return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function escapeRegExp(string: string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

async function startAIDiagnosis(provider: any) {
  if (errorIndex.value === -1 || localErrorResults.value.length === 0) { ElMessage.warning('请先选择一个错误点'); return; }
  const targetError = localErrorResults.value[errorIndex.value]
  isAnalyzing.value = true
  try {
    const start = Math.max(0, targetError.lineIndex - 50)
    const end = Math.min(props.file.lines.length, targetError.lineIndex + 51)
    const contextLogs = props.file.lines.slice(start, end).map((line, idx) => ({ id: start + idx, timestamp: '', pid: 0, tid: 0, level: 'E' as any, tag: 'Offline', message: line, deviceSerial: 'OfflineFile', raw: line }))
    const errorLog = contextLogs[targetError.lineIndex - start]
    currentDiagnosisContext = { errorLog, contextLogs }
    const result = await window.electronAPI.analysis.analyzeAI({ logs: contextLogs, context: `Local offline log.`, providerConfig: JSON.parse(JSON.stringify(provider)) })
    analysisResult.value = result
    showAnalysisDialog.value = true
  } catch (e: any) { ElMessage.error(e.message || 'AI 诊断失败') } finally { isAnalyzing.value = false }
}

function renderMarkdown(text: string) { return marked(text || '') }

async function exportDiagnosisPDF() {
  if (!analysisResult.value || !currentDiagnosisContext) return
  try {
    const filePath = await window.electronAPI.analysis.exportPDF(analysisResult.value.rawText, currentDiagnosisContext.errorLog, currentDiagnosisContext.contextLogs, configStore.fileSavePath)
    if (filePath) ElMessage.success(`报告已导出`)
  } catch (e: any) { ElMessage.error(`导出失败`) }
}
</script>

<style scoped>
.local-file-container { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; background: var(--bg-primary); overflow: hidden; outline: none; font-family: var(--font-sans); }
.local-file-header { display: flex; align-items: center; justify-content: space-between; padding: 0 20px 0 12px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); flex-shrink: 0; height: 44px; }
.file-info { display: flex; align-items: center; gap: 0; flex: 1; min-width: 0; }
.header-search-container { display: flex; align-items: center; gap: 12px; margin-left: 0; }
.header-search-status { display: flex; align-items: center; gap: 8px; background: var(--bg-surface); padding: 2px 4px 2px 12px; border-radius: 20px; border: 1px solid var(--border-color); }
.search-count-badge { font-size: 12px; font-family: var(--font-mono); color: var(--text-muted); display: flex; align-items: center; gap: 3px; }
.search-count-badge .curr { color: var(--text-primary); font-weight: 700; }
.header-search-nav { display: flex; align-items: center; gap: 2px; }
.nav-btn { background: transparent; border: none; color: var(--text-secondary); padding: 4px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.nav-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

.floating-action-btn { position: absolute; right: 24px; top: 16px; width: 38px; height: 38px; background: var(--success); color: var(--bg-primary); border: none; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 100; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4); transition: all 0.2s ease; }
.floating-action-btn:not(.close-action):hover { transform: translateY(-2px); filter: brightness(1.1); box-shadow: 0 6px 20px rgba(158, 206, 106, 0.4); }
.floating-action-btn .el-icon { font-size: 16px; font-weight: bold; }

/* Styling for the CLOSE state */
.floating-action-btn.close-action {
  background: #3b4261; /* Clearer, distinct color for close */
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.floating-action-btn.close-action:hover {
  background: var(--log-error);
  color: white;
  border-color: var(--log-error);
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 6px 20px rgba(247, 118, 142, 0.4);
}

.file-viewer-split { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; position: relative; }
.main-content-area { flex: 1; overflow-y: auto; overflow-x: auto; position: relative; min-height: 0; background: var(--bg-primary); outline: none; }

.virtual-row { display: flex; align-items: flex-start; font-family: var(--font-mono); font-size: 13px; line-height: 22px; color: var(--text-primary); padding: 0 16px; box-sizing: border-box; border-left: 3px solid transparent; }
.virtual-row:hover { background: var(--bg-hover); }

/* --- TWO HIGHLIGHT MODES --- */
/* GREEN for Search */
.virtual-row.search-highlight-row { 
  background: rgba(158, 206, 106, 0.15) !important; 
  border-left: 6px solid var(--success) !important;
  box-shadow: 0 0 15px rgba(158, 206, 106, 0.2);
  z-index: 10;
  animation: pulse-search 1.5s infinite;
}
.virtual-row.search-highlight-row .row-num { color: var(--success) !important; font-weight: 700; }

/* RED for Errors */
.virtual-row.error-highlight-row { 
  background: rgba(247, 118, 142, 0.1) !important; 
  border-left: 6px solid #ff4444 !important;
  box-shadow: 0 0 15px rgba(255, 68, 68, 0.2);
  z-index: 10;
  animation: pulse-danger-v2 1.2s infinite;
}
.virtual-row.error-highlight-row .row-num { color: #ff4444 !important; font-weight: 700; }

@keyframes pulse-search {
  0% { border-left-color: var(--success); filter: brightness(1); }
  50% { border-left-color: #b8e086; filter: brightness(1.2); }
  100% { border-left-color: var(--success); filter: brightness(1); }
}
@keyframes pulse-danger-v2 {
  0% { border-left-color: #ff4444; filter: brightness(1); }
  50% { border-left-color: #ff0000; filter: brightness(1.3); }
  100% { border-left-color: #ff4444; filter: brightness(1); }
}

.row-num { width: 60px; flex-shrink: 0; text-align: right; margin-right: 20px; color: var(--text-muted); user-select: none; border-right: 1px solid var(--border-color); padding-right: 12px; font-weight: 500; }
.row-text { flex: 1; white-space: pre; padding-left: 8px; user-select: text; }

.search-results-panel { flex-shrink: 0; border-top: 1px solid var(--border-color); background: var(--bg-secondary); display: flex; flex-direction: column; position: relative; min-height: 120px; }
.panel-resizer { position: absolute; top: -4px; left: 0; right: 0; height: 8px; cursor: ns-resize; z-index: 10; display: flex; align-items: center; justify-content: center; }
.resizer-knob { width: 40px; height: 4px; background: var(--border-color); border-radius: 2px; }

.results-header { padding: 8px 16px; background: var(--bg-surface); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
.results-header-title.danger-text { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: var(--log-error) !important; }
.results-header-title.danger-text .el-icon { font-size: 16px; color: var(--log-error) !important; }

.results-list { flex: 1; overflow-y: auto; user-select: text; padding: 4px 0; display: flex; flex-direction: column; }
.result-item { display: flex; align-items: baseline; padding: 6px 24px; font-family: var(--font-mono); font-size: 12px; cursor: default; }
.result-item:hover { background: var(--bg-hover); }
.result-item.current-result { background: var(--accent-soft); border-left: 2px solid var(--accent); }

.line-number { color: var(--accent); width: 65px; flex-shrink: 0; text-align: right; margin-right: 16px; cursor: pointer; opacity: 0.7; }
.line-text { color: var(--text-primary); white-space: pre-wrap; word-break: break-all; flex: 1; }

.error-tag { margin-right: 12px; min-width: 50px; text-align: center; }
.ai-result { line-height: 1.6; }
.markdown-body { font-size: 14px; color: var(--text-primary); background: var(--bg-surface); padding: 16px; border-radius: 8px; max-height: 450px; overflow-y: auto; }
:deep(.search-highlight) { background-color: var(--accent); color: var(--bg-primary); border-radius: 3px; padding: 0 2px; font-weight: 600; }
:deep(.el-input__wrapper) { background: var(--bg-primary) !important; box-shadow: none !important; border: 1px solid var(--border-color) !important; }
</style>