#include <stdio.h>
#include <string.h>
#include <emscripten.h>

// INSTRUMENTATION

#define gets gets_shim

EM_ASYNC_JS(char *, gets_shim, (char *destination), {
    const input = await Module.readLine();
    const inputSize = lengthBytesUTF8(input);

    stringToUTF8(input, destination, inputSize + 1);

    return destination;
});

EM_JS(void, notify_input, (), {
    Module.onProgramMemoryChanged?.();
});

EM_JS(void, notify_success, (), {
    Module.onProgramSuccess?.();
});

static char *active_buffer;
int buffer_size;

unsigned int get_buffer_address(void) {
    return (unsigned int) active_buffer;
}

unsigned int get_buffer_size(void) {
    return buffer_size;
}

// PROGRAM

typedef struct UserData {
    char password[8];
    int auth;
} UserData;

int main() {
    UserData data;
    data.auth = 1;
    memset(data.password, 0, sizeof(data.password));

    // set up emscripten instrumentation
    active_buffer = (char *) &data;
    buffer_size = sizeof(UserData);
    notify_input();
    
    printf("Enter the password:\n");
    // Any input of 8 or more characters overwrites auth
    gets(data.password);
    notify_input();

    if (data.auth != 1) {
        printf("\nSuccess!");
        printf("\n");
        notify_success();
    } else {
        printf("Wrong, try again!");
        printf("\n");
    }
}
