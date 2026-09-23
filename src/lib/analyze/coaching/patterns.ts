// Keyword patterns for coaching sales pages. JavaScript's `\b` only knows ASCII
// word characters, so it breaks around accented letters ("sì", "è", "perché").
// `phrases()` builds a Unicode-aware boundary instead: a match can't be glued
// to another letter/digit on either side.
export function phrases(...alternatives: string[]): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join("|")})(?![\\p{L}\\p{N}])`, "iu");
}

// Same as phrases() but global, for counting / collecting distinct matches.
export function phrasesGlobal(...alternatives: string[]): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join("|")})(?![\\p{L}\\p{N}])`, "giu");
}

export function distinctMatches(text: string, re: RegExp): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(re)) found.add(m[0].toLowerCase().replace(/\s+/g, " "));
  return Array.from(found);
}

// ---- Headline / hero -------------------------------------------------------

/** Outcome / transformation language — the "dream outcome" a headline sells. */
export const OUTCOME = phrases(
  "achieve\\w*", "transform\\w*", "become", "build", "grow", "scale", "lose", "land", "double", "triple",
  "without", "finally", "unlock", "master", "launch", "attract", "earn", "sign", "create", "reclaim", "stop", "discover",
  "raggiung\\w*", "trasform\\w*", "diventa\\w*", "costruisc\\w*", "cresc\\w*", "scal\\w*", "ottien\\w*", "crea\\w*",
  "raddoppia\\w*", "triplica\\w*", "senza", "finalmente", "sblocca\\w*", "padroneggia\\w*", "lancia\\w*", "attira\\w*",
  "guadagna\\w*", "smetti", "scopri", "libera\\w*", "ritrova\\w*",
  "consigue", "transforma", "sin", "logra", "obtén", "sans", "atteindre", "ohne", "erreiche", "sem", "alcance"
);

/** A concrete time-to-result ("in 90 days", "12-week", "in 8 settimane"). */
// Frequencies ("2 days a week", "3 giorni a settimana") describe a schedule,
// not a time-to-result, so they're excluded.
const NOT_FREQUENCY = "(?!\\s+(?:a|per|each|every|alla|a settimana|al mese|l'anno)(?![\\p{L}]))";
export const TIMEFRAME = phrases(
  `in (?:just |only )?\\d+ (?:days?|weeks?|months?)${NOT_FREQUENCY}`,
  `\\d+[- ](?:day|week|month)s?${NOT_FREQUENCY}`,
  `in (?:soli |appena )?\\d+ (?:giorni|settimane|mesi)${NOT_FREQUENCY}`,
  `\\d+ (?:giorni|settimane|mesi)${NOT_FREQUENCY}`,
  "en \\d+ (?:días|semanas|meses)", "en \\d+ (?:jours|semaines|mois)", "in \\d+ (?:tagen|wochen|monaten)",
  "em \\d+ (?:dias|semanas|meses)"
);

// ---- Avatar -----------------------------------------------------------------

export const WHO_FOR = phrases(
  "this is for you if", "who is this for", "who this (?:program|course|is) (?:is )?for", "is this (?:program |course )?(?:right )?for me",
  "perfect for", "designed for", "built for", "for (?:coaches|women|men|entrepreneurs|founders|leaders|moms|mums|professionals|executives|managers|consultants|therapists|creators|freelancers|business owners)",
  "if you(?:'re| are) an? ",
  "è per te se", "questo (?:programma|percorso|corso) è per te", "a chi è rivolto", "per chi è", "fa per te se", "è pensato per",
  "è rivolto a", "per (?:coach|donne|imprenditori|imprenditrici|professionisti|manager|mamme|liberi professionisti|terapeuti|consulenti|freelance)",
  "se sei (?:un|una|un')", "es para ti si", "c'est pour (?:toi|vous) si", "ist für dich", "é para você se"
);

export const NOT_FOR = phrases(
  "not for you", "isn't for you", "is not for you", "who (?:this|it) is not for", "not a fit", "not right for you", "don't join",
  "non è per te", "non fa per te", "a chi non è rivolto", "non è adatto", "per chi non è",
  "no es para ti", "n'est pas pour (?:toi|vous)", "nicht für dich", "não é para você"
);

// ---- Problem & vision ---------------------------------------------------------

