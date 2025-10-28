#include <windows.h>
#include <commctrl.h>
#include <commdlg.h>
#include <string>
#include <fstream>
#include <sstream>
#include <vector>
#include <map>
#include <thread>
#include <chrono>
#include <algorithm>
#include <dwmapi.h>
#include <wingdi.h>
#include <shellapi.h>
#include <richedit.h>

#pragma comment(lib, "comctl32.lib")
#pragma comment(lib, "comdlg32.lib")
#pragma comment(lib, "dwmapi.lib")
#pragma comment(lib, "Msimg32.lib")

// 现代化颜色方案（保留旧色，新增与网页一致的配色）
#define MODERN_BG RGB(18, 18, 18)           // 深色背景
#define MODERN_CARD RGB(28, 28, 30)         // 卡片背景
#define MODERN_BORDER RGB(60, 60, 60)       // 边框
#define MODERN_PRIMARY RGB(86, 156, 214)     // VSCode 风格主色调蓝色 #569cd6
#define MODERN_SUCCESS RGB(52, 199, 89)     // 成功绿色
#define MODERN_WARNING RGB(255, 149, 0)    // 警告橙色
#define MODERN_ERROR RGB(255, 59, 48)       // 错误红色
#define MODERN_TEXT_PRIMARY RGB(255, 255, 255)   // 主要文字
#define MODERN_TEXT_SECONDARY RGB(174, 174, 178) // 次要文字
#define MODERN_TEXT_TERTIARY RGB(99, 99, 102)   // 第三级文字

// 与网页 styles.css 对齐的色板
#define COLOR_SIDEBAR_TOP RGB(102, 126, 234)    // #667eea
#define COLOR_SIDEBAR_BOTTOM RGB(118, 75, 162)  // #764ba2
#define COLOR_HEADER_BG RGB(248, 249, 250)      // #f8f9fa
#define COLOR_HEADER_BORDER RGB(233, 236, 239)  // #e9ecef
#define COLOR_MAIN_WHITE RGB(255, 255, 255)
#define COLOR_TEXT_DARK RGB(73, 80, 87)         // #495057
#define COLOR_TEXT_MUTED RGB(108, 117, 125)     // #6c757d
#define COLOR_VSCODE_BG RGB(30, 30, 30)         // #1e1e1e
#define COLOR_VSCODE_TOOLBAR RGB(45, 45, 48)    // #2d2d30
#define COLOR_VSCODE_BORDER RGB(62, 62, 66)     // #3e3e42
#define COLOR_PRIMARY RGB(102, 126, 234)        // 侧栏主色

// 窗口控件ID
#define ID_BUTTON_OPEN 1001
#define ID_BUTTON_WORD 1002
#define ID_BUTTON_VSCODE 1003
#define ID_EDIT_CONTENT 1008
#define ID_STATIC_STATUS 1009
#define ID_STATIC_FILE 1010
#define ID_TIMER_TYPING 1011
#define ID_STATIC_TITLE 1012
#define ID_PROGRESS_BAR 1013
#define ID_STATIC_PROGRESS 1014
#define ID_BUTTON_WEB 1015
// 新增：侧栏“运行程序”菜单
#define ID_MENU_RUN 1104
// 自定义消息：更新行号
#define WM_APP_UPDATE_LINENUM (WM_APP + 1)
#define ID_TIMER_ANIM 1020

class ModernPresentationTool {
private:
    HWND hMainWnd;
    HMODULE hMsftedit;
    // 侧栏与 Header
    HWND hSidebarHeader; // 左侧标题 “演示神器”
    // Word 风格面板
    HWND hPanelWord;
    HWND hEditWord;
    // VSCode 风格面板
    HWND hPanelVSCode;
    HWND hLineNumbers;
    HWND hEditCode;
    HWND hStaticStatus;
    HWND hStaticFile;
    // 侧栏菜单按钮（复用旧变量名以兼容逻辑）
    HWND hButtonOpen;    // 📁 导入
    HWND hButtonWord;    // 📄 Word 风格
    HWND hButtonVSCode;  // 💻 VSCode 风格
    HWND hButtonRun;     // ▶ 运行程序
    HWND hProgressBar;
    HWND hStaticProgress;
    HWND hButtonWeb;
    
    std::wstring currentContent;   // UTF-16 存储，保证中文显示
    std::wstring currentFile;
    std::wstring currentStyle;     // L"word" / L"vscode"
    size_t currentCharIndex;
    bool isTyping;
    bool isPaused;
    
    // 现代化资源
    HFONT hTitleFont;
    HFONT hButtonFont;
    HFONT hContentFont;
    HFONT hCodeFont;
    HFONT hStatusFont;
    HFONT hProgressFont;
    
    HBRUSH hModernBgBrush;
    HBRUSH hModernCardBrush;
    HPEN hModernBorderPen;
    HPEN hModernPrimaryPen;
    // 新配色画刷/画笔
    HBRUSH hBrushHeaderBG;
    HBRUSH hBrushMainWhite;
    HBRUSH hBrushVSCodeBG;
    HPEN hPenHeaderBorder;
    HPEN hPenVSCodeBorder;
    HPEN hPenPrimary;
    HBRUSH hBrushVSCodeBorder;
    // 动画状态
    int animTick = 0;
    // 子控件子类化需要
    static LRESULT CALLBACK EditSubclassProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam, UINT_PTR uIdSubclass, DWORD_PTR dwRefData) {
        ModernPresentationTool* pThis = reinterpret_cast<ModernPresentationTool*>(dwRefData);
        if (!pThis) return DefSubclassProc(hwnd, uMsg, wParam, lParam);
        switch (uMsg) {
            case WM_KEYDOWN:
            case WM_CHAR:
                // 把键盘事件转发到主窗口，让键盘驱动逻辑生效
                PostMessageW(pThis->hMainWnd, uMsg, wParam, lParam);
                return 0;
            case WM_VSCROLL:
            case WM_MOUSEWHEEL:
                // 让控件先处理滚动，然后请求主窗口更新行号同步
                {
                    LRESULT r = DefSubclassProc(hwnd, uMsg, wParam, lParam);
                    PostMessageW(pThis->hMainWnd, WM_APP_UPDATE_LINENUM, 0, 0);
                    return r;
                }
        }
        return DefSubclassProc(hwnd, uMsg, wParam, lParam);
    }
    
    // 语言映射
    std::map<std::wstring, std::wstring> languageMap;
    
