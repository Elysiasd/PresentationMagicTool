def hello_world():
    """Python Hello World示例"""
    message = "Python World"
    print(f"Hello, {message}!")
    
    # 演示Python特性
    numbers = [1, 2, 3, 4, 5]
    total = sum(numbers)
    
    print(f"Sum of numbers: {total}")
    
    # 列表推导式
    squares = [x**2 for x in numbers]
    print(f"Squares: {squares}")
    
    # 字典
    person = {
        "name": "Alice",
        "age": 30,
        "city": "Beijing"
    }
    
    for key, value in person.items():
        print(f"{key}: {value}")

if __name__ == "__main__":
    hello_world()
