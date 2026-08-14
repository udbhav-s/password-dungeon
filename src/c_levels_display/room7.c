#include <stdio.h>
#include <string.h>

// The vault keeps its code in a plain int.
// I scrubbed the digits out of the source,
// so all you get is four bytes of memory.
// Four bytes you cannot read the right way.
int access_code = 1234567890;

int main() {
    char input[20];
    int guess;

    printf("VAULT LOCK 7\n");
    printf("The access code is sitting right here in my memory.\n");
    printf("Go on. Read it.\n");
    printf("Enter access code: \n");

    fgets(input, sizeof(input), stdin);
    input[strcspn(input, "\n")] = '\0';

    if (sscanf(input, "%d", &guess) != 1) {
        printf("That is not a number\n");
        return 0;
    }
    if (guess != access_code) {
        printf("WRONG. The bytes were right in front of you\n");
        return 0;
    }

    printf("Unlocked\n");
    return 0;
}
