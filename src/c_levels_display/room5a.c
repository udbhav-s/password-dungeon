#include <stdio.h>
#include <string.h>

#define MAX_CRATE_SIZE 6
#define MIN_CRATE_SIZE 1

int crate_size = 1;

int main() {
    char input[20];
    int new_size;

    printf("this does something: \n");
    fgets(input, sizeof(input), stdin);
    input[strcspn(input, "\n")] = '\0';

    if (sscanf(input, "%d", &new_size) != 1) {
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
    printf("Adjusted crate size\n");
    return 0;
}
