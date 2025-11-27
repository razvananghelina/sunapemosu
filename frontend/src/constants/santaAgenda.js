// Agenda pentru conversatia cu Mos Craciun
// Fiecare pas poate avea:
// - audio: calea catre un audio predefinit (optional)
// - video: ce video sa playeze (optional)
// - shouldListenOnComplete: daca pornim microfonul dupa playback (default: true)
// - prompt: daca exista, trimitem la ChatGPT si facem flowul normal (optional)
// - speakingState: ce stare de speaking sa foloseasca (speaking_normal, speaking_amused, speaking_amazed)
// - id: identificator unic pentru pas

// Base URL pentru assets
const BASE_URL = import.meta.env.BASE_URL;

// Configurare agenda conversatie
// Aplicatia parcurge acest array in ordine
export const SANTA_AGENDA = [
  {
    id: 'intro',
    name: 'Introducere',
    video: 'intro',
    shouldListenOnComplete: false, // Nu ascultam dupa intro, trecem direct la cunoastere
  },
  {
    id: 'cunoastere',
    name: 'Cunoastere',
    // Acest pas foloseste GPT pentru a afla informatii despre copii
    prompt: `Saluta copilul/copiii calduros si afla cu cine vorbesti.
IMPORTANT: Din raspunsul copilului, trebuie sa extragi si sa returnezi in JSON:
- childGender: "baiat", "fata", sau "mixed" daca sunt mai multi de genuri diferite
- childCount: numarul de copii prezenti (1, 2, 3, etc)
- childNames: array cu numele copiilor
- childAges: array cu varstele (daca le aflii)

Intreaba-i cum ii cheama si cati ani au. Fii surprins si fericit ca vorbesti cu ei!`,
    shouldListenOnComplete: true,
    speakingState: 'speaking_normal',
  },
  {
    id: 'info_initiale',
    name: 'Informatii Initiale',
    audio: 'informatii.mp3', // Audio predefinit
    video: 'polulnord', // Video dupa audio
    shouldListenOnComplete: true,
    speakingState: 'speaking_normal',
  },
  {
    id: 'secrete',
    name: 'Secrete si Surprize',
    // Foloseste GPT pentru a mentiona informatii secrete despre copii
    prompt: `Foloseste informatiile secrete despre copil/copii pentru a-i surprinde.
Mentioneaza hobby-uri, prieteni, animale, realizari - tot ce stii despre ei!
Arata-le ca esti magic si stii totul despre ei!
Pune intrebari despre ce le place sa faca.`,
    shouldListenOnComplete: true,
    speakingState: 'speaking_amazed',
  },
  {
    id: 'polul_nord',
    name: 'Polul Nord',
    // Audio predefinit - nu mai folosim GPT pentru acest pas
    // audio: `${BASE_URL}audio/polul_nord.mp3`,  // TODO: Inlocuieste cu audio real
    prompt: `Povesteste-le despre Polul Nord si elfii tai care lucreaza la cadouri.
Spune-le ca ai foarte multa treaba pentru ca se apropie Craciunul.
Fii entuziast despre cadourile pe care le pregatesc elfii!`,
    video: 'elfs_working', // Se va rula dupa ce termina de vorbit
    shouldListenOnComplete: true,
    speakingState: 'speaking_normal',
  },
  {
    id: 'suspans_lista',
    name: 'Suspans Lista',
    prompt: `Intreaba-i daca vor sa afle daca sunt pe lista copiilor cuminti.
Creeaza suspans si anticipatie: "Oare sa fii pe lista copiilor cuminti?"
NU arata lista inca - doar vorbeste despre ea si creeaza emotie!`,
    shouldListenOnComplete: true,
    speakingState: 'speaking_normal',
  },
  {
    id: 'verificare_lista',
    name: 'Verificare Lista',
    prompt: `Spune-le ca verifici lista ta magica.
Pentru fiecare copil, spune ca il cauti pe lista.
Dupa ce "gasesti" fiecare copil, confirma ca e pe lista copiilor cuminti!
Fii foarte fericit ca sunt cuminti!`,
    video: 'kids_list', // Se va rula pentru fiecare copil
    shouldListenOnComplete: true,
    speakingState: 'speaking_amazed',
  },
  {
    id: 'zbor_magic_intro',
    name: 'Zbor Magic Introducere',
    prompt: `Spune copilului ca pentru ca a fost asa cuminte, vrei sa ii arati ceva special.
Intreaba: "Vrei sa vezi cum e sa zbori cu mine si renii mei?"
Asteapta raspunsul lor - NU arata video-ul inca!`,
    shouldListenOnComplete: true,
    speakingState: 'speaking_normal',
  },
  {
    id: 'zbor_magic',
    name: 'Zbor Magic',
    prompt: `Copilul a acceptat! Spune-i sa se tina bine ca faci o magie!
Spune ceva de genul: "Tine-te bine! Abracadabra!" si porneste zborul magic!`,
    video: 'flight',
    shouldListenOnComplete: true,
    speakingState: 'speaking_amazed',
  },
  {
    id: 'dupa_zbor',
    name: 'Dupa Zbor',
    prompt: `Intreaba-l cum i s-a parut zborul magic!
Fii curios si entuziast sa aflii ce a simtit!`,
    shouldListenOnComplete: true,
    speakingState: 'speaking_normal',
  },
  {
    id: 'dorinte',
    name: 'Dorinte',
    prompt: `Intreaba-l ce isi doreste de Craciun.
Asculta cu atentie si reactioneaza la fiecare dorinta.
Fii entuziast si promite ca vei incerca sa le aduci!
Daca are mai multe dorinte, asculta-le pe toate.`,
    shouldListenOnComplete: true,
    speakingState: 'speaking_normal',
  },
  {
    id: 'conversatie_libera',
    name: 'Conversatie Libera',
    prompt: `Continua conversatia natural cu copilul/copiii.
Raspunde la intrebarile lor, povesteste despre Craciun, despre reni, despre elfi.
Fii prietenos si plin de caldura. Poti intreba ce mai fac, ce au facut la scoala, etc.
Nu te grabi - bucura-te de conversatie!`,
    shouldListenOnComplete: true,
    speakingState: 'speaking_normal',
    isLooping: true, // Acest pas se repeta pana la timeout
  },
  {
    id: 'incheiere',
    name: 'Incheiere',
    prompt: `Spune-le ca din pacate trebuie sa pleci pentru ca ai foarte mult de lucru la atelierul de jucarii.
Ureaza-le sarbatori frumoase si spune-le sa fie in continuare copii cuminti!
Spune-le ca te vei intoarce in noaptea de Craciun cu cadouri!
Incheie cu caldura si Ho Ho Ho!`,
    shouldListenOnComplete: false, // Dupa incheiere nu mai asteptam raspuns
    speakingState: 'speaking_normal',
    autoEndCall: true, // Auto-inchide apelul dupa acest pas
  },
];

