# 测试 Python 代码执行
print("🎉 Hello, PresentationMagicTool!")
print("=" * 50)

# 计算斐波那契数列
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print("📊 前 10 个斐波那契数：")
for i in range(10):
    print(f"F({i}) = {fibonacci(i)}")

print("=" * 50)

# 简单的数学运算
a = 10
b = 20
print(f"➕ {a} + {b} = {a + b}")
print(f"✖️ {a} * {b} = {a * b}")
print(f"➗ {b} / {a} = {b / a}")

# 测试中文和 emoji
print("\n✅ 代码执行成功！")
print("🐍 Python 很棒！")
print("🌟 支持中文和 emoji 输出")
