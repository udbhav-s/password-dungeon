#include <stdio.h>
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

// The vault keeps its code in a plain int.
// I scrubbed the digits out of the source,
// so all you get is four bytes of memory.
// Four bytes you cannot read the right way.
int access_code = 1234567890;

unsigned int get_buffer_address(void) {
    return (unsigned int) &access_code;
}

unsigned int get_buffer_size(void) {
    return sizeof(access_code);
}

int main() {
    char input[20];
    int guess;

    notify_memory();
    printf("VAULT LOCK 7\n");
    printf("The access code is sitting right here in my memory.\n");
    printf("Go on. Read it.\n");
    printf("Enter access code: \n");

    int status = read_line(input, sizeof(input));
    if (status > 0) status = sscanf(input, "%d", &guess);

    if (status != 1) {
        printf("That is not a number\n");
        return 0;
    }
    if (guess != access_code) {
        printf("WRONG. The bytes were right in front of you\n");
        return 0;
    }

    printf("Unlocked\n");
    notify_success();
    return 0;
}
