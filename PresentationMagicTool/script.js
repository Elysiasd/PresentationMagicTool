// 全局变量
let currentStyle = 'word'; // 当前界面风格
let importedContent = ''; // 导入的文档内容
let currentDisplayIndex = 0; // 当前显示的字符索引
let isTyping = false; // 是否正在输入状态
let currentFileType = 'plaintext'; // 当前文件类型
let currentFileName = ''; // 当前文件名
let lastHighlightedContent = ''; // 上次高亮的内容
let highlightCache = new Map(); // 高亮缓存

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
    
    // 设置初始状态
    updateStatus();
    updateMenuActiveState();
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
            
            updateDisplay();
            updateStatus();
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
                
                updateDisplay();
                updateStatus();
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
