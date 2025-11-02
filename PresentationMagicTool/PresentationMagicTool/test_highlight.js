// 测试代码高亮
function greet(name) {
    const message = `Hello, ${name}!`;
    console.log(message);
    
    if (name === 'World') {
        return true;
    }
    
    return false;
}

// 调用函数
const result = greet('World');
console.log('Result:', result);
