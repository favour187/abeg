const NAMES_DEFAULT = ["ada", "tunde", "musa", "chidera", "amaka", "kemi", "zainab"];

const LANGS = [
  { code: "en-NG", label: "Naija English / Pidgin" },
  { code: "yo", label: "Yorùbá" },
  { code: "ig", label: "Igbo" },
  { code: "ha", label: "Hausa" },
  { code: "en-GB", label: "English" },
  { code: "fr-FR", label: "Français" },
  { code: "es-ES", label: "Español" },
  { code: "sw", label: "Kiswahili" },
  { code: "ar", label: "العربية" },
  { code: "pt-BR", label: "Português" },
];

const DEMO_SPEECH = [
  "abeg make I pay light bill before friday, 5k something",
  "tell ada to carry the generator tonight o",
  "i don send the receipt to musa already",
  "chidera go submit the form by 4pm plus book the hall before monday",
  "no forget to recharge the meter tomorrow morning",
  "kemi no go attend the meeting, she dey travel",
];

const TEST_SET = [
  { said: "make I pay light bill before friday", expect: { tasks: 1, owner: "Me", due: "friday" } },
  { said: "i don pay the light bill already", expect: { tasks: 1, done: true } },
  { said: "tell ada to carry the generator tonight", expect: { tasks: 1, owner: "Ada", due: "tonight" } },
  { said: "ada go buy rice tomorrow morning", expect: { tasks: 1, owner: "Ada", due: "tomorrow" } },
  { said: "no forget to send the receipt to musa", expect: { tasks: 1, owner: "Me" } },
  { said: "chidera go submit the form by 4pm", expect: { tasks: 1, owner: "Chidera", due: "4pm" } },
  { said: "we go meet on saturday plus book the hall before friday", expect: { tasks: 2, owner: "Us" } },
  { said: "i go call am tomorrow and then send the money tonight", expect: { tasks: 2, owner: "Me" } },
  { said: "musa don fix the printer", expect: { tasks: 1, owner: "Musa", done: true } },
  { said: "abeg remind me to recharge the meter 5k before tonight", expect: { tasks: 1, owner: "Me", due: "tonight" } },
  { said: "kemi no go attend the meeting", expect: { tasks: 0 } },
  { said: "submit the project before friday and also pay the 12k balance by monday", expect: { tasks: 2, conflict: 0 } },
  { said: "i go pay am before friday no wait tomorrow", expect: { tasks: 1, conflict: 1 } },
  { said: "who go buy bread?", expect: { tasks: 1, unassigned: 1 } },
  { said: "good morning everybody", expect: { tasks: 0 } },
  { said: "make amaka no forget to print the posters on monday", expect: { tasks: 1, owner: "Amaka", due: "monday" } },
  { said: "i wan recharge my phone before 9am", expect: { tasks: 1, owner: "Me", due: "9am" } },
  { said: "tunde go drop the package for ada tomorrow evening", expect: { tasks: 1, owner: "Tunde", due: "tomorrow" } },
  { said: "the meeting don start", expect: { tasks: 1, done: true } },
  { said: "send am now", expect: { tasks: 1, owner: "Me" } },
  { said: "make we no forget say na saturday we dey bury the cable", expect: { tasks: 1, owner: "Us", due: "saturday" } },
  { said: "ask kemi to update the budget sheet tonight", expect: { tasks: 1, owner: "Kemi", due: "tonight" } },
];