export const PAIN = phrasesGlobal(
  "struggl\\w*", "stuck", "overwhelm\\w*", "frustrat\\w*", "tired of", "sick of", "burn(?:ed|t)? ?out", "anxious", "anxiety",
  "confus\\w*", "you(?:'ve| have) tried", "keeps you up", "fed up", "exhausted", "plateau\\w*", "feel like", "no matter how",
  "the problem", "the truth is",
  "bloccat\\w*", "sopraffatt\\w*", "stanc[oa] di", "esaust\\w*", "confus\\w*", "ti senti", "hai già provato", "il problema",
  "fatica", "ansia", "paura", "non riesci", "insoddisfatt\\w*", "la verità è",
  "atascad\\w*", "agotad\\w*", "bloqué\\w*", "épuisé\\w*", "festgefahren", "erschöpft", "preso", "cansad\\w*"
);

export const VISION = phrases(
  "imagine", "picture (?:this|yourself)", "what (?:would|if) (?:it|you)", "what would it mean", "wake up", "your life (?:after|when)",
  "immagina\\w*", "pensa a come", "come sarebbe", "ti sveglierai", "svegliarti", "la tua vita",
  "imagina", "imagine[zs]?", "stell dir vor", "imagine só"
);

// ---- Coach authority ------------------------------------------------------------

export const COACH_STORY = phrases(
  "meet your coach", "about me", "my story", "who am i", "hi[.,!]? i'm", "hey[.,!]? i'm", "i'm your coach", "about the coach",
  "your coach", "your mentor", "about your (?:host|coach|mentor)", "i was once", "i used to",
  "chi sono", "la mia storia", "il tuo coach", "la tua coach", "mi presento", "ciao[.,!]? sono", "piacere[.,!]? sono", "chi ti guiderà",
  "il tuo mentore", "la tua mentore", "anch'io ero", "anni fa ero",
  "sobre mí", "mi historia", "qui suis-je", "mon histoire", "über mich", "meine geschichte", "sobre mim", "minha história"
);

export const CREDENTIALS = phrases(
  "certified", "certification", "icf", "pcc", "mcc", "acc", "emcc", "nlp", "phd", "psychologist", "licensed", "accredited",
  "\\d+\\+? years? (?:of )?experience", "coached (?:over )?\\d[\\d,.]*\\+?", "helped (?:over )?\\d[\\d,.]*\\+?", "worked with \\d[\\d,.]*\\+?",
  "certificat\\w*", "accreditat\\w*", "\\d+ anni di esperienza", "psicolog\\w*", "psicoterapeut\\w*", "laurea\\w*", "formatore", "formatrice",
  "ho aiutato (?:oltre |più di )?\\d[\\d.]*", "ho seguito (?:oltre |più di )?\\d[\\d.]*",
  "certificad\\w*", "certifié\\w*", "zertifiziert\\w*"
);

export const MEDIA = phrases(
  "as seen (?:on|in)", "featured (?:on|in)", "as featured", "in the press", "forbes", "entrepreneur\\.com", "inc\\. ?magazine", "tedx?",
  "huffpost", "bbc", "cnn", "fast company", "business insider", "the guardian",
  "visto su", "parlano di (?:noi|me)", "ospite (?:di|a)", "il sole 24 ore", "corriere", "la repubblica", "rai", "mediaset", "sky tg24",
  "vu (?:sur|dans)", "visto en", "bekannt aus", "visto em"
);

// ---- Offer ---------------------------------------------------------------------

export const CURRICULUM = phrasesGlobal(
  "modules?", "week \\d+", "curriculum", "lessons?", "what you(?:'ll| will) learn", "inside the program\\w*", "phase \\d+", "step \\d+",
  "program(?:me)? breakdown", "roadmap", "framework",
  "modul[oi]", "lezion[ei]", "settimana \\d+", "cosa imparerai", "programma del (?:corso|percorso)", "fase \\d+", "step \\d+", "tappa \\d+",
  "cosa troverai", "all'interno del (?:programma|percorso|corso)",
  "módulo", "lecciones", "semana \\d+", "leçons?", "semaine \\d+", "lektion\\w*", "woche \\d+", "aulas"
);