public:
    ModernPresentationTool() : currentStyle(L"word"), currentCharIndex(0),
                              isTyping(false), isPaused(false),
                              hTitleFont(NULL), hButtonFont(NULL), hContentFont(NULL), hCodeFont(NULL),
                              hStatusFont(NULL), hProgressFont(NULL),
                              hModernBgBrush(NULL), hModernCardBrush(NULL),
                              hModernBorderPen(NULL), hModernPrimaryPen(NULL),
                              hBrushHeaderBG(NULL), hBrushMainWhite(NULL), hBrushVSCodeBG(NULL),
                              hPenHeaderBorder(NULL), hPenVSCodeBorder(NULL), hPenPrimary(NULL), hBrushVSCodeBorder(NULL),
                              hPanelWord(NULL), hEditWord(NULL), hPanelVSCode(NULL), hLineNumbers(NULL), hEditCode(NULL),
                              hSidebarHeader(NULL), hButtonRun(NULL), hMsftedit(NULL) {
        initializeLanguageMap();
    }
    
    ~ModernPresentationTool() {
        if (hTitleFont) DeleteObject(hTitleFont);
        if (hButtonFont) DeleteObject(hButtonFont);
        if (hContentFont) DeleteObject(hContentFont);
        if (hStatusFont) DeleteObject(hStatusFont);
        if (hProgressFont) DeleteObject(hProgressFont);
        if (hModernBgBrush) DeleteObject(hModernBgBrush);
        if (hModernCardBrush) DeleteObject(hModernCardBrush);
        if (hModernBorderPen) DeleteObject(hModernBorderPen);
        if (hModernPrimaryPen) DeleteObject(hModernPrimaryPen);
        if (hBrushHeaderBG) DeleteObject(hBrushHeaderBG);
        if (hBrushMainWhite) DeleteObject(hBrushMainWhite);
        if (hBrushVSCodeBG) DeleteObject(hBrushVSCodeBG);
        if (hPenHeaderBorder) DeleteObject(hPenHeaderBorder);
    if (hPenVSCodeBorder) DeleteObject(hPenVSCodeBorder);
        if (hPenPrimary) DeleteObject(hPenPrimary);
    if (hBrushVSCodeBorder) DeleteObject(hBrushVSCodeBorder);
        if (hCodeFont) DeleteObject(hCodeFont);
        if (hMsftedit) FreeLibrary(hMsftedit);
    }
    
    bool Initialize(HINSTANCE hInstance) {
        // 注册现代化窗口类
        WNDCLASSEXW wc = {};
        wc.cbSize = sizeof(WNDCLASSEXW);
        wc.style = CS_HREDRAW | CS_VREDRAW;
        wc.lpfnWndProc = WindowProc;
        wc.hInstance = hInstance;
        wc.hCursor = LoadCursor(NULL, IDC_ARROW);
        wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
        wc.lpszClassName = L"ModernPresentationTool";
        wc.hIcon = LoadIcon(NULL, IDI_APPLICATION);
        wc.hIconSm = LoadIcon(NULL, IDI_APPLICATION);
        
        if (!RegisterClassExW(&wc)) {
            return false;
        }
        
        // 创建主窗口（去除分层窗口，避免全屏灰色覆盖）
        hMainWnd = CreateWindowExW(
            0,
            L"ModernPresentationTool",
            L"演示神器",
            (WS_OVERLAPPEDWINDOW & ~WS_THICKFRAME) | WS_CLIPCHILDREN | WS_CLIPSIBLINGS,
            CW_USEDEFAULT, CW_USEDEFAULT,
            1800, 1200,  // 更大的窗口
            NULL, NULL,
            hInstance,
            this
        );
        
        if (!hMainWnd) {
            return false;
        }
        
        // 注意：不启用分层/毛玻璃等效果，确保界面在所有设备上稳定显示
        
        return true;
    }
    
    void EnableModernWindowEffects() {
        // 已禁用（保留占位以便将来按需开启）
    }
    
    void Show(int nCmdShow) {
        ShowWindow(hMainWnd, nCmdShow);
        UpdateWindow(hMainWnd);
    }
    
    void RunMessageLoop() {
        MSG msg;
        while (GetMessage(&msg, NULL, 0, 0)) {
            TranslateMessage(&msg);
            DispatchMessage(&msg);
        }
    }
    
