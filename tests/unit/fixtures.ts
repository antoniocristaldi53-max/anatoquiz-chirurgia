import type { CardInputT } from '../../src/lib/schema';

export const fonte = { testo: "Skandalakis' Surgical Anatomy", riferimento: 'cap. Extrahepatic biliary tract and gallbladder' };

export function mcq(id: string, extra: Partial<CardInputT> = {}): CardInputT {
  return {
    id,
    distretto: 'vie-biliari',
    argomento: 'Triangolo di Calot',
    interventi: ['colecistectomia VLS'],
    tipo: 'mcq',
    livello: 1,
    domanda: 'Quale struttura delimita in alto il triangolo epatocistico?',
    opzioni: ['Margine inferiore del fegato', 'Dotto cistico', 'Coledoco'],
    corrette: [0],
    spiegazione: 'Il triangolo epatocistico è delimitato da dotto cistico, dotto epatico comune e margine epatico.',
    fonte,
    tag: [],
    verificata: false,
    ...extra,
  };
}

export function tenCardsOneBroken(): unknown[] {
  const items: unknown[] = Array.from({ length: 10 }, (_, i) => mcq(`test-${String(i + 1).padStart(4, '0')}`));
  // la 7ª card è malformata: livello non ammesso
  items[6] = { ...(items[6] as object), livello: 4 };
  return items;
}
