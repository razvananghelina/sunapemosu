// Agenda pentru conversația cu Moș Crăciun
// Fiecare pas poate avea:
// - audio: calea către un audio predefinit (opțional)
// - video: ce video să playeze (opțional)
// - shouldListenOnComplete: dacă pornim microfonul după playback (default: true)
// - prompt: dacă există, trimitem la ChatGPT și facem flowul normal (opțional)
// - speakingState: ce stare de speaking să folosească (speaking_normal, speaking_amused, speaking_amazed)
// - autoInitiate: dacă Moșul trebuie să vorbească primul fără să aștepte user-ul (default: false)
// - multiTurn: dacă pasul permite mai multe interacțiuni (GPT decide când trecem mai departe cu readyForNext)
// - id: identificator unic pentru pas

// Base URL pentru assets
const BASE_URL = import.meta.env.BASE_URL;

// Configurare agenda conversație
// Aplicația parcurge acest array în ordine
export const SANTA_AGENDA = [
  {
    id: 'intro',
    name: 'Introducere',
    video: 'intro',
    shouldListenOnComplete: true, // Ascultăm numele copilului după intro
  },

  {
    id: 'cunoastere',
    name: 'Cunoaștere',
    // GPT răspunde la numele copilului și continuă conversația
    prompt: `Copilul tocmai ți-a spus cum îl cheamă. Răspunde-i călduros!
IMPORTANT: Din răspunsul copilului, trebuie să extragi și să returnezi în JSON:
- childGender: "băiat", "fată", sau "mixed" dacă sunt mai mulți de genuri diferite
- childCount: numărul de copii prezenți (1, 2, 3, etc)
- childNames: array cu numele copiilor
- childAges: array cu vârstele (dacă le afli)

Fii surprins și fericit că vorbești cu ei! Spune-le că îi cunoști și știi multe despre ei.`,
    shouldListenOnComplete: true,
    speakingState: 'speaking_normal',
    multiTurn: true, // GPT decide când trecem mai departe cu readyForNext
  },
  {
    id: 'secrete',
    name: 'Secrete și Surprize',
    // Folosește GPT pentru a menționa informații secrete despre copii
    prompt: `Folosește informațiile secrete despre copil/copii pentru a-i surprinde.
Menționează hobby-uri, prieteni, animale, realizări - tot ce știi despre ei!
Arată-le că ești magic și știi totul despre ei!
Pune întrebări despre ce le place să facă.

IMPORTANT pentru readyForNext:
- Setează readyForNext: false dacă ai pus o întrebare și aștepți răspuns
- Setează readyForNext: false dacă copilul pare că vrea să mai povestească
- Setează readyForNext: true DOAR când simți că ai discutat suficient despre secrete/hobby-uri și e timpul să trecem la Polul Nord
- Obiectiv: 2-3 schimburi de replici pe acest subiect înainte de a trece mai departe`,
    shouldListenOnComplete: true, // Ascultăm răspunsul copilului
    multiTurn: true, // GPT decide când trecem mai departe
    speakingState: 'speaking_amazed',
  },
  {
    id: 'info_initiale',
    name: 'Informații Inițiale',
    audio: 'informatii.mp3', // Audio predefinit
    video: 'polulnord', // Video după audio
    shouldListenOnComplete: false, // După video, continuăm automat cu GPT
    speakingState: 'speaking_normal',
  },
  {
    id: 'polul_nord',
    name: 'Polul Nord',
    prompt: `Povestește-le despre Polul Nord și elfii tăi care lucrează la cadouri.
Spune-le că ai foarte multă treabă pentru că se apropie Crăciunul.
Fii entuziast despre cadourile pe care le pregătesc elfii!

FOARTE IMPORTANT: La FINALUL răspunsului tău, TREBUIE să anunți că le vei arăta elfii tăi.
Termină cu ceva de genul: "Hai să vă arăt elfii mei cum lucrează!" sau "Vreau să vedeți cum lucrează elfii mei la atelierul de jucării!"
Aceasta este OBLIGATORIU - nu uita să anunți că urmează un clip cu elfii!`,
    video: 'elfs_working', // Se va rula după ce termină de vorbit
    shouldListenOnComplete: false, // După video, continuăm automat
    speakingState: 'speaking_normal',
  },
  {
    id: 'suspans_lista',
    name: 'Suspans Listă',
    prompt: `Întreabă-i dacă vor să afle dacă sunt pe lista copiilor cuminți.
Creează suspans și anticipație: "Oare să fii pe lista copiilor cuminți?"
NU arăta lista încă - doar vorbește despre ea și creează emoție!`,
    shouldListenOnComplete: true, // Așteptăm răspunsul copilului
    speakingState: 'speaking_normal',
  },
  {
    id: 'verificare_lista',
    name: 'Verificare Listă',
    prompt: `Spune-le că verifici lista ta magică.
Pentru fiecare copil, spune că îl cauți pe listă.
După ce "găsești" fiecare copil, confirmă că e pe lista copiilor cuminți!
Fii foarte fericit că sunt cuminți!

FOARTE IMPORTANT: La FINALUL răspunsului tău, TREBUIE să anunți că le vei arăta lista.
Termină cu ceva de genul: "Hai să vă arăt lista mea magică!" sau "Vreau să vedeți cum arată lista cu copiii cuminți!"
Aceasta este OBLIGATORIU - nu uita să anunți că urmează un clip cu lista!`,
    video: 'kids_list', // Se va rula pentru fiecare copil
    shouldListenOnComplete: false, // După video, continuăm automat
    speakingState: 'speaking_amazed',
  },
  {
    id: 'zbor_magic_intro',
    name: 'Zbor Magic Introducere',
    prompt: `Spune copilului că pentru că a fost așa cuminte, vrei să îi arăți ceva special.
Întreabă: "Vrei să vezi cum e să zbori cu mine și renii mei?"
Așteaptă răspunsul lor - NU arăta video-ul încă!`,
    shouldListenOnComplete: true, // Așteptăm răspunsul copilului
    speakingState: 'speaking_normal',
  },
  {
    id: 'zbor_magic',
    name: 'Zbor Magic',
    prompt: `Copilul a acceptat să vadă zborul magic! Fii foarte entuziast!
Spune-i să se țină bine că faci o magie și urmează să zburați împreună!

FOARTE IMPORTANT: Răspunsul tău TREBUIE să termine cu anunțul zborului magic.
Termină OBLIGATORIU cu ceva de genul: "Ține-te bine! Hai să zburăm! Abracadabra!" sau "Pregătește-te că pornim la drum! Zbor magic!"
Aceasta este OBLIGATORIU - nu uita să anunți că urmează zborul!`,
    video: 'flight',
    shouldListenOnComplete: false, // După video, continuăm automat
    speakingState: 'speaking_amazed',
  },
  {
    id: 'dupa_zbor',
    name: 'După Zbor',
    prompt: `Întreabă-l cum i s-a părut zborul magic!
Fii curios și entuziast să afli ce a simțit!`,
    shouldListenOnComplete: true, // Așteptăm răspunsul
    speakingState: 'speaking_normal',
  },
  {
    id: 'dorinte',
    name: 'Dorințe',
    prompt: `Întreabă-l ce își dorește de Crăciun.
Ascultă cu atenție și reacționează la fiecare dorință.
Fii entuziast și promite că vei încerca să le aduci!
Dacă are mai multe dorințe, ascultă-le pe toate.`,
    shouldListenOnComplete: true, // Așteptăm dorințele
    speakingState: 'speaking_normal',
  },
  {
    id: 'conversatie_libera',
    name: 'Conversație Liberă',
    prompt: `Continuă conversația natural cu copilul/copiii.
Răspunde la întrebările lor, povestește despre Crăciun, despre reni, despre elfi.
Fii prietenos și plin de căldură. Poți întreba ce mai fac, ce au făcut la școală, etc.
Nu te grăbi - bucură-te de conversație!`,
    shouldListenOnComplete: true,
    speakingState: 'speaking_normal',
    isLooping: true, // Acest pas se repetă până la timeout
  },
  {
    id: 'incheiere',
    name: 'Încheiere',
    prompt: `Spune-le că din păcate trebuie să pleci pentru că ai foarte mult de lucru la atelierul de jucării.
Urează-le sărbători frumoase și spune-le să fie în continuare copii cuminți!
Spune-le că te vei întoarce în noaptea de Crăciun cu cadouri!
Încheie cu căldură și Ho Ho Ho!`,
    shouldListenOnComplete: false, // După încheiere nu mai așteptăm răspuns
    speakingState: 'speaking_normal',
    autoEndCall: true, // Auto-închide apelul după acest pas
  },
];

