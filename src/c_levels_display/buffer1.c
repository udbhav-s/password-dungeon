#include <stdio.h>
#include <string.h>

typedef struct UserData {
    char password[8];
    int auth;
} UserData;

int main() {
    UserData data;
    data.auth = 1;
    memset(data.password, 0, sizeof(data.password));

    printf("Enter the password:\n");

    // Any input of 8 or more characters overwrites auth.
    gets(data.password);

    if (data.auth != 1) {
        printf("\nSuccess!");
        printf("\n");
    } else {
        printf("Wrong, try again!");
        printf("\n");
    }
}
