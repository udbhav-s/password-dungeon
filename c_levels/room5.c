#include <stdio.h>
#include <string.h>
#include <emscripten.h>

EM_ASYNC_JS(int, read_line, (char *destination, int size), {
    const input = await Module.readLine();
    stringToUTF8(input, destination, size);
    return lengthBytesUTF8(input);
});

EM_JS(void, notify_memory, (), {
    Module.onProgramMemoryChanged?.();
});

EM_JS(void, notify_success, (), {
    Module.onProgramSuccess?.();
});

char *visible_memory;

unsigned int get_buffer_address(void) {
    return (unsigned int) visible_memory;
}

unsigned int get_buffer_size(void) {
    return 20;
}

int main() {
    // Im DONE!
    // I will corrupt the source file
    // so you can no longer see the pass
    // you will never make it through this one
    char* password = "1mpossiblehidd3np4ss";

    char input[21];
    visible_memory = password;
    notify_memory();
    memset(input, 0, sizeof(input));
    printf("Enter password (level 100 impossible version): \n");
    read_line(input, sizeof(input));
    if (strcmp(password, input) == 0) {
        printf("Correct\n");
        notify_success();
    } else {
        printf("NOPE...\n");
    }
    return 0;
}
