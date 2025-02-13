import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
  extractedCards = extractedCards.filter(
    (card) => now - card.timestamp < EXPIRY_TIME
  );
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

interface PersonaMatch {
  tag: string;
  content: string;
}

function findTagsBetween(content: string, startMarker: string, endMarker: string): PersonaMatch[] {
  const startMarkerTag = `<${startMarker}>`;
  const endMarkerTag = `<${endMarker}>`;
  
  const startIdx = content.indexOf(startMarkerTag);
  if (startIdx === -1) return [];
  
  // Look for any XML-style tags after the system tag
  const section = content.slice(startIdx);
  const matches: PersonaMatch[] = [];
  
  // Match any tag that comes before the scenario tag
  const tagPattern = /<([^/>\s][^>]*)>([\s\S]*?)<\/\1>/g;
  let match;
  
  try {
    while ((match = tagPattern.exec(section)) !== null) {
      // Stop if we hit the scenario tag
      if (match[1] === endMarker) {
        break;
      }
      
      // Skip the system tag
      if (match[1] !== startMarker) {
        matches.push({
          tag: match[1].trim(),
          content: match[2].trim()
        });
      }
    }
  } catch (error) {
    console.error("Error during regex execution:", error);
  }
  
  return matches;
}

function extractBetweenTags(content: string, tag: string): string {
  const startTag = `<${tag}>`;
  const endTag = `</${tag}>`;
  const startIndex = content.indexOf(startTag);
  if (startIndex === -1) return "";
  
  const endIndex = content.indexOf(endTag, startIndex);
  if (endIndex === -1) return "";
  
  return content.slice(startIndex + startTag.length, endIndex).trim();
}

function safeReplace(text: string, old: string, newStr: string): string {
  return old ? text.replace(new RegExp(old, "g"), newStr) : text;
}

function extractCardData(messages: Message[]): CardData {
  const content0 = messages[0].content;
  const content1 = messages[2].content;

  // Find all persona tags between system and scenario, take the last one as character
  const personas = findTagsBetween(content0, "system", "scenario");
  const charPersona = personas[personas.length - 1];
  const charName = charPersona?.tag || "";

  // Initialize card data with the character name
  let cardData: CardData = {
    name: charName,
    description: charPersona?.content || "",
    scenario: extractBetweenTags(content0, "scenario"),
    mes_example: extractBetweenTags(content0, "example_dialogs"),
    personality: "", // This field isn't used in the new format
    first_mes: content1,
  };

  // Replace character name with placeholder in all fields
  for (const field in cardData) {
    if (field !== "name") {
      const val = cardData[field as keyof CardData];
      if (typeof val === "string") {
        cardData[field as keyof CardData] = safeReplace(val, charName, "{{char}}");
      }
    }
  }

  return cardData;
}

export async function POST(request: NextRequest) {
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const cardData = extractCardData(body.messages);
    extractedCards.push({
      ...cardData,
      timestamp: Date.now(),
      id: generateId(),
    });

    cleanupExpiredCards();

    return NextResponse.json(
      { status: "Card stored successfully" },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}

export async function GET() {
  cleanupExpiredCards();

  return NextResponse.json(
    {
      status: "online",
      cards: extractedCards.map(({ timestamp, ...card }) => card),
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
