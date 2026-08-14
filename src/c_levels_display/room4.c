#include <stdio.h>
#include <string.h>

char input[20];

int main() {
    char password[] = "newsupersecretFINAL";

    // Mess with the password
    // so the user doesn't know what it is >:)
    password[0] = password[5];
    password[3] = password[10];
    password[5] = password[2];

    memset(input, 0, sizeof(input));
    printf("You will not guess this one: \n");
    fgets(input, sizeof(input), stdin);
    input[strcspn(input, "\n")] = '\0';

    if (strcmp(password, input) == 0) {
        printf("Correct\n");
    } else {
        printf("you are WRONG !!!\n");
    }
    return 0;
}
