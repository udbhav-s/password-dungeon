#include <stdio.h>
#include <string.h>
#include <emscripten.h>

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

char input[20];

unsigned int get_buffer_address(void) {
    return (unsigned int) input;
}

unsigned int get_buffer_size(void) {
    return sizeof(input);
}

int main() {
    char* password = "newsupersecretFINAL";

    // Mess with the password
    // so the user doesn't know what it is >:)
    password[0] = password[5];
    password[3] = password[10];
    password[5] = password[2];

    memset(input, 0, sizeof(input));
    printf("You will not guess this one: \n");
    read_line(input, sizeof(input));
    notify_input();
    if (strcmp(password, input) == 0) {
        printf("Correct\n");
        notify_success();
    } else {
        printf("you are WRONG !!!\n");
    }
    return 0;
}
