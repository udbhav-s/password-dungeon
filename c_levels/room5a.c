#include <stdio.h>
#include <emscripten.h>

#define MAX_CRATE_SIZE 6
#define MIN_CRATE_SIZE 1

int crate_size = 1;

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

unsigned int get_crate_size(void) {
    return (unsigned int) crate_size;
}

unsigned int get_buffer_address(void) {
    return (unsigned int) &crate_size;
}

unsigned int get_buffer_size(void) {
    return sizeof(crate_size);
}

int main() {
    char input[20];
    int new_size;

    printf("this does something: \n");
    int status = read_line(input, sizeof(input));
    notify_memory();
    if (status > 0) status = sscanf(input, "%d", &new_size);

    if (status != 1) {
        printf("Sorry, I don't know what that means\n");
        return 0;
    }
    if (new_size > MAX_CRATE_SIZE) {
        printf("That is too big\n");
        return 0;
    }
    if (new_size < MIN_CRATE_SIZE) {
        printf("That is too small\n");
        return 0;
    }

    crate_size = new_size;
    notify_memory();
    notify_success();
    printf("Adjusted crate size\n");
    return 0;
}
