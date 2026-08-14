#include <stdio.h>
#include <string.h>

// We don't want to allow bigger than this.
#define MAX_BALL_SIZE 30
// You can't even see it below this size.
#define MIN_BALL_SIZE 5

// This controls what it says.
int ball_size = 20;

int main() {
    char input[20];
    int new_size;

    printf("Hi... \n");
    fgets(input, sizeof(input), stdin);
    input[strcspn(input, "\n")] = '\0';

    if (sscanf(input, "%d", &new_size) != 1) {
        printf("Sorry, I don't know what that means\n");
        return 0;
    }

    if (new_size > MAX_BALL_SIZE) {
        printf("That is too big\n");
        return 0;
    }

    if (new_size < MIN_BALL_SIZE) {
        printf("That is too small\n");
        return 0;
    }

    ball_size = new_size;
    printf("Adjusted ball size\n");
    return 0;
}