/** Delivery format — what the buyer actually gets (reduces perceived effort). */
export const DELIVERABLES = phrasesGlobal(
  "live (?:calls?|coaching|sessions?|q&a|workshops?|trainings?)", "group coaching", "1:1", "1-on-1", "one[- ]on[- ]one", "private coaching",
  "community", "slack", "facebook group", "circle", "discord", "recordings?", "lifetime access", "workbooks?", "templates?", "scripts?",
  "voxer", "whatsapp", "telegram", "office hours", "coaching calls?", "hot seats?", "accountability", "done[- ]for[- ]you", "done[- ]with[- ]you",
  "video lessons?", "worksheets?", "checklists?", "masterminds?", "retreat",
  "sessioni? (?:live|individual[ei]|di gruppo|1:1)", "call (?:di gruppo|settimanal[ei]|live|individual[ei])", "coaching (?:individuale|di gruppo)",
  "accesso a vita", "registrazion[ei]", "gruppo (?:privato|telegram|whatsapp|facebook)", "community privata", "material[ei]", "esercizi",
  "videolezion[ei]", "supporto", "affiancamento", "percorso individuale", "ritiro",
  "sesiones? en vivo", "acceso de por vida", "grabaciones", "sessions? en direct", "accès à vie", "live-calls?", "lebenslanger zugang"
);

export const VALUE_ANCHOR = phrases(
  "total value", "real value", "(?:a |an )?\\$?\\d[\\d,.]* value", "valued at", "worth (?:over )?[$€£]", "value:? [$€£]",
  "valore (?:totale|reale|complessivo)", "del valore di", "valore:? [$€£]?\\d", "vale (?:oltre )?[$€£]?\\d", "(?:tutto|il tutto) (?:questo )?(?:a|per) (?:soli )?",
  "valor total", "valeur totale", "gesamtwert"
);

export const BONUS = phrasesGlobal(
  "bonus(?:es)?", "fast[- ]action", "free gift", "exclusive gift", "plus you(?:'ll)? get", "regalo", "in omaggio", "extra", "incluso gratis",
  "regalo exclusivo", "cadeau", "geschenk"
);

export const PRICE = /(?:[$€£]\s?\d[\d.,]*|\d[\d.,]*\s?(?:€|£|\$|eur\b|euro\b|usd\b|chf\b))/i;

export const PAYMENT_PLAN = phrases(
  "payment plans?", "\\d+ (?:monthly )?payments? of", "monthly payments?", "installments?", "\\d+\\s?x\\s?[$€£]?\\d", "split pay\\w*", "pay in \\d+",
  "per month", "/mo(?:nth)?", "klarna", "afterpay", "affirm", "scalapay",
  "rate mensili", "(?:in )?\\d+ rate", "pagamento rateale", "a rate", "rateizz\\w*", "al mese", "/mese", "pagamento dilazionato",
  "cuotas", "pagos mensuales", "en \\d+ fois", "mensualités", "ratenzahlung", "parcelas", "parcelado"
);

/** High-ticket coaching commonly hides price behind an application / call. */
export const APPLICATION_FUNNEL = phrases(
  "apply(?: now| today| here)?", "application", "book (?:a|your) (?:free )?(?:call|session|consultation)", "discovery call", "strategy (?:call|session)",
  "clarity call", "breakthrough (?:call|session)", "schedule (?:a|your) call", "free consultation",
  "candidati", "candidatura", "prenota (?:una|la tua) (?:call|chiamata|sessione|consulenza)", "call (?:conoscitiva|strategica|gratuita|di orientamento)",
  "sessione (?:strategica|gratuita|conoscitiva)", "consulenza gratuita", "colloquio (?:gratuito|conoscitivo)",
  "aplica", "llamada de descubrimiento", "postuler", "appel découverte", "bewirb dich", "erstgespräch", "aplique"
);

export const GUARANTEE = phrases(
  "money[- ]?back", "guarantee\\w*", "risk[- ]?free", "full refund", "100% refund", "refund policy", "no questions asked",
  "we(?:'ll| will) work with you until", "or your money back", "results guarantee",
  "soddisfatt[oi] o rimborsat[oi]", "garanzia", "garantit[oa]", "rimborso (?:garantito|completo|totale|integrale)", "senza rischi?",
  "ti rimborso", "ti restituisco",
  "garantía", "reembolso", "garantie", "remboursé", "geld[- ]zurück", "garantia", "reembolso"
);

