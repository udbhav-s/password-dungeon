#include <stdio.h>
#include <string.h>

#define BUFFER_SIZE 20

int main() {
    char buffer[BUFFER_SIZE];
    const char *password = "supersecret1923";

    printf("turns out the last password wasn't super secure...\n");
    printf("I have decided to not mention it in the output "
           "anymore.\n");

    memset(buffer, 0, sizeof(buffer));
    printf("Enter password: \n");
    fgets(buffer, sizeof(buffer), stdin);
    buffer[strcspn(buffer, "\n")] = '\0';

    if (strcmp(password, buffer) == 0) {
        printf("success!\n");
    } else {
        printf("nope!\n");
    }

    return 0;
}
