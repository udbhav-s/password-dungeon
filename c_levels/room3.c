#include <stdio.h>
#include <string.h>
#include <emscripten.h>

// We don't want to allow bigger than this
#define MAX_BALL_SIZE 30
// You can't even see it below this size
#define MIN_BALL_SIZE 5

// This controls what it says
int ball_size = 20;

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

unsigned int get_ball_size(void) {
    return (unsigned int) ball_size;
}

unsigned int get_buffer_address(void) {
    return (unsigned int) &ball_size;
}

unsigned int get_buffer_size(void) {
    return sizeof(ball_size);
}

int main() {
    char input[20];
    int new_size;

    printf("Hi... \n");
    // Read a line, then parse it like scanf("%%d", &new_size).
    int status = read_line(input, sizeof(input));
    notify_input();
    if (status > 0) status = sscanf(input, "%d", &new_size);

    if (status != 1) {
        printf("Sorry, I don't know what that means\n");
        return 0;
    }

    if (new_size > MAX_BALL_SIZE) {
        printf("That is too big\n");
        return 0;
    }

    if (new_size < MIN_BALL_SIZE) {
        printf("That is too small\n");
        return 0;
    }

    ball_size = new_size;
    notify_input();
    notify_success();
    printf("Adjusted ball size\n");
    return 0;
}
