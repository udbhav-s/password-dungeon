#include <stdio.h>

unsigned int lock_key = 3735928559u;

int main() {
    printf("KEY DISPENSER\n");
    printf("The gate down the hall does not take numbers.\n");
    printf("It takes bits. All 32 of them.\n");
    printf("KEY = %u\n", lock_key);
    return 0;
}
