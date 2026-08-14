#include <stdio.h>
#include <string.h>

#define BUFFER_SIZE 10

int main() {
    char buffer[BUFFER_SIZE];
    const char *password = "password";
    int won = 0;

    do {
        memset(buffer, 0, sizeof(buffer));
        printf("Enter the password "
               "(it is totally not 'password'):\n");

        fgets(buffer, sizeof(buffer), stdin);
        buffer[strcspn(buffer, "\n")] = '\0';

        if (memcmp(password, buffer, 8) == 0) {
            printf("\nSuccess!");
            printf("\n");
            won = 1;
        } else {
            printf("Wrong, try again!");
            printf("\n");
        }
    } while (won == 0);
}
