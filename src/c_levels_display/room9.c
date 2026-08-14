#include <stdio.h>
#include <string.h>

// Every field is 4 bytes wide, so the struct is one long run of words in memory
// with nothing to tell them apart. Good luck finding the one that matters.
typedef struct {
    char pass[4];
    char stuff[4];
    int howManyPushUpsIcanDo;
    int pagesInMyNewBook;
    int cupsOfCoffeeToday;
    int stepsToTheFridge;
    int unreadEmails;
    int socksInTheDrawer;
    int highScore;
    int daysSinceLastBug;
    int printerJamCount;
    int lunchBudget;
    int keyboardsDestroyed;
    int hoursOfSleep;
    int tabsOpen;
    int plantsStillAlive;
    int passwordNumber;
    int meetingsThisWeek;
    int rubberDucks;
    int linesOfCommentedCode;
    int cablesInTheDrawer;
    int semicolonsForgotten;
    int snacksRemaining;
    int excusesPrepared;
} ImportantData;

int main() {
    ImportantData data = {
        .pass = "nope",
        .stuff = "junk",
        .howManyPushUpsIcanDo = 12,
        .pagesInMyNewBook = 348,
        .cupsOfCoffeeToday = 6,
        .stepsToTheFridge = 27,
        .unreadEmails = 1904,
        .socksInTheDrawer = 23,
        .highScore = 74210,
        .daysSinceLastBug = 0,
        .printerJamCount = 41,
        .lunchBudget = 15,
        .keyboardsDestroyed = 3,
        .hoursOfSleep = 5,
        .tabsOpen = 212,
        .plantsStillAlive = 1,
        .passwordNumber = 60817493,
        .meetingsThisWeek = 19,
        .rubberDucks = 8,
        .linesOfCommentedCode = 9631,
        .cablesInTheDrawer = 57,
        .semicolonsForgotten = 264,
        .snacksRemaining = 2,
        .excusesPrepared = 88,
    };

    char input[24];
    int guess;

    printf("Again, there is no password to enter here. Good luck\n");
    printf("Fine. Type something if it makes you feel better: \n");

    fgets(input, sizeof(input), stdin);
    input[strcspn(input, "\n")] = '\0';

    if (sscanf(input, "%d", &guess) != 1) {
        printf("Not even a number. Embarrassing\n");
        return 0;
    }
    if (guess != data.passwordNumber) {
        printf("No. It is in there somewhere though\n");
        return 0;
    }

    printf("...how did you find that\n");
    return 0;
}