// ============================================
// AGENDA MARKETING - Pentru părinți (demo)
// ============================================
export const SANTA_AGENDA_MARKETING = [
  {
    id: 'intro_marketing',
    name: 'Introducere Marketing',
    video: 'intro',
    shouldListenOnComplete: true,
  },
  {
    id: 'salut_parinti',
    name: 'Salut Părinți',
    prompt: `Tocmai ai vorbit cu un părinte interesat de serviciul tău.
Salută-l călduros și prezintă-te ca Moș Crăciun!
Spune-i că ești bucuros să îi arăți cum funcționează aplicația "Sună-l pe Moș Crăciun!".
Întreabă-l cum îl cheamă și dacă are copii.`,
    shouldListenOnComplete: true,
    speakingState: 'speaking_normal',
    multiTurn: true,
  },
  {
    id: 'explicare_concept',
    name: 'Explicare Concept',
    prompt: `Explică părintelui conceptul aplicației:
- Copiii pot vorbi LIVE cu tine, Moș Crăciun, printr-un apel video
- Tu știi deja informații despre copil (nume, vârstă, hobby-uri, prieteni) - părintele le completează dinainte
- Copilul va fi UIMIT când vei menționa lucruri pe care "doar Moșul magic le poate ști"
- E o experiență magică și memorabilă pentru copii

Fii entuziast și convingător! Întreabă dacă are întrebări.`,
    shouldListenOnComplete: true,
    speakingState: 'speaking_amazed',
    multiTurn: true,
  },
  {
    id: 'demo_secrete',
    name: 'Demo Secrete',
    prompt: `Demonstrează cum funcționează "secretele":
- Spune că părintele completează informații despre copil înainte de apel
- Exemple: numele copilului, vârsta, ce hobby-uri are, ce animăluț are, ce prieteni are
- În timpul apelului, tu menționezi aceste lucruri ca și cum le-ai ști prin magie
- Copilul va fi fascinat și va crede cu adevărat în magia Crăciunului!

Oferă exemple concrete și întreabă dacă vrea să vadă clipurile pe care le vor vedea copiii.`,
    shouldListenOnComplete: true,
    speakingState: 'speaking_normal',
    multiTurn: true,
  },
  {
    id: 'arata_polul_nord',
    name: 'Arată Polul Nord',
    prompt: `Spune părintelui că vrei să îi arăți ce vor vedea copiii în timpul apelului.
Anunță că urmează un clip cu Polul Nord și atelierul tău!

FOARTE IMPORTANT: Termină cu: "Hai să vă arăt Polul Nord și unde locuiesc eu!"`,
    video: 'polulnord',
    shouldListenOnComplete: false,
    speakingState: 'speaking_normal',
  },
  {
    id: 'arata_elfii',
    name: 'Arată Elfii',
    prompt: `Explică că acest clip cu elfii lucrând la cadouri îi fascinează pe copii.
Spune că în timpul apelului, vorbești despre cât de ocupat ești și apoi le arăți elfii.

FOARTE IMPORTANT: Termină cu: "Și acum hai să vedeți elfii mei la lucru!"`,
    video: 'elfs_working',
    shouldListenOnComplete: false,
    speakingState: 'speaking_amazed',
  },
  {
    id: 'reactie_clipuri',
    name: 'Reacție Clipuri',
    prompt: `Întreabă părintele ce părere are până acum despre ce a văzut.
Așteaptă răspunsul lui și răspunde la eventuale întrebări.
Spune-i că mai ai două momente speciale de arătat: lista copiilor cuminți și zborul magic.

FOARTE IMPORTANT pentru readyForNext:
- Setează readyForNext: false când întrebi ce părere are
- Așteaptă răspunsul părintelui
- După ce răspunde și nu mai are întrebări, setează readyForNext: true`,
    shouldListenOnComplete: true,
    speakingState: 'speaking_normal',
    multiTurn: true,
  },
  {
    id: 'arata_lista',
    name: 'Arată Lista',
    prompt: `Explică momentul magic al listei:
- Întrebi copilul dacă vrea să afle dacă e pe lista celor cuminți
- Creezi suspans și emoție
- Apoi îi arăți lista magică și confirmă că e cuminte!

FOARTE IMPORTANT: Termină cu: "Și acum, lista magică cu copiii cuminți!"`,
    video: 'kids_list',
    shouldListenOnComplete: false,
    speakingState: 'speaking_amazed',
  },
  {
    id: 'arata_zborul',
    name: 'Arată Zborul',
    prompt: `Explică zborul magic:
- E momentul culminant al apelului
- Copilul "zboară" cu tine și renii prin cerul nopții
- Copiii adoră acest moment și vorbesc despre el zile întregi!

FOARTE IMPORTANT: Termină cu: "Și acum, zborul magic cu sania mea!"`,
    video: 'flight',
    shouldListenOnComplete: false,
    speakingState: 'speaking_amazed',
  },
  {
    id: 'intrebari_finale',
    name: 'Întrebări Finale',
    prompt: `Întreabă părintele dacă are întrebări despre aplicație.
Răspunde la orice nelămurire.
Subliniază că experiența e unică și memorabilă pentru copii.
Încurajează-l să încerce serviciul pentru copilul/copiii lui.

FOARTE IMPORTANT pentru readyForNext:
- Când ÎNTREBI dacă are întrebări, setează readyForNext: false și AȘTEAPTĂ răspunsul!
- Doar când părintele confirmă că NU mai are întrebări sau spune că e gata, setează readyForNext: true
- Dacă părintele pune o întrebare, răspunde și apoi întreabă din nou dacă mai are întrebări (readyForNext: false)`,
    shouldListenOnComplete: true,
    speakingState: 'speaking_normal',
    multiTurn: true,
  },
  {
    id: 'incheiere_marketing',
    name: 'Încheiere Marketing',
    prompt: `Mulțumește părintelui pentru timpul acordat.
Spune-i că abia aștepți să vorbești cu copilul/copiii lui.
Urează-i sărbători frumoase și încheie cu Ho Ho Ho!
Invită-l să acceseze site-ul pentru a programa un apel.`,
    shouldListenOnComplete: false,
    speakingState: 'speaking_normal',
    autoEndCall: true,
  },
];

