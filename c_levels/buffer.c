#include <stdio.h>
#include <string.h>

typedef struct UserData {
    char password[8];
    int auth;
} UserData;

int main() {
    UserData data;
    data.auth = 1;
    memset(data.password, 0, 8);

    // memset(&data.password, 0, 8);
    printf("Enter the password: ");
    // Overflow with any character
    scanf("%s", data.password);
    // clear_buffer();

    if (data.auth != 1) {
        printf("\nSuccess!");
        printf("\n");
    } else {
        printf("Wrong, try again!");
        printf("\n");
    }
}