// Video-uri speciale disponibile pentru agenda (cu sunet propriu)
export const AGENDA_SPECIAL_VIDEOS = ['elfs_working', 'kids_list', 'flight', 'polulnord'];

// Starile de speaking disponibile
export const SPEAKING_STATES = {
  speaking_normal: 'speaking_normal',
  speaking_amused: 'speaking_amused',
  speaking_amazed: 'speaking_amazed',
};

// Functie pentru a obtine pasul curent din agenda
export const getAgendaStep = (stepId) => {
  return SANTA_AGENDA.find(step => step.id === stepId);
};

// Functie pentru a obtine urmatorul pas din agenda
export const getNextAgendaStep = (currentStepId) => {
  const currentIndex = SANTA_AGENDA.findIndex(step => step.id === currentStepId);
  if (currentIndex === -1 || currentIndex >= SANTA_AGENDA.length - 1) {
    return null;
  }
  return SANTA_AGENDA[currentIndex + 1];
};

// Functie pentru a obtine promptul simplificat pentru GPT
// (GPT nu mai gestioneaza agenda, doar raspunde la prompt-uri specifice)
export const getSimplifiedPrompt = (step, childInfo, conversationSummary, childState) => {
  if (!step || !step.prompt) return null;

  let prompt = step.prompt;

  // Adaugam contextul despre copii daca avem
  if (childState) {
    let childContext = '\n\nINFORMATII CUNOSCUTE DESPRE COPII:\n';
    if (childState.childNames && childState.childNames.length > 0) {
      childContext += `- Nume: ${childState.childNames.join(', ')}\n`;
    }
    if (childState.childAges && childState.childAges.length > 0) {
      childContext += `- Varste: ${childState.childAges.join(', ')}\n`;
    }
    if (childState.childGender) {
      childContext += `- Gen: ${childState.childGender}\n`;
    }
    if (childState.childCount) {
      childContext += `- Numar copii: ${childState.childCount}\n`;
    }
    prompt += childContext;
  }

  // Adaugam sumarul conversatiei
  if (conversationSummary) {
    prompt += `\n\nSUMAR CONVERSATIE:\n${conversationSummary}`;
  }

  return prompt;
};
