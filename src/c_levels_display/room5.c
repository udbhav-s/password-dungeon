#include <stdio.h>
#include <string.h>

int main() {
    // Im DONE!
    // I will corrupt the source file
    // so you can no longer see the pass
    // you will never make it through this one
    char *password = "1mpossiblehidd3np4ss";

    char input[21];
    memset(input, 0, sizeof(input));
    printf("Enter password (level 100 impossible version): \n");
    fgets(input, sizeof(input), stdin);
    input[strcspn(input, "\n")] = '\0';

    if (strcmp(password, input) == 0) {
        printf("Correct\n");
    } else {
        printf("NOPE...\n");
    }
    return 0;
}
