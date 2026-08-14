#include <stdio.h>
#include <string.h>
#include <emscripten.h>

#define BUFFER_SIZE 20

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

int main() {
    char buffer[BUFFER_SIZE];
    const char *password = "supersecret1923";
    active_buffer = buffer;

    printf("turns out the last password wasn't super secure...\n");
    printf("I have decided to not mention it in the output "
           "anymore.\n");

    memset(buffer, 0, sizeof(buffer));
    printf("Enter password: \n");
    read_line(buffer, sizeof(buffer));
    notify_input();

    if (strcmp(password, buffer) == 0) {
        printf("success!\n");
        notify_success();
    } else {
        printf("nope!\n");
    }

    return 0;
}
