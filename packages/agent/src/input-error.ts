/** An error whose message is written for the owner (the web app shows it as-is; everything else is masked). */
export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}
