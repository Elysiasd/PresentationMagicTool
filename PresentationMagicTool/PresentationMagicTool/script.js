// 全局变量
let currentStyle = 'word'; // 当前界面风格
let importedContent = ''; // 导入的文档内容
let currentDisplayIndex = 0; // 当前显示的字符索引
let isTyping = false; // 是否正在输入状态
let currentFileType = 'plaintext'; // 当前文件类型
let currentFileName = ''; // 当前文件名
let lastHighlightedContent = ''; // 上次高亮的内容
let highlightCache = new Map(); // 高亮缓存

// 新功能变量
let autoPlayInterval = null; // 自动播放定时器
let isAutoPlaying = false; // 是否正在自动播放
let typingSpeed = 50; // 打字速度（毫秒）
let fileHistory = []; // 文件历史记录
let isEditMode = false; // 是否处于编辑模式
let editableElement = null; // 当前可编辑的元素

// DOM 元素
const wordInterface = document.getElementById('word-interface');
const vscodeInterface = document.getElementById('vscode-interface');
const documentContent = document.getElementById('document-content');
const codeContent = document.getElementById('code-content');
const lineNumbers = document.getElementById('line-numbers');
const charCount = document.getElementById('char-count');
const currentStyleSpan = document.getElementById('current-style');
const hiddenTextarea = document.getElementById('hidden-textarea');
const fileModal = document.getElementById('file-modal');
const fileInput = document.getElementById('file-input');
const filePreview = document.getElementById('file-preview');
const importBtn = document.getElementById('import-btn');
const cancelBtn = document.getElementById('cancel-btn');
const closeModal = document.getElementById('close-modal');

// 控制面板元素
const playBtn = document.getElementById('play-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const showAllBtn = document.getElementById('show-all-btn');
const speedSlider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');
const progressBar = document.getElementById('progress-bar');
const progressBarContainer = document.querySelector('.progress-bar-container');
const progressText = document.getElementById('progress-text');

// 历史面板元素
const historyPanel = document.getElementById('history-panel');
const historyToggle = document.getElementById('history-toggle');
const historyList = document.getElementById('history-list');

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // 绑定侧边栏菜单事件
    document.getElementById('import-file').addEventListener('click', openFileModal);
    document.getElementById('word-style').addEventListener('click', () => switchStyle('word'));
    document.getElementById('vscode-style').addEventListener('click', () => switchStyle('vscode'));
    
    // 绑定模态框事件
    fileInput.addEventListener('change', handleFileSelect);
    importBtn.addEventListener('click', importFile);
    cancelBtn.addEventListener('click', closeFileModal);
    closeModal.addEventListener('click', closeFileModal);
    
    // 点击模态框外部关闭
    fileModal.addEventListener('click', function(e) {
        if (e.target === fileModal) {
            closeFileModal();
        }
    });
    
    // 绑定键盘事件
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // 初始化隐藏输入框
    hiddenTextarea.addEventListener('input', handleTextInput);
    
    // 绑定控制面板事件
    playBtn.addEventListener('click', startAutoPlay);
    pauseBtn.addEventListener('click', pauseAutoPlay);
    resetBtn.addEventListener('click', resetDisplay);
    showAllBtn.addEventListener('click', showAllContent);
    speedSlider.addEventListener('input', updateSpeed);
    progressBarContainer.addEventListener('click', seekProgress);
    
    // 绑定历史面板事件
    historyToggle.addEventListener('click', toggleHistory);
    document.querySelector('.history-header').addEventListener('click', toggleHistory);
    
    // 绑定菜单按钮事件
    bindMenuButtons();
    
    // 加载历史记录
    loadHistory();
    
    // 设置初始状态
    updateStatus();
    updateMenuActiveState();
    updateControlButtons();
}

// 绑定菜单按钮事件
function bindMenuButtons() {
    // Word风格菜单
    const wordMenuBtns = document.querySelectorAll('.word-toolbar .toolbar-btn');
    wordMenuBtns.forEach((btn, index) => {
        if (index === 0) { // 文件
            btn.addEventListener('click', () => openReplaceFileDialog());
        } else if (index === 1) { // 编辑
            btn.addEventListener('click', () => toggleEditMode());
        }
    });
    
    // VSCode风格菜单
    const vscodeMenuItems = document.querySelectorAll('.vscode-menu .menu-item');
    vscodeMenuItems.forEach((item, index) => {
        if (index === 0) { // 文件
            item.addEventListener('click', () => openReplaceFileDialog());
        } else if (index === 1) { // 编辑
            item.addEventListener('click', () => toggleEditMode());
        }
    });
}

