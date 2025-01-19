import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface StoredCard extends CardData {
  timestamp: number;
  id: string;
}

let extractedCards: StoredCard[] = [];
const EXPIRY_TIME = 10 * 60 * 1000;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function cleanupExpiredCards() {
  const now = Date.now();
  extractedCards = extractedCards.filter(card => (now - card.timestamp) < EXPIRY_TIME);
}

interface Message {
  content: string;
}

interface CardData {
  name: string;
  first_mes: string;
  description: string;
  personality: string;
  mes_example: string;
  scenario: string;
}

function extractPersonaName(content: string, personaIndex: number = 0): string {
  const personaMatches = Array.from(content.matchAll(/'s Persona:/g));
  if (personaMatches.length <= personaIndex) return "";
  
  const personaIdx = personaMatches[personaIndex].index!;
  const lineStartIdx = content.lastIndexOf('\n', personaIdx);
  const lineEndIdx = personaIdx;
  
  return content.slice(lineStartIdx === -1 ? 0 : lineStartIdx + 1, lineEndIdx).trim();
}

function safeReplace(text: string, old: string, newStr: string): string {
  return old ? text.replace(new RegExp(old, 'g'), newStr) : text;
}

function extractCardData(messages: Message[]): CardData {
  const content0 = messages[0].content;
  const content1 = messages[1].content;

  const userName = extractPersonaName(content0, 0);
  const charName = extractPersonaName(content0, 1);

  const personaMatches = Array.from(content0.matchAll(/'s Persona:/g));
  let cardData: CardData = {
    name: charName,
    description: "",
    scenario: "",
    mes_example: "",
    personality: "",
    first_mes: content1
  };

  if (personaMatches.length >= 2) {
    const secondPersonaIdx = personaMatches[1].index!;
    const startDesc = secondPersonaIdx + "'s Persona:".length;
    const remaining = content0.slice(startDesc);

    const scenarioMarker = remaining.match(/Scenario of the roleplay:/);
    const exampleMarker = remaining.match(/Example conversations between/);

    let endIdx = remaining.length;
    if (scenarioMarker) endIdx = Math.min(endIdx, scenarioMarker.index!);
    if (exampleMarker) endIdx = Math.min(endIdx, exampleMarker.index!);

    cardData.description = remaining.slice(0, endIdx).trim();

    if (scenarioMarker) {
      const scenarioStart = scenarioMarker.index! + scenarioMarker[0].length;
      const scenarioRemaining = remaining.slice(scenarioStart);
      const exampleInScenarioMarker = scenarioRemaining.match(/Example conversations between/);
      const scenarioEnd = exampleInScenarioMarker ? exampleInScenarioMarker.index! : scenarioRemaining.length;
      cardData.scenario = scenarioRemaining.slice(0, scenarioEnd).trim();
    }

    if (exampleMarker) {
      const exampleStart = exampleMarker.index!;
      const rawExampleStr = remaining.slice(exampleStart).trim();
      const colonIdx = rawExampleStr.indexOf(':');
      cardData.mes_example = colonIdx !== -1 ? 
        rawExampleStr.slice(colonIdx + 1).trim() : 
        rawExampleStr.trim();
    }
  }

  for (const field in cardData) {
    if (field !== 'name') {
      const val = cardData[field as keyof CardData];
      if (typeof val === 'string') {
        let newVal = safeReplace(val, userName, '{{user}}');
        newVal = safeReplace(newVal, charName, '{{char}}');
        cardData[field as keyof CardData] = newVal;
      }
    }
  }

  return cardData;
}

export async function POST(request: NextRequest) {
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const body = await request.json();
    
    if (!body.messages || body.messages.length < 2) {
      return NextResponse.json(
        { error: "Missing messages or insufficient message count" },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const cardData = extractCardData(body.messages);
    extractedCards.push({
      ...cardData,
      timestamp: Date.now(),
      id: generateId()
    });

    cleanupExpiredCards();

    return NextResponse.json({ status: "Card stored successfully" }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
    
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

export async function GET() {
  cleanupExpiredCards();
  
  return NextResponse.json({ 
    status: "online", 
    cards: extractedCards.map(({ timestamp, ...card }) => card) // Keep ID but remove timestamp
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 