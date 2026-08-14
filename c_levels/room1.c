#include <stdio.h>
#include <string.h>
#include <emscripten.h>

// INSTRUMENTATION

#define BUFFER_SIZE 10

// The manager provides a line when the terminal submits input.
/**
Explanation:
There is a FIFO queue of promises. When the C program requests
input,
it queues a promise with the input request.
When the JS program enters input, it gets the next promise in queue,
and resolves it with the received input.
This returns a value to the awaited input in EM_ASYNC_JS
and allows the code to continue. 
*/
EM_ASYNC_JS(int, read_line, (char *destination, int size), {
    const input = await Module.readLine();
    stringToUTF8(input, destination, size);
    return lengthBytesUTF8(input);
});

EM_JS(void, notify_input, (), {
    Module.onProgramMemoryChanged?.();
});

EM_JS(void, notify_success, (), {
    Module.onProgramSuccess?.();
});

static char *active_buffer;

unsigned int get_buffer_address(void) {
    return (unsigned int) active_buffer;
}

unsigned int get_buffer_size(void) {
    return BUFFER_SIZE;
}

// Program

void clear_buffer(void) {
    int c;
    // Read characters until we find a newline or reach EOF
    while ((c = getchar()) != '\n' && c != EOF);
}

int main() {
    char buffer[BUFFER_SIZE];
    active_buffer = buffer;

    char* password = "password";

    int won = 0;
    do {
        memset(buffer, 0, sizeof(buffer));
        printf("Enter the password "
               "(it is totally not 'password'):\n");
        read_line(buffer, sizeof(buffer));
        notify_input();

        if (memcmp(password, buffer, 8) == 0) {
            printf("\nSuccess!");
            printf("\n");
            won = 1;
            notify_success();
        } else {
            printf("Wrong, try again!");
            printf("\n");
        }
    } while (won == 0);
}
