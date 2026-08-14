import { openDialog } from "../dialog";

const FINISH_FORM_URL = "https://forms.gle/BxUDL5igHDR4P8dc6";

export const ENTRY_DIALOG = [
  "Important message: The gets() function in C is considered very UNSAFE",
  "This is because you tell it a buffer to write to, but not the size",
  "C does not check if the input you give it actually fits in the variable",
  "which means the input can OVERFLOW out of the buffer into whatever comes after it...",
] as const;

export function onEnter(): void {
  openDialog(ENTRY_DIALOG);
}

export function showFinishPrompt(): void {
  openDialog(
    ["Congratulations on finishing the challenge!", "Open finish form link?"],
    undefined,
    {
      choices: [
        {
          label: "yes",
          onSelect: () => window.open(FINISH_FORM_URL, "_blank", "noopener,noreferrer"),
        },
        { label: "no", onSelect: () => {} },
      ],
    },
  );
}