// Video-uri speciale disponibile pentru agendă (cu sunet propriu)
export const AGENDA_SPECIAL_VIDEOS = ['elfs_working', 'kids_list', 'flight', 'polulnord'];

// Stările de speaking disponibile
export const SPEAKING_STATES = {
  speaking_normal: 'speaking_normal',
  speaking_amused: 'speaking_amused',
  speaking_amazed: 'speaking_amazed',
};

// Funcție pentru a obține pasul curent din agendă
export const getAgendaStep = (stepId) => {
  return SANTA_AGENDA.find(step => step.id === stepId);
};

// Funcție pentru a obține următorul pas din agendă
export const getNextAgendaStep = (currentStepId) => {
  const currentIndex = SANTA_AGENDA.findIndex(step => step.id === currentStepId);
  if (currentIndex === -1 || currentIndex >= SANTA_AGENDA.length - 1) {
    return null;
  }
  return SANTA_AGENDA[currentIndex + 1];
};

// Funcție pentru a obține promptul simplificat pentru GPT
// (GPT nu mai gestionează agenda, doar răspunde la prompt-uri specifice)
export const getSimplifiedPrompt = (step, childInfo, conversationSummary, childState) => {
  if (!step || !step.prompt) return null;

  let prompt = step.prompt;

  // Adăugăm contextul despre copii dacă avem
  if (childState) {
    let childContext = '\n\nINFORMAȚII CUNOSCUTE DESPRE COPII:\n';
    if (childState.childNames && childState.childNames.length > 0) {
      childContext += `- Nume: ${childState.childNames.join(', ')}\n`;
    }
    if (childState.childAges && childState.childAges.length > 0) {
      childContext += `- Vârste: ${childState.childAges.join(', ')}\n`;
    }
    if (childState.childGender) {
      childContext += `- Gen: ${childState.childGender}\n`;
    }
    if (childState.childCount) {
      childContext += `- Număr copii: ${childState.childCount}\n`;
    }
    prompt += childContext;
  }

  // Adăugăm sumarul conversației
  if (conversationSummary) {
    prompt += `\n\nSUMAR CONVERSAȚIE:\n${conversationSummary}`;
  }

  return prompt;
};
