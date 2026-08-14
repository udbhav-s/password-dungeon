#include <stdio.h>
#include <emscripten.h>

EM_JS(void, notify_memory, (), {
    Module.onProgramMemoryChanged?.();
});

EM_JS(void, notify_success, (), {
    Module.onProgramSuccess?.();
});

unsigned int lock_key = 3735928559u;

unsigned int get_buffer_address(void) {
    return (unsigned int) &lock_key;
}

unsigned int get_buffer_size(void) {
    return sizeof(lock_key);
}

int main() {
    notify_memory();
    printf("KEY DISPENSER\n");
    printf("The gate down the hall does not take numbers.\n");
    printf("It takes bits. All 32 of them.\n");
    printf("KEY = %u\n", lock_key);
    notify_success();
    return 0;
}