// 打开文件导入模态框
function openFileModal() {
    fileModal.style.display = 'block';
    fileInput.value = '';
    filePreview.textContent = '';
    importBtn.disabled = true;
    updateMenuActiveState('import-file');
}

// 关闭文件导入模态框
function closeFileModal() {
    fileModal.style.display = 'none';
    updateMenuActiveState();
}

// 处理文件选择
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const content = e.target.result;
            filePreview.textContent = content.substring(0, 500) + (content.length > 500 ? '...' : '');
            importBtn.disabled = false;
        };
        reader.readAsText(file, 'UTF-8');
    }
}

// 导入文件
function importFile() {
    const file = fileInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            importedContent = e.target.result;
            currentFileName = file.name;
            currentFileType = detectFileType(file.name);
            currentDisplayIndex = 0;
            
            // 清理缓存
            clearHighlightCache();
            
            // 保存到历史记录
            saveToHistory(currentFileName, importedContent, currentFileType);
            
            updateDisplay();
            updateStatus();
            updateControlButtons();
            closeFileModal();
            showNotification(`文件导入成功！检测到语言: ${getLanguageName(currentFileType)}`, 'success');
        };
        reader.readAsText(file, 'UTF-8');
    }
}

// 清理高亮缓存
function clearHighlightCache() {
    highlightCache.clear();
    lastHighlightedContent = '';
}

// 切换界面风格
function switchStyle(style) {
    currentStyle = style;
    
    if (style === 'word') {
        wordInterface.style.display = 'flex';
        vscodeInterface.style.display = 'none';
    } else {
        wordInterface.style.display = 'none';
        vscodeInterface.style.display = 'flex';
    }
    
    updateDisplay();
    updateStatus();
    updateMenuActiveState();
}

// 更新显示内容
function updateDisplay() {
    if (!importedContent) {
        const placeholder = '请导入文本文件开始演示...';
        documentContent.innerHTML = `<p>${placeholder}</p>`;
        codeContent.innerHTML = `<pre><code class="language-plaintext">${placeholder}</code></pre>`;
        updateLineNumbers('');
        return;
    }
    
    const displayContent = importedContent.substring(0, currentDisplayIndex);
    
    if (currentStyle === 'word') {
        updateWordDisplay(displayContent);
    } else {
        updateVSCodeDisplay(displayContent);
    }
}

// 更新Word风格显示
function updateWordDisplay(content) {
    // 将内容按段落分割
    const paragraphs = content.split('\n').filter(p => p.trim() !== '');
    if (paragraphs.length === 0) {
        documentContent.innerHTML = '<p></p>';
        return;
    }
    
    const html = paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('');
    documentContent.innerHTML = html;
}

// 更新VSCode风格显示
function updateVSCodeDisplay(content) {
    // 如果内容为空，显示占位符
    if (!content) {
        codeContent.innerHTML = `<pre><code class="language-plaintext">请导入文本文件开始演示...</code></pre>`;
        updateLineNumbers('');
        lastHighlightedContent = '';
        return;
    }
    
    // 检查缓存
    const cacheKey = `${currentFileType}-${content.length}`;
    if (highlightCache.has(cacheKey)) {
        const cachedResult = highlightCache.get(cacheKey);
        codeContent.innerHTML = `<pre><code class="language-${currentFileType}">${cachedResult}</code></pre>`;
        updateLineNumbers(content);
        return;
    }
    
    // 对于代码高亮，我们需要特殊处理
    let highlightedCode;
    
    if (currentFileType === 'plaintext' || currentFileType === 'markdown') {
        // 对于纯文本和Markdown，直接显示内容
        highlightedCode = escapeHtml(content);
    } else {
        // 对于代码文件，使用优化的高亮策略
        highlightedCode = getOptimizedHighlight(content);
    }
    
    // 缓存结果
    highlightCache.set(cacheKey, highlightedCode);
    
    // 更新代码内容
    codeContent.innerHTML = `<pre><code class="language-${currentFileType}">${highlightedCode}</code></pre>`;
    
    // 更新行号
    updateLineNumbers(content);
    lastHighlightedContent = content;
}

