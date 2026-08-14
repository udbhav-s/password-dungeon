#include <stdio.h>
#include <emscripten.h>

EM_ASYNC_JS(int, read_line, (char *destination, int size), {
    const input = await Module.readLine();
    stringToUTF8(input, destination, size);
    return lengthBytesUTF8(input);
});

EM_JS(void, notify_memory, (), {
    Module.onProgramMemoryChanged?.();
});

EM_JS(void, notify_success, (), {
    Module.onProgramSuccess?.();
});

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

ImportantData *visible_memory;

unsigned int get_buffer_address(void) {
    return (unsigned int) visible_memory;
}

unsigned int get_buffer_size(void) {
    return sizeof(ImportantData);
}

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

    visible_memory = &data;
    notify_memory();

    printf("Again, there is no password to enter here. Good luck\n");
    printf("Fine. Type something if it makes you feel better: \n");

    int status = read_line(input, sizeof(input));
    if (status > 0) status = sscanf(input, "%d", &guess);

    if (status != 1) {
        printf("Not even a number. Embarrassing\n");
        return 0;
    }
    if (guess != data.passwordNumber) {
        printf("No. It is in there somewhere though\n");
        return 0;
    }

    printf("...how did you find that\n");
    notify_success();
    return 0;
}
