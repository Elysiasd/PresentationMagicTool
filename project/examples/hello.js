// JavaScript Hello World示例
function helloWorld() {
    const message = "JavaScript World";
    console.log(`Hello, ${message}!`);
    
    // 演示JavaScript特性
    const numbers = [1, 2, 3, 4, 5];
    const sum = numbers.reduce((acc, num) => acc + num, 0);
    
    console.log(`Sum of numbers: ${sum}`);
    
    // 箭头函数
    const squares = numbers.map(x => x ** 2);
    console.log(`Squares: ${squares}`);
    
    // 对象
    const person = {
        name: "Bob",
        age: 25,
        city: "Shanghai",
        greet() {
            return `Hi, I'm ${this.name}`;
        }
    };
    
    console.log(person.greet());
    
    // Promise示例
    const promise = new Promise((resolve) => {
        setTimeout(() => resolve("Promise resolved!"), 1000);
    });
    
    promise.then(result => console.log(result));
}

// 类定义
class Calculator {
    constructor() {
        this.history = [];
    }
    
    add(a, b) {
        const result = a + b;
        this.history.push(`${a} + ${b} = ${result}`);
        return result;
    }
    
    getHistory() {
        return this.history;
    }
}

// 运行示例
helloWorld();

const calc = new Calculator();
console.log(`2 + 3 = ${calc.add(2, 3)}`);
console.log(`History: ${calc.getHistory()}`);