// 优化的高亮策略
function getOptimizedHighlight(content) {
    try {
        // 策略1: 尝试完整内容高亮
        if (content.length > 10) {
            const completeContent = ensureCompleteSyntax(content);
            return Prism.highlight(completeContent, Prism.languages[currentFileType] || Prism.languages.plaintext, currentFileType);
        }
        
        // 策略2: 对于短内容，使用简单高亮
        return getSimpleHighlight(content);
        
    } catch (error) {
        // 策略3: 如果高亮失败，回退到转义显示
        return escapeHtml(content);
    }
}

// 简单高亮策略（用于短内容）
function getSimpleHighlight(content) {
    // 对于短内容，手动添加一些基本的高亮
    let result = escapeHtml(content);
    
    // 添加关键字高亮
    const keywords = getKeywordsForLanguage(currentFileType);
    keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        result = result.replace(regex, `<span class="token keyword">${keyword}</span>`);
    });
    
    // 添加字符串高亮
    result = result.replace(/(["'`])([^"'`]*?)\1/g, '<span class="token string">$1$2$1</span>');
    
    // 添加注释高亮
    result = result.replace(/(\/\/.*$)/gm, '<span class="token comment">$1</span>');
    result = result.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="token comment">$1</span>');
    
    return result;
}

// 获取不同语言的关键字
function getKeywordsForLanguage(language) {
    const keywordMap = {
        'javascript': ['function', 'var', 'let', 'const', 'if', 'else', 'for', 'while', 'return', 'true', 'false', 'null', 'undefined'],
        'typescript': ['function', 'var', 'let', 'const', 'if', 'else', 'for', 'while', 'return', 'true', 'false', 'null', 'undefined', 'interface', 'type', 'class'],
        'python': ['def', 'if', 'else', 'elif', 'for', 'while', 'return', 'True', 'False', 'None', 'class', 'import', 'from'],
        'java': ['public', 'private', 'protected', 'class', 'interface', 'if', 'else', 'for', 'while', 'return', 'true', 'false', 'null'],
        'cpp': ['if', 'else', 'for', 'while', 'return', 'true', 'false', 'nullptr', 'class', 'struct', 'public', 'private'],
        'c': ['if', 'else', 'for', 'while', 'return', 'true', 'false', 'NULL', 'struct'],
        'html': ['html', 'head', 'body', 'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img', 'ul', 'ol', 'li'],
        'css': ['color', 'background', 'margin', 'padding', 'border', 'width', 'height', 'display', 'position', 'float']
    };
    
    return keywordMap[language] || [];
}

// 确保语法完整性，避免高亮错误
function ensureCompleteSyntax(content) {
    if (!content) return '';
    
    // 根据文件类型进行语法补全
    switch (currentFileType) {
        case 'javascript':
        case 'typescript':
        case 'jsx':
        case 'tsx':
            return ensureJavaScriptSyntax(content);
        case 'python':
            return ensurePythonSyntax(content);
        case 'html':
            return ensureHtmlSyntax(content);
        case 'css':
            return ensureCssSyntax(content);
        case 'json':
            return ensureJsonSyntax(content);
        default:
            return content;
    }
}

// JavaScript/TypeScript语法补全
function ensureJavaScriptSyntax(content) {
    let result = content;
    
    // 如果以未闭合的字符串结尾，补全引号
    const stringRegex = /(["'`])([^"'`]*)$/;
    const match = result.match(stringRegex);
    if (match && !match[0].endsWith(match[1])) {
        result += match[1];
    }
    
    // 如果以未闭合的括号结尾，补全括号
    const openBraces = (result.match(/\{/g) || []).length;
    const closeBraces = (result.match(/\}/g) || []).length;
    if (openBraces > closeBraces) {
        result += '}'.repeat(openBraces - closeBraces);
    }
    
    const openParens = (result.match(/\(/g) || []).length;
    const closeParens = (result.match(/\)/g) || []).length;
    if (openParens > closeParens) {
        result += ')'.repeat(openParens - closeParens);
    }
    
    const openBrackets = (result.match(/\[/g) || []).length;
    const closeBrackets = (result.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
        result += ']'.repeat(openBrackets - closeBrackets);
    }
    
    return result;
}

// Python语法补全
function ensurePythonSyntax(content) {
    let result = content;
    
    // 如果以未闭合的字符串结尾，补全引号
    const stringRegex = /(["'])([^"']*)$/;
    const match = result.match(stringRegex);
    if (match && !match[0].endsWith(match[1])) {
        result += match[1];
    }
    
    // 如果以未闭合的括号结尾，补全括号
    const openParens = (result.match(/\(/g) || []).length;
    const closeParens = (result.match(/\)/g) || []).length;
    if (openParens > closeParens) {
        result += ')'.repeat(openParens - closeParens);
    }
    
    return result;
}

// HTML语法补全
function ensureHtmlSyntax(content) {
    let result = content;
    
    // 如果以未闭合的标签结尾，补全标签
    const tagRegex = /<(\w+)([^>]*)$/;
    const match = result.match(tagRegex);
    if (match) {
        result += '>';
    }
    
    return result;
}

// CSS语法补全
function ensureCssSyntax(content) {
    let result = content;
    
    // 如果以未闭合的大括号结尾，补全大括号
    const openBraces = (result.match(/\{/g) || []).length;
    const closeBraces = (result.match(/\}/g) || []).length;
    if (openBraces > closeBraces) {
        result += '}'.repeat(openBraces - closeBraces);
    }
    
    return result;
}

// JSON语法补全
function ensureJsonSyntax(content) {
    let result = content;
    
    // 如果以未闭合的字符串结尾，补全引号
    const stringRegex = /"([^"]*)$/;
    const match = result.match(stringRegex);
    if (match) {
        result += '"';
    }
    
    // 如果以未闭合的大括号结尾，补全大括号
    const openBraces = (result.match(/\{/g) || []).length;
    const closeBraces = (result.match(/\}/g) || []).length;
    if (openBraces > closeBraces) {
        result += '}'.repeat(openBraces - closeBraces);
    }
    
    return result;
}

// 更新行号
function updateLineNumbers(content) {
    const lines = content.split('\n');
    const lineCount = lines.length;
    
    // 确保至少有一行
    if (lineCount === 0) {
        lineNumbers.textContent = '1';
        return;
    }
    
    // 生成行号，每行一个数字
    const lineNumbersArray = [];
    for (let i = 1; i <= lineCount; i++) {
        lineNumbersArray.push(i);
    }
    
    lineNumbers.textContent = lineNumbersArray.join('\n');
}

// 处理键盘按下事件
function handleKeyDown(event) {
    // 如果处于编辑模式，不拦截键盘事件
    if (isEditMode) {
        return;
    }
    
    // 如果按的是特殊键（如Ctrl, Alt, Shift等），不处理
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
        return;
    }
    
    // 如果按的是功能键，不处理
    if (event.key.length > 1 && !['Backspace', 'Delete', 'Enter'].includes(event.key)) {
        return;
    }
    
    if (!isTyping) {
        isTyping = true;
        hiddenTextarea.focus();
    }
    
    // 根据按键类型处理
    if (event.key === 'Backspace') {
        if (currentDisplayIndex > 0) {
            currentDisplayIndex--;
            updateDisplay();
            updateStatus();
        }
        event.preventDefault();
    } else if (event.key === 'Delete') {
        // Delete键不减少显示内容，保持当前状态
        event.preventDefault();
    } else if (event.key === 'Enter') {
        if (currentDisplayIndex < importedContent.length) {
            currentDisplayIndex++;
            updateDisplay();
            updateStatus();
        }
        event.preventDefault();
    } else if (event.key.length === 1) {
        // 普通字符
        if (currentDisplayIndex < importedContent.length) {
            currentDisplayIndex++;
            updateDisplay();
            updateStatus();
        }
        event.preventDefault();
    }
}

// 处理键盘释放事件
function handleKeyUp(event) {
    // 可以在这里添加一些键盘释放后的处理逻辑
}

// 处理文本输入（备用方案）
function handleTextInput(event) {
    const inputValue = event.target.value;
    if (inputValue.length > currentDisplayIndex) {
        currentDisplayIndex = Math.min(inputValue.length, importedContent.length);
        updateDisplay();
        updateStatus();
    }
    event.target.value = '';
}

// 更新状态信息
function updateStatus() {
    charCount.textContent = `字符数: ${currentDisplayIndex}`;
    const styleName = currentStyle === 'word' ? 'Word' : 'VSCode';
    const languageName = currentFileName ? getLanguageName(currentFileType) : '';
    currentStyleSpan.textContent = `当前风格: ${styleName}${languageName ? ` | 语言: ${languageName}` : ''}`;
    updateProgressBar();
}

// 更新进度条
function updateProgressBar() {
    if (importedContent.length === 0) {
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        return;
    }
    
    const progress = (currentDisplayIndex / importedContent.length) * 100;
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${Math.round(progress)}%`;
}

// 更新控制按钮状态
function updateControlButtons() {
    const hasContent = importedContent.length > 0;
    const isComplete = currentDisplayIndex >= importedContent.length;
    
    playBtn.disabled = !hasContent || isComplete || isAutoPlaying;
    pauseBtn.disabled = !isAutoPlaying;
    resetBtn.disabled = !hasContent || (currentDisplayIndex === 0 && !isAutoPlaying);
    showAllBtn.disabled = !hasContent || isComplete;
    
    if (isAutoPlaying) {
        playBtn.classList.add('active');
    } else {
        playBtn.classList.remove('active');
    }
}

// 开始自动播放
function startAutoPlay() {
    if (!importedContent || isAutoPlaying || currentDisplayIndex >= importedContent.length) {
        return;
    }
    
    isAutoPlaying = true;
    updateControlButtons();
    
    autoPlayInterval = setInterval(() => {
        if (currentDisplayIndex < importedContent.length) {
            currentDisplayIndex++;
            updateDisplay();
            updateStatus();
            updateControlButtons();
        } else {
            stopAutoPlay();
            showNotification('演示完成！', 'success');
        }
    }, typingSpeed);
}

// 暂停自动播放
function pauseAutoPlay() {
    stopAutoPlay();
    showNotification('已暂停', 'info');
}

// 停止自动播放
function stopAutoPlay() {
    if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
        autoPlayInterval = null;
    }
    isAutoPlaying = false;
    updateControlButtons();
}

// 重置显示
function resetDisplay() {
    stopAutoPlay();
    currentDisplayIndex = 0;
    clearHighlightCache();
    updateDisplay();
    updateStatus();
    updateControlButtons();
    showNotification('已重置', 'info');
}

// 显示全部内容
function showAllContent() {
    stopAutoPlay();
    currentDisplayIndex = importedContent.length;
    updateDisplay();
    updateStatus();
    updateControlButtons();
    showNotification('已显示全部内容', 'success');
}

// 更新速度
function updateSpeed() {
    typingSpeed = 201 - parseInt(speedSlider.value);
    speedValue.textContent = speedSlider.value;
    
    // 如果正在播放，重新启动以应用新速度
    if (isAutoPlaying) {
        stopAutoPlay();
        startAutoPlay();
    }
}

// 进度条跳转
function seekProgress(event) {
    if (!importedContent) return;
    
    const rect = progressBarContainer.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    
    stopAutoPlay();
    currentDisplayIndex = Math.floor(importedContent.length * percentage);
    clearHighlightCache();
    updateDisplay();
    updateStatus();
    updateControlButtons();
}

// 切换历史面板
function toggleHistory() {
    historyPanel.classList.toggle('expanded');
}

// 保存到历史记录
function saveToHistory(fileName, content, fileType) {
    const historyItem = {
        fileName: fileName,
        content: content,
        fileType: fileType,
        timestamp: Date.now()
    };
    
    // 移除重复的文件
    fileHistory = fileHistory.filter(item => item.fileName !== fileName);
    
    // 添加到开头
    fileHistory.unshift(historyItem);
    
    // 限制历史记录数量
    if (fileHistory.length > 10) {
        fileHistory = fileHistory.slice(0, 10);
    }
    
    // 保存到 localStorage
    try {
        localStorage.setItem('fileHistory', JSON.stringify(fileHistory));
    } catch (e) {
        console.warn('无法保存历史记录:', e);
    }
    
    updateHistoryDisplay();
}

// 加载历史记录
function loadHistory() {
    try {
        const saved = localStorage.getItem('fileHistory');
        if (saved) {
            fileHistory = JSON.parse(saved);
            updateHistoryDisplay();
        }
    } catch (e) {
        console.warn('无法加载历史记录:', e);
        fileHistory = [];
    }
}

// 更新历史记录显示
function updateHistoryDisplay() {
    historyList.innerHTML = '';
    
    if (fileHistory.length === 0) {
        historyList.innerHTML = '<div style="padding: 10px; text-align: center; color: #6c757d;">暂无历史记录</div>';
        return;
    }
    
    fileHistory.forEach((item, index) => {
        const historyItemDiv = document.createElement('div');
        historyItemDiv.className = 'history-item';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'history-item-name';
        nameSpan.textContent = item.fileName;
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'history-item-time';
        timeSpan.textContent = formatTime(item.timestamp);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'history-item-delete';
        deleteBtn.textContent = '×';
        deleteBtn.title = '删除';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteHistoryItem(index);
        };
        
        historyItemDiv.appendChild(nameSpan);
        historyItemDiv.appendChild(timeSpan);
        historyItemDiv.appendChild(deleteBtn);
        
        historyItemDiv.onclick = () => loadHistoryItem(item);
        
        historyList.appendChild(historyItemDiv);
    });
}

// 加载历史记录项
function loadHistoryItem(item) {
    importedContent = item.content;
    currentFileName = item.fileName;
    currentFileType = item.fileType;
    currentDisplayIndex = 0;
    
    stopAutoPlay();
    clearHighlightCache();
    updateDisplay();
    updateStatus();
    updateControlButtons();
    
    showNotification(`已加载: ${item.fileName}`, 'success');
}

// 删除历史记录项
function deleteHistoryItem(index) {
    fileHistory.splice(index, 1);
    try {
        localStorage.setItem('fileHistory', JSON.stringify(fileHistory));
    } catch (e) {
        console.warn('无法保存历史记录:', e);
    }
    updateHistoryDisplay();
    showNotification('已删除', 'info');
}

// 格式化时间
function formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    
    if (diff < minute) {
        return '刚刚';
    } else if (diff < hour) {
        return `${Math.floor(diff / minute)}分钟前`;
    } else if (diff < day) {
        return `${Math.floor(diff / hour)}小时前`;
    } else {
        const date = new Date(timestamp);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }
}

// 更新菜单激活状态
function updateMenuActiveState(activeId = null) {
    // 清除所有激活状态
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // 设置当前激活项
    if (activeId) {
        document.getElementById(activeId).classList.add('active');
    } else {
        // 根据当前风格设置激活状态
        if (currentStyle === 'word') {
            document.getElementById('word-style').classList.add('active');
        } else {
            document.getElementById('vscode-style').classList.add('active');
        }
    }
}

// 检测文件类型
function detectFileType(fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    
    const typeMap = {
        'js': 'javascript',
        'jsx': 'jsx',
        'ts': 'typescript',
        'tsx': 'tsx',
        'py': 'python',
        'java': 'java',
        'cpp': 'cpp',
        'c': 'c',
        'cs': 'csharp',
        'php': 'php',
        'rb': 'ruby',
        'go': 'go',
        'rs': 'rust',
        'swift': 'swift',
        'kt': 'kotlin',
        'scala': 'scala',
        'html': 'html',
        'htm': 'html',
        'css': 'css',
        'scss': 'scss',
        'sass': 'sass',
        'less': 'less',
        'json': 'json',
        'xml': 'xml',
        'yaml': 'yaml',
        'yml': 'yaml',
        'sql': 'sql',
        'sh': 'bash',
        'bash': 'bash',
        'ps1': 'powershell',
        'md': 'markdown',
        'txt': 'plaintext',
        'csv': 'csv',
        'ini': 'ini',
        'conf': 'ini',
        'dockerfile': 'dockerfile',
        'vue': 'vue',
        'svelte': 'svelte'
    };
    
    return typeMap[extension] || 'plaintext';
}

// 获取语言显示名称
function getLanguageName(type) {
    const nameMap = {
        'javascript': 'JavaScript',
        'jsx': 'JSX',
        'typescript': 'TypeScript',
        'tsx': 'TSX',
        'python': 'Python',
        'java': 'Java',
        'cpp': 'C++',
        'c': 'C',
        'csharp': 'C#',
        'php': 'PHP',
        'ruby': 'Ruby',
        'go': 'Go',
        'rust': 'Rust',
        'swift': 'Swift',
        'kotlin': 'Kotlin',
        'scala': 'Scala',
        'html': 'HTML',
        'css': 'CSS',
        'scss': 'SCSS',
        'sass': 'Sass',
        'less': 'Less',
        'json': 'JSON',
        'xml': 'XML',
        'yaml': 'YAML',
        'sql': 'SQL',
        'bash': 'Bash',
        'powershell': 'PowerShell',
        'markdown': 'Markdown',
        'plaintext': '纯文本',
        'csv': 'CSV',
        'ini': 'INI',
        'dockerfile': 'Dockerfile',
        'vue': 'Vue',
        'svelte': 'Svelte'
    };
    
    return nameMap[type] || '未知';
}

// HTML转义函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 显示通知
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // 添加样式
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        z-index: 1001;
        animation: slideInRight 0.3s ease-out;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    // 根据类型设置背景色
    if (type === 'success') {
        notification.style.backgroundColor = '#28a745';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#dc3545';
    } else {
        notification.style.backgroundColor = '#17a2b8';
    }
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 添加拖拽文件支持
document.addEventListener('dragover', function(e) {
    e.preventDefault();
});

document.addEventListener('drop', function(e) {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('text/') || 
            file.name.endsWith('.md') || 
            file.name.endsWith('.js') || 
            file.name.endsWith('.html') || 
            file.name.endsWith('.css') || 
            file.name.endsWith('.py') || 
            file.name.endsWith('.java') || 
            file.name.endsWith('.cpp') || 
            file.name.endsWith('.c') || 
            file.name.endsWith('.json') || 
            file.name.endsWith('.xml') || 
            file.name.endsWith('.csv')) {
            
            const reader = new FileReader();
            reader.onload = function(e) {
                importedContent = e.target.result;
                currentFileName = file.name;
                currentFileType = detectFileType(file.name);
                currentDisplayIndex = 0;
                
                // 清理缓存
                clearHighlightCache();
                
                // 保存到历史记录
                saveToHistory(currentFileName, importedContent, currentFileType);
                
                updateDisplay();
                updateStatus();
                updateControlButtons();
                showNotification(`文件导入成功！检测到语言: ${getLanguageName(currentFileType)}`, 'success');
            };
            reader.readAsText(file, 'UTF-8');
        } else {
            showNotification('请选择文本文件！', 'error');
        }
    }
});

// 添加键盘快捷键支持
document.addEventListener('keydown', function(e) {
    // Ctrl+O 打开文件
    if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        openFileModal();
    }
    
    // Ctrl+1 切换到Word风格
    if (e.ctrlKey && e.key === '1') {
        e.preventDefault();
        switchStyle('word');
    }
    
    // Ctrl+2 切换到VSCode风格
    if (e.ctrlKey && e.key === '2') {
        e.preventDefault();
        switchStyle('vscode');
    }
    
    // Ctrl+R 重置显示
    if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        currentDisplayIndex = 0;
        updateDisplay();
        updateStatus();
        showNotification('显示已重置', 'info');
    }
    
    // Ctrl+A 显示全部内容
    if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        currentDisplayIndex = importedContent.length;
        updateDisplay();
        updateStatus();
        showNotification('显示全部内容', 'info');
    }
});

// ==================== 文件替换功能 ====================

// 打开文件替换对话框
function openReplaceFileDialog() {
    if (!importedContent) {
        showNotification('请先导入一个文件', 'warning');
        openFileModal();
        return;
    }
    
    // 创建文件输入元素
    const replaceInput = document.createElement('input');
    replaceInput.type = 'file';
    replaceInput.accept = '.txt,.md,.js,.html,.css,.py,.java,.cpp,.c,.json,.xml,.csv';
    
    replaceInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                replaceFile(e.target.result, file.name);
            };
            reader.readAsText(file, 'UTF-8');
        }
    });
    
    replaceInput.click();
}

// 替换文件（保留当前显示字符数）
function replaceFile(newContent, newFileName) {
    // 保存当前显示的字符数量
    const currentCharCount = currentDisplayIndex;
    
    // 停止自动播放
    stopAutoPlay();
    
    // 更新内容
    importedContent = newContent;
    currentFileName = newFileName;
    currentFileType = detectFileType(newFileName);
    
    // 保留相同的字符数量（如果新文件更短，则显示全部）
    currentDisplayIndex = Math.min(currentCharCount, importedContent.length);
    
    // 清理缓存
    clearHighlightCache();
    
    // 保存到历史记录
    saveToHistory(currentFileName, importedContent, currentFileType);
    
    // 更新显示
    updateDisplay();
    updateStatus();
    updateControlButtons();
    
    showNotification(`文件已替换！保留了前 ${currentDisplayIndex} 个字符`, 'success');
}

// ==================== 编辑模式功能 ====================

// 切换编辑模式
function toggleEditMode() {
    if (!importedContent) {
        showNotification('请先导入一个文件', 'warning');
        return;
    }
    
    if (isEditMode) {
        exitEditMode();
    } else {
        enterEditMode();
    }
}

// 进入编辑模式
function enterEditMode() {
    isEditMode = true;
    
    // 停止自动播放
    stopAutoPlay();
    
    // 先显示全部内容
    currentDisplayIndex = importedContent.length;
    
    if (currentStyle === 'word') {
        enterWordEditMode();
    } else {
        enterVSCodeEditMode();
    }
    
    showNotification('已进入编辑模式，可以直接修改文本', 'info');
}

// Word风格编辑模式
function enterWordEditMode() {
    // 使文档内容可编辑
    documentContent.contentEditable = true;
    documentContent.style.cursor = 'text';
    documentContent.style.outline = '2px solid #4a90e2';
    documentContent.style.outlineOffset = '2px';
    
    // 显示全部内容（转义后的HTML）
    const paragraphs = importedContent.split('\n').filter(p => p.trim() !== '');
    if (paragraphs.length === 0) {
        documentContent.innerHTML = '<p><br></p>';
    } else {
        const html = paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('');
        documentContent.innerHTML = html;
    }
    
    editableElement = documentContent;
    documentContent.focus();
    
    // 绑定输入事件
    documentContent.addEventListener('input', handleEditInput);
}

// VSCode风格编辑模式
function enterVSCodeEditMode() {
    // 使代码内容可编辑
    codeContent.contentEditable = true;
    codeContent.style.cursor = 'text';
    codeContent.style.outline = '2px solid #007acc';
    codeContent.style.outlineOffset = '2px';
    
    // 显示全部内容（纯文本）
    codeContent.innerHTML = `<pre><code class="language-${currentFileType}">${escapeHtml(importedContent)}</code></pre>`;
    
    editableElement = codeContent;
    codeContent.focus();
    
    // 绑定输入事件
    codeContent.addEventListener('input', handleEditInput);
}

// 处理编辑输入
function handleEditInput() {
    if (!isEditMode) return;
    
    // 获取当前编辑的文本
    let editedText;
    if (currentStyle === 'word') {
        // Word风格：从段落中提取文本
        const paragraphs = Array.from(documentContent.querySelectorAll('p'));
        editedText = paragraphs.map(p => p.textContent).join('\n');
    } else {
        // VSCode风格：从code元素中提取文本
        const codeElement = codeContent.querySelector('code');
        editedText = codeElement ? codeElement.textContent : codeContent.textContent;
    }
    
    // 更新导入的内容
    importedContent = editedText;
    currentDisplayIndex = importedContent.length;
    
    // 更新状态
    updateStatus();
}

// 退出编辑模式
function exitEditMode() {
    // 先同步编辑的内容
    syncEditedContent();
    
    isEditMode = false;
    
    if (currentStyle === 'word') {
        exitWordEditMode();
    } else {
        exitVSCodeEditMode();
    }
    
    // 保存修改后的内容到历史记录
    if (currentFileName) {
        saveToHistory(currentFileName, importedContent, currentFileType);
    }
    
    // 重新显示（应用语法高亮等）
    clearHighlightCache();
    updateDisplay();
    updateStatus();
    
    showNotification('已退出编辑模式，内容已保存', 'success');
}

// 同步编辑的内容
function syncEditedContent() {
    if (!isEditMode) return;
    
    // 获取当前编辑的文本
    let editedText;
    if (currentStyle === 'word') {
        // Word风格：从段落中提取文本
        const paragraphs = Array.from(documentContent.querySelectorAll('p'));
        editedText = paragraphs.map(p => p.textContent).join('\n');
    } else {
        // VSCode风格：从code元素中提取文本
        const codeElement = codeContent.querySelector('code');
        editedText = codeElement ? codeElement.textContent : codeContent.textContent;
    }
    
    // 更新导入的内容
    importedContent = editedText;
    currentDisplayIndex = importedContent.length;
}

// 退出Word编辑模式
function exitWordEditMode() {
    documentContent.contentEditable = false;
    documentContent.style.cursor = 'default';
    documentContent.style.outline = 'none';
    
    // 移除输入事件监听
    documentContent.removeEventListener('input', handleEditInput);
    editableElement = null;
}

// 退出VSCode编辑模式
function exitVSCodeEditMode() {
    codeContent.contentEditable = false;
    codeContent.style.cursor = 'default';
    codeContent.style.outline = 'none';
    
    // 移除输入事件监听
    codeContent.removeEventListener('input', handleEditInput);
    editableElement = null;
}
