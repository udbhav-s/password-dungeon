#include <stdio.h>
#include <string.h>
#include <emscripten.h>

#define gets gets_shim

EM_ASYNC_JS(char *, gets_shim, (char *destination), {
    const input = await Module.readLine();
    const inputSize = lengthBytesUTF8(input);
    stringToUTF8(input, destination, inputSize + 1);
    return destination;
});

EM_JS(void, notify_memory, (), {
    Module.onProgramMemoryChanged?.();
});

EM_JS(void, notify_success, (), {
    Module.onProgramSuccess?.();
});

typedef struct UserData {
    char reminder[8];
    int daysSinceLastExplosion;
    int date;
    char inputPassword[8];
    int myFavoriteSpiderManMovie;
    char unmodifiable[8];
} UserData;

UserData data = {
    .reminder = "dinner",
    .daysSinceLastExplosion = 3,
    .date = 20260814,
    .inputPassword = "",
    .myFavoriteSpiderManMovie = 2,
    .unmodifiable = "nope",
};

unsigned int get_buffer_address(void) {
    return (unsigned int) &data;
}

unsigned int get_buffer_size(void) {
    return sizeof(data);
}

int main() {
    notify_memory();
    printf("Enter something: \n");
    gets(data.inputPassword);
    notify_memory();

    // There is no way you could change this string...
    if (strcmp(data.unmodifiable, "pass") == 0) {
        printf("WHAT. How did you do this???\n");
        notify_success();
    } else {
        printf("Still locked.\n");
    }
    return 0;
}
