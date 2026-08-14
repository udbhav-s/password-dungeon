#include <stdio.h>
#include <string.h>
#include <emscripten.h>

typedef struct MyData {
    char shopping_list[489];
    char favorite_colour[96];
    char password[18];
    char odyssey_review[768];
} MyData;

MyData data = {
    .shopping_list = "1. Apples 2. Baking powder 3. Shredded cheese 4. Milk 5. Eggs 6. Bread 7. Tomatoes 8. Rice 9. Coffee 10. Chocolate 11. Bananas 12. Flour 13. Butter 14. Yogurt 15. Spinach 16. Pasta 17. Garlic 18. Onions 19. Potatoes 20. Carrots 21. Cereal 22. Orange juice 23. Tea 24. Sugar 25. Salt 26. Black pepper 27. Olive oil 28. Beans 29. Lentils 30. Tortillas 31. Avocados 32. Lemons 33. Strawberries 34. Blueberries 35. Chicken 36. Tofu 37. Mushrooms 38. Broccoli 39. Ice cream 40. Sparkling water",
    .favorite_colour = "MY FAVORITE COLOUR IS VIOLET. THE NEXT VARIABLE IS THE PASSWORD",
    .password = "structn4v1gator67",
    .odyssey_review = "Christopher Nolan's 250 million dollar action movie version of Homer's ancient Greek poem is an entertaining way to hide from the high temperatures for a few hours. Nolan's trademark jumps and twists in the narrative structure are relatively easy to follow, and appropriate for The Odyssey, a narrative of tales nested in tales. My teenagers had a good time. Unlike some of Nolan's other films, The Odyssey is not boring, thanks to the source material, which is impossible to mess up entirely. It's a family-friendly audiovisual spectacle, like an elaborate Fourth of July fireworks display - and with about the same level of narrative and emotional depth.",
};

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

unsigned int get_buffer_address(void) {
    return (unsigned int) &data;
}

unsigned int get_buffer_size(void) {
    return sizeof(data);
}

int main() {
    char input[20];

    notify_memory();
    memset(input, 0, sizeof(input));
    printf("Good luck finding the password haha\n");
    read_line(input, sizeof(input));

    if (strcmp(data.password, input) == 0) {
        printf("Correct\n");
        notify_success();
    } else {
        printf("Nice try, but wrong.\n");
    }
    return 0;
}