export const GUARANTEE_SPECIFIC = phrases(
  "\\d+[- ]days? (?:money[- ]back |risk[- ]free |iron[- ]?clad |no[- ]questions[- ]asked )?guarantee",
  "guarantee (?:for|of) \\d+ days", "within \\d+ days", "garanzia (?:di )?\\d+ giorni", "entro \\d+ giorni", "\\d+ giorni (?:di garanzia|soddisfatti)",
  "garantía de \\d+ días", "garantie de \\d+ jours", "\\d+[- ]tage[- ]geld[- ]zurück", "garantia de \\d+ dias"
);

export const URGENCY = phrases(
  "doors close", "enrollment (?:closes|ends|is open)", "enrolment (?:closes|ends)", "cart closes", "next cohort", "cohort starts?", "starts on",
  "limited (?:spots|seats|places|time)", "only \\d+ (?:spots|seats|places)", "spots left", "early[- ]bird", "price (?:goes up|increases)",
  "last chance", "deadline", "ends (?:soon|tonight|at midnight)", "countdown",
  "iscrizioni (?:chiudono|aperte|chiuse)", "chiusura (?:delle )?iscrizioni", "prossima edizione", "posti limitati", "solo \\d+ posti",
  "ultimi posti", "si parte il", "inizia il", "early booking", "il prezzo aumenta", "ultima possibilità", "scade", "offerta a tempo",
  "plazas limitadas", "places limitées", "begrenzte plätze", "vagas limitadas"
);

/** Low-commitment first step — free training, webinar, quiz, challenge. */
export const LEAD_MAGNET = phrases(
  "free (?:training|masterclass|webinar|guide|workshop|challenge|class|ebook|e-book|quiz|assessment|video|mini[- ]course)",
  "masterclass gratuita", "webinar gratuito", "guida gratuita", "workshop gratuito", "sfida (?:gratuita|di \\d+ giorni)", "challenge gratuita",
  "video gratuit[oa]", "lezione gratuita", "mini[- ]corso gratuito", "quiz", "test gratuito", "ebook gratuito",
  "clase gratuita", "formation gratuite", "kostenlose[sr]? (?:training|webinar)", "aula gratuita"
);

// ---- FAQ / objections ---------------------------------------------------------------

export const FAQ_SECTION = phrases(
  "faqs?", "frequently asked questions?", "common questions", "questions\\?", "got questions",
  "domande frequenti", "domande e risposte", "hai (?:ancora )?(?:domande|dubbi)", "dubbi frequenti",
  "preguntas frecuentes", "questions fréquentes", "häufige fragen", "perguntas frequentes"
);

export const OBJECTIONS: { label: string; re: RegExp }[] = [
  {
    label: "time commitment",
    re: phrases("how much time", "time commitment", "hours? (?:a|per) week", "too busy", "don't have time", "quanto tempo", "ore (?:a|alla|per) settimana", "non ho tempo", "tempo richiesto", "cuánto tiempo", "combien de temps"),
  },
  {
    label: "refunds / money",
    re: phrases("refund", "can i get my money back", "afford", "worth the investment", "rimbors\\w*", "posso permettermelo", "vale l'investimento", "costo", "reembolso", "remboursement"),
  },
  {
    label: "will it work for me",
    re: phrases("will this work for me", "what if it doesn't work", "is this right for me", "i've tried (?:other|everything)", "beginner", "e se non funziona", "funzionerà per me", "fa per me", "principiante", "ho già provato", "funcionará para mí", "débutant"),
  },
  {
    label: "logistics (start date / access / format)",
    re: phrases("when does it start", "how long do i have access", "what if i miss", "is it live", "recorded", "quando inizia", "per quanto tempo (?:avrò|ho) accesso", "se perdo", "è registrat\\w*", "cuándo empieza", "quand commence"),
  },
  {
    label: "difference vs. alternatives",
    re: phrases("how is this different", "what makes this different", "why (?:this|not) ", "cosa (?:lo|la|ti) rende divers\\w*", "in cosa è divers\\w*", "perché questo", "qué lo hace diferente", "en quoi est-ce différent"),
  },
];

// ---- CTA copy ------------------------------------------------------------------

