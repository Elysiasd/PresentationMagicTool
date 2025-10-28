#include <iostream>
#include <string>

class HelloWorld {
public:
    HelloWorld(const std::string& message) : message_(message) {}
    
    void greet() {
        std::cout << "Hello, " << message_ << "!" << std::endl;
    }
    
private:
    std::string message_;
};

int main() {
    HelloWorld hello("C++ World");
    hello.greet();
    
    // 演示一些C++特性
    auto numbers = {1, 2, 3, 4, 5};
    int sum = 0;
    
    for (const auto& num : numbers) {
        sum += num;
    }
    
    std::cout << "Sum of numbers: " << sum << std::endl;
    
    return 0;
}
