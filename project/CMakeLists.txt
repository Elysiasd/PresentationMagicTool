cmake_minimum_required(VERSION 3.16)
project(PresentationMagicTool)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# MSVC: 源文件按 UTF-8 解析，避免中文字符串乱码
if (MSVC)
    add_compile_options(/utf-8)
endif()

# 设置输出目录
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_SOURCE_DIR}/bin)

# Windows特定设置
if(WIN32)
    add_definitions(-DWIN32_LEAN_AND_MEAN)
    add_definitions(-DNOMINMAX)
    add_definitions(-DUNICODE)
    add_definitions(-D_UNICODE)
endif()

# 创建GUI版本
add_executable(${PROJECT_NAME} src/gui_main.cpp)

# Windows特定设置
if(WIN32)
    target_link_libraries(${PROJECT_NAME} user32 gdi32 comctl32 comdlg32 dwmapi msimg32 shell32)
    set_target_properties(${PROJECT_NAME} PROPERTIES WIN32_EXECUTABLE TRUE)
endif()

# 安装规则
install(TARGETS ${PROJECT_NAME} DESTINATION bin)
