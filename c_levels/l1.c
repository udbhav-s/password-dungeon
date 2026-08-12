#include <stdio.h>
#include <string.h>

void clear_buffer(void) {
    int c;
    // Read characters until we find a newline or reach EOF
    while ((c = getchar()) != '\n' && c != EOF);
}

int main() {
    char buffer[10];

    char* password = "password";

    int won = 0;
    do {
        memset(buffer, 0, sizeof(buffer));
        printf("Enter the password (it is totally not 'password'): ");
        fgets(buffer, sizeof(buffer), stdin);
        clear_buffer();

        if (memcmp(password, buffer, 8) == 0) {
            printf("\nSuccess!");
            printf("\n");
        } else {
            printf("Wrong, try again!");
            printf("\n");
        }
    } while (won == 0);
}