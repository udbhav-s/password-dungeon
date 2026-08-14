#include <stdio.h>
#include <string.h>

typedef struct UserData {
    char reminder[8];
    int daysSinceLastExplosion;
    int date;
    char inputPassword[8];
    int myFavoriteSpiderManMovie;
    char unmodifiable[8];
} UserData;

UserData data = {
    .reminder = "dinner",
    .daysSinceLastExplosion = 3,
    .date = 20260814,
    .inputPassword = "",
    .myFavoriteSpiderManMovie = 2,
    .unmodifiable = "nope",
};

int main() {
    printf("Enter something: \n");

    // This intentionally unsafe input can overwrite adjacent fields.
    gets(data.inputPassword);

    // There is no way you could change this string...
    if (strcmp(data.unmodifiable, "pass") == 0) {
        printf("WHAT. How did you do this???\n");
    } else {
        printf("Still locked.\n");
    }
    return 0;
}