/** Coaching-specific CTA verbs on top of the generic CTA_PATTERN. */
export const COACHING_CTA = phrases(
  "enrol+(?: now| today)?", "apply(?: now| today)?", "join(?: now| today| the \\w+)?", "book (?:a|your) (?:call|session|spot)", "claim (?:my|your) spot",
  "save (?:my|your) (?:spot|seat)", "yes,? i(?:'m| am) in", "yes,? i want", "i(?:'m| am) ready", "count me in", "get instant access", "start (?:now|today|my)",
  "iscriviti(?: ora| adesso| subito)?", "candidati(?: ora| adesso)?", "prenota(?: ora| adesso| la tua call| il tuo posto)?", "voglio (?:entrare|iniziare|partecipare|iscrivermi)",
  "sì,? voglio", "sono pront[oa]", "accedi (?:ora|subito)", "entra (?:ora|adesso|nel)", "inizia (?:ora|adesso|subito|il tuo)", "riserva il tuo posto",
  "blocca il tuo posto", "acquista(?: ora)?", "partecipa(?: ora)?",
  "inscríbete", "únete", "s'inscrire", "je m'inscris", "jetzt anmelden", "jetzt bewerben", "inscreva-se", "quero entrar"
);

/** First-person / benefit CTAs ("Yes, I want…", "Start my…") outperform generic ones. */
export const STRONG_CTA_COPY = phrases(
  "my", "yes", "i want", "i'm in", "i am in", "count me in", "claim", "save my", "get instant",
  "mio", "mia", "miei", "voglio", "sì", "sono pront[oa]", "il mio posto", "riserva", "blocca",
  "quiero", "mi lugar", "je veux", "ma place", "ich will", "quero"
);

export const GENERIC_CTA_COPY = phrases(
  "submit", "click here", "learn more", "read more", "more info", "send", "continue",
  "invia", "clicca qui", "scopri di più", "leggi di più", "maggiori informazioni", "continua", "invio",
  "enviar", "haz clic aquí", "envoyer", "cliquez ici", "absenden", "hier klicken", "clique aqui"
);

// ---- Trust / compliance ---------------------------------------------------------------

/** Outcome language inside testimonials — "went from X to Y", "signed 5 clients". */
export const RESULT_LANGUAGE = phrasesGlobal(
  "went from", "in (?:just |only )?\\d+ (?:days?|weeks?|months?)", "lost \\d+", "signed \\d+", "landed", "doubled", "tripled", "\\d+k", "\\d+%",
  "[$€£]\\s?\\d[\\d.,]*", "first client", "quit my job", "promoted", "(?:my|our) revenue", "six[- ]figure", "7[- ]figure",
  "sono passat[oa] da", "in (?:soli )?\\d+ (?:giorni|settimane|mesi)", "ho perso \\d+", "ho trovato", "ho raddoppiato", "ho triplicato",
  "primo cliente", "primi clienti", "ho lasciato il (?:mio )?lavoro", "promozione", "fatturato", "ho ottenuto", "sono riuscit[oa]",
  "pasé de", "je suis passé", "ich habe", "passei de"
);

export const INCOME_CLAIM = phrases(
  "six[- ]figure", "seven[- ]figure", "[67][- ]figure", "\\d+k (?:months?|per month|a month|/mo)", "make [$€£]?\\d[\\d,.]*k?(?: per| a)? (?:month|year)",
  "earn (?:up to )?[$€£]\\d", "quit your (?:9-5|job)", "passive income", "financial freedom",
  "\\d+k al mese", "guadagna(?:re)? (?:fino a )?[€$]?\\d", "a \\d cifre", "libertà finanziaria", "reddito passivo", "fatturare \\d",
  "ingresos pasivos", "libertad financiera", "revenus passifs", "passives einkommen"
);

export const EARNINGS_DISCLAIMER = phrases(
  "earnings disclaimer", "income disclaimer", "results (?:are )?not typical", "results may vary", "individual results (?:may )?vary",
  "no guarantee of (?:income|earnings|results)", "disclaimer",
  "i risultati (?:possono variare|non sono garantiti|variano)", "risultati non garantiti", "non garantiamo (?:risultati|guadagni)", "esclusione di responsabilità",
  "los resultados pueden variar", "les résultats peuvent varier", "ergebnisse können variieren", "os resultados podem variar"
);

/** Hype that erodes trust and can breach FTC/AGCM guidance. */
export const HYPE = phrasesGlobal(
  "guaranteed (?:results|income|success)", "get rich", "overnight", "secret formula", "effortless(?:ly)?", "zero effort", "no effort",
  "magic (?:pill|bullet|formula)", "100% guaranteed", "instant results", "life[- ]changing secret",
  "risultati garantiti", "diventa ricc[oa]", "da un giorno all'altro", "formula segreta", "senza (?:alcuno )?sforzo", "zero sforzo",
  "bacchetta magica", "garantito al 100%", "risultati immediati", "soldi facili",
  "resultados garantizados", "hazte rico", "résultats garantis", "sans effort", "garantierte ergebnisse"
);