private:
    void RefreshMenuActive() {
        if (hButtonWord) InvalidateRect(hButtonWord, NULL, TRUE);
        if (hButtonVSCode) InvalidateRect(hButtonVSCode, NULL, TRUE);
    }

    void CreateModernControls() {
        // 确保加载 RichEdit 5.0 控件
        if (!hMsftedit) hMsftedit = LoadLibraryW(L"Msftedit.dll");
        
        // 字体
        hTitleFont = CreateFontW(
            22, 0, 0, 0, FW_SEMIBOLD, FALSE, FALSE, FALSE,
            DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
            CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_DONTCARE,
            L"Segoe UI"
        );
        
        hButtonFont = CreateFontW(
            16, 0, 0, 0, FW_MEDIUM, FALSE, FALSE, FALSE,
            DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
            CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_DONTCARE,
            L"Segoe UI"
        );
        
        hContentFont = CreateFontW(
            18, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
            DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
            CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_DONTCARE,
            L"Microsoft YaHei UI"
        );
        // 代码区等宽字体（存在则用 Cascadia Mono，否则回退系统）
        hCodeFont = CreateFontW(
            18, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
            DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
            CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_MODERN,
            L"Cascadia Mono"
        );
        
        hStatusFont = CreateFontW(
            14, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
            DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
            CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_DONTCARE,
            L"Segoe UI"
        );
        
        hProgressFont = CreateFontW(
            12, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
            DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
            CLEARTYPE_QUALITY, DEFAULT_PITCH | FF_DONTCARE,
            L"Segoe UI"
        );
        
        // 画刷和画笔
        hModernBgBrush = CreateSolidBrush(MODERN_BG);
        hModernCardBrush = CreateSolidBrush(MODERN_CARD);
        hModernBorderPen = CreatePen(PS_SOLID, 1, MODERN_BORDER);
        hModernPrimaryPen = CreatePen(PS_SOLID, 2, MODERN_PRIMARY);
        hBrushHeaderBG = CreateSolidBrush(COLOR_HEADER_BG);
        hBrushMainWhite = CreateSolidBrush(COLOR_MAIN_WHITE);
        hBrushVSCodeBG = CreateSolidBrush(COLOR_VSCODE_BG);
    hPenHeaderBorder = CreatePen(PS_SOLID, 1, COLOR_HEADER_BORDER);
    hPenVSCodeBorder = CreatePen(PS_SOLID, 1, COLOR_VSCODE_BORDER);
    hPenPrimary = CreatePen(PS_SOLID, 2, COLOR_PRIMARY);
    hBrushVSCodeBorder = CreateSolidBrush(COLOR_VSCODE_BORDER);

        // 左侧标题（位于侧栏区域内），按钮菜单
        hSidebarHeader = CreateWindowW(L"STATIC", L"演示神器", WS_VISIBLE | WS_CHILD | SS_LEFT,
            20, 20, 210, 30, hMainWnd, NULL, GetModuleHandle(NULL), NULL);
        SendMessageW(hSidebarHeader, WM_SETFONT, (WPARAM)hTitleFont, TRUE);

        int sidebarW = 250;
        int menuX = 0;
        hButtonOpen   = CreateModernButton(L"📁 导入文本文件", menuX, 80, sidebarW, 50, ID_BUTTON_OPEN);
        hButtonWord   = CreateModernButton(L"📄 Word风格", menuX, 130, sidebarW, 50, ID_BUTTON_WORD);
        hButtonVSCode = CreateModernButton(L"💻 VSCode风格", menuX, 180, sidebarW, 50, ID_BUTTON_VSCODE);
        hButtonRun    = CreateModernButton(L"▶ 运行程序", menuX, 230, sidebarW, 50, ID_MENU_RUN);
        
        // 取消进度条（与网页一致，无该元素）
        hProgressBar = NULL;
        
        // 创建状态标签（Header 下方）
        hStaticStatus = CreateWindowW(
            L"STATIC", L"状态: 就绪",
            WS_VISIBLE | WS_CHILD | SS_LEFT,
            270, 70, 600, 24,
            hMainWnd, (HMENU)ID_STATIC_STATUS,
            GetModuleHandle(NULL), NULL
        );
        SendMessageW(hStaticStatus, WM_SETFONT, (WPARAM)hStatusFont, TRUE);
        
        hStaticFile = CreateWindowW(
            L"STATIC", L"文件: 未选择",
            WS_VISIBLE | WS_CHILD | SS_LEFT,
            270, 96, 1000, 24,
            hMainWnd, (HMENU)ID_STATIC_FILE,
            GetModuleHandle(NULL), NULL
        );
        SendMessageW(hStaticFile, WM_SETFONT, (WPARAM)hStatusFont, TRUE);
        
        // 取消单独的进度文案（合并到状态栏）
        hStaticProgress = NULL;
        
        // 面板：Word 风格（白底）
        hPanelWord = CreateWindowW(L"STATIC", L"", WS_VISIBLE | WS_CHILD,
            270, 130, 1530, 900,
            hMainWnd, NULL, GetModuleHandle(NULL), NULL);
        // 使用 RichEdit 5.0 作为 Word 风格编辑器
        hEditWord = CreateWindowExW(0, L"RICHEDIT50W", L"",
            WS_VISIBLE | WS_CHILD | WS_VSCROLL | WS_HSCROLL |
            ES_MULTILINE | ES_READONLY | ES_AUTOVSCROLL | ES_AUTOHSCROLL,
            0, 0, 1530, 900,
            hPanelWord, (HMENU)ID_EDIT_CONTENT, GetModuleHandle(NULL), NULL);
        SendMessageW(hEditWord, WM_SETFONT, (WPARAM)hContentFont, TRUE);
        // Word 面板：留出左右内边距
        // 通过 EM_SETRECT 设置格式矩形以获得更佳留白
        RECT fmt = { 24, 12, 1530 - 24, 900 - 12 };
        SendMessageW(hEditWord, EM_SETRECT, 0, (LPARAM)&fmt);
        // 设置背景色为白色
        SendMessageW(hEditWord, EM_SETBKGNDCOLOR, 0, (LPARAM)RGB(255,255,255));
        // 设置段落行距为 1.5 倍
        PARAFORMAT2 pf2 = {0};
        pf2.cbSize = sizeof(pf2);
        pf2.dwMask = PFM_LINESPACING;
        pf2.bLineSpacingRule = 1; // 1 = 1.5 倍行距
        SendMessageW(hEditWord, EM_SETPARAFORMAT, 0, (LPARAM)&pf2);
        
        // 面板：VSCode 风格（行号 + 代码区）
        hPanelVSCode = CreateWindowW(L"STATIC", L"", WS_CHILD,
            270, 130, 1530, 900,
            hMainWnd, NULL, GetModuleHandle(NULL), NULL);
        hLineNumbers = CreateWindowW(L"EDIT", L"1",
            WS_VISIBLE | WS_CHILD | ES_MULTILINE | ES_READONLY | WS_VSCROLL,
            0, 0, 60, 900,
            hPanelVSCode, NULL, GetModuleHandle(NULL), NULL);
        SendMessageW(hLineNumbers, WM_SETFONT, (WPARAM)hCodeFont, TRUE);
        SendMessageW(hLineNumbers, EM_SETMARGINS, EC_LEFTMARGIN | EC_RIGHTMARGIN, MAKELONG(8, 4));
        hEditCode = CreateWindowW(L"EDIT", L"",
            WS_VISIBLE | WS_CHILD | WS_VSCROLL | WS_HSCROLL |
            ES_MULTILINE | ES_READONLY | ES_AUTOVSCROLL | ES_AUTOHSCROLL,
            60, 0, 1470, 900,
            hPanelVSCode, NULL, GetModuleHandle(NULL), NULL);
        SendMessageW(hEditCode, WM_SETFONT, (WPARAM)hCodeFont, TRUE);
        SendMessageW(hEditCode, EM_SETMARGINS, EC_LEFTMARGIN | EC_RIGHTMARGIN, MAKELONG(8, 8));
        
        // 子类化：把键盘与滚动事件转发到主窗口，确保键盘驱动与行号同步
        SetWindowSubclass(hEditWord, EditSubclassProc, 1, (DWORD_PTR)this);
        SetWindowSubclass(hEditCode, EditSubclassProc, 2, (DWORD_PTR)this);
        SetWindowSubclass(hLineNumbers, EditSubclassProc, 3, (DWORD_PTR)this);

        // 默认显示 Word 面板
        ShowPanel(L"word");
        RefreshMenuActive();
    }
    
    HWND CreateModernButton(const wchar_t* text, int x, int y, int width, int height, int id) {
        HWND button = CreateWindowW(
            L"BUTTON", text,
            WS_VISIBLE | WS_CHILD | BS_PUSHBUTTON | BS_OWNERDRAW,
            x, y, width, height,
            hMainWnd, (HMENU)(UINT_PTR)id,
            GetModuleHandle(NULL), NULL
        );
        SendMessageW(button, WM_SETFONT, (WPARAM)hButtonFont, TRUE);
        return button;
    }

    void DrawFancyButton(LPDRAWITEMSTRUCT dis) {
        HDC hdc = dis->hDC;
        RECT rc = dis->rcItem;
        bool focused = (dis->itemState & ODS_FOCUS) != 0;
        // 侧栏菜单背景（近似渐变）：按按钮中心的 Y 与父窗口高度混合侧栏上下颜色
    RECT rcParent; GetClientRect(GetParent(dis->hwndItem), &rcParent);
    RECT rcWin = rc;
    POINT pt = {rc.left, rc.top}; MapWindowPoints(dis->hwndItem, GetParent(dis->hwndItem), &pt, 1);
    int centerY = pt.y + (rc.bottom - rc.top) / 2;
    double t = rcParent.bottom > 0 ? (double)centerY / (double)rcParent.bottom : 0.0;
    auto lerp = [](int a, int b, double t){ return (int)(a + (b - a) * t); };
    COLORREF topCol = COLOR_SIDEBAR_TOP, botCol = COLOR_SIDEBAR_BOTTOM;
    int r = lerp(GetRValue(topCol), GetRValue(botCol), t);
    int g = lerp(GetGValue(topCol), GetGValue(botCol), t);
    int b = lerp(GetBValue(topCol), GetBValue(botCol), t);
        // 选中态：高亮背景并加粗左侧指示条
        bool isActive = false;
        if (dis->hwndItem == hButtonWord && currentStyle == L"word") isActive = true;
        if (dis->hwndItem == hButtonVSCode && currentStyle == L"vscode") isActive = true;
    if (isActive) { r = std::min(255, r + 18); g = std::min(255, g + 18); b = std::min(255, b + 18); }
    HBRUSH bg = CreateSolidBrush(RGB(r,g,b));
    FillRect(hdc, &rc, bg);
    DeleteObject(bg);
        // 左侧指示条
        HPEN oldPen = (HPEN)SelectObject(hdc, hPenPrimary);
        if (isActive) {
            // 加粗：画多条线
            for (int x = rc.left; x < rc.left + 4; ++x) {
                MoveToEx(hdc, x, rc.top, NULL);
                LineTo(hdc, x, rc.bottom);
            }
        } else {
            MoveToEx(hdc, rc.left, rc.top, NULL);
            LineTo(hdc, rc.left, rc.bottom);
        }
        SelectObject(hdc, oldPen);
        // 文本
        wchar_t text[256] = {0};
        GetWindowTextW(dis->hwndItem, text, 256);
        SetBkMode(hdc, TRANSPARENT);
        SetTextColor(hdc, RGB(255,255,255));
        RECT txt = rc; txt.left += 20;
        DrawTextW(hdc, text, -1, &txt, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
        if (focused) { DrawFocusRect(hdc, &rc); }
    }
    
    void OnButtonOpen() {
        OPENFILENAMEW ofn = {};
        wchar_t szFile[MAX_PATH] = {};
        
        ofn.lStructSize = sizeof(ofn);
        ofn.lpstrFile = szFile;
        ofn.nMaxFile = MAX_PATH;
        ofn.lpstrFilter = L"文本文件\0*.txt;*.md;*.cpp;*.c;*.hpp;*.h;*.py;*.js;*.java;*.html;*.css;*.json;*.xml;*.csv\0所有文件\0*.*\0";
        ofn.nFilterIndex = 1;
        ofn.lpstrTitle = L"选择要导入的文件";
        ofn.Flags = OFN_PATHMUSTEXIST | OFN_FILEMUSTEXIST;
        
        if (GetOpenFileNameW(&ofn)) {
            LoadFile(szFile);
        }
    }
    
    static bool ReadAllBytes(const wchar_t* path, std::vector<char>& out) {
        HANDLE h = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
        if (h == INVALID_HANDLE_VALUE) return false;
        LARGE_INTEGER size;
        if (!GetFileSizeEx(h, &size)) { CloseHandle(h); return false; }
        if (size.QuadPart > 50LL * 1024 * 1024) { CloseHandle(h); return false; } // 限制 50MB
        out.resize((size_t)size.QuadPart);
        DWORD read = 0; BOOL ok = TRUE; size_t offset = 0; size_t toRead = out.size();
        while (toRead > 0) {
            DWORD chunk = 0;
            ok = ReadFile(h, out.data() + offset, (DWORD)std::min<size_t>(toRead, 1 << 20), &chunk, NULL);
            if (!ok) break;
            if (chunk == 0) break;
            offset += chunk; toRead -= chunk;
        }
        CloseHandle(h);
        if (!ok) return false;
        out.resize(offset);
        return true;
    }

    static bool WriteAllBytes(const wchar_t* path, const std::vector<char>& data) {
        HANDLE h = CreateFileW(path, GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
        if (h == INVALID_HANDLE_VALUE) return false;
        DWORD written = 0; BOOL ok = WriteFile(h, data.data(), (DWORD)data.size(), &written, NULL);
        CloseHandle(h);
        return ok && written == data.size();
    }

    static std::wstring ReadFileUTF8OrACP(const wchar_t* filePath) {
        std::vector<char> bytes;
        if (!ReadAllBytes(filePath, bytes)) return L"";
        if (bytes.empty()) return L"";
        // 检测 UTF-8 BOM
        size_t offset = 0;
        if (bytes.size() >= 3 && (unsigned char)bytes[0] == 0xEF && (unsigned char)bytes[1] == 0xBB && (unsigned char)bytes[2] == 0xBF) {
            offset = 3;
        }
        int wideLen = MultiByteToWideChar(CP_UTF8, 0, bytes.data() + offset, (int)(bytes.size() - offset), NULL, 0);
        std::wstring result;
        if (wideLen > 0) {
            result.resize(wideLen);
            MultiByteToWideChar(CP_UTF8, 0, bytes.data() + offset, (int)(bytes.size() - offset), &result[0], wideLen);
            return result;
        }
        // 回退到系统本地码页
        wideLen = MultiByteToWideChar(CP_ACP, 0, bytes.data(), (int)bytes.size(), NULL, 0);
        if (wideLen > 0) {
            result.resize(wideLen);
            MultiByteToWideChar(CP_ACP, 0, bytes.data(), (int)bytes.size(), &result[0], wideLen);
        }
        return result;
    }

    void LoadFile(const wchar_t* filePath) {
        std::wstring content = ReadFileUTF8OrACP(filePath);
        if (content.empty()) {
            ShowModernMessage(L"无法打开或读取文件!", L"错误", MB_OK | MB_ICONERROR);
            return;
        }
        currentContent = std::move(content);
        currentFile = filePath;
        currentCharIndex = 0;
        isTyping = false;
        isPaused = false;
        
        // 更新状态
        std::wstring status = L"文件: ";
        status += filePath;
        SetWindowTextW(hStaticFile, status.c_str());
        SetWindowTextW(hStaticStatus, L"状态: 文件已加载（键盘驱动：按键前进，Backspace 后退）");
        
    // 更新进度条（当前未显示，做空指针保护）
    if (hProgressBar) SendMessageW(hProgressBar, PBM_SETPOS, 0, 0);
    if (hStaticProgress) SetWindowTextW(hStaticProgress, L"进度: 0%");
        
        // 显示文件信息
        std::wstring info = L"文件导入成功!\n";
        info += L"文件名: " + GetFileName(filePath) + L"\n";
        info += L"文件大小: " + std::to_wstring(currentContent.length()) + L" 字符\n";
        info += L"语言: " + DetectLanguage(filePath) + L"\n";
        
        ShowModernMessage(info.c_str(), L"文件信息", MB_OK | MB_ICONINFORMATION);
        UpdateDisplay();
        UpdateStatus();
        // 还原焦点到主窗口，确保按键可用
        SetFocus(hMainWnd);
    }
    
    void OnButtonStart() {
        if (currentContent.empty()) {
            ShowModernMessage(L"请先导入文件!", L"提示", MB_OK | MB_ICONWARNING);
            return;
        }
        
        if (isTyping) {
            ShowModernMessage(L"演示已在运行!", L"提示", MB_OK | MB_ICONWARNING);
            return;
        }
        
        isTyping = true;
        isPaused = false;
        currentCharIndex = 0;
        
        SetWindowTextW(hStaticStatus, L"状态: 演示运行中");
        
        // 启动定时器
        SetTimer(hMainWnd, ID_TIMER_TYPING, 30, NULL);
    }
    
    void OnButtonPause() {
        if (!isTyping) {
            ShowModernMessage(L"演示未运行!", L"提示", MB_OK | MB_ICONWARNING);
            return;
        }
        
        isPaused = !isPaused;
        SetWindowTextW(hStaticStatus, isPaused ? L"状态: 已暂停" : L"状态: 演示运行中");
    }
    
    void OnButtonReset() {
        currentCharIndex = 0;
        isTyping = false;
        isPaused = false;
        
        KillTimer(hMainWnd, ID_TIMER_TYPING);
        SetWindowTextW(hEditWord, L"");
        SetWindowTextW(hEditCode, L"");
        SetWindowTextW(hStaticStatus, L"状态: 已重置");
    if (hProgressBar) SendMessageW(hProgressBar, PBM_SETPOS, 0, 0);
    if (hStaticProgress) SetWindowTextW(hStaticProgress, L"进度: 0%");
    }
    
    void OnButtonShowAll() {
        if (currentContent.empty()) {
            ShowModernMessage(L"请先导入文件!", L"提示", MB_OK | MB_ICONWARNING);
            return;
        }
        
        currentCharIndex = currentContent.length();
        isTyping = false;
        isPaused = false;
        
        KillTimer(hMainWnd, ID_TIMER_TYPING);
        DisplayCurrentContent();
        SetWindowTextW(hStaticStatus, L"状态: 全部内容已显示");
        SendMessageW(hProgressBar, PBM_SETPOS, 100, 0);
        SetWindowTextW(hStaticProgress, L"进度: 100%");
    }
    
    void OnButtonStyle() {
        currentStyle = (currentStyle == L"word") ? L"vscode" : L"word";
        ShowPanel(currentStyle.c_str());
        std::wstring styleText = L"当前风格: ";
        styleText += currentStyle;
        ShowModernMessage(styleText.c_str(), L"风格切换", MB_OK | MB_ICONINFORMATION);
        UpdateDisplay();
        UpdateStatus();
    }
    
    void OnButtonSave() {
        if (currentContent.empty()) {
            ShowModernMessage(L"没有内容可保存!", L"提示", MB_OK | MB_ICONWARNING);
            return;
        }
        
    OPENFILENAMEW ofn = {};
        wchar_t szFile[MAX_PATH] = {};
        
        ofn.lStructSize = sizeof(ofn);
        ofn.lpstrFile = szFile;
        ofn.nMaxFile = MAX_PATH;
        ofn.lpstrFilter = L"文本文件\0*.txt\0所有文件\0*.*\0";
        ofn.nFilterIndex = 1;
        ofn.lpstrTitle = L"保存文件";
        ofn.Flags = OFN_OVERWRITEPROMPT;
        
        if (GetSaveFileNameW(&ofn)) {
            // 保存为 UTF-8 带 BOM
            std::vector<char> data;
            data.push_back((char)0xEF); data.push_back((char)0xBB); data.push_back((char)0xBF);
            int cb = WideCharToMultiByte(CP_UTF8, 0, currentContent.c_str(), (int)currentContent.size(), NULL, 0, NULL, NULL);
            std::string utf8;
            utf8.resize(cb);
            WideCharToMultiByte(CP_UTF8, 0, currentContent.c_str(), (int)currentContent.size(), &utf8[0], cb, NULL, NULL);
            data.insert(data.end(), utf8.begin(), utf8.end());
            if (!WriteAllBytes(ofn.lpstrFile, data)) {
                ShowModernMessage(L"无法保存文件!", L"错误", MB_OK | MB_ICONERROR);
                return;
            }
            ShowModernMessage(L"文件保存成功!", L"成功", MB_OK | MB_ICONINFORMATION);
        }
    }

    std::wstring GetExeDir() {
        wchar_t path[MAX_PATH];
        GetModuleFileNameW(NULL, path, MAX_PATH);
        std::wstring p(path);
        size_t pos = p.find_last_of(L"\\/");
        if (pos != std::wstring::npos) p = p.substr(0, pos); // bin
        return p;
    }

    std::wstring Combine(const std::wstring& a, const std::wstring& b) {
        if (a.empty()) return b;
        if (b.empty()) return a;
        if (a.back() == L'\\' || a.back() == L'/') return a + b;
        return a + L"\\" + b;
    }

    std::wstring GetWebIndexPath() {
        // exe 位于 ...\project\bin，网页位于 ...\PresentationMagicTool\PresentationMagicTool\index.html
        std::wstring bin = GetExeDir();
        // 上一级 (project)
        size_t pos = bin.find_last_of(L"\\/");
        if (pos != std::wstring::npos) bin = bin.substr(0, pos);
        // 上一级 (PresentationMagicTool 根)
        pos = bin.find_last_of(L"\\/");
        if (pos != std::wstring::npos) bin = bin.substr(0, pos);
        std::wstring web = Combine(bin, L"PresentationMagicTool\\index.html");
        if (GetFileAttributesW(web.c_str()) != INVALID_FILE_ATTRIBUTES) return web;
        // 兼容可能的路径（当前 repo 结构看到的是 PresentationMagicTool/PresentationMagicTool/index.html）
        web = Combine(bin, L"PresentationMagicTool\\PresentationMagicTool\\index.html");
        return web;
    }

    void OnButtonWeb() {
        std::wstring indexPath = GetWebIndexPath();
        if (GetFileAttributesW(indexPath.c_str()) == INVALID_FILE_ATTRIBUTES) {
            ShowModernMessage(L"未找到网页界面 index.html，请确认仓库结构。", L"错误", MB_OK | MB_ICONERROR);
            return;
        }
        // 转换为 file:/// URL
        std::wstring url = L"file:///";
        for (wchar_t ch : indexPath) {
            if (ch == L'\\') url.push_back(L'/');
            else url.push_back(ch);
        }
        // 优先尝试 Edge 应用模式
        std::wstring params = L"--app=" + url;
        HINSTANCE res = ShellExecuteW(hMainWnd, L"open", L"msedge", params.c_str(), NULL, SW_SHOWNORMAL);
        if ((INT_PTR)res <= 32) {
            // 退回默认浏览器
            ShellExecuteW(hMainWnd, L"open", url.c_str(), NULL, NULL, SW_SHOWNORMAL);
        }
    }

    void OnRunProgram() {
        OPENFILENAMEW ofn = {};
        wchar_t szFile[MAX_PATH] = {};
        ofn.lStructSize = sizeof(ofn);
        ofn.lpstrFile = szFile;
        ofn.nMaxFile = MAX_PATH;
        ofn.lpstrFilter = L"可执行文件\0*.exe;*.bat;*.cmd\0所有文件\0*.*\0";
        ofn.nFilterIndex = 1;
        ofn.lpstrTitle = L"选择要运行的程序";
        ofn.Flags = OFN_PATHMUSTEXIST | OFN_FILEMUSTEXIST;
        if (GetOpenFileNameW(&ofn)) {
            // 提取扩展名和工作目录
            std::wstring path = szFile;
            std::wstring dir = path;
            size_t p = dir.find_last_of(L"\\/");
            if (p != std::wstring::npos) dir = dir.substr(0, p); else dir = L"";
            auto toLower = [](std::wstring s){ for (auto& ch : s) ch = towlower(ch); return s; };
            std::wstring ext;
            size_t dot = path.find_last_of(L'.');
            if (dot != std::wstring::npos) ext = toLower(path.substr(dot));

            BOOL ok = FALSE;
            if (ext == L".exe") {
                // 直接 CreateProcess，设置工作目录
                STARTUPINFOW si = { sizeof(si) };
                PROCESS_INFORMATION pi = {};
                std::wstring cmd = L"\"" + path + L"\"";
                std::vector<wchar_t> buf(cmd.begin(), cmd.end()); buf.push_back(L'\0');
                ok = CreateProcessW(NULL, buf.data(), NULL, NULL, FALSE, CREATE_NEW_CONSOLE, NULL, dir.empty()?NULL:dir.c_str(), &si, &pi);
                if (ok) { CloseHandle(pi.hThread); CloseHandle(pi.hProcess); }
            } else if (ext == L".bat" || ext == L".cmd") {
                // 用 cmd.exe /c 运行批处理，设置工作目录
                STARTUPINFOW si = { sizeof(si) };
                PROCESS_INFORMATION pi = {};
                std::wstring cmd = L"cmd.exe /c \"" + path + L"\"";
                std::vector<wchar_t> buf(cmd.begin(), cmd.end()); buf.push_back(L'\0');
                ok = CreateProcessW(NULL, buf.data(), NULL, NULL, FALSE, CREATE_NEW_CONSOLE, NULL, dir.empty()?NULL:dir.c_str(), &si, &pi);
                if (ok) { CloseHandle(pi.hThread); CloseHandle(pi.hProcess); }
            } else {
                // 其他类型尝试 ShellExecuteW（尊重默认关联），并设置工作目录
                HINSTANCE res = ShellExecuteW(hMainWnd, L"open", path.c_str(), NULL, dir.empty()?NULL:dir.c_str(), SW_SHOWNORMAL);
                ok = ((INT_PTR)res > 32);
            }
            if (!ok) {
                ShowModernMessage(L"无法运行所选程序。可能需要管理员权限或该文件不可执行。", L"错误", MB_OK | MB_ICONERROR);
            } else {
                SetWindowTextW(hStaticStatus, L"状态: 已启动外部程序");
            }
        }
    }
    
    void OnTimer() {
        if (!isTyping || isPaused || currentCharIndex >= currentContent.length()) {
            if (currentCharIndex >= currentContent.length()) {
                isTyping = false;
                KillTimer(hMainWnd, ID_TIMER_TYPING);
                SetWindowTextW(hStaticStatus, L"状态: 演示完成");
                ShowModernMessage(L"演示完成!", L"完成", MB_OK | MB_ICONINFORMATION);
            }
            return;
        }
        
        DisplayCurrentContent();
        currentCharIndex++;
        
        // 更新进度条
        int progress = (int)((currentCharIndex * 100) / (std::max<size_t>(1, currentContent.length())));
        if (hProgressBar) SendMessageW(hProgressBar, PBM_SETPOS, progress, 0);
        if (hStaticProgress) {
            wchar_t progressText[32];
            swprintf(progressText, 32, L"进度: %d%%", progress);
            SetWindowTextW(hStaticProgress, progressText);
        }
    }
    
    void DisplayCurrentContent() {
        std::wstring displayContent = currentContent.substr(0, currentCharIndex);
        if (currentStyle == L"word") {
            SetWindowTextW(hEditWord, displayContent.c_str());
            SendMessageW(hEditWord, EM_SETSEL, (WPARAM)displayContent.length(), (LPARAM)displayContent.length());
            SendMessageW(hEditWord, EM_SCROLLCARET, 0, 0);
        } else {
            SetWindowTextW(hEditCode, displayContent.c_str());
            SendMessageW(hEditCode, EM_SETSEL, (WPARAM)displayContent.length(), (LPARAM)displayContent.length());
            SendMessageW(hEditCode, EM_SCROLLCARET, 0, 0);
            UpdateLineNumbers(displayContent);
        }
    }
    
    void ShowModernMessage(const wchar_t* text, const wchar_t* title, UINT type) {
        MessageBoxW(hMainWnd, text, title, type);
    }
    
    std::wstring GetFileName(const wchar_t* filePath) {
        std::wstring path(filePath);
        size_t pos = path.find_last_of(L"\\/");
        if (pos != std::wstring::npos) {
            return path.substr(pos + 1);
        }
        return path;
    }
    
    std::wstring DetectLanguage(const wchar_t* filePath) {
        std::wstring path(filePath);
        size_t pos = path.find_last_of(L'.');
        if (pos == std::wstring::npos) {
            return L"纯文本";
        }
        std::wstring ext = path.substr(pos);
        std::transform(ext.begin(), ext.end(), ext.begin(), ::towlower);
        auto it = languageMap.find(ext);
        if (it != languageMap.end()) {
            return it->second;
        }
        return L"纯文本";
    }
    
    void initializeLanguageMap() {
        languageMap[L".cpp"] = L"C++";
        languageMap[L".cc"] = L"C++";
        languageMap[L".cxx"] = L"C++";
        languageMap[L".c"] = L"C";
        languageMap[L".py"] = L"Python";
        languageMap[L".js"] = L"JavaScript";
        languageMap[L".java"] = L"Java";
        languageMap[L".html"] = L"HTML";
        languageMap[L".htm"] = L"HTML";
        languageMap[L".css"] = L"CSS";
        languageMap[L".json"] = L"JSON";
        languageMap[L".xml"] = L"XML";
        languageMap[L".md"] = L"Markdown";
        languageMap[L".txt"] = L"纯文本";
        languageMap[L".csv"] = L"CSV";
    }
    
    void DrawModernBackground(HDC hdc, RECT& rect) {
        // 绘制左侧 250px 渐变侧栏（近似对角渐变）
        TRIVERTEX v[4] = {};
        v[0].x = 0; v[0].y = 0; v[0].Red = GetRValue(COLOR_SIDEBAR_TOP) << 8; v[0].Green = GetGValue(COLOR_SIDEBAR_TOP) << 8; v[0].Blue = GetBValue(COLOR_SIDEBAR_TOP) << 8; v[0].Alpha = 0xFFFF;
        v[1].x = 250; v[1].y = 0; v[1].Red = GetRValue(COLOR_SIDEBAR_BOTTOM) << 8; v[1].Green = GetGValue(COLOR_SIDEBAR_BOTTOM) << 8; v[1].Blue = GetBValue(COLOR_SIDEBAR_BOTTOM) << 8; v[1].Alpha = 0xFFFF;
        v[2].x = 0; v[2].y = rect.bottom; v[2].Red = GetRValue(COLOR_SIDEBAR_BOTTOM) << 8; v[2].Green = GetGValue(COLOR_SIDEBAR_BOTTOM) << 8; v[2].Blue = GetBValue(COLOR_SIDEBAR_BOTTOM) << 8; v[2].Alpha = 0xFFFF;
        v[3].x = 250; v[3].y = rect.bottom; v[3].Red = GetRValue(COLOR_SIDEBAR_TOP) << 8; v[3].Green = GetGValue(COLOR_SIDEBAR_TOP) << 8; v[3].Blue = GetBValue(COLOR_SIDEBAR_TOP) << 8; v[3].Alpha = 0xFFFF;
        GRADIENT_TRIANGLE gts[2] = { {0,1,2}, {1,2,3} };
        GradientFill(hdc, v, 4, gts, 2, GRADIENT_FILL_TRIANGLE);

        // 顶部 Header
        RECT headerRect = {250, 0, rect.right, 60};
        FillRect(hdc, &headerRect, hBrushHeaderBG);
        HPEN oldPen = (HPEN)SelectObject(hdc, hPenHeaderBorder);
        MoveToEx(hdc, headerRect.left, headerRect.bottom-1, NULL);
        LineTo(hdc, headerRect.right, headerRect.bottom-1);
        SelectObject(hdc, oldPen);

        // 主内容白底
        RECT mainRect = {250, 60, rect.right, rect.bottom};
        FillRect(hdc, &mainRect, hBrushMainWhite);
    }
    
    void UpdateLineNumbers(const std::wstring& displayContent) {
        // 统计行数
        size_t lines = 1;
        for (wchar_t ch : displayContent) if (ch == L'\n') ++lines;
        std::wstringstream ss;
        for (size_t i = 1; i <= lines; ++i) {
            ss << i << L"\r\n";
        }
        std::wstring ln = ss.str();
        SetWindowTextW(hLineNumbers, ln.c_str());
        // 让行号滚动跟随代码区
        int firstVisible = (int)SendMessageW(hEditCode, EM_GETFIRSTVISIBLELINE, 0, 0);
        SendMessageW(hLineNumbers, EM_LINESCROLL, 0, firstVisible);
    }

    void UpdateDisplay() {
        if (currentContent.empty() || currentCharIndex == 0) {
            if (currentStyle == L"word") SetWindowTextW(hEditWord, L"请导入文本文件开始演示...");
            else SetWindowTextW(hEditCode, L"请导入文本文件开始演示...");
            if (currentStyle == L"vscode") UpdateLineNumbers(L"");
            return;
        }
        DisplayCurrentContent();
    }

    void UpdateStatus() {
        std::wstring styleName = (currentStyle == L"word") ? L"Word" : L"VSCode";
        std::wstring status = L"状态: 就绪  | 字符数: ";
        status += std::to_wstring(currentCharIndex);
        status += L"  | 风格: ";
        status += styleName;
        SetWindowTextW(hStaticStatus, status.c_str());
    }

    void ShowPanel(const wchar_t* style) {
        bool showWord = (wcscmp(style, L"word") == 0);
        ShowWindow(hPanelWord, showWord ? SW_SHOW : SW_HIDE);
        ShowWindow(hPanelVSCode, showWord ? SW_HIDE : SW_SHOW);
    }

    void HandleShortcut(WPARAM vk) {
        bool ctrl = (GetKeyState(VK_CONTROL) & 0x8000) != 0;
        if (!ctrl) return;
        if (vk == 'O') { OnButtonOpen(); }
        else if (vk == '1') { currentStyle = L"word"; ShowPanel(L"word"); UpdateDisplay(); UpdateStatus(); }
        else if (vk == '2') { currentStyle = L"vscode"; ShowPanel(L"vscode"); UpdateDisplay(); UpdateStatus(); }
        else if (vk == 'R') { OnButtonReset(); }
        else if (vk == 'A') { OnButtonShowAll(); }
    }

    static LRESULT CALLBACK WindowProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam) {
        ModernPresentationTool* pThis = nullptr;
        
        if (uMsg == WM_NCCREATE) {
            CREATESTRUCT* pCreate = (CREATESTRUCT*)lParam;
            pThis = (ModernPresentationTool*)pCreate->lpCreateParams;
            SetWindowLongPtr(hwnd, GWLP_USERDATA, (LONG_PTR)pThis);
            pThis->hMainWnd = hwnd;
        } else {
            pThis = (ModernPresentationTool*)GetWindowLongPtr(hwnd, GWLP_USERDATA);
        }
        
        if (pThis) {
            switch (uMsg) {
                case WM_CREATE:
                    pThis->CreateModernControls();
                    // 确保初始焦点在主窗口，键盘立即可用
                    SetFocus(hwnd);
                    return 0;
                    
                case WM_COMMAND:
                    switch (LOWORD(wParam)) {
                        case ID_BUTTON_OPEN:
                            pThis->OnButtonOpen(); SetFocus(hwnd);
                            break;
                        case ID_BUTTON_WORD:
                            pThis->currentStyle = L"word"; pThis->ShowPanel(L"word"); pThis->UpdateDisplay(); pThis->UpdateStatus(); pThis->RefreshMenuActive(); SetFocus(hwnd);
                            break;
                        case ID_BUTTON_VSCODE:
                            pThis->currentStyle = L"vscode"; pThis->ShowPanel(L"vscode"); pThis->UpdateDisplay(); pThis->UpdateStatus(); pThis->RefreshMenuActive(); SetFocus(hwnd);
                            break;
                        case ID_MENU_RUN:
                            pThis->OnRunProgram(); SetFocus(hwnd);
                            break;
                    }
                    return 0;
                    
                case WM_TIMER:
                    if (wParam == ID_TIMER_TYPING) {
                        pThis->OnTimer();
                    }
                    return 0;

                case WM_APP_UPDATE_LINENUM: {
                    // 同步行号到当前显示的内容长度
                    if (pThis->currentStyle == L"vscode") {
                        std::wstring display = pThis->currentContent.substr(0, pThis->currentCharIndex);
                        pThis->UpdateLineNumbers(display);
                    }
                    return 0;
                }
                
                case WM_DRAWITEM: {
                    LPDRAWITEMSTRUCT dis = (LPDRAWITEMSTRUCT)lParam;
                    if (dis->CtlType == ODT_BUTTON) {
                        pThis->DrawFancyButton(dis);
                        return TRUE;
                    }
                    break;
                }

                case WM_SIZE: {
                    // 自适应布局：左侧侧栏 250，顶部 Header 60
                    RECT rc; GetClientRect(hwnd, &rc);
                    int width = rc.right - rc.left;
                    int sidebarW = 250;
                    int headerH = 60;
                    int startX = sidebarW + 20; // 270
                    int infoY = 70;
                    int panelTop = 130;
                    int panelWidth = width - sidebarW - 20;
                    int panelHeight = (rc.bottom - panelTop - 30);

                    // 侧栏标题与菜单
                    MoveWindow(pThis->hSidebarHeader, 20, 20, sidebarW-40, 30, TRUE);
                    MoveWindow(pThis->hButtonOpen, 0, 80, sidebarW, 50, TRUE);
                    MoveWindow(pThis->hButtonWord, 0, 130, sidebarW, 50, TRUE);
                    MoveWindow(pThis->hButtonVSCode, 0, 180, sidebarW, 50, TRUE);
                    if (pThis->hButtonRun) MoveWindow(pThis->hButtonRun, 0, 230, sidebarW, 50, TRUE);

                    // 状态信息
                    MoveWindow(pThis->hStaticStatus, startX, infoY, 600, 24, TRUE);
                    MoveWindow(pThis->hStaticFile, startX, infoY+26, width - startX - 40, 24, TRUE);

                    // 面板
                    MoveWindow(pThis->hPanelWord, startX, panelTop, panelWidth, panelHeight, TRUE);
                    MoveWindow(pThis->hEditWord, 0, 0, panelWidth, panelHeight, TRUE);
                    if (pThis->hEditWord) {
                        RECT fmt = { 24, 12, panelWidth - 24, panelHeight - 12 };
                        SendMessageW(pThis->hEditWord, EM_SETRECT, 0, (LPARAM)&fmt);
                    }
                    MoveWindow(pThis->hPanelVSCode, startX, panelTop, panelWidth, panelHeight, TRUE);
                    MoveWindow(pThis->hLineNumbers, 0, 0, 60, panelHeight, TRUE);
                    MoveWindow(pThis->hEditCode, 60, 0, panelWidth-60, panelHeight, TRUE);
                    return 0;
                }
                
                case WM_KEYDOWN:
                    pThis->HandleShortcut(wParam);
                    if (wParam == VK_BACK) {
                        if (pThis->currentCharIndex > 0) {
                            pThis->currentCharIndex--;
                            pThis->DisplayCurrentContent();
                            pThis->UpdateStatus();
                        }
                        return 0;
                    }
                    if (wParam == VK_RETURN || wParam == VK_SPACE || wParam == VK_RIGHT) {
                        if (pThis->currentCharIndex < pThis->currentContent.length()) {
                            pThis->currentCharIndex++;
                            pThis->DisplayCurrentContent();
                            pThis->UpdateStatus();
                        }
                        return 0;
                    }
                    break;
                case WM_CHAR: {
                    // 仅对可见字符推进一位展示
                    wchar_t ch = (wchar_t)wParam;
                    if (ch >= 0x20 && ch != 0x7F) {
                        if (pThis->currentCharIndex < pThis->currentContent.length()) {
                            pThis->currentCharIndex++;
                            pThis->DisplayCurrentContent();
                            pThis->UpdateStatus();
                        }
                        return 0;
                    }
                    break;
                }
                    
                case WM_CTLCOLORSTATIC:
                    if ((HWND)lParam == pThis->hSidebarHeader) {
                        SetBkMode((HDC)wParam, TRANSPARENT);
                        SetTextColor((HDC)wParam, RGB(255,255,255));
                        return (LRESULT)GetStockObject(HOLLOW_BRUSH);
                    }
                    if ((HWND)lParam == pThis->hStaticStatus || 
                        (HWND)lParam == pThis->hStaticFile) {
                        SetBkColor((HDC)wParam, COLOR_MAIN_WHITE);
                        SetTextColor((HDC)wParam, COLOR_TEXT_MUTED);
                        return (LRESULT)pThis->hBrushMainWhite;
                    }
                    break;
                    
                case WM_CTLCOLOREDIT:
                    if ((HWND)lParam == pThis->hEditWord) {
                        SetBkColor((HDC)wParam, COLOR_MAIN_WHITE);
                        SetTextColor((HDC)wParam, COLOR_TEXT_DARK);
                        return (LRESULT)pThis->hBrushMainWhite;
                    }
                    if ((HWND)lParam == pThis->hEditCode || (HWND)lParam == pThis->hLineNumbers) {
                        SetBkColor((HDC)wParam, COLOR_VSCODE_BG);
                        SetTextColor((HDC)wParam, MODERN_TEXT_PRIMARY);
                        return (LRESULT)pThis->hBrushVSCodeBG;
                    }
                    break;
                    
                case WM_CTLCOLORBTN:
                    // 侧栏按钮透明，由父窗口渐变背景承载
                    if ((HWND)lParam == pThis->hButtonOpen || (HWND)lParam == pThis->hButtonWord ||
                        (HWND)lParam == pThis->hButtonVSCode || (HWND)lParam == pThis->hButtonRun) {
                        SetBkMode((HDC)wParam, TRANSPARENT);
                        SetTextColor((HDC)wParam, RGB(255,255,255));
                        return (LRESULT)GetStockObject(HOLLOW_BRUSH);
                    }
                    // 其他按钮（若有）回退为卡片风格
                    SetBkColor((HDC)wParam, MODERN_CARD);
                    SetTextColor((HDC)wParam, MODERN_TEXT_PRIMARY);
                    return (LRESULT)pThis->hModernCardBrush;
                    
                case WM_PAINT: {
                    PAINTSTRUCT ps;
                    HDC hdc = BeginPaint(hwnd, &ps);
                    RECT rect; GetClientRect(hwnd, &rect);
                    // 双缓冲，减少闪烁
                    HDC memDC = CreateCompatibleDC(hdc);
                    HBITMAP memBmp = CreateCompatibleBitmap(hdc, rect.right-rect.left, rect.bottom-rect.top);
                    HBITMAP oldBmp = (HBITMAP)SelectObject(memDC, memBmp);
                    pThis->DrawModernBackground(memDC, rect);
                    BitBlt(hdc, 0, 0, rect.right-rect.left, rect.bottom-rect.top, memDC, 0, 0, SRCCOPY);
                    SelectObject(memDC, oldBmp);
                    DeleteObject(memBmp);
                    DeleteDC(memDC);
                    EndPaint(hwnd, &ps);
                    return 0;
                }

                case WM_ERASEBKGND:
                    // 禁用背景擦除，结合双缓冲彻底消除闪烁
                    return 1;
                    
                case WM_DESTROY:
                    PostQuitMessage(0);
                    return 0;
            }
        }
        
        return DefWindowProc(hwnd, uMsg, wParam, lParam);
    }
};

static int AppMain(HINSTANCE hInstance, int nCmdShow) {
    // 初始化通用控件
    INITCOMMONCONTROLSEX icex;
    icex.dwSize = sizeof(INITCOMMONCONTROLSEX);
    icex.dwICC = ICC_PROGRESS_CLASS | ICC_WIN95_CLASSES;
    InitCommonControlsEx(&icex);
    
    ModernPresentationTool app;
    
    if (!app.Initialize(hInstance)) {
        MessageBoxW(NULL, L"窗口初始化失败!", L"错误", MB_OK | MB_ICONERROR);
        return 1;
    }
    
    app.Show(nCmdShow);
    app.RunMessageLoop();
    
    return 0;
}

int WINAPI wWinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPWSTR lpCmdLine, int nCmdShow) {
    return AppMain(hInstance, nCmdShow);
}

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    return AppMain(hInstance, nCmdShow);
}