export const PRIVACY_LINK = phrases("privacy", "datenschutz", "confidentialité", "privacidad", "privacidade");
export const TERMS_LINK = phrases(
  "terms", "terms (?:of|and) (?:service|use|conditions)", "termini", "condizioni", "t&c", "note legali", "legal", "impressum", "cgv", "términos", "termos", "agb"
);
export const BUSINESS_ID = phrases("p\\.? ?iva", "partita iva", "vat(?: number| no\\.?| id)?", "c\\.f\\.", "codice fiscale", "company (?:no|number)", "ust-idnr", "siret", "cif", "nif", "cnpj");

// ---- Tech / conversion UX ------------------------------------------------------------------

export const TRACKING_SIGNATURES: { name: string; re: RegExp }[] = [
  { name: "Google Analytics 4 / gtag", re: /gtag\(|googletagmanager\.com\/gtag|google-analytics\.com/i },
  { name: "Google Tag Manager", re: /googletagmanager\.com\/gtm|GTM-[A-Z0-9]+/ },
  { name: "Meta Pixel", re: /connect\.facebook\.net\/[^"']*fbevents|fbq\(/i },
  { name: "TikTok Pixel", re: /analytics\.tiktok\.com|ttq\.load/i },
  { name: "LinkedIn Insight", re: /snap\.licdn\.com|_linkedin_partner_id/i },
  { name: "Hotjar", re: /static\.hotjar\.com|hjid/i },
  { name: "Microsoft Clarity", re: /clarity\.ms/i },
];

export const PLATFORM_SIGNATURES: { name: string; re: RegExp }[] = [
  { name: "Kajabi", re: /kajabi/i },
  { name: "Teachable", re: /teachable\.com|teachablecdn/i },
  { name: "Thinkific", re: /thinkific/i },
  { name: "Podia", re: /podia\.com/i },
  { name: "Kartra", re: /kartra/i },
  { name: "ClickFunnels", re: /clickfunnels|myclickfunnels/i },
  { name: "Systeme.io", re: /systeme\.io/i },
  { name: "GoHighLevel", re: /leadconnectorhq|msgsndr|gohighlevel/i },
  { name: "Stan Store", re: /stan\.store/i },
  { name: "ThriveCart", re: /thrivecart/i },
  { name: "SamCart", re: /samcart/i },
  { name: "Stripe Checkout", re: /checkout\.stripe\.com|buy\.stripe\.com|js\.stripe\.com/i },
  { name: "PayPal", re: /paypal\.com\/sdk|paypalobjects/i },
  { name: "Gumroad", re: /gumroad\.com/i },
  { name: "Circle", re: /circle\.so/i },
  { name: "Skool", re: /skool\.com/i },
  { name: "Calendly", re: /calendly\.com/i },
  { name: "TidyCal", re: /tidycal\.com/i },
  { name: "Typeform", re: /typeform\.com/i },
  { name: "Tally", re: /tally\.so/i },
  { name: "Wix", re: /wixstatic|wix\.com/i },
  { name: "Squarespace", re: /squarespace/i },
  { name: "WordPress", re: /wp-content|wp-includes/i },
  { name: "Webflow", re: /webflow/i },
  { name: "Leadpages", re: /leadpages/i },
  { name: "Unbounce", re: /unbounce/i },
  { name: "Framer", re: /framer\.(?:com|website)|framerusercontent/i },
];

export const CHECKOUT_OR_BOOKING = /kajabi|teachable|thinkific|podia|kartra|clickfunnels|systeme\.io|leadconnectorhq|stan\.store|thrivecart|samcart|checkout\.stripe|buy\.stripe|paypal|gumroad|calendly|tidycal|typeform|tally\.so|skool\.com|acuityscheduling|youcanbook\.me|cal\.com/i;

export const CHAT_CHANNEL = /wa\.me\/|api\.whatsapp\.com|whatsapp:\/\/|intercom|crisp\.chat|tawk\.to|manychat|m\.me\/|t\.me\/|tidio|drift\.com|livechat/i;

export const COUNTDOWN_SIGNATURE = /deadlinefunnel|countdown|motion\.page|evergreen|timer/i